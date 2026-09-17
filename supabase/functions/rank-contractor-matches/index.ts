// ============================================================
// BuildSmart AI — Phase 5: rank-contractor-matches Edge Function
// ============================================================
// AI-assisted RE-RANKING and EXPLANATION of already-verified
// contractor candidates. The frontend passes ONLY verified
// contractors (eligibility filtering happened against the DB
// before this call) and this function may ONLY re-order them
// and rewrite the matching explanations — it can never add a
// contractor, so verified eligibility is always enforced.
//
// Uses GEMINI_API_KEY from Supabase secrets — never exposed
// to the frontend. Any failure returns success:false and the
// caller silently falls back to the deterministic ranking.
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

interface ContractorCandidate {
  id: string;
  company?: string;
  owner?: string;
  location?: string;
  skills?: string;
  projectTypes?: string;
  yearsOfExperience?: number | string;
  description?: string;
  deterministicScore?: number;
}

interface ProjectBrief {
  buildingType?: string;
  city?: string;
  state?: string;
  location?: string;
  builtUpAreaSqft?: number | string | null;
  floors?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  budget?: number | string | null;
  timeline?: string;
  materials?: string;
  designStyle?: string;
  requirements?: string;
}

const MODEL_VERSIONS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

function buildPrompt(project: ProjectBrief, contractors: ContractorCandidate[]): string {
  const brief = [
    project.buildingType && `Construction type: ${project.buildingType}`,
    (project.city || project.state || project.location) &&
      `Location: ${[project.city, project.state].filter(Boolean).join(', ')}${project.location ? ` (${project.location})` : ''}`,
    project.builtUpAreaSqft && `Built-up area: ${project.builtUpAreaSqft} sq ft`,
    project.floors && `Floors: ${project.floors}`,
    project.bedrooms && `Bedrooms: ${project.bedrooms}`,
    project.bathrooms && `Bathrooms: ${project.bathrooms}`,
    project.budget && `Budget: ${project.budget}`,
    project.timeline && `Desired timeline: ${project.timeline}`,
    project.materials && `Preferred materials: ${project.materials}`,
    project.designStyle && `Design style: ${project.designStyle}`,
    project.requirements && `Requirements: ${project.requirements}`,
  ]
    .filter(Boolean)
    .join('\n');

  const candidates = contractors
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id}\n   Company: ${c.company || 'N/A'} (Owner: ${c.owner || 'N/A'})\n   Location: ${c.location || 'N/A'}\n   Experience: ${c.yearsOfExperience ?? 'N/A'} years\n   Skills: ${c.skills || 'N/A'}\n   Project types: ${c.projectTypes || 'N/A'}\n   Profile: ${c.description || 'N/A'}\n   Deterministic score: ${c.deterministicScore ?? 'N/A'}`
    )
    .join('\n\n');

  return `You are a construction contractor matching assistant. Rank the candidate contractors below against the customer project brief.

PROJECT BRIEF:
${brief}

CANDIDATE CONTRACTORS (all are admin-verified):
${candidates}

Return ONLY a JSON object (no markdown fences) of the form:
{"ranking":[{"id":"<candidate id>","reason":"1-2 sentence explanation of why this contractor fits THIS project (mention location fit, experience, skills, project types, budget/timeline fit)","aiScore":<integer 65-99>}]}
Include EVERY candidate exactly once, ordered best-first. "reason" must reference concrete project details.
`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { project, contractors } = await req.json();
    const candidates: ContractorCandidate[] = Array.isArray(contractors) ? contractors : [];

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI ranking is not configured.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No candidates supplied.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = buildPrompt(project || {}, candidates);
    const validIds = new Set(candidates.map((c) => String(c.id)));
    let ranking: { id: string; reason: string; aiScore?: number }[] | null = null;

    for (const model of MODEL_VERSIONS) {
      try {
        const res = await fetch(
          `${GEMINI_BASE_URL}/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
            }),
          }
        );
        if (!res.ok) continue;
        const data = await res.json();
        const text: string =
          data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
        if (!text) continue;
        const cleaned = text.replace(/```json|```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end <= start) continue;
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        if (Array.isArray(parsed?.ranking)) {
          // Accept ONLY ids that were supplied (never let AI add contractors).
          const seen = new Set<string>();
          ranking = parsed.ranking
            .filter((r: any) => r && validIds.has(String(r.id)) && !seen.has(String(r.id)) && seen.add(String(r.id)))
            .map((r: any) => ({
              id: String(r.id),
              reason: typeof r.reason === 'string' ? r.reason : '',
              aiScore: typeof r.aiScore === 'number' ? r.aiScore : undefined,
            }));
          if (ranking.length > 0) break;
        }
      } catch {
        continue; // try next model
      }
    }

    if (!ranking) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI ranking unavailable for all models.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true, ranking }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unexpected error in rank-contractor-matches.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
