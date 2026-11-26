/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AnimationCategory =
  | 'uploadedVideo'
  | 'animista'
  | 'cinematic'
  | 'perspective3d'
  | 'dramaReview'
  | 'atmospheric'
  | 'dynamic'
  | 'editorial';

export type TransitionType =
  | 'crossfade'
  | 'cinematicDissolve'
  | 'smoothZoom'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'pageFlip3d'
  | 'softBlur'
  | 'lightSweep'
  | 'splitPanel'
  | 'motionBlur'
  | 'remotion_slide'
  | 'remotion_slide_reverse'
  | 'remotion_lightleak'
  | 'remotion_lightleak_reverse'
  | 'remotion_fade'
  | 'remotion_fade_reverse'
  | 'remotion_pushcut'
  | 'remotion_pushcut_reverse'
  | 'remotion_wipe'
  | 'remotion_wipe_reverse'
  | 'remotion_flip'
  | 'remotion_flip_reverse'
  | 'remotion_clockWipe'
  | 'remotion_clockWipe_reverse'
  | 'remotion_iris'
  | 'remotion_iris_reverse'
  | 'remotion_zoomBlur'
  | 'remotion_zoomBlur_reverse'
  | 'remotion_dreamyZoom'
  | 'remotion_dreamyZoom_reverse'
  | 'remotion_filmBurn'
  | 'remotion_filmBurn_reverse'
  | 'remotion_linearBlur'
  | 'remotion_linearBlur_reverse'
  | 'remotion_bookFlip'
  | 'remotion_bookFlip_reverse'
  | 'remotion_zoomInOut'
  | 'remotion_zoomInOut_reverse'
  | 'remotion_dissolve'
  | 'remotion_dissolve_reverse'
  | 'remotion_ripple'
  | 'remotion_ripple_reverse'
  | 'remotion_crosswarp'
  | 'remotion_crosswarp_reverse'
  | 'remotion_crossZoom'
  | 'remotion_crossZoom_reverse'
  | 'remotion_swap'
  | 'remotion_swap_reverse'
  | 'remotion_blurSlide'
  | 'remotion_blurSlide_reverse'
  | 'remotion_cube'
  | 'remotion_cube_reverse'
  | 'remotion_spring'
  | 'remotion_spring_reverse'
  | 'random';

export type PhotoFrameStyle =
  | 'classic_modern'
  | 'metallic_gold'
  | 'neon_cyber_glow'
  | 'gradient_duotone'
  | 'double_outline'
  | 'frosted_glass'
  | 'dashed_filmstrip'
  | 'polaroid_vintage'
  | 'sleek_dark_neon'
  | 'postage_stamp'
  | 'holographic_prism';

export interface RenderContext {
  slot?: TimelineSlot;
  slots?: TimelineSlot[];
  slotIndex?: number;
  getImage?: (dataUrl: string) => HTMLImageElement;
  getNeighborImages?: () => HTMLImageElement[];
}

export type IntroVideoEffectId =
  | 'none'
  | 'warm_golden'
  | 'cinema_dark'
  | 'vivid_hd'
  | 'teal_orange'
  | 'vintage_35mm'
  | 'soft_blur_glow';

export interface IntroVideoConfig {
  enabled: boolean;
  sourceType: 'main_video_clip' | 'uploaded_file' | 'tailor_export';
  customVideoUrl: string;
  customVideoBlob: Blob | null;
  customVideoName: string;
  posterUrl: string;
  sourceStartTime: number;
  duration: number;
  zoomLevel: number;
  panX: number;
  panY: number;
  mirror: boolean;
  effect: IntroVideoEffectId;
  muteIntroAudio: boolean;
  maxAvailableDuration: number;
}

export interface TimelineSlot {
  slotId: string;
  screenshotId: string;
  dataUrl: string;
  originalIndex: number;
  originalTimestamp?: number;
  formattedOriginalTime?: string;
  usageCount: number;
  startTime: number;
  duration: number;
  endTime: number;
  animationId: string;
  transitionType: TransitionType;
  transitionDuration: number;
  aspectRatio: number;
  frameStyle?: PhotoFrameStyle;
  frameColor?: string;
  frameAccentColor?: string;
  isIntroVideo?: boolean;
  videoUrl?: string;
  introSourceStartTime?: number;
  introZoom?: number;
  introPanX?: number;
  introPanY?: number;
  introMirror?: boolean;
  introEffect?: IntroVideoEffectId;
}

export type ColorGradingPreset =
  | 'none'
  | 'teal_orange'
  | 'warm_golden'
  | 'moody_noir'
  | 'vintage_35mm'
  | 'vivid_hd';

export type ChannelLayoutMode =
  | 'full_cinema'
  | 'news_desk_card'
  | 'split_comparison'
  | 'polaroid_collage'
  | 'documentary_bar'
  | 'editorial_frame'
  | 'triptych_mosaic'
  | 'panoramic_reel'
  | 'spotlight_pip'
  | 'spotlight_diary';

export type WeekdayKey = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export interface SeriesItem {
  id: string;
  title: string;
  uploadDays: WeekdayKey[];
  releaseDate?: string;
  releaseTimeLabel?: string;
  currentEpisode?: string;
  actorNames?: string;
  defaultContentType: NatokContentType;
  status: 'active' | 'archived';
  notes?: string;
  createdAt: number;
}

export interface BroadcastOverlayConfig {
  enabled: boolean;
  showLowerThird: boolean;
  showSubtitles: boolean;
  dramaTitle: string;
  episodeLabel?: string;
  scheduleLabel?: string;
  contentTypeLabel?: string;
  channelSlotNumber: number;
  accentColor?: string;
}

export interface TimelineConfig {
  targetDurationSeconds: number;
  durationMode: 'fixed' | 'matchVoiceover';
  minImageDuration: number;
  maxImageDuration: number;
  selectionMode: 'smart' | 'original' | 'random';
  defaultTransition: TransitionType;
  defaultTransitionDuration: number;
  randomizeTransitions: boolean;
  randomizeAnimations: boolean;
  randomizeFrames?: boolean;
  effectCategoryPreference?: 'uploadedVideo' | 'animista' | 'all';
  frameThemeId?: string;
  colorGrading?: ColorGradingPreset;
  enableCinematicLetterbox?: boolean;
  enableLightLeaks?: boolean;
  enableAmbientBackdrop?: boolean;
  enableFilmGrain?: boolean;
  overlayStyleId?: string;
  layoutMode?: ChannelLayoutMode;
  youtubeSeoEnabled?: boolean;
  youtubeDramaTitle?: string;
  youtubeCustomKeywords?: string;
  channelSlotNumber?: number;
  antiSpamVariationSeed?: number;
}

export type NatokContentType =
  | 'release_update'
  | 'review'
  | 'episode_preview'
  | 'best_scene'
  | 'ending_explained';

export interface YouTubeSeoConfig {
  enabled: boolean;
  contentType: NatokContentType;
  dramaTitle?: string;
  episodeNumber?: string;
  actorName?: string;
  channelName?: string;
  customKeywords?: string;
  enableAudioOptimization?: boolean;
  enableInFileMetadata?: boolean;
  channelSlotNumber?: number;
}

export interface TimelineSummary {
  requestedDuration: number;
  actualDuration: number;
  availableGalleryImages: number;
  uniqueImagesUsed: number;
  totalSlots: number;
  repeatedSlots: number;
  averageImageDuration: number;
  transitionCount: number;
  estimatedRenderSeconds: number;
}

export type ChannelStyleId =
  | 'cinematic_gold'
  | 'neon_cyan'
  | 'royal_silver'
  | 'fire_glow'
  | 'electric_blue'
  | 'elegant_white'
  | 'gradient_pulse'
  | 'shadow_edge'
  | 'glass_shine'
  | 'orbit_motion';

export interface ChannelStyleInfo {
  id: ChannelStyleId;
  name: string;
  nameBn: string;
  description: string;
}

export const CHANNEL_STYLES: ChannelStyleInfo[] = [
  { id: 'cinematic_gold', name: 'Cinematic Gold', nameBn: 'Cinematic Gold', description: 'Golden luxury glow & cinematic shine' },
  { id: 'neon_cyan', name: 'Neon Cyan', nameBn: 'Neon Cyan', description: 'Bright cyber cyan neon glow' },
  { id: 'orbit_motion', name: 'Slow Float', nameBn: 'Slow Float', description: 'Slow motion floating movement' },
  { id: 'shadow_edge', name: 'Smooth Rotate', nameBn: 'Smooth Rotate', description: 'Gentle rotating rotation effect' },
  { id: 'elegant_white', name: 'Gentle Zoom', nameBn: 'Gentle Zoom', description: 'Subtle zoom-in and zoom-out pulse' },
  { id: 'fire_glow', name: 'Fire Glow', nameBn: 'Fire Glow', description: 'Vibrant burning fire orange glow' },
  { id: 'electric_blue', name: 'Electric Blue', nameBn: 'Electric Blue', description: 'Electric blue pulse & energetic aura' },
  { id: 'royal_silver', name: 'Royal Silver', nameBn: 'Royal Silver', description: 'Elite metallic chrome & silver finish' },
  { id: 'glass_shine', name: 'Glass Shine', nameBn: 'Glass Shine', description: 'Frosted glass effect & reflective sweep' },
  { id: 'gradient_pulse', name: 'Gradient Pulse', nameBn: 'Gradient Pulse', description: 'Multicolor gradient & rhythmic pulsation' }
];

export interface ChannelSettings {
  name: string;
  styleId: ChannelStyleId;
  channelNameEnabled?: boolean;
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  ctaEnabled?: boolean;
  ctaIntervalSeconds?: number;
  ctaDurationSeconds?: number;
  ctaText?: string;
  ctaStylePreset?: 'all_rotating' | 'youtube_red' | 'neon_cyan' | 'royal_sunset' | 'emerald_mint' | 'glass_aurora';
}
