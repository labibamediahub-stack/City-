import { ChannelStyleId, ColorGradingPreset, ChannelLayoutMode } from '../types/timeline';

export type ChannelCutStrategy =
  | 'hook_climax_first'
  | 'reverse_wave'
  | 'interleaved_pairs'
  | 'quarter_rotated'
  | 'center_outward'
  | 'story_arc_shuffle'
  | 'golden_stride'
  | 'mirror_alternate'
  | 'suspense_ladder'
  | 'chronological_remix';

export const CHANNEL_LAYOUT_LABELS_BN: Record<ChannelLayoutMode, string> = {
  full_cinema: 'ফুল সিনেমা ফ্রেম',
  news_desk_card: 'নিউজ-ডেস্ক ইনফো কার্ড',
  split_comparison: 'স্প্লিট-স্ক্রিন তুলনা',
  polaroid_collage: 'পোলারয়েড ডুয়াল কোলাজ',
  documentary_bar: 'ডকুমেন্টারি চ্যাপ্টার বার',
  editorial_frame: 'এডিটোরিয়াল সাইড-ব্যান্ড',
  triptych_mosaic: 'ট্রিপটিক ৩-ছবি মোজাইক',
  panoramic_reel: 'প্যানোরামিক ওয়াইড রিল',
  spotlight_pip: 'স্পটলাইট PiP লেয়ার',
  spotlight_diary: 'ডায়েরি স্টোরি কার্ড'
};

export interface ChannelDnaPreset {
  slotNumber: number; // 1 to 10
  shortLabel: string; // CH 1 .. CH 10
  themeTitle: string;
  watermarkStyleId: ChannelStyleId;
  watermarkOpacity: number;
  overlayStyleId: string;
  colorGrading: ColorGradingPreset;
  frameThemeId: 'all_dynamic' | 'film_polaroid' | 'neon_glass' | 'royal_luxury';
  layoutMode: ChannelLayoutMode;
  cutStrategy: ChannelCutStrategy;
  effectCategoryPreference: 'uploadedVideo' | 'animista' | 'all';
  enableCinematicLetterbox: boolean;
  enableLightLeaks: boolean;
  enableFilmGrain: boolean;
  enableAmbientBackdrop: boolean;
  minImageDuration: number;
  maxImageDuration: number;
  defaultTransitionDuration: number;
  ctaIntervalSeconds: number;
  ctaStylePreset: 'all_rotating' | 'youtube_red' | 'neon_cyan' | 'royal_sunset' | 'emerald_mint' | 'glass_aurora';
  recommendedFps: 24 | 30;
  // Subtle geometric & color anti-spam fingerprint (invisible to viewer, unique pixel hash per channel)
  fingerprint: {
    zoomBias: number;
    panX: number;
    panY: number;
    tintCss: string;
  };
}

export interface SmartAutoDnaProfile {
  slotNumber: number;
  variationSeed: number;
  overlayStyleId: string;
  colorGrading: ColorGradingPreset;
  frameThemeId: 'all_dynamic' | 'film_polaroid' | 'neon_glass' | 'royal_luxury';
  layoutMode: ChannelLayoutMode;
  cutStrategy: ChannelCutStrategy;
  effectCategoryPreference: 'uploadedVideo' | 'animista' | 'all';
  useMotionFxStudio: boolean;
  enableCinematicLetterbox: boolean;
  enableLightLeaks: boolean;
  enableFilmGrain: boolean;
  enableAmbientBackdrop: boolean;
  minImageDuration: number;
  maxImageDuration: number;
  defaultTransitionDuration: number;
  watermarkStyleId: ChannelStyleId;
  watermarkOpacity: number;
  ctaIntervalSeconds: number;
  ctaStylePreset: 'all_rotating' | 'youtube_red' | 'neon_cyan' | 'royal_sunset' | 'emerald_mint' | 'glass_aurora';
  recommendedFps: 24 | 30;
  signature: string;
}

export const TEN_CHANNEL_DNA_PRESETS: ChannelDnaPreset[] = [
  {
    slotNumber: 1,
    shortLabel: 'CH 1',
    themeTitle: 'News Desk Review',
    watermarkStyleId: 'cinematic_gold',
    watermarkOpacity: 0.42,
    overlayStyleId: 'starlight_dust',
    colorGrading: 'teal_orange',
    frameThemeId: 'all_dynamic',
    layoutMode: 'news_desk_card',
    cutStrategy: 'hook_climax_first',
    effectCategoryPreference: 'uploadedVideo',
    enableCinematicLetterbox: false,
    enableLightLeaks: true,
    enableFilmGrain: true,
    enableAmbientBackdrop: true,
    minImageDuration: 4.5,
    maxImageDuration: 6.4,
    defaultTransitionDuration: 0.6,
    ctaIntervalSeconds: 45,
    ctaStylePreset: 'youtube_red',
    recommendedFps: 24,
    fingerprint: { zoomBias: 1.012, panX: 4, panY: -2, tintCss: 'rgba(255, 200, 120, 0.018)' }
  },
  {
    slotNumber: 2,
    shortLabel: 'CH 2',
    themeTitle: 'Split Comparison',
    watermarkStyleId: 'neon_cyan',
    watermarkOpacity: 0.48,
    overlayStyleId: 'cosmic_particle',
    colorGrading: 'vivid_hd',
    frameThemeId: 'neon_glass',
    layoutMode: 'split_comparison',
    cutStrategy: 'reverse_wave',
    effectCategoryPreference: 'animista',
    enableCinematicLetterbox: true,
    enableLightLeaks: true,
    enableFilmGrain: false,
    enableAmbientBackdrop: true,
    minImageDuration: 3.8,
    maxImageDuration: 5.5,
    defaultTransitionDuration: 0.5,
    ctaIntervalSeconds: 40,
    ctaStylePreset: 'neon_cyan',
    recommendedFps: 30,
    fingerprint: { zoomBias: 1.022, panX: -5, panY: 3, tintCss: 'rgba(56, 189, 248, 0.02)' }
  },
  {
    slotNumber: 3,
    shortLabel: 'CH 3',
    themeTitle: 'Royal Polaroid',
    watermarkStyleId: 'royal_silver',
    watermarkOpacity: 0.4,
    overlayStyleId: 'cinema_bokeh',
    colorGrading: 'warm_golden',
    frameThemeId: 'film_polaroid',
    layoutMode: 'polaroid_collage',
    cutStrategy: 'interleaved_pairs',
    effectCategoryPreference: 'all',
    enableCinematicLetterbox: false,
    enableLightLeaks: false,
    enableFilmGrain: true,
    enableAmbientBackdrop: true,
    minImageDuration: 5.2,
    maxImageDuration: 7.4,
    defaultTransitionDuration: 0.7,
    ctaIntervalSeconds: 50,
    ctaStylePreset: 'royal_sunset',
    recommendedFps: 24,
    fingerprint: { zoomBias: 1.018, panX: 6, panY: 3, tintCss: 'rgba(251, 191, 36, 0.018)' }
  },
  {
    slotNumber: 4,
    shortLabel: 'CH 4',
    themeTitle: 'Documentary Bar',
    watermarkStyleId: 'shadow_edge',
    watermarkOpacity: 0.5,
    overlayStyleId: 'film_grain',
    colorGrading: 'moody_noir',
    frameThemeId: 'royal_luxury',
    layoutMode: 'documentary_bar',
    cutStrategy: 'quarter_rotated',
    effectCategoryPreference: 'uploadedVideo',
    enableCinematicLetterbox: true,
    enableLightLeaks: false,
    enableFilmGrain: true,
    enableAmbientBackdrop: false,
    minImageDuration: 4.4,
    maxImageDuration: 6.3,
    defaultTransitionDuration: 0.55,
    ctaIntervalSeconds: 45,
    ctaStylePreset: 'glass_aurora',
    recommendedFps: 24,
    fingerprint: { zoomBias: 1.026, panX: -4, panY: -4, tintCss: 'rgba(30, 58, 138, 0.022)' }
  },
  {
    slotNumber: 5,
    shortLabel: 'CH 5',
    themeTitle: 'Triptych Mosaic',
    watermarkStyleId: 'electric_blue',
    watermarkOpacity: 0.45,
    overlayStyleId: 'crystal_snow',
    colorGrading: 'vivid_hd',
    frameThemeId: 'neon_glass',
    layoutMode: 'triptych_mosaic',
    cutStrategy: 'center_outward',
    effectCategoryPreference: 'animista',
    enableCinematicLetterbox: false,
    enableLightLeaks: true,
    enableFilmGrain: false,
    enableAmbientBackdrop: true,
    minImageDuration: 4.2,
    maxImageDuration: 6.0,
    defaultTransitionDuration: 0.65,
    ctaIntervalSeconds: 40,
    ctaStylePreset: 'emerald_mint',
    recommendedFps: 30,
    fingerprint: { zoomBias: 1.015, panX: -6, panY: 2, tintCss: 'rgba(16, 185, 129, 0.018)' }
  },
  {
    slotNumber: 6,
    shortLabel: 'CH 6',
    themeTitle: 'Editorial Band',
    watermarkStyleId: 'fire_glow',
    watermarkOpacity: 0.46,
    overlayStyleId: 'light_leak',
    colorGrading: 'warm_golden',
    frameThemeId: 'all_dynamic',
    layoutMode: 'editorial_frame',
    cutStrategy: 'story_arc_shuffle',
    effectCategoryPreference: 'all',
    enableCinematicLetterbox: false,
    enableLightLeaks: true,
    enableFilmGrain: true,
    enableAmbientBackdrop: true,
    minImageDuration: 4.0,
    maxImageDuration: 5.8,
    defaultTransitionDuration: 0.5,
    ctaIntervalSeconds: 50,
    ctaStylePreset: 'royal_sunset',
    recommendedFps: 30,
    fingerprint: { zoomBias: 1.028, panX: 5, panY: -4, tintCss: 'rgba(249, 115, 22, 0.02)' }
  },
  {
    slotNumber: 7,
    shortLabel: 'CH 7',
    themeTitle: 'Panoramic Reel',
    watermarkStyleId: 'orbit_motion',
    watermarkOpacity: 0.38,
    overlayStyleId: 'golden_rain',
    colorGrading: 'vintage_35mm',
    frameThemeId: 'film_polaroid',
    layoutMode: 'panoramic_reel',
    cutStrategy: 'golden_stride',
    effectCategoryPreference: 'uploadedVideo',
    enableCinematicLetterbox: true,
    enableLightLeaks: false,
    enableFilmGrain: true,
    enableAmbientBackdrop: true,
    minImageDuration: 5.4,
    maxImageDuration: 7.6,
    defaultTransitionDuration: 0.75,
    ctaIntervalSeconds: 65,
    ctaStylePreset: 'youtube_red',
    recommendedFps: 24,
    fingerprint: { zoomBias: 1.016, panX: -3, panY: 5, tintCss: 'rgba(217, 119, 6, 0.02)' }
  },
  {
    slotNumber: 8,
    shortLabel: 'CH 8',
    themeTitle: 'Spotlight PiP',
    watermarkStyleId: 'glass_shine',
    watermarkOpacity: 0.44,
    overlayStyleId: 'cinematic_light',
    colorGrading: 'none',
    frameThemeId: 'neon_glass',
    layoutMode: 'spotlight_pip',
    cutStrategy: 'mirror_alternate',
    effectCategoryPreference: 'all',
    enableCinematicLetterbox: false,
    enableLightLeaks: true,
    enableFilmGrain: false,
    enableAmbientBackdrop: true,
    minImageDuration: 4.3,
    maxImageDuration: 6.1,
    defaultTransitionDuration: 0.55,
    ctaIntervalSeconds: 45,
    ctaStylePreset: 'neon_cyan',
    recommendedFps: 30,
    fingerprint: { zoomBias: 1.024, panX: 3, panY: -5, tintCss: 'rgba(139, 92, 246, 0.018)' }
  },
  {
    slotNumber: 9,
    shortLabel: 'CH 9',
    themeTitle: 'Spotlight Diary',
    watermarkStyleId: 'elegant_white',
    watermarkOpacity: 0.4,
    overlayStyleId: 'dreamy_fog',
    colorGrading: 'teal_orange',
    frameThemeId: 'royal_luxury',
    layoutMode: 'spotlight_diary',
    cutStrategy: 'suspense_ladder',
    effectCategoryPreference: 'uploadedVideo',
    enableCinematicLetterbox: false,
    enableLightLeaks: false,
    enableFilmGrain: true,
    enableAmbientBackdrop: true,
    minImageDuration: 5.0,
    maxImageDuration: 7.0,
    defaultTransitionDuration: 0.7,
    ctaIntervalSeconds: 50,
    ctaStylePreset: 'emerald_mint',
    recommendedFps: 24,
    fingerprint: { zoomBias: 1.014, panX: -6, panY: -2, tintCss: 'rgba(20, 184, 166, 0.018)' }
  },
  {
    slotNumber: 10,
    shortLabel: 'CH 10',
    themeTitle: 'Full Cinema Cut',
    watermarkStyleId: 'gradient_pulse',
    watermarkOpacity: 0.45,
    overlayStyleId: 'floral_burst',
    colorGrading: 'warm_golden',
    frameThemeId: 'all_dynamic',
    layoutMode: 'full_cinema',
    cutStrategy: 'chronological_remix',
    effectCategoryPreference: 'animista',
    enableCinematicLetterbox: true,
    enableLightLeaks: true,
    enableFilmGrain: false,
    enableAmbientBackdrop: true,
    minImageDuration: 4.1,
    maxImageDuration: 6.0,
    defaultTransitionDuration: 0.6,
    ctaIntervalSeconds: 40,
    ctaStylePreset: 'glass_aurora',
    recommendedFps: 24,
    fingerprint: { zoomBias: 1.02, panX: 4, panY: 4, tintCss: 'rgba(236, 72, 153, 0.018)' }
  }
];

export function getChannelDnaPreset(slotNumber: number): ChannelDnaPreset {
  const clamped = Math.max(1, Math.min(10, Math.round(slotNumber || 1)));
  return TEN_CHANNEL_DNA_PRESETS[clamped - 1] || TEN_CHANNEL_DNA_PRESETS[0];
}

/**
 * Computes a unique, imperceptible geometric & pixel tint fingerprint for each (channel, seed)
 * so repeated videos or channels never produce identical canvas frames or hashes.
 */
export function getEffectiveChannelFingerprint(
  slotNumber: number,
  variationSeed = 0
): ChannelDnaPreset['fingerprint'] {
  const base = getChannelDnaPreset(slotNumber).fingerprint;
  if (!variationSeed) return base;

  const s = Math.abs(Math.round(variationSeed));
  const zoomDelta = ((s % 5) - 2) * 0.003; // subtle ±0.006 shift
  const panShiftX = ((s * 3) % 7) - 3;
  const panShiftY = ((s * 5) % 7) - 3;
  const hueAngle = ((slotNumber * 37 + s * 53) % 360);

  return {
    zoomBias: Math.max(1.008, Math.min(1.034, Number((base.zoomBias + zoomDelta).toFixed(4)))),
    panX: Math.max(-7, Math.min(7, base.panX + panShiftX)),
    panY: Math.max(-7, Math.min(7, base.panY + panShiftY)),
    tintCss: `hsla(${hueAngle}, 70%, 62%, 0.018)`
  };
}

// ==================== SMART ANTI-REPEAT MEMORY ENGINE ====================

const DNA_MEMORY_STORAGE_KEY = 'smart_dna_memory_v1';

const ALL_OVERLAY_IDS = [
  'starlight_dust',
  'crystal_snow',
  'golden_rain',
  'cosmic_particle',
  'cinematic_light',
  'cinema_bokeh',
  'film_grain',
  'light_leak',
  'lens_flare',
  'dreamy_fog',
  'floral_burst'
];

const ALL_COLOR_GRADES: ColorGradingPreset[] = [
  'teal_orange',
  'warm_golden',
  'moody_noir',
  'vintage_35mm',
  'vivid_hd',
  'none'
];

const ALL_FRAME_THEMES: Array<'all_dynamic' | 'film_polaroid' | 'neon_glass' | 'royal_luxury'> = [
  'all_dynamic',
  'film_polaroid',
  'neon_glass',
  'royal_luxury'
];

const ALL_EFFECT_CATEGORIES: Array<'uploadedVideo' | 'animista' | 'all'> = [
  'uploadedVideo',
  'animista',
  'all'
];

const ALL_WATERMARK_STYLES: ChannelStyleId[] = [
  'cinematic_gold',
  'neon_cyan',
  'orbit_motion',
  'shadow_edge',
  'elegant_white',
  'fire_glow',
  'electric_blue',
  'royal_silver',
  'glass_shine',
  'gradient_pulse'
];

const ALL_CTA_PRESETS: Array<'all_rotating' | 'youtube_red' | 'neon_cyan' | 'royal_sunset' | 'emerald_mint' | 'glass_aurora'> = [
  'all_rotating',
  'youtube_red',
  'neon_cyan',
  'royal_sunset',
  'emerald_mint',
  'glass_aurora'
];

const PACING_BANDS = [
  { min: 4.0, max: 5.6, trans: 0.45 },
  { min: 4.6, max: 6.4, trans: 0.55 },
  { min: 5.2, max: 7.2, trans: 0.6 },
  { min: 5.8, max: 8.2, trans: 0.7 }
];

interface ChannelMemoryRecord {
  overlays: string[];
  colors: ColorGradingPreset[];
  frames: Array<'all_dynamic' | 'film_polaroid' | 'neon_glass' | 'royal_luxury'>;
  watermarks: ChannelStyleId[];
  ctaIntervals: number[];
  signatures: string[];
  seedCounter: number;
}

interface SmartDnaMemoryStore {
  byChannel: Record<string, ChannelMemoryRecord>;
  globalOverlays: string[];
  globalColors: ColorGradingPreset[];
  globalSignatures: string[];
}

function loadMemoryStore(): SmartDnaMemoryStore {
  const empty: SmartDnaMemoryStore = {
    byChannel: {},
    globalOverlays: [],
    globalColors: [],
    globalSignatures: []
  };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(DNA_MEMORY_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<SmartDnaMemoryStore>;
    return {
      byChannel: parsed.byChannel || {},
      globalOverlays: Array.isArray(parsed.globalOverlays) ? parsed.globalOverlays : [],
      globalColors: Array.isArray(parsed.globalColors) ? parsed.globalColors : [],
      globalSignatures: Array.isArray(parsed.globalSignatures) ? parsed.globalSignatures : []
    };
  } catch {
    return empty;
  }
}

function saveMemoryStore(store: SmartDnaMemoryStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DNA_MEMORY_STORAGE_KEY, JSON.stringify(store));
  } catch (_) {}
}

function pickRandomExcluding<T>(pool: readonly T[], exclude: readonly unknown[]): T {
  const filtered = pool.filter((item) => !exclude.includes(item));
  const candidates = filtered.length > 0 ? filtered : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Generates a fresh, unique, non-repeating editing DNA for the specified channel (1..10),
 * remembering past selections both per-channel and globally across all 10 channels
 * so consecutive videos or channels never accidentally reuse the same visual combination.
 */
export function generateSmartAutoDna(slotNumber: number): SmartAutoDnaProfile {
  const normalized = Math.max(1, Math.min(10, Math.round(slotNumber || 1)));
  const store = loadMemoryStore();
  const key = String(normalized);
  const chMem: ChannelMemoryRecord = store.byChannel[key] || {
    overlays: [],
    colors: [],
    frames: [],
    watermarks: [],
    ctaIntervals: [],
    signatures: [],
    seedCounter: 0
  };

  let chosenOverlay = ALL_OVERLAY_IDS[0];
  let chosenColor: ColorGradingPreset = 'teal_orange';
  let chosenFrame: SmartAutoDnaProfile['frameThemeId'] = 'all_dynamic';
  let chosenLetterbox = false;
  let chosenLightLeaks = true;
  let chosenBackdrop = true;
  let chosenGrain = true;
  let signature = '';

  // Try up to 10 attempts to avoid any recent global or channel signature collision
  for (let attempt = 0; attempt < 10; attempt++) {
    chosenOverlay = pickRandomExcluding(ALL_OVERLAY_IDS, [
      ...chMem.overlays.slice(-3),
      ...store.globalOverlays.slice(-2)
    ]);
    chosenColor = pickRandomExcluding(ALL_COLOR_GRADES, [
      ...chMem.colors.slice(-2),
      ...store.globalColors.slice(-1)
    ]);
    chosenFrame = pickRandomExcluding(ALL_FRAME_THEMES, chMem.frames.slice(-1));
    chosenLetterbox = Math.random() < 0.45;
    chosenLightLeaks = Math.random() < 0.55;
    chosenBackdrop = Math.random() < 0.72;
    chosenGrain = Math.random() < 0.55;

    // Ensure at least one atmospheric toggle differs when possible
    signature = `${chosenOverlay}|${chosenColor}|${chosenFrame}|L${chosenLetterbox ? 1 : 0}|F${chosenLightLeaks ? 1 : 0}|B${chosenBackdrop ? 1 : 0}|G${chosenGrain ? 1 : 0}`;
    if (!chMem.signatures.includes(signature) && !store.globalSignatures.includes(signature)) {
      break;
    }
  }

  const chosenEffectCategory = pickRandomExcluding(ALL_EFFECT_CATEGORIES, []);
  const useMotionFxStudio = Math.random() < 0.5;
  const pacing = pacingChoice(normalized, chMem.seedCounter);
  const chosenWatermarkStyle = pickRandomExcluding(ALL_WATERMARK_STYLES, chMem.watermarks.slice(-2));
  const chosenWatermarkOpacity = Number((0.36 + Math.random() * 0.12).toFixed(2));
  const chosenCtaInterval = pickRandomExcluding([40, 50, 65], chMem.ctaIntervals.slice(-1));
  const chosenCtaPreset = pickRandomExcluding(ALL_CTA_PRESETS, []);
  const recommendedFps: 24 | 30 = Math.random() < 0.55 ? 24 : 30;
  const nextSeed = chMem.seedCounter + 1;

  // Persist memory (keep rolling windows compact)
  chMem.overlays = [...chMem.overlays.slice(-5), chosenOverlay];
  chMem.colors = [...chMem.colors.slice(-4), chosenColor];
  chMem.frames = [...chMem.frames.slice(-3), chosenFrame];
  chMem.watermarks = [...chMem.watermarks.slice(-4), chosenWatermarkStyle];
  chMem.ctaIntervals = [...chMem.ctaIntervals.slice(-3), chosenCtaInterval];
  chMem.signatures = [...chMem.signatures.slice(-7), signature];
  chMem.seedCounter = nextSeed;

  store.byChannel[key] = chMem;
  store.globalOverlays = [...store.globalOverlays.slice(-5), chosenOverlay];
  store.globalColors = [...store.globalColors.slice(-3), chosenColor];
  store.globalSignatures = [...store.globalSignatures.slice(-14), signature];
  saveMemoryStore(store);

  const basePreset = getChannelDnaPreset(normalized);
  // Keep each channel's core architectural layout & cutStrategy strongly differentiated
  // while rotating compatible overlays/colors/frames on re-roll
  const allLayouts: ChannelLayoutMode[] = [
    'news_desk_card',
    'split_comparison',
    'polaroid_collage',
    'documentary_bar',
    'triptych_mosaic',
    'editorial_frame',
    'panoramic_reel',
    'spotlight_pip',
    'spotlight_diary',
    'full_cinema'
  ];
  const chosenLayout: ChannelLayoutMode =
    chMem.seedCounter === 0
      ? basePreset.layoutMode
      : allLayouts[(normalized - 1 + chMem.seedCounter) % allLayouts.length];

  return {
    slotNumber: normalized,
    variationSeed: nextSeed,
    overlayStyleId: chosenOverlay,
    colorGrading: chosenColor,
    frameThemeId: chosenFrame,
    layoutMode: chosenLayout,
    cutStrategy: basePreset.cutStrategy,
    effectCategoryPreference: chosenEffectCategory,
    useMotionFxStudio,
    enableCinematicLetterbox: chosenLetterbox,
    enableLightLeaks: chosenLightLeaks,
    enableFilmGrain: chosenGrain,
    enableAmbientBackdrop: chosenBackdrop,
    minImageDuration: pacing.min,
    maxImageDuration: pacing.max,
    defaultTransitionDuration: pacing.trans,
    watermarkStyleId: chosenWatermarkStyle,
    watermarkOpacity: chosenWatermarkOpacity,
    ctaIntervalSeconds: chosenCtaInterval,
    ctaStylePreset: chosenCtaPreset,
    recommendedFps,
    signature
  };
}

function pacingChoice(slotNumber: number, seed: number) {
  const idx = (slotNumber + seed + Math.floor(Math.random() * PACING_BANDS.length)) % PACING_BANDS.length;
  return PACING_BANDS[idx];
}
