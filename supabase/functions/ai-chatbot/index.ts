// ============================================================
// BuildSmart AI — Phase 12: AI Chatbot Edge Function
// ============================================================
// Server-side AI chatbot for project-related questions.
// Uses Gemini API key from Supabase secrets — never exposed to browser.
// ============================================================
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_BASE_URL =
  Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MODEL_VERSIONS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  message: string;
  history?: ChatMessage[];
  project?: {
    name?: string;
    status?: string;
    building_type?: string;
    city?: string;
    state?: string;
    budget?: number | null;
    budget_min?: number | null;
    budget_max?: number | null;
    construction_stage?: string | null;
    progress?: number | null;
    timeline?: string | null;
    description?: string | null;
  } | null;
  user_role?: 'customer' | 'contractor' | 'admin';
}

function buildSystemPrompt(project: RequestBody['project'], role?: string): string {
  const roleContext = role === 'contractor'
    ? 'You are assisting a construction contractor. They may ask about project requirements, milestones, customer requirements, and construction planning.'
    : role === 'admin'
      ? 'You are assisting a platform administrator. They may ask about project oversight and status.'
      : 'You are assisting a homeowner/customer. They may ask about project status, budget, materials, construction stages, and general construction guidance.';

  let projectContext = '';
  if (project) {
    const parts: string[] = [];
    if (project.name) parts.push(`Project name: ${project.name}`);
    if (project.status) parts.push(`Status: ${project.status}`);
    if (project.building_type) parts.push(`Building type: ${project.building_type}`);
    if (project.city || project.state) parts.push(`Location: ${[project.city, project.state].filter(Boolean).join(', ')}`);
    if (project.budget || project.budget_min || project.budget_max) {
      const budget = project.budget ?? project.budget_max ?? project.budget_min;
      parts.push(`Budget: ₹${budget ? Number(budget).toLocaleString('en-IN') : 'Not specified'}`);
    }
    if (project.construction_stage) parts.push(`Current stage: ${project.construction_stage}`);
    if (project.progress != null) parts.push(`Progress: ${project.progress}%`);
    if (project.timeline) parts.push(`Expected completion: ${project.timeline}`);
    if (project.description) parts.push(`Description: ${project.description}`);
    if (parts.length > 0) {
      projectContext = `\n\nCurrent project context:\n${parts.join('\n')}`;
    }
  }

  return `You are BuildSmart AI, an assistant for a construction project management platform. ${roleContext}${projectContext}

IMPORTANT RULES:
- Be concise and practical. Use bullet points where helpful.
- Do NOT provide professional engineering, legal, or financial advice.
- Do NOT guarantee any specific outcome, cost, or timeline.
- Do NOT claim to modify any project records, financial data, or verification status.

function buildContents(body: RequestBody) {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (body.history && body.history.length > 0) {
    for (const msg of body.history.slice(-10)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: body.message }] });
  return contents;
}

async function callGemini(systemPrompt: string, contents: Array<{ role: string; parts: Array<{ text: string }> }>): Promise<string> {
  for (const model of MODEL_VERSIONS) {
    try {
      const res = await fetch(
        `${GEMINI_BASE_URL}/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024, topP: 0.9 },
          }),
          signal: AbortSignal.timeout(30_000),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || '').join('') || '';
      if (text) return text;
    } catch {
      continue;
    }
  }
  throw new Error('AI service is currently unavailable for all models.');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.message || !String(body.message).trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'No message was provided.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'The AI assistant is not currently configured. Please try again later.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const systemPrompt = buildSystemPrompt(body.project ?? null, body.user_role);
    const contents = buildContents(body);
    const reply = await callGemini(systemPrompt, contents);
    return new Response(
      JSON.stringify({ success: true, reply }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unexpected error in AI chatbot.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});