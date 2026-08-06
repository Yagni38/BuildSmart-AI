import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Building, ShieldCheck, AlertCircle, TrendingUp, 
  Check, X, FileText, Activity, ShieldAlert, Sparkles 
} from 'lucide-react';
import { AiInsight } from '../components/AiInsight';

export const AdminDashboard: React.FC = () => {
  const [verificationRequests, setVerificationRequests] = useState([
    { id: 'v1', company: 'Royal Foundations Ltd', owner: 'Suresh Patil', rating: 4.5, city: 'Mysuru', documents: 'License_Class_A.pdf' },
    { id: 'v2', company: 'Prism Electricals', owner: 'Mahesh Gowda', rating: 4.8, city: 'Bengaluru', documents: 'Electrical_License_B.pdf' }
  ]);

  const handleVerify = (id: string, action: 'approve' | 'reject') => {
    alert(`Contractor ID ${id} has been ${action === 'approve' ? 'Approved & Issued Verified Badge' : 'Rejected'}.`);
    setVerificationRequests(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-terracotta" /> Platform Control Center
          </h1>
          <p className="text-neutral-500 font-light mt-1">
            BuildSmart AI Administrative Command. Monitor escrow volumes, dispute resolution, and vendor verification.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
          Platform Status: <span className="text-emerald-400">Nominal</span>
        </div>
      </div>

      {/* Admin metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Total Platform Volume</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">₹12.4 Cr</div>
          <p className="text-[10px] text-emerald-600 font-semibold mt-1">Gross transactional escrows</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Registered Users</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">2,480 Users</div>
          <p className="text-[10px] text-neutral-500 font-semibold mt-1">320 Homeowners active this week</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Verified Contractors</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">423 Firms</div>
          <p className="text-[10px] text-neutral-500 font-semibold mt-1">12 Pending registration</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Platform Commisssion</span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-2">₹24.8 Lakhs</div>
          <p className="text-[10px] text-neutral-400 font-medium mt-1">Monthly recurring subscriptions</p>
        </div>
      </div>

      {/* Verification requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Verification queue */}
        <div className="lg:col-span-8 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> Pending Contractor Verifications
          </h2>

          <div className="divide-y divide-neutral-100">
            {verificationRequests.map(req => (
              <div key={req.id} className="py-4 flex flex-wrap items-center justify-between gap-4 font-semibold text-neutral-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-50 text-neutral-700 flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">{req.company}</h3>
                    <p className="text-xs text-neutral-400 font-light leading-relaxed mt-0.5">
                      Owner: <strong className="font-semibold text-neutral-600">{req.owner}</strong> | City: <strong className="font-semibold text-neutral-600">{req.city}</strong> | Rating: <strong className="font-semibold text-neutral-600">{req.rating}★</strong>
                    </p>
                    <button 
                      onClick={() => alert(`Reviewing credential files: ${req.documents}`)}
                      className="text-[10px] text-terracotta hover:underline mt-1.5 flex items-center gap-1 font-semibold"
                    >
                      <FileText className="w-3.5 h-3.5" /> Inspect Credential {req.documents}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerify(req.id, 'reject')}
                    className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-neutral-500 hover:text-red-500"
                    title="Reject"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleVerify(req.id, 'approve')}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                  >
                    <Check className="w-4 h-4 text-emerald-400" /> Verify & Authorize
                  </button>
                </div>
              </div>
            ))}

            {verificationRequests.length === 0 && (
              <p className="text-sm text-neutral-400 italic text-center py-6">All contractor verification requests completed.</p>
            )}
          </div>
        </div>

        {/* Right Side: Active Disputes */}
        <div className="lg:col-span-4 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Active Dispute Filings</h3>
          
          <div className="space-y-3">
            <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-neutral-800 text-xs">Milestone 4 Dispute</h4>
                <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
                  Koramangala project: client flagged electrical pipe count. Escrow lock triggered.
                </p>
                <button 
                  onClick={() => alert("Initiating mediator dialogue session...")}
                  className="text-[9px] text-red-700 font-bold hover:underline mt-1.5 block"
                >
                  Mediate Escrow Disbursal
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <AiInsight
        insight="Operational verification queues are completely processed. Server security sweeps completed."
        recommendation="Verify security flags on the escrow API before the evening transaction ledger batch begins."
        confidenceScore={99}
        impactValue="0 Security Flags"
      />
    </div>
  );
};
