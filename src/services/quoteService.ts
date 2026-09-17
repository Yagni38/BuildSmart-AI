import { supabase } from '../lib/supabase';
import { Quote } from '../types';

/**
 * Quote service — CRUD for the `quotes` table.
 *
 * LIVE columns (verified 2026-09-07 via PostgREST probe):
 *   id, project_id, contractor_id, customer_id, amount, description,
 *   status, created_at
 * There is NO amount_lakhs / valid_until / updated_at column in the
 * live database — nothing else is ever sent.
 *
 * RLS NOTE: the live database currently has no INSERT/UPDATE policy
 * on `quotes`, so writes fail with 42501 until the administrator
 * adds them. Callers must catch and degrade gracefully. The moment
 * policies are added, this works with NO code change.
 */

/**
 * Map a raw Supabase error to a user-friendly message.
 */
function friendlyQuoteError(action: string, message: string): string {
  if (message.includes('row-level security')) {
    return (
      `${action}: the database is missing a permission (RLS policy) for the ` +
      'quotes table, so this operation is not allowed yet. ' +
      'Please ask the administrator to add the quotes RLS policies.'
    );
  }
  return `${action}: ${message}`;
}

/**
 * Fetch all quotes for a specific project (newest first).
 */
export async function getQuotesByProject(projectId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[quoteService] getQuotesByProject failed:', error.message);
    throw new Error(friendlyQuoteError('Failed to load quotes', error.message));
  }

  return (data as Quote[]) ?? [];
}

/**
 * Fetch a single quote by its UUID.
 */
export async function getQuoteById(quoteId: string): Promise<Quote | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();

  if (error) {
    console.error('[quoteService] getQuoteById failed:', error.message);
    throw new Error(friendlyQuoteError('Failed to fetch quote', error.message));
  }

  return data as Quote | null;
}

/**
 * Create a new quote. Only LIVE columns are ever inserted;
 * `status` is optional so the DB default applies.
 */
export async function createQuote(
  quote: Pick<Quote, 'project_id' | 'contractor_id' | 'customer_id'> &
    Partial<Omit<Quote, 'id' | 'created_at' | 'project_id' | 'contractor_id' | 'customer_id'>>
): Promise<Quote> {
  const payload: Record<string, unknown> = {
    project_id: quote.project_id,
    contractor_id: quote.contractor_id,
    customer_id: quote.customer_id,
  };
  if (quote.amount != null) payload.amount = quote.amount;
  if (quote.description != null) payload.description = quote.description;
  if (quote.status != null) payload.status = quote.status;

  const { data, error } = await supabase
    .from('quotes')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[quoteService] createQuote failed:', error.code, error.message);
    throw new Error(friendlyQuoteError('Failed to create quote', error.message));
  }

  return data as Quote;
}

/**
 * Update an existing quote (e.g. status → ACCEPTED/REJECTED).
 * Only LIVE columns are ever updated.
 */
export async function updateQuote(
  quoteId: string,
  updates: Partial<Omit<Quote, 'id' | 'created_at'>>
): Promise<Quote> {
  const payload: Record<string, unknown> = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.status != null) payload.status = updates.status;

  if (Object.keys(payload).length === 0) {
    throw new Error('No quote fields to update.');
  }

  const { data, error } = await supabase
    .from('quotes')
    .update(payload)
    .eq('id', quoteId)
    .select()
    .single();

  if (error) {
    console.error('[quoteService] updateQuote failed:', error.code, error.message);
    throw new Error(friendlyQuoteError('Failed to update quote', error.message));
  }

  return data as Quote;
}

/**
 * Delete a quote.
 */
export async function deleteQuote(quoteId: string): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', quoteId);

  if (error) {
    console.error('[quoteService] deleteQuote failed:', error.message);
    throw new Error(friendlyQuoteError('Failed to delete quote', error.message));
  }
}