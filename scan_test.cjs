const fs = require('fs');
const path = require('path');

function scanDir(dir, depth) {
  if (depth > 3 || !fs.existsSync(dir)) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...scanDir(fp, depth + 1));
      } else {
        const ext = path.extname(e.name);
        if (['.sql', '.mjs', '.ts', '.js', '.cjs'].includes(ext)) {
          try {
            const c = fs.readFileSync(fp, 'utf8');
            if (/bs-diag/i.test(c)) results.push(fp + ' :: bs-diag');
            else if (/bs-seed/i.test(c)) results.push(fp + ' :: bs-seed');
            else if (/test-contractor/i.test(c)) results.push(fp + ' :: test-contractor');
            else if (/example\.com/i.test(c)) results.push(fp + ' :: example.com');
            else if (/(INSERT|insert)\s+(INTO|into)\s+.*contractor_profiles/i.test(c)) results.push(fp + ' :: INSERT contractor_profiles');
            else if (/seed/i.test(c)) results.push(fp + ' :: seed');
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  return results;
}

const base = process.cwd();
const found = scanDir(base, 0);
console.log('=== FILES WITH TEST/SEED PATTERNS ===\n');
for (const f of found) console.log(f);
console.log('\nTotal: ' + found.length + ' files');
