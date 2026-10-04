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

function departureParts(iso: string): Record<string, string> {
  return Object.fromEntries(
    departureFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
}

/** Formats an ISO date-time as, for example, "Sat 3 Oct, 05:00" (IST). */
export function formatDeparture(iso: string): string {
  const parts = departureParts(iso);
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
}

/**
 * Formats a departure window as, for example, "Sat 10 Oct, 06:30 to 07:30"
 * (IST). The end repeats the day only when the window crosses midnight.
 */
export function formatDepartureWindow(startIso: string, endIso: string): string {
  const start = departureParts(startIso);
  const end = departureParts(endIso);
  const sameDay = start.day === end.day && start.month === end.month;
  const endText = sameDay
    ? `${end.hour}:${end.minute}`
    : `${end.weekday} ${end.day} ${end.month}, ${end.hour}:${end.minute}`;
  return `${formatDeparture(startIso)} to ${endText}`;
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
