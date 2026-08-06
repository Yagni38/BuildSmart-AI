import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Send, Phone, Video, MoreVertical, Image as ImageIcon, 
  FileText, Mic, Paperclip, CheckCheck, FileDown, Sparkles 
} from 'lucide-react';
import { Message, INITIAL_CHAT } from '../mockData';
import { AiInsight } from '../components/AiInsight';

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_CHAT);
  const [inputText, setInputText] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: Message = {
      id: String(messages.length + 1),
      sender: 'user',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMsg]);
    setInputText("");

    // Simulate contractor replies after 2 seconds
    setTimeout(() => {
      const contractorReply: Message = {
        id: String(messages.length + 2),
        sender: 'contractor',
        text: "Got it! I will update the supervisor and send over the updated concreting schedule. Thank you.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, contractorReply]);
    }, 2000);
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
            {messages.map(msg => {
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
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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
    </div>
  );
};
