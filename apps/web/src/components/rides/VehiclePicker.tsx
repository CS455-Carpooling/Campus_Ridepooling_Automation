'use client';

import { ChoiceCards } from '@/components/ui/ChoiceCards';
import type { VehicleType } from '@/lib/ride-options';

export type VehiclePickerProps = {
  vehicleTypes: VehicleType[];
  /** The chosen vehicle type id, or ''. */
  value: string;
  onChange: (vehicleTypeId: string) => void;
  error?: string;
};

/** The vehicle type, which fixes how many people the ride can take, the owner included. */
export function VehiclePicker({ vehicleTypes, value, onChange, error }: VehiclePickerProps) {
  return (
    <ChoiceCards
      legend="Vehicle"
      hint="The vehicle decides how many people can share the ride."
      name="vehicleTypeId"
      columns={1}
      choices={vehicleTypes.map((vehicle) => ({
        value: vehicle.id,
        label: vehicle.name,
        description: `${vehicle.capacity} people, you included`,
      }))}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
