import { EMERGENCY_CONTACTS, NO_DISPATCH_NOTE } from '@/lib/emergency';

/**
 * The emergency numbers, shown when a complaint is about safety (FR-RD-13.6, FR-RD-15.3). The
 * numbers are links, so a phone can call them in one tap.
 */
export function EmergencyContacts() {
  const { national, campusSecurity } = EMERGENCY_CONTACTS;
  return (
    <section
      aria-label="Emergency contacts"
      data-surface="brand"
      className="rounded-panel bg-brand p-5 text-on-brand sm:p-6"
    >
      <p className="font-bold">If you are in danger now, call for help first.</p>
      <ul className="mt-3 space-y-2">
        <li>
          {national.label}:{' '}
          <a
            href={`tel:${national.number}`}
            className="font-mono text-lg font-semibold text-on-brand"
          >
            {national.number}
          </a>
        </li>
        <li>
          {campusSecurity.label}:{' '}
          {campusSecurity.number ? (
            <a
              href={`tel:${campusSecurity.number.replace(/\s+/g, '')}`}
              className="font-mono text-lg font-semibold text-on-brand"
            >
              {campusSecurity.number}
            </a>
          ) : (
            <span className="text-on-brand-muted">number to be confirmed</span>
          )}
        </li>
      </ul>
      <p className="mt-3 text-sm text-on-brand-muted">{NO_DISPATCH_NOTE}</p>
    </section>
  );
}
