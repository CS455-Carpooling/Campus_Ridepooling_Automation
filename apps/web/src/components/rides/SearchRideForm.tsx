'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { SelectField } from '@/components/ui/SelectField';
import { DepartureWindowPicker } from './DepartureWindowPicker';
import { RoutePicker, type RouteValue } from './RoutePicker';
import type { RideFormOptions } from '@/lib/ride-options';
import { minDepartureLocal, toIstIso } from '@/lib/ride-rules';

type SearchFilters = {
  direction: string;
  hubId: string;
  campusLocationId: string;
  departureStart: string;
  departureEnd: string;
  vehicleTypeId: string;
  maxFareShare: string;
};

const emptyFilters: SearchFilters = {
  direction: '',
  hubId: '',
  campusLocationId: '',
  departureStart: '',
  departureEnd: '',
  vehicleTypeId: '',
  maxFareShare: '',
};

type SearchErrors = Partial<Record<keyof SearchFilters, string>>;

/** The max-fare-share options offered in the dropdown. */
const FARE_SHARE_OPTIONS = [50, 100, 150, 200, 300, 500, 750, 1000];

/**
 * Client component for /rides. Validates the filters, then navigates to
 * /rides/results?... so the results page can be a server component with
 * its own loading.tsx skeleton.
 */
export function SearchRideForm({ options }: { options: RideFormOptions }) {
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [errors, setErrors] = useState<SearchErrors>({});
  const [formError, setFormError] = useState('');

  const update = (change: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...change }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(change) as Array<keyof SearchFilters>) delete next[key];
      return next;
    });
    setFormError('');
  };

  /** Client-side validation before navigating. */
  function clientValidate(): SearchErrors {
    const e: SearchErrors = {};
    if (!filters.direction) e.direction = 'Choose a direction.';
    if (!filters.hubId) e.hubId = 'Choose a station, stand or airport.';
    if (!filters.campusLocationId) e.campusLocationId = 'Choose a campus location.';
    if (!filters.departureStart) e.departureStart = 'Enter the earliest departure time.';
    if (!filters.departureEnd) e.departureEnd = 'Enter the latest departure time.';
    if (
      filters.departureStart &&
      filters.departureEnd &&
      new Date(toIstIso(filters.departureEnd)) <= new Date(toIstIso(filters.departureStart))
    ) {
      e.departureEnd = 'Latest departure must be after the earliest.';
    }
    return e;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const clientErrors = clientValidate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError('Please fix the highlighted fields.');
      return;
    }

    // Build the results URL and navigate: the results page and its
    // loading.tsx take over from here.
    const params = new URLSearchParams({
      direction: filters.direction,
      hubId: filters.hubId,
      campusLocationId: filters.campusLocationId,
      departureStart: toIstIso(filters.departureStart),
      departureEnd: toIstIso(filters.departureEnd),
    });
    if (filters.vehicleTypeId) params.set('vehicleTypeId', filters.vehicleTypeId);
    if (filters.maxFareShare) params.set('maxFareShare', filters.maxFareShare);

    router.push(`/rides/results?${params}`);
  }

  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Page header: mirrors CreateRideForm's header structure */}
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
          Find a ride
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Search for a ride
        </h1>
        <p className="mt-3 text-ink-muted">
          Tell us where you want to go and when, and we will show you open rides you can ask to
          join.
        </p>
      </header>

      {/* Form error banner */}
      {formError && (
        <div
          className="mt-6 rounded-control border border-line-strong bg-panel px-4 py-3"
          role="alert"
        >
          {formError}
        </div>
      )}

      <form className="mt-8 flex flex-col gap-10" onSubmit={submit} noValidate>
        {/* Route: direction + hub + campus location */}
        <RoutePicker
          campusPlaces={options.campusPlaces}
          hubs={options.hubs}
          value={
            {
              direction: filters.direction,
              hubId: filters.hubId,
              campusLocationId: filters.campusLocationId,
            } satisfies RouteValue
          }
          onChange={(change) => update(change)}
          errors={{
            direction: errors.direction,
            hubId: errors.hubId,
            campusLocationId: errors.campusLocationId,
          }}
        />

        {/* Departure window */}
        <DepartureWindowPicker
          value={{ departureStart: filters.departureStart, departureEnd: filters.departureEnd }}
          onChange={(change) => update(change)}
          earliest={minDepartureLocal(new Date())}
          errors={{
            departureStart: errors.departureStart,
            departureEnd: errors.departureEnd,
          }}
        />

        {/* Optional filters */}
        <fieldset className="flex flex-col gap-6">
          <legend className="text-sm font-semibold">Optional filters</legend>

          {/* Vehicle type */}
          <SelectField
            label="Vehicle type"
            hint="Filter by vehicle type, or leave as Any to see all."
            name="vehicleTypeId"
            value={filters.vehicleTypeId}
            onChange={(e) => update({ vehicleTypeId: e.target.value })}
            error={errors.vehicleTypeId}
          >
            <option value="">Any vehicle</option>
            {options.vehicleTypes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.capacity} people)
              </option>
            ))}
          </SelectField>

          {/* Max fare share */}
          <SelectField
            label="Maximum fare share"
            hint="Only show rides where your estimated share is at most this amount."
            name="maxFareShare"
            value={filters.maxFareShare}
            onChange={(e) => update({ maxFareShare: e.target.value })}
          >
            <option value="">Any amount</option>
            {FARE_SHARE_OPTIONS.map((amount) => (
              <option key={amount} value={String(amount)}>
                ₹{amount}
              </option>
            ))}
          </SelectField>
        </fieldset>

        {/* Submit */}
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <Button type="submit">Search rides</Button>
        </div>
      </form>
    </DesignSystem>
  );
}
