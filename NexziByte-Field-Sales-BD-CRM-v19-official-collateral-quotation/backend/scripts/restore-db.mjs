import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from backend/.env');
const input = resolve(process.argv[2] || 'backups/nexzibyte-crm.backup');
if (!existsSync(input)) throw new Error(`Backup file not found: ${input}`);
const url = new URL(process.env.DATABASE_URL);
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.password = '';
console.log('WARNING: restoring replaces matching CRM tables and data in the configured database.');
const result = spawnSync('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', databaseUrl.toString(), input], {
  stdio: 'inherit',
  env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
});
if (result.error?.code === 'ENOENT') throw new Error('pg_restore was not found. Add the PostgreSQL bin folder to Windows PATH.');
if (result.status !== 0) process.exit(result.status || 1);
console.log('Database restore completed. Run: npx prisma generate');
