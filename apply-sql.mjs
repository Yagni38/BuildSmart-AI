// TEMP TOOL (deleted after use) — runs SQL against the linked Supabase project
// via the Management API using the SAME access token the CLI uses (from the
// environment; the token is NEVER printed). Usage: node apply-sql.mjs file.sql
import { readFileSync } from 'node:fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.log('RESULT: no SUPABASE_ACCESS_TOKEN in environment');
  process.exit(0);
}
console.log(`token present (len=${token.length}), never printed`);

const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const sql = readFileSync(process.argv[2], 'utf8');

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

console.log('HTTP', r.status);
console.log(await r.text());
