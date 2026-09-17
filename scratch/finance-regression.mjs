// Runs production service functions with an in-memory Supabase transport.
// No network, users, or database projects are created. This is NOT a live test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

let rows;
let failBudget = false;
const copy = value => structuredClone(value);
const db = {
  auth: { getUser: async () => ({ data: { user: { id: 'unit-test-only' } } }) },
  from(table) {
    let filters = [], action = 'select', payload, single = false;
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      order() { return query; },
      update(value) { action = 'update'; payload = value; return query; },
      insert(value) { action = 'insert'; payload = value; return query; },
      single() { single = true; return query; },
      then(ok, fail) {
        return Promise.resolve().then(() => {
          if (table === 'budget_items' && action === 'update' && failBudget) {
            return { data: null, error: { message: 'Simulated RLS denial' } };
          }
          let result = rows[table].filter(row => filters.every(filter => filter(row)));
          if (action === 'update') result.forEach(row => Object.assign(row, payload));
          if (action === 'insert') {
            result = (Array.isArray(payload) ? payload : [payload]).map((row, i) => ({ id: `insert-${rows[table].length + i}`, ...row }));
            rows[table].push(...result);
          }
          return { data: copy(single ? result[0] : result), error: null };
        }).then(ok, fail);
      },
    };
    return query;
  },
};
const cache = new Map();
function load(file) {
  file = resolve(file);
  if (file.endsWith('lib\\supabase.ts') || file.endsWith('lib/supabase.ts')) return { supabase: db };
  if (file.endsWith('services\\projectService.ts') || file.endsWith('services/projectService.ts')) {
    return { updateProject: () => { throw new Error('Estimate must not overwrite original budget'); } };
  }
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => load(resolve(dirname(file), `${name}.ts`)),
    console, Event, window: { dispatchEvent() {} }, localStorage: { setItem() {} },
  }, { filename: file });
  return module.exports;
}
const { recordMaterialActual } = load('src/services/materialService.ts');
const { saveEstimateToProject } = load('src/services/estimateService.ts');
const { getProjectFinancials } = load('src/services/projectFinancialService.ts');
const { estimateMaterialCost, estimateMaterialLines } = load('src/lib/materialRates.ts');
const input = { city: 'Hyderabad', state: 'Telangana', built_up_area: 1680, floors: 1 };
const estimate = estimateMaterialCost(input);
rows = {
  projects: [{ id: 'p', budget: 4360000 }],
  budget_items: [{ id: 'material', project_id: 'p', name: 'Material Cost', category: 'Preliminary Estimate', estimated: 24, spent: 0 }],
  construction_materials: estimateMaterialLines(estimate).map((line, i) => ({ id: `m${i}`, project_id: 'p', ...line, actual_cost: 0, supplier: null })),
};
const cement = rows.construction_materials.find(row => /cement/i.test(row.name));
const steel = rows.construction_materials.find(row => /steel/i.test(row.name));
assert.ok(cement && steel);
for (const [material, amount, expectedSpent, expectedRemaining] of [
  [cement, 80000, 0.8, 42.8], [cement, 90000, 0.9, 42.7], [steel, 100000, 1.9, 41.7],
]) {
  await recordMaterialActual('p', material.id, amount);
  assert.equal(material.actual_cost, amount);
  const summary = await getProjectFinancials('p');
  assert.equal(summary.spent, expectedSpent);
  assert.equal(summary.remaining.toFixed(2), expectedRemaining.toFixed(2));
  console.log(`PASS actual=${amount}, ledger=${summary.spent}L, remaining=${summary.remaining.toFixed(2)}L`);
}
await recordMaterialActual('p', cement.id, 90000);
assert.equal((await getProjectFinancials('p')).spent, 1.9);
console.log('PASS repeat save is idempotent; cement remains 90000, not 190000');
const oldEstimate = cement.estimated_cost;
await saveEstimateToProject('p', estimateMaterialCost({ ...input, city: 'Mumbai', state: 'Maharashtra' }));
assert.notEqual(cement.estimated_cost, oldEstimate);
assert.equal(cement.actual_cost, 90000);
assert.equal(steel.actual_cost, 100000);
assert.equal(rows.budget_items.find(row => row.id === 'material').spent, 1.9);
assert.equal(rows.projects[0].budget, 4360000);
console.log('PASS location re-estimate preserves actuals, material ledger, original budget');
failBudget = true;
await assert.rejects(recordMaterialActual('p', cement.id, 90000), /synchronization failed/);
failBudget = false;
await recordMaterialActual('p', cement.id, 90000);
assert.equal(rows.budget_items.find(row => row.id === 'material').spent, 1.9);
await assert.rejects(recordMaterialActual('p', cement.id, -1), /non-negative/);
console.log('PASS failed ledger write surfaces error; retry does not double-count');
const { calculateProjectFinancials } = load('src/lib/projectFinancials.ts');
assert.equal(calculateProjectFinancials(4360000, [{ estimated: 40, spent: 45 }]).remaining, 0);
assert.equal(calculateProjectFinancials(4360000, [{ estimated: 40, spent: 45 }]).overBudget.toFixed(2), '1.40');
console.log('PASS over-budget remaining is zero');
