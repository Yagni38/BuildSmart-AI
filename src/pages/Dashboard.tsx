import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building, DollarSign, Calendar, MessageSquare, Image as ImageIcon, 
  CloudRain, ShieldAlert, Sparkles, TrendingUp, ArrowRight, UserCheck
} from 'lucide-react';
import { Contractor, Milestone, Message } from '../mockData';
import { AiInsight } from '../components/AiInsight';

interface DashboardProps {
  contractor: Contractor | null;
  milestones: Milestone[];
  messages: Message[];
  onNavigate: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  contractor,
  milestones,
  messages,
  onNavigate
}) => {
  // Calculations
  const currentMilestone = milestones.find(m => m.status === 'in-progress') || milestones.find(m => m.status === 'upcoming');
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const progressPercent = Math.round((milestones.reduce((acc, curr) => acc + curr.completionPercent, 0) / (milestones.length * 100)) * 100);

  const totalBudget = 42.5; // Lakhs
  const spentAmount = milestones.reduce((acc, m) => acc + m.expenses, 0);
  const remainingBudget = totalBudget - spentAmount;

  const latestPhotos = milestones
    .flatMap(m => m.photos)
    .slice(0, 3);

  const latestMessage = messages[messages.length - 1];

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Project Dashboard</h1>
          <p className="text-neutral-500 font-light mt-1">
            Real-time status of your modern villa at <strong className="font-semibold text-neutral-700">Indiranagar plot #48B</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active Build Phase
          </span>
          <span className="text-sm font-semibold text-neutral-500">ID: BS-9082</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column - Project Progress & Costs */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Project Cost & Progress Summary Card */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-8 shadow-premium relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-warmbeige-100 to-transparent opacity-40 rounded-full blur-2xl pointer-events-none" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Progress Circle & Text */}
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Construction Progress</span>
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle cx="40" cy="40" r="34" className="stroke-neutral-100 fill-none" strokeWidth="6" />
                      <circle cx="40" cy="40" r="34" className="stroke-terracotta fill-none" strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 34}
                        strokeDashoffset={2 * Math.PI * 34 * (1 - progressPercent / 100)}
                        strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-base font-extrabold text-neutral-900">{progressPercent}%</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-950 text-lg">Slab Casting</h3>
                    <p className="text-xs text-neutral-400">Milestone {completedCount + 1} of {milestones.length}</p>
                  </div>
                </div>
              </div>

              {/* Budget / Expenses */}
              <div className="space-y-2 border-y md:border-y-0 md:border-x border-neutral-100 py-4 md:py-0 md:px-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Cost Summary</span>
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-500">Total Budget:</span>
                    <span className="text-base font-bold text-neutral-800">₹{totalBudget.toFixed(1)} Lakhs</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-500">Spent:</span>
                    <span className="text-base font-bold text-red-500">₹{spentAmount.toFixed(1)} Lakhs</span>
                  </div>
                  <div className="flex justify-between items-baseline border-t border-dashed border-neutral-100 pt-1.5 mt-1">
                    <span className="text-sm text-neutral-900 font-semibold">Remaining:</span>
                    <span className="text-base font-extrabold text-emerald-600">₹{remainingBudget.toFixed(1)} Lakhs</span>
                  </div>
                </div>
              </div>

              {/* Active Contractor */}
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">Contractor</span>
                  {contractor ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-terracotta-50 text-terracotta flex items-center justify-center font-bold text-sm">
                        {contractor.company.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-800 text-sm">{contractor.company}</h4>
                        <p className="text-xs text-neutral-500">{contractor.owner}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-neutral-500 italic">No contractor hired yet.</p>
                      <button 
                        onClick={() => onNavigate('marketplace')}
                        className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5"
                      >
                        Hire Marketplace Winner <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-xs text-neutral-400 mt-2">
                  Response Time: <span className="font-semibold text-neutral-700">{contractor?.responseTime || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Update & Upcoming Milestone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Upcoming Milestone */}
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-3">Next Phase Milestone</span>
              {currentMilestone ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-neutral-800 text-base">{currentMilestone.name}</h4>
                    <span className="text-xs bg-terracotta-50 text-terracotta font-semibold px-2 py-0.5 rounded">
                      {currentMilestone.completionPercent}% Complete
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed font-light">
                    {currentMilestone.comments}
                  </p>
                  <div className="flex items-center gap-4 text-xs font-medium text-neutral-500 pt-2 border-t border-neutral-100">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-terracotta" /> Target: {currentMilestone.targetDate}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-400 italic">All milestones completed.</p>
              )}
            </div>

            {/* Today's Update */}
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-3">Today's Site Update</span>
              <div className="space-y-3">
                <p className="text-sm text-neutral-700 font-medium leading-relaxed">
                  "Laying electrical conduits on the shuttering steel mesh for first-floor roof slab. Ready for slab casting postponed to next Tuesday due to rain prediction."
                </p>
                <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold pt-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Logged by Project Supervisor at 4:15 PM
                </div>
              </div>
            </div>
          </div>

          {/* Recent Progress Photos */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Recent Progress Photos</span>
              <button onClick={() => onNavigate('tracker')} className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5">
                View Tracker <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {latestPhotos.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-video group cursor-pointer border border-neutral-100">
                  <img src={url} alt={`Site progress ${i+1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
              ))}
              {latestPhotos.length === 0 && (
                <p className="text-sm text-neutral-400 col-span-3 italic text-center py-4">No photos uploaded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Alerts & Activity */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Smart Alerts Center */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 tracking-wide uppercase border-b border-neutral-100 pb-3 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-terracotta animate-pulse" /> Active Smart Alerts
            </h3>

            {/* Weather Alert */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 flex gap-3">
              <CloudRain className="w-5.5 h-5.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-xs">Heavy Rain Warning (Indiranagar)</h4>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Aug 9-10 forecast displays high precipitation risk. Delay casting concrete slab to Aug 11 to avoid structural honeycombing.
                </p>
              </div>
            </div>

            {/* Material Alert */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 flex gap-3">
              <TrendingUp className="w-5.5 h-5.5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-900 text-xs">Steel Price Hike Imminent</h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  Tata Steel and JSW are increasing regional distribution index prices by 4.2% next Tuesday. 
                </p>
                <button 
                  onClick={() => onNavigate('materials')}
                  className="text-xs text-rose-800 font-semibold hover:underline mt-1.5 flex items-center gap-0.5"
                >
                  Pre-Book Materials Now <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Messages Card */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium flex flex-col justify-between h-[300px]">
            <div>
              <div className="flex justify-between items-center mb-4 border-b border-neutral-100 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Direct Chat</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-terracotta-50 text-terracotta">
                  Rajesh S. (Active)
                </span>
              </div>

              {latestMessage ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-terracotta-50 text-terracotta flex items-center justify-center font-bold text-xs">
                      {latestMessage.sender === 'contractor' ? 'C' : 'U'}
                    </div>
                    <div className="p-3 rounded-2xl bg-neutral-50 text-neutral-700 text-xs leading-relaxed max-w-[85%]">
                      {latestMessage.text}
                      {latestMessage.attachment && (
                        <div className="mt-2 p-2 rounded bg-white border border-neutral-200 flex items-center gap-1.5 font-medium text-neutral-800">
                          <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1 py-0.5 rounded">PDF</span>
                          <span className="truncate">{latestMessage.attachment.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 block text-right pr-2">{latestMessage.time}</span>
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic">No messages yet.</p>
              )}
            </div>

            <button 
              onClick={() => onNavigate('chat')}
              className="w-full py-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold border border-neutral-200/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4 text-neutral-500" /> Open Full Workspace Chat
            </button>
          </div>

        </div>

      </div>

      {/* AI Recommendation on page base */}
      <AiInsight
        insight="Daily logs confirm AAC Blocks are successfully placed for partition walls, lowering the load and concrete volumes."
        recommendation="Verify electrical conduit layout designs in the AI Design Studio before the concrete slab is cast next Tuesday."
        confidenceScore={98}
        impactValue="₹1,50,000 Potential Savings"
      />
    </div>
  );
};
