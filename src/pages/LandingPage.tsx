import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, XCircle, ShieldCheck, Star, Users, Building, Cpu, Play } from 'lucide-react';
import { AiInsight } from '../components/AiInsight';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: "easeOut" as any } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-24 py-10 px-4 max-w-7xl mx-auto"
    >
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-8">
          <motion.div variants={itemVariants} className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-terracotta-50 text-terracotta border border-terracotta-100">
              <Cpu className="w-3.5 h-3.5" /> Next-Gen AI Construction
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-tight">
              Build Your Dream Home <br />
              <span className="text-terracotta">with AI</span> — Before You Build It
            </h1>
            <p className="text-lg md:text-xl text-neutral-500 font-light leading-relaxed max-w-2xl">
              Plan smarter, compare verified contractors, estimate costs, visualize your dream building, and monitor construction from one intelligent platform.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('create-project')}
              className="px-8 py-4 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-600 shadow-premium hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2"
            >
              Start New Project <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => onNavigate('marketplace')}
              className="px-8 py-4 rounded-xl bg-white border border-neutral-200 text-neutral-800 font-medium hover:bg-neutral-50 shadow-premium hover:-translate-y-0.5 transition-all duration-300"
            >
              Explore Contractors
            </button>
            <button
              className="px-6 py-4 rounded-xl flex items-center gap-2 text-neutral-600 font-medium hover:text-neutral-900 transition-colors duration-200"
              onClick={() => alert("Watch Demo: BuildSmart AI optimizes material procurement by checking regional steel & cement indices.")}
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-neutral-200 text-terracotta shadow-sm">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </span>
              Watch Demo
            </button>
          </motion.div>

          {/* Stats sub-row */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-neutral-100"
          >
            <div>
              <div className="text-3xl font-extrabold text-neutral-900">423+</div>
              <div className="text-sm text-neutral-400 font-medium flex items-center gap-1 mt-1">
                <ShieldCheck className="w-4 h-4 text-terracotta" /> Verified Contractors
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-neutral-900">12,400+</div>
              <div className="text-sm text-neutral-400 font-medium flex items-center gap-1 mt-1">
                <Users className="w-4 h-4 text-terracotta" /> Completed Projects
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-neutral-900">₹120 Cr</div>
              <div className="text-sm text-neutral-400 font-medium flex items-center gap-1 mt-1">
                <Building className="w-4 h-4 text-terracotta" /> Managed Construction
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-neutral-900 flex items-center">
                4.8<Star className="w-5 h-5 text-amber-400 fill-current ml-1" />
              </div>
              <div className="text-sm text-neutral-400 font-medium mt-1">Customer Rating</div>
            </div>
          </motion.div>
        </div>

        {/* Right Hero Image Card */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-5 relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-terracotta-200 to-transparent rounded-3xl opacity-20 blur-xl group-hover:opacity-35 transition-opacity duration-300" />
          <div className="relative rounded-3xl overflow-hidden border border-neutral-200/60 shadow-2xl bg-white p-2">
            <img
              src="/villa.png"
              alt="BuildSmart AI Modern Construction"
              className="w-full h-[450px] object-cover rounded-2xl group-hover:scale-[1.02] transition-transform duration-700"
            />
            {/* Overlay Glass Tag */}
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl glass-panel border border-white/40 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-neutral-800 text-sm">Smart Villa 3D Simulation</h4>
                <p className="text-xs text-neutral-500">Sanctioned & fully planned in 4 minutes</p>
              </div>
              <span className="text-xs font-semibold bg-terracotta text-white px-2.5 py-1 rounded-md">
                Active Project
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Traditional vs BuildSmart AI */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-950">
            Traditional Construction vs <span className="text-terracotta">BuildSmart AI</span>
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            Traditional construction is broken, expensive, and opaque. BuildSmart brings certainty and transparency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Traditional Card */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-8 shadow-premium relative overflow-hidden">
            <h3 className="text-xl font-bold text-neutral-900 mb-6 pb-4 border-b border-neutral-100 flex items-center justify-between">
              Traditional Construction
              <span className="text-sm font-semibold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                Risky
              </span>
            </h3>
            <ul className="space-y-5">
              {[
                "Hidden Costs (averaging 25% budget overruns)",
                "No 3D/VR Visualization prior to breaking ground",
                "Random Contractors selected by word-of-mouth",
                "Frequent Delays (average 4.5 months behind schedule)",
                "Unpredictable quality & materials substitution"
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3">
                  <XCircle className="w-5.5 h-5.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-neutral-600 font-medium">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* BuildSmart Card */}
          <div className="bg-white border-2 border-terracotta rounded-3xl p-8 shadow-premium relative overflow-hidden ai-border-glow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-terracotta-50 to-transparent opacity-60 rounded-full blur-xl" />
            <h3 className="text-xl font-bold text-neutral-900 mb-6 pb-4 border-b border-neutral-100 flex items-center justify-between">
              BuildSmart AI Platform
              <span className="text-sm font-semibold px-3 py-1 rounded-full bg-terracotta-50 text-terracotta border border-terracotta-100">
                AI Driven
              </span>
            </h3>
            <ul className="space-y-5">
              {[
                "AI Cost Estimation (98% accuracy matching actual rates)",
                "Interactive AI Design Studio & Instant 3D suggestions",
                "Platform Verified Contractors with Match Compatibility Scores",
                "Live Construction Milestones & photo-verified updates",
                "Transparent Budgeting, material lockers, and locked-in quotes"
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5.5 h-5.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-neutral-800 font-semibold">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How BuildSmart Works */}
      <section className="space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900">
            How BuildSmart Works
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            A cohesive client-centric workflow that takes you from initial concepts to final key handover.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 relative">
          {[
            { step: "01", title: "Create Project", desc: "Select property style, size, location, and parameters." },
            { step: "02", title: "AI Planner", desc: "AI generates structures, carbon index, and layout specs." },
            { step: "03", title: "Estimations", desc: "Granular breakdown of concrete, steel, labor, and prices." },
            { step: "04", title: "Compare & Hire", desc: "Match compatibility and book top contractors with one click." },
            { step: "05", title: "Build Tracking", desc: "Inspect construction with daily photos and smart alerts." },
            { step: "06", title: "Move In!", desc: "Receive automated compliance audits and keys to your dream home." }
          ].map((item, idx) => (
            <div key={idx} className="relative group bg-white border border-neutral-100 rounded-2xl p-6 shadow-premium hover:shadow-premium-hover transition-all duration-300 flex flex-col justify-between">
              <div>
                <span className="text-3xl font-extrabold text-terracotta/20 group-hover:text-terracotta/40 transition-colors duration-300">
                  {item.step}
                </span>
                <h4 className="font-bold text-neutral-800 mt-4 mb-2 text-base">{item.title}</h4>
                <p className="text-xs text-neutral-400 leading-relaxed font-medium">{item.desc}</p>
              </div>
              
              {/* Optional connector arrow for desktop */}
              {idx < 5 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 z-10 text-neutral-300">
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* AI Insight Card for Landing Page */}
      <AiInsight
        insight="Steel prices in the South Karnataka region have stabilized this week, while local cement prices saw a minor 2.4% dip."
        recommendation="Initiate the 'Create Project' flow to pre-book cement packages and lock down material pricing before seasonal monsoons trigger regional price adjustments."
        confidenceScore={94}
        impactValue="₹85,000 Potential Savings"
      />
    </motion.div>
  );
};
