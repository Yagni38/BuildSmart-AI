import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Bell,
  User,
  Cpu,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Landmark,
  ClipboardList,
  Briefcase,
  Activity,
} from 'lucide-react';

// ProjectDetails reads :projectId from the route when opened via URL.
// The app uses state-based routing, so the details page is mounted inside a
// MemoryRouter (see the 'project-details' render block below).
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { UserRole } from './types/auth';

// Pages
import { AuthPage } from './pages/AuthPage';
import { ResetPassword } from './pages/ResetPassword';
import { LandingPage } from './pages/LandingPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { CreateProject } from './pages/CreateProject';
import { ProjectDetails } from './pages/ProjectDetails';
import { AiDesignStudio } from './pages/AiDesignStudio';
import { BudgetEstimator } from './pages/BudgetEstimator';
import { MaterialEstimator } from './pages/MaterialEstimator';
import { ContractorMarketplace } from './pages/ContractorMarketplace';
import { ContractorComparison } from './pages/ContractorComparison';
import { ProjectTracker } from './pages/ProjectTracker';
import { ChatPage } from './pages/ChatPage';
import { ReportPage } from './pages/ReportPage';
import { Profile } from './pages/Profile';
import { ContractorRegistration } from './pages/ContractorRegistration';
import { ContractorDashboard } from './pages/ContractorDashboard';
import { ContractorAccessGate } from './components/ContractorAccessGate';
import { AdminDashboard } from './pages/AdminDashboard';

// Types
import type {
  Contractor,
  Milestone,
  Message,
  CustomerProject,
} from './mockData';

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, profile, loading, profileError, signOut } = useAuth();

  const roleToRoute: Record<UserRole, string> = {
    CUSTOMER: 'client',
    CONTRACTOR: 'contractor',
    ADMIN: 'admin',
  };

  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [project, setProject] = useState<CustomerProject | null>(null);
  // Phase 2: the REAL public.projects UUID currently opened in Project Details.
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [compareList, setCompareList] = useState<Contractor[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  /*
   * ---------------------------------------------------------
   * 1. SUPABASE SESSION IS STILL BEING RESTORED
   * ---------------------------------------------------------
   */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warmbeige-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-terracotta/20 border-t-terracotta animate-spin" />
          <p className="text-sm font-semibold text-neutral-500">
            Loading BuildSmart AI...
          </p>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * 1b. PASSWORD RECOVERY ROUTES
   *
   * These must render BEFORE the authenticated-user branches below.
   * Supabase's recovery link signs the user in, so without this the app
   * would jump straight to the dashboard and skip the reset form.
   * ---------------------------------------------------------
   */
  const currentPath = window.location.pathname.replace(/\/+$/, '');

  if (currentPath === '/reset-password') {
    return <ResetPassword />;
  }

  if (currentPath === '/forgot-password') {
    return <AuthPage initialMode="forgot-password" />;
  }

  /*
   * ---------------------------------------------------------
   * 2. NO AUTHENTICATED USER
   *
   * THIS IS THE IMPORTANT FIX.
   * The first screen MUST be AuthPage.
   * ---------------------------------------------------------
   */
  if (!user) {
    return <AuthPage />;
  }

  /*
   * ---------------------------------------------------------
   * 3. USER EXISTS BUT PROFILE IS NOT AVAILABLE
   * ---------------------------------------------------------
   */
  if (profileError) {
    return (
      <div className="min-h-screen bg-warmbeige-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-red-100 shadow-premium p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-extrabold text-neutral-900">
            Profile could not be loaded
          </h2>

          <p className="text-sm text-neutral-500 mt-2">
            Your account is authenticated, but your BuildSmart profile could
            not be loaded.
          </p>

          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-left text-xs text-red-700 break-words">
            {profileError}
          </div>

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-bold"
            >
              Retry
            </button>

            <button
              onClick={async () => {
                await signOut();
              }}
              className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 text-sm font-bold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * 4. USER EXISTS BUT PROFILE ROW IS MISSING
   * ---------------------------------------------------------
   */
  if (!profile) {
    return (
      <div className="min-h-screen bg-warmbeige-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-neutral-200 shadow-premium p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <User className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-extrabold text-neutral-900">
            Setting up your account
          </h2>

          <p className="text-sm text-neutral-500 mt-2">
            Your authenticated account was found, but the BuildSmart profile
            is not available yet.
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-bold"
          >
            Try Again
          </button>

          <button
            onClick={async () => {
              await signOut();
            }}
            className="block mx-auto mt-3 text-xs font-bold text-neutral-500 hover:text-red-600"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * 5. PROFILE EXISTS → GET REAL USER ROLE
   * ---------------------------------------------------------
   */
  const effectiveRole = roleToRoute[profile.role];

  /*
   * ---------------------------------------------------------
   * 6. CONTRACTOR DASHBOARD
   * ---------------------------------------------------------
   */
  if (effectiveRole === 'contractor') {
    return (
      <div className="min-h-screen bg-warmbeige-50">
        <header className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-extrabold">
                B
              </div>

              <div>
                <h1 className="font-extrabold text-neutral-900">
                  BuildSmart <span className="text-terracotta">AI</span>
                </h1>

                <p className="text-[10px] text-neutral-400 uppercase font-semibold">
                  Contractor Dashboard
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                await signOut();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* PHASE 4: verified contractor access control.
              PENDING/REJECTED contractors see their DB status (+ rejection
              reason) instead of the workspace; VERIFIED contractors get
              full access. DB/RLS remains the real security boundary. */}
          <ContractorAccessGate areaLabel="the contractor workspace">
            <div className="px-6">
              <ContractorDashboard />
            </div>
          </ContractorAccessGate>
        </main>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * 7. ADMIN DASHBOARD
   * ---------------------------------------------------------
   */
  if (effectiveRole === 'admin') {
    return (
      <div className="min-h-screen bg-warmbeige-50">
        <header className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-extrabold">
                B
              </div>

              <div>
                <h1 className="font-extrabold text-neutral-900">
                  BuildSmart <span className="text-terracotta">AI</span>
                </h1>

                <p className="text-[10px] text-neutral-400 uppercase font-semibold">
                  Admin Control Center
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                await signOut();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <AdminDashboard />
        </main>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * 8. CUSTOMER DASHBOARD
   * ---------------------------------------------------------
   */

  const handleToggleCompare = (c: Contractor) => {
    if (compareList.some(item => item.id === c.id)) {
      setCompareList(prev => prev.filter(x => x.id !== c.id));
      return;
    }

    if (compareList.length >= 3) {
      alert('You can compare up to 3 contractors.');
      return;
    }

    setCompareList(prev => [...prev, c]);
  };

  const handleSelectContractor = (c: Contractor) => {
    setContractor(c);
    setCurrentPage('dashboard');
  };

  // Phase 2: open a REAL persisted project (public.projects) in Project Details.
  const handleOpenProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage('project-details');
  };

  const handleProjectCreated = (
    projectData: {
      id?: string; // REAL public.projects UUID returned by createProject()
      name: string;
      type: string;
      city: string;
      state: string;
      plotSize: string;
      floors: string;
      budget: number;
    },
    selectedContractor: Contractor | null
  ) => {
    // Never fabricate a local project id when Supabase returned one —
    // detail views must reference the persisted row.
    if (projectData.id) {
      setSelectedProjectId(projectData.id);
    }

    setProject({
      id: projectData.id ?? `BS-${Math.floor(9000 + Math.random() * 999)}`,
      name: projectData.name,
      location: `${projectData.city}, ${projectData.state} · ${projectData.plotSize}`,
      buildingType: `${projectData.type} (G+${Number(projectData.floors) - 1})`,
      status: 'Active Build Phase',
      startDate: new Date().toLocaleDateString('en-IN', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      totalBudget: projectData.budget,
    });

    setContractor(selectedContractor);
    setCurrentPage('dashboard');
  };

  const unreadNotificationsCount =
    notifications.filter(n => !n.read).length;

  const markNotificationsAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({
        ...n,
        read: true,
      }))
    );
  };

  const clientJourneySteps = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'landing', label: 'Dream' },
    { id: 'create-project', label: 'Plan' },
    { id: 'design-studio', label: 'Design Studio' },
    { id: 'budget', label: 'Budget' },
    { id: 'materials', label: 'Materials' },
    { id: 'marketplace', label: 'Contractors' },
    { id: 'tracker', label: 'Tracker' },
    { id: 'chat', label: 'Chat' },
    { id: 'reports', label: 'Reports' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-warmbeige-50 flex flex-col font-sans">

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-200/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">

          <button
            onClick={() => setCurrentPage('dashboard')}
            className="flex items-center gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-extrabold">
              B
            </div>

            <div className="text-left">
              <h1 className="text-lg font-extrabold text-neutral-900">
                BuildSmart <span className="text-terracotta">AI</span>
              </h1>

              <span className="text-[10px] text-neutral-400 font-semibold tracking-wide uppercase">
                Construction Platform
              </span>
            </div>
          </button>

          <nav className="hidden xl:flex items-center gap-1 bg-neutral-50 p-1.5 rounded-xl border border-neutral-200/50">
            {clientJourneySteps.map(step => (
              <button
                key={step.id}
                onClick={() => setCurrentPage(step.id)}
                className={`px-3 py-2 rounded-lg text-xs font-bold ${
                  currentPage === step.id
                    ? 'bg-white text-terracotta shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {step.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">

            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(prev => !prev);

                  if (!showNotifications) {
                    markNotificationsAsRead();
                  }
                }}
                className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600"
              >
                <Bell className="w-4 h-4" />

                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-terracotta" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 z-50">
                  <h3 className="text-sm font-bold mb-3">
                    Notifications
                  </h3>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        className="p-3 bg-neutral-50 rounded-xl"
                      >
                        <p className="text-xs font-bold text-neutral-800">
                          {n.title}
                        </p>

                        <p className="text-[11px] text-neutral-500 mt-1">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCurrentPage('profile')}
              className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600"
            >
              <User className="w-4 h-4" />
            </button>

            <button
              onClick={async () => {
                await signOut();
                setCurrentPage('dashboard');
              }}
              className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className="xl:hidden p-2 rounded-xl bg-white border border-neutral-200"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="xl:hidden mt-4 border-t pt-3 space-y-1">
            {clientJourneySteps.map(step => (
              <button
                key={step.id}
                onClick={() => {
                  setCurrentPage(step.id);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold hover:bg-neutral-50"
              >
                {step.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-grow pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >

            {currentPage === 'dashboard' && (
              <CustomerDashboard
                contractor={contractor}
                milestones={milestones}
                messages={messages}
                project={project}
                onNavigate={setCurrentPage}
                onOpenProject={handleOpenProject}
              />
            )}

            {currentPage === 'landing' && (
              <LandingPage onNavigate={setCurrentPage} />
            )}

            {currentPage === 'create-project' && (
              <CreateProject
                onProjectCreated={handleProjectCreated}
                onNavigate={setCurrentPage}
              />
            )}

            {currentPage === 'project-details' && selectedProjectId && (
              <MemoryRouter>
                <ProjectDetails
                  projectId={selectedProjectId}
                  onBack={() => setCurrentPage('dashboard')}
                />
              </MemoryRouter>
            )}

            {currentPage === 'design-studio' && (
              <AiDesignStudio />
            )}

            {currentPage === 'budget' && (
              <BudgetEstimator projectId={selectedProjectId} />
            )}

            {currentPage === 'materials' && (
              <MaterialEstimator projectId={selectedProjectId} />
            )}

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
                projectId={selectedProjectId}
                milestones={milestones}
                onUpdateMilestone={setMilestones}
              />
            )}

            {currentPage === 'chat' && (
              <ChatPage projectId={selectedProjectId} />
            )}

            {currentPage === 'reports' && (
              <ReportPage />
            )}

            {currentPage === 'profile' && (
              <Profile />
            )}

            {currentPage === 'contractor-register' && (
              <ContractorRegistration onNavigate={setCurrentPage} />
            )}

            {currentPage === 'admin' && (
              <AdminDashboard />
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t border-neutral-200 py-6 text-center text-xs text-neutral-400">
        © 2026 BuildSmart AI. All rights reserved.
      </footer>
    </div>
  );
}