import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Eye, Info, RefreshCw, CheckCircle, Palette, Sofa, Layers, Sun } from 'lucide-react';
import { AiInsight } from '../components/AiInsight';

export const AiDesignStudio: React.FC = () => {
  const [activeRoom, setActiveRoom] = useState<string>("Hall");
  const [wallColor, setWallColor] = useState<string>("Warm Beige");
  const [flooring, setFlooring] = useState<string>("Hardwood Oak");
  const [roofType, setRoofType] = useState<string>("Flat RCC");
  const [lighting, setLighting] = useState<string>("Warm LED Cove");
  const [furniture, setFurniture] = useState<string>("Scandinavian");
  const [hasGarden, setHasGarden] = useState<boolean>(true);
  const [hasPool, setHasPool] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  // Dynamic Suggestion State
  const [aiAnalysis, setAiAnalysis] = useState<string>(
    "Hardwood Oak flooring combined with Warm Beige walls reflects up to 45% of ambient natural light, reducing diurnal lighting electricity bills by 12%. Insulated Flat RCC roofing shields the Indiranagar climate, preserving indoor coolness."
  );

  const rooms = ["Hall", "Bedroom", "Kitchen", "Bathroom", "Balcony", "Exterior"];

  const handleGenerateSuggestions = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      // Change AI explanations based on inputs
      let explanation = "";
      if (wallColor === "Terracotta Clay") {
        explanation = "Terracotta walls absorb solar heat index, functioning as passive thermal massing. Recommended for east-facing walls. ";
      } else {
        explanation = "Light colors reflect ambient illumination, minimizing indoor heat index. ";
      }

      if (flooring === "Vitrified Tiles") {
        explanation += "Vitrified tiles offer 98% water impermeability and reduce construction carbon footprint by 15% compared to heavy marble quarry transport.";
      } else if (flooring === "Polished Concrete") {
        explanation += "Polished concrete offers zero-grout hygiene and acts as an excellent conductor for hydronic cooling structures.";
      } else {
        explanation += "Oak flooring provides low acoustic feedback and luxurious tactile steps, optimizing stress reduction indices.";
      }

      setAiAnalysis(explanation);
    }, 1500);
  };

  const getRoomImage = (room: string) => {
    switch (room) {
      case "Hall":
        return "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80";
      case "Bedroom":
        return "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80";
      case "Kitchen":
        return "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80";
      case "Bathroom":
        return "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&q=80";
      case "Balcony":
        return "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1200&q=80";
      case "Exterior":
      default:
        return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-terracotta animate-pulse" /> AI Design Studio
        </h1>
        <p className="text-neutral-500 font-light mt-1">
          Customize materials, finishes, and interior styling. AI calculates energy index, cost shifts, and thermal load.
        </p>
      </div>

      {/* Room Selector Tab Row */}
      <div className="flex border-b border-neutral-200 overflow-x-auto pb-0.5 gap-2 scrollbar-none">
        {rooms.map(room => (
          <button
            key={room}
            onClick={() => setActiveRoom(room)}
            className={`py-3 px-5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeRoom === room 
                ? "border-terracotta text-terracotta bg-terracotta-50/20" 
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {room}
          </button>
        ))}
      </div>

      {/* Main Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Rendering Screen */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative rounded-3xl overflow-hidden border border-neutral-200/80 shadow-premium bg-white p-2.5">
            
            {/* Visualizer Frame */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-neutral-100">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeRoom + wallColor + flooring}
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  src={getRoomImage(activeRoom)}
                  alt={`${activeRoom} Design mockup`}
                  className="w-full h-full object-cover filter brightness-[0.95]"
                />
              </AnimatePresence>

              {/* Generating overlay spinner */}
              {generating && (
                <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-terracotta" />
                  <span className="text-sm font-bold tracking-wide">AI Adjusting Textures & Lighting...</span>
                </div>
              )}

              {/* Overlay HUD indicators */}
              <div className="absolute top-4 left-4 p-3 rounded-xl glass-panel text-xs text-neutral-800 font-semibold space-y-1">
                <div>Room: <span className="text-terracotta font-bold">{activeRoom}</span></div>
                <div>Flooring: <span className="font-bold">{flooring}</span></div>
                <div>Wall Tones: <span className="font-bold">{wallColor}</span></div>
              </div>
            </div>

            {/* Quality metadata */}
            <div className="flex justify-between items-center mt-4 px-2">
              <div className="flex items-center gap-1 text-xs text-neutral-400 font-medium">
                <Eye className="w-4 h-4 text-neutral-400" /> Interactive Mockup Rendering (Photorealistic 4K)
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Materials Calibrated
              </span>
            </div>
          </div>

          {/* AI Structural Reasoning Details */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 tracking-wide uppercase border-b border-neutral-100 pb-3 flex items-center gap-1.5">
              <Info className="w-4.5 h-4.5 text-terracotta" /> AI Material Performance Explanation
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed font-light">
              {aiAnalysis}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Lighting savings</span>
                <div className="text-base font-extrabold text-emerald-600 mt-0.5">12% Reduced</div>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">CO₂ production offset</span>
                <div className="text-base font-extrabold text-neutral-800 mt-0.5">15% Saved</div>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Thermal Insulation R-Value</span>
                <div className="text-base font-extrabold text-neutral-800 mt-0.5">3.8 (High)</div>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Acoustic dampening</span>
                <div className="text-base font-extrabold text-neutral-800 mt-0.5">42 dB</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Material Controls */}
        <div className="lg:col-span-4 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
            <Palette className="w-5 h-5 text-terracotta" /> Aesthetic Controls
          </h2>

          <div className="space-y-4">
            {/* Wall Color */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Wall Texture / Color</label>
              <select
                value={wallColor}
                onChange={e => setWallColor(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm text-neutral-800 font-semibold bg-white cursor-pointer"
              >
                <option value="Classic White">Classic Ivory White</option>
                <option value="Warm Beige">Warm Sand Beige</option>
                <option value="Terracotta Clay">Terracotta Clay Pink</option>
                <option value="Sage Green">Sylvan Sage Green</option>
                <option value="Slate Grey">Basalt Slate Grey</option>
              </select>
            </div>

            {/* Flooring */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Flooring Material</label>
              <select
                value={flooring}
                onChange={e => setFlooring(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm text-neutral-800 font-semibold bg-white cursor-pointer"
              >
                <option value="Italian Marble">Italian Premium Marble</option>
                <option value="Vitrified Tiles">Vitrified Dual-Charge Tiles</option>
                <option value="Hardwood Oak">Treated Oak Hardwood</option>
                <option value="Polished Concrete">Industrial Polished Concrete</option>
              </select>
            </div>

            {/* Roof */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Roof Design</label>
              <select
                value={roofType}
                onChange={e => setRoofType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm text-neutral-800 font-semibold bg-white cursor-pointer"
              >
                <option value="Flat RCC">Insulated Flat RCC Slab</option>
                <option value="Vaulted Wooden">Vaulted Exposed Pine Beams</option>
                <option value="Exposed Concrete">Industrial Raw Cast Concrete</option>
              </select>
            </div>

            {/* Lighting */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Lighting Config</label>
              <select
                value={lighting}
                onChange={e => setLighting(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm text-neutral-800 font-semibold bg-white cursor-pointer"
              >
                <option value="Warm LED Cove">Warm Indirect LED Cove</option>
                <option value="Ambient Chandelier">Classic Diffused Ambient</option>
                <option value="Minimalist Track">Dimmable Spot Track Lights</option>
              </select>
            </div>

            {/* Furniture Style */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Furniture Theme</label>
              <select
                value={furniture}
                onChange={e => setFurniture(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm text-neutral-800 font-semibold bg-white cursor-pointer"
              >
                <option value="Scandinavian">Scandinavian Minimalist (Oak)</option>
                <option value="Classic Mid-Century">Mid-Century Teak Wood</option>
                <option value="Contemporary Italian">Contemporary Metal & Leather</option>
              </select>
            </div>

            {/* Extra Structural parameters (Only for Hall/Exterior) */}
            {activeRoom === 'Exterior' && (
              <div className="space-y-4 pt-2 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">Landscape Garden</span>
                  <input
                    type="checkbox"
                    checked={hasGarden}
                    onChange={e => setHasGarden(e.target.checked)}
                    className="w-4 h-4 text-terracotta border-neutral-300 rounded focus:ring-terracotta"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">Plunge Pool</span>
                  <input
                    type="checkbox"
                    checked={hasPool}
                    onChange={e => setHasPool(e.target.checked)}
                    className="w-4 h-4 text-terracotta border-neutral-300 rounded focus:ring-terracotta"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateSuggestions}
            className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all shadow-premium hover:shadow-premium-hover flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-white" /> Generate AI Recommendations
          </button>
        </div>

      </div>

      <AiInsight
        insight="Selecting Vitrified Tiles instead of premium Marble cuts tile procurement costs by ₹1,12,000 and requires 4 days less labor for layout polishing."
        recommendation="Verify tile layouts in the bathroom and balcony sections to minimize joint cut waste before placing bulk material procurement orders."
        confidenceScore={94}
        impactValue="₹1,12,000 Saved"
      />
    </div>
  );
};
