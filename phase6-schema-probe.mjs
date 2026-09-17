// READ-ONLY Phase 6-9 schema probe. Uses ONLY the public anon key and
// select(...).limit(0) — no inserts, updates, deletes, no DDL.
// A missing column returns PGRST204; a missing table returns PGRST205.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const supabase = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY'));

async function probe(label, table, columns) {
  const { error } = await supabase.from(table).select(columns).limit(0);
  if (!error) {
    console.log(`OK       ${label}: table + columns exist (${columns})`);
    return true;
  }
  console.log(`MISSING  ${label}: [${error.code}] ${error.message}`);
  return false;
}

async function probeBucket(name) {
  const { error } = await supabase.storage.from(name).list('', { limit: 1 });
  if (!error) {
    console.log(`OK       bucket "${name}" exists and is readable`);
    return true;
  }
  console.log(`MISSING  bucket "${name}": ${error.message}`);
  return false;
}

console.log('== READ-ONLY schema probe (anon key, no writes) ==\n');
console.log('-- public.projects --');
await probe('projects base', 'projects',
  'id,customer_id,contractor_id,name,building_type,city,state,built_up_area,budget,budget_min,budget_max,requirements,timeline,status,updated_at');
await probe('projects Phase-6 cols', 'projects', 'progress,start_date');

console.log('\n-- public.project_updates --');
await probe('project_updates table', 'project_updates',
  'id,project_id,author_id,update_type,title,content,image_url,created_at,updated_at');

console.log('\n-- public.project_milestones --');
await probe('milestones base', 'project_milestones', 'id,project_id,title,status,due_date,completed_at,created_at');
await probe('milestones Phase-7 cols', 'project_milestones',
  'progress,start_date,expected_end_date,completed_date,updated_at');

console.log('\n-- public.construction_photos --');
await probe('construction_photos table', 'construction_photos',
  'id,project_id,contractor_id,image_url,caption,milestone_id,created_at');

console.log('\n-- public.messages --');
await probe('messages base', 'messages', 'id,project_id,sender_id,created_at');
await probe('messages Phase-9 cols', 'messages', 'receiver_id,read_at');

console.log('\n-- public.projects (individual) --');
for (const col of ['progress', 'start_date']) {
  await probe(`projects.${col}`, 'projects', col);
}

console.log('\n-- public.project_milestones (individual) --');
for (const col of ['progress', 'start_date', 'expected_end_date', 'completed_date', 'updated_at']) {
  await probe(`project_milestones.${col}`, 'project_milestones', col);
}

console.log('\n-- public.messages (individual) --');
for (const col of ['receiver_id', 'read_at']) {
  await probe(`messages.${col}`, 'messages', col);
}

console.log('\n-- storage buckets --');
await probeBucket('site-photos');
await probeBucket('construction-updates');

console.log('\nDone. (No data was written, changed or deleted.)');
