/**
 * AIDesign — structured result from the Gemini AI design service.
 *
 * This type mirrors the JSON shape returned by the
 * `generate-ai-design` Edge Function, validated before saving
 * to Supabase.
 *
 * Field names match the Phase-5 structured output contract:
 *  design_summary, architectural_style, recommended_layout,
 *  exterior_design, interior_design, materials, color_palette,
 *  lighting, sustainability, estimated_budget_notes,
 *  construction_recommendations
 */
export interface AIDesign {
  design_title: string;
  design_summary: string;
  architectural_style: string;
  recommended_layout: string;
  exterior_design: string;
  interior_design: string;
  color_palette: string;
  lighting: string;
  sustainability: string;
  estimated_budget_notes: string;
  construction_recommendations: string;
  image_path?: string | null;
  prompt?: string | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  estimated_cost_min: number;
  estimated_cost_max: number;
  materials: AIMaterial[];
}

/**
 * AIMaterial — a single material recommendation from the AI service.
 */
export interface AIMaterial {
  material_name: string;
  category: string;
  quantity: string;
  estimated_cost: number;
  recommendation: string;
}

/**
 * AIDesignResponse — the full response from the Edge Function,
 * including the design, its material recommendations, and the REAL
 * generated house visualization (imageUrl = signed URL, imagePath =
 * Storage object path, imagePrompt = exact prompt sent to Gemini).
 */
export interface AIDesignResponse {
  success: boolean;
  projectId: string;
  design: AIDesign;
  imageUrl: string | null;
  imagePath: string | null;
  imagePrompt: string | null;
  error?: string;
}

/**
 * SavedAIDesign — one row of the public.ai_designs table as returned by
 * fetchAIDesigns(). Column names match the real DB schema (style,
 * layout_recommendation, …) rather than the AIDesign response shape.
 */
export interface SavedAIDesign {
  id: string;
  project_id: string;
  customer_id: string;
  design_title: string | null;
  design_summary: string | null;
  style: string | null;
  color_palette: string | null;
  lighting: string | null;
  construction_recommendations: string | null;
  estimated_budget_notes: string | null;
  image_url: string | null;
  image_path: string | null;
  prompt: string | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  layout_recommendation: string | null;
  exterior_recommendation: string | null;
  interior_recommendation: string | null;
  sustainability_recommendation: string | null;
  estimated_cost_min: number | null;
  estimated_cost_max: number | null;
  ai_response: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload inserted into public.ai_designs. */
export interface AiDesignInsert {
  project_id: string;
  customer_id: string;
  design_title: string;
  design_summary: string;
  style: string;                         // ← maps from architectural_style
  color_palette: string;
  lighting: string;
  construction_recommendations: string;
  estimated_budget_notes: string;
  image_url: string | null;
  image_path: string | null;
  prompt: string | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  layout_recommendation: string;         // ← maps from recommended_layout
  exterior_recommendation: string;       // ← maps from exterior_design
  interior_recommendation: string;       // ← maps from interior_design
  sustainability_recommendation: string; // ← maps from sustainability
  estimated_cost_min: number;
    estimated_cost_max: number;
  ai_response: string; // raw JSON string from Gemini
}

/** Payload inserted into public.ai_materials. */
export interface AiMaterialInsert {
  project_id: string;
  customer_id: string;
  material_name: string;
  category: string;
  quantity: string;
  estimated_cost: number;
  recommendation: string;
}

// ============================================================
// Phase 2 — AI Project Plan types
// ============================================================

/** A single budget breakdown line in the AI project plan. */
export interface AIPlanBudgetBreakdown {
  category: string;
  item: string;
  estimatedCost: number;
  notes?: string;
}

/** The budget section of an AI project plan. */
export interface AIPlanBudget {
  estimateMin: number;
  estimateMax: number;
  currency: string;
  notes: string;
  breakdown: AIPlanBudgetBreakdown[];
}

/** A single timeline stage in the AI project plan. */
export interface AIPlanTimelineStage {
  stage: string;
  durationDays: number;
  description: string;
  /** Share of the overall construction timeline in percent (0-100). */
  percentOfTimeline?: number;
  /** Important tasks inside this phase. */
  tasks?: string[];
  /** What must finish before this phase can start. */
  dependencies?: string;
  /** Completion milestone for this phase. */
  milestone?: string;
}

/** The timeline section of an AI project plan. */
export interface AIPlanTimeline {
  notes: string;
  stages: AIPlanTimelineStage[];
}

/** The design concept section of an AI project plan. */
export interface AIPlanDesign {
  concept: string;
  style: string;
}

/** The complete AI project plan returned by the Edge Function. */
export interface AIProjectPlanResult {
  budget: AIPlanBudget;
  timeline: AIPlanTimeline;
  design: AIPlanDesign;
}

/** Response from the generate-ai-project-plan Edge Function. */
export interface AIProjectPlanResponse {
  success: boolean;
  projectId: string | null;
  plan: AIProjectPlanResult;
  rawResponse: string;
  model: string;
  message?: string;
  error?: string;
}

/** A saved AI project plan row from public.ai_project_plans. */
export interface SavedAIProjectPlan {
  id: string;
  project_id: string;
  customer_id: string;
  budget_estimate_min: number | null;
  budget_estimate_max: number | null;
  budget_currency: string;
  budget_notes: string | null;
  budget_breakdown: AIPlanBudgetBreakdown[] | null;
  timeline_notes: string | null;
  timeline_stages: AIPlanTimelineStage[] | null;
  design_concept: string | null;
  design_style: string | null;
  design_prompt: string | null;
  source_project_snapshot: Record<string, unknown> | null;
  ai_model: string | null;
  ai_raw_response: string | null;
  created_at: string;
  updated_at: string;
}