/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PhotoFrameStyle } from '../types/timeline';
import { roundRect, drawFittedImage } from './animationLibrary';
import { getRenderPerformanceFlags } from './devicePerformance';

export interface FramePalette {
  id: string;
  name: string;
  nameBn: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
}

export type FrameShuffleMode = 'all_dynamic' | 'film_polaroid' | 'neon_glass' | 'royal_luxury';

export interface FrameShufflePreset {
  id: FrameShuffleMode;
  name: string;
  nameBn: string;
  description: string;
}

export const FRAME_SHUFFLE_PRESETS: FrameShufflePreset[] = [
  {
    id: 'all_dynamic',
    name: 'Dynamic Mix',
    nameBn: 'Dynamic Mix',
    description: 'Dynamic alternating frames and colors'
  },
  {
    id: 'film_polaroid',
    name: 'Film Polaroid',
    nameBn: 'Film Polaroid',
    description: 'Cinema filmstrip and vintage polaroid styles'
  },
  {
    id: 'neon_glass',
    name: 'Neon Glass',
    nameBn: 'Neon Glass',
    description: 'Cyber neon glow and frosted glass'
  },
  {
    id: 'royal_luxury',
    name: 'Royal Luxury',
    nameBn: 'Royal Luxury',
    description: 'Metallic gold and luxury outlines'
  }
];

export const FRAME_COLOR_PALETTES: FramePalette[] = [
  {
    id: 'all_dynamic',
    name: 'Dynamic Mix',
    nameBn: 'Dynamic Mix',
    primary: '#06b6d4',
    secondary: '#8b5cf6',
    accent: '#fef08a',
    glow: 'rgba(6, 182, 212, 0.55)'
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    nameBn: 'Cyber Neon',
    primary: '#06b6d4',
    secondary: '#0284c7',
    accent: '#67e8f9',
    glow: 'rgba(6, 182, 212, 0.55)'
  },
  {
    id: 'ruby_crimson',
    name: 'Ruby Crimson',
    nameBn: 'Ruby Crimson',
    primary: '#ef4444',
    secondary: '#b91c1c',
    accent: '#fecdd3',
    glow: 'rgba(239, 68, 68, 0.5)'
  },
  {
    id: 'emerald_jade',
    name: 'Emerald Jade',
    nameBn: 'Emerald Jade',
    primary: '#10b981',
    secondary: '#047857',
    accent: '#a7f3d0',
    glow: 'rgba(16, 185, 129, 0.5)'
  },
  {
    id: 'royal_gold',
    name: 'Royal Gold',
    nameBn: 'Royal Gold',
    primary: '#f59e0b',
    secondary: '#d97706',
    accent: '#fef08a',
    glow: 'rgba(245, 158, 11, 0.45)'
  },
  {
    id: 'rose_gold',
    name: 'Rose Gold',
    nameBn: 'Rose Gold',
    primary: '#f43f5e',
    secondary: '#be123c',
    accent: '#ffe4e6',
    glow: 'rgba(244, 63, 94, 0.45)'
  },
  {
    id: 'electric_violet',
    name: 'Electric Violet',
    nameBn: 'Electric Violet',
    primary: '#8b5cf6',
    secondary: '#6d28d9',
    accent: '#ddd6fe',
    glow: 'rgba(139, 92, 246, 0.5)'
  },
  {
    id: 'sunset_amber',
    name: 'Sunset Amber',
    nameBn: 'Sunset Amber',
    primary: '#f97316',
    secondary: '#c2410c',
    accent: '#fed7aa',
    glow: 'rgba(249, 115, 22, 0.45)'
  },
  {
    id: 'sapphire_blue',
    name: 'Sapphire Blue',
    nameBn: 'Sapphire Blue',
    primary: '#2563eb',
    secondary: '#1d4ed8',
    accent: '#bfdbfe',
    glow: 'rgba(37, 99, 235, 0.45)'
  },
  {
    id: 'platinum_silver',
    name: 'Platinum White',
    nameBn: 'Platinum White',
    primary: '#ffffff',
    secondary: '#f1f5f9',
    accent: '#ffffff',
    glow: 'rgba(255, 255, 255, 0.75)'
  },
  {
    id: 'obsidian_noir',
    name: 'Obsidian Noir',
    nameBn: 'Obsidian Noir',
    primary: '#0f172a',
    secondary: '#1e293b',
    accent: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.35)'
  }
];

export const PHOTO_FRAME_STYLES: { id: PhotoFrameStyle; name: string; description: string }[] = [
  { id: 'dashed_filmstrip', name: 'Cinema Filmstrip', description: 'Perforated film sprocket holes & authentic cinema negative border' },
  { id: 'polaroid_vintage', name: 'Vintage Polaroid', description: 'Classic instant photo with authentic paper chin & soft shadow' },
  { id: 'neon_cyber_glow', name: 'Neon Glow', description: 'Vibrant multi-stage electric neon glow & glowing corner nodes' },
  { id: 'frosted_glass', name: 'Frosted Glass', description: 'Translucent frosted glass border with specular glint & corner brackets' },
  { id: 'metallic_gold', name: 'Royal Gold', description: 'Multi-layer engraved gold border with beveled ornaments' },
  { id: 'gradient_duotone', name: 'Duotone Gradient', description: 'Diagonal 45° color transition with radiant ambient aura' },
  { id: 'holographic_prism', name: 'Holographic Prism', description: 'Multi-spectrum rainbow iridescent shimmer sheen' },
  { id: 'sleek_dark_neon', name: 'Obsidian Noir', description: 'Deep obsidian bezel with high-contrast electric neon pinstripe' },
  { id: 'double_outline', name: 'Dual Contour', description: 'Dual floating precision border rings with corner notches' },
  { id: 'postage_stamp', name: 'Collector Stamp', description: 'Scalloped stamp perforations with collectible vintage look' },
  { id: 'classic_modern', name: 'Modern Studio', description: 'Clean modern gallery frame with crisp bevel' }
];

// Rich diverse palette list (excluding the 'all_dynamic' meta item)
const PALETTES_POOL = FRAME_COLOR_PALETTES.filter((p) => p.id !== 'all_dynamic');

// Saturated vibrant color palettes
const VIBRANT_PALETTES: FramePalette[] = [
  FRAME_COLOR_PALETTES.find((p) => p.id === 'cyber_neon') || PALETTES_POOL[0],
  FRAME_COLOR_PALETTES.find((p) => p.id === 'ruby_crimson') || PALETTES_POOL[1],
  FRAME_COLOR_PALETTES.find((p) => p.id === 'royal_gold') || PALETTES_POOL[2],
  FRAME_COLOR_PALETTES.find((p) => p.id === 'emerald_jade') || PALETTES_POOL[3],
  FRAME_COLOR_PALETTES.find((p) => p.id === 'electric_violet') || PALETTES_POOL[4],
  FRAME_COLOR_PALETTES.find((p) => p.id === 'sunset_amber') || PALETTES_POOL[5],
  FRAME_COLOR_PALETTES.find((p) => p.id === 'rose_gold') || PALETTES_POOL[6],
  FRAME_COLOR_PALETTES.find((p) => p.id === 'sapphire_blue') || PALETTES_POOL[7]
];

// Crisp White / Platinum palette for alternating contrast
const WHITE_PLATINUM_PALETTE: FramePalette = {
  id: 'platinum_silver',
  name: 'Platinum White',
  nameBn: 'Platinum White',
  primary: '#ffffff',
  secondary: '#f1f5f9',
  accent: '#ffffff',
  glow: 'rgba(255, 255, 255, 0.75)'
};

/**
 * Intelligent Smart Random Frame & Color Configuration
 * Generates alternating White & Vibrant Color combinations with diverse frame structures
 * so every consecutive photo changes dynamically (White -> Color -> White -> Color).
 */
export const getRandomFrameConfig = (
  slotIndex = 0,
  themeId = 'all_dynamic',
  mode: FrameShuffleMode = 'all_dynamic'
): {
  frameStyle: PhotoFrameStyle;
  frameColor: string;
  frameAccentColor: string;
  glowColor?: string;
} => {
  // 1. Check if themeId is a specific individual frame style
  const isSpecificStyle = PHOTO_FRAME_STYLES.some((s) => s.id === themeId);
  const isSpecificPalette = FRAME_COLOR_PALETTES.some((p) => p.id === themeId && p.id !== 'all_dynamic');
  const activeMode = (themeId === 'film_polaroid' || themeId === 'neon_glass' || themeId === 'royal_luxury')
    ? themeId as FrameShuffleMode
    : mode;

  let frameStyle: PhotoFrameStyle;
  let palette: FramePalette;

  if (isSpecificStyle) {
    frameStyle = themeId as PhotoFrameStyle;
    // Strictly alternate between White and Vibrant Colors even for an individual frame style
    if (slotIndex % 2 === 0) {
      palette = WHITE_PLATINUM_PALETTE; // White (Classic White paper/border)
    } else {
      palette = VIBRANT_PALETTES[Math.floor(slotIndex / 2) % VIBRANT_PALETTES.length]; // Rich saturated color
    }
  } else if (isSpecificPalette) {
    palette = FRAME_COLOR_PALETTES.find((p) => p.id === themeId) || PALETTES_POOL[0];
    const allStyles: PhotoFrameStyle[] = [
      'neon_cyber_glow',
      'polaroid_vintage',
      'metallic_gold',
      'dashed_filmstrip',
      'frosted_glass',
      'gradient_duotone',
      'classic_modern',
      'double_outline',
      'sleek_dark_neon',
      'postage_stamp'
    ];
    frameStyle = allStyles[slotIndex % allStyles.length];
  } else if (activeMode === 'film_polaroid') {
    // Cinema & Polaroid mode: Alternates between White Polaroid / Glass and Colorful Instax / 35mm filmstrip
    if (slotIndex % 2 === 0) {
      palette = WHITE_PLATINUM_PALETTE;
      const whiteFilmStyles: PhotoFrameStyle[] = ['polaroid_vintage', 'frosted_glass', 'dashed_filmstrip', 'classic_modern'];
      frameStyle = whiteFilmStyles[Math.floor(slotIndex / 2) % whiteFilmStyles.length];
    } else {
      palette = VIBRANT_PALETTES[Math.floor(slotIndex / 2) % VIBRANT_PALETTES.length];
      const colorFilmStyles: PhotoFrameStyle[] = ['polaroid_vintage', 'dashed_filmstrip', 'gradient_duotone', 'polaroid_vintage'];
      frameStyle = colorFilmStyles[Math.floor(slotIndex / 2) % colorFilmStyles.length];
    }
  } else if (activeMode === 'neon_glass') {
    if (slotIndex % 2 === 0) {
      palette = WHITE_PLATINUM_PALETTE;
      frameStyle = (slotIndex / 2) % 2 === 0 ? 'frosted_glass' : 'double_outline';
    } else {
      palette = VIBRANT_PALETTES[Math.floor(slotIndex / 2) % VIBRANT_PALETTES.length];
      frameStyle = (slotIndex / 2) % 2 === 0 ? 'neon_cyber_glow' : 'holographic_prism';
    }
  } else if (activeMode === 'royal_luxury') {
    if (slotIndex % 2 === 0) {
      palette = WHITE_PLATINUM_PALETTE;
      frameStyle = (slotIndex / 2) % 2 === 0 ? 'double_outline' : 'classic_modern';
    } else {
      palette = VIBRANT_PALETTES[Math.floor(slotIndex / 2) % VIBRANT_PALETTES.length];
      frameStyle = (slotIndex / 2) % 2 === 0 ? 'metallic_gold' : 'gradient_duotone';
    }
  } else {
    // All Dynamic Mix: Strictly alternating White -> Vibrant Color -> White -> Vibrant Color
    if (slotIndex % 2 === 0) {
      // EVEN SLOTS (0, 2, 4, 6, ...): Crisp Diamond White / Platinum / Silver
      palette = WHITE_PLATINUM_PALETTE;
      const whiteStyles: PhotoFrameStyle[] = [
        'polaroid_vintage', // Authentic White Polaroid Paper
        'frosted_glass',    // Crisp Translucent White Glass
        'dashed_filmstrip', // Authentic 35mm Cinema Film Reel
        'classic_modern',   // Clean White Gallery Bevel
        'double_outline'    // Precision White Dual Ring
      ];
      frameStyle = whiteStyles[Math.floor(slotIndex / 2) % whiteStyles.length];
    } else {
      // ODD SLOTS (1, 3, 5, 7, ...): Rich Vibrant Saturated Colors (Cyan, Ruby, Gold, Emerald, Violet, Amber, Rose, Sapphire)
      palette = VIBRANT_PALETTES[Math.floor(slotIndex / 2) % VIBRANT_PALETTES.length];
      const vibrantStyles: PhotoFrameStyle[] = [
        'neon_cyber_glow',   // Electric Neon Glow
        'polaroid_vintage',  // Vibrant Colored Instax Polaroid Frame
        'metallic_gold',     // Royal Imperial Gold Frame
        'gradient_duotone',  // 45-degree Vibrant Gradient Aura
        'dashed_filmstrip',  // 35mm Filmstrip with Vibrant Accent
        'holographic_prism', // Rainbow Prism Shimmer
        'sleek_dark_neon',   // Obsidian Titanium Bezel with Neon Line
        'postage_stamp'      // Collectible Scalloped Edge Stamp
      ];
      frameStyle = vibrantStyles[Math.floor(slotIndex / 2) % vibrantStyles.length];
    }
  }

  return {
    frameStyle,
    frameColor: palette.primary,
    frameAccentColor: palette.accent,
    glowColor: palette.glow
  };
};

/**
 * Cohesive Theme Config (maintains consistent color while varying frame structures)
 */
export const getCohesiveFrameConfig = (
  themeId = 'all_dynamic',
  slotIndex = 0
): {
  frameStyle: PhotoFrameStyle;
  frameColor: string;
  frameAccentColor: string;
} => {
  return getRandomFrameConfig(slotIndex, themeId, 'all_dynamic');
};

/**
 * High-Fidelity Multi-Style Photo Card Canvas Renderer
 * Renders rich, professional visual frames (35mm filmstrip, polaroid chin, cyber neon, frosted glass, imperial gold, etc.)
 */
export const renderStyledPhotoCard = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  options: {
    frameStyle?: PhotoFrameStyle;
    frameColor?: string;
    accentColor?: string;
    shadowBlur?: number;
    cornerRadius?: number;
    glowColor?: string;
  } = {}
) => {
  if (!img || !img.complete || !img.naturalWidth || img.naturalWidth <= 0 || w <= 0 || h <= 0) {
    return;
  }

  const perfFlags = getRenderPerformanceFlags();
  const radius = Math.max(0, options.cornerRadius ?? 0);
  const rawShadowBlur = options.shadowBlur ?? 30;
  const shadowBlur = perfFlags.reduceShadowBlur ? Math.min(rawShadowBlur, 5) : rawShadowBlur;
  const frameColor = options.frameColor ?? '#06b6d4';
  const accentColor = options.accentColor ?? '#67e8f9';
  const glowColor = options.glowColor ?? 'rgba(6, 182, 212, 0.45)';
  const style = options.frameStyle ?? 'polaroid_vintage';

  ctx.save(); // Outer protective canvas save

  // =========================================================================
  // 1. 35mm CINEMA FILMSTRIP (Authentic Perforated Sprockets & Celluloid Reel)
  // =========================================================================
  if (style === 'dashed_filmstrip') {
    const barH = Math.max(18, Math.min(28, Math.round(h * 0.08)));
    const sideW = Math.max(6, Math.min(14, Math.round(w * 0.022)));
    const photoX = x + sideW;
    const photoY = y + barH;
    const photoW = w - sideW * 2;
    const photoH = h - barH * 2;

    // Drop shadow backing
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#0c0e12';
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Dark celluloid body
    ctx.fillStyle = '#11141a';
    ctx.fillRect(x, y, w, h);

    // Render 35mm Sprocket Holes (Top and Bottom Bands)
    const holeW = Math.max(9, Math.round(barH * 0.48));
    const holeH = Math.max(10, Math.round(barH * 0.62));
    const spacing = Math.max(26, Math.round(w / 14));
    const holeCount = Math.floor((w - sideW * 2) / spacing);
    const startOffset = x + sideW + (w - sideW * 2 - holeCount * spacing) / 2 + spacing * 0.2;

    for (let i = 0; i < holeCount; i++) {
      const hx = startOffset + i * spacing;
      // Top sprocket hole
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      roundRect(ctx, hx, y + (barH - holeH) / 2, holeW, holeH, 2.5);
      ctx.fill();

      // Bottom sprocket hole
      roundRect(ctx, hx, y + h - barH + (barH - holeH) / 2, holeW, holeH, 2.5);
      ctx.fill();
    }

    // Photo cutout
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    ctx.translate(photoX, photoY);
    drawFittedImage(ctx, img, photoW, photoH);
    ctx.restore();

    // Inner photo border
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = frameColor;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    // Outer edge border
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.strokeRect(x, y, w, h);

    ctx.restore();
    return;
  }

  // =========================================================================
  // 2. VINTAGE POLAROID (Authentic Cream Paper Frame with Deep Bottom Chin)
  // =========================================================================
  if (style === 'polaroid_vintage') {
    const marginSide = Math.max(12, Math.min(22, Math.round(w * 0.038)));
    const marginTop = Math.max(12, Math.min(22, Math.round(h * 0.038)));
    const marginBottom = Math.max(40, Math.min(68, Math.round(h * 0.145)));
    const photoX = x + marginSide;
    const photoY = y + marginTop;
    const photoW = w - marginSide * 2;
    const photoH = h - marginTop - marginBottom;

    const isWhitePaper = !frameColor || frameColor === '#ffffff' || frameColor === '#f8fafc' || frameColor === '#faf8f5';

    // Realistic soft photographic paper drop shadow
    ctx.save();
    if (!perfFlags.reduceShadowBlur) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = Math.max(22, shadowBlur * 1.1);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 16;
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      roundRect(ctx, x + 3, y + 6, w, h, 6);
      ctx.fill();
    }
    ctx.fillStyle = isWhitePaper ? '#faf8f5' : frameColor;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.restore();

    // Cream paper frame body (or colored Instax)
    ctx.fillStyle = isWhitePaper ? '#fdfcf7' : frameColor;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Subtle paper edge border
    ctx.lineWidth = 1;
    ctx.strokeStyle = isWhitePaper ? '#e2e8f0' : (accentColor || 'rgba(255, 255, 255, 0.4)');
    ctx.stroke();

    // Photo cutout with soft inner recessed shadow
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, photoX, photoY, photoW, photoH, 2);
    ctx.clip();
    ctx.translate(photoX, photoY);
    drawFittedImage(ctx, img, photoW, photoH);

    // Very soft photo print gloss
    const gloss = ctx.createLinearGradient(0, 0, photoW, photoH);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gloss.addColorStop(1, 'rgba(0, 0, 0, 0.06)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, photoW, photoH);
    ctx.restore();

    // Photo inner edge outline
    ctx.lineWidth = 1;
    ctx.strokeStyle = isWhitePaper ? 'rgba(15, 23, 42, 0.18)' : 'rgba(255, 255, 255, 0.35)';
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    ctx.restore();
    return;
  }

  // =========================================================================
  // 3. NEON CYBER GLOW (Hypnotic Multi-Layer Electric Glow & Corner Nodes)
  // =========================================================================
  if (style === 'neon_cyber_glow') {
    // 1. Drop shadow backing
    ctx.save();
    if (!perfFlags.reduceShadowBlur) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 12;
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      roundRect(ctx, x + 3, y + 5, w, h, radius || 8);
      ctx.fill();
    }
    ctx.fillStyle = '#05070e';
    roundRect(ctx, x, y, w, h, radius || 8);
    ctx.fill();
    ctx.restore();

    // 2. Clipped Image
    ctx.save();
    roundRect(ctx, x, y, w, h, radius || 8);
    ctx.clip();
    ctx.translate(x, y);
    drawFittedImage(ctx, img, w, h);
    ctx.restore();

    // 3. Outer High-Intensity Neon Aura
    ctx.save();
    if (perfFlags.reduceShadowBlur) {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 8;
      ctx.strokeStyle = glowColor || frameColor;
      roundRect(ctx, x, y, w, h, radius || 8);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = frameColor;
      ctx.stroke();

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = accentColor || '#ffffff';
      ctx.stroke();
    } else {
      ctx.shadowColor = glowColor || frameColor;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 4;
      ctx.strokeStyle = frameColor;
      roundRect(ctx, x, y, w, h, radius || 8);
      ctx.stroke();

      // 4. Mid Neon Stroke
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = frameColor;
      ctx.stroke();

      // 5. Core Crisp Electric Hairline
      ctx.shadowBlur = 3;
      ctx.shadowColor = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = accentColor || '#ffffff';
      ctx.stroke();
    }
    ctx.restore();

    // 6. Glowing Corner Neon Nodes
    const nodeSize = 4;
    const corners = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ];
    ctx.save();
    if (!perfFlags.reduceShadowBlur) {
      ctx.shadowColor = accentColor || '#ffffff';
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = '#ffffff';
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, nodeSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.restore();
    return;
  }

  // =========================================================================
  // 4. FROSTED GLASSMORPHISM (Translucent Glass Rim & Specular Corner Reflection)
  // =========================================================================
  if (style === 'frosted_glass') {
    const glassBorder = Math.max(10, Math.min(18, Math.round(w * 0.026)));
    const photoX = x + glassBorder;
    const photoY = y + glassBorder;
    const photoW = w - glassBorder * 2;
    const photoH = h - glassBorder * 2;

    // Ambient drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.restore();

    // Frosted glass translucent outer frame
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();

    // Clipped Center Image
    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 4);
    ctx.clip();
    ctx.translate(photoX, photoY);
    drawFittedImage(ctx, img, photoW, photoH);
    ctx.restore();

    // Outer Glass Rim
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();

    // Inner Glass Separator
    ctx.lineWidth = 1;
    ctx.strokeStyle = frameColor || 'rgba(255, 255, 255, 0.35)';
    roundRect(ctx, photoX, photoY, photoW, photoH, 4);
    ctx.stroke();

    // Diagonal Specular Gloss Streak across top glass
    ctx.save();
    const glossGrad = ctx.createLinearGradient(x, y, x + w * 0.35, y + h * 0.35);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glossGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(x, y, w, glassBorder * 1.8);
    ctx.restore();

    // 4 Corner Metal Brackets (L-shaped precision tabs)
    const arm = Math.max(8, glassBorder * 0.9);
    ctx.lineWidth = 2;
    ctx.strokeStyle = accentColor || '#ffffff';
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3 + arm);
    ctx.lineTo(x + 3, y + 3);
    ctx.lineTo(x + 3 + arm, y + 3);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - 3 - arm, y + 3);
    ctx.lineTo(x + w - 3, y + 3);
    ctx.lineTo(x + w - 3, y + 3 + arm);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - 3, y + h - 3 - arm);
    ctx.lineTo(x + w - 3, y + h - 3);
    ctx.lineTo(x + w - 3 - arm, y + h - 3);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x + 3 + arm, y + h - 3);
    ctx.lineTo(x + 3, y + h - 3);
    ctx.lineTo(x + 3, y + h - 3 - arm);
    ctx.stroke();

    ctx.restore();
    return;
  }

  // =========================================================================
  // 5. ROYAL IMPERIAL GOLD (Beveled Gold Gradient & Ornate Engraved Inlay)
  // =========================================================================
  if (style === 'metallic_gold') {
    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, x, y, w, h, radius || 4);
    ctx.fill();
    ctx.restore();

    // Clipped Image
    ctx.save();
    roundRect(ctx, x, y, w, h, radius || 4);
    ctx.clip();
    ctx.translate(x, y);
    drawFittedImage(ctx, img, w, h);
    ctx.restore();

    // Outer Beveled Golden Gradient Stroke
    const goldGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.3, '#d97706');
    goldGrad.addColorStop(0.6, '#b45309');
    goldGrad.addColorStop(0.85, '#fde047');
    goldGrad.addColorStop(1, '#fef08a');

    ctx.lineWidth = 4;
    ctx.strokeStyle = goldGrad;
    roundRect(ctx, x, y, w, h, radius || 4);
    ctx.stroke();

    // Inset Fine Engraved Line
    const inset = 6;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#fef08a';
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);

    // Ornate Corner Diamonds
    const dSize = 3.5;
    const dCorners = [
      [x + inset, y + inset],
      [x + w - inset, y + inset],
      [x + w - inset, y + h - inset],
      [x + inset, y + h - inset]
    ];
    ctx.fillStyle = '#fde047';
    dCorners.forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(dx, dy - dSize);
      ctx.lineTo(dx + dSize, dy);
      ctx.lineTo(dx, dy + dSize);
      ctx.lineTo(dx - dSize, dy);
      ctx.closePath();
      ctx.fill();
    });

    ctx.restore();
    return;
  }

  // =========================================================================
  // 6. VIBRANT DUOTONE GRADIENT (45° Diagonal Transition & Radiant Aura)
  // =========================================================================
  if (style === 'gradient_duotone') {
    // Drop shadow with radiant color aura
    ctx.save();
    if (!perfFlags.reduceShadowBlur) {
      ctx.shadowColor = glowColor || frameColor;
      ctx.shadowBlur = Math.max(20, shadowBlur * 0.9);
      ctx.shadowOffsetY = 10;
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      roundRect(ctx, x + 3, y + 5, w, h, radius || 6);
      ctx.fill();
    }
    ctx.fillStyle = '#090d16';
    roundRect(ctx, x, y, w, h, radius || 6);
    ctx.fill();
    ctx.restore();

    // Clipped Image
    ctx.save();
    roundRect(ctx, x, y, w, h, radius || 6);
    ctx.clip();
    ctx.translate(x, y);
    drawFittedImage(ctx, img, w, h);
    ctx.restore();

    // 45° Diagonal Duotone Gradient Border
    const duoGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    duoGrad.addColorStop(0, frameColor);
    duoGrad.addColorStop(0.5, accentColor);
    duoGrad.addColorStop(1, frameColor);

    ctx.lineWidth = 4.5;
    ctx.strokeStyle = duoGrad;
    roundRect(ctx, x, y, w, h, radius || 6);
    ctx.stroke();

    // Inner Hairline
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);

    ctx.restore();
    return;
  }

  // =========================================================================
  // 7. HOLOGRAPHIC PRISM (Rainbow Iridescent Shimmer Sheen)
  // =========================================================================
  if (style === 'holographic_prism') {
    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, x, y, w, h, radius || 6);
    ctx.fill();
    ctx.restore();

    // Clipped Image
    ctx.save();
    roundRect(ctx, x, y, w, h, radius || 6);
    ctx.clip();
    ctx.translate(x, y);
    drawFittedImage(ctx, img, w, h);
    ctx.restore();

    // Iridescent Prism Rainbow Gradient
    const prismGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    prismGrad.addColorStop(0.0, '#06b6d4'); // Cyan
    prismGrad.addColorStop(0.2, '#8b5cf6'); // Violet
    prismGrad.addColorStop(0.4, '#f43f5e'); // Rose
    prismGrad.addColorStop(0.6, '#f59e0b'); // Gold
    prismGrad.addColorStop(0.8, '#10b981'); // Emerald
    prismGrad.addColorStop(1.0, '#06b6d4'); // Cyan loop

    ctx.save();
    if (!perfFlags.reduceShadowBlur) {
      ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
      ctx.shadowBlur = 16;
    }
    ctx.lineWidth = 4;
    ctx.strokeStyle = prismGrad;
    roundRect(ctx, x, y, w, h, radius || 6);
    ctx.stroke();
    ctx.restore();

    // Inner thin crisp border
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    ctx.restore();
    return;
  }

  // =========================================================================
  // 8. SLEEK DARK NEON (Titanium Obsidian Bezel & Glowing Laser Pinstripe)
  // =========================================================================
  if (style === 'sleek_dark_neon') {
    const bezel = Math.max(8, Math.min(14, Math.round(w * 0.02)));
    const photoX = x + bezel;
    const photoY = y + bezel;
    const photoW = w - bezel * 2;
    const photoH = h - bezel * 2;

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#05070e';
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.restore();

    // Clipped Center Image
    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 2);
    ctx.clip();
    ctx.translate(photoX, photoY);
    drawFittedImage(ctx, img, photoW, photoH);
    ctx.restore();

    // Dark titanium bezel
    ctx.lineWidth = bezel;
    ctx.strokeStyle = '#090d16';
    roundRect(ctx, x + bezel / 2, y + bezel / 2, w - bezel, h - bezel, 6);
    ctx.stroke();

    // Embedded glowing electric laser line
    ctx.save();
    if (!perfFlags.reduceShadowBlur) {
      ctx.shadowColor = glowColor || frameColor;
      ctx.shadowBlur = 12;
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = accentColor || frameColor;
    ctx.strokeRect(photoX, photoY, photoW, photoH);
    ctx.restore();

    // Outer subtle stroke
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();

    ctx.restore();
    return;
  }

  // =========================================================================
  // 9. DOUBLE OUTLINE (Floating Dual Precision Contour Rings)
  // =========================================================================
  if (style === 'double_outline') {
    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, x, y, w, h, radius || 4);
    ctx.fill();
    ctx.restore();

    // Clipped Image
    ctx.save();
    roundRect(ctx, x, y, w, h, radius || 4);
    ctx.clip();
    ctx.translate(x, y);
    drawFittedImage(ctx, img, w, h);
    ctx.restore();

    // Outer Contour Stroke
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = frameColor;
    roundRect(ctx, x, y, w, h, radius || 4);
    ctx.stroke();

    // Inner Floating Contour Line
    const inset = 7;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = accentColor;
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);

    ctx.restore();
    return;
  }

  // =========================================================================
  // 10. POSTAGE STAMP / COLLECTOR SCALLOPED EDGE
  // =========================================================================
  if (style === 'postage_stamp') {
    const margin = Math.max(10, Math.min(16, Math.round(w * 0.025)));
    const photoX = x + margin;
    const photoY = y + margin;
    const photoW = w - margin * 2;
    const photoH = h - margin * 2;

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Ivory paper body
    ctx.fillStyle = '#fcfbf7';
    ctx.fillRect(x, y, w, h);

    // Clipped Center Image
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    ctx.translate(photoX, photoY);
    drawFittedImage(ctx, img, photoW, photoH);
    ctx.restore();

    // Scalloped Edge Perforations along 4 edges
    ctx.fillStyle = '#0f172a';
    const holeRadius = 3;
    const step = 14;

    // Top & Bottom scallops
    for (let hx = x + step; hx < x + w - step; hx += step) {
      ctx.beginPath();
      ctx.arc(hx, y, holeRadius, 0, Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(hx, y + h, holeRadius, Math.PI, 0);
      ctx.fill();
    }

    // Left & Right scallops
    for (let hy = y + step; hy < y + h - step; hy += step) {
      ctx.beginPath();
      ctx.arc(x, hy, holeRadius, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x + w, hy, holeRadius, Math.PI / 2, -Math.PI / 2);
      ctx.fill();
    }

    // Photo frame line
    ctx.lineWidth = 1;
    ctx.strokeStyle = frameColor;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    ctx.restore();
    return;
  }

  // =========================================================================
  // 11. CLASSIC MODERN (Clean Contemporary Gallery Bevel)
  // =========================================================================
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  // Clipped Image
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.translate(x, y);
  drawFittedImage(ctx, img, w, h);
  ctx.restore();

  // Clean Border Stroke
  ctx.lineWidth = 3;
  ctx.strokeStyle = frameColor;
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();

  // Inner Subtle Hairline
  ctx.lineWidth = 1;
  ctx.strokeStyle = accentColor;
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(0, radius - 2));
  ctx.stroke();

  ctx.restore(); // Outer protective restore
};
