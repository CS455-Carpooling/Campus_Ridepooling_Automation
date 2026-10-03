'use client';

import { ChoiceCards } from '@/components/ui/ChoiceCards';
import { SelectField } from '@/components/ui/SelectField';
import type { Place } from '@/lib/ride-options';
import type { RideErrors } from '@/lib/ride-rules';

export type RouteValue = {
  /** 'to_hub', 'from_hub', or '' before the owner chooses. */
  direction: string;
  hubId: string;
  campusLocationId: string;
};

export type RoutePickerProps = {
  campusPlaces: Place[];
  hubs: Place[];
  value: RouteValue;
  onChange: (change: Partial<RouteValue>) => void;
  errors?: Pick<RideErrors, 'direction' | 'hubId' | 'campusLocationId'>;
};

const directionChoices = [
  {
    value: 'to_hub',
    label: 'Leaving campus',
    description: 'From your hall to a station, stand or airport',
  },
  {
    value: 'from_hub',
    label: 'Coming to campus',
    description: 'From a station, stand or airport to your hall',
  },
];

// The wording follows the direction, so the owner always reads where they go.
const hubLegend: Record<string, string> = {
  to_hub: 'Where are you going?',
  from_hub: 'Where are you starting from?',
};
const campusLabel: Record<string, string> = {
  to_hub: 'Pickup on campus',
  from_hub: 'Drop-off on campus',
};

/**
 * The fixed ends of a ride (CS455-25): the direction, a transport hub from the
 * SYS-FR-09 list, and the owner's own place on campus. Riders who join later
 * choose their own campus place, which is why it is asked separately.
 */
export function RoutePicker({
  campusPlaces,
  hubs,
  value,
  onChange,
  errors = {},
}: RoutePickerProps) {
  return (
    <div className="flex flex-col gap-6">
      <ChoiceCards
        legend="Which way are you going?"
        name="direction"
        choices={directionChoices}
        value={value.direction}
        onChange={(direction) => onChange({ direction })}
        error={errors.direction}
      />
      <ChoiceCards
        legend={hubLegend[value.direction] ?? 'Station, stand or airport'}
        name="hubId"
        choices={hubs.map((hub) => ({
          value: hub.id,
          label: hub.name,
          description: hub.detail,
        }))}
        value={value.hubId}
        onChange={(hubId) => onChange({ hubId })}
        error={errors.hubId}
      />
      <SelectField
        label={campusLabel[value.direction] ?? 'Your place on campus'}
        hint="Your hall, or Main Gate. Riders who join choose their own."
        name="campusLocationId"
        value={value.campusLocationId}
        onChange={(event) => onChange({ campusLocationId: event.target.value })}
        error={errors.campusLocationId}
      >
        <option value="">Choose a place</option>
        {campusPlaces.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
