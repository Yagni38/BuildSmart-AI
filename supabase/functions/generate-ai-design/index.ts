const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Only POST requests are allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    // ---------------------------------------------------------
    // 1. Get Gemini API key from Supabase secrets
    // ---------------------------------------------------------

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured in Supabase secrets",
      );
    }

    // ---------------------------------------------------------
    // 2. Read request body
    // ---------------------------------------------------------

    const body = await req.json();

    const project = body?.project;

    if (!project) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Project details were not provided",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // 3. Extract customer's project details
    // ---------------------------------------------------------

    const location =
      project.location ??
      project.project_location ??
      "Not specified";

    const plotSize =
      project.plot_size ??
      project.plotSize ??
      "Not specified";

    const budget =
      project.budget ??
      "Not specified";

    const floors =
      project.floors ??
      project.number_of_floors ??
      project.numberOfFloors ??
      "Not specified";

    const bedrooms =
      project.bedrooms ??
      project.number_of_bedrooms ??
      project.numberOfBedrooms ??
      "Not specified";

    const bathrooms =
      project.bathrooms ??
      project.number_of_bathrooms ??
      project.numberOfBathrooms ??
      "Not specified";

    const buildingType =
      project.building_type ??
      project.buildingType ??
      "Residential house";

    const description =
      project.description ??
      project.requirements ??
      project.project_description ??
      "No additional requirements provided.";

    // ---------------------------------------------------------
    // 4. Create architectural AI prompt
    // ---------------------------------------------------------

    const prompt = `
Create a photorealistic architectural visualization of a residential house.

CUSTOMER PROJECT DETAILS:

Location:
${location}

Plot size:
${plotSize}

Budget:
${budget}

Number of floors:
${floors}

Bedrooms:
${bedrooms}

Bathrooms:
${bathrooms}

Building type:
${buildingType}

Customer requirements:
${description}

DESIGN REQUIREMENTS:

- Design the house according to the customer's project details.
- Create a realistic and buildable residential architecture.
- Show the complete exterior of the house.
- Use realistic construction proportions.
- Use suitable architectural materials.
- Include realistic windows and doors.
- Include balconies where appropriate.
- Include a suitable entrance.
- Include landscaping where appropriate.
- Make the design visually suitable for the specified location.
- Respect the customer's budget as much as possible.
- Create a modern professional architectural visualization.
- Show realistic daylight and natural lighting.
- Show realistic shadows and materials.
- Make the house look like a real completed construction project.
- Do not include text inside the generated image.
- Do not include labels.
- Do not include measurements.
- Do not include watermarks.
- Do not create a blueprint or diagram.
- Generate a high-quality exterior architectural visualization.
`;

    console.log("Generating AI design for project:", project.id ?? "unknown");

    // ---------------------------------------------------------
    // 5. Call Gemini 3.1 Flash Image
    // ---------------------------------------------------------

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-image",
          input: prompt,
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
            aspect_ratio: "16:9",
            image_size: "2K",
          },
        }),
      },
    );

    // ---------------------------------------------------------
    // 6. Check Gemini response
    // ---------------------------------------------------------

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();

      console.error("Gemini API error:", errorText);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Gemini API error: ${errorText}`,
        }),
        {
          status: geminiResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const geminiData = await geminiResponse.json();

    console.log(
      "Gemini response received successfully",
    );

    // ---------------------------------------------------------
    // 7. Get generated image
    // ---------------------------------------------------------

    let base64Image: string | null = null;
    let mimeType = "image/jpeg";

    // Current Interactions API convenience property
    if (geminiData?.output_image?.data) {
      base64Image = geminiData.output_image.data;

      mimeType =
        geminiData.output_image.mime_type ??
        geminiData.output_image.mimeType ??
        "image/jpeg";
    }

    // Fallback: search inside steps
    if (!base64Image && Array.isArray(geminiData?.steps)) {
      for (const step of geminiData.steps) {
        if (!Array.isArray(step?.content)) {
          continue;
        }

        for (const content of step.content) {
          if (
            content?.type === "image" &&
            content?.data
          ) {
            base64Image = content.data;

            mimeType =
              content.mime_type ??
              content.mimeType ??
              "image/jpeg";

            break;
          }
        }

        if (base64Image) {
          break;
        }
      }
    }

    // ---------------------------------------------------------
    // 8. Make sure an image was actually generated
    // ---------------------------------------------------------

    if (!base64Image) {
      console.error(
        "Gemini returned no image:",
        JSON.stringify(geminiData),
      );

      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Gemini completed the request but did not return an image.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // 9. Convert image to data URL
    // ---------------------------------------------------------

    const imageDataUrl =
      `data:${mimeType};base64,${base64Image}`;

    console.log(
      "AI house visualization generated successfully",
    );

    // ---------------------------------------------------------
    // 10. Return image to ProjectDetails.tsx
    // ---------------------------------------------------------

    return new Response(
      JSON.stringify({
        success: true,
        image: imageDataUrl,
        mimeType,
        projectId: project.id ?? null,
        message: "AI house visualization generated successfully",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    // ---------------------------------------------------------
    // Global error handler
    // ---------------------------------------------------------

    console.error(
      "generate-ai-design ERROR:",
      error,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown AI generation error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});