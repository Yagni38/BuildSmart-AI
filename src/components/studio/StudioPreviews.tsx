import React from 'react';

export interface StudioDesign {
  // Colors
  wallColor: string;
  accentColor: string;
  floorColor: string;
  doorColor: string;
  windowColor: string;
  balconyColor: string;
  railingColor: string;
  cabinetColor: string;
  countertopColor: string;
  curtainColor: string;
  sofaTextileColor: string;
  bedTextileColor: string;
  tileColor: string;
  woodColor: string;

  // Materials
  material: string; // 'Marble' | 'Granite' | 'Wood' | 'Stone' | 'Tile' | 'Concrete' | 'Textured Finish'
  floorMaterial: string;
  wallMaterial: string;
  countertopMaterial: string;
}

export const shadeHex = (hex: string, percent: number): string => {
  try {
    const raw = hex.replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return hex;
    const amt = Math.round(2.55 * percent);
    const cl = (v: number) => Math.min(255, Math.max(0, v));
    const r = cl((num >> 16) + amt);
    const g = cl(((num >> 8) & 0xff) + amt);
    const b = cl((num & 0xff) + amt);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  } catch {
    return hex;
  }
};

/** High quality SVG Defs for Material Textures and Lighting Effects */
export const StudioMaterialDefs: React.FC = () => (
  <defs>
    {/* Glass Reflection & Glare */}
    <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
      <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.2" />
      <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.05" />
      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.35" />
    </linearGradient>

    {/* Sky Gradient */}
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#87CEEB" />
      <stop offset="40%" stopColor="#B0E0E6" />
      <stop offset="100%" stopColor="#E6F2FF" />
    </linearGradient>

    {/* Soft Drop Shadow Filter */}
    <filter id="softShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.25" />
    </filter>
    <filter id="cardShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.15" />
    </filter>

    {/* Wall Lighting Gradient */}
    <linearGradient id="wallLight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
      <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
    </linearGradient>

    {/* 1. Marble Pattern */}
    <pattern id="pat-marble" width="120" height="120" patternUnits="userSpaceOnUse">
      <path d="M 10 30 Q 30 10 60 40 T 110 20 M 20 80 Q 50 110 80 70 T 120 100" stroke="rgba(100,100,100,0.3)" strokeWidth="1.8" fill="none" />
      <path d="M 0 60 Q 40 30 70 80 T 100 40" stroke="rgba(160,160,160,0.2)" strokeWidth="1.2" fill="none" />
    </pattern>

    {/* 2. Granite Pattern */}
    <pattern id="pat-granite" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1.5" fill="rgba(0,0,0,0.4)" />
      <circle cx="14" cy="9" r="1.2" fill="rgba(255,255,255,0.5)" />
      <circle cx="8" cy="18" r="1.6" fill="rgba(40,40,40,0.45)" />
      <circle cx="19" cy="20" r="1.1" fill="rgba(0,0,0,0.3)" />
      <circle cx="2" cy="14" r="0.9" fill="rgba(255,255,255,0.6)" />
    </pattern>

    {/* 3. Wood Pattern */}
    <pattern id="pat-wood" width="160" height="32" patternUnits="userSpaceOnUse">
      <line x1="0" y1="6" x2="160" y2="6" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" />
      <line x1="0" y1="16" x2="160" y2="16" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
      <line x1="0" y1="26" x2="160" y2="26" stroke="rgba(0,0,0,0.16)" strokeWidth="1.2" />
      <path d="M 40 0 C 52 10, 52 22, 40 32 M 120 0 C 132 10, 132 22, 120 32" stroke="rgba(0,0,0,0.08)" strokeWidth="1.2" fill="none" />
    </pattern>

    {/* 4. Stone Pattern */}
    <pattern id="pat-stone" width="70" height="45" patternUnits="userSpaceOnUse">
      <rect x="2" y="2" width="30" height="18" rx="3" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
      <rect x="36" y="2" width="30" height="18" rx="3" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
      <rect x="20" y="24" width="30" height="18" rx="3" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
    </pattern>

    {/* 5. Tile Pattern */}
    <pattern id="pat-tile" width="45" height="45" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="45" height="45" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
    </pattern>

    {/* 6. Concrete Pattern */}
    <pattern id="pat-concrete" width="32" height="32" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="1.1" fill="rgba(0,0,0,0.22)" />
      <circle cx="20" cy="14" r="1.3" fill="rgba(255,255,255,0.25)" />
      <circle cx="24" cy="26" r="0.9" fill="rgba(0,0,0,0.2)" />
      <circle cx="12" cy="24" r="1.1" fill="rgba(0,0,0,0.15)" />
    </pattern>

    {/* 7. Textured Finish Pattern */}
    <pattern id="pat-textured" width="18" height="18" patternUnits="userSpaceOnUse">
      <path d="M 2 2 L 5 5 M 12 4 L 9 7 M 14 13 L 16 11 M 4 13 L 7 15" stroke="rgba(0,0,0,0.16)" strokeWidth="1.2" fill="none" />
    </pattern>
  </defs>
);

/** Helper to get texture overlay SVG pattern fill */
export function getMaterialOverlay(materialName?: string): string {
  switch (String(materialName || '').toLowerCase()) {
    case 'marble': return 'url(#pat-marble)';
    case 'granite': return 'url(#pat-granite)';
    case 'wood': return 'url(#pat-wood)';
    case 'stone': return 'url(#pat-stone)';
    case 'tile': return 'url(#pat-tile)';
    case 'concrete': return 'url(#pat-concrete)';
    case 'textured finish':
    case 'textured': return 'url(#pat-textured)';
    default: return 'none';
  }
}

/* =========================================================================
   1. EXTERIOR VILLA PREVIEW (Professional Multi-Storey Architecture)
   ========================================================================= */
export const ExteriorVilla: React.FC<{ d: StudioDesign }> = ({ d }) => {
  const wall = d.wallColor || '#F5F5DC';
  const accent = d.accentColor || '#C96F4A';
  const door = d.doorColor || '#5B3A29';
  const windowTint = d.windowColor || '#BFE3F2';
  const balcony = d.balconyColor || '#D9D2C5';
  const railing = d.railingColor || '#2B2B2E';
  const floor = d.floorColor || '#B9B0A6';
  const matOverlay = getMaterialOverlay(d.material);

  return (
    <svg viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" className="w-full h-full" role="img" aria-label="Professional Villa Exterior Render">
      <StudioMaterialDefs />
      {/* Sky */}
      <rect x="0" y="0" width="1200" height="750" fill="url(#skyGrad)" />
      <circle cx="160" cy="100" r="55" fill="#FFEAA5" opacity="0.85" />

      {/* Lawn Ground */}
      <rect x="0" y="590" width="1200" height="160" fill="#507A36" />
      {/* Entrance Driveway */}
      <polygon points="380,750 740,750 680,590 440,590" fill={floor} stroke={shadeHex(floor, -25)} strokeWidth="3" />
      <polygon points="380,750 740,750 680,590 440,590" fill={getMaterialOverlay(d.floorMaterial)} opacity="0.6" />

      {/* Main Building Block */}
      <rect x="270" y="180" width="620" height="410" fill={wall} stroke={shadeHex(wall, -30)} strokeWidth="4" filter="url(#softShadow)" />
      <rect x="270" y="180" width="620" height="410" fill={matOverlay} opacity="0.55" />

      {/* Vertical Feature Accent Tower */}
      <rect x="270" y="180" width="180" height="410" fill={accent} stroke={shadeHex(accent, -30)} strokeWidth="4" />
      <rect x="270" y="180" width="180" height="410" fill={getMaterialOverlay('Stone')} opacity="0.5" />

      {/* Side Garage / Annex */}
      <rect x="890" y="310" width="170" height="280" fill={shadeHex(wall, -10)} stroke={shadeHex(wall, -30)} strokeWidth="4" />
      <rect x="890" y="310" width="170" height="280" fill={matOverlay} opacity="0.5" />
      {/* Garage Door */}
      <rect x="910" y="410" width="130" height="180" rx="4" fill="#3A3A3D" stroke="#1C1C1E" strokeWidth="4" />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1="910" y1={435 + i * 22} x2="1040" y2={435 + i * 22} stroke="#5C5C60" strokeWidth="2" />
      ))}

      {/* Roof Parapet Top Band */}
      <rect x="250" y="155" width="660" height="28" rx="4" fill="#2B2B2E" />
      <rect x="875" y="288" width="200" height="24" rx="4" fill="#2B2B2E" />

      {/* First Floor Large Panoramic Window */}
      <rect x="490" y="220" width="370" height="140" rx="8" fill={windowTint} stroke="#222225" strokeWidth="7" />
      <rect x="490" y="220" width="370" height="140" rx="8" fill="url(#glassSheen)" />
      <line x1="675" y1="220" x2="675" y2="360" stroke="#222225" strokeWidth="4" />

      {/* First Floor Accent Tower Narrow Window */}
      <rect x="310" y="220" width="100" height="140" rx="6" fill={windowTint} stroke="#222225" strokeWidth="6" />
      <rect x="310" y="220" width="100" height="140" rx="6" fill="url(#glassSheen)" />

      {/* Cantilevered Balcony Slab */}
      <rect x="475" y="385" width="395" height="26" rx="4" fill={balcony} stroke={shadeHex(balcony, -30)} strokeWidth="4" filter="url(#cardShadow)" />
      <rect x="475" y="385" width="395" height="26" rx="4" fill={getMaterialOverlay('Concrete')} opacity="0.4" />

      {/* Balcony Railing */}
      {Array.from({ length: 20 }).map((_, i) => (
        <line key={i} x1={485 + i * 20} y1={325} x2={485 + i * 20} y2={385} stroke={railing} strokeWidth="4" />
      ))}
      <rect x="478" y="320" width="390" height="10" rx="5" fill={shadeHex(railing, 15)} stroke={shadeHex(railing, -15)} strokeWidth="2" />

      {/* Entrance Main Door */}
      <rect x="495" y="450" width="110" height="140" rx="6" fill={door} stroke={shadeHex(door, -30)} strokeWidth="5" />
      <rect x="495" y="450" width="110" height="140" fill={getMaterialOverlay('Wood')} opacity="0.4" />
      <circle cx="590" cy="525" r="5.5" fill="#FFD66B" stroke="#3A2A1A" strokeWidth="2" />

      {/* Ground Floor Living Sliding Glass Doors */}
      <rect x="635" y="450" width="225" height="140" rx="6" fill={windowTint} stroke="#222225" strokeWidth="7" />
      <rect x="635" y="450" width="225" height="140" rx="6" fill="url(#glassSheen)" />
      <line x1="747" y1="450" x2="747" y2="590" stroke="#222225" strokeWidth="4" />

      {/* Entrance Porch Steps */}
      <rect x="480" y="590" width="140" height="15" fill="#B9B0A6" stroke="#7A736B" strokeWidth="1" />
      <rect x="470" y="605" width="160" height="15" fill="#CFC7BD" stroke="#7A736B" strokeWidth="1" />

      {/* Foliage Plants */}
      <ellipse cx="160" cy="610" rx="85" ry="35" fill="#3D5C28" />
      <ellipse cx="230" cy="625" rx="55" ry="28" fill="#507A36" />
      <ellipse cx="1040" cy="615" rx="95" ry="40" fill="#3D5C28" />
    </svg>
  );
};

/* =========================================================================
   2. LIVING ROOM PREVIEW
   ========================================================================= */
export const LivingRoomView: React.FC<{ d: StudioDesign }> = ({ d }) => {
  const wall = d.wallColor || '#F5F5DC';
  const accent = d.accentColor || '#C96F4A';
  const floor = d.floorColor || '#F4F1EA';
  const sofa = d.sofaTextileColor || '#E8DCC8';
  const curtain = d.curtainColor || '#6FA8DC';
  const windowTint = d.windowColor || '#BFE3F2';
  const wood = d.woodColor || '#5B3A29';

  return (
    <svg viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" className="w-full h-full" role="img" aria-label="Professional Living Room Render">
      <StudioMaterialDefs />
      {/* Back Main Wall */}
      <rect x="0" y="0" width="1200" height="510" fill={wall} />
      <rect x="0" y="0" width="1200" height="510" fill="url(#wallLight)" />
      <rect x="0" y="0" width="1200" height="510" fill={getMaterialOverlay(d.wallMaterial)} opacity="0.35" />

      {/* Feature Accent Wall */}
      <rect x="840" y="0" width="360" height="510" fill={accent} />
      <rect x="840" y="0" width="360" height="510" fill={getMaterialOverlay('Stone')} opacity="0.55" />

      {/* Floor */}
      <rect x="0" y="510" width="1200" height="240" fill={floor} stroke={shadeHex(floor, -25)} strokeWidth="2" />
      <rect x="0" y="510" width="1200" height="240" fill={getMaterialOverlay(d.floorMaterial)} opacity="0.75" />

      {/* Large Window */}
      <rect x="410" y="140" width="380" height="250" rx="8" fill={windowTint} stroke="#2B2B2E" strokeWidth="8" />
      <rect x="410" y="140" width="380" height="250" rx="8" fill="url(#glassSheen)" />
      <line x1="600" y1="140" x2="600" y2="390" stroke="#2B2B2E" strokeWidth="4" />

      {/* Floor-to-Ceiling Curtains */}
      <rect x="340" y="100" width="100" height="410" fill={curtain} filter="url(#softShadow)" />
      <rect x="750" y="100" width="100" height="410" fill={curtain} filter="url(#softShadow)" />
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={i} x1={365 + i * 20} y1="100" x2={365 + i * 20} y2="510" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={i} x1={775 + i * 20} y1="100" x2={775 + i * 20} y2="510" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
      ))}

      {/* Modern Sectional Sofa */}
      <rect x="260" y="410" width="600" height="150" rx="22" fill={sofa} stroke={shadeHex(sofa, -30)} strokeWidth="5" filter="url(#softShadow)" />
      <rect x="280" y="430" width="260" height="100" rx="14" fill={shadeHex(sofa, 10)} stroke={shadeHex(sofa, -20)} strokeWidth="2" />
      <rect x="560" y="430" width="280" height="100" rx="14" fill={shadeHex(sofa, 10)} stroke={shadeHex(sofa, -20)} strokeWidth="2" />

      {/* Throw Cushions */}
      <rect x="310" y="440" width="75" height="55" rx="12" fill={curtain} />
      <rect x="740" y="440" width="75" height="55" rx="12" fill={accent} />

      {/* Coffee Table */}
      <rect x="420" y="570" width="280" height="45" rx="8" fill={wood} stroke={shadeHex(wood, -30)} strokeWidth="4" filter="url(#cardShadow)" />
      <rect x="420" y="570" width="280" height="45" rx="8" fill={getMaterialOverlay('Wood')} opacity="0.4" />
      <rect x="445" y="615" width="18" height="50" fill="#2E2320" />
      <rect x="657" y="615" width="18" height="50" fill="#2E2320" />

      {/* Wall Art Frame on Accent Wall */}
      <rect x="900" y="130" width="240" height="170" fill="#FFFFFF" stroke="#2B2B2E" strokeWidth="7" filter="url(#cardShadow)" />
      <circle cx="1020" cy="215" r="50" fill={accent} />
      <polygon points="950,245 1020,165 1090,245" fill={sofa} opacity="0.85" />
    </svg>
  );
};

/* =========================================================================
   3. BEDROOM PREVIEW
   ========================================================================= */
export const BedroomView: React.FC<{ d: StudioDesign }> = ({ d }) => {
  const wall = d.wallColor || '#FFFDD0';
  const accent = d.accentColor || '#C96F4A';
  const floor = d.floorColor || '#B98A5A';
  const bedTextile = d.bedTextileColor || '#7BAE7F';
  const wardrobeWood = d.woodColor || '#7A5230';
  const curtain = d.curtainColor || '#6FA8DC';
  const windowTint = d.windowColor || '#BFE3F2';

  return (
    <svg viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" className="w-full h-full" role="img" aria-label="Professional Bedroom Render">
      <StudioMaterialDefs />
      {/* Wall */}
      <rect x="0" y="0" width="1200" height="510" fill={wall} />
      <rect x="0" y="0" width="1200" height="510" fill="url(#wallLight)" />

      {/* Headboard Accent Wall Panel */}
      <rect x="270" y="40" width="660" height="470" fill={accent} />
      <rect x="270" y="40" width="660" height="470" fill={getMaterialOverlay('Textured Finish')} opacity="0.45" />

      {/* Floor */}
      <rect x="0" y="510" width="1200" height="240" fill={floor} stroke={shadeHex(floor, -25)} strokeWidth="2" />
      <rect x="0" y="510" width="1200" height="240" fill={getMaterialOverlay(d.floorMaterial)} opacity="0.8" />

      {/* Window & Curtains */}
      <rect x="60" y="130" width="180" height="260" fill={windowTint} stroke="#2B2B2E" strokeWidth="6" />
      <rect x="60" y="130" width="180" height="260" fill="url(#glassSheen)" />
      <rect x="40" y="90" width="80" height="420" fill={curtain} filter="url(#softShadow)" />

      {/* Wardrobe Cabinet */}
      <rect x="950" y="90" width="210" height="420" fill={wardrobeWood} stroke={shadeHex(wardrobeWood, -30)} strokeWidth="5" filter="url(#cardShadow)" />
      <rect x="950" y="90" width="210" height="420" fill={getMaterialOverlay('Wood')} opacity="0.45" />
      <line x1="1055" y1="90" x2="1055" y2="510" stroke="#3D291C" strokeWidth="3" />
      <rect x="1040" y="270" width="6" height="45" rx="2" fill="#D7CCC8" />
      <rect x="1064" y="270" width="6" height="45" rx="2" fill="#D7CCC8" />

      {/* Padded Bed Headboard */}
      <rect x="350" y="280" width="500" height="160" rx="16" fill="#3D291C" stroke="#231710" strokeWidth="5" filter="url(#cardShadow)" />

      {/* King Bed Base & Mattress */}
      <rect x="310" y="420" width="580" height="140" rx="18" fill={bedTextile} stroke={shadeHex(bedTextile, -30)} strokeWidth="5" filter="url(#softShadow)" />
      {/* Pillows */}
      <rect x="335" y="370" width="250" height="75" rx="14" fill="#FFFFFF" stroke="#D3D3D3" strokeWidth="2" />
      <rect x="615" y="370" width="250" height="75" rx="14" fill="#FFFFFF" stroke="#D3D3D3" strokeWidth="2" />

      {/* Bedside Nightstands */}
      <rect x="235" y="450" width="75" height="90" rx="8" fill={wardrobeWood} />
      <rect x="890" y="450" width="75" height="90" rx="8" fill={wardrobeWood} />
    </svg>
  );
};

/* =========================================================================
   4. KITCHEN PREVIEW
   ========================================================================= */
export const KitchenView: React.FC<{ d: StudioDesign }> = ({ d }) => {
  const cabinet = d.cabinetColor || '#7A5230';
  const countertop = d.countertopColor || '#F4F1EA';
  const backsplash = d.tileColor || '#D9E4EC';
  const floor = d.floorColor || '#B9B0A6';
  const wall = d.wallColor || '#F5F5DC';

  return (
    <svg viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" className="w-full h-full" role="img" aria-label="Professional Kitchen Render">
      <StudioMaterialDefs />
      {/* Upper Wall */}
      <rect x="0" y="0" width="1200" height="470" fill={wall} />

      {/* Tiled Backsplash */}
      <rect x="0" y="210" width="1200" height="190" fill={backsplash} />
      <rect x="0" y="210" width="1200" height="190" fill={getMaterialOverlay('Tile')} opacity="0.65" />

      {/* Floor */}
      <rect x="0" y="470" width="1200" height="280" fill={floor} />
      <rect x="0" y="470" width="1200" height="280" fill={getMaterialOverlay(d.floorMaterial)} opacity="0.75" />

      {/* Upper Hanging Cabinets */}
      <rect x="50" y="60" width="1100" height="150" rx="8" fill={cabinet} stroke={shadeHex(cabinet, -30)} strokeWidth="4" filter="url(#cardShadow)" />
      <rect x="50" y="60" width="1100" height="150" fill={getMaterialOverlay('Wood')} opacity="0.35" />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={60 + i * 181} y="70" width="170" height="130" rx="4" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
      ))}

      {/* Lower Base Cabinets */}
      <rect x="50" y="430" width="1100" height="150" fill={cabinet} stroke={shadeHex(cabinet, -30)} strokeWidth="4" filter="url(#softShadow)" />
      <rect x="50" y="430" width="1100" height="150" fill={getMaterialOverlay('Wood')} opacity="0.35" />

      {/* Countertop Slab */}
      <rect x="30" y="398" width="1140" height="34" rx="4" fill={countertop} stroke={shadeHex(countertop, -25)} strokeWidth="3" filter="url(#cardShadow)" />
      <rect x="30" y="398" width="1140" height="34" fill={getMaterialOverlay(d.countertopMaterial)} opacity="0.85" />

      {/* Electric Cooktop & Stainless Sink */}
      <rect x="190" y="400" width="240" height="14" rx="3" fill="#29292B" />
      <circle cx="240" cy="407" r="4.5" fill="#666" />
      <circle cx="380" cy="407" r="4.5" fill="#666" />

      <rect x="760" y="400" width="220" height="15" rx="3" fill="#9AA0A6" stroke="#555" strokeWidth="1" />

      {/* Sleek Handles */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={135 + i * 181} y="455" width="32" height="9" rx="2" fill="#D7CCC8" stroke="#444" strokeWidth="1" />
      ))}
    </svg>
  );
};

/* =========================================================================
   5. BATHROOM PREVIEW
   ========================================================================= */
export const BathroomView: React.FC<{ d: StudioDesign }> = ({ d }) => {
  const tile = d.tileColor || '#D9E4EC';
  const accent = d.accentColor || '#C96F4A';
  const floor = d.floorColor || '#9AA0A6';
  const vanity = d.woodColor || '#B98A5A';
  const windowTint = d.windowColor || '#BFE3F2';

  return (
    <svg viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" className="w-full h-full" role="img" aria-label="Professional Bathroom Render">
      <StudioMaterialDefs />
      {/* Wall Tiles */}
      <rect x="0" y="0" width="1200" height="540" fill={tile} />
      <rect x="0" y="0" width="1200" height="540" fill={getMaterialOverlay('Tile')} opacity="0.75" />

      {/* Accent Feature Shower Wall */}
      <rect x="770" y="0" width="430" height="540" fill={accent} />
      <rect x="770" y="0" width="430" height="540" fill={getMaterialOverlay('Stone')} opacity="0.6" />

      {/* Floor */}
      <rect x="0" y="540" width="1200" height="210" fill={floor} stroke={shadeHex(floor, -25)} strokeWidth="2" />
      <rect x="0" y="540" width="1200" height="210" fill={getMaterialOverlay(d.floorMaterial)} opacity="0.8" />

      {/* Floating Vanity Unit */}
      <rect x="170" y="360" width="360" height="180" rx="10" fill={vanity} stroke={shadeHex(vanity, -30)} strokeWidth="4" filter="url(#softShadow)" />
      <rect x="170" y="360" width="360" height="180" fill={getMaterialOverlay('Wood')} opacity="0.4" />

      {/* Marble Countertop & Basin */}
      <rect x="150" y="338" width="400" height="26" rx="4" fill="#FFFFFF" stroke="#CCC" strokeWidth="2" />
      <rect x="150" y="338" width="400" height="26" fill={getMaterialOverlay(d.countertopMaterial)} opacity="0.7" />
      <ellipse cx="350" cy="348" rx="75" ry="11" fill="#EAEAEA" stroke="#999" strokeWidth="1" />

      {/* Illuminated Round Mirror */}
      <circle cx="350" cy="190" r="110" fill="#E4F1F9" stroke="#333" strokeWidth="7" filter="url(#cardShadow)" />
      <circle cx="350" cy="190" r="110" fill="url(#glassSheen)" />

      {/* Glass Shower Enclosure Door */}
      <rect x="755" y="0" width="12" height="540" fill="#2E2E30" />
      <rect x="767" y="20" width="413" height="520" fill={windowTint} opacity="0.35" stroke="#A0C4E2" strokeWidth="2" />
      <circle cx="980" cy="110" r="32" fill="#D3D3D3" stroke="#777" strokeWidth="3" />
    </svg>
  );
};

/* =========================================================================
   6. BALCONY PREVIEW
   ========================================================================= */
export const BalconyStudioView: React.FC<{ d: StudioDesign }> = ({ d }) => {
  const wall = d.wallColor || '#F5F5DC';
  const accent = d.accentColor || '#C96F4A';
  const balconyFloor = d.balconyColor || '#D9D2C5';
  const railing = d.railingColor || '#2B2B2E';
  const sofa = d.sofaTextileColor || '#E8DCC8';
  const windowTint = d.windowColor || '#BFE3F2';

  return (
    <svg viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" className="w-full h-full" role="img" aria-label="Professional Balcony Render">
      <StudioMaterialDefs />
      {/* Sunset Sky Background */}
      <rect x="0" y="0" width="1200" height="420" fill="url(#skyGrad)" />
      <circle cx="960" cy="130" r="65" fill="#FFE28A" opacity="0.9" />

      {/* Building Exterior Walls Frame */}
      <rect x="0" y="0" width="240" height="420" fill={accent} />
      <rect x="960" y="0" width="240" height="420" fill={wall} />

      {/* Balcony Deck Floor */}
      <rect x="0" y="420" width="1200" height="330" fill={balconyFloor} stroke={shadeHex(balconyFloor, -25)} strokeWidth="4" />
      <rect x="0" y="420" width="1200" height="330" fill={getMaterialOverlay(d.floorMaterial)} opacity="0.75" />

      {/* Sliding Glass Doors Behind Balcony */}
      <rect x="240" y="50" width="720" height="370" rx="8" fill={windowTint} stroke="#2B2B2E" strokeWidth="8" />
      <rect x="240" y="50" width="720" height="370" rx="8" fill="url(#glassSheen)" />
      <line x1="600" y1="50" x2="600" y2="420" stroke="#2B2B2E" strokeWidth="5" />

      {/* Balcony Railing Top Bar */}
      <rect x="0" y="430" width="1200" height="20" rx="6" fill={shadeHex(railing, 15)} stroke={shadeHex(railing, -15)} strokeWidth="2" filter="url(#cardShadow)" />

      {/* Vertical Railing Bars */}
      {Array.from({ length: 26 }).map((_, i) => (
        <rect key={i} x={20 + i * 46} y={450} width="11" height="140" fill={railing} />
      ))}

      {/* Outdoor Seating Lounge */}
      <rect x="680" y="540" width="320" height="110" rx="20" fill={sofa} stroke={shadeHex(sofa, -30)} strokeWidth="5" filter="url(#softShadow)" />
      <rect x="700" y="560" width="130" height="65" rx="12" fill={d.bedTextileColor || '#7BAE7F'} />
      <rect x="850" y="560" width="130" height="65" rx="12" fill={accent} />

      {/* Planter Pots & Foliage */}
      <ellipse cx="170" cy="610" rx="75" ry="50" fill="#4B7A38" />
      <rect x="140" y="630" width="60" height="75" rx="6" fill="#C96F4A" stroke="#8A482E" strokeWidth="2" />
    </svg>
  );
};
