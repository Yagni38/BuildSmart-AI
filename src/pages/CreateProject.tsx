import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, MapPin, Calculator, Sparkles, AlertCircle, 
  Leaf, ShieldAlert, Award, ArrowRight, ArrowLeft, RefreshCw, Layers,
  DollarSign, Clock, FileText, CheckCircle, ShieldCheck, ChevronRight, Briefcase
} from 'lucide-react';
import { Contractor, INITIAL_CONTRACTORS } from '../mockData';
import { AiInsight } from '../components/AiInsight';

interface CreateProjectProps {
  onProjectCreated: (projectData: any, contractor: Contractor) => void;
  onNavigate: (page: string) => void;
}

export const CreateProject: React.FC<CreateProjectProps> = ({
  onProjectCreated,
  onNavigate
}) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string>("");

  // Step 1: Project Details
  const [projectName, setProjectName] = useState("Greenfield Eco-Villa");
  const [buildingType, setBuildingType] = useState("Villa");
  const [projectDescription, setProjectDescription] = useState(
    "A sustainable two-story family residential building focusing on low energy costs and passive ventilation."
  );

  // Step 2: Location
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [plotSize, setPlotSize] = useState("2400");
  const [floors, setFloors] = useState("2");
  const [soilType, setSoilType] = useState("Red Sandy Loam");

  // Step 3: Budget & Timeline
  const [expectedBudget, setExpectedBudget] = useState("4500000"); // 45 Lakhs
  const [expectedCompletion, setExpectedCompletion] = useState("2027-05-15");
  const [priority, setPriority] = useState("Eco-Friendliness");
  const [designStyle, setDesignStyle] = useState("Modern");

  // Loading words simulation
  const loadingStages = [
    "Analyzing soil load capacity index...",
    "Retrieving local market indices for steel and sand aggregates...",
    "Drafting optimal spatial solar tracking layouts...",
    "Running structural strength safety models...",
    "Evaluating regional verified contractor schedules...",
    "Compiling eco-carbon emissions offset metrics..."
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setLoading(false);
              setStep(5); // Results step
            }, 600);
            return 100;
          }
          const next = prev + 4;
          const index = Math.min(Math.floor(next / 17), loadingStages.length - 1);
          setLoadingText(loadingStages[index]);
          return next;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGeneratePlan = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingProgress(0);
    setLoadingText(loadingStages[0]);
    setStep(4); // Enter Loading Phase
  };

  const handleContinueToDashboard = () => {
    // Automatically select the best contractor and proceed to Dashboard
    const topContractor = INITIAL_CONTRACTORS[0]; 
    onProjectCreated({
      name: projectName,
      type: buildingType,
      description: projectDescription,
      city,
      state,
      plotSize: `${plotSize} Sq.Ft`,
      floors,
      soilType,
      budget: parseFloat(expectedBudget) / 100000, // convert to lakhs
      duration: 10,
      priority,
      style: designStyle
    }, topContractor);
    onNavigate('dashboard');
  };

  // UI styling helpers
  const labelStyle = "block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2";
  const inputStyle = "w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta transition-colors font-medium text-neutral-800 text-sm bg-white";

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Stepper Header (Only for config steps) */}
      {step <= 3 && (
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Step {step} of 3</span>
          <h1 className="text-3xl font-extrabold text-neutral-900 mt-1">Setup Your Construction</h1>
          <div className="flex justify-center items-center gap-2 mt-4">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-8 bg-terracotta" : "w-4 bg-neutral-200"
                }`} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Steps Switcher */}
      <AnimatePresence mode="wait">
        
        {/* STEP 1: Project Details */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="bg-white border border-neutral-200 rounded-3xl p-8 shadow-premium space-y-6"
          >
            <h2 className="text-xl font-bold text-neutral-950 border-b border-neutral-100 pb-3 flex items-center gap-2">
              <Building className="w-5 h-5 text-terracotta" /> Step 1: Project Details
            </h2>

            <div className="space-y-5">
              <div>
                <label className={labelStyle}>Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. Greenfield Eco-Villa"
                  required
                />
              </div>

              <div>
                <label className={labelStyle}>Building Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {["House", "Apartment", "Villa", "Commercial", "School", "Hospital"].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBuildingType(type)}
                      className={`py-3 px-2 rounded-xl border text-xs font-bold transition-all duration-200 ${
                        buildingType === type 
                          ? "border-terracotta bg-terracotta-50 text-terracotta shadow-sm" 
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelStyle}>Project Description</label>
                <textarea
                  value={projectDescription}
                  onChange={e => setProjectDescription(e.target.value)}
                  rows={3}
                  className={`${inputStyle} h-24 resize-none`}
                  placeholder="Describe your design vision, material goals, and specific room details..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-neutral-100">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
              >
                Next: Location <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Location Details */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="bg-white border border-neutral-200 rounded-3xl p-8 shadow-premium space-y-6"
          >
            <h2 className="text-xl font-bold text-neutral-950 border-b border-neutral-100 pb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-terracotta" /> Step 2: Location Parameters
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelStyle}>City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. Bengaluru"
                />
              </div>

              <div>
                <label className={labelStyle}>State</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. Karnataka"
                />
              </div>

              <div>
                <label className={labelStyle}>Plot Size (Sq.Ft)</label>
                <input
                  type="number"
                  value={plotSize}
                  onChange={e => setPlotSize(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. 2400"
                />
              </div>

              <div>
                <label className={labelStyle}>Number of Floors</label>
                <select
                  value={floors}
                  onChange={e => setFloors(e.target.value)}
                  className={`${inputStyle} cursor-pointer`}
                >
                  <option value="1">G (1 Floor)</option>
                  <option value="2">G + 1 (2 Floors)</option>
                  <option value="3">G + 2 (3 Floors)</option>
                  <option value="4">G + 3 (4 Floors)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={labelStyle}>Soil Type (Optional)</label>
                <input
                  type="text"
                  value={soilType}
                  onChange={e => setSoilType(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. Red Sandy Loam, Clay Soil, Rocky"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-neutral-100">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
              >
                Next: Budget & Design <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Budget & Timeline */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="bg-white border border-neutral-200 rounded-3xl p-8 shadow-premium space-y-6"
          >
            <h2 className="text-xl font-bold text-neutral-950 border-b border-neutral-100 pb-3 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-terracotta" /> Step 3: Budget & Timeline
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelStyle}>Expected Budget (INR)</label>
                <input
                  type="number"
                  value={expectedBudget}
                  onChange={e => setExpectedBudget(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. 4500000"
                />
              </div>

              <div>
                <label className={labelStyle}>Expected Completion Date</label>
                <input
                  type="date"
                  value={expectedCompletion}
                  onChange={e => setExpectedCompletion(e.target.value)}
                  className={inputStyle}
                />
              </div>

              <div>
                <label className={labelStyle}>Construction Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className={`${inputStyle} cursor-pointer`}
                >
                  <option value="Cost Efficiency">Cost Efficiency</option>
                  <option value="Speed & Delivery">Speed & Delivery</option>
                  <option value="Eco-Friendliness">Eco-Friendliness</option>
                  <option value="Structural Warranty">Structural Warranty</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>Preferred Style</label>
                <select
                  value={designStyle}
                  onChange={e => setDesignStyle(e.target.value)}
                  className={`${inputStyle} cursor-pointer`}
                >
                  <option value="Modern">Modern</option>
                  <option value="Luxury">Luxury</option>
                  <option value="Traditional">Traditional</option>
                  <option value="Minimal">Minimal</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-neutral-100">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              
              <button
                onClick={handleGeneratePlan}
                className="px-8 py-3 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all shadow-premium hover:shadow-premium-hover"
              >
                <Sparkles className="w-5 h-5 text-white animate-pulse" /> Generate AI Plan
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Animated AI Loading screen */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-neutral-200 rounded-3xl p-12 shadow-premium text-center space-y-8 min-h-[420px] flex flex-col justify-center items-center"
          >
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-terracotta/20 border-t-terracotta animate-spin" />
              <div className="absolute inset-4 rounded-full bg-terracotta/10 flex items-center justify-center text-terracotta">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            <div className="space-y-3 max-w-md">
              <h2 className="text-2xl font-bold text-neutral-900 animate-pulse">
                BuildSmart AI is analyzing your project...
              </h2>
              <p className="text-sm text-neutral-400 font-light h-10 transition-all duration-300">
                {loadingText}
              </p>
            </div>

            <div className="w-64 space-y-1.5">
              <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-terracotta transition-all duration-200 ease-out" 
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400 font-bold">
                <span>Optimizing blueprints...</span>
                <span>{loadingProgress}%</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 5: AI Generated Results in beautiful cards */}
        {step === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Top Overview Banner */}
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full">
                  Analysis Verified
                </span>
                <h2 className="text-2xl font-extrabold text-neutral-950 mt-2">{projectName} AI Blueprint</h2>
                <p className="text-xs text-neutral-400 font-light">Target Location: {city}, {state} | Soil: {soilType || 'Standard loam'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-neutral-400 block uppercase">Confidence Index</span>
                <span className="text-3xl font-extrabold text-terracotta">96%</span>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Cost & Duration Card */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4.5 h-4.5 text-terracotta" /> Cost & Timeline Estimates
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Estimated Cost</span>
                    <strong className="text-lg text-neutral-800 font-extrabold">₹42.5 Lakhs</strong>
                    <span className="text-[9px] text-emerald-600 font-bold block mt-1">₹4.2L under user target</span>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Project Duration</span>
                    <strong className="text-lg text-neutral-800 font-extrabold">10 Months</strong>
                    <span className="text-[9px] text-neutral-400 font-medium block mt-1">Est. End: May 2027</span>
                  </div>
                </div>
              </div>

              {/* Carbon Footprint Card */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Leaf className="w-4.5 h-4.5 text-emerald-500" /> Carbon Footprint Estimate
                </h3>
                <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-semibold">CO₂ Emissions Grade</span>
                    <strong className="text-lg text-emerald-800 font-extrabold">B-Grade (Optimized)</strong>
                    <p className="text-[9px] text-neutral-400 leading-normal font-light mt-1">
                      AAC blocks save 8.4 Tons compared to red clay brick layouts.
                    </p>
                  </div>
                  <span className="w-10 h-10 rounded-full bg-white text-emerald-600 border border-emerald-100 flex items-center justify-center font-extrabold text-sm">
                    -18%
                  </span>
                </div>
              </div>

              {/* Material requirement summary */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4.5 h-4.5 text-terracotta" /> Material Requirement Summary
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-neutral-700">
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50 flex justify-between">
                    <span>OPC 53 Cement</span>
                    <strong className="text-neutral-900">950 Bags</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50 flex justify-between">
                    <span>TMT Fe 550 Steel</span>
                    <strong className="text-neutral-900">8.5 Tons</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50 flex justify-between">
                    <span>AAC Blocks</span>
                    <strong className="text-neutral-900">4,200 Pcs</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50 flex justify-between">
                    <span>M-Sand (Sand)</span>
                    <strong className="text-neutral-900">42 Brass</strong>
                  </div>
                </div>
              </div>

              {/* Recommended building design style */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4.5 h-4.5 text-terracotta" /> Suggested Building Design
                </h3>
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100/50 space-y-2">
                  <h4 className="font-bold text-neutral-800 text-xs">Eco-Courtyard Passive Villa</h4>
                  <p className="text-[11px] text-neutral-500 font-light leading-relaxed">
                    Designed for {designStyle} aesthetic in {city}. Incorporates a double-volume lightwell structure, dropping afternoon indoor temperature spikes by 3.2°C.
                  </p>
                </div>
              </div>

              {/* Budget Saving Suggestions */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-600" /> AI Budget Saving Suggestions
                </h3>
                <ul className="space-y-3 text-xs leading-relaxed text-neutral-500 font-light">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span><strong>AAC Blocks Substitution</strong>: Save ₹1,50,000 on plastering mortar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Pre-Order Steel Packages</strong>: Lock rates before next Tuesday's tariff hikes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Vitrified Bedroom Layouts</strong>: Lowers finishing labor overhead by 12%.</span>
                  </li>
                </ul>
              </div>

              {/* Risk Analysis Card */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5 text-amber-800">
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-600" /> AI Risk Analysis
                </h3>
                <ul className="space-y-3 text-xs leading-relaxed text-neutral-500 font-light">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Slab Monsoon Risk</strong>: Heavy rain forecast for mid-August (High risk of delay).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Soil Load Settlement</strong>: Soil loam carries G+1 levels easily (Zero structural risk).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Commodity Volatility</strong>: Steel indexes trending upwards by 4% next week.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Top 3 contractors matches */}
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
              <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4.5 h-4.5 text-terracotta" /> Top 3 Recommended Contractors
              </h3>
              <div className="space-y-3">
                {INITIAL_CONTRACTORS.map((c, index) => (
                  <div 
                    key={c.id} 
                    className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-4 ${
                      index === 0 ? "border-terracotta bg-terracotta-50/20" : "border-neutral-100 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 text-terracotta flex items-center justify-center font-extrabold text-base">
                        {c.company.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-neutral-800 text-sm">{c.company}</h4>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Match Score: {c.matchScore}%
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-light mt-1">
                          Est: <strong className="font-semibold text-neutral-700">₹{c.priceEstimate}L</strong> | Warranty: <strong className="font-semibold text-neutral-700">{c.warranty} yrs</strong> | specialty: <strong className="font-semibold text-neutral-700">{c.specialty}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-400 font-semibold">{c.responseTime}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col items-center pt-6 pb-2">
              <button
                onClick={handleContinueToDashboard}
                className="px-10 py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-premium hover:shadow-premium-hover scale-105 hover:scale-110 duration-300"
              >
                Continue to Dashboard <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <AiInsight
              insight="Applying AI saving proposals lowers structural phase budgets by 8.9% below your expected ₹45L parameter targets."
              recommendation="Click 'Continue to Dashboard' to synchronize material booking indexes with Apex Builders and initialize daily progress logs."
              confidenceScore={98}
              impactValue="₹1,50,000 Saved"
            />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
