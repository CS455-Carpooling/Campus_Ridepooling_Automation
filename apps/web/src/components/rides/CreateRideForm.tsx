'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { DepartureWindowPicker } from './DepartureWindowPicker';
import { FareInput } from './FareInput';
import { RoutePicker, type RouteValue } from './RoutePicker';
import { VehiclePicker } from './VehiclePicker';
import type { RideFormOptions } from '@/lib/ride-options';
import {
  emptyRideDraft,
  minDepartureLocal,
  requestFromDraft,
  validateRideRequest,
  type RideDraft,
  type RideErrors,
} from '@/lib/ride-rules';

type ApiError = {
  error?: string;
  errors?: Partial<Record<keyof RideDraft, string>>;
};

const emptyErrors: RideErrors = {};

export function CreateRideForm() {
  const router = useRouter();
  const [options, setOptions] = useState<RideFormOptions | null>(null);
  const [draft, setDraft] = useState<RideDraft>(emptyRideDraft);
  const [errors, setErrors] = useState<RideErrors>(emptyErrors);
  const [formError, setFormError] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdRideId, setCreatedRideId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const response = await fetch('/api/rides/options', { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as RideFormOptions & ApiError;
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error(data.error ?? 'Unable to load ride options right now.');
        }
        if (!cancelled) setOptions(data);
      } catch (error) {
        if (!cancelled) {
          setFormError(
            error instanceof Error ? error.message : 'Unable to load ride options right now.',
          );
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const capacity = useMemo(
    () => options?.vehicleTypes.find((vehicle) => vehicle.id === draft.vehicleTypeId)?.capacity,
    [draft.vehicleTypeId, options],
  );

  const update = (change: Partial<RideDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(change) as Array<keyof RideDraft>) delete next[key];
      return next;
    });
    setFormError('');
    setCreatedRideId(null);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setCreatedRideId(null);

    if (!options) {
      setFormError('Ride options are still loading. Please try again.');
      return;
    }

    const request = requestFromDraft(draft);
    const validation = validateRideRequest(
      request,
      {
        hubIds: options.hubs.map((place) => place.id),
        campusLocationIds: options.campusPlaces.map((place) => place.id),
        vehicleTypeIds: options.vehicleTypes.map((vehicle) => vehicle.id),
      },
      new Date(),
    );
    if (!validation.ok) {
      setErrors(validation.errors);
      setFormError('Please fix the highlighted fields.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.value),
      });
      const data = (await response.json().catch(() => ({}))) as ApiError & {
        ride?: { id: string };
      };

      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        if (response.status === 400 && data.errors) {
          setErrors(data.errors);
          setFormError('Please fix the highlighted fields.');
        } else {
          setFormError(data.error ?? 'Unable to create the ride right now.');
        }
        return;
      }

      setDraft(emptyRideDraft);
      setErrors(emptyErrors);
      setCreatedRideId(data.ride?.id ?? null);
    } catch {
      setFormError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingOptions) {
    return (
      <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-ink-muted" role="status">
          Loading ride options…
        </p>
      </DesignSystem>
    );
  }

  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
          Offer a ride
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Create a ride</h1>
        <p className="mt-3 text-ink-muted">
          Tell other IITK students where you are going, when you will leave, and what the whole
          vehicle is expected to cost.
        </p>
      </header>

      {formError && (
        <div
          className="mt-6 rounded-control border border-line-strong bg-panel px-4 py-3"
          role="alert"
        >
          {formError}
        </div>
      )}
      {createdRideId && (
        <div
          className="mt-6 rounded-control border border-line-strong bg-panel px-4 py-3"
          role="status"
        >
          Ride created successfully. Your ride is scheduled.
          <span className="sr-only"> Ride ID: {createdRideId}</span>
        </div>
      )}

      <form className="mt-8 flex flex-col gap-10" onSubmit={submit} noValidate>
        <RoutePicker
          campusPlaces={options?.campusPlaces ?? []}
          hubs={options?.hubs ?? []}
          value={
            {
              direction: draft.direction,
              hubId: draft.hubId,
              campusLocationId: draft.campusLocationId,
            } satisfies RouteValue
          }
          onChange={(change) => update(change)}
          errors={{
            direction: errors.direction,
            hubId: errors.hubId,
            campusLocationId: errors.campusLocationId,
          }}
        />

        <VehiclePicker
          vehicleTypes={options?.vehicleTypes ?? []}
          value={draft.vehicleTypeId}
          onChange={(vehicleTypeId) => update({ vehicleTypeId })}
          error={errors.vehicleTypeId}
        />

        <DepartureWindowPicker
          value={{ departureStart: draft.departureStart, departureEnd: draft.departureEnd }}
          onChange={(change) => update(change)}
          earliest={minDepartureLocal(new Date())}
          errors={{
            departureStart: errors.departureStart,
            departureEnd: errors.departureEnd,
          }}
        />

        <FareInput
          value={draft.expectedTotalFare}
          onChange={(expectedTotalFare) => update({ expectedTotalFare })}
          capacity={capacity}
          error={errors.expectedTotalFare}
        />

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <Button type="submit" disabled={submitting || !options}>
            {submitting ? 'Creating ride…' : 'Create ride'}
          </Button>
          {createdRideId && (
            <span className="text-sm text-ink-muted">Ride ID: {createdRideId}</span>
          )}
        </div>
      </form>
    </DesignSystem>
  );
}
