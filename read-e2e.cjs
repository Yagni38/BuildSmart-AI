const fs = require('fs');
const lines = fs.readFileSync('e2e-contractor-assignment.mjs', 'utf8').split('\n');
let out = '';
for (let i = 275; i < lines.length; i++) {
  out += (i+1) + ': ' + lines[i] + '\n';
}
fs.writeFileSync('e2e-verify-clean.txt', out);
console.log('Lines:', lines.length, 'Written to e2e-verify-clean.txt');
