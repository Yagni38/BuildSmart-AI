import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types/project';
import { sendChatbotMessage, ChatMessage } from '../services/aiChatbotService';

interface AIChatbotProps {
  project?: Project | null;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ project }) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userRole = (profile?.role?.toLowerCase() as 'customer' | 'contractor' | 'admin') ?? 'customer';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatbotMessage(text, messages, project ?? null, userRole);
      if (response.success && response.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.reply! }]);
      } else {
        setError(response.error ?? 'The AI assistant could not respond. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  const quickQuestions = project
    ? ['What is my project status?', 'What is the current construction stage?', 'Give me a project summary.', 'What should I expect next?']
    : ['How do I start a new project?', 'What are the typical construction stages?', 'How do I find a contractor?', 'What is the typical budget for a villa?'];

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-terracotta hover:bg-terracotta-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
          title="Ask BuildSmart AI"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-white border border-neutral-200 rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="bg-terracotta text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <div>
                <h3 className="font-bold text-sm">BuildSmart AI</h3>
                <p className="text-[10px] opacity-80">Project assistant</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-terracotta-600 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-warmbeige-50/30">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Sparkles className="w-8 h-8 text-terracotta mx-auto mb-3" />
                <p className="text-sm font-bold text-neutral-700">Hi! I'm BuildSmart AI</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {project ? `Ask me anything about "${project.name}" or construction in general.` : 'Ask me anything about your construction project.'}
                </p>
                <div className="mt-4 space-y-2">
                  {quickQuestions.map((q) => (
                    <button key={q} onClick={() => handleQuickQuestion(q)} className="block w-full text-left px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 hover:border-terracotta hover:bg-terracotta-50 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-terracotta text-white rounded-br-md' : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-md'}`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-200 px-3 py-2 rounded-2xl rounded-bl-md">
                  <Loader2 className="w-4 h-4 text-terracotta animate-spin" />
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-800">{error}</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100">
            <p className="text-[9px] text-neutral-400 text-center">AI assistant — not professional advice. Verify important decisions with qualified professionals.</p>
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-neutral-100 flex items-center gap-2">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Ask about your project..." disabled={loading} className="flex-grow px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-xs text-neutral-800 disabled:opacity-50" />
            <button type="submit" disabled={loading || !inputText.trim()} className="p-2 bg-terracotta hover:bg-terracotta-600 disabled:opacity-50 text-white rounded-xl transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}