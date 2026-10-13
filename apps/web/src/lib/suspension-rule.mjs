/**
 * The one definition of a suspension in force, and how a refusal names it (FR-RD-01.5,
 * SYS-FR-25). Plain JavaScript, because the socket server (server.mjs) loads it as well as the
 * app: suspensions.ts, enforcement-rules.ts and the pool chat all use it.
 */

/**
 * The suspension in force for user $1 at time $2, the longest when several overlap. A
 * temporary suspension stops at its end time with no job running (SYS-FR-25), as in the
 * active_rider_suspensions view.
 */
export const ACTIVE_SUSPENSION_SQL = `
  SELECT id, reason_category, starts_at, ends_at, is_indefinite
  FROM rider_suspensions
  WHERE user_id = $1 AND lifted_at IS NULL AND starts_at <= $2
    AND (ends_at IS NULL OR ends_at > $2)
  ORDER BY is_indefinite DESC, ends_at DESC NULLS FIRST
  LIMIT 1`;

/** The reason categories as riders see them; complaint-rules.ts has the same labels. */
export const SUSPENSION_CATEGORY_LABELS = {
  safety: 'Safety',
  harassment: 'Harassment',
  tardiness: 'Tardiness',
  payment: 'Payment',
  no_show: 'No-show',
  other: 'Other',
};

// The same parts as formatDeparture() in format.ts, for example "Tue 13 Oct, 18:30" (IST).
const istFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function istTime(iso) {
  const parts = Object.fromEntries(
    istFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
}

/**
 * What a suspended rider is told when `refused` (for example "offer a ride") is refused: until
 * when and why, never the admin's reason text (FR-RD-01.5).
 */
export function suspensionRefusal(suspension, refused) {
  const until = suspension.endsAt
    ? `until ${istTime(suspension.endsAt)} (IST)`
    : 'until an operations admin lifts it';
  const category = SUSPENSION_CATEGORY_LABELS[suspension.reasonCategory] ?? 'Other';
  return `Your account is suspended ${until} (reason: ${category}), so you cannot ${refused}. You can still file a complaint.`;
}

/** The suspension in force for `userId` at `now`, as { endsAt, reasonCategory }, or null. */
export async function activeSuspension(db, userId, now) {
  const { rows } = await db.query(ACTIVE_SUSPENSION_SQL, [userId, now]);
  const row = rows[0];
  if (!row) return null;
  return {
    reasonCategory: row.reason_category,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
  };
}
