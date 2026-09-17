const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Only POST requests are allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in Supabase secrets");
    }

    const body = await req.json();
    const project = body?.project;
    if (!project) {
      return new Response(
        JSON.stringify({ success: false, error: "Project details were not provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const buildingType = project.building_type ?? "Not specified";
    const city = project.city ?? "";
    const state = project.state ?? "";
    const location = [city, state].filter(Boolean).join(", ") || project.full_address || "Not specified";
    const fullAddress = project.full_address ?? "Not specified";
    const builtUpArea = project.built_up_area ?? "Not specified";
    const plotSize = project.plot_size ?? "Not specified";
    const floors = project.floors ?? "Not specified";
    const bedrooms = project.bedrooms ?? "Not specified";
    const bathrooms = project.bathrooms ?? "Not specified";
    const requirements = project.requirements ?? "Not specified";
    const preferredMaterials = project.preferred_materials ?? "Not specified";
    const budget = project.budget ?? "Not specified";
    const timeline = project.timeline ?? "Not specified";
    const designStyle = project.design_style ?? "Not specified";
    const description = project.description ?? "";

    const prompt = `You are an expert Indian construction project planner. Based on the customer's REAL project requirements below, generate a comprehensive preliminary project plan.

The plan has THREE sections: BUDGET, TIMELINE, and DESIGN CONCEPT.

IMPORTANT RULES:
- BUDGET is a PLANNING ESTIMATE only, NOT a guaranteed quotation. Always label it as a preliminary estimate.
- TIMELINE should be stage-wise, realistic for Indian construction, and respect the customer's desired completion period.
- DESIGN CONCEPT should be a visual concept description that could guide an architect or AI image model.
- All costs in INR (₹). Use Lakhs/Crores where appropriate.
- Be specific and practical for the Indian construction context.

CUSTOMER PROJECT REQUIREMENTS:
- Construction Type: ${buildingType}
- Location: ${location}
- Full Address: ${fullAddress}
- Built-up Area: ${builtUpArea} sq ft
- Plot Size: ${plotSize} sq ft
- Number of Floors: ${floors}
- Number of Bedrooms: ${bedrooms}
- Number of Bathrooms: ${bathrooms}
- Customer Requirements: ${requirements}
- Preferred Materials: ${preferredMaterials}
- Customer Budget: ${budget}
- Desired Completion: ${timeline}
- Design Preferences: ${designStyle}
- Additional Description: ${description}

Respond with ONLY a valid JSON object in this exact structure (no markdown, no code fences, no extra text):

{
  "budget": {
    "estimateMin": <number in INR>,
    "estimateMax": <number in INR>,
    "currency": "INR",
    "notes": "<preliminary planning estimate disclaimer and key assumptions>",
    "breakdown": [
      { "category": "<e.g. Foundation>", "item": "<e.g. Excavation & PCC>", "estimatedCost": <number>, "notes": "<brief note>" }
    ]
  },
  "timeline": {
    "notes": "<overall timeline summary>",
    "stages": [
      { "stage": "<e.g. Foundation>", "durationDays": <number>, "description": "<what happens in this stage>" }
    ]
  },
  "design": {
    "concept": "<a detailed visual concept description for the building exterior and overall aesthetic>",
    "style": "<architectural style recommendation>"
  }
}`;

    const geminiPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    };

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
    console.log(`[generate-ai-project-plan] Calling Gemini model: ${model}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify(geminiPayload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-ai-project-plan] Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API returned ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const geminiData = await response.json();
    const candidates = geminiData?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error("Gemini returned no candidates in the response.");
    }

    const textParts = candidates[0]?.content?.parts?.map((p: any) => p.text ?? "") ?? [];
    const rawText = textParts.join("").trim();
    if (!rawText) {
      throw new Error("Gemini returned an empty response.");
    }

    console.log("[generate-ai-project-plan] Raw response length:", rawText.length);

    let cleaned = rawText;
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let plan: any;
    try {
      plan = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("[generate-ai-project-plan] JSON parse error:", parseError);
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse the AI response as JSON. The model may have returned an unexpected format.");
      }
    }

    if (!plan.budget || !plan.timeline || !plan.design) {
      throw new Error("The AI response is missing required sections (budget, timeline, or design).");
    }

    return new Response(
      JSON.stringify({
        success: true,
        projectId: project.id ?? null,
        plan: { budget: plan.budget, timeline: plan.timeline, design: plan.design },
        rawResponse: rawText,
        model,
        message: "AI project plan generated successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-ai-project-plan ERROR:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown AI generation error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
