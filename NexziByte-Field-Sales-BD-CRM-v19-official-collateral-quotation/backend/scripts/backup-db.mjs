import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from backend/.env');
const url = new URL(process.env.DATABASE_URL);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.argv[2] || `backups/nexzibyte-crm-${stamp}.backup`);
mkdirSync(dirname(output), { recursive: true });
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.password = '';
const result = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', output, databaseUrl.toString()], {
  stdio: 'inherit',
  env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
});
if (result.error?.code === 'ENOENT') throw new Error('pg_dump was not found. Add the PostgreSQL bin folder to Windows PATH.');
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Database backup created: ${output}`);
