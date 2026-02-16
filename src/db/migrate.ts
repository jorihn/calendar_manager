import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import pool from './pool';

type Direction = 'up' | 'down';

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

function listMigrationIds(): string[] {
  const files = readdirSync(MIGRATIONS_DIR);
  const ids = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(\d+_.+)\.(up|down)\.sql$/);
    if (m) ids.add(m[1]);
  }
  return Array.from(ids).sort();
}

function readMigrationSql(id: string, dir: Direction): string {
  return readFileSync(join(MIGRATIONS_DIR, `${id}.${dir}.sql`), 'utf-8');
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedIds(): Promise<string[]> {
  const res = await pool.query(`SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY applied_at ASC, id ASC`);
  return res.rows.map(r => r.id as string);
}

async function applyUp() {
  await ensureMigrationsTable();

  const all = listMigrationIds();
  const applied = new Set(await getAppliedIds());
  const pending = all.filter(id => !applied.has(id));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const id of pending) {
    console.log(`Applying migration: ${id} (up)`);
    const sql = readMigrationSql(id, 'up');

    // Run in a transaction to keep each migration atomic
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (id) VALUES ($1)`, [id]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }

  console.log('Migrations applied successfully.');
}

async function applyDown(steps: number) {
  await ensureMigrationsTable();

  const applied = await getAppliedIds();
  if (applied.length === 0) {
    console.log('No applied migrations to roll back.');
    return;
  }

  const toRollback = applied.slice(-steps).reverse();

  for (const id of toRollback) {
    console.log(`Rolling back migration: ${id} (down)`);
    const sql = readMigrationSql(id, 'down');

    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE id = $1`, [id]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }

  console.log('Rollback completed successfully.');
}

async function showStatus() {
  await ensureMigrationsTable();
  const all = listMigrationIds();
  const applied = new Set(await getAppliedIds());

  console.log('Migration status:');
  for (const id of all) {
    console.log(`${applied.has(id) ? '[x]' : '[ ]'} ${id}`);
  }
}

async function main() {
  const cmd = process.argv[2] || 'up';

  try {
    if (cmd === 'up') {
      await applyUp();
    } else if (cmd === 'down') {
      const stepsArg = process.argv[3];
      const steps = stepsArg ? parseInt(stepsArg, 10) : 1;
      if (!Number.isFinite(steps) || steps <= 0) throw new Error('steps must be a positive integer');
      await applyDown(steps);
    } else if (cmd === 'status') {
      await showStatus();
    } else {
      console.error('Usage: node dist/db/migrate.js [up|down|status] [steps]');
      process.exit(2);
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration command failed:', error);
    process.exit(1);
  }
}

main();
