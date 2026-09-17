// PHASE 6 end-to-end test — REAL AI house visualization.
// Creates a fresh CUSTOMER + project, invokes the deployed
// generate-ai-design Edge Function, and verifies:
//   - a real image URL + storage path is returned
//   - the downloaded bytes are an actual image
//   - the ai_designs row is persisted with image_path/prompt
// Cleans up the test project afterwards.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};

const url = get('VITE_SUPABASE_URL');
// Support BOTH env var names: .env.local currently defines
// VITE_SUPABASE_ANON_KEY (phase2-test.mjs does the same).
const anon = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const supabase = createClient(url, anon);

const email = `bs-p6-${Date.now()}@example.com`;
const password = 'P6Pass123!';

console.log('== Phase 6 end-to-end test ==');

// 1) Sign up a fresh CUSTOMER (profile row is created by the trigger).
const { data: su, error: suErr } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: 'Phase 6 Test', role: 'CUSTOMER' } },
});
if (suErr) {
  console.error('SIGNUP ERROR:', suErr.message);
  process.exit(1);
}
if (!su.session) {
  console.error('NO SESSION — email confirmation may be enabled for signups.');
  process.exit(1);
}
const uid = su.user.id;
console.log('user:', email, uid);
await new Promise((r) => setTimeout(r, 1500)); // let the profile trigger run

// 2) Create a real project (status omitted → uses the live DB default).
const { data: project, error: pErr } = await supabase
  .from('projects')
  .insert({
    customer_id: uid,
    name: 'Phase 6 Test Villa',
    project_type: 'NEW_CONSTRUCTION',
    building_type: 'Villa',
    city: 'Bengaluru',
    state: 'Karnataka',
    plot_size: 2400,
    built_up_area: 3200,
    floors: 2,
    bedrooms: 4,
    bathrooms: 3,
    budget: 8000000,
    budget_min: 7000000,
    budget_max: 9000000,
    construction_stage: 'PLANNING',
    description: 'Modern family villa with an open courtyard, large windows and a flat roof terrace',
    requirements: 'Eco friendly, solar panels, natural cross ventilation',
    soil_type: 'Red Sandy Loam',
    priority: 'Eco-Friendliness',
    design_style: 'Modern',
  })
  .select('id')
  .single();
if (pErr) {
  console.error('PROJECT CREATE ERROR:', pErr.message);
  process.exit(1);
}
console.log('project:', project.id);

// 3) Invoke the deployed Edge Function with the REAL project ROW.
// The app sends the full project object — see aiDesignService.generateAIDesign
// (body: { project }) — NOT a bare projectId. Raw fetch (instead of
// supabase.functions.invoke) so the exact HTTP status and error body are
// visible for debugging.
const { data: projectRow, error: rowFetchErr } = await supabase
  .from('projects')
  .select('*')
  .eq('id', project.id)
  .single();
if (rowFetchErr || !projectRow) {
  console.error('PROJECT FETCH ERROR:', rowFetchErr?.message ?? 'row not found');
  process.exit(1);
}

const fnUrl = `${url}/functions/v1/generate-ai-design`;
console.log('Invoking generate-ai-design (image generation can take 20–60s)...');
const t0 = Date.now();
const fnRes = await fetch(fnUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: anon,
    Authorization: `Bearer ${su.session.access_token}`,
  },
  body: JSON.stringify({ project: projectRow }),
});
const rawText = await fnRes.text();
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`invoke returned in ${elapsed}s | HTTP ${fnRes.status}`);

if (fnRes.status !== 200 || !rawText) {
  console.error('EDGE FUNCTION HTTP ERROR:', fnRes.status, rawText.slice(0, 2000));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(rawText);
} catch (e) {
  console.error('EDGE FUNCTION returned non-JSON:', rawText.slice(0, 2000));
  process.exit(1);
}
console.log('response.success:', data?.success);
if (!data?.success) {
  console.error('EDGE FUNCTION FAILED:', data?.error);
  process.exit(1);
}

console.log('design title:', data.design?.design_title);
console.log('imagePath:', data.imagePath);
console.log('imageUrl (first 120):', data.imageUrl ? data.imageUrl.slice(0, 120) + '...' : 'MISSING');
console.log('imagePrompt (first 160):', data.imagePrompt ? data.imagePrompt.slice(0, 160) + '...' : 'MISSING');

if (!data.imageUrl || !data.imagePath) {
  console.error('TEST FAILED: no real image URL/path returned.');
  process.exit(1);
}

// 4) Download the generated image and verify it is a real image file.
const imgRes = await fetch(data.imageUrl);
const imgBuf = Buffer.from(await imgRes.arrayBuffer());
console.log('image HTTP', imgRes.status, '| content-type', imgRes.headers.get('content-type'), '| bytes', imgBuf.length);
const magic = imgBuf.subarray(0, 8).toString('hex');
const isPng = magic.startsWith('89504e47');
const isJpeg = magic.startsWith('ffd8');
const isWebp = magic.startsWith('52494646');
if (imgRes.status !== 200 || !(imgBuf.length > 1000 && (isPng || isJpeg || isWebp))) {
  console.error('TEST FAILED: downloaded bytes do not look like a real image.');
  process.exit(1);
}
console.log('image verified:', isPng ? 'PNG' : isJpeg ? 'JPEG' : isWebp ? 'WEBP' : 'unknown', `(${imgBuf.length} bytes)`);

// 5) Verify the ai_designs row persisted with image metadata.
const { data: row, error: rowErr } = await supabase
  .from('ai_designs')
  .select('id, project_id, customer_id, image_path, prompt, image_url, created_at')
  .eq('project_id', project.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
if (rowErr) {
  console.error('DB ROW CHECK ERROR:', rowErr.message);
} else {
  console.log('ai_designs row:', JSON.stringify({
    id: row.id,
    project_id: row.project_id,
    customer_id: row.customer_id,
    image_path: row.image_path,
    has_prompt: !!row.prompt,
    has_image_url: !!row.image_url,
    created_at: row.created_at,
  }));
  if (row.image_path !== data.imagePath) {
    console.error('TEST FAILED: image_path mismatch between response and DB.');
    process.exit(1);
  }
}

// 6) Cleanup — remove the test project (cascades ai_designs + ai_materials).
const { error: delErr } = await supabase.from('projects').delete().eq('id', project.id);
if (delErr) console.warn('cleanup project warning:', delErr.message);

console.log('\nPHASE 6 TEST PASSED ✓');
