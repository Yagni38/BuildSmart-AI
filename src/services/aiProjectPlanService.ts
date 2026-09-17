import { supabase } from "../lib/supabase";
import type { Project } from "../types/project";
import type { SavedAIProjectPlan } from "../types/aiDesign";
import { buildProjectPlan, LOCAL_PLAN_MODEL } from "../lib/projectPlan";

/**
 * AI Project Plan service — Phase 2 (local planner revision).
 *
 * The plan is generated DETERMINISTICALLY in the browser from the customer's
 * REAL saved project row (see lib/projectPlan.ts). There is NO Edge Function
 * call, NO Gemini API key and NO billing requirement — generation is instant
 * and keeps working when external AI services are unavailable. UI wording
 * presents it honestly as an "AI-Assisted" plan "generated from your saved
 * project requirements"; nothing here calls an external AI model.
 *
 * The generated plan is ALSO persisted best-effort to public.ai_project_plans
 * (when that table exists) so it survives browser refreshes; persistence
 * failures are logged and NEVER block showing the plan.
 */

/** Fields captured with each generated plan for freshness checks. */
function buildPlanSnapshot(project: Project): Record<string, unknown> {
  return {
    building_type: project.building_type,
    city: project.city,
    state: project.state,
    full_address: project.full_address,
    built_up_area: project.built_up_area,
    plot_size: project.plot_size,
    floors: project.floors,
    bedrooms: project.bedrooms,
    bathrooms: project.bathrooms,
    requirements: project.requirements,
    preferred_materials: project.preferred_materials,
    material_preference: project.material_preference ?? null,
    sustainability_preference: project.sustainability_preference ?? null,
    budget: project.budget,
    timeline: project.timeline,
    design_style: project.design_style,
  };
}

// ---------------------------------------------------------
// Generate + save a plan
// ---------------------------------------------------------

export async function generateAndSaveProjectPlan(
  project: Project,
): Promise<SavedAIProjectPlan> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("Please log in to generate an AI project plan.");
  }

  const customerId = userData.user.id;

  // Security: the authenticated user must be the project owner.
  if (project.customer_id !== customerId) {
    throw new Error(
      "You can only generate a plan for your own projects.",
    );
  }

  // 1) Deterministic local generation — instant and offline-safe.
  const plan = buildProjectPlan(project);
  const snapshot = buildPlanSnapshot(project);

  // 2) Best-effort persistence for history + refresh restore. The optional
  //    ai_project_plans table may not exist on the live database yet; a
  //    failure here is logged and the plan is still returned to the UI.
  try {
    const { data: saved, error: saveError } = await supabase
      .from("ai_project_plans")
      .insert({
        project_id: project.id,
        customer_id: customerId,
        budget_estimate_min: plan.budget.estimateMin,
        budget_estimate_max: plan.budget.estimateMax,
        budget_currency: plan.budget.currency,
        budget_notes: plan.budget.notes,
        budget_breakdown: plan.budget.breakdown,
        timeline_notes: plan.timeline.notes,
        timeline_stages: plan.timeline.stages,
        design_concept: plan.design.concept,
        design_style: plan.design.style,
        design_prompt: null,
        source_project_snapshot: snapshot,
        ai_model: LOCAL_PLAN_MODEL,
        ai_raw_response: null,
      })
      .select()
      .single();

    if (!saveError && saved) {
      return saved as SavedAIProjectPlan;
    }
    console.warn(
      "[aiProjectPlanService] plan persistence skipped:",
      saveError?.message,
    );
  } catch (persistErr) {
    console.warn(
      "[aiProjectPlanService] plan persistence unavailable:",
      persistErr,
    );
  }

  // 3) Local envelope so the UI renders the plan immediately even when the
  //    storage table is absent. Shape mirrors SavedAIProjectPlan.
  const nowIso = new Date().toISOString();
  return {
    id: `local-${nowIso}`,
    project_id: project.id,
    customer_id: customerId,
    budget_estimate_min: plan.budget.estimateMin,
    budget_estimate_max: plan.budget.estimateMax,
    budget_currency: plan.budget.currency,
    budget_notes: plan.budget.notes,
    budget_breakdown: plan.budget.breakdown,
    timeline_notes: plan.timeline.notes,
    timeline_stages: plan.timeline.stages,
    design_concept: plan.design.concept,
    design_style: plan.design.style,
    design_prompt: null,
    source_project_snapshot: snapshot,
    ai_model: LOCAL_PLAN_MODEL,
    ai_raw_response: null,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

// ---------------------------------------------------------
// Load the latest saved plan for a project
// ---------------------------------------------------------

export async function getLatestProjectPlan(
  projectId: string,
): Promise<SavedAIProjectPlan | null> {
  const { data, error } = await supabase
    .from("ai_project_plans")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[aiProjectPlanService] getLatestProjectPlan error:",
      error.message,
    );
    throw new Error(`Failed to load AI project plan: ${error.message}`);
  }

  return (data as SavedAIProjectPlan) ?? null;
}

// ---------------------------------------------------------
// Load all saved plans for a project
// ---------------------------------------------------------

export async function getProjectPlans(
  projectId: string,
): Promise<SavedAIProjectPlan[]> {
  const { data, error } = await supabase
    .from("ai_project_plans")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[aiProjectPlanService] getProjectPlans error:",
      error.message,
    );
    throw new Error(`Failed to load AI project plans: ${error.message}`);
  }

  return (data as SavedAIProjectPlan[]) ?? [];
}
