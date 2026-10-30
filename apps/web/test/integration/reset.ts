import type { Queryable } from '../seed/accounts';

/**
 * The rows db/schema.sql itself inserts (campus places, hubs, vehicle types, interest tags and
 * so on), one entry per table, parents before children.
 */
export type ReferenceRows = Array<{ table: string; columns: string[]; rows: unknown[] }>;

/** Every table in the public schema, by name. */
async function publicTables(db: Queryable): Promise<string[]> {
  const { rows } = await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  return rows.map((row) => row.tablename as string);
}

/**
 * Read once, right after the schema is applied to an empty database: whatever is in a table
 * then came from the schema, and every test starts with exactly that.
 */
export async function captureReferenceRows(db: Queryable): Promise<ReferenceRows> {
  const captured = new Map<string, { columns: string[]; rows: unknown[] }>();
  for (const table of await publicTables(db)) {
    const { rows } = await db.query(`SELECT * FROM ${quote(table)}`);
    if (rows.length === 0) continue;
    // Generated columns are computed again on insert.
    const columns = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
       ORDER BY ordinal_position`,
      [table],
    );
    captured.set(table, { columns: columns.rows.map((row) => row.column_name as string), rows });
  }

  // Parents first, so foreign keys between these tables hold as rows go back in.
  const { rows: links } = await db.query(
    `SELECT child.relname AS child, parent.relname AS parent
     FROM pg_constraint fk
     JOIN pg_class child ON child.oid = fk.conrelid
     JOIN pg_class parent ON parent.oid = fk.confrelid
     JOIN pg_namespace ns ON ns.oid = child.relnamespace
     WHERE fk.contype = 'f' AND ns.nspname = 'public' AND child.relname <> parent.relname`,
  );
  const ordered: ReferenceRows = [];
  const pending = new Set(captured.keys());
  while (pending.size > 0) {
    const ready = [...pending].filter((table) =>
      links.every((link) => link.child !== table || !pending.has(link.parent as string)),
    );
    if (ready.length === 0) throw new Error(`Reference tables form a cycle: ${[...pending]}`);
    for (const table of ready.sort()) {
      ordered.push({ table, ...captured.get(table)! });
      pending.delete(table);
    }
  }
  return ordered;
}

/**
 * Empties every table and puts the schema's own rows back, so each test starts from a freshly
 * migrated database. TRUNCATE does not fire the row triggers that keep audit and incident rows
 * append-only, so those tables empty too.
 */
export async function resetDatabase(db: Queryable, reference: ReferenceRows): Promise<void> {
  const tables = await publicTables(db);
  await db.query(`TRUNCATE ${tables.map(quote).join(', ')} RESTART IDENTITY CASCADE`);
  for (const { table, columns, rows } of reference) {
    const list = columns.map(quote).join(', ');
    await db.query(
      `INSERT INTO ${quote(table)} (${list}) OVERRIDING SYSTEM VALUE
       SELECT ${list} FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`,
      [JSON.stringify(rows)],
    );
  }
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
