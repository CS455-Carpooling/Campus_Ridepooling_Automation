import Link from 'next/link';
import { AdminOutcomeLabel } from '@/components/admin/AdminOutcomeLabel';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { adminActionLabel, adminActorLabel } from '@/lib/admin-activity';
import { formatDeparture } from '@/lib/format';
import type { AdminActivity, AdminHomeData } from '@/lib/home-data';
import { routes } from '@/lib/routes';

type Queue = { label: string; count: number | null; href: string | null; note?: string };

/** Home page of an operations admin: what needs attention, the latest admin actions, then configuration. */
export function AdminHome({ data }: { data: AdminHomeData }) {
  const safety = data.safetyComplaintsToReview;
  const queues: Queue[] = [
    {
      label: 'Complaints awaiting review',
      count: data.complaintsToReview,
      href: routes.adminComplaints,
      note: safety > 0 ? `${safety} about safety` : undefined,
    },
    {
      label: 'AI recommendations awaiting your decision',
      count: data.recommendationsToDecide,
      href: routes.adminComplaints,
    },
    { label: 'Riders suspended now', count: data.ridersSuspended, href: routes.adminRiders },
    { label: 'SOS incidents', count: data.openIncidents, href: null },
  ];

  return (
    <AdminPageShell
      title="Operations"
      description="What needs your attention, and what admins changed most recently."
    >
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-xl font-bold tracking-tight">
          Needs attention
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Item
                </th>
                <th scope="col" className="py-2 font-medium">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {queues.map((queue) => (
                <tr key={queue.label} className="border-b border-line">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    {queue.href ? <Link href={queue.href}>{queue.label}</Link> : queue.label}
                  </th>
                  <td className="py-3">
                    {queue.count === null ? (
                      <span className="text-ink-muted">Not available yet</span>
                    ) : (
                      <span className="font-mono tabular-nums">{queue.count}</span>
                    )}
                    {queue.note && (
                      <p className="mt-0.5 text-sm font-semibold text-danger">{queue.note}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RecentActions actions={data.recentActions} />

      <section aria-labelledby="configuration-heading" className="mt-10">
        <h2 id="configuration-heading" className="text-xl font-bold tracking-tight">
          Configuration
        </h2>
        <ul className="mt-3 space-y-2">
          <li>
            <Link href={routes.adminVehicleTypes}>Vehicle types and seat capacity</Link>
          </li>
          <li>
            <Link href={routes.adminHubs}>Destination hubs and pickup points</Link>
          </li>
          <li>
            <Link href={routes.adminFares}>Fares</Link>
          </li>
        </ul>
      </section>
    </AdminPageShell>
  );
}

/** The latest audit entries, refused and failed attempts included (SYS-FR-45, SYS-NFR-12). */
function RecentActions({ actions }: { actions: AdminActivity[] }) {
  return (
    <section aria-labelledby="activity-heading" className="mt-10">
      <h2 id="activity-heading" className="text-xl font-bold tracking-tight">
        Recent admin actions
      </h2>
      {actions.length === 0 ? (
        <p className="mt-2 text-ink-muted">
          No admin actions yet. Every change an admin makes is listed here, including refused and
          failed attempts.
        </p>
      ) : (
        <ol
          aria-label="Recent admin actions"
          className="mt-3 divide-y divide-line border-y border-line"
        >
          {actions.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {adminActionLabel(entry.action)}
                  {entry.subject && <span className="font-normal">: {entry.subject}</span>}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {adminActorLabel(entry.actor, entry.adminName)},{' '}
                  <time dateTime={entry.at} className="font-mono tabular-nums">
                    {formatDeparture(entry.at)}
                  </time>
                </p>
              </div>
              <AdminOutcomeLabel outcome={entry.outcome} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
