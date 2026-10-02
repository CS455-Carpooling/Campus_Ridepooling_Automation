// Departures are shown in Indian Standard Time, whatever the device's time zone.
const departureFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Formats an ISO date-time as, for example, "Sat 3 Oct, 05:00" (IST). */
export function formatDeparture(iso: string): string {
  const parts = Object.fromEntries(
    departureFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
}

const rupeeFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats whole rupees with Indian digit grouping, for example 117 or 1,00,000 after the rupee sign. */
export function formatRupees(amount: number): string {
  return rupeeFormat.format(amount);
}
