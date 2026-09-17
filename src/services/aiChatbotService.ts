import { supabase } from '../lib/supabase';
import { Project } from '../types/project';

/**
 * Phase 12 — AI Chatbot service (frontend).
 *
 * Sends user messages to the `ai-chatbot` Edge Function, which securely
 * holds the Gemini API key. The key is NEVER sent to or readable by the browser.
 *
 * Project context is sent so the AI can give relevant, project-aware answers.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotResponse {
  success: boolean;
  reply?: string;
  error?: string;
}

/**
 * Send a message to the AI chatbot.
 *
 * @param message - The user's question or message
 * @param history - Previous messages for conversation context
 * @param project - Optional project data for context-aware responses
 * @param userRole - The current user's role (customer, contractor, admin)
 */
export async function sendChatbotMessage(
  message: string,
  history: ChatMessage[],
  project: Project | null,
  userRole: 'customer' | 'contractor' | 'admin'
): Promise<ChatbotResponse> {
  // Build a sanitized project context (only send fields the AI needs)
  const projectContext = project
    ? {
        name: project.name,
        status: project.status,
        building_type: project.building_type,
        city: project.city,
        state: project.state,
        budget: project.budget,
        budget_min: project.budget_min,
        budget_max: project.budget_max,
        construction_stage: project.construction_stage,
        progress: project.progress,
        timeline: project.timeline,
        description: project.description,
      }
    : null;

  const { data, error } = await supabase.functions.invoke<ChatbotResponse>('ai-chatbot', {
    body: {
      message,
      history,
      project: projectContext,
      user_role: userRole,
    },
  });

  if (error) {
    return {
      success: false,
      error: `AI assistant unavailable: ${error.message ?? 'request failed'}`,
    };
  }

  if (!data) {
    return {
      success: false,
      error: 'AI assistant returned an empty response.',
    };
  }

  return data;
}
