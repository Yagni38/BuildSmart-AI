import React from 'react';
import {
  Building, Calendar, MessageSquare, Image as ImageIcon,
  ArrowRight, UserCheck, MapPin, Layers, Activity,
  Calculator, Briefcase, FileText, Sparkles, TrendingUp,
} from 'lucide-react';
import {
  Contractor, Milestone, Message, BudgetItem,
  CustomerProject, SiteUpdate, WeatherAlert,
  DEFAULT_CUSTOMER_PROJECT, DEFAULT_SITE_UPDATE,
  DEFAULT_WEATHER_ALERT, DEFAULT_CUSTOMER_NAME,
  INITIAL_BUDGET, INITIAL_CONTRACTORS,
} from '../mockData';
import { AiInsight } from '../components/AiInsight';
import { PremiumCard } from '../components/PremiumCard';
import { ProgressCircle } from '../components/ProgressCircle';
import { QuickActionCard } from '../components/QuickActionCard';
import { WeatherAlertCard } from '../components/WeatherAlertCard';
import { ExpenseSummaryChart } from '../components/ExpenseSummaryChart';

interface CustomerDashboardProps {
  contractor?: Contractor | null;
  milestones?: Milestone[];
  messages?: Message[];
  project?: CustomerProject | null;
  budgetItems?: BudgetItem[];
  siteUpdate?: SiteUpdate;
  weatherAlert?: WeatherAlert;
  customerName?: string;
  onNavigate: (page: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  contractor,
  milestones = [],
  messages = [],
  project,
  budgetItems = INITIAL_BUDGET,
  siteUpdate = DEFAULT_SITE_UPDATE,
  weatherAlert = DEFAULT_WEATHER_ALERT,
  customerName = DEFAULT_CUSTOMER_NAME,
  onNavigate,
}) => {
  const activeProject = project ?? DEFAULT_CUSTOMER_PROJECT;
  const activeContractor = contractor ?? INITIAL_CONTRACTORS[0];

  const currentMilestone =
    milestones.find(m => m.status === 'in-progress') ??
    milestones.find(m => m.status === 'upcoming');
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const progressPercent =
    milestones.length > 0
      ? Math.round(
          (milestones.reduce((acc, m) => acc + m.completionPercent, 0) /
            (milestones.length * 100)) *
            100
        )
      : 46;

  const totalBudget = activeProject.totalBudget;
  const spentAmount =
    milestones.length > 0
      ? milestones.reduce((acc, m) => acc + m.expenses, 0)
      : 19.5;
  const remainingBudget = totalBudget - spentAmount;

  const latestPhotos = milestones.flatMap(m => m.photos).slice(0, 3);
  const fallbackPhotos = [
    'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80',
  ];
  const displayPhotos = latestPhotos.length > 0 ? latestPhotos : fallbackPhotos;

  const recentMessages = messages.slice(-2);
  const fallbackMessages: Message[] = [
    {
      id: 'fb1',
      sender: 'contractor',
      text: 'Shuttering for the first-floor roof slab is complete. Please review the electrical conduit layout.',
      time: '10:35 AM',
    },
    {
      id: 'fb2',
      sender: 'contractor',
      text: 'Plumbing fixture invoice attached for your approval.',
      time: '10:36 AM',
      attachment: { type: 'pdf', name: 'Plumbing_Fixture_Invoice_P3.pdf' },
    },
  ];
  const displayMessages = recentMessages.length > 0 ? recentMessages : fallbackMessages;

  const quickActions = [
    {
      icon: Activity,
      title: 'Progress Tracker',
      description: 'View milestone timeline, photos, and AI delay predictions.',
      page: 'tracker',
      accent: 'terracotta' as const,
    },
    {
      icon: MessageSquare,
      title: 'Contractor Chat',
      description: 'Message your builder, approve quotes, and share site updates.',
      page: 'chat',
      accent: 'emerald' as const,
    },
    {
      icon: Briefcase,
      title: 'Contractor Marketplace',
      description: 'Browse verified builders or compare shortlisted contractors.',
      page: 'marketplace',
      accent: 'neutral' as const,
    },
    {
      icon: Calculator,
      title: 'Budget Estimator',
      description: 'Review cost breakdowns and AI saving recommendations.',
      page: 'budget',
      accent: 'terracotta' as const,
    },
    {
      icon: Layers,
      title: 'Material Estimator',
      description: 'Track cement, steel, and finishing material quantities.',
      page: 'materials',
      accent: 'neutral' as const,
    },
    {
      icon: FileText,
      title: 'Project Reports',
      description: 'Download progress reports and escrow payment summaries.',
      page: 'reports',
      accent: 'emerald' as const,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-sm text-neutral-400 font-medium mb-1">
            Welcome back, <span className="text-neutral-700 font-semibold">{customerName}</span>
          </p>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
            Customer Dashboard
          </h1>
          <p className="text-neutral-500 font-light mt-1">
            Your construction command center — track progress, costs, and site activity in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeProject.status}
          </span>
          <span className="text-sm font-semibold text-neutral-500">ID: {activeProject.id}</span>
        </div>
      </div>

      {/* Current Project Card */}
      <PremiumCard glow className="p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center flex-shrink-0">
              <Building className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Current Project
              </span>
              <h2 className="text-xl font-extrabold text-neutral-950 mt-0.5">{activeProject.name}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-terracotta" />
                  {activeProject.location}
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-terracotta" />
                  {activeProject.buildingType}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-terracotta" />
                  Started {activeProject.startDate}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('tracker')}
            className="px-5 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-premium hover:shadow-premium-hover self-start md:self-center"
          >
            View Full Tracker <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </PremiumCard>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-8">
          {/* Progress + Budget + Contractor Summary */}
          <PremiumCard glow className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Construction Progress
                </span>
                <ProgressCircle
                  percent={progressPercent}
                  label={currentMilestone?.name ?? 'Roof Slab & Concreting'}
                  sublabel={`Milestone ${completedCount + 1} of ${milestones.length || 6}`}
                />
              </div>

              <div className="space-y-2 border-y md:border-y-0 md:border-x border-neutral-100 py-4 md:py-0 md:px-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Cost Summary
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-500">Budget:</span>
                    <span className="text-base font-bold text-neutral-800">
                      ₹{totalBudget.toFixed(1)} Lakhs
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-500">Spent:</span>
                    <span className="text-base font-bold text-red-500">
                      ₹{spentAmount.toFixed(1)} Lakhs
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline border-t border-dashed border-neutral-100 pt-1.5 mt-1">
                    <span className="text-sm text-neutral-900 font-semibold">Remaining:</span>
                    <span className="text-base font-extrabold text-emerald-600">
                      ₹{remainingBudget.toFixed(1)} Lakhs
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
                    Current Contractor
                  </span>
                  {activeContractor ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-terracotta-50 text-terracotta flex items-center justify-center font-bold text-sm">
                        {activeContractor.company.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-800 text-sm">{activeContractor.company}</h4>
                        <p className="text-xs text-neutral-500">{activeContractor.owner}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => onNavigate('marketplace')}
                      className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5"
                    >
                      Hire a Contractor <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-neutral-400">
                  Response:{' '}
                  <span className="font-semibold text-neutral-700">
                    {activeContractor?.responseTime ?? 'N/A'}
                  </span>
                  {' · '}
                  Rating:{' '}
                  <span className="font-semibold text-neutral-700">
                    {activeContractor?.rating ?? '—'} ★
                  </span>
                </div>
              </div>
            </div>
          </PremiumCard>

          {/* Today's Update + Next Milestone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <PremiumCard title="Today's Site Update">
              <p className="text-sm text-neutral-700 font-medium leading-relaxed">
                "{siteUpdate.text}"
              </p>
              <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold pt-3 mt-3 border-t border-neutral-100">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Logged by {siteUpdate.loggedBy} at {siteUpdate.loggedAt}
              </div>
            </PremiumCard>

            <PremiumCard title="Next Milestone">
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
                  <div className="flex items-center gap-1 text-xs font-medium text-neutral-500 pt-2 border-t border-neutral-100">
                    <Calendar className="w-3.5 h-3.5 text-terracotta" />
                    Target: {currentMilestone.targetDate}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-400 italic">All milestones completed.</p>
              )}
            </PremiumCard>
          </div>

          {/* Expense Summary Chart */}
          <PremiumCard
            title="Expense Summary"
            action={
              <button
                onClick={() => onNavigate('budget')}
                className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5"
              >
                Full Budget <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <ExpenseSummaryChart items={budgetItems} />
          </PremiumCard>

          {/* Recent Progress Photos */}
          <PremiumCard
            title="Recent Progress Photos"
            action={
              <button
                onClick={() => onNavigate('tracker')}
                className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5"
              >
                View Tracker <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="grid grid-cols-3 gap-4">
              {displayPhotos.map((url, i) => (
                <div
                  key={i}
                  className="relative rounded-xl overflow-hidden aspect-video group cursor-pointer border border-neutral-100"
                >
                  <img
                    src={url}
                    alt={`Site progress ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-8">
          {/* Weather Alert */}
          <PremiumCard title="Weather Alert">
            <WeatherAlertCard
              title={weatherAlert.title}
              message={weatherAlert.message}
              location={weatherAlert.location}
            />
            <div className="mt-3 p-3 rounded-xl bg-rose-50/60 border border-rose-100 flex gap-2">
              <TrendingUp className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Steel prices rising 4.2% next Tuesday.{' '}
                <button
                  onClick={() => onNavigate('materials')}
                  className="text-rose-800 font-semibold hover:underline"
                >
                  Pre-book materials →
                </button>
              </p>
            </div>
          </PremiumCard>

          {/* Recent Messages */}
          <PremiumCard title="Recent Messages" className="flex flex-col">
            <div className="space-y-3 mb-4">
              {displayMessages.map(msg => (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-terracotta-50 text-terracotta flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {msg.sender === 'contractor' ? 'C' : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="p-3 rounded-2xl bg-neutral-50 text-neutral-700 text-xs leading-relaxed">
                      {msg.text}
                      {msg.attachment && (
                        <div className="mt-2 p-2 rounded bg-white border border-neutral-200 flex items-center gap-1.5 font-medium text-neutral-800">
                          <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1 py-0.5 rounded">
                            PDF
                          </span>
                          <span className="truncate">{msg.attachment.name}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 block text-right mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigate('chat')}
              className="w-full py-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold border border-neutral-200/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4 text-neutral-500" />
              Open Full Workspace Chat
            </button>
          </PremiumCard>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-terracotta" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Quick Actions
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map(action => (
            <QuickActionCard
              key={action.page}
              icon={action.icon}
              title={action.title}
              description={action.description}
              accent={action.accent}
              onClick={() => onNavigate(action.page)}
            />
          ))}
        </div>
      </div>

      {/* AI Insight */}
      <AiInsight
        insight="Daily logs confirm AAC blocks are successfully placed for partition walls, lowering structural load and concrete volumes by 8.4%."
        recommendation="Verify electrical conduit layout in the AI Design Studio before the concrete slab is cast next Tuesday."
        confidenceScore={98}
        impactValue="₹1,50,000 Potential Savings"
      />
    </div>
  );
};
