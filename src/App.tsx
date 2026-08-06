import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Bell, User, Cpu, ShieldAlert, 
  Menu, X, Landmark, ClipboardList, Briefcase, Activity 
} from 'lucide-react';

// Import Pages
import { LandingPage } from './pages/LandingPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { CreateProject } from './pages/CreateProject';
import { AiDesignStudio } from './pages/AiDesignStudio';
import { BudgetEstimator } from './pages/BudgetEstimator';
import { MaterialEstimator } from './pages/MaterialEstimator';
import { ContractorMarketplace } from './pages/ContractorMarketplace';
import { ContractorComparison } from './pages/ContractorComparison';
import { ProjectTracker } from './pages/ProjectTracker';
import { ChatPage } from './pages/ChatPage';
import { ReportPage } from './pages/ReportPage';
import { Profile } from './pages/Profile';
import { ContractorDashboard } from './pages/ContractorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

// Mock Data Models
import { 
  Contractor, Milestone, Message, CustomerProject,
  INITIAL_CONTRACTORS, INITIAL_MILESTONES, INITIAL_CHAT, MOCK_NOTIFICATIONS 
} from './mockData';

export default function App() {
  // Navigation & User State
  const [role, setRole] = useState<'client' | 'contractor' | 'admin'>('client');
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // App Database State
  const [project, setProject] = useState<CustomerProject | null>(null);
  const [contractor, setContractor] = useState<Contractor | null>(INITIAL_CONTRACTORS[0]);
  const [compareList, setCompareList] = useState<Contractor[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [messages, setMessages] = useState<Message[]>(INITIAL_CHAT);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  // Toggle Contractor for spec comparison
  const handleToggleCompare = (c: Contractor) => {
    if (compareList.some(item => item.id === c.id)) {
      setCompareList(prev => prev.filter(x => x.id !== c.id));
    } else {
      if (compareList.length >= 3) {
        alert("You can compare up to 3 contractors side-by-side.");
        return;
      }
      setCompareList(prev => [...prev, c]);
    }
  };

  const handleSelectContractor = (c: Contractor) => {
    setContractor(c);
    alert(`Contract for ${c.company} generated and sent to escrow! Project initialized.`);
    setCurrentPage('dashboard');
  };

  const handleProjectCreated = (projectData: {
    name: string; type: string; city: string; state: string;
    plotSize: string; floors: string; budget: number;
  }, selectedContractor: Contractor) => {
    setProject({
      id: `BS-${Math.floor(9000 + Math.random() * 999)}`,
      name: projectData.name,
      location: `${projectData.city}, ${projectData.state} · ${projectData.plotSize}`,
      buildingType: `${projectData.type} (G+${Number(projectData.floors) - 1})`,
      status: 'Active Build Phase',
      startDate: new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }),
      totalBudget: projectData.budget,
    });
    setContractor(selectedContractor);
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  const markNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Helper navigation mapper for standard Client Journey:
  // Dream (Landing) → Plan (Wizard) → Estimate (Budget/Materials) → Compare/Hire (Marketplace/Compare) → Build/Track (Tracker/Chat) → Complete (Reports)
  const clientJourneySteps = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'landing', label: 'Dream' },
    { id: 'create-project', label: 'Plan' },
    { id: 'design-studio', label: 'Design Studio' },
    { id: 'budget', label: 'Budget' },
    { id: 'materials', label: 'Materials' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'tracker', label: 'Tracker' },
    { id: 'chat', label: 'Chat' },
    { id: 'reports', label: 'Reports' },
    { id: 'profile', label: 'Profile' }
  ];

  return (
    <div className="min-h-screen bg-warmbeige-50 flex flex-col font-sans">
      
      {/* Top Banner Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 shadow-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Logo brand */}
          <div 
            onClick={() => setCurrentPage(role === 'client' ? 'dashboard' : (role === 'contractor' ? 'contractor-dash' : 'admin-dash'))}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-extrabold text-sm group-hover:bg-terracotta transition-colors">
              B
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-neutral-900 leading-none">BuildSmart <span className="text-terracotta">AI</span></h1>
              <span className="text-[10px] text-neutral-400 font-semibold tracking-wide uppercase">Construction Platform</span>
            </div>
          </div>

          {/* Desktop Navigation for homeowner client role */}
          {role === 'client' && (
            <nav className="hidden lg:flex items-center gap-1.5 bg-neutral-50 p-1.5 rounded-xl border border-neutral-200/50 text-xs font-bold text-neutral-600">
              {clientJourneySteps.map(step => (
                <button
                  key={step.id}
                  onClick={() => setCurrentPage(step.id)}
                  className={`px-3 py-2 rounded-lg transition-all ${
                    currentPage === step.id 
                      ? "bg-white text-terracotta shadow-sm border border-neutral-200/20 font-extrabold" 
                      : "hover:text-neutral-900"
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </nav>
          )}

          {/* Right Accessories Panel */}
          <div className="flex items-center gap-4">
            
            {/* Demo Switcher Dropdown */}
            <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <select
                value={role}
                onChange={e => {
                  const newRole = e.target.value as any;
                  setRole(newRole);
                  if (newRole === 'client') setCurrentPage('dashboard');
                  else if (newRole === 'contractor') setCurrentPage('contractor-dash');
                  else setCurrentPage('admin-dash');
                }}
                className="bg-transparent border-none text-[10px] font-bold text-neutral-700 focus:ring-0 focus:outline-none cursor-pointer px-2.5 py-1"
              >
                <option value="client">Client Flow</option>
                <option value="contractor">Contractor Flow</option>
                <option value="admin">Admin System</option>
              </select>
            </div>

            {/* Notifications panel toggle */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markNotificationsAsRead();
                }}
                className="p-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-600 hover:text-terracotta transition-colors shadow-sm relative"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-terracotta animate-pulse" />
                )}
              </button>

              {/* Dropdown panel */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2.5 w-80 bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden z-50 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
                      <span className="text-xs font-bold text-neutral-800">Smart Notifications</span>
                      <span className="text-[10px] text-neutral-400 font-semibold uppercase">{unreadNotificationsCount} Unread</span>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {notifications.map(n => (
                        <div key={n.id} className={`p-2.5 rounded-xl border text-[11px] leading-relaxed transition-all ${
                          !n.read ? "bg-terracotta-50/20 border-terracotta-100" : "bg-neutral-50/50 border-neutral-100"
                        }`}>
                          <h4 className="font-bold text-neutral-800 flex justify-between">
                            {n.title}
                            <span className="text-[9px] text-neutral-400 font-normal">{n.time}</span>
                          </h4>
                          <p className="text-neutral-500 font-light mt-0.5">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Action */}
            <button
              onClick={() => setCurrentPage(role === 'client' ? 'profile' : (role === 'contractor' ? 'contractor-dash' : 'admin-dash'))}
              className="p-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-600 hover:text-terracotta transition-colors shadow-sm"
              title="Open Profile Settings"
            >
              <User className="w-4 h-4" />
            </button>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-600"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && role === 'client' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-neutral-150 bg-white py-3 px-4 flex flex-col gap-1 text-xs font-bold text-neutral-600"
            >
              {clientJourneySteps.map(step => (
                <button
                  key={step.id}
                  onClick={() => {
                    setCurrentPage(step.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left py-2.5 px-4 rounded-xl transition-all ${
                    currentPage === step.id 
                      ? "bg-terracotta-50/40 text-terracotta" 
                      : "hover:bg-neutral-50"
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Pages Content Area */}
      <main className="flex-grow pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage + role}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
          >
            {/* Roles router */}
            {role === 'client' && (
              <>
                {currentPage === 'landing' && <LandingPage onNavigate={setCurrentPage} />}
                {currentPage === 'dashboard' && (
                  <CustomerDashboard
                    contractor={contractor}
                    milestones={milestones}
                    messages={messages}
                    project={project}
                    onNavigate={setCurrentPage}
                  />
                )}
                {currentPage === 'create-project' && (
                  <CreateProject 
                    onProjectCreated={handleProjectCreated} 
                    onNavigate={setCurrentPage} 
                  />
                )}
                {currentPage === 'design-studio' && <AiDesignStudio />}
                {currentPage === 'budget' && <BudgetEstimator />}
                {currentPage === 'materials' && <MaterialEstimator />}
                {currentPage === 'marketplace' && (
                  <ContractorMarketplace 
                    onSelectContractor={handleSelectContractor} 
                    onNavigate={setCurrentPage} 
                    selectedCompareList={compareList} 
                    onToggleCompare={handleToggleCompare} 
                  />
                )}
                {currentPage === 'comparison' && (
                  <ContractorComparison 
                    compareList={compareList} 
                    onNavigate={setCurrentPage} 
                    onSelectContractor={handleSelectContractor} 
                  />
                )}
                {currentPage === 'tracker' && (
                  <ProjectTracker 
                    milestones={milestones} 
                    onUpdateMilestone={setMilestones} 
                  />
                )}
                {currentPage === 'chat' && <ChatPage />}
                {currentPage === 'reports' && <ReportPage />}
                {currentPage === 'profile' && <Profile />}
              </>
            )}

            {role === 'contractor' && (
              <ContractorDashboard />
            )}

            {role === 'admin' && (
              <AdminDashboard />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Premium Minimal Footer */}
      <footer className="bg-white border-t border-neutral-200/60 py-6 px-6 text-center text-xs text-neutral-400 font-semibold">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© 2026 BuildSmart AI Inc. All rights reserved. Registered Escrows Karnataka.</div>
          <div className="flex items-center gap-4 font-bold">
            <a href="#" className="hover:text-neutral-800 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-neutral-800 transition-colors">Security Escrows</a>
            <span>•</span>
            <a href="#" className="hover:text-neutral-800 transition-colors">Supervisor API</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
