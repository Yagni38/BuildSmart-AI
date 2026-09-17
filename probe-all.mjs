import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function runSqlFile(name) {
  const file = name.endsWith('.sql') ? name : `${name}.sql`;
  try {
    const out = execSync(`npx supabase db query --linked --output json -f ${file} 2>/dev/null`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return out.trim();
  } catch (e) {
    return `ERROR: ${e.stdout || e.message || e}`;
  }
}

const files = ['diag-policies', 'diag-check-constraint', 'diag-is-admin', 'diag-table-list'];
for (const f of files) {
  console.log(`\n=== ${f}.sql ===\n`);
  const out = runSqlFile(`diag-${f}.sql`);
  // Pretty-print JSON
  try {
    const arr = JSON.parse(out);
    for (const row of arr) {
      console.log(JSON.stringify(row, null, 1));
    }
  } catch {
    console.log(out.slice(0, 4000));
  }
}
