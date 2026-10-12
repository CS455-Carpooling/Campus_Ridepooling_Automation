'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { parseCampusFare } from '@/lib/admin-config-rules';
import type { CampusFareRecord, LocationRecord, VehicleTypeRecord } from '@/lib/admin-types';
import { formatRupees } from '@/lib/format';
import { routes } from '@/lib/routes';
import { sendAdminChange } from './admin-request';

const rupeesOf = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);
const sameFare = (a: CampusFareRecord, b: CampusFareRecord) =>
  a.fromId === b.fromId && a.toId === b.toId && a.vehicleTypeId === b.vehicleTypeId;

/**
 * Fixed fares between two campus places, by vehicle type (OA-FR-10, CS455-51). A pair is the
 * same in either direction, so it is stored once. Setting a fare that exists changes it.
 */
export function CampusFaresEditor({
  places,
  vehicleTypes,
  fares,
}: {
  places: LocationRecord[];
  vehicleTypes: VehicleTypeRecord[];
  fares: CampusFareRecord[];
}) {
  const router = useRouter();
  const headingId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [list, setList] = useState(fares);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [fare, setFare] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const nameOf = (id: string, items: Array<{ id: string; name: string }>) =>
    items.find((item) => item.id === id)?.name ?? id;
  const activePlaces = places.filter((place) => place.isActive);
  const activeTypes = vehicleTypes.filter((type) => type.isActive);

  function edit(record: CampusFareRecord) {
    setFromId(record.fromId);
    setToId(record.toId);
    setVehicleTypeId(record.vehicleTypeId);
    setFare(String(record.fare));
    setErrors({});
    setMessage('');
    setNote('');
    formRef.current?.querySelector('select')?.focus();
  }

  function remember(record: CampusFareRecord) {
    setList((current) =>
      current.some((item) => sameFare(item, record))
        ? current.map((item) => (sameFare(item, record) ? record : item))
        : [...current, record],
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setNote('');
    const [first, second] = [fromId, toId].sort();
    const existing = list.find(
      (item) =>
        item.fromId === first && item.toId === second && item.vehicleTypeId === vehicleTypeId,
    );
    const parsed = parseCampusFare({
      fromId,
      toId,
      vehicleTypeId,
      fare: rupeesOf(fare),
      version: existing?.version ?? null,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setSending(true);
    const result = await sendAdminChange<{ fare: CampusFareRecord }>(
      'PUT',
      '/api/admin/campus-fares',
      parsed.value,
    );
    setSending(false);
    if (result.ok) {
      remember(result.data.fare);
      setNote(
        `Saved: ${nameOf(result.data.fare.fromId, places)} and ${nameOf(result.data.fare.toId, places)} by ${nameOf(result.data.fare.vehicleTypeId, vehicleTypes)}, ${formatRupees(result.data.fare.fare)}.`,
      );
      return;
    }
    if (result.status === 401) {
      router.push(routes.login);
      return;
    }
    if (result.code === 'version_conflict' && result.current) {
      const current = result.current as CampusFareRecord;
      remember(current);
      setMessage(
        `Someone else set this fare to ${formatRupees(current.fare)} meanwhile. Save again to replace it with yours.`,
      );
      return;
    }
    setErrors(result.fields);
    setMessage(result.error);
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-bold tracking-tight">
        Fares between campus places
      </h2>
      <p className="mt-2 max-w-2xl text-ink-muted">
        The fixed fare for a trip between two campus places, by vehicle type. It is the same in
        either direction.
      </p>

      {list.length === 0 ? (
        <p className="mt-4 text-ink-muted">No campus fares set yet.</p>
      ) : (
        <ul aria-label="Campus fares" className="mt-4 divide-y divide-line border-y border-line">
          {list.map((record) => {
            const label = `${nameOf(record.fromId, places)} and ${nameOf(record.toId, places)} by ${nameOf(record.vehicleTypeId, vehicleTypes)}`;
            return (
              <li
                key={`${record.fromId}:${record.toId}:${record.vehicleTypeId}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
              >
                <p>
                  {label}:{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatRupees(record.fare)}
                  </span>
                </p>
                <Button
                  variant="secondary"
                  aria-label={`Edit ${label}`}
                  onClick={() => edit(record)}
                >
                  Edit
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        ref={formRef}
        noValidate
        onSubmit={save}
        aria-label="Set a campus fare"
        className="mt-6 flex flex-col gap-4 rounded-panel border border-line p-5 sm:p-6"
      >
        <h3 className="text-lg font-bold tracking-tight">Set a campus fare</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Between"
            value={fromId}
            error={errors.fromId}
            onChange={(event) => setFromId(event.target.value)}
          >
            <option value="">Choose a place</option>
            {activePlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="And"
            value={toId}
            error={errors.toId}
            onChange={(event) => setToId(event.target.value)}
          >
            <option value="">Choose a place</option>
            {activePlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Vehicle type"
            value={vehicleTypeId}
            error={errors.vehicleTypeId}
            onChange={(event) => setVehicleTypeId(event.target.value)}
          >
            <option value="">Choose a vehicle type</option>
            {activeTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </SelectField>
          <Field
            label="Fare (₹)"
            inputMode="numeric"
            value={fare}
            error={errors.fare}
            onChange={(event) => setFare(event.target.value)}
          />
        </div>
        {message && (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" disabled={sending}>
            {sending ? 'Saving…' : 'Save fare'}
          </Button>
          <p role="status" className="text-sm text-ink-muted">
            {note}
          </p>
        </div>
      </form>
    </section>
  );
}
