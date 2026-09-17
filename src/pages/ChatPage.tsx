import React, { useEffect, useState } from 'react';
import {
  Send, Phone, Video, MoreVertical, Image as ImageIcon,
  FileText, Mic, Paperclip, CheckCheck, FileDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Message } from '../mockData';
import { AiInsight } from '../components/AiInsight';
import { useAuth } from '../context/AuthContext';
import {
  getMessagesByProject,
  sendMessage,
  markProjectMessagesRead,
  subscribeToProjectMessages,
} from '../services/messageService';
import { getProjectsByCustomer } from '../services/projectService';
import type { Message as DbMessage } from '../types';
import type { Project } from '../types/project';
import { AIChatbot } from '../components/AIChatbot';

interface ChatPageProps {
  /** The REAL project UUID whose chat thread should be shown (from App state). */
  projectId?: string | null;
}

/**
 * Map a live `messages` row onto the chat view-model the existing UI renders.
 * The live table has NO attachment_type/attachment_name columns (verified
 * 2026-09-07), so an attachment filename is derived from its URL and the
 * existing PDF-style attachment block is reused. Rows without an attachment
 * render as plain messages.
 */
function dbRowToChatMessage(row: DbMessage, currentUserId?: string): Message {
  let attachment: Message['attachment'] = undefined;
  if (row.attachment_url) {
    const fileName =
      decodeURIComponent(row.attachment_url.split('/').pop() ?? '').split('?')[0] ||
      'Attachment';
    attachment = { type: 'pdf', name: fileName, url: row.attachment_url };
  }
  return {
    id: row.id,
    sender:
      currentUserId && row.sender_id === currentUserId ? 'user' : 'contractor',
    text: row.message ?? '',
    time: new Date(row.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    attachment,
    // Phase 9: read status + sender/receiver metadata
    read: !!row.read_at,
    senderId: row.sender_id,
    createdAt: row.created_at,
  };
}

export const ChatPage: React.FC<ChatPageProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  // The resolved REAL project this chat belongs to (prop → latest own project).
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId ?? null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Load the selected project details for AI chatbot context
  useEffect(() => {
    if (!activeProjectId) {
      setSelectedProject(null);
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('id', activeProjectId)
          .maybeSingle();
        setSelectedProject(data as Project | null);
      } catch {
        setSelectedProject(null);
      }
    })();
  }, [activeProjectId]);

  // 1) Resolve the chat thread's project: explicit prop first, otherwise the
  //    customer's most recent real project (same convention as the dashboard).
  useEffect(() => {
    let isActive = true;
    setSendError(null);
    setLoadError(null);

    if (projectId) {
      setActiveProjectId(projectId);
      return () => {
        isActive = false;
      };
    }

    if (!user) {
      setActiveProjectId(null);
      return () => {
        isActive = false;
      };
    }

    getProjectsByCustomer(user.id)
      .then((projects) => {
        if (!isActive) return;
        setActiveProjectId(projects.length > 0 ? projects[0].id : null);
      })
      .catch((err) => {
        if (!isActive) return;
        console.warn('[ChatPage] could not resolve active project:', err);
        setActiveProjectId(null);
      });

    return () => {
      isActive = false;
    };
  }, [projectId, user]);

  // 2) Load the live thread + subscribe to Realtime whenever the resolved
  //    project changes. Also marks unread messages as read on open.
  useEffect(() => {
    let isActive = true;
    if (!activeProjectId) {
      setMessages([]);
      setLoading(false);
      return () => {
        isActive = false;
      };
    }
    setLoading(true);
    setLoadError(null);
    getMessagesByProject(activeProjectId)
      .then((rows) => {
        if (isActive) setMessages(rows.map((row) => dbRowToChatMessage(row, user?.id)));
      })
      .catch((err) => {
        if (!isActive) return;
        // Never crash the page — show the message inline and keep the UI usable.
        console.warn('[ChatPage] message load failed:', err);
        setMessages([]);
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    // Mark all messages in this project as read for the current user.
    if (user) {
      void markProjectMessagesRead(activeProjectId).catch(() => {});
    }

    // Subscribe to Realtime for live updates (INSERT / UPDATE / DELETE).
    const unsubscribe = subscribeToProjectMessages(
      activeProjectId,
      (newMsg) => {
        if (!isActive) return;
        setMessages((prev) => {
          // Avoid duplicates from our own INSERT (already added by handleSendMessage).
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, dbRowToChatMessage(newMsg, user?.id)];
        });
      },
      (updatedMsg) => {
        if (!isActive) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? dbRowToChatMessage(updatedMsg, user?.id) : m))
        );
      },
      (deletedId) => {
        if (!isActive) return;
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [activeProjectId, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !activeProjectId || !user) return;

    setSending(true);
    setSendError(null);
    try {
      // Resolve the receiver: the other participant in this project.
      // For a customer, it's the contractor; for a contractor, it's the customer.
      let receiverId: string | null = null;
      try {
        const { data: projectRow } = await supabase
          .from('projects')
          .select('customer_id, contractor_id')
          .eq('id', activeProjectId)
          .maybeSingle();
        if (projectRow) {
          receiverId =
            projectRow.customer_id === user.id
              ? projectRow.contractor_id
              : projectRow.customer_id;
        }
      } catch {
        // If we can't resolve the receiver, send without one (broadcast).
      }

      // Real persistence into public.messages (project_id, sender_id, message).
      const row = await sendMessage({
        project_id: activeProjectId,
        sender_id: user.id,
        receiver_id: receiverId,
        message: text,
        attachment_url: null,
      });
      setMessages((prev) => [...prev, dbRowToChatMessage(row, user.id)]);
      setInputText("");
    } catch (err) {
      // RLS/permission failures land here with a friendly message from the
      // service. The page stays fully usable and the draft text is kept.
      console.warn('[ChatPage] sendMessage failed:', err);
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const triggerUploadMock = (type: string) => {
    alert(`Mock Uploading ${type} file from local storage...`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Project Communications</h1>
        <p className="text-neutral-500 font-light mt-1">
          Direct secure communications channel with your contractor, architect, and supply yards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Sidebar contacts */}
        <div className="lg:col-span-4 bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-premium space-y-4">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Active Conversations</span>
          
          <div className="space-y-2">
            <div className="p-3 bg-terracotta-50/50 border border-terracotta-100 rounded-2xl flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 text-terracotta flex items-center justify-center font-extrabold text-sm">
                  R
                </div>
                <div>
                  <h4 className="font-bold text-neutral-800 text-sm">Rajesh S. (Contractor)</h4>
                  <p className="text-xs text-neutral-400 truncate w-36">Here is the quotation invoice...</p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-terracotta animate-pulse" />
            </div>

            <div className="p-3 hover:bg-neutral-50 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors text-neutral-400">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center font-bold text-sm">
                A
              </div>
              <div>
                <h4 className="font-bold text-neutral-700 text-sm">Anjali Rao (Architect)</h4>
                <p className="text-xs text-neutral-400 truncate w-36">Render adjustments complete.</p>
              </div>
            </div>

            <div className="p-3 hover:bg-neutral-50 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors text-neutral-400">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center font-bold text-sm">
                U
              </div>
              <div>
                <h4 className="font-bold text-neutral-700 text-sm">UltraTech Depot</h4>
                <p className="text-xs text-neutral-400 truncate w-36">Cement supply invoice sent.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Chat Window */}
        <div className="lg:col-span-8 bg-white border border-neutral-200/80 rounded-3xl shadow-premium overflow-hidden flex flex-col justify-between h-[520px]">
          
          {/* Header */}
          <div className="bg-neutral-50/80 px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-terracotta text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                R
              </div>
              <div>
                <h4 className="font-bold text-neutral-800 text-sm">Rajesh Sharma</h4>
                <span className="text-[10px] text-emerald-600 font-bold block">Online • Apex Builders Supervisor</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-neutral-400">
              <button className="hover:text-neutral-700 transition-colors" onClick={() => alert("Simulating Phone Call...")}>
                <Phone className="w-4.5 h-4.5" />
              </button>
              <button className="hover:text-neutral-700 transition-colors" onClick={() => alert("Simulating Video Call...")}>
                <Video className="w-4.5 h-4.5" />
              </button>
              <button className="hover:text-neutral-700 transition-colors">
                <MoreVertical className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages viewport */}
          <div className="flex-grow p-6 overflow-y-auto space-y-4 bg-warmbeige-50/30">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 rounded-full border-4 border-terracotta/20 border-t-terracotta animate-spin" />
              </div>
            )}

            {!loading && loadError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800">
                {loadError}
              </div>
            )}

            {!loading && !loadError && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center mb-3">
                  <Send className="w-5 h-5 text-terracotta" />
                </div>
                <p className="text-sm font-bold text-neutral-700">No messages yet</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                  {activeProjectId
                    ? 'Start the conversation — messages are stored securely with this project.'
                    : 'Create a project first — your secure contractor chat opens once a project exists.'}
                </p>
              </div>
            )}

            {!loading && !loadError && messages.map(msg => {
              const isMe = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex items-end gap-2.5 ${isMe ? "justify-end" : "justify-start"}`}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-lg bg-terracotta-50 text-terracotta flex items-center justify-center font-bold text-xs flex-shrink-0">
                      R
                    </div>
                  )}
                  
                  <div className="space-y-1 max-w-[70%]">
                    <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      isMe 
                        ? "bg-neutral-900 text-white rounded-br-none" 
                        : "bg-white text-neutral-800 rounded-bl-none border border-neutral-200/60"
                    }`}>
                      {msg.text}

                      {/* Render attachments */}
                      {msg.attachment && (
                        <div className={`mt-3 p-3 rounded-xl flex items-center justify-between gap-3 border ${
                          isMe ? "bg-neutral-800 border-neutral-700" : "bg-neutral-50 border-neutral-200"
                        }`}>
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-terracotta" />
                            <div>
                              <div className="font-bold text-xs truncate w-36">{msg.attachment.name}</div>
                              <span className="text-[9px] opacity-60">PDF Invoice • 412 KB</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => alert(`Downloading document: ${msg.attachment?.name}`)}
                            className="p-1 rounded bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-end gap-1 px-1">
                      <span className="text-[9px] text-neutral-400 font-medium">{msg.time}</span>
                      {isMe && msg.read ? (
                        <span title="Read">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                        </span>
                      ) : isMe && !msg.read ? (
                        <span title="Unread">
                          <CheckCheck className="w-3.5 h-3.5 text-neutral-300" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Send failure notice — non-blocking, the thread stays usable */}
          {sendError && (
            <div className="mx-4 mb-1 p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
              {sendError}
            </div>
          )}

          {/* Chat Message Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-neutral-100 flex items-center gap-3">
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => triggerUploadMock('Image')}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Share Image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button 
                type="button"
                onClick={() => triggerUploadMock('PDF')}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Share Document"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button 
                type="button"
                onClick={() => triggerUploadMock('Audio')}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Record Voice"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Write your message here..."
              className="flex-grow px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm text-neutral-800"
            />

            <button 
              type="submit"
              className="p-3 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl shadow-premium transition-all"
            >
              <Send className="w-4 h-4 fill-current" />
            </button>
          </form>
        </div>

      </div>

      <AiInsight
        insight="The plumbing quote attachment 'Plumbing_Fixture_Invoice_P3.pdf' shared by Rajesh has been audited by BuildSmart."
        recommendation="Material prices match regional wholesale benchmarks within 1.8%. We recommend approving the quote for immediate phase 3 execution."
        confidenceScore={98}
        impactValue="Pricing Verified Safe"
      />

      {/* Phase 12: AI Chatbot assistant */}
      <AIChatbot project={selectedProject} />
    </div>
  );
};
