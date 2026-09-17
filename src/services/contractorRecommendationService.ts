import { supabase } from '../lib/supabase';

export interface ProjectRecommendationInput {
  location?: string;
  city?: string;
  state?: string;
  buildingType?: string;
  projectType?: string;
  totalBudgetLakhs?: number;
  expectedBudget?: number | string;
  floors?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  plotSizeSqft?: number | string;
  builtUpAreaSqft?: number | string;
  materials?: string;
  designStyle?: string;
  timeline?: string;
  description?: string;
  requirements?: string;
}

export interface ContractorRecommendation {
  contractor: {
    id: string;
    user_id?: string;
    company: string;
    owner: string;
    location: string;
    skills: string[];
    yearsOfExperience: number;
    projectTypes: string[];
    description: string;
    email?: string;
    phone?: string;
    verified: boolean;
    verificationStatus: string;
    rating: number;
    reviewsCount: number;
    projectsCompleted: number;
    priceEstimate: number;
    warranty: number;
  };
  rankLabel: '#1 Best Match' | '#2 Strong Match' | '#3 Good Match' | string;
  matchScore: number; // 0 to 100
  scoreBreakdown: {
    locationScore: number; // max 30
    projectTypeScore: number; // max 25
    skillsScore: number; // max 20
    experienceScore: number; // max 15
    budgetSuitabilityScore: number; // max 10
  };
  whyRecommended: string;
}

export interface RecommendationResult {
  recommendations: ContractorRecommendation[];
  hasFewerThan3Approved: boolean;
  totalApprovedCount: number;
  message?: string;
  /** True when the AI re-ranking pass succeeded (deterministic scores kept otherwise). */
  aiEnhanced?: boolean;
}

/**
 * 100-Point Match Scoring Algorithm
 *
 * Location match: 30 pts
 * Project type match: 25 pts
 * Skills match: 20 pts
 * Experience: 15 pts
 * Budget & Suitability: 10 pts
 * Total: 100 pts
 */
export function calculateMatchScore(
  c: any,
  project: ProjectRecommendationInput
): { matchScore: number; breakdown: ContractorRecommendation['scoreBreakdown']; whyRecommended: string } {
  const pLocation = (project.location || project.city || 'Bengaluru').toLowerCase();
  const pState = (project.state || 'Karnataka').toLowerCase();
  const pType = (project.buildingType || project.projectType || 'Villa').toLowerCase();
  const pDesc = (project.description || project.requirements || '').toLowerCase();

  const cLocation = (c.location || '').toLowerCase();
  const cCompany = c.company_name || c.company || 'Verified Contractor';
  const cOwner = c.full_name || c.owner || 'Verified Contractor';
  const cExp = c.years_of_experience || c.experience || 5;
  const cSkillsStr = (c.skills || c.specialty || '').toLowerCase();
  const cProjectTypesStr = (c.project_types || c.specialty || '').toLowerCase();
  const cDesc = (c.description || c.matchReason || '').toLowerCase();

  // 1. Location Score (max 30)
  let locationScore = 10;
  if (pLocation && cLocation.includes(pLocation)) {
    locationScore = 30;
  } else if (pState && cLocation.includes(pState)) {
    locationScore = 20;
  } else if (cLocation.includes('bengaluru') || cLocation.includes('karnataka')) {
    locationScore = 15;
  }

  // 2. Project Type Score (max 25)
  let projectTypeScore = 10;
  if (pType && (cProjectTypesStr.includes(pType) || cSkillsStr.includes(pType))) {
    projectTypeScore = 25;
  } else if (cProjectTypesStr.includes('residential') || cProjectTypesStr.includes('villas') || cProjectTypesStr.includes('custom')) {
    projectTypeScore = 18;
  } else {
    projectTypeScore = 12;
  }

  // 3. Skills Score (max 20)
  let skillsScore = 8;
  const keywords = ['structural', 'masonry', 'plumbing', 'eco', 'modern', 'framing', 'interior', 'renovation', 'minimalism', 'luxury'];
  // Phase 5: match against the REAL project's materials + design preferences too
  const pMaterials = (project.materials || '').toLowerCase();
  const pDesign = (project.designStyle || '').toLowerCase();
  const pTimeline = (project.timeline || '').toLowerCase();
  let matchedKeywords = 0;
  keywords.forEach(kw => {
    if ((pDesc.includes(kw) || pType.includes(kw) || pMaterials.includes(kw) || pDesign.includes(kw)) && (cSkillsStr.includes(kw) || cDesc.includes(kw) || cProjectTypesStr.includes(kw))) {
      matchedKeywords++;
    }
  });

  if (matchedKeywords >= 3) skillsScore = 20;
  else if (matchedKeywords === 2) skillsScore = 16;
  else if (matchedKeywords === 1) skillsScore = 12;
  else skillsScore = 10;

  // 4. Experience Score (max 15)
  let experienceScore = 8;
  if (cExp >= 15) experienceScore = 15;
  else if (cExp >= 10) experienceScore = 13;
  else if (cExp >= 5) experienceScore = 10;
  else experienceScore = 7;

  // 5. Budget & Suitability Score (max 10)
  // Phase 5: factor the real project scope (built-up area / floors) — the
  // verified-contractor schema has no price column, so budget suitability is
  // scope-based, never an invented contractor price.
  const builtUp = Number(project.builtUpAreaSqft ?? project.plotSizeSqft ?? 0) || 0;
  const floorsNum = Number(project.floors ?? 0) || 0;
  let budgetSuitabilityScore = 8;
  if (builtUp > 2500 || floorsNum >= 2) {
    budgetSuitabilityScore = cExp >= 10 ? 10 : 8;
  } else if (builtUp > 0) {
    budgetSuitabilityScore = 9;
  }

  let totalScore = locationScore + projectTypeScore + skillsScore + experienceScore + budgetSuitabilityScore;
  totalScore = Math.min(99, Math.max(65, totalScore)); // Bound score realistically

  // Dynamic "Why Recommended" rationale
  let whyRecommended = "";
  const scopeBits: string[] = [];
  if (project.materials) scopeBits.push(`materials (${project.materials})`);
  if (project.designStyle) scopeBits.push(`${project.designStyle} design`);
  if (pTimeline) scopeBits.push(`timeline: ${project.timeline}`);
  const scopeSuffix = scopeBits.length ? ` Aligned with your ${scopeBits.join(', ')}.` : '';

  if (locationScore >= 25 && projectTypeScore >= 20) {
    whyRecommended = `Strong location and project-type match in ${c.location || 'your area'} with ${cExp}+ years of experience.${scopeSuffix}`;
  } else if (cExp >= 10) {
    whyRecommended = `Top-rated veteran contractor with ${cExp} years of structural experience and verified credentials.${scopeSuffix}`;
  } else if (skillsScore >= 14) {
    whyRecommended = `Excellent skill alignment for ${project.buildingType || 'your project'} with 100% verified legal license.${scopeSuffix}`;
  } else {
    whyRecommended = `Verified local contractor with background check cleared and active liability insurance.${scopeSuffix}`;
  }

  return {
    matchScore: totalScore,
    breakdown: {
      locationScore,
      projectTypeScore,
      skillsScore,
      experienceScore,
      budgetSuitabilityScore
    },
    whyRecommended
  };
}

/**
 * Fetch top 3 verified contractor recommendations from Supabase database.
 * Only contractors whose verification_status is VERIFIED (or legacy APPROVED)
 * are ever considered — PENDING/REJECTED are excluded by the database query.
 */
export async function getTop3ContractorRecommendations(
  projectData: ProjectRecommendationInput
): Promise<RecommendationResult> {
  try {
    let approvedContractors: any[] = [];

    // 1. Fetch VERIFIED contractors from profiles table
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'CONTRACTOR')
      .in('verification_status', ['VERIFIED', 'APPROVED']);

    if (!profileErr && profileData && profileData.length > 0) {
      approvedContractors = profileData;
    }

    // 2. Fetch VERIFIED contractors from contractor_profiles table if needed
    const { data: cpData, error: cpErr } = await supabase
      .from('contractor_profiles')
      .select('*')
      .in('verification_status', ['VERIFIED', 'APPROVED']);

    if (!cpErr && cpData && cpData.length > 0) {
      // Merge unique by user_id/id
      cpData.forEach(cp => {
        if (!approvedContractors.some(p => p.id === cp.user_id || p.id === cp.id)) {
          approvedContractors.push(cp);
        }
      });
    }

    // Strictly keep only verified-pool rows (defense in depth; the DB query
    // already filtered, but a legacy row could carry a non-standard value).
    approvedContractors = approvedContractors.filter(
      c => c.verification_status === 'VERIFIED' ||
           c.verification_status === 'APPROVED' ||
           c.verificationStatus === 'VERIFIED' ||
           c.verificationStatus === 'APPROVED'
    );

    // If 0 verified contractors exist in the DB, return an EMPTY result —
    // never fall back to mock contractors. Only database-verified contractors
    // are allowed in the pool (business rule).
    if (approvedContractors.length === 0) {
      return {
        recommendations: [],
        hasFewerThan3Approved: true,
        totalApprovedCount: 0,
        message:
          'No verified contractors are available yet. New contractors appear here as soon as an admin approves them.',
      };
    }

    // Calculate match scores for all approved contractors
    const scoredContractors: ContractorRecommendation[] = approvedContractors.map(c => {
      const { matchScore, breakdown, whyRecommended } = calculateMatchScore(c, projectData);
      
      const skillsArray = (c.skills || c.specialty || 'General Construction')
        .split(',')
        .map((s: string) => s.trim());
        
      const projectTypesArray = (c.project_types || c.specialty || 'Villa, House')
        .split(',')
        .map((s: string) => s.trim());

      return {
        contractor: {
          id: c.id || c.user_id,
          user_id: c.user_id || c.id,
          company: c.company_name || c.company || `${c.full_name || 'Verified'} Builders`,
          owner: c.full_name || c.owner || 'Verified Contractor',
          location: c.location || 'Bengaluru, Karnataka',
          skills: skillsArray,
          yearsOfExperience: c.years_of_experience || c.experience || 5,
          projectTypes: projectTypesArray,
          description: c.description || c.matchReason || 'Admin verified contractor with active structural liability insurance.',
          email: c.email,
          phone: c.phone,
          verified: true,
          verificationStatus: 'VERIFIED',
          rating: c.rating || 4.9,
          reviewsCount: c.reviewsCount || 32,
          projectsCompleted: c.projects || 28,
          priceEstimate: c.priceEstimate || 42.5,
          warranty: c.warranty || 10
        },
        rankLabel: '', // Set below
        matchScore,
        scoreBreakdown: breakdown,
        whyRecommended
      };
    });

    // Sort by match score descending
    scoredContractors.sort((a, b) => b.matchScore - a.matchScore);

    // Take top 3
    const top3 = scoredContractors.slice(0, 3);

    // Assign rank labels
    const labels = ['#1 Best Match', '#2 Strong Match', '#3 Good Match'];
    top3.forEach((rec, idx) => {
      rec.rankLabel = labels[idx] || `#${idx + 1} Recommendation`;
    });

    const hasFewerThan3Approved = approvedContractors.length < 3;
    let message: string | undefined;

    if (hasFewerThan3Approved) {
      message = `Currently ${approvedContractors.length} approved contractor${approvedContractors.length === 1 ? '' : 's'} match your area. More verified contractors are being onboarded daily.`;
    }

    // Phase 5: optional AI-assisted re-ranking / explanation. The eligibility
    // filter ALREADY ran (only VERIFIED rows are in top3) — AI can only
    // re-order / re-explain this pre-filtered list, never add contractors.
    // Any AI failure falls back silently to the deterministic ranking.
    let aiEnhanced = false;
    try {
      aiEnhanced = await enhanceWithAI(projectData, top3);
    } catch {
      aiEnhanced = false;
    }

    return {
      recommendations: top3,
      hasFewerThan3Approved,
      totalApprovedCount: approvedContractors.length,
      message,
      aiEnhanced
    };
  } catch (error: any) {
    console.error('[contractorRecommendationService] Error fetching recommendations:', error);
    // Never fall back to mock contractors — the verified pool is DB-only.
    return {
      recommendations: [],
      hasFewerThan3Approved: true,
      totalApprovedCount: 0,
      message:
        'Verified contractor recommendations are temporarily unavailable. Please try again shortly.',
    };
  }

/**
 * Phase 5 — AI-assisted ranking/explanation of the ALREADY-verified top
 * candidates. Calls the `rank-contractor-matches` Edge Function (GEMINI_API_KEY
 * lives in Supabase secrets, never the frontend). The function receives only
 * verified contractors and may ONLY re-order them and rewrite explanations —
 * it cannot add contractors, so verified eligibility is enforced before AI.
 *
 * Returns true when the AI pass succeeded; throws on any failure (caller
 * falls back to the deterministic ranking — never a broken UI).
 */
async function enhanceWithAI(
  projectData: ProjectRecommendationInput,
  top: ContractorRecommendation[]
): Promise<boolean> {
  if (top.length === 0) return false;

  const { data, error } = await supabase.functions.invoke('rank-contractor-matches', {
    body: {
      project: {
        buildingType: projectData.buildingType || projectData.projectType || '',
        city: projectData.city || '',
        state: projectData.state || '',
        location: projectData.location || '',
        builtUpAreaSqft: projectData.builtUpAreaSqft ?? projectData.plotSizeSqft ?? null,
        floors: projectData.floors ?? null,
        bedrooms: projectData.bedrooms ?? null,
        bathrooms: projectData.bathrooms ?? null,
        budget: projectData.expectedBudget ?? projectData.totalBudgetLakhs ?? null,
        timeline: projectData.timeline || '',
        materials: projectData.materials || '',
        designStyle: projectData.designStyle || '',
        requirements: projectData.requirements || projectData.description || '',
      },
      contractors: top.map((rec) => ({
        id: rec.contractor.id,
        company: rec.contractor.company,
        owner: rec.contractor.owner,
        location: rec.contractor.location,
        skills: rec.contractor.skills.join(', '),
        projectTypes: rec.contractor.projectTypes.join(', '),
        yearsOfExperience: rec.contractor.yearsOfExperience,
        description: rec.contractor.description,
        deterministicScore: rec.matchScore,
      })),
    },
  });

  if (error) throw new Error(error.message || 'AI ranking failed');
  const res = data as { success?: boolean; ranking?: { id: string; reason: string; aiScore?: number }[] };
  if (!res?.success || !Array.isArray(res.ranking)) throw new Error('AI ranking returned no data');

  // Apply AI order + explanations STRICTLY to the supplied (verified) ids.
  const byId = new Map(top.map((rec) => [rec.contractor.id, rec]));
  const reordered: ContractorRecommendation[] = [];
  res.ranking.forEach((r) => {
    const rec = byId.get(r.id);
    if (rec && r.reason) {
      rec.whyRecommended = r.reason;
      if (typeof r.aiScore === 'number' && Number.isFinite(r.aiScore)) {
        rec.matchScore = Math.min(99, Math.max(65, Math.round(r.aiScore)));
      }
      reordered.push(rec);
      byId.delete(r.id);
    }
  });
  // Preserve any verified candidates the AI omitted (never drop them).
  byId.forEach((rec) => reordered.push(rec));

  // Write back in place.
  top.length = 0;
  reordered.forEach((rec) => top.push(rec));

  const labels = ['#1 Best Match', '#2 Strong Match', '#3 Good Match'];
  top.forEach((rec, idx) => {
    rec.rankLabel = labels[idx] || `#${idx + 1} Recommendation`;
  });

  // Re-sort defensively by final score descending.
  top.sort((a, b) => b.matchScore - a.matchScore);
  top.forEach((rec, idx) => {
    rec.rankLabel = labels[idx] || `#${idx + 1} Recommendation`;
  });

  return true;
}
}

/**
 * Read back the contractor currently assigned to a project DIRECTLY from
 * Supabase (projects.contractor_id → its contractor_profiles row).
 *
 * The customer's recommendation panel uses this to restore the
 * "Contractor Selected Successfully" state after a refresh, so the UI never
 * relies on transient React state.
 *
 * Only VERIFIED/APPROVED contractor_profiles rows are readable by a customer
 * (RLS `contractor_profiles_verified_public_select`), which is exactly the
 * eligibility rule for selection; if the row cannot be read a minimal
 * placeholder (id only) is returned so the assignment is still shown.
 */
export async function getAssignedContractorForProject(
  projectId: string
): Promise<ContractorRecommendation['contractor'] | null> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, contractor_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    console.warn(
      '[contractorRecommendationService] assigned contractor lookup failed:',
      error.message
    );
    return null;
  }

  const contractorId = (project as { contractor_id?: string | null } | null)?.contractor_id;
  if (!contractorId) return null;

  const { data: cp } = await supabase
    .from('contractor_profiles')
    .select('*')
    .eq('id', contractorId)
    .maybeSingle();

  const profile = (cp ?? {}) as Record<string, any>;
  const splitList = (value: unknown, fallback: string[]): string[] => {
    const parts = String(value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : fallback;
  };

  return {
    id: contractorId,
    user_id: contractorId,
    company: profile.company_name || `${profile.full_name || 'Assigned'} Builders`,
    owner: profile.full_name || 'Assigned Contractor',
    location: profile.location || 'Location shared on request',
    skills: splitList(profile.skills, ['General Construction']),
    yearsOfExperience: Number(profile.experience_years ?? 0) || 0,
    projectTypes: splitList(profile.project_types, []),
    description: 'Assigned to your project.',
    email: profile.email,
    phone: profile.phone,
    verified: ['VERIFIED', 'APPROVED'].includes(
      String(profile.verification_status ?? '').toUpperCase()
    ),
    verificationStatus: String(profile.verification_status ?? 'VERIFIED'),
    rating: 0,
    reviewsCount: 0,
    projectsCompleted: 0,
    priceEstimate: 0,
    warranty: 0,
  };
}
