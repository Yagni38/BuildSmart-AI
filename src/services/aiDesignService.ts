import { supabase } from "../lib/supabase";
import type { AIDesign } from "../types/aiDesign";

export async function generateAIDesign(project: any) {
  const { data, error } = await supabase.functions.invoke(
    "generate-ai-design",
    {
      body: {
        project,
      },
    }
  );

  if (error) {
    console.error(
      "[aiDesignService] Edge Function error:",
      error
    );

    let details = "";

    try {
      if ("context" in error && error.context) {
        details = await (error.context as Response).text();
      }
    } catch {
      // Ignore parsing errors
    }

    throw new Error(
      details ||
      error.message ||
      "Failed to call generate-ai-design Edge Function"
    );
  }

  if (!data) {
    throw new Error("No response received from AI service.");
  }

  console.log("[aiDesignService] AI response:", data);

  return data;
}


/* -------------------------------------------------------
   Fetch previously generated AI designs
------------------------------------------------------- */
export async function fetchAIDesigns(
  projectId: string
): Promise<AIDesign[]> {
  const { data, error } = await supabase
    .from("ai_designs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "[aiDesignService] fetchAIDesigns error:",
      error
    );

    throw new Error(error.message);
  }

  return (data ?? []) as AIDesign[];
}


/* -------------------------------------------------------
   Get signed image URL
------------------------------------------------------- */
export async function getAIImageSignedUrl(
  imagePath: string
): Promise<string | null> {
  if (!imagePath) {
    return null;
  }

  // If the function already returned a complete URL,
  // don't try to create a Supabase storage URL.
  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  const { data, error } = await supabase.storage
    .from("ai-designs")
    .createSignedUrl(imagePath, 60 * 60);

  if (error) {
    console.error(
      "[aiDesignService] getAIImageSignedUrl error:",
      error
    );

    return null;
  }

  return data?.signedUrl ?? null;
}