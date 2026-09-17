/**
 * Phase 7 — Location-based material cost & budget adjustment.
 *
 * SINGLE SOURCE OF TRUTH for the preliminary estimate engine. Every rate,
 * multiplier and quantity factor lives here (nothing hard-coded in components)
 * so rates can be maintained in one place.
 *
 * Pure functions only — no Supabase access. The UI (MaterialEstimator) feeds
 * the real project row into `estimateMaterialCost()` and re-renders whenever
 * the location (or any other input) changes, so the material estimate and the
 * estimated project budget ALWAYS follow the project location.
 *
 * All money values are INR. All area values are sq ft.
 */

import { ProjectType } from '../types/project';

// ============================================================
// 1) LOCATION COST MULTIPLIERS
//    Cost-of-living / logistics indices relative to the national
//    baseline (1.00). City match wins, then state, then default.
// ============================================================

const CITY_MULTIPLIERS: Readonly<Record<string, number>> = {
  mumbai: 1.38, 'navi mumbai': 1.35, thane: 1.32,
  delhi: 1.25, 'new delhi': 1.25,
  gurugram: 1.28, gurgaon: 1.28, noida: 1.22, ghaziabad: 1.15, faridabad: 1.12,
  bengaluru: 1.15, bangalore: 1.15,
  hyderabad: 1.08, secunderabad: 1.08,
  chennai: 1.12,
  pune: 1.12,
  kolkata: 1.05, howrah: 1.05,
  ahmedabad: 0.98, gandhinagar: 0.98,
  jaipur: 0.95, jodhpur: 0.9, udaipur: 0.93,
  kochi: 1.02, cochin: 1.02, thrissur: 0.98, kannur: 0.96,
  coimbatore: 0.98, madurai: 0.93, trichy: 0.92, salem: 0.92,
  mysuru: 0.95, mysore: 0.95, hubli: 0.9, mangaluru: 1.0, belagavi: 0.92,
  lucknow: 0.92, kanpur: 0.9, varanasi: 0.88, prayagraj: 0.88, agra: 0.9,
  indore: 0.93, bhopal: 0.92, jabalpur: 0.88, gwalior: 0.89,
  chandigarh: 1.1, mohali: 1.08, panchkula: 1.08, ludhiana: 0.97, amritsar: 0.95,
  nagpur: 0.9, nashik: 0.98, aurangabad: 0.93, solapur: 0.9,
  vijayawada: 0.95, visakhapatnam: 0.95, guntur: 0.92, tirupati: 0.93,
  surat: 0.96, vadodara: 0.95, rajkot: 0.93,
  patna: 0.88, guwahati: 0.95, bhubaneswar: 0.9, cuttack: 0.88,
  ranchi: 0.88, jamshedpur: 0.9, raipur: 0.89, dehradun: 0.95,
  shimla: 1.05, panaji: 1.1, panjim: 1.1, margao: 1.08,
  trivandrum: 1.0, thiruvananthapuram: 1.0, calicut: 0.98, kozhikode: 0.98,
};

const STATE_MULTIPLIERS: Readonly<Record<string, number>> = {
  maharashtra: 1.3,
  delhi: 1.25, 'nct of delhi': 1.25,
  haryana: 1.2,
  karnataka: 1.1,
  telangana: 1.08,
  'tamil nadu': 1.08,
  kerala: 1.02,
  'west bengal': 1.02,
  gujarat: 1.0,
  punjab: 1.0,
  'himachal pradesh': 1.02,
  goa: 1.1,
  'andhra pradesh': 0.93,
  'madhya pradesh': 0.92,
  rajasthan: 0.95,
  'uttar pradesh': 0.95,
  uttarakhand: 0.94,
  assam: 0.94,
  odisha: 0.88,
  chhattisgarh: 0.88,
  jharkhand: 0.87,
  bihar: 0.86,
  DEFAULT: 1.0,
};

/**
 * Normalize a place name for robust matching: lower-case and strip every
 * non-alphanumeric character. This makes "Andhra Pradesh", "AndhraPradesh",
 * "andhra pradesh " and "ANDHRA-PRADESH" all resolve to the same entry, so a
 * saved project location always finds its regional multiplier.
 */
function normalizePlaceKey(value?: string | null): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalized lookups built once from the tables above. */
const CITY_MULTIPLIER_LOOKUP: ReadonlyMap<string, number> = new Map(
  Object.entries(CITY_MULTIPLIERS).map(([key, value]) => [normalizePlaceKey(key), value]),
);
const STATE_MULTIPLIER_LOOKUP: ReadonlyMap<string, number> = new Map(
  Object.entries(STATE_MULTIPLIERS)
    .filter(([key]) => key !== 'DEFAULT')
    .map(([key, value]) => [normalizePlaceKey(key), value]),
);

// ============================================================
// 4) MATERIAL LINE-ITEM DEFINITIONS (base rates @ multiplier 1.0)
// ============================================================

export interface EstimateLineItem {
  key: string;
  name: string;
  category: MaterialCategory;
  quantity: number;
  unit: string;
  base_unit_rate: number; // INR @ multiplier 1.0
  unit_rate: number; // INR after location multiplier
  cost: number;
  note?: string;
}

export interface EstimateCategoryGroup {
  category: MaterialCategory;
  label: string;
  items: EstimateLineItem[];
  subtotal: number;
}

export interface MaterialEstimateInput {
  city?: string | null;
  state?: string | null;
  project_type?: ProjectType | string | null;
  building_type?: string | null;
  built_up_area?: number | null;
  floors?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  preferred_materials?: string | null;
  /** Live projects column (confirmed) — e.g. "Marble", "AAC blocks". */
  material_preference?: string | null;
  /** Live projects column (confirmed) — e.g. "Solar ready", "Rainwater". */
  sustainability_preference?: string | null;
  /** Live projects column (confirmed) — e.g. "Modular". */
  kitchen_type?: string | null;
  /** Live projects column (confirmed) — e.g. "Covered parking for 1 car". */
  parking?: string | null;
  requirements?: string | null;
}

export interface MaterialEstimate {
  isPreliminary: true;
  label: 'PRELIMINARY ESTIMATE';
  location: LocationFactor;
  scopeLabel: string;
  built_up_area: number;
  floors: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  wall_area: number;
  categories: EstimateCategoryGroup[];
  totalMaterialCost: number;
  labourCost: number;
  overheadCost: number;
  contingencyCost: number;
  estimatedProjectBudget: number;
  estimatedBudgetMin: number;
  estimatedBudgetMax: number;
  notes: string[];
  generatedAt: string;
}

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  structural: 'Structural Materials',
  finishing: 'Finishing Materials',
  services: 'Services & Fittings',
};

interface EstimateContext {
  area: number;
  floors: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  wallArea: number;
  paintArea: number;
  /** lowercase preferred_materials + requirements for keyword matching */
  text: string;
}

interface ItemVariant {
  name: string;
  baseRate: number;
  note?: string;
}

type ItemDef = {
  key: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  baseRate: number;
  quantity: (ctx: EstimateContext) => number;
  /** Optional variant switch driven by the customer's material preferences. */
  variant?: (ctx: EstimateContext) => ItemVariant | null;
  enabled?: (ctx: EstimateContext) => boolean;
  note?: (ctx: EstimateContext) => string | undefined;
};

const ITEM_DEFS: readonly ItemDef[] = [
  // ---- structural ----------------------------------------------------------
  {
    key: 'cement', name: 'OPC 53 Cement', category: 'structural', unit: 'bags (50 kg)',
    baseRate: 410,
    quantity: (c) => c.area * QTY_FACTORS.cementBagsPerSqft,
  },
  {
    key: 'steel', name: 'TMT Steel (Fe500D)', category: 'structural', unit: 'kg',
    baseRate: 78,
    quantity: (c) => c.area * QTY_FACTORS.steelKgPerSqft,
  },
  {
    key: 'walls', name: 'Clay Bricks', category: 'structural', unit: 'nos',
    baseRate: 8,
    quantity: (c) => c.wallArea * QTY_FACTORS.clayBricksPerSqftWall,
    variant: (c) => {
      if (/aac|block|fly.?ash/i.test(c.text)) {
        return {
          name: 'AAC / Fly-ash Blocks',
          baseRate: 62,
          note: 'Selected from your preferred materials — lighter walls, lower mortar use.',
        };
      }
      return null; // default clay bricks
    },
  },
  {
    key: 'sand', name: 'M-Sand', category: 'structural', unit: 'cft',
    baseRate: 95,
    quantity: (c) => c.area * QTY_FACTORS.sandCftPerSqft,
  },
  {
    key: 'aggregate', name: 'Coarse Aggregate (20 mm)', category: 'structural', unit: 'cft',
    baseRate: 75,
    quantity: (c) => c.area * QTY_FACTORS.aggregateCftPerSqft,
  },

  // ---- finishing -----------------------------------------------------------
  {
    key: 'flooring', name: 'Vitrified Floor Tiles', category: 'finishing', unit: 'sqft',
    baseRate: 85,
    quantity: (c) => c.area,
    variant: (c) => {
      if (/marble/i.test(c.text)) {
        return { name: 'Marble Flooring', baseRate: 240, note: 'Premium finish selected from preferences.' };
      }
      if (/granite/i.test(c.text)) {
        return { name: 'Granite Flooring', baseRate: 180, note: 'Premium finish selected from preferences.' };
      }
      if (/wooden|laminate|vinyl/i.test(c.text)) {
        return { name: 'Engineered Wooden Flooring', baseRate: 150, note: 'Selected from your preferred materials.' };
      }
      return null;
    },
  },
  {
    key: 'plaster', name: 'Cement Plaster (both faces)', category: 'finishing', unit: 'sqft',
    baseRate: 45,
    quantity: (c) => c.wallArea,
  },
  {
    key: 'paint', name: 'Interior + Exterior Emulsion', category: 'finishing', unit: 'sqft',
    baseRate: 28,
    quantity: (c) => c.paintArea,
  },
  {
    key: 'waterproof', name: 'Waterproofing (terraces, baths, GB)', category: 'finishing', unit: 'sqft',
    baseRate: 85,
    quantity: (c) => c.area * QTY_FACTORS.waterproofAreaFactor,
  },
  {
    key: 'doors', name: 'Doors (frame + shutter + hardware)', category: 'finishing', unit: 'nos',
    baseRate: 16000,
    quantity: (c) => c.rooms + QTY_FACTORS.mainDoorExtra,
  },
  {
    key: 'windows', name: 'UPVC Windows with glass', category: 'finishing', unit: 'nos',
    baseRate: 12000,
    quantity: (c) => Math.max(2, Math.round(c.rooms * QTY_FACTORS.windowsPerRoom)),
  },
  {
    key: 'kitchen', name: 'Modular Kitchen', category: 'finishing', unit: 'lot',
    baseRate: 180000,
    quantity: () => 1,
    enabled: (c) => c.bedrooms >= 2 || /kitchen/.test(c.text),
  },

  // ---- services ------------------------------------------------------------
  {
    key: 'electrical', name: 'Electrical Wiring & Points', category: 'services', unit: 'points',
    baseRate: 850,
    quantity: (c) => c.rooms * QTY_FACTORS.electricalPointsPerRoom,
  },
  {
    key: 'plumbing', name: 'Plumbing & Sanitary Fixtures', category: 'services', unit: 'fixtures',
    baseRate: 3800,
    quantity: (c) => c.bathrooms * QTY_FACTORS.fixturesPerBathroom + QTY_FACTORS.kitchenFixtures,
  },
  {
    key: 'solar', name: 'Rooftop Solar PV', category: 'services', unit: 'kW',
    baseRate: 65000,
    quantity: (c) => Math.max(3, Math.round(c.area / QTY_FACTORS.solarSqftPerKw)),
    enabled: (c) => /solar/.test(c.text),
    note: () => 'Added because your requirements mention solar.',
  },
  {
    key: 'rainwater', name: 'Rainwater Harvesting System', category: 'services', unit: 'lot',
    baseRate: 45000,
    quantity: () => 1,
    enabled: (c) => /rain.?water|harvest/.test(c.text),
    note: () => 'Added because your requirements mention rainwater harvesting.',
  },
  {
    key: 'lift', name: 'Passenger Lift', category: 'services', unit: 'lot',
    baseRate: 950000,
    quantity: () => 1,
    enabled: (c) => c.floors >= 3 && /lift|elevator/.test(c.text),
    note: () => 'Added for multi-floor access per your requirements.',
  },
  {
    key: 'pool', name: 'Swimming Pool (structure + filtration)', category: 'services', unit: 'lot',
    baseRate: 1400000,
    quantity: () => 1,
    enabled: (c) => /pool/.test(c.text),
    note: () => 'Added because your requirements mention a swimming pool.',
  },
  {
    key: 'landscape', name: 'Landscaping & Garden Development', category: 'services', unit: 'sqft',
    baseRate: 120,
    quantity: (c) => c.area * QTY_FACTORS.landscapeAreaFactor,
    enabled: (c) => /garden|landscape|lawn/.test(c.text),
    note: () => 'Added because your requirements mention landscaping.',
  },
];

// ============================================================
// 5) THE ESTIMATOR
// ============================================================

const round = (n: number, d = 0): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function estimateMaterialCost(input: MaterialEstimateInput): MaterialEstimate {
  const location = resolveLocationFactor(input.city, input.state);
  const scope = resolveScope(input.project_type);

  const floors = Math.max(1, Math.round(Number(input.floors) || 1));
  const bedrooms = Math.max(0, Math.round(Number(input.bedrooms) || 0));
  const bathrooms = Math.max(0, Math.round(Number(input.bathrooms) || 0));

  // Documented default: when built_up_area was never saved on the project,
  // assume it from the room count (250 sq ft shared space + 350 per bedroom
  // + 120 per bathroom) and flag the assumption in the estimate notes.
  let area = Math.max(0, Number(input.built_up_area) || 0);
  const areaAssumed = area <= 0;
  if (areaAssumed) area = 250 + bedrooms * 350 + bathrooms * 120;

  const rooms = bedrooms + bathrooms + QTY_FACTORS.extraRooms;

  const wallArea = area * QTY_FACTORS.wallAreaFactor;
  const paintArea = wallArea + area; // walls + ceilings

  // Keyword matching draws on EVERY free-text preference the project carries
  // (legacy preferred_materials, the live material_preference /
  // sustainability_preference / kitchen_type / parking columns, and the
  // customer's typed requirements) so items like marble flooring, solar or
  // rainwater harvesting are picked up from whichever field holds them.
  const text = [
    input.preferred_materials,
    input.material_preference,
    input.sustainability_preference,
    input.kitchen_type,
    input.parking,
    input.requirements,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const ctx: EstimateContext = { area, floors, rooms, bedrooms, bathrooms, wallArea, paintArea, text };

  const notes: string[] = [];
  if (areaAssumed) {
    notes.push(
      `Built-up area was not saved on the project — assumed ~${area.toLocaleString('en-IN')} sq ft from the room count. Save the real area for a sharper estimate.`,
    );
  }
  if (location.source === 'default' && (input.city || input.state)) {
    notes.push('No regional rate rule found for this location — national baseline rates were used.');
  }
  if (scope.categoryFactor.structural === 0) {
    notes.push('Structural materials are excluded for interior-design projects.');
  }

  const groups: EstimateCategoryGroup[] = (['structural', 'finishing', 'services'] as const)
    .map((category) => ({ category, label: CATEGORY_LABELS[category] }))
    .map((g) => {
      const factor = scope.categoryFactor[g.category];
      const items: EstimateLineItem[] = [];

      if (factor > 0) {
        for (const def of ITEM_DEFS) {
          if (def.category !== g.category) continue;
          if (def.enabled && !def.enabled(ctx)) continue;

          const variant = def.variant?.(ctx) ?? null;
          const name = variant?.name ?? def.name;
          const baseRate = variant?.baseRate ?? def.baseRate;
          const rawQty = def.quantity(ctx) * factor;
          const quantity = round(rawQty, rawQty >= 100 ? 0 : 1);
          if (quantity <= 0) continue;

          items.push({
            key: def.key,
            name,
            category: g.category,
            quantity,
            unit: def.unit,
            base_unit_rate: baseRate,
            unit_rate: round(baseRate * location.multiplier),
            cost: round(quantity * round(baseRate * location.multiplier)),
            note: variant?.note ?? def.note?.(ctx),
          });
        }

        if (factor < 1 && items.length > 0) {
          notes.push(
            `${g.label}: quantities scaled ×${factor.toFixed(2)} for ${scope.label.toLowerCase()} scope.`
          );
        }
      }

      return { ...g, items, subtotal: round(items.reduce((acc, i) => acc + i.cost, 0)) };
    });

  const totalMaterialCost = round(groups.reduce((acc, g) => acc + g.subtotal, 0));
  const labourCost = round(totalMaterialCost * BUDGET_MODEL.labourFactor);
  const overheadCost = round((totalMaterialCost + labourCost) * BUDGET_MODEL.overheadFactor);
  const contingencyCost = round(
    (totalMaterialCost + labourCost + overheadCost) * BUDGET_MODEL.contingencyFactor
  );
  const estimatedProjectBudget = round(
    totalMaterialCost + labourCost + overheadCost + contingencyCost
  );

  return {
    isPreliminary: true,
    label: 'PRELIMINARY ESTIMATE',
    location,
    scopeLabel: scope.label,
    built_up_area: area,
    floors,
    rooms,
    bedrooms,
    bathrooms,
    wall_area: round(wallArea),
    categories: groups,
    totalMaterialCost,
    labourCost,
    overheadCost,
    contingencyCost,
    estimatedProjectBudget,
    estimatedBudgetMin: round(estimatedProjectBudget * (1 - BUDGET_MODEL.rangeSpread)),
    estimatedBudgetMax: round(estimatedProjectBudget * (1 + BUDGET_MODEL.rangeSpread)),
    notes: [
      ...notes,
      'Preliminary estimate generated from location-adjusted reference rates — actual quotations may vary.',
    ],
    generatedAt: new Date().toISOString(),
  };
}

/** Budget lines (in Lakhs) written to public.budget_items when saving. */
export function estimateBudgetLines(estimate: MaterialEstimate): {
  name: string;
  category: string;
  estimated: number;
}[] {
  const toLakhs = (inr: number) => round(inr / 100000, 2);
  return [
    { name: 'Material Cost', category: 'Preliminary Estimate', estimated: toLakhs(estimate.totalMaterialCost) },
    { name: 'Labour Wages', category: 'Preliminary Estimate', estimated: toLakhs(estimate.labourCost) },
    { name: 'Overheads', category: 'Preliminary Estimate', estimated: toLakhs(estimate.overheadCost) },
    { name: 'Contingency', category: 'Preliminary Estimate', estimated: toLakhs(estimate.contingencyCost) },
  ];
}

/** Material take-off lines written to public.construction_materials when saving. */
export function estimateMaterialLines(estimate: MaterialEstimate): {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_cost: number;
}[] {
  return estimate.categories.flatMap((g) =>
    g.items.map((i) => ({
      name: i.name,
      category: g.category,
      quantity: i.quantity,
      unit: i.unit,
      estimated_cost: i.cost,
    }))
  );
}


export interface LocationFactor {
  /** Human readable: "Bengaluru, Karnataka". */
  label: string;
  city: string;
  state: string;
  /** Multiplier applied to every base rate. */
  multiplier: number;
  /** Where the multiplier came from — shown in the UI. */
  source: 'city' | 'state' | 'default';
  /** e.g. "Bengaluru rates ×1.15". */
  labelSuffix: string;
}

export function resolveLocationFactor(city?: string | null, state?: string | null): LocationFactor {
  const c = (city ?? '').trim();
  const s = (state ?? '').trim();
  const cKey = normalizePlaceKey(c);
  const sKey = normalizePlaceKey(s);

  if (cKey && CITY_MULTIPLIER_LOOKUP.has(cKey)) {
    const m = CITY_MULTIPLIER_LOOKUP.get(cKey)!;
    return {
      label: [c, s].filter(Boolean).join(', '),
      city: c,
      state: s,
      multiplier: m,
      source: 'city',
      labelSuffix: `Regional estimate for ${[c, s].filter(Boolean).join(' / ')} (×${m.toFixed(2)})`,
    };
  }
  if (sKey && STATE_MULTIPLIER_LOOKUP.has(sKey)) {
    const m = STATE_MULTIPLIER_LOOKUP.get(sKey)!;
    return {
      label: [c, s].filter(Boolean).join(', '),
      city: c,
      state: s,
      multiplier: m,
      source: 'state',
      labelSuffix: `Regional estimate for ${[c, s].filter(Boolean).join(' / ')} (×${m.toFixed(2)})`,
    };
  }
  return {
    label: [c, s].filter(Boolean).join(', ') || 'Location not set',
    city: c,
    state: s,
    multiplier: STATE_MULTIPLIERS.DEFAULT,
    source: 'default',
    labelSuffix: 'National baseline rates ×1.00',
  };
}

// ============================================================
// 2) PROJECT-TYPE SCOPE
//    Renovation / interior projects consume fewer structural
//    materials than new construction.
// ============================================================

export type MaterialCategory = 'structural' | 'finishing' | 'services';

interface ProjectScope {
  label: string;
  /** Quantity factor applied per material category. 0 = not applicable. */
  categoryFactor: Record<MaterialCategory, number>;
}

const PROJECT_TYPE_SCOPES: Readonly<Record<string, ProjectScope>> = {
  NEW_CONSTRUCTION: { label: 'New Construction', categoryFactor: { structural: 1, finishing: 1, services: 1 } },
  RENOVATION: { label: 'Renovation', categoryFactor: { structural: 0.4, finishing: 0.7, services: 0.6 } },
  INTERIOR_DESIGN: { label: 'Interior Design', categoryFactor: { structural: 0, finishing: 0.9, services: 0.5 } },
};

const DEFAULT_SCOPE: ProjectScope = PROJECT_TYPE_SCOPES.NEW_CONSTRUCTION;

function resolveScope(projectType?: string | null): ProjectScope {
  return (projectType && PROJECT_TYPE_SCOPES[projectType]) || DEFAULT_SCOPE;
}

// ============================================================
// 3) QUANTITY + BUDGET MODEL FACTORS (tweak here, not in UI)
// ============================================================

const QTY_FACTORS = {
  /** 50-kg cement bags per sq ft of built-up area. */
  cementBagsPerSqft: 0.42,
  /** Kg of reinforcement steel per sq ft of built-up area. */
  steelKgPerSqft: 4.2,
  /** Wall area (both faces, openings deducted) as × built-up area. */
  wallAreaFactor: 2.0,
  /** Clay bricks per sq ft of wall. */
  clayBricksPerSqftWall: 9,
  /** Cubic feet of sand per sq ft of built-up area. */
  sandCftPerSqft: 1.35,
  /** Cubic feet of aggregate per sq ft of built-up area. */
  aggregateCftPerSqft: 0.9,
  /** Paintable area (walls + ceilings) as × built-up area. */
  paintAreaFactor: 3.2,
  /** Waterproofing area as × built-up area (bathrooms, terrace, GB). */
  waterproofAreaFactor: 0.35,
  /** Electrical points per room. */
  electricalPointsPerRoom: 14,
  /** Extra rooms counted beyond bedrooms/bathrooms (living, kitchen, balconies). */
  extraRooms: 2,
  /** Doors = rooms + 1 (main door). */
  mainDoorExtra: 1,
  /** UPVC windows per room. */
  windowsPerRoom: 0.8,
  /** Plumbing fixture equivalents per bathroom. */
  fixturesPerBathroom: 8,
  /** Fixed kitchen fixture equivalents. */
  kitchenFixtures: 4,
  /** Solar kW assumed per 600 sq ft (min 3 kW). */
  solarSqftPerKw: 600,
  /** Landscaping sq ft per sq ft built-up (if requested). */
  landscapeAreaFactor: 0.25,
} as const;

/** Budget model: material → project budget. */
const BUDGET_MODEL = {
  /** Labour as a fraction of material cost (India typical ≈ 0.55–0.65). */
  labourFactor: 0.6,
  /** Contractor overheads as a fraction of (material + labour). */
  overheadFactor: 0.08,
  /** Contingency as a fraction of subtotal. */
  contingencyFactor: 0.05,
  /** Preliminary range spread applied around the point estimate. */
  rangeSpread: 0.075,
} as const;
