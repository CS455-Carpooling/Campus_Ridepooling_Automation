'use client';

import {
  ADMIN_CONFIG_RULES,
  parseVehicleTypeCreate,
  parseVehicleTypeUpdate,
} from '@/lib/admin-config-rules';
import type { VehicleTypeRecord } from '@/lib/admin-types';
import { ConfigListEditor, type Checked, type Values } from './ConfigListEditor';

/** The capacity as typed: a whole number, or NaN so the rules refuse it with their message. */
const capacityOf = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);

function checkNew(values: Values): Checked {
  const parsed = parseVehicleTypeCreate({
    name: values.name,
    capacity: capacityOf(values.capacity),
  });
  return parsed.ok ? { ok: true, body: parsed.value } : { ok: false, errors: parsed.errors };
}

function checkEdit(values: Values): Checked {
  // The version is added when sending; any version passes this check.
  const parsed = parseVehicleTypeUpdate({
    name: values.name,
    capacity: capacityOf(values.capacity),
    version: 1,
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return { ok: true, body: { name: parsed.value.name, capacity: parsed.value.capacity } };
}

const people = (count: number) => (count === 1 ? '1 person' : `${count} people`);

/** Vehicle types and their capacity (OA-FR-01 to 03, CS455-51). */
export function VehicleTypesEditor({ initial }: { initial: VehicleTypeRecord[] }) {
  return (
    <ConfigListEditor
      title="All vehicle types"
      noun="vehicle type"
      initial={initial}
      fields={[
        { key: 'name', label: 'Name' },
        {
          key: 'capacity',
          label: 'Capacity',
          hint: `People it carries, the owner included (${ADMIN_CONFIG_RULES.capacityMin} to ${ADMIN_CONFIG_RULES.capacityMax}). Applies to new rides only.`,
          inputMode: 'numeric',
        },
      ]}
      valuesOf={(item) => ({ name: item.name, capacity: String(item.capacity) })}
      describe={(item) => `carries ${people(item.capacity)}, the owner included`}
      checkNew={checkNew}
      checkEdit={checkEdit}
      endpoint="/api/admin/vehicle-types"
      responseKey="vehicleType"
      deactivateEffect="It will no longer be offered when someone offers or searches for a ride. Rides that already use it keep it."
    />
  );
}
