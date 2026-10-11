'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { parseExternalFareRange } from '@/lib/admin-config-rules';
import type { ExternalFareRangeRecord, LocationRecord, VehicleTypeRecord } from '@/lib/admin-types';
import { formatRupees } from '@/lib/format';
import { routes } from '@/lib/routes';
import { sendAdminChange } from './admin-request';

/** Rupees as typed: a whole number, or NaN so the rules refuse it with their message. */
const rupeesOf = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);

/**
 * The typical fare range from each hub by vehicle type (OA-FR-11, SYS-FR-12, CS455-51). Riders
 * see it as an estimate when they offer a ride; it never sets the fare of a ride (SYS-FR-13).
 * Only active hubs and vehicle types are listed, since only those can be chosen for a ride.
 */
export function FareRangesEditor({
  hubs,
  vehicleTypes,
  ranges,
}: {
  hubs: LocationRecord[];
  vehicleTypes: VehicleTypeRecord[];
  ranges: ExternalFareRangeRecord[];
}) {
  const headingId = useId();
  const activeHubs = hubs.filter((hub) => hub.isActive);
  const activeTypes = vehicleTypes.filter((type) => type.isActive);
  const rangeFor = (hubId: string, vehicleTypeId: string) =>
    ranges.find((range) => range.hubId === hubId && range.vehicleTypeId === vehicleTypeId) ?? null;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-bold tracking-tight">
        Fare ranges from transport hubs
      </h2>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Riders see the range as a typical fare when they offer a ride. It is an estimate only: the
        ride owner sets each ride&apos;s fare.
      </p>
      {activeHubs.length === 0 || activeTypes.length === 0 ? (
        <p className="mt-4 text-ink-muted">Add an active hub and vehicle type first.</p>
      ) : (
        activeHubs.map((hub) => (
          <section key={hub.id} aria-label={`From ${hub.name}`} className="mt-6">
            <h3 className="text-lg font-bold tracking-tight">{hub.name}</h3>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {activeTypes.map((type) => (
                <li key={type.id}>
                  <RangeRow hub={hub} vehicleType={type} initial={rangeFor(hub.id, type.id)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

function RangeRow({
  hub,
  vehicleType,
  initial,
}: {
  hub: LocationRecord;
  vehicleType: VehicleTypeRecord;
  initial: ExternalFareRangeRecord | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [minFare, setMinFare] = useState(initial ? String(initial.minFare) : '');
  const [maxFare, setMaxFare] = useState(initial ? String(initial.maxFare) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const label = `${vehicleType.name} from ${hub.name}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setNote('');
    const parsed = parseExternalFareRange({
      hubId: hub.id,
      vehicleTypeId: vehicleType.id,
      minFare: rupeesOf(minFare),
      maxFare: rupeesOf(maxFare),
      version: saved?.version ?? null,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setSending(true);
    const result = await sendAdminChange<{ range: ExternalFareRangeRecord }>(
      'PUT',
      '/api/admin/external-fares',
      parsed.value,
    );
    setSending(false);
    if (result.ok) {
      setSaved(result.data.range);
      setNote('Saved.');
      return;
    }
    if (result.status === 401) {
      router.push(routes.login);
      return;
    }
    if (result.code === 'version_conflict' && result.current) {
      const current = result.current as ExternalFareRangeRecord;
      setSaved(current);
      setMessage(
        `Someone else set this to ${formatRupees(current.minFare)} to ${formatRupees(current.maxFare)} meanwhile. Save again to replace it with yours.`,
      );
      return;
    }
    setErrors(result.fields);
    setMessage(result.error);
  }

  return (
    <form
      noValidate
      onSubmit={save}
      aria-label={label}
      className="grid items-start gap-x-4 gap-y-3 py-4 sm:grid-cols-[minmax(8rem,1fr)_8rem_8rem_auto]"
    >
      <div className="sm:pt-8">
        <p className="font-semibold">{vehicleType.name}</p>
        <p className="text-sm text-ink-muted">
          {saved
            ? `Now ${formatRupees(saved.minFare)} to ${formatRupees(saved.maxFare)}`
            : 'Not set yet'}
        </p>
      </div>
      <Field
        label="Lowest (₹)"
        inputMode="numeric"
        value={minFare}
        error={errors.minFare}
        onChange={(event) => setMinFare(event.target.value)}
      />
      <Field
        label="Highest (₹)"
        inputMode="numeric"
        value={maxFare}
        error={errors.maxFare}
        onChange={(event) => setMaxFare(event.target.value)}
      />
      <div className="flex flex-col gap-1 sm:pt-7">
        <Button type="submit" variant="secondary" disabled={sending} aria-label={`Save ${label}`}>
          {sending ? 'Saving…' : 'Save'}
        </Button>
        <p role="status" className="text-sm text-ink-muted">
          {note}
        </p>
      </div>
      {message && (
        <p role="alert" className="text-sm text-danger sm:col-span-4">
          {message}
        </p>
      )}
    </form>
  );
}
