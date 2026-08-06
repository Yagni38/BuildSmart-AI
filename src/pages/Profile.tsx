import React from 'react';
import { motion } from 'framer-motion';
import { User, Settings, ShieldCheck, CreditCard, Star, Bell } from 'lucide-react';
import { AiInsight } from '../components/AiInsight';

export const Profile: React.FC = () => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Account & Security</h1>
        <p className="text-neutral-500 font-light mt-1">
          Manage payment credentials, security protocols, settings, and contractor ratings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        
        {/* Left Settings Sidebar */}
        <div className="md:col-span-1 bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-premium space-y-2">
          <button className="w-full text-left p-3 rounded-xl bg-terracotta-50/50 border border-terracotta-100 text-terracotta font-bold text-xs flex items-center gap-2">
            <User className="w-4 h-4" /> Personal Information
          </button>
          <button className="w-full text-left p-3 rounded-xl text-neutral-500 hover:bg-neutral-50 font-semibold text-xs flex items-center gap-2 transition-colors">
            <CreditCard className="w-4 h-4" /> Billing & Payments
          </button>
          <button className="w-full text-left p-3 rounded-xl text-neutral-500 hover:bg-neutral-50 font-semibold text-xs flex items-center gap-2 transition-colors">
            <Bell className="w-4 h-4" /> System Notifications
          </button>
          <button className="w-full text-left p-3 rounded-xl text-neutral-500 hover:bg-neutral-50 font-semibold text-xs flex items-center gap-2 transition-colors">
            <Settings className="w-4 h-4" /> Account Settings
          </button>
        </div>

        {/* Right Settings Details */}
        <div className="md:col-span-2 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3">
            Personal Information
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-neutral-400 font-bold uppercase block">Full Name</span>
              <strong className="text-sm text-neutral-800 font-semibold">Yagni Yeruva</strong>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 font-bold uppercase block">Email Address</span>
              <strong className="text-sm text-neutral-800 font-semibold">yagni.yeruva@buildsmart.ai</strong>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 font-bold uppercase block">Phone Number</span>
              <strong className="text-sm text-neutral-800 font-semibold">+91 90876 54321</strong>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 font-bold uppercase block">Location</span>
              <strong className="text-sm text-neutral-800 font-semibold">Bengaluru, Karnataka</strong>
            </div>
          </div>

          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 pt-4">
            Escrow Account Status
          </h2>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <div>
                <h4 className="font-bold text-neutral-800 text-xs">Escrow Funding Active</h4>
                <p className="text-[10px] text-neutral-500 mt-0.5 leading-normal">
                  SBI Escrow account #9082 linked. Funds released only upon photo verification of milestones.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/50 px-2.5 py-1 rounded">
              Verified
            </span>
          </div>
        </div>

      </div>

      <AiInsight
        insight="Your payments escrow link is configured with a double-sign verification security check."
        recommendation="Enable SMS milestones triggers to immediately release vendor cement payouts once daily supervisor photo logs are approved."
        confidenceScore={99}
        impactValue="Secure Escrow Setup"
      />
    </div>
  );
};
