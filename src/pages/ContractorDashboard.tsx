import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building, DollarSign, Users, FileText, Camera, 
  Sparkles, Check, Send, ArrowUpRight, Award, ClipboardList 
} from 'lucide-react';
import { AiInsight } from '../components/AiInsight';

export const ContractorDashboard: React.FC = () => {
  const [logText, setLogText] = useState("");
  const [logStatus, setLogStatus] = useState("Roof Slab Shuttering");
  const [photoCount, setPhotoCount] = useState(2);

  const handlePostUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logText.trim()) return;
    alert(`Supervisor Daily Log posted successfully: "${logText}" with ${photoCount} photo uploads.`);
    setLogText("");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Contractor Workspace</h1>
          <p className="text-neutral-500 font-light mt-1">
            Managing <strong className="font-semibold text-neutral-700">3 Active Sites</strong> • Welcome back, Apex Builders Admin.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 font-bold">Billing Verification:</span>
          <span className="text-sm font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
            95% On-Time Completion Rate
          </span>
        </div>
      </div>

      {/* Contractor Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Gross Revenue</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">₹1.48 Cr</div>
          <p className="text-[10px] text-emerald-600 font-semibold mt-1">₹32L Pending escrow release</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Active Sites</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">3 Projects</div>
          <p className="text-[10px] text-neutral-500 font-semibold mt-1">2 residential, 1 commercial</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Active Workers On-Site</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">48 Artisans</div>
          <p className="text-[10px] text-neutral-500 font-semibold mt-1">Supervised by 3 engineers</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Escrow Released</span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-2">₹1.16 Cr</div>
          <p className="text-[10px] text-neutral-400 font-medium mt-1">Approved by client photo audits</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Project Logs Creator */}
        <div className="lg:col-span-7 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
            <Camera className="w-5 h-5 text-terracotta" /> Post Daily Supervisor Log
          </h2>

          <form onSubmit={handlePostUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Select Active Project</label>
                <select className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 bg-white">
                  <option>Villas of Indiranagar (Yagni Y.)</option>
                  <option>Greenfield Commercial Hub</option>
                  <option>Koramangala Custom Penthouse</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Active Milestone Segment</label>
                <input
                  type="text"
                  value={logStatus}
                  onChange={e => setLogStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Site Progress Log Description</label>
              <textarea
                value={logText}
                onChange={e => setLogText(e.target.value)}
                rows={3}
                placeholder="Describe current concrete castings, steel layout mesh, electrical conduit progress, or rain delays..."
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 focus:outline-none focus:border-terracotta"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoCount(prev => Math.min(prev + 1, 6))}
                  className="px-3.5 py-2 border border-neutral-200 hover:border-neutral-400 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                >
                  <Camera className="w-4 h-4 text-neutral-400" /> Add Photo ({photoCount})
                </button>
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Send className="w-3.5 h-3.5" /> Submit Log Update
              </button>
            </div>
          </form>
        </div>

        {/* Right: Pending quotations & analytics chart */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Pending client quotations</h3>
            
            <div className="space-y-3">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-neutral-800 text-xs">Indiranagar Plumbing Quote</h4>
                  <span className="text-[10px] text-neutral-400">Sent Today • ₹1,42,000</span>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 animate-pulse">
                  Awaiting Approval
                </span>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-neutral-800 text-xs">Commercial Glazing Tender</h4>
                  <span className="text-[10px] text-neutral-400">Sent Aug 04 • ₹4,80,000</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Approved
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Weekly Labor Performance</h3>
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex justify-between text-xs text-neutral-700 font-bold">
                <span>Indiranagar Site Efficiency</span>
                <span>94%</span>
              </div>
              <div className="w-full bg-neutral-50 h-2 rounded-full overflow-hidden border border-neutral-100">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "94%" }} />
              </div>

              <div className="flex justify-between text-xs text-neutral-700 font-bold mt-2">
                <span>Koramangala Site Efficiency</span>
                <span>88%</span>
              </div>
              <div className="w-full bg-neutral-50 h-2 rounded-full overflow-hidden border border-neutral-100">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: "88%" }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      <AiInsight
        insight="Work efficiency stats at the Indiranagar project are sitting 6% above regional general contractor averages due to synchronized material supply chain arrivals."
        recommendation="Finalize local plumbing invoices inside the direct messages view to secure bulk piping discounts before prices cycle next Tuesday."
        confidenceScore={98}
        impactValue="Optimal Delivery Track"
      />
    </div>
  );
};
