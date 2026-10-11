'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { routes } from '@/lib/routes';
import { ActiveLabel } from './ActiveLabel';
import { sendAdminChange, type AdminResponse } from './admin-request';

/** A vehicle type or a place: what every configuration list item has. */
export type ConfigItem = { id: string; name: string; isActive: boolean; version: number };

export type FieldSpec = {
  key: string;
  label: string;
  hint?: string;
  inputMode?: 'numeric' | 'text';
};

export type Values = Record<string, string>;
export type Checked =
  { ok: true; body: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

export type ConfigListEditorProps<T extends ConfigItem> = {
  /** The list's heading, for example "Vehicle types". */
  title: string;
  /** One item in a sentence, for example "vehicle type". */
  noun: string;
  initial: T[];
  fields: FieldSpec[];
  /** The form's starting values for an item. */
  valuesOf: (item: T) => Values;
  /** One line about an item, under its name. */
  describe: (item: T) => string;
  /** Checks the add form and gives the POST body, or a message per field. */
  checkNew: (values: Values) => Checked;
  /** Checks an edit and gives the PATCH body without its version, or a message per field. */
  checkEdit: (values: Values) => Checked;
  endpoint: string;
  /** Where the answer holds the item, for example "vehicleType". */
  responseKey: string;
  /** What deactivating does, said before the admin confirms it. */
  deactivateEffect: string;
};

type Mode = 'view' | 'edit' | 'confirm';

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * One configuration list (CS455-51, OA-FR-01 to 07): the items with their status, editing in
 * place, deactivating after a confirmation, and adding. Each form is checked with the same rules
 * as the API before it is sent, and the API's own field messages appear next to the fields.
 * When another admin changed an item meanwhile, the admin's input stays in the form and their
 * version is shown, so the admin can keep theirs or save again over it (SYS-NFR-04, 05).
 */
export function ConfigListEditor<T extends ConfigItem>(props: ConfigListEditorProps<T>) {
  const [items, setItems] = useState(props.initial);
  const [status, setStatus] = useState('');
  const headingId = useId();

  const replace = (record: T) =>
    setItems((list) => list.map((item) => (item.id === record.id ? record : item)));

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-bold tracking-tight">
        {props.title}
      </h2>
      <p role="status" className="mt-1 min-h-6 text-sm text-ink-muted">
        {status}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-ink-muted">None yet. Add the first one below.</p>
      ) : (
        <ul aria-label={props.title} className="mt-2 divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow
                item={item}
                editor={props}
                onSaved={(record, note) => {
                  replace(record);
                  if (note) setStatus(note);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <AddItem
        editor={props}
        onAdded={(record) => {
          setItems((list) => [...list, record]);
          setStatus(`Added ${record.name}.`);
        }}
      />
    </section>
  );
}

function useAdminSend() {
  const router = useRouter();
  return async function send<R>(
    method: 'POST' | 'PATCH',
    url: string,
    body: unknown,
  ): Promise<AdminResponse<R> | null> {
    const result = await sendAdminChange<R>(method, url, body);
    if (!result.ok && result.status === 401) {
      router.push(routes.login);
      return null;
    }
    return result;
  };
}

function ItemRow<T extends ConfigItem>({
  item,
  editor,
  onSaved,
}: {
  item: T;
  editor: ConfigListEditorProps<T>;
  onSaved: (record: T, note?: string) => void;
}) {
  const send = useAdminSend();
  const [mode, setMode] = useState<Mode>('view');
  const [values, setValues] = useState<Values>(() => editor.valuesOf(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState<T | null>(null);
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const confirmHeadingId = useId();
  const moveFocus = useRef(false);

  // Focus follows the switch between viewing, editing and confirming, but not on first render.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    const target =
      mode === 'edit'
        ? area.current?.querySelector('input')
        : mode === 'confirm'
          ? area.current?.querySelector<HTMLElement>('[data-confirm]')
          : area.current?.querySelector<HTMLElement>('[data-edit]');
    target?.focus();
  }, [mode]);

  function switchTo(next: Mode) {
    moveFocus.current = true;
    setErrors({});
    setMessage('');
    setConflict(null);
    if (next === 'edit') setValues(editor.valuesOf(item));
    setMode(next);
  }

  async function patch(body: Record<string, unknown>, done: string) {
    setSending(true);
    setMessage('');
    const result = await send<Record<string, T>>(
      'PATCH',
      `${editor.endpoint}/${encodeURIComponent(item.id)}`,
      { ...body, version: item.version },
    );
    setSending(false);
    if (!result) return;
    if (result.ok) {
      moveFocus.current = true;
      setConflict(null);
      setMode('view');
      onSaved(result.data[editor.responseKey], done);
      return;
    }
    if (result.code === 'version_conflict' && result.current) {
      // Their version becomes the one to edit, so saving again replaces it on purpose.
      const current = result.current as T;
      onSaved(current);
      setConflict(current);
      return;
    }
    setErrors(result.fields);
    setMessage(result.error);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = editor.checkEdit(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      setMessage('Check the highlighted fields.');
      return;
    }
    setErrors({});
    void patch(checked.body, `Saved ${values.name?.trim() || item.name}.`);
  }

  const conflictNote = conflict && (
    <div
      role="alert"
      className="rounded-control border border-line-strong bg-panel px-4 py-3 text-sm"
    >
      <p className="font-semibold">Someone else changed this {editor.noun} meanwhile.</p>
      <p className="mt-1">
        It is now: {conflict.name}, {editor.describe(conflict)}
        {conflict.isActive ? '' : ', inactive'}.{' '}
        {mode === 'edit'
          ? 'Your edits are still in the form: save again to replace theirs, or cancel to keep theirs.'
          : 'Confirm again if you still want to change it.'}
      </p>
    </div>
  );

  return (
    <div ref={area}>
      {mode === 'view' && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">{item.name}</span>
              <ActiveLabel active={item.isActive} />
            </p>
            <p className="mt-1 text-sm text-ink-muted">{sentence(editor.describe(item))}</p>
            {message && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {message}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              data-edit
              aria-label={`Edit ${item.name}`}
              onClick={() => switchTo('edit')}
            >
              Edit
            </Button>
            {item.isActive ? (
              <Button
                variant="secondary"
                aria-label={`Deactivate ${item.name}`}
                onClick={() => switchTo('confirm')}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                variant="secondary"
                aria-label={`Reactivate ${item.name}`}
                disabled={sending}
                onClick={() => void patch({ isActive: true }, `Reactivated ${item.name}.`)}
              >
                {sending ? 'Reactivating…' : 'Reactivate'}
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <form
          noValidate
          onSubmit={save}
          aria-label={`Edit ${item.name}`}
          className="flex flex-col gap-4 py-4"
        >
          <p className="font-semibold">Edit {item.name}</p>
          {conflictNote}
          <div className="grid gap-4 sm:grid-cols-2">
            {editor.fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                hint={field.hint}
                inputMode={field.inputMode}
                value={values[field.key] ?? ''}
                error={errors[field.key]}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            ))}
          </div>
          {message && !conflict && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={sending}>
              {sending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button variant="secondary" disabled={sending} onClick={() => switchTo('view')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === 'confirm' && (
        <section
          data-confirm
          tabIndex={-1}
          aria-labelledby={confirmHeadingId}
          className="my-4 rounded-panel border border-line-strong p-5 sm:p-6"
        >
          <h3 id={confirmHeadingId} className="text-lg font-bold tracking-tight">
            Deactivate {item.name}?
          </h3>
          <p className="mt-2 text-ink-muted">
            {editor.deactivateEffect} You can reactivate it at any time.
          </p>
          {conflictNote && <div className="mt-3">{conflictNote}</div>}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={sending}
              onClick={() => void patch({ isActive: false }, `Deactivated ${item.name}.`)}
            >
              {sending ? 'Deactivating…' : 'Yes, deactivate'}
            </Button>
            <Button variant="secondary" disabled={sending} onClick={() => switchTo('view')}>
              Cancel
            </Button>
          </div>
          {message && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function AddItem<T extends ConfigItem>({
  editor,
  onAdded,
}: {
  editor: ConfigListEditorProps<T>;
  onAdded: (record: T) => void;
}) {
  const send = useAdminSend();
  const empty = () => Object.fromEntries(editor.fields.map((field) => [field.key, '']));
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const headingId = useId();

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = editor.checkNew(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      setMessage('Check the highlighted fields.');
      return;
    }
    setSending(true);
    setErrors({});
    setMessage('');
    const result = await send<Record<string, T>>('POST', editor.endpoint, checked.body);
    setSending(false);
    if (!result) return;
    if (result.ok) {
      setValues(empty());
      onAdded(result.data[editor.responseKey]);
      return;
    }
    setErrors(result.fields);
    setMessage(result.error);
  }

  return (
    <form
      noValidate
      onSubmit={add}
      aria-labelledby={headingId}
      className="mt-6 flex flex-col gap-4 rounded-panel border border-line p-5 sm:p-6"
    >
      <h3 id={headingId} className="text-lg font-bold tracking-tight">
        Add a {editor.noun}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {editor.fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            hint={field.hint}
            inputMode={field.inputMode}
            value={values[field.key] ?? ''}
            error={errors[field.key]}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
            }
          />
        ))}
      </div>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={sending}>
          {sending ? 'Adding…' : `Add ${editor.noun}`}
        </Button>
      </div>
    </form>
  );
}
