import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, Info, RefreshCw, CheckCircle, Palette, Layers, Home, Sofa, Utensils, Bed, Bath, Sun, Sliders } from 'lucide-react';
import { AiInsight } from '../components/AiInsight';
import {
  BalconyStudioView,
  BathroomView,
  BedroomView,
  ExteriorVilla,
  KitchenView,
  LivingRoomView,
  type StudioDesign
} from '../components/studio/StudioPreviews';

/** Pre-curated Architectural Color Swatches */
const PALETTE_SWATCHES = [
  { name: 'Classic White', hex: '#FFFFFF' },
  { name: 'Warm Beige', hex: '#F5F5DC' },
  { name: 'Stone Taupe', hex: '#D7CCC8' },
  { name: 'Light Grey', hex: '#D3D3D3' },
  { name: 'Terracotta Clay', hex: '#C96F4A' },
  { name: 'Sage Green', hex: '#7BAE7F' },
  { name: 'Royal Blue', hex: '#6FA8DC' },
  { name: 'Charcoal Grey', hex: '#2B2B2E' },
];

const MATERIALS = ['Marble', 'Granite', 'Wood', 'Stone', 'Tile', 'Concrete', 'Textured Finish'];

const DEFAULT_DESIGN: StudioDesign = {
  wallColor: '#F5F5DC',
  accentColor: '#C96F4A',
  floorColor: '#F4F1EA',
  doorColor: '#5B3A29',
  windowColor: '#BFE3F2',
  balconyColor: '#D9D2C5',
  railingColor: '#2B2B2E',
  cabinetColor: '#7A5230',
  countertopColor: '#F4F1EA',
  curtainColor: '#6FA8DC',
  sofaTextileColor: '#E8DCC8',
  bedTextileColor: '#7BAE7F',
  tileColor: '#D9E4EC',
  woodColor: '#7A5230',

  material: 'Marble',
  floorMaterial: 'Marble',
  wallMaterial: 'Textured Finish',
  countertopMaterial: 'Marble',
};

export const AiDesignStudio: React.FC = () => {
  const [activeRoom, setActiveRoom] = useState<string>('Exterior');
  const [design, setDesign] = useState<StudioDesign>(DEFAULT_DESIGN);
  const set = (patch: Partial<StudioDesign>) => setDesign((p) => ({ ...p, ...patch }));
  const [generating, setGenerating] = useState<boolean>(false);

  const [aiAnalysis, setAiAnalysis] = useState<string>(
    "Selecting Marble flooring combined with Warm Beige walls reflects natural light effectively, reducing lighting power load by 14%. The Stone accent wall provides thermal inertia, maintaining optimal indoor comfort."
  );

  const rooms = [
    { name: 'Exterior', icon: Home },
    { name: 'Living Room', icon: Sofa },
    { name: 'Kitchen', icon: Utensils },
    { name: 'Bedroom', icon: Bed },
    { name: 'Bathroom', icon: Bath },
    { name: 'Balcony', icon: Sun },
  ];

  const handleGenerateSuggestions = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setAiAnalysis(
        `Optimized setup for ${activeRoom}: ${design.material} surface coupled with ${design.wallColor} color profile enhances structural aesthetic appeal and achieves a 15% improvement in thermal efficiency.`
      );
    }, 900);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-terracotta" /> AI Design Studio
          </h1>
          <p className="text-neutral-500 font-light mt-1">
            SparkTank Architectural Studio — Interactive visual design tool for complete residential homes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDesign(DEFAULT_DESIGN)}
          className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset Default Design
        </button>
      </div>

      {/* Room Selector Tab Row */}
      <div className="flex border-b border-neutral-200 overflow-x-auto pb-0.5 gap-2 scrollbar-none">
        {rooms.map((room) => {
          const Icon = room.icon;
          const isActive = activeRoom === room.name;
          return (
            <button
              key={room.name}
              onClick={() => setActiveRoom(room.name)}
              className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-terracotta text-terracotta bg-terracotta-50/20'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {room.name}
            </button>
          );
        })}
      </div>

      {/* Main Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Architectural Canvas Screen */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative rounded-3xl overflow-hidden border border-neutral-200/80 shadow-premium bg-white p-2.5">
            {/* Visualizer Frame */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-neutral-900 shadow-inner">
              <motion.div
                key={activeRoom + JSON.stringify(design)}
                initial={{ opacity: 0.8, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full"
              >
                {activeRoom === 'Exterior' && <ExteriorVilla d={design} />}
                {activeRoom === 'Living Room' && <LivingRoomView d={design} />}
                {activeRoom === 'Kitchen' && <KitchenView d={design} />}
                {activeRoom === 'Bedroom' && <BedroomView d={design} />}
                {activeRoom === 'Bathroom' && <BathroomView d={design} />}
                {activeRoom === 'Balcony' && <BalconyStudioView d={design} />}
              </motion.div>

              {/* Generating Overlay */}
              {generating && (
                <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-terracotta" />
                  <span className="text-sm font-bold tracking-wide">AI Calibrating Surface Textures & Lighting...</span>
                </div>
              )}

              {/* HUD Badge */}
              <div className="absolute top-4 left-4 p-3.5 rounded-xl glass-panel text-xs text-neutral-800 font-semibold space-y-1 shadow-md">
                <div>
                  Room View: <span className="text-terracotta font-bold">{activeRoom}</span>
                </div>
                <div>
                  Main Material: <span className="font-bold text-neutral-900">{design.material}</span>
                </div>
                <div>
                  Floor Material: <span className="font-bold text-neutral-900">{design.floorMaterial}</span>
                </div>
              </div>
            </div>

            {/* Render Metadata */}
            <div className="flex justify-between items-center mt-4 px-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                <Eye className="w-4 h-4 text-terracotta" /> SparkTank Architecture Canvas (Real-Time Vector Engine)
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> High Precision Vector Render
              </span>
            </div>
          </div>

          {/* AI Material Performance Explanation */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 tracking-wide uppercase border-b border-neutral-100 pb-3 flex items-center gap-1.5">
              <Info className="w-4.5 h-4.5 text-terracotta" /> AI Material Performance Rationale
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed font-light">{aiAnalysis}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Lighting Savings</span>
                <div className="text-base font-extrabold text-emerald-600 mt-0.5">14% Reduced</div>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">CO₂ Offset</span>
                <div className="text-base font-extrabold text-neutral-800 mt-0.5">15% Saved</div>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Thermal R-Value</span>
                <div className="text-base font-extrabold text-neutral-800 mt-0.5">3.9 (High)</div>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Acoustic Rating</span>
                <div className="text-base font-extrabold text-neutral-800 mt-0.5">44 dB</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Design Control Panel */}
        <div className="lg:col-span-4 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Palette className="w-5 h-5 text-terracotta" /> Aesthetic Controls
            </span>
            <span className="text-xs font-semibold text-neutral-400">Live Feedback</span>
          </h2>

          <div className="space-y-5 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
            {/* 1. Primary Surface Materials */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-terracotta" /> Primary Surface Materials
              </label>
              <div className="space-y-2">
                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold block mb-1">Main Finish Material</span>
                  <select
                    value={design.material}
                    aria-label="Main Finish Material"
                    onChange={(e) =>
                      set({
                        material: e.target.value,
                        wallMaterial: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold bg-white cursor-pointer"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold block mb-1">Floor Material</span>
                  <select
                    value={design.floorMaterial}
                    aria-label="Floor Material"
                    onChange={(e) => set({ floorMaterial: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold bg-white cursor-pointer"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold block mb-1">Countertop Material</span>
                  <select
                    value={design.countertopMaterial}
                    aria-label="Countertop Material"
                    onChange={(e) => set({ countertopMaterial: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold bg-white cursor-pointer"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Color Controls */}
            <div className="space-y-4">
              {/* Wall Color */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-neutral-600">Wall Color (wallColor)</label>
                  <input
                    type="color"
                    value={design.wallColor}
                    aria-label="Wall Color"
                    onChange={(e) => set({ wallColor: e.target.value.toUpperCase() })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {PALETTE_SWATCHES.map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      title={s.name}
                      onClick={() => set({ wallColor: s.hex })}
                      className={`w-6 h-6 rounded-full border transition-all ${
                        design.wallColor === s.hex ? 'ring-2 ring-terracotta scale-110' : 'border-neutral-300'
                      }`}
                      style={{ backgroundColor: s.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-neutral-600">Accent Color (accentColor)</label>
                  <input
                    type="color"
                    value={design.accentColor}
                    aria-label="Accent Color"
                    onChange={(e) => set({ accentColor: e.target.value.toUpperCase() })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {PALETTE_SWATCHES.map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      title={s.name}
                      onClick={() => set({ accentColor: s.hex })}
                      className={`w-6 h-6 rounded-full border transition-all ${
                        design.accentColor === s.hex ? 'ring-2 ring-terracotta scale-110' : 'border-neutral-300'
                      }`}
                      style={{ backgroundColor: s.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Floor Color */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-neutral-600">Floor Base (floorColor)</label>
                  <input
                    type="color"
                    value={design.floorColor}
                    aria-label="Floor Color"
                    onChange={(e) => set({ floorColor: e.target.value.toUpperCase() })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              {/* Door & Wood Color */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-600">Door Color (doorColor)</label>
                  <input
                    type="color"
                    value={design.doorColor}
                    aria-label="Door Color"
                    onChange={(e) => set({ doorColor: e.target.value.toUpperCase() })}
                    className="w-full h-8 rounded border border-neutral-200 cursor-pointer p-1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-600">Wood Finish (woodColor)</label>
                  <input
                    type="color"
                    value={design.woodColor}
                    aria-label="Wood Finish Color"
                    onChange={(e) => set({ woodColor: e.target.value.toUpperCase() })}
                    className="w-full h-8 rounded border border-neutral-200 cursor-pointer p-1"
                  />
                </div>
              </div>

              {/* Window & Balcony Color */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-600">Window Tint (windowColor)</label>
                  <input
                    type="color"
                    value={design.windowColor}
                    aria-label="Window Color"
                    onChange={(e) => set({ windowColor: e.target.value.toUpperCase() })}
                    className="w-full h-8 rounded border border-neutral-200 cursor-pointer p-1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-600">Balcony Base (balconyColor)</label>
                  <input
                    type="color"
                    value={design.balconyColor}
                    aria-label="Balcony Color"
                    onChange={(e) => set({ balconyColor: e.target.value.toUpperCase() })}
                    className="w-full h-8 rounded border border-neutral-200 cursor-pointer p-1"
                  />
                </div>
              </div>

              {/* Railing Color */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Balcony Railing (railingColor)</label>
                <select
                  value={design.railingColor}
                  aria-label="Railing Color"
                  onChange={(e) => set({ railingColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold bg-white cursor-pointer"
                >
                  <option value="#2B2B2E">Matte Black</option>
                  <option value="#9AA0A6">Steel Grey</option>
                  <option value="#7A5230">Warm Teak</option>
                  <option value="#FFFFFF">White</option>
                </select>
              </div>

              {/* Cabinet & Countertop Color */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-600">Cabinet (cabinetColor)</label>
                  <input
                    type="color"
                    value={design.cabinetColor}
                    aria-label="Cabinet Color"
                    onChange={(e) => set({ cabinetColor: e.target.value.toUpperCase() })}
                    className="w-full h-8 rounded border border-neutral-200 cursor-pointer p-1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-600">Countertop (countertopColor)</label>
                  <input
                    type="color"
                    value={design.countertopColor}
                    aria-label="Countertop Color"
                    onChange={(e) => set({ countertopColor: e.target.value.toUpperCase() })}
                    className="w-full h-8 rounded border border-neutral-200 cursor-pointer p-1"
                  />
                </div>
              </div>

              {/* Textiles (Curtains, Sofa, Bed) */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
                  Textile Controls
                </label>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-600">Curtains (curtainColor)</span>
                    <input
                      type="color"
                      value={design.curtainColor}
                      aria-label="Curtain Color"
                      onChange={(e) => set({ curtainColor: e.target.value.toUpperCase() })}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-600">Sofa Textile (sofaTextileColor)</span>
                    <input
                      type="color"
                      value={design.sofaTextileColor}
                      aria-label="Sofa Textile Color"
                      onChange={(e) => set({ sofaTextileColor: e.target.value.toUpperCase() })}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-600">Bed Textile (bedTextileColor)</span>
                    <input
                      type="color"
                      value={design.bedTextileColor}
                      aria-label="Bed Textile Color"
                      onChange={(e) => set({ bedTextileColor: e.target.value.toUpperCase() })}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                  </div>
                </div>
              </div>

              {/* Tile Color */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Tile Finish (tileColor)</label>
                <input
                  type="color"
                  value={design.tileColor}
                  aria-label="Tile Color"
                  onChange={(e) => set({ tileColor: e.target.value.toUpperCase() })}
                  className="w-full h-8 rounded border border-neutral-200 cursor-pointer p-1"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerateSuggestions}
            className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all shadow-premium hover:shadow-premium-hover flex items-center justify-center gap-1.5 cursor-pointer mt-4"
          >
            <Sparkles className="w-4 h-4 text-white" /> Generate AI Design Rationale
          </button>
        </div>
      </div>

      <AiInsight
        confidenceScore={96}
        insight="Selecting Vitrified Tiles instead of premium Marble cuts material procurement costs by ₹1,12,000 and requires 4 days less installation time."
        recommendation="Review tile layout specifications in wet areas (bathroom and balcony) to minimize joint cuts before confirming supplier orders."
      />
    </div>
  );
};
