/**
 * Deterministic "AI-Assisted Project Plan" generator (Phase 2 - local planner).
 *
 * Replaces the failing `generate-ai-project-plan` Edge Function dependency:
 * the plan is built entirely in the browser from the customer's REAL saved
 * project row (public.projects) using documented engineering-estimate
 * heuristics. No network call, no API key, no Gemini, no billing - it keeps
 * working even when external AI services are unavailable.
 *
 * The plan ALWAYS adapts to the saved project fields: building/project type,
 * built-up area, floors, bedrooms, bathrooms, city/state, budget,
 * design style, material preference, sustainability preference, requirements,
 * priority and expected completion.
 *
 * All numbers are PRELIMINARY ESTIMATES for planning only - not quotations and
 * not structural engineering advice. Budget figures reuse the exact
 * location-adjusted engine behind the Material Estimator
 * (lib/materialRates.ts), so the two features always agree.
 *
 * Pure functions only - no Supabase access.
 */

import type {
  AIPlanBudget,
  AIPlanBudgetBreakdown,
  AIPlanDesign,
  AIPlanTimelineStage,
  AIProjectPlanResult,
} from '../types/aiDesign';
import type { Project } from '../types/project';
import { estimateMaterialCost, type MaterialEstimate } from './materialRates';

/** Value written to ai_project_plans.ai_model for locally generated plans. */
export const LOCAL_PLAN_MODEL = 'deterministic-local-planner';

// ============================================================
// 1) PLAN CONTEXT
// ============================================================

interface PlanContext {
  area: number;
  floors: number;
  bedrooms: number;
  bathrooms: number;
  buildingType: string;
  locationLabel: string;
  isCoastal: boolean;
  designStyle: string;
  /** Lower-cased material/sustainability/kitchen/parking/requirements text. */
  preferences: string;
  priority: string;
}

function buildContext(project: Project): PlanContext {
  const floors = Math.max(1, Math.round(Number(project.floors) || 1));
  const bedrooms = Math.max(0, Math.round(Number(project.bedrooms) || 0));
  const bathrooms = Math.max(0, Math.round(Number(project.bathrooms) || 0));
  const area = Math.max(0, Number(project.built_up_area) || 0);
  const state = (project.state ?? '').toLowerCase();
  const locationLabel =
    [project.city, project.state].filter(Boolean).join(', ') || 'your area';
  const preferences = [
    project.preferred_materials,
    project.material_preference,
    project.sustainability_preference,
    project.kitchen_type,
    project.parking,
    project.requirements,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    area,
    floors,
    bedrooms,
    bathrooms,
    buildingType: (project.building_type ?? 'home').trim() || 'home',
    locationLabel,
    isCoastal:
      /andhra|tamil|kerala|odisha|bengal|goa|puducherry|coastal/.test(state) ||
      /coastal|beachside|beach/.test(preferences),
    designStyle: (project.design_style ?? '').trim(),
    preferences,
    priority: (project.priority ?? '').trim(),
  };
}

// ============================================================
// 2) DURATION MODEL
// ============================================================

/**
 * Baseline construction duration in calendar days:
 *   120 days base shell + finishing rhythm
 *   + 0.22 x built-up area
 *   + 55 x (floors - 1)   — extra slabs, staircases and curing per floor
 *   + 6  x bathrooms      — wet areas and sanitary rough-in
 *   + 3  x bedrooms       — joinery and finishing volume
 *   x project-type scope  — renovations/interiors take less
 *   x priority factor     — high priority fast-tracks ~10%
 * Clamped to the 90-760 day range typical for Indian residential works.
 */
function estimateTotalDurationDays(
  project: Project,
  ctx: PlanContext,
): { days: number; priorityFactor: number; scopeFactor: number } {
  let days =
    120 + ctx.area * 0.22 + (ctx.floors - 1) * 55 + ctx.bathrooms * 6 + ctx.bedrooms * 3;

  const type = String(project.project_type ?? 'NEW_CONSTRUCTION').toUpperCase();
  const scopeFactor =
    type === 'INTERIOR_DESIGN' ? 0.55 : type === 'RENOVATION' ? 0.75 : 1;

  const priority = ctx.priority.toLowerCase();
  const priorityFactor = /high|urgent|fast|asap/.test(priority)
    ? 0.9
    : /low|relaxed|flexible/.test(priority)
      ? 1.1
      : 1;

  days = days * scopeFactor * priorityFactor;
  return { days: Math.round(Math.min(760, Math.max(90, days))), priorityFactor, scopeFactor };
}

// ============================================================
// 3) CONSTRUCTION PHASES
//    The 12 execution phases of a residential build. Every text adapts to
//    the saved project (floors, bathrooms, design style, material and
//    sustainability preferences, location, requirements).
// ============================================================

interface PhaseDef {
  name: string;
  /** Relative share of the total duration (renormalized across phases). */
  weight: (ctx: PlanContext) => number;
  dependencies: (ctx: PlanContext) => string;
  milestone: (ctx: PlanContext) => string;
  description: (ctx: PlanContext) => string;
  tasks: (ctx: PlanContext) => string[];
}

const bathroomWeightFactor = (bathrooms: number): number =>
  bathrooms >= 3 ? 1.2 : bathrooms === 2 ? 1.05 : 1;

const PHASE_DEFS: readonly PhaseDef[] = [
  {
    name: 'Foundation',
    weight: () => 10,
    dependencies: () => 'Approved drawings, soil test report and site marking',
    milestone: () =>
      'Plinth beams cast and cured — foundation certified by the site engineer',
    description: (ctx) =>
      ctx.floors > 1
        ? `Excavation and reinforced footings sized for a ${ctx.floors}-floor load path in ${ctx.locationLabel}` +
          (/black.?cotton|expansive/.test(ctx.preferences)
            ? ', with under-reamed piles / soil replacement because expansive soil is noted in your requirements'
            : ctx.isCoastal
              ? ' — the coastal water table calls for dewatering and anti-termite pre-treatment'
              : '')
        : `Excavation and load-bearing footings in ${ctx.locationLabel}` +
          (ctx.isCoastal
            ? ' with dewatering and anti-termite pre-treatment for the coastal water table'
            : ''),
    tasks: (ctx) => [
      'Set out column positions from the approved plan; obtain engineer sign-off',
      'Excavate footings to design depth; dewater if the water table is high',
      ctx.isCoastal || /termite/.test(ctx.preferences)
        ? 'Apply anti-termite soil treatment before the PCC bed'
        : 'Lay the lean PCC bed and tie reinforcement cages',
      'Cast footings, stitch plinth beams and backfill in compacted layers',
    ],
  },
  {
    name: 'Structure — RCC Frame & Slabs',
    weight: (ctx) => 18 * (1 + 0.06 * (ctx.floors - 1)),
    dependencies: () =>
      'Foundation cured to design strength (cube-test results accepted)',
    milestone: (ctx) =>
      ctx.floors > 1
        ? `RCC frame complete — all ${ctx.floors} slabs cast, cured and approved`
        : 'Roof slab cast, cured and de-shuttered',
    description: (ctx) =>
      ctx.floors > 1
        ? `Multi-floor RCC structure: column-beam grid, staircase core and one slab per floor across ${ctx.floors} levels, staged and cured floor by floor` +
          (/stilt|parking/.test(ctx.preferences)
            ? '; ground-floor parking bays are kept column-free per your parking requirement'
            : '')
        : 'Single-storey RCC structure with lintel and sunshade banding over the full built-up area',
    tasks: (ctx) => [
      'Column and shear-wall reinforcement as per the structural drawing',
      ctx.floors > 1
        ? 'Erect staging and cast one slab per floor on a 14-day curing cycle'
        : 'Centering, reinforcement and casting of the roof slab',
      /stilt|parking/.test(ctx.preferences)
        ? 'Protect parking-bay columns with angle guards during construction'
        : 'Check cover blocks, spacers and lap lengths before every cast',
      'Infill masonry (brick / AAC per your material preference) up to lintel level',
    ],
  },
  {
    name: 'Roofing & Terrace',
    weight: () => 8,
    dependencies: () => 'Top-most slab cast and de-shuttered',
    milestone: () =>
      'Terrace waterproofing laid, cured and ponding-tested for 72 hours',
    description: (ctx) =>
      `Terrace slab finishing with ${ctx.isCoastal ? 'high-grade waterproofing suited to coastal monsoon exposure' : 'brick-bat coba and waterproofing membrane'}` +
      (/solar|green|cool|sustain/.test(ctx.preferences)
        ? '; solar-ready conduit sleeves and a reflective cool-roof coating are kept in scope per your sustainability preference'
        : ''),
    tasks: (ctx) => [
      'Lay the slope screed towards the rainwater downpipes',
      ctx.isCoastal
        ? 'Apply two-coat elastomeric waterproofing with geotextile reinforcement'
        : 'Apply brick-bat coba with a waterproofing compound',
      /solar/.test(ctx.preferences)
        ? 'Cast solar panel foundation pads and route rooftop conduit sleeves'
        : 'Provide parapet coping with a drip groove',
      'Pond-test the terrace for 72 hours before tiling',
    ],
  },
  {
    name: 'Electrical & Plumbing Rough-In',
    weight: (ctx) => 10 * bathroomWeightFactor(ctx.bathrooms),
    dependencies: () => 'Wall masonry underway and slab staging de-shuttered',
    milestone: () =>
      'First-fix complete — conduits laid and all water/drain lines pressure- and leak-tested',
    description: (ctx) =>
      `Concealed electrical conduits and CPVC/UPVC drain lines sized for ${ctx.bathrooms} bathroom${ctx.bathrooms === 1 ? '' : 's'} plus the kitchen` +
      (ctx.bathrooms >= 3
        ? '. Three wet areas get independent soil stacks tied into a shared inspection chamber to avoid cross-blockage'
        : ctx.bathrooms === 2
          ? '. Both wet areas are looped to a single inspection chamber with independent traps'
          : '') +
      (/modular/.test(ctx.preferences)
        ? ', with appliance and chimney points pre-planned for the modular kitchen'
        : ''),
    tasks: (ctx) => [
      'Mark electrical points room by room from the furniture layout',
      `Chase walls and lay conduits — about ${Math.round((ctx.bedrooms + ctx.bathrooms + 2) * 14)} electrical points assumed`,
      'Lay CPVC water lines and UPVC soil/waste lines with correct slopes',
      'Pressure-test water lines and leak-test drains before plastering closes the walls',
    ],
  },
  {
    name: 'Flooring',
    weight: (ctx) => 8 * (ctx.area >= 2000 ? 1.1 : 1),
    dependencies: () =>
      'Wall plaster cured for at least 7 days and wet areas waterproofed',
    milestone: () => 'All tiling complete — slopes, levels and thresholds verified',
    description: (ctx) =>
      /marble/.test(ctx.preferences)
        ? 'Marble flooring laid with mirror polish and tight joints, as selected in your material preference'
        : /granite/.test(ctx.preferences)
          ? 'Granite flooring laid with a honed finish, as selected in your material preference'
          : /wooden|laminate|vinyl/.test(ctx.preferences)
            ? 'Engineered wooden flooring over a levelled screed, as selected in your material preference'
            : `Vitrified tile flooring across ~${Math.round(ctx.area).toLocaleString('en-IN')} sq ft with anti-skid tiles in wet areas`,
    tasks: (ctx) => [
      'Levelling screed and waterproofing checker work before tiling',
      'Lay living/bedroom flooring on a 1:3 screed with spacers',
      `${ctx.bathrooms} bathroom floor${ctx.bathrooms === 1 ? '' : 's'} in anti-skid tiles with slopes to floor drains`,
      'Skirting, thresholds and staircase nosing after the paint base coat',
    ],
  },
  {
    name: 'Walls & Painting',
    weight: () => 9,
    dependencies: () => 'Plaster complete and electrical first-fix approved',
    milestone: () => 'Final paint coat approved on all internal and external walls',
    description: (ctx) =>
      (ctx.designStyle ? `${ctx.designStyle} finish direction — ` : '') +
      `wall putty, primer and two emulsion coats over ~${Math.round(ctx.area * 4.2).toLocaleString('en-IN')} sq ft of wall and ceiling area` +
      (ctx.designStyle.toLowerCase().includes('modern')
        ? ', with clean lines, an accent wall and flush finishes for a modern look'
        : '') +
      (ctx.isCoastal
        ? '; exterior faces get anti-fungal weatherproof paint rated for coastal humidity'
        : ''),
    tasks: (ctx) => [
      'Wall putty + one primer coat (sanding between coats)',
      ctx.designStyle
        ? `${ctx.designStyle} theme: accent wall and texture finish in the living area`
        : 'Two top coats of washable interior emulsion',
      ctx.isCoastal
        ? 'Exterior: anti-fungal weatherproof emulsion on all exposed faces'
        : 'Exterior-grade emulsion on the full elevation',
    ],
  },
  {
    name: 'Doors & Windows',
    weight: () => 6,
    dependencies: () => 'Lintel level reached and plaster completed',
    milestone: () => 'All frames fixed; shutters and hardware operational',
    description: (ctx) =>
      `Doors for ${ctx.bedrooms + ctx.bathrooms + 2} rooms plus the main door, and UPVC/aluminium windows with mosquito mesh` +
      (/teak|wood/.test(ctx.preferences)
        ? ' — teak/hardwood frames as per your material preference'
        : '') +
      (/sustain|eco/.test(ctx.preferences)
        ? ', favouring certified timber and low-VOC finishes'
        : ''),
    tasks: () => [
      'Fix door frames with hold-fasts before final plaster patching',
      'Install UPVC windows with sill and lintel levels verified',
      'Hang shutters, fit hardware and adjust for monsoon swelling',
    ],
  },
  {
    name: 'Kitchen',
    weight: () => 6,
    dependencies: () => 'Plumbing first-fix and wall tiling complete',
    milestone: () => 'Kitchen installed — sink, faucet and drainage tested under load',
    description: (ctx) =>
      /modular/.test(ctx.preferences)
        ? 'Modular kitchen with acrylic/laminate shutters, soft-close hardware and a quartz/granite counter'
        : 'Kitchen platform with granite counter and storage as per the saved requirements',
    tasks: () => [
      'Set base units to level; scribe fillers to the wall',
      'Install the sink with trap and connect the water line + RO point',
      'Provision chimney duct, hob cut-out and under-counter lighting',
    ],
  },
  {
    name: 'Bathrooms & Sanitary',
    weight: (ctx) => 7 * bathroomWeightFactor(ctx.bathrooms),
    dependencies: () => 'Waterproofing cured and wall/floor tiling complete',
    milestone: (ctx) =>
      `All ${ctx.bathrooms} bathroom${ctx.bathrooms === 1 ? '' : 's'} commissioned — fixtures tested for 48 hours`,
    description: (ctx) =>
      `Fit-out of ${ctx.bathrooms} bathroom${ctx.bathrooms === 1 ? '' : 's'}: concealed-cistern WCs, geyser points, glass partitions and vanity counters` +
      (ctx.bathrooms >= 3
        ? ', sequenced so the master bathroom is finished first for early use'
        : ''),
    tasks: (ctx) => [
      'Install WCs, basins and taps with sealed threads',
      ctx.bathrooms >= 2
        ? 'Fit glass partitions / shower enclosures in the master and second bathroom'
        : 'Fit the shower enclosure with a sloped drain',
      'Fix accessories (mirrors, shelves, towel rails) and silicone-seal all joints',
      'Run a 48-hour fixture test and log any seepage before painting resumes',
    ],
  },
  {
    name: 'Interior Finishing',
    weight: () => 8,
    dependencies: () => 'Paint base coats and flooring complete',
    milestone: () => 'Interior fit-out complete — snag list cleared to zero',
    description: (ctx) =>
      (ctx.designStyle ? `${ctx.designStyle} interior theme: ` : 'Interior fit-out: ') +
      'wardrobes, false ceiling (if in scope), light fixtures and final trims' +
      (/wood|laminate/.test(ctx.preferences)
        ? ', with wooden/laminate wardrobes per your material preference'
        : ''),
    tasks: (ctx) => [
      'Erect wardrobes and lofts; align shutters and handles',
      ctx.designStyle
        ? `${ctx.designStyle} false-ceiling coves and spot-light layout`
        : 'False ceiling and cove lighting where scheduled',
      'Fix switch plates, cover plates and final light fixtures',
    ],
  },
  {
    name: 'Exterior Finishing',
    weight: () => 5,
    dependencies: () => 'Structure complete and scaffolding safe for cladding work',
    milestone: () => 'Elevation complete and site graded/cleaned for handover',
    description: (ctx) =>
      `Elevation texture, parapet capping and site grading in ${ctx.locationLabel}` +
      (/parking|stilt/.test(ctx.preferences)
        ? ', including the parking apron and gate hardstanding'
        : '') +
      (/garden|landscape|lawn/.test(ctx.preferences)
        ? ', plus landscaping per your requirements'
        : ''),
    tasks: (ctx) => [
      'Elevation texture/cladding and final exterior paint',
      /parking|stilt/.test(ctx.preferences)
        ? 'Cast the parking apron with a drainage slope away from the plinth'
        : 'Pave the plinth apron with a drainage slope',
      /garden|landscape|lawn/.test(ctx.preferences)
        ? 'Prepare planting beds and lawn per the landscape requirement'
        : 'Grade and clear the site for handover',
    ],
  },
  {
    name: 'Final Inspection & Handover',
    weight: () => 3,
    dependencies: () => 'All trades complete and the snag list cleared',
    milestone: () => 'Keys, warranties and as-built drawings handed over',
    description: () =>
      'Joint walkthrough with the contractor, meter changeover support and complete documentation before possession',
    tasks: () => [
      'Deep clean and joint snag-list walkthrough with the contractor',
      'Support the occupancy / meter changeover inspection',
      'Hand over warranties, as-built drawings and a maintenance guide',
    ],
  },
];

// ============================================================
// 4) BUILDERS
// ============================================================

function buildStages(ctx: PlanContext, totalDays: number): AIPlanTimelineStage[] {
  const weights = PHASE_DEFS.map((def) => Math.max(0.5, def.weight(ctx)));
  const weightSum = weights.reduce((acc, w) => acc + w, 0);

  const planned = PHASE_DEFS.map((def, i) => {
    const share = weights[i] / weightSum;
    return {
      def,
      percent: share * 100,
      durationDays: Math.max(3, Math.round(totalDays * share)),
    };
  });

  // Absorb rounding drift into the largest phase so durations sum exactly.
  const assigned = planned.reduce((acc, p) => acc + p.durationDays, 0);
  const drift = totalDays - assigned;
  if (drift !== 0) {
    const largest = planned.reduce((a, b) => (b.durationDays > a.durationDays ? b : a));
    largest.durationDays = Math.max(3, largest.durationDays + drift);
  }

  // Percent integers must also sum to exactly 100.
  for (const p of planned) p.percent = Math.round(p.percent);
  const percentDrift = 100 - planned.reduce((acc, p) => acc + p.percent, 0);
  if (percentDrift !== 0) {
    const largest = planned.reduce((a, b) => (b.durationDays > a.durationDays ? b : a));
    largest.percent = Math.max(1, largest.percent + percentDrift);
  }

  return planned.map((p) => ({
    stage: p.def.name,
    durationDays: p.durationDays,
    description: p.def.description(ctx),
    percentOfTimeline: p.percent,
    tasks: p.def.tasks(ctx),
    dependencies: p.def.dependencies(ctx),
    milestone: p.def.milestone(ctx),
  }));
}

/** Budget section — reuses the Material Estimator engine so both agree. */
function buildBudget(project: Project, ctx: PlanContext): AIPlanBudget {
  const estimate = estimateMaterialCost({
    city: project.city,
    state: project.state,
    project_type: project.project_type,
    building_type: project.building_type,
    built_up_area: project.built_up_area,
    floors: project.floors,
    bedrooms: project.bedrooms,
    bathrooms: project.bathrooms,
    preferred_materials: project.preferred_materials,
    material_preference: project.material_preference,
    sustainability_preference: project.sustainability_preference,
    kitchen_type: project.kitchen_type,
    parking: project.parking,
    requirements: project.requirements,
  });

  const breakdown: AIPlanBudgetBreakdown[] = estimate.categories
    .filter((g) => g.subtotal > 0)
    .map((g) => ({
      category: 'Materials',
      item: g.label,
      estimatedCost: g.subtotal,
      notes: `${g.items.length} line item(s) at ${estimate.location.labelSuffix.toLowerCase()}`,
    }));
  breakdown.push(
    {
      category: 'Labour',
      item: 'Labour wages',
      estimatedCost: estimate.labourCost,
      notes: '≈60% of material cost (industry norm for residential works)',
    },
    {
      category: 'Overheads',
      item: 'Contractor overheads',
      estimatedCost: estimate.overheadCost,
      notes: '≈8% of materials + labour',
    },
    {
      category: 'Contingency',
      item: 'Contingency reserve',
      estimatedCost: estimate.contingencyCost,
      notes: '≈5% of the subtotal',
    },
  );

  return {
    estimateMin: estimate.estimatedBudgetMin,
    estimateMax: estimate.estimatedBudgetMax,
    currency: 'INR',
    notes:
      `Preliminary budget for ${ctx.locationLabel} — ${estimate.location.labelSuffix}. Covers materials, labour, overheads and contingency for ` +
      `${Math.round(estimate.built_up_area).toLocaleString('en-IN')} sq ft across ${estimate.floors} floor(s). ` +
      'Indicative only — request contractor quotations before committing funds.',
    breakdown,
  };
}

function buildDesign(project: Project, ctx: PlanContext): AIPlanDesign {
  const style = ctx.designStyle || 'Contemporary';
  const parts: string[] = [];

  parts.push(
    `${style} design direction for a ${ctx.floors}-floor ${ctx.buildingType} with ${ctx.bedrooms} bedroom${ctx.bedrooms === 1 ? '' : 's'} and ${ctx.bathrooms} bathroom${ctx.bathrooms === 1 ? '' : 's'} in ${ctx.locationLabel}.`,
  );

  if (/marble|granite|wood|laminate|vinyl/.test(ctx.preferences)) {
    parts.push(
      /marble/.test(ctx.preferences)
        ? 'Finish palette leans on marble — polished stone floors, skirting-matched thresholds and stone window sills.'
        : /granite/.test(ctx.preferences)
          ? 'Finish palette leans on granite — durable flooring, kitchen counters and stair treads from the same stone family.'
          : 'Finish palette leans on wood/laminate — warm flooring or laminated wardrobes with matching door shutters.',
    );
  }

  if (/solar|rain.?water|harvest|eco|sustain|green/.test(ctx.preferences)) {
    parts.push(
      'Sustainable options are built in: rooftop-solar-ready conduit and panel pads, rainwater harvesting into a recharge pit, low-VOC paints and cross-ventilation-first window placement.',
    );
  }

  if (ctx.floors > 1) {
    parts.push(
      `The ${ctx.floors} floors are stitched by a staircase designed as a visual feature, with balcony/ledge depths kept uniform for a clean elevation rhythm.`,
    );
  }

  if (ctx.isCoastal) {
    parts.push(
      'Coastal climate note: salt-laden air calls for marine-grade window hardware, anti-fungal exterior paint and sealed terrace edges.',
    );
  }

  parts.push(
    'This concept is generated from your saved project requirements — confirm final aesthetics and structural drawings with your architect before execution.',
  );

  return { concept: parts.join(' '), style };
}

function buildTimelineNotes(
  project: Project,
  ctx: PlanContext,
  totalDays: number,
  priorityFactor: number,
  scopeFactor: number,
): string {
  const lines: string[] = [];
  lines.push(
    `Recommended construction duration: about ${totalDays} working days (~${(totalDays / 30).toFixed(1)} months) based on ${Math.round(ctx.area).toLocaleString('en-IN')} sq ft, ${ctx.floors} floor(s), ${ctx.bedrooms} bedroom(s) and ${ctx.bathrooms} bathroom(s).`,
  );
  if (scopeFactor < 1) {
    lines.push('Duration is reduced because this is a renovation/interior scope rather than new construction.');
  }
  if (priorityFactor < 1) {
    lines.push('High priority — the schedule assumes fast-tracked sequencing with parallel work crews.');
  } else if (priorityFactor > 1) {
    lines.push('Relaxed priority — the schedule allows longer curing and buffer time between phases.');
  }

  const target = project.timeline || project.expected_completion;
  if (target) {
    const t = new Date(target);
    if (!Number.isNaN(t.getTime())) {
      const available = Math.round((t.getTime() - Date.now()) / 86400000);
      if (available > 0) {
        lines.push(
          available >= totalDays
            ? `Your expected completion (${t.toLocaleDateString('en-IN')}) leaves ${available} days — this plan fits comfortably.`
            : `Your expected completion (${t.toLocaleDateString('en-IN')}) is only ${available} days away, but the plan needs ~${totalDays} days — consider fast-tracking or extending the deadline.`,
        );
      }
    }
  }

  lines.push(
    'Durations are preliminary planning estimates; in practice phases overlap (e.g., electrical rough-in runs alongside plastering).',
  );
  return lines.join(' ');
}

// ============================================================
// 5) PUBLIC API
// ============================================================

/**
 * Build the complete AI-Assisted Project Plan from a saved project row.
 * Deterministic: the same project always yields the same plan.
 */
export function buildProjectPlan(project: Project): AIProjectPlanResult {
  const ctx = buildContext(project);
  const { days: totalDays, priorityFactor, scopeFactor } = estimateTotalDurationDays(project, ctx);

  return {
    budget: buildBudget(project, ctx),
    timeline: {
      notes: buildTimelineNotes(project, ctx, totalDays, priorityFactor, scopeFactor),
      stages: buildStages(ctx, totalDays),
    },
    design: buildDesign(project, ctx),
  };
}

// ============================================================
// 6) FRESHNESS CHECK
// ============================================================

/** Project fields a saved plan is considered stale on. */
const SNAPSHOT_FIELDS = [
  'building_type',
  'city',
  'state',
  'built_up_area',
  'floors',
  'bedrooms',
  'bathrooms',
  'requirements',
  'preferred_materials',
  'design_style',
] as const;

/**
 * True when a saved plan was generated from the same project inputs as the
 * current row. Used to auto-refresh the plan when the customer edits their
 * project or selects a different saved project.
 */
export function planMatchesProject(
  project: Project,
  saved: { source_project_snapshot: Record<string, unknown> | null } | null,
): boolean {
  if (!saved?.source_project_snapshot) return false;
  const snap = saved.source_project_snapshot;
  return SNAPSHOT_FIELDS.every((field) => {
    const a = (project as unknown as Record<string, unknown>)[field];
    const b = snap[field];
    const sa = a == null || a === '' ? null : String(a);
    const sb = b == null || b === '' ? null : String(b);
    return sa === sb;
  });
}