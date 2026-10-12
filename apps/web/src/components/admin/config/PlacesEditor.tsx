'use client';

import {
  ADMIN_CONFIG_RULES,
  parseLocationCreate,
  parseLocationUpdate,
  type LocationType,
} from '@/lib/admin-config-rules';
import type { LocationRecord } from '@/lib/admin-types';
import { ConfigListEditor, type Checked, type Values } from './ConfigListEditor';

const copy: Record<
  LocationType,
  { title: string; noun: string; detailHint: string; effect: string }
> = {
  transport_hub: {
    title: 'Transport hubs',
    noun: 'transport hub',
    detailHint: 'Optional, for example "Railway station".',
    effect:
      'Riders will no longer be able to offer or find rides to or from it. Rides that already go there keep it.',
  },
  campus: {
    title: 'Campus pickup points',
    noun: 'campus pickup point',
    detailHint: 'Optional, for example "Near the main gate".',
    effect:
      'It will no longer be offered as a pickup or drop-off point. Rides that already use it keep it.',
  },
};

/** Campus places and transport hubs (OA-FR-05 to 07, CS455-51); a place's type never changes. */
export function PlacesEditor({ type, initial }: { type: LocationType; initial: LocationRecord[] }) {
  const text = copy[type];

  function checkNew(values: Values): Checked {
    const parsed = parseLocationCreate({ type, name: values.name, detail: values.detail });
    return parsed.ok ? { ok: true, body: parsed.value } : { ok: false, errors: parsed.errors };
  }

  function checkEdit(values: Values): Checked {
    const parsed = parseLocationUpdate({ name: values.name, detail: values.detail, version: 1 });
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    return { ok: true, body: { name: parsed.value.name, detail: parsed.value.detail ?? null } };
  }

  return (
    <ConfigListEditor
      title={text.title}
      noun={text.noun}
      initial={initial}
      fields={[
        { key: 'name', label: 'Name' },
        {
          key: 'detail',
          label: 'Detail line',
          hint: `${text.detailHint} Up to ${ADMIN_CONFIG_RULES.detailMax} characters.`,
        },
      ]}
      valuesOf={(item) => ({ name: item.name, detail: item.detail ?? '' })}
      describe={(item) => item.detail ?? 'no detail line'}
      checkNew={checkNew}
      checkEdit={checkEdit}
      endpoint="/api/admin/locations"
      responseKey="location"
      deactivateEffect={text.effect}
    />
  );
}
