import Link from 'next/link';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { AdminHomeData } from '@/lib/home-data';
import { routes } from '@/lib/routes';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { LogoutButton } from '@/components/ui/LogoutButton';

/** Home page of an operations admin: the queues that need attention, then configuration. */
export function AdminHome({ data }: { data: AdminHomeData }) {
  const queues = [
    { label: 'SOS incidents', count: data.openIncidents, href: routes.adminIncidents },
    {
      label: 'Complaints awaiting review',
      count: data.complaintsToReview,
      href: routes.adminComplaints,
    },
    {
      label: 'AI recommendations awaiting your decision',
      count: data.recommendationsToDecide,
      href: routes.adminRecommendations,
    },
  ];

  return (
    <DesignSystem className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Operations</h1>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={routes.profile} variant="secondary">
            Profile
          </ButtonLink>
          <LogoutButton />
        </div>
      </div>

      <section aria-labelledby="attention-heading" className="mt-8">
        <h2 id="attention-heading" className="text-xl font-bold tracking-tight">
          Needs attention
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Queue
                </th>
                <th scope="col" className="py-2 font-medium">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {queues.map((queue) => (
                <tr key={queue.href} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    <Link href={queue.href}>{queue.label}</Link>
                  </th>
                  <td className="py-2">
                    {queue.count === null ? (
                      <span className="text-ink-muted">Not available yet</span>
                    ) : (
                      <span className="font-mono tabular-nums">{queue.count}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
    </DesignSystem>
  );
}
