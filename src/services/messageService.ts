import { supabase } from '../lib/supabase';
import { Message } from '../types';

/**
 * Message service — CRUD + Realtime for the `messages` table.
 *
 * LIVE columns (verified 2026-09-07 via PostgREST probe):
 *   id, project_id, sender_id, message, attachment_url, created_at
 * Phase 9 added receiver_id + read_at (see
 * supabase/migrations/20260908180000_phase9_project_chat.sql).
 * There is NO sender_type / text / attachment_type / attachment_name
 * column in the live database — nothing else is ever sent.
 *
 * RLS (Phase 6 policies, still in force):
 *   SELECT  → is_project_participant(project_id)
 *   INSERT  → sender_id = auth.uid() AND is_project_participant(project_id)
 *   UPDATE/DELETE → sender_id = auth.uid()
 * Customers can chat only about their own projects; contractors can chat
 * only about projects assigned to them — both enforced server-side.
 */

/**
 * Map a raw Supabase error to a user-friendly message.
 * RLS failures (42501) are called out explicitly so the UI can
 * explain the real cause instead of a generic failure.
 */
function friendlyMessageError(action: string, message: string): string {
  if (message.includes('row-level security')) {
    return (
      `${action}: the database is missing a permission (RLS policy) for the ` +
      'messages table, so this operation is not allowed yet. ' +
      'Please ask the administrator to add the messages RLS policies.'
    );
  }
  return `${action}: ${message}`;
}

/**
 * Fetch all messages for a specific project, ordered oldest first.
 */
export async function getMessagesByProject(projectId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[messageService] getMessagesByProject failed:', error.message);
    throw new Error(friendlyMessageError('Failed to load messages', error.message));
  }

  return (data as Message[]) ?? [];
}

/**
 * Fetch a single message by its UUID.
 */
export async function getMessageById(messageId: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();

  if (error) {
    console.error('[messageService] getMessageById failed:', error.message);
    throw new Error(friendlyMessageError('Failed to fetch message', error.message));
  }

  return data as Message | null;
}

/**
 * Send a new message. Only LIVE columns are ever inserted.
 * receiver_id is optional — when omitted, the message is treated as
 * a broadcast to all participants (read_at stays null until read).
 */
export async function sendMessage(
  message: Omit<Message, 'id' | 'created_at' | 'read_at'>
): Promise<Message> {
  const payload = {
    project_id: message.project_id,
    sender_id: message.sender_id,
    receiver_id: message.receiver_id ?? null,
    message: message.message,
    attachment_url: message.attachment_url ?? null,
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[messageService] sendMessage failed:', error.code, error.message);
    throw new Error(friendlyMessageError('Message not delivered', error.message));
  }

  return data as Message;
}

/**
 * Mark a single message as read by the receiving participant.
 * RLS helper ensures only the intended receiver can set read_at.
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_message_as_read', {
    p_message_id: messageId,
  });

  if (error) {
    console.error('[messageService] markMessageAsRead failed:', error.message);
    throw new Error(friendlyMessageError('Failed to mark message as read', error.message));
  }
}

/**
 * Mark all messages in a project as read for the current user.
 * Returns the number of messages updated.
 */
export async function markProjectMessagesRead(projectId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_project_messages_read', {
    p_project_id: projectId,
  });

  if (error) {
    console.error('[messageService] markProjectMessagesRead failed:', error.message);
    throw new Error(friendlyMessageError('Failed to mark messages as read', error.message));
  }

  return (data as number) ?? 0;
}

/**
 * Subscribe to realtime message updates for a project.
 * The callback fires on INSERT / UPDATE / DELETE.
 * Returns an unsubscribe function.
 */
export function subscribeToProjectMessages(
  projectId: string,
  onMessage: (message: Message) => void,
  onUpdate: (message: Message) => void,
  onDelete: (messageId: string) => void
): () => void {
  const channel = supabase
    .channel(`project-messages-${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onUpdate(payload.new as Message);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onDelete((payload.old as { id: string }).id);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Delete a message.
 */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    console.error('[messageService] deleteMessage failed:', error.message);
    throw new Error(friendlyMessageError('Failed to delete message', error.message));
  }
}