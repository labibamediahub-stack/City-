/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Upload,
  Video as VideoIcon,
  Play,
  Pause,
  RotateCcw,
  Rewind,
  FastForward,
  Scissors,
  Camera,
  Image as ImageIcon,
  Download,
  Trash2,
  CheckSquare,
  Square,
  Maximize2,
  Settings,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  FileArchive,
  Clock,
  Sliders,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  SquareActivity,
  StopCircle,
  RefreshCw,
  HardDrive,
  DownloadCloud,
  UploadCloud,
  Music,
  Film,
  Volume2,
  VolumeX,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Mic,
  Key,
  Zap,
  Copy,
  Calendar
} from 'lucide-react';
import JSZip from 'jszip';
import {
  TimelineSlot,
  TimelineConfig,
  TimelineSummary,
  TransitionType,
  PhotoFrameStyle,
  ChannelSettings,
  YouTubeSeoConfig,
  SeriesItem,
  BroadcastOverlayConfig,
  NatokContentType,
  IntroVideoConfig
} from './types/timeline';
import { SmartTimelineEngine, GalleryItemInput } from './services/smartTimelineEngine';
import { CanvasTimelineRenderer } from './services/canvasTimelineRenderer';
import { CinematicFxRenderer } from './services/cinematicFxRenderer';
import { ChannelOverlayRenderer } from './services/channelOverlayRenderer';
import {
  ExportEngine,
  decodeAudio,
  triggerDownloadBlob,
  DecodedExportAudio,
  pickSupportedAudioSampleRate
} from './services/exportEngine';
import {
  EXPORT_RESOLUTION_PRESETS,
  type ExportResolutionId,
  type PerformanceModeId,
  getSavedExportResolution,
  saveExportResolution,
  getSavedPerformanceMode,
  savePerformanceMode,
  getDefaultExportFpsForDevice,
  getRenderPerformanceFlags,
  refreshRenderPerformanceFlags
} from './services/devicePerformance';
import { decodeAudioSourceToPcmTrack } from './services/lowRamAudioMixer';
import { ctaSoundService } from './services/ctaSoundService';
import { getChannelDnaPreset, generateSmartAutoDna } from './services/channelDnaPresets';
import {
  loadSeriesList,
  saveSeriesList,
  getTodayWeekdayKey,
  getSeriesScheduledForDay,
  formatUploadDaysBn,
  formatReleaseDateBn,
  formatBroadcastEpisodeLabelBn,
  formatBroadcastScheduleLabelBn,
  loadDismissedTodayIds,
  saveDismissedTodayIds
} from './services/seriesScheduleManager';
import { buildTimedSubtitlesFromScript } from './services/subtitleEngine';
import { humanizeExportAudio } from './services/audioHumanizer';
import { runPolicySafetyAudit } from './services/spamSafetyChecker';
import { ChannelSettingsModal } from './components/ChannelSettingsModal';
import { SeriesScheduleModal } from './components/SeriesScheduleModal';
import { VoiceStudioPanel, DEFAULT_USER_BRACKET_SCRIPT, type VoiceStudioAgentHandle, type VoiceStudioAgentStatusSnapshot } from './components/VoiceStudioPanel';
import { AutoAgentPanel, type AgentPipelineStepState, type AgentStepKey, type AgentStepStatus } from './components/AutoAgentPanel';
import { GeminiApiKeyModal } from './components/GeminiApiKeyModal';
import { YouTubeSeoModal } from './components/YouTubeSeoModal';
import { OfflineIndicator } from './components/PWAInstallBanner';
import { YouTubeSeoOptimizer } from './services/youtubeSeoOptimizer';
import { BackgroundFxRenderer } from './services/backgroundFxRenderer';
import {
  ANIMATION_LIBRARY,
  TRANSITION_TYPES,
  getRandomFrameConfig,
  getCohesiveFrameConfig
} from './services/animationLibrary';
import { SmartTimelinePanel } from './components/SmartTimelinePanel';
import { TimelineFilmstrip } from './components/TimelineFilmstrip';
import { TailorStudioPanel } from './components/TailorStudioPanel';
import { MotionFXStudioModal } from './components/MotionFXStudioModal';
import { MotionFxStudioService } from './services/motionFxStudioService';

interface ScreenshotItem {
  id: string;
  dataUrl: string;
  timestamp: number;
  formattedTime: string;
  index: number;
  width: number;
  height: number;
  qualityStatus: 'passed' | 'retried' | 'reviewed';
  qualityTag?: string;
  hasAdDetected?: boolean;
  sharpnessScore?: number;
  wasReplaced?: boolean;
  replacedReason?: string;
  originalTime?: number;
  sceneSignature?: number[];
}

const DEFAULT_SAVED_CHANNELS: string[] = [];

const DEFAULT_SAVED_DRAMAS = [
  'মনের মানুষ (Moner Manush)',
  'ফায়ার আশার গল্প (Fire Ashar Golpo)',
  'নূরজাহান (Nurjahan)',
  'হৃদয়ের কথা (Hridoyer Kotha)',
  'শেষ বিকেলের গান (Shesh Bikeler Gaan)',
  'ব্যাচেলর পয়েন্ট (Bachelor Point)'
];

// Persistent Screenshot Default Settings
const DEFAULT_ZOOM_LEVEL = 1.4; // 140%
const DEFAULT_START_TRIM_SEC = 330; // 5 min 30 sec (330s)
const DEFAULT_END_TRIM_SEC = 330; // 5 min 30 sec (330s)
const STORAGE_KEY_ZOOM = 'vss_default_zoom_level';
const STORAGE_KEY_START_TRIM = 'vss_default_start_trim';
const STORAGE_KEY_END_TRIM = 'vss_default_end_trim';

export default function App() {
  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const videoUrlRef = useRef<string>('');
  videoUrlRef.current = videoUrl;
  const [videoName, setVideoName] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoWidth, setVideoWidth] = useState<number>(0);
  const [videoHeight, setVideoHeight] = useState<number>(0);

  // Zoom & Pan State (Default: 140% Zoom with persistent storage)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ZOOM);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 1.0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_ZOOM_LEVEL; // 140%
  });
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({ x: 0, y: 0, startPanX: 0, startPanY: 0 });

  // Trim & Settings State (Default: 5m 30s = 330 seconds each with persistent storage)
  const [startTrim, setStartTrim] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_START_TRIM);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_START_TRIM_SEC; // 330s (05:30)
  });

  const [endTrim, setEndTrim] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_END_TRIM);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_END_TRIM_SEC; // 330s (05:30)
  });

  const handleUpdateZoomLevel = (newZoom: number) => {
    setZoomLevel(newZoom);
    try {
      localStorage.setItem(STORAGE_KEY_ZOOM, newZoom.toString());
    } catch (_) {}
  };

  const handleUpdateStartTrim = (val: number) => {
    setStartTrim(val);
    try {
      localStorage.setItem(STORAGE_KEY_START_TRIM, val.toString());
    } catch (_) {}
    if (videoRef.current && !isGenerating && !isAgentRunning && !isPlaying && duration > 0) {
      try {
        videoRef.current.currentTime = Math.max(0, Math.min(Math.max(0, duration - 0.5), val));
      } catch (_) {}
    }
  };

  const handleUpdateEndTrim = (val: number) => {
    setEndTrim(val);
    try {
      localStorage.setItem(STORAGE_KEY_END_TRIM, val.toString());
    } catch (_) {}
  };
  
  // Screenshot Settings
  const [screenshotCount, setScreenshotCount] = useState<number>(30);
  const [customCountInput, setCustomCountInput] = useState<string>('30');
  const [imageFormat, setImageFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [imageQuality, setImageQuality] = useState<number>(0.92);

  // Generation & Background Processing State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; retried: number; statusText: string }>({ current: 0, total: 0, retried: 0, statusText: '' });
  const cancelGenerationRef = useRef<boolean>(false);
  const [enableSmartFrameFilter, setEnableSmartFrameFilter] = useState<boolean>(true);
  const [isAutoReplacingBatch, setIsAutoReplacingBatch] = useState<boolean>(false);

  // Gallery State (Screenshot/Editor is Tab #1 by default)
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'agent' | 'editor' | 'gallery' | 'tailor' | 'voice' | 'video'>('agent');
  const [lightboxImage, setLightboxImage] = useState<ScreenshotItem | null>(null);
  const [galleryVisibleLimit, setGalleryVisibleLimit] = useState<number>(50);
  const [storageStatus, setStorageStatus] = useState<string>('সেশন ডাটা সক্রিয়');

  // Drama Production & Script State
  const [dramaName, setDramaName] = useState<string>('মনের মানুষ (Moner Manush)');
  const [scriptText, setScriptText] = useState<string>(DEFAULT_USER_BRACKET_SCRIPT);
  const [debouncedScriptText, setDebouncedScriptText] = useState<string>(DEFAULT_USER_BRACKET_SCRIPT);

  // Video Slideshow & Smart Photo Timeline State
  const [slideDuration, setSlideDuration] = useState<number>(2.0);
  const [animationStyle, setAnimationStyle] = useState<'kenburns' | 'flip3d' | 'fadezoom' | 'cinematic'>('kenburns');
  const [isPlayingSlideshow, setIsPlayingSlideshow] = useState<boolean>(false);
  const [slideshowTime, setSlideshowTime] = useState<number>(0);
  const [isRenderingVideo, setIsRenderingVideo] = useState<boolean>(false);
  const [isExportFollowLive, setIsExportFollowLive] = useState<boolean>(true);
  const exportFollowLiveRef = useRef<boolean>(true);
  const activeTabRef = useRef<'agent' | 'editor' | 'gallery' | 'tailor' | 'voice' | 'video'>(activeTab);
  activeTabRef.current = activeTab;
  const [isMixingHomepageAudio, setIsMixingHomepageAudio] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [outputVideoFormat, setOutputVideoFormat] = useState<'mp4' | 'webm'>('mp4');
  const [exportFps, setExportFps] = useState<number>(() => getDefaultExportFpsForDevice());
  const [exportResolution, setExportResolution] = useState<ExportResolutionId>(() => getSavedExportResolution());
  const [performanceMode, setPerformanceMode] = useState<PerformanceModeId>(() => getSavedPerformanceMode());
  const handleUpdateExportResolution = useCallback((res: ExportResolutionId) => {
    saveExportResolution(res);
    setExportResolution(res);
  }, []);
  const handleUpdatePerformanceMode = useCallback((mode: PerformanceModeId) => {
    refreshRenderPerformanceFlags(mode);
    savePerformanceMode(mode);
    setPerformanceMode(mode);
  }, []);
  const previewPerfFlags = useMemo(() => getRenderPerformanceFlags(), [performanceMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedScriptText(scriptText);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [scriptText]);
  const [renderStatusInfo, setRenderStatusInfo] = useState<{
    fps?: number;
    etaSeconds?: number;
    currentFrame?: number;
    totalFrames?: number;
    state?: string;
    message?: string;
  }>({});
  const [exportedVideoResult, setExportedVideoResult] = useState<{
    blob: Blob;
    url: string;
    filename: string;
    duration: number;
    sizeBytes: number;
  } | null>(null);

  // Smart Photo Timeline & Adaptive Animation Engine State
  const [timelineSlots, setTimelineSlots] = useState<TimelineSlot[]>([]);
  const DEFAULT_INTRO_CONFIG: IntroVideoConfig = {
    enabled: false,
    sourceType: 'main_video_clip',
    customVideoUrl: '',
    customVideoBlob: null,
    customVideoName: '',
    posterUrl: '',
    sourceStartTime: 0,
    duration: 6,
    zoomLevel: 1.4,
    panX: 0,
    panY: 0,
    mirror: false,
    effect: 'none',
    muteIntroAudio: false,
    maxAvailableDuration: 0
  };
  const [introVideoConfig, setIntroVideoConfig] = useState<IntroVideoConfig>(DEFAULT_INTRO_CONFIG);
  const introVideoConfigRef = useRef<IntroVideoConfig>(DEFAULT_INTRO_CONFIG);
  introVideoConfigRef.current = introVideoConfig;
  const [isHomepageIntroOpen, setIsHomepageIntroOpen] = useState<boolean>(false);
  const homepageIntroSectionRef = useRef<HTMLDivElement | null>(null);

  const handleToggleHomepageIntroPanel = useCallback(() => {
    setIsHomepageIntroOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          homepageIntroSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
      return next;
    });
  }, []);

  const buildIntroSlotFromConfig = useCallback(
    (cfg: IntroVideoConfig, mainUrl: string, fallbackThumb: string): TimelineSlot | null => {
      if (!cfg.enabled) return null;
      const resolvedUrl =
        cfg.sourceType === 'main_video_clip' ? mainUrl : cfg.customVideoUrl || mainUrl;
      if (!resolvedUrl) return null;
      const introDur = Math.max(2, Math.round(cfg.duration * 10) / 10);
      return {
        slotId: `intro_slot_${cfg.sourceType}_${Math.round(cfg.sourceStartTime)}`,
        screenshotId: `intro_thumb_${cfg.sourceType}`,
        dataUrl: cfg.posterUrl || fallbackThumb || '',
        originalIndex: 0,
        originalTimestamp: cfg.sourceStartTime,
        formattedOriginalTime: 'INTRO',
        usageCount: 1,
        startTime: 0,
        duration: introDur,
        endTime: introDur,
        animationId: 'pan_right_gentle',
        transitionType: 'cinematicDissolve',
        transitionDuration: 0.6,
        aspectRatio: 16 / 9,
        frameStyle: 'classic_modern',
        isIntroVideo: true,
        videoUrl: resolvedUrl,
        introSourceStartTime: Math.max(0, cfg.sourceStartTime),
        introZoom: Math.max(1.0, cfg.zoomLevel || 1.0),
        introPanX: cfg.panX || 0,
        introPanY: cfg.panY || 0,
        introMirror: Boolean(cfg.mirror),
        introEffect: cfg.effect || 'none'
      };
    },
    []
  );
  const [timelineConfig, setTimelineConfig] = useState<TimelineConfig>({
    targetDurationSeconds: 0, // Strictly synced from final mixed audio (no fixed default)
    durationMode: 'matchVoiceover',
    minImageDuration: 5.0,
    maxImageDuration: 7.0,
    selectionMode: 'smart',
    defaultTransition: 'cinematicDissolve',
    defaultTransitionDuration: 0.6,
    randomizeTransitions: true,
    randomizeAnimations: true,
    effectCategoryPreference: 'uploadedVideo',
    frameThemeId: 'all_dynamic',
    colorGrading: 'teal_orange',
    enableCinematicLetterbox: false,
    enableLightLeaks: true,
    enableAmbientBackdrop: true,
    enableFilmGrain: true,
    layoutMode: getChannelDnaPreset(1).layoutMode
  });
  const [timelineSummary, setTimelineSummary] = useState<TimelineSummary | null>(null);
  
  // Audio state (clean initial state — no hardcoded default audio duration)
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioName, setAudioName] = useState<string>('');
  const [audioVolume, setAudioVolume] = useState<number>(0.8);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isAudioPreviewPlaying, setIsAudioPreviewPlaying] = useState<boolean>(false);

  // Channel Settings & Animated Watermark State
  const [activeChannelSlot, setActiveChannelSlot] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('active_channel_slot_v1') || '1');
      return saved >= 1 && saved <= 10 ? saved : 1;
    } catch {
      return 1;
    }
  });
  const [channelSettings, setChannelSettings] = useState<ChannelSettings>(() => {
    let slot = 1;
    try {
      const savedSlot = Number(localStorage.getItem('active_channel_slot_v1') || '1');
      if (savedSlot >= 1 && savedSlot <= 10) slot = savedSlot;
    } catch {}
    let savedList: string[] = [];
    try {
      const rawCh = localStorage.getItem('saved_channels');
      if (rawCh) {
        const parsed = JSON.parse(rawCh);
        if (Array.isArray(parsed)) savedList = parsed;
      }
    } catch {}
    let storedSettings: Partial<ChannelSettings> | null = null;
    try {
      const rawSet = localStorage.getItem('channel_settings_v1');
      if (rawSet) storedSettings = JSON.parse(rawSet);
    } catch {}

    const preset = getChannelDnaPreset(slot);
    const slotName = savedList[slot - 1]?.trim() || '';
    const resolvedName = slotName || storedSettings?.name?.trim() || '';

    return {
      name: resolvedName,
      styleId: storedSettings?.styleId || preset.watermarkStyleId,
      channelNameEnabled: storedSettings?.channelNameEnabled ?? true,
      watermarkEnabled: storedSettings?.watermarkEnabled ?? true,
      watermarkOpacity: storedSettings?.watermarkOpacity ?? preset.watermarkOpacity,
      ctaEnabled: storedSettings?.ctaEnabled ?? true,
      ctaIntervalSeconds: storedSettings?.ctaIntervalSeconds ?? preset.ctaIntervalSeconds,
      ctaDurationSeconds: storedSettings?.ctaDurationSeconds ?? 4.0,
      ctaText: storedSettings?.ctaText || 'দয়া করে চ্যানেলটি সাবস্ক্রাইব করুন এবং ভিডিওটিতে লাইক দিন 👍🔔',
      ctaStylePreset: storedSettings?.ctaStylePreset || preset.ctaStylePreset
    };
  });
  const channelSettingsRef = useRef<ChannelSettings>(channelSettings);
  channelSettingsRef.current = channelSettings;

  useEffect(() => {
    try {
      localStorage.setItem('channel_settings_v1', JSON.stringify(channelSettings));
    } catch (_) {}
  }, [channelSettings]);
  const [backgroundEffect, setBackgroundEffect] = useState<string>('starlight_dust');
  const [overlayEffect, setOverlayEffect] = useState<string>('starlight_dust');
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState<boolean>(false);
  const [isChannelSettingsOpen, setIsChannelSettingsOpen] = useState<boolean>(false);
  const [isMotionFxStudioOpen, setIsMotionFxStudioOpen] = useState<boolean>(false);
  const [channelSettingsModalTab, setChannelSettingsModalTab] = useState<'channels' | 'dramas'>('channels');
  const [isGeminiKeyModalOpen, setIsGeminiKeyModalOpen] = useState<boolean>(false);
  const [isYouTubeSeoModalOpen, setIsYouTubeSeoModalOpen] = useState<boolean>(false);
  const [isSeriesScheduleOpen, setIsSeriesScheduleOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>(() => loadSeriesList());
  const [dismissedTodayIds, setDismissedTodayIds] = useState<string[]>(() => loadDismissedTodayIds());
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('active_series_id_v1');
      if (saved) return saved;
    } catch (_) {}
    const initial = loadSeriesList();
    const todayMatches = getSeriesScheduledForDay(initial, getTodayWeekdayKey());
    return todayMatches[0]?.id || initial.find((s) => s.status === 'active')?.id || null;
  });
  const [showLowerThird, setShowLowerThird] = useState<boolean>(true);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [effectsEnabled, setEffectsEnabled] = useState<boolean>(true);
  const [humanizeAudioEnabled, setHumanizeAudioEnabled] = useState<boolean>(true);
  const [standaloneReleaseDate, setStandaloneReleaseDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('natok_standalone_release_date_v1');
      if (saved) return saved;
    } catch (_) {}
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [youtubeSeoConfig, setYoutubeSeoConfig] = useState<YouTubeSeoConfig>(() => ({
    enabled: true,
    contentType: 'release_update',
    dramaTitle: '',
    episodeNumber: 'নতুন পর্ব',
    actorName: '',
    channelName: '',
    customKeywords: '',
    enableAudioOptimization: true,
    enableInFileMetadata: true
  }));

  // Saved Channels & Saved Dramas persistent lists
  const [savedChannels, setSavedChannels] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('saved_channels');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // If stored is legacy hardcoded default list, clear it so user starts with clean list
          const isLegacyDefault = parsed.includes('Labiba Media Hub') && parsed.includes('Bangla Drama Network');
          if (!isLegacyDefault) return parsed;
        }
      }
    } catch (_) {}
    return DEFAULT_SAVED_CHANNELS;
  });

  const [savedDramas, setSavedDramas] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('saved_dramas');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_SAVED_DRAMAS;
  });

  const handleUpdateSavedChannels = useCallback((channels: string[]) => {
    setSavedChannels(channels);
    try {
      localStorage.setItem('saved_channels', JSON.stringify(channels));
    } catch (_) {}
  }, []);

  const handleUpdateChannelNameQuick = useCallback(
    (rawName: string) => {
      setChannelSettings((prev) => {
        const next = { ...prev, name: rawName };
        channelSettingsRef.current = next;
        return next;
      });
      setSavedChannels((prev) => {
        const next = [...prev];
        const targetIdx = Math.max(0, activeChannelSlot - 1);
        while (next.length <= targetIdx) {
          next.push('');
        }
        next[targetIdx] = rawName;
        try {
          localStorage.setItem('saved_channels', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
    },
    [activeChannelSlot]
  );

  const handleUpdateSavedDramas = useCallback((dramas: string[]) => {
    setSavedDramas(dramas);
    try {
      localStorage.setItem('saved_dramas', JSON.stringify(dramas));
    } catch (_) {}
  }, []);

  // Live change preview banner state
  const [livePreviewBanner, setLivePreviewBanner] = useState<string | null>(null);
  const livePreviewTimeoutRef = useRef<number | null>(null);

  // Refs
  const isInitializedRef = useRef<boolean>(false);
  const slideshowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const slideshowAnimRef = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedGalleryKeyRef = useRef<string>('');
  const prevActiveTabRef = useRef<'agent' | 'editor' | 'gallery' | 'tailor' | 'voice' | 'video'>(activeTab);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRendererInstanceRef = useRef<CanvasTimelineRenderer | null>(null);
  if (!canvasRendererInstanceRef.current) {
    canvasRendererInstanceRef.current = new CanvasTimelineRenderer({ maxImageCache: 16 });
  }
  const canvasRendererRef = useRef<CanvasTimelineRenderer>(canvasRendererInstanceRef.current);
  const exportEngineRef = useRef<ExportEngine | null>(null);
  const voiceStudioRef = useRef<VoiceStudioAgentHandle | null>(null);
  const lastCtaCycleRef = useRef<number | null>(null);
  const [isExportPaused, setIsExportPaused] = useState(false);
  const latestGeneratedTimelineRef = useRef<{
    slots: TimelineSlot[];
    config: TimelineConfig;
    channelSettings: ChannelSettings;
    overlayStyleId: string;
    recommendedFps: 24 | 30;
  } | null>(null);

  // Autonomous AI Agent State
  const [voiceStudioSnapshot, setVoiceStudioSnapshot] = useState<VoiceStudioAgentStatusSnapshot | null>(null);
  const [preferredVoiceSource, setPreferredVoiceSource] = useState<'auto' | 'recorded' | 'script'>('auto');
  const [forceRegenerateVoice, setForceRegenerateVoice] = useState<boolean>(false);
  const [customFinalDurationSec, setCustomFinalDurationSec] = useState<number | null>(null);
  const [isAdaptingHomepageScript, setIsAdaptingHomepageScript] = useState<boolean>(false);
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false);
  const agentCancelledRef = useRef<boolean>(false);
  const agentRunIdRef = useRef<number>(0);
  const agentDisplayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoPreviewReadyTick, setVideoPreviewReadyTick] = useState<number>(0);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentSuccessMessage, setAgentSuccessMessage] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentPipelineStepState[]>([
    { key: 'voice', label: 'ভয়েস তৈরি / যাচাই', status: 'idle', detail: '', percent: 0 },
    { key: 'bgm', label: 'ব্যাকগ্রাউন্ড মিউজিক অ্যাড', status: 'idle', detail: '', percent: 0 },
    { key: 'screenshots', label: 'ভিডিও থেকে স্মার্ট স্ক্রিনশট গ্রহণ', status: 'idle', detail: '', percent: 0 },
    { key: 'timeline', label: 'টাইমলাইন, এনিমেশন ও নাটক ওভারলে সেট', status: 'idle', detail: '', percent: 0 },
    { key: 'export', label: `${exportResolution.toUpperCase()} MP4 রেন্ডার ও সরাসরি এক্সপোর্ট`, status: 'idle', detail: '', percent: 0 },
  ]);

  const effectiveAutoDurationSec = useMemo(() => {
    const hasRecorded = Boolean(voiceStudioSnapshot?.hasRecordedVoice);
    const useRecorded =
      preferredVoiceSource === 'recorded' || (preferredVoiceSource === 'auto' && hasRecorded);
    if (useRecorded) {
      if (voiceStudioSnapshot?.masterMatchesCurrentSource && voiceStudioSnapshot.masterDuration > 0) {
        return Math.round(voiceStudioSnapshot.masterDuration * 10) / 10;
      }
      if (voiceStudioSnapshot?.predictedFinalDurationSec && voiceStudioSnapshot.predictedFinalDurationSec > 0) {
        return Math.round(voiceStudioSnapshot.predictedFinalDurationSec * 10) / 10;
      }
      return 0;
    }
    if (!scriptText.trim()) return 0;
    if (voiceStudioSnapshot?.masterMatchesCurrentSource && voiceStudioSnapshot.masterDuration > 0) {
      return Math.round(voiceStudioSnapshot.masterDuration * 10) / 10;
    }
    if (voiceStudioSnapshot?.predictedFinalDurationSec && voiceStudioSnapshot.predictedFinalDurationSec > 0) {
      return Math.round(voiceStudioSnapshot.predictedFinalDurationSec * 10) / 10;
    }
    const est = voiceStudioSnapshot?.estimatedDurationSec || 0;
    return est > 0 ? Math.round(est * 10) / 10 : 0;
  }, [
    preferredVoiceSource,
    voiceStudioSnapshot?.hasRecordedVoice,
    voiceStudioSnapshot?.masterMatchesCurrentSource,
    voiceStudioSnapshot?.masterDuration,
    voiceStudioSnapshot?.predictedFinalDurationSec,
    voiceStudioSnapshot?.estimatedDurationSec,
    scriptText,
  ]);

  const autoBaselineDurationSec =
    effectiveAutoDurationSec > 0
      ? effectiveAutoDurationSec
      : audioDuration > 0
      ? Math.round(audioDuration * 10) / 10
      : 0;

  // Auto-reset manual Final Duration override ONLY when user clears script & audio completely
  const prevHasSourceContentRef = useRef<boolean>(false);
  useEffect(() => {
    const hasContent = Boolean(
      scriptText.trim() || voiceStudioSnapshot?.hasRecordedVoice || audioDuration > 0
    );
    if (
      prevHasSourceContentRef.current &&
      !hasContent &&
      !isAgentRunning &&
      !isMixingHomepageAudio &&
      !isAdaptingHomepageScript
    ) {
      setCustomFinalDurationSec(null);
    }
    prevHasSourceContentRef.current = hasContent;
  }, [
    scriptText,
    voiceStudioSnapshot?.hasRecordedVoice,
    audioDuration,
    isAgentRunning,
    isMixingHomepageAudio,
    isAdaptingHomepageScript,
  ]);

  const effectiveHomepageDurationSec =
    customFinalDurationSec !== null ? customFinalDurationSec : autoBaselineDurationSec;

  const estimatedHomepageShots = useMemo(() => {
    if (effectiveHomepageDurationSec <= 0) return 0;
    return Math.max(1, Math.round((effectiveHomepageDurationSec - 0.6) / 5.4));
  }, [effectiveHomepageDurationSec]);

  const homepageMasterAudio = useMemo(() => {
    if (voiceStudioSnapshot?.masterMatchesCurrentSource && voiceStudioSnapshot.masterAudioUrl) {
      return {
        url: voiceStudioSnapshot.masterAudioUrl,
        duration: voiceStudioSnapshot.masterDuration || 0,
        name:
          voiceStudioSnapshot.masterSourceType === 'recorded'
            ? voiceStudioSnapshot.recordedVoiceName || 'Recorded Mix'
            : 'AI Master Mix',
      };
    }
    if (!voiceStudioSnapshot?.hasRecordedVoice && !scriptText.trim() && audioUrl) {
      return {
        url: audioUrl,
        duration: audioDuration || 0,
        name: audioName || 'Audio',
      };
    }
    return { url: '', duration: 0, name: '' };
  }, [
    voiceStudioSnapshot?.masterMatchesCurrentSource,
    voiceStudioSnapshot?.masterAudioUrl,
    voiceStudioSnapshot?.masterDuration,
    voiceStudioSnapshot?.masterSourceType,
    voiceStudioSnapshot?.recordedVoiceName,
    voiceStudioSnapshot?.hasRecordedVoice,
    scriptText,
    audioUrl,
    audioDuration,
    audioName,
  ]);

  // Automatically sync timeline target duration & required screenshot count from final audio duration
  const prevSyncedHomepageDurationRef = useRef<number>(0);
  useEffect(() => {
    if (isAgentRunning || isRenderingVideo) return;
    if (effectiveHomepageDurationSec <= 0) {
      if (prevSyncedHomepageDurationRef.current !== 0) {
        prevSyncedHomepageDurationRef.current = 0;
        if (timelineConfig.durationMode === 'matchVoiceover' && audioDuration <= 0) {
          setTimelineConfig((prev) => ({
            ...prev,
            targetDurationSeconds: 0,
            durationMode: 'matchVoiceover',
          }));
        }
      }
      return;
    }
    if (prevSyncedHomepageDurationRef.current === effectiveHomepageDurationSec) return;
    prevSyncedHomepageDurationRef.current = effectiveHomepageDurationSec;

    const needed = Math.max(1, Math.round((effectiveHomepageDurationSec - 0.6) / 5.4));
    setScreenshotCount(needed);
    setCustomCountInput(String(needed));
    setTimelineConfig((prev) => ({
      ...prev,
      targetDurationSeconds: effectiveHomepageDurationSec,
      durationMode: 'matchVoiceover',
    }));
  }, [effectiveHomepageDurationSec, isAgentRunning, isRenderingVideo, timelineConfig.durationMode, audioDuration]);

  const totalSlideshowDuration = timelineSlots.length > 0
    ? (timelineSlots[timelineSlots.length - 1]?.endTime || 0)
    : (screenshots.length * slideDuration);

  const activeSeries = useMemo(
    () => seriesList.find((s) => s.id === activeSeriesId) || null,
    [seriesList, activeSeriesId]
  );

  const allTodaysSeriesList = useMemo(
    () => getSeriesScheduledForDay(seriesList, getTodayWeekdayKey()),
    [seriesList]
  );

  const todaysSeriesList = useMemo(
    () => allTodaysSeriesList.filter((s) => !dismissedTodayIds.includes(s.id)),
    [allTodaysSeriesList, dismissedTodayIds]
  );

  const handleDismissTodaySeries = useCallback((seriesId: string) => {
    setDismissedTodayIds((prev) => {
      const next = prev.includes(seriesId) ? prev : [...prev, seriesId];
      saveDismissedTodayIds(next);
      return next;
    });
  }, []);

  const handleClearAllTodaySeries = useCallback(() => {
    setDismissedTodayIds((prev) => {
      const allIds = allTodaysSeriesList.map((s) => s.id);
      const next = Array.from(new Set([...prev, ...allIds]));
      saveDismissedTodayIds(next);
      return next;
    });
  }, [allTodaysSeriesList]);

  const handleRestoreTodaySeries = useCallback(() => {
    setDismissedTodayIds([]);
    saveDismissedTodayIds([]);
  }, []);

  const handleSaveSeriesList = useCallback((items: SeriesItem[]) => {
    setSeriesList(items);
    saveSeriesList(items);
  }, []);

  const activeReleaseDate = activeSeries ? (activeSeries.releaseDate || '') : standaloneReleaseDate;
  const formattedReleaseDate = useMemo(
    () => formatReleaseDateBn(activeReleaseDate),
    [activeReleaseDate]
  );

  const broadcastOverlayConfig = useMemo<BroadcastOverlayConfig>(() => {
    const fullContentTypeLabels: Record<NatokContentType, string> = {
      review: 'নাটক রিভিউ ও গল্প বিশ্লেষণ',
      release_update: 'রিলিজ ডেট ও সময়সূচি আপডেট',
      episode_preview: 'আগামী পর্ব প্রিভিউ',
      best_scene: 'সেরা দৃশ্য ও সংলাপ বিশ্লেষণ',
      ending_explained: 'সমাপ্তি ও টুইস্ট ব্যাখ্যা'
    };
    const compactContentTypeLabels: Record<NatokContentType, string> = {
      review: 'নাটক রিভিউ',
      release_update: 'রিলিজ আপডেট',
      episode_preview: 'পর্ব প্রিভিউ',
      best_scene: 'সেরা দৃশ্য',
      ending_explained: 'সমাপ্তি ব্যাখ্যা'
    };
    const effectiveType: NatokContentType =
      activeSeries?.defaultContentType || youtubeSeoConfig.contentType || 'review';
    const rawEpisode = activeSeries?.currentEpisode || youtubeSeoConfig.episodeNumber || '';
    const scheduleText = formatBroadcastScheduleLabelBn(
      activeReleaseDate,
      activeSeries?.uploadDays
    );
    return {
      enabled: showLowerThird || showSubtitles,
      showLowerThird,
      showSubtitles,
      dramaTitle: activeSeries?.title || (activeSeriesId === null ? '' : youtubeSeoConfig.dramaTitle || dramaName || ''),
      episodeLabel: formatBroadcastEpisodeLabelBn(rawEpisode),
      scheduleLabel: scheduleText,
      contentTypeLabel: scheduleText
        ? compactContentTypeLabels[effectiveType]
        : fullContentTypeLabels[effectiveType],
      channelSlotNumber: activeChannelSlot
    };
  }, [
    showLowerThird,
    showSubtitles,
    activeSeries,
    activeSeriesId,
    activeReleaseDate,
    youtubeSeoConfig.dramaTitle,
    youtubeSeoConfig.episodeNumber,
    youtubeSeoConfig.contentType,
    dramaName,
    activeChannelSlot
  ]);

  const subtitleCues = useMemo(() => {
    const effectiveDur =
      totalSlideshowDuration > 0
        ? totalSlideshowDuration
        : audioDuration > 0
        ? audioDuration
        : timelineConfig.targetDurationSeconds || 60;
    const hasIntro = timelineSlots.some((s) => s.isIntroVideo);
    const firstPhoto = hasIntro ? timelineSlots.find((s) => !s.isIntroVideo) : null;
    const introOffsetSec = hasIntro && firstPhoto ? Math.max(0, firstPhoto.startTime) : 0;
    return buildTimedSubtitlesFromScript(debouncedScriptText, effectiveDur, introOffsetSec);
  }, [debouncedScriptText, totalSlideshowDuration, audioDuration, timelineConfig.targetDurationSeconds, timelineSlots]);

  const safetyReport = useMemo(() => {
    const seoPkg = YouTubeSeoOptimizer.generateSeoPackage({
      dramaName: broadcastOverlayConfig.dramaTitle || dramaName,
      channelName: channelSettings.name,
      totalDurationSeconds: totalSlideshowDuration || audioDuration || 60,
      contentType: activeSeries?.defaultContentType || youtubeSeoConfig.contentType,
      episodeNumber: broadcastOverlayConfig.episodeLabel,
      actorName: activeSeries?.actorNames || youtubeSeoConfig.actorName,
      channelSlotNumber: activeChannelSlot
    });
    return runPolicySafetyAudit({
      slots: timelineSlots,
      config: timelineConfig,
      galleryCount: screenshots.length,
      audioDuration,
      dramaTitle: broadcastOverlayConfig.dramaTitle || dramaName,
      scriptText: debouncedScriptText,
      seoTitle: seoPkg.title,
      showLowerThird,
      showSubtitles,
      activeChannelSlot
    });
  }, [
    timelineSlots,
    timelineConfig,
    screenshots.length,
    audioDuration,
    broadcastOverlayConfig.dramaTitle,
    broadcastOverlayConfig.episodeLabel,
    dramaName,
    channelSettings.name,
    totalSlideshowDuration,
    activeSeries?.defaultContentType,
    activeSeries?.actorNames,
    youtubeSeoConfig.contentType,
    youtubeSeoConfig.actorName,
    debouncedScriptText,
    showLowerThird,
    showSubtitles,
    activeChannelSlot
  ]);

  // Stop any ongoing video/audio playback when activeTab changes to prevent overlapping audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    ctaSoundService.stopAllLive();
    lastCtaCycleRef.current = null;
    if (activeTab === 'video') {
      ctaSoundService.preloadAll();
    } else {
      if (bgVideoRef.current) {
        bgVideoRef.current.pause();
      }
      canvasRendererRef.current.clearCache();
      CinematicFxRenderer.clearBackdropCache();
      ctaSoundService.clearLiveBuffers();
    }
    if (activeTab === 'gallery') {
      setGalleryVisibleLimit(50);
    }
    setIsPlaying(false);
    setIsPlayingSlideshow(false);
    setIsAudioPreviewPlaying(false);
  }, [activeTab]);

  // Render Frame with Adaptive Animation & Transition Engine
  const renderSlideshowFrame = useCallback((time: number, customSlots?: TimelineSlot[]) => {
    const canvas = slideshowCanvasRef.current;
    if (!canvas) return;

    // Synchronize background video currentTime if active
    if (bgVideoRef.current && bgVideoRef.current.readyState >= 2) {
      const vidDur = bgVideoRef.current.duration || 100.59;
      const targetBgTime = (time % vidDur);
      if (Math.abs(bgVideoRef.current.currentTime - targetBgTime) > 0.35) {
        bgVideoRef.current.currentTime = targetBgTime;
      }
    }

    const activeSlots = customSlots || timelineSlots;
    if (activeSlots && activeSlots.length > 0) {
      canvasRendererRef.current.renderFrame(
        canvas,
        activeSlots,
        time,
        effectsEnabled ? backgroundEffect : 'none',
        bgVideoRef.current,
        {
          colorGrading: effectsEnabled ? timelineConfig.colorGrading : 'none',
          enableLetterbox: effectsEnabled ? timelineConfig.enableCinematicLetterbox : false,
          enableLightLeaks: effectsEnabled ? timelineConfig.enableLightLeaks : false,
          enableAmbientBackdrop: effectsEnabled ? timelineConfig.enableAmbientBackdrop : false,
          enableFilmGrain: effectsEnabled ? timelineConfig.enableFilmGrain : false,
          overlayStyleId: effectsEnabled
            ? (overlayEffect || timelineConfig.overlayStyleId || backgroundEffect)
            : 'none',
          layoutMode: effectsEnabled
            ? (timelineConfig.layoutMode || getChannelDnaPreset(activeChannelSlot).layoutMode)
            : 'full_cinema',
          dramaTitle: broadcastOverlayConfig.dramaTitle,
          scheduleLabel: broadcastOverlayConfig.scheduleLabel,
          channelSlotNumber: timelineConfig.channelSlotNumber || activeChannelSlot,
          antiSpamVariationSeed: timelineConfig.antiSpamVariationSeed || 0
        }
      );
      const activeCh = channelSettingsRef.current;
      ChannelOverlayRenderer.renderOverlay(canvas, activeCh, time);
      ChannelOverlayRenderer.renderBroadcastOverlay(
        canvas,
        broadcastOverlayConfig,
        subtitleCues,
        activeCh,
        time
      );
      return;
    }

    if (screenshots.length === 0) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const totalDur = screenshots.length * slideDuration;
    const clampedTime = Math.max(0, Math.min(totalDur, time));
    const currentIndex = Math.min(screenshots.length - 1, Math.floor(clampedTime / Math.max(0.1, slideDuration)));
    const item = screenshots[currentIndex];
    if (!item) return;

    const img = canvasRendererRef.current.getImage(item.dataUrl, () => {
      renderSlideshowFrame(time, customSlots);
    });
    const w = canvas.width || 1280;
    const h = canvas.height || 720;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    BackgroundFxRenderer.renderBackground(ctx, effectsEnabled ? backgroundEffect : 'none', clampedTime, w, h, bgVideoRef.current);

    if (img && img.complete && img.naturalWidth > 0) {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = w / h;
      let drawW = w;
      let drawH = h;
      let offsetX = 0;
      let offsetY = 0;

      if (imgAspect > canvasAspect) {
        drawH = w / imgAspect;
        offsetY = (h - drawH) / 2;
      } else {
        drawW = h * imgAspect;
        offsetX = (w - drawW) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    }
    ctx.restore();
    const activeCh = channelSettingsRef.current;
    ChannelOverlayRenderer.renderOverlay(canvas, activeCh, time);
    ChannelOverlayRenderer.renderBroadcastOverlay(
      canvas,
      broadcastOverlayConfig,
      subtitleCues,
      activeCh,
      time
    );
  }, [timelineSlots, screenshots, slideDuration, channelSettings, backgroundEffect, overlayEffect, timelineConfig, isPlayingSlideshow, activeChannelSlot, broadcastOverlayConfig, subtitleCues, effectsEnabled]);


  const showLivePreviewBanner = useCallback((msg: string) => {
    setLivePreviewBanner(msg);
    if (livePreviewTimeoutRef.current) clearTimeout(livePreviewTimeoutRef.current);
    livePreviewTimeoutRef.current = window.setTimeout(() => {
      setLivePreviewBanner(null);
    }, 1800);
  }, []);

  const handleMixHomepagePreviewAudio = useCallback(async () => {
    if (!voiceStudioRef.current || isMixingHomepageAudio) return;
    setIsMixingHomepageAudio(true);
    try {
      const res = await voiceStudioRef.current.mixPreviewAudioOnly(
        preferredVoiceSource,
        customFinalDurationSec
      );
      if (res && res.duration > 0) {
        showLivePreviewBanner(`ফাইনাল মিক্সড অডিও প্রস্তুত (${formatTime(res.duration)})`);
      }
    } finally {
      setIsMixingHomepageAudio(false);
    }
  }, [isMixingHomepageAudio, preferredVoiceSource, customFinalDurationSec, showLivePreviewBanner]);

  const handleAdaptHomepageScriptToFinalDuration = useCallback(async () => {
    if (!voiceStudioRef.current || isAdaptingHomepageScript) return;
    const tgt = customFinalDurationSec ?? effectiveHomepageDurationSec;
    if (!tgt || tgt < 10) {
      showLivePreviewBanner('স্ক্রিপ্ট অ্যাডাপ্ট করার জন্য ন্যূনতম ১০ সেকেন্ড সিলেক্ট করুন।');
      return;
    }
    setIsAdaptingHomepageScript(true);
    try {
      const adapted = await voiceStudioRef.current.adaptScriptToTargetSeconds(tgt);
      if (adapted) {
        showLivePreviewBanner(`✅ ${formatTime(tgt)} অনুযায়ী বাংলা স্ক্রিপ্ট প্রস্তুত!`);
      }
    } finally {
      setIsAdaptingHomepageScript(false);
    }
  }, [
    isAdaptingHomepageScript,
    customFinalDurationSec,
    effectiveHomepageDurationSec,
    showLivePreviewBanner,
  ]);

  const handleSelectSeries = useCallback(
    (series: SeriesItem) => {
      setActiveSeriesId(series.id);
      try {
        localStorage.setItem('active_series_id_v1', series.id);
      } catch (_) {}
      setDramaName(series.title);
      setYoutubeSeoConfig((prev) => ({
        ...prev,
        dramaTitle: series.title,
        episodeNumber: series.currentEpisode || prev.episodeNumber || 'নতুন পর্ব',
        actorName: series.actorNames || prev.actorName || '',
        contentType: series.defaultContentType || prev.contentType,
        channelSlotNumber: activeChannelSlot
      }));
      setSavedDramas((prev) => {
        if (prev.includes(series.title)) return prev;
        const next = [series.title, ...prev];
        try {
          localStorage.setItem('saved_dramas', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
      showLivePreviewBanner(
        series.uploadDays.length > 0
          ? `📅 নাটক সিলেক্ট হয়েছে: ${series.title} (${formatUploadDaysBn(series.uploadDays)})`
          : `🎬 নাটক সিলেক্ট হয়েছে: ${series.title}`
      );
    },
    [activeChannelSlot, showLivePreviewBanner]
  );

  const handleSelectSeriesById = useCallback(
    (seriesId: string) => {
      if (!seriesId || seriesId === '__none__') {
        setActiveSeriesId(null);
        try {
          localStorage.removeItem('active_series_id_v1');
        } catch (_) {}
        setDramaName('');
        setYoutubeSeoConfig((prev) => ({ ...prev, dramaTitle: '' }));
        showLivePreviewBanner('ℹ️ ভিডিওতে নাটকের নাম (লোয়ার-থার্ড) খালি রাখা হয়েছে');
        return;
      }
      const found = seriesList.find((s) => s.id === seriesId);
      if (found) {
        if (found.status === 'archived') {
          const restored = seriesList.map((s) =>
            s.id === found.id ? { ...s, status: 'active' as const } : s
          );
          handleSaveSeriesList(restored);
        }
        handleSelectSeries(found);
      }
    },
    [seriesList, handleSaveSeriesList, handleSelectSeries, showLivePreviewBanner]
  );

  const handleQuickAddDrama = useCallback(
    (title: string, episode?: string) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;
      const cleanEpisode = (episode || '').trim() || 'নতুন পর্ব';

      const existing = seriesList.find(
        (s) => s.title.trim().toLowerCase() === cleanTitle.toLowerCase()
      );
      if (existing) {
        const updatedList = seriesList.map((s) =>
          s.id === existing.id
            ? {
                ...s,
                status: 'active' as const,
                currentEpisode: cleanEpisode || s.currentEpisode || 'নতুন পর্ব'
              }
            : s
        );
        handleSaveSeriesList(updatedList);
        const updatedTarget = updatedList.find((s) => s.id === existing.id) || existing;
        handleSelectSeries(updatedTarget);
      } else {
        const newItem: SeriesItem = {
          id: `series_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: cleanTitle,
          uploadDays: [],
          releaseTimeLabel: '',
          currentEpisode: cleanEpisode,
          actorNames: '',
          defaultContentType: youtubeSeoConfig.contentType || 'review',
          status: 'active',
          notes: '',
          createdAt: Date.now()
        };
        handleSaveSeriesList([newItem, ...seriesList]);
        handleSelectSeries(newItem);
      }
    },
    [
      seriesList,
      youtubeSeoConfig.contentType,
      handleSaveSeriesList,
      handleSelectSeries
    ]
  );

  const handleUpdateActiveEpisode = useCallback(
    (newEpisode: string) => {
      setYoutubeSeoConfig((prev) => ({ ...prev, episodeNumber: newEpisode }));
      if (activeSeriesId) {
        const updated = seriesList.map((s) =>
          s.id === activeSeriesId ? { ...s, currentEpisode: newEpisode } : s
        );
        handleSaveSeriesList(updated);
      }
    },
    [activeSeriesId, seriesList, handleSaveSeriesList]
  );

  const handleUpdateReleaseDate = useCallback(
    (newDate: string) => {
      if (activeSeriesId) {
        const updated = seriesList.map((s) =>
          s.id === activeSeriesId ? { ...s, releaseDate: newDate } : s
        );
        handleSaveSeriesList(updated);
      } else {
        setStandaloneReleaseDate(newDate);
        try {
          if (newDate) {
            localStorage.setItem('natok_standalone_release_date_v1', newDate);
          } else {
            localStorage.removeItem('natok_standalone_release_date_v1');
          }
        } catch (_) {}
      }
      const formatted = formatReleaseDateBn(newDate);
      if (formatted) {
        showLivePreviewBanner(`📅 রিলিজ তারিখ সেট হয়েছে: ${formatted}`);
      } else {
        showLivePreviewBanner('📅 নির্দিষ্ট তারিখ রিসেট করে সাপ্তাহিক বার দেখানো হচ্ছে');
      }
    },
    [activeSeriesId, seriesList, handleSaveSeriesList, showLivePreviewBanner]
  );

  // Smart Timeline Generation Handlers (automatically applies non-repeating channel DNA while preserving chosen channel name & watermark)
  const handleGenerateSmartTimeline = useCallback((customShots?: ScreenshotItem[], customDurationSec?: number): TimelineSlot[] => {
    const shotsToUse = customShots && customShots.length > 0 ? customShots : screenshots;
    if (shotsToUse.length === 0) return [];
    const dna = generateSmartAutoDna(activeChannelSlot);
    const customName = savedChannels[activeChannelSlot - 1]?.trim();
    const currentCh = channelSettingsRef.current;
    const resolvedChannelSettings: ChannelSettings = {
      ...currentCh,
      name: (customName || currentCh.name || '').trim(),
      ctaIntervalSeconds: currentCh.ctaIntervalSeconds ?? dna.ctaIntervalSeconds,
      ctaStylePreset: currentCh.ctaStylePreset ?? dna.ctaStylePreset
    };
    channelSettingsRef.current = resolvedChannelSettings;

    setOverlayEffect(dna.overlayStyleId);
    setBackgroundEffect(dna.overlayStyleId);
    setExportFps(dna.recommendedFps);
    setChannelSettings(resolvedChannelSettings);

    const galleryItems: GalleryItemInput[] = SmartTimelineEngine.shuffleAntiSameScene(
      shotsToUse.map((s) => ({
        id: s.id,
        dataUrl: s.dataUrl,
        index: s.index,
        timestamp: s.timestamp,
        formattedTime: s.formattedTime,
        width: s.width,
        height: s.height,
        qualityStatus: s.qualityStatus,
        sceneSignature: s.sceneSignature
      }))
    );

    const targetSec =
      customDurationSec && customDurationSec > 0
        ? Math.max(1, Math.round(customDurationSec * 10) / 10)
        : timelineConfig.durationMode === 'matchVoiceover' && audioDuration > 0
        ? Math.max(1, Math.round(audioDuration * 10) / 10)
        : timelineConfig.targetDurationSeconds;

    const activeConfig: TimelineConfig = {
      ...timelineConfig,
      targetDurationSeconds: targetSec,
      channelSlotNumber: activeChannelSlot,
      antiSpamVariationSeed: dna.variationSeed,
      colorGrading: dna.colorGrading,
      frameThemeId: dna.frameThemeId,
      effectCategoryPreference: dna.effectCategoryPreference,
      enableCinematicLetterbox: dna.enableCinematicLetterbox,
      enableLightLeaks: dna.enableLightLeaks,
      enableFilmGrain: dna.enableFilmGrain,
      enableAmbientBackdrop: dna.enableAmbientBackdrop,
      minImageDuration: dna.minImageDuration,
      maxImageDuration: dna.maxImageDuration,
      defaultTransitionDuration: dna.defaultTransitionDuration,
      overlayStyleId: dna.overlayStyleId,
      layoutMode: dna.layoutMode,
      selectionMode: 'random',
      randomizeAnimations: true,
      randomizeTransitions: true
    };
    setTimelineConfig(activeConfig);

    const { slots, summary } = SmartTimelineEngine.calculateTimelineSlots(galleryItems, activeConfig);
    const themedSlots = effectsEnabled
      ? SmartTimelineEngine.applyFrameTheme(slots, dna.frameThemeId)
      : slots;
    const finalSlots = effectsEnabled && dna.useMotionFxStudio
      ? MotionFxStudioService.applyMotionFxToSlots(themedSlots)
      : themedSlots;

    const introSlot = buildIntroSlotFromConfig(
      introVideoConfigRef.current,
      videoUrlRef.current,
      shotsToUse[0]?.dataUrl || ''
    );

    let resolvedSlots: TimelineSlot[] = finalSlots;
    if (introSlot) {
      const transDur = introSlot.transitionDuration || 0.6;
      const shiftedStart = Math.max(0, introSlot.duration - transDur);
      resolvedSlots = [
        introSlot,
        ...finalSlots.map((slot) => ({
          ...slot,
          startTime: Math.round((slot.startTime + shiftedStart) * 1000) / 1000,
          endTime: Math.round((slot.endTime + shiftedStart) * 1000) / 1000
        }))
      ];
    }
    setTimelineSlots(resolvedSlots);
    setTimelineSummary(summary);
    setSlideshowTime(0);
    lastSyncedGalleryKeyRef.current = `${shotsToUse.length}:${shotsToUse[0]?.id || ''}:${shotsToUse[shotsToUse.length - 1]?.id || ''}`;
    latestGeneratedTimelineRef.current = {
      slots: resolvedSlots,
      config: activeConfig,
      channelSettings: resolvedChannelSettings,
      overlayStyleId: dna.overlayStyleId,
      recommendedFps: dna.recommendedFps
    };

    renderSlideshowFrame(0, resolvedSlots);
    canvasRendererRef.current.preloadImages(resolvedSlots).then(() => {
      renderSlideshowFrame(0, resolvedSlots);
    });
    return resolvedSlots;
  }, [screenshots, activeChannelSlot, savedChannels, timelineConfig, audioDuration, renderSlideshowFrame, effectsEnabled, buildIntroSlotFromConfig]);

  // Add Rendered Trailer directly as Intro Video at the start of the Photo Timeline (slot 0)
  const handleAddTrailerAsIntro = useCallback((trailerBlob: Blob, trailerUrl: string, trailerDuration: number, posterUrl: string) => {
    const introDuration = Math.max(2, Math.round(trailerDuration * 10) / 10);
    const updatedCfg: IntroVideoConfig = {
      ...introVideoConfigRef.current,
      enabled: true,
      sourceType: 'tailor_export',
      customVideoUrl: trailerUrl,
      customVideoBlob: trailerBlob,
      customVideoName: 'Tailor Intro',
      posterUrl: posterUrl || screenshots[0]?.dataUrl || '',
      sourceStartTime: 0,
      duration: introDuration,
      maxAvailableDuration: introDuration,
      zoomLevel: 1.0,
      panX: 0,
      panY: 0,
      mirror: false,
      effect: 'none'
    };
    introVideoConfigRef.current = updatedCfg;
    setIntroVideoConfig(updatedCfg);

    let baseSlots = [...timelineSlots];
    if (baseSlots.length === 0 && screenshots.length > 0) {
      const galleryItems: GalleryItemInput[] = screenshots.map((s) => ({
        id: s.id,
        dataUrl: s.dataUrl,
        index: s.index,
        timestamp: s.timestamp,
        formattedTime: s.formattedTime,
        width: s.width,
        height: s.height,
        qualityStatus: s.qualityStatus
      }));
      const targetSec = timelineConfig.durationMode === 'matchVoiceover' && audioDuration > 0
        ? Math.round(audioDuration)
        : timelineConfig.targetDurationSeconds;
      const activeConfig = { ...timelineConfig, targetDurationSeconds: targetSec };
      const { slots, summary } = SmartTimelineEngine.calculateTimelineSlots(galleryItems, activeConfig);
      baseSlots = slots;
      setTimelineSummary(summary);
    }

    const photoSlots = baseSlots.filter((s) => !s.isIntroVideo);
    const introSlot = buildIntroSlotFromConfig(updatedCfg, videoUrlRef.current, screenshots[0]?.dataUrl || '');
    if (!introSlot) return;

    const transDur = 0.6;
    let runningTime = Math.max(0, introDuration - transDur);
    const retimedPhotoSlots = photoSlots.map((s, idx) => {
      const sStart = runningTime;
      const sEnd = sStart + s.duration;
      runningTime = idx < photoSlots.length - 1 ? sEnd - (s.transitionDuration || transDur) : sEnd;
      return {
        ...s,
        startTime: Math.round(sStart * 100) / 100,
        endTime: Math.round(sEnd * 100) / 100
      };
    });

    const newSlots = [introSlot, ...retimedPhotoSlots];
    setTimelineSlots(newSlots);
    setSlideshowTime(0);
    renderSlideshowFrame(0, newSlots);
    canvasRendererRef.current.preloadImages(newSlots).then(() => {
      renderSlideshowFrame(0, newSlots);
    });

    showLivePreviewBanner(`🎬 টেইলারটি সফলভাবে ফটো টাইমলাইনের শুরুতে (${introDuration}s) ইন্ট্রো ভিডিও হিসেবে যুক্ত হয়েছে!`);
  }, [timelineSlots, screenshots, timelineConfig, audioDuration, renderSlideshowFrame, showLivePreviewBanner, buildIntroSlotFromConfig]);

  const handleRemoveIntroVideo = useCallback(() => {
    setIntroVideoConfig((prev) => {
      const next: IntroVideoConfig = {
        ...prev,
        enabled: false
      };
      introVideoConfigRef.current = next;
      return next;
    });
    setTimelineSlots((prev) => {
      const filtered = prev.filter((s) => !s.isIntroVideo);
      let cur = 0;
      const transDur = timelineConfig.defaultTransitionDuration;
      const retimed = filtered.map((s, i) => {
        const start = cur;
        const end = start + s.duration;
        cur = i < filtered.length - 1 ? end - transDur : end;
        return {
          ...s,
          startTime: Math.round(start * 1000) / 1000,
          endTime: Math.round(end * 1000) / 1000
        };
      });
      return retimed;
    });
    showLivePreviewBanner('🎬 ইন্ট্রো ভিডিও ডিলিট করা হয়েছে!');
  }, [timelineConfig.defaultTransitionDuration, showLivePreviewBanner]);

  // Channel Settings Save & Real-Time Live Redraw Handlers
  const handleSaveChannelSettings = useCallback((newSettings: ChannelSettings) => {
    channelSettingsRef.current = newSettings;
    setChannelSettings(newSettings);

    // Sync active slot if selected channel name matches a saved channel index (0..9)
    const cleanName = newSettings.name?.trim() || '';
    if (cleanName) {
      const matchedIdx = savedChannels.findIndex((c) => c && c.trim() === cleanName);
      if (matchedIdx >= 0 && matchedIdx < 10) {
        const nextSlot = matchedIdx + 1;
        setActiveChannelSlot(nextSlot);
        try {
          localStorage.setItem('active_channel_slot_v1', String(nextSlot));
        } catch (_) {}
      }
    }

    requestAnimationFrame(() => {
      renderSlideshowFrame(slideshowTime);
    });
    showLivePreviewBanner(
      cleanName
        ? `চ্যানেল সেটিংস সংরক্ষিত: "${cleanName}" (${newSettings.styleId})`
        : 'চ্যানেলের নাম ও ওয়াটারমার্ক মুছে ফেলা হয়েছে'
    );
  }, [savedChannels, slideshowTime, renderSlideshowFrame, showLivePreviewBanner]);

  const handleUpdateChannelSettings = useCallback((partial: Partial<ChannelSettings>) => {
    setChannelSettings((prev) => {
      const updated = { ...prev, ...partial };
      channelSettingsRef.current = updated;
      requestAnimationFrame(() => {
        renderSlideshowFrame(slideshowTime);
      });
      return updated;
    });
  }, [slideshowTime, renderSlideshowFrame]);

  // Switch between 10 separate Anti-Spam Channel DNA Profiles (with Smart Anti-Repeat Memory)
  const handleSelectChannelSlot = useCallback((slotNumber: number) => {
    const normalized = Math.max(1, Math.min(10, Math.round(slotNumber || 1)));
    setActiveChannelSlot(normalized);
    try {
      localStorage.setItem('active_channel_slot_v1', String(normalized));
    } catch (_) {}

    const preset = getChannelDnaPreset(normalized);
    const dna = generateSmartAutoDna(normalized);
    const customName = savedChannels[normalized - 1]?.trim();

    setOverlayEffect(dna.overlayStyleId);
    setBackgroundEffect(dna.overlayStyleId);
    setExportFps(dna.recommendedFps);

    setChannelSettings((prev) => {
      const next = {
        ...prev,
        name: customName || prev.name || savedChannels.find((c) => c && c.trim())?.trim() || '',
        styleId: dna.watermarkStyleId,
        watermarkOpacity: dna.watermarkOpacity,
        ctaIntervalSeconds: dna.ctaIntervalSeconds,
        ctaStylePreset: dna.ctaStylePreset
      };
      channelSettingsRef.current = next;
      return next;
    });

    setTimelineConfig((prev) => {
      const updated: TimelineConfig = {
        ...prev,
        channelSlotNumber: normalized,
        antiSpamVariationSeed: dna.variationSeed,
        colorGrading: dna.colorGrading,
        frameThemeId: dna.frameThemeId,
        effectCategoryPreference: dna.effectCategoryPreference,
        enableCinematicLetterbox: dna.enableCinematicLetterbox,
        enableLightLeaks: dna.enableLightLeaks,
        enableFilmGrain: dna.enableFilmGrain,
        enableAmbientBackdrop: dna.enableAmbientBackdrop,
        minImageDuration: dna.minImageDuration,
        maxImageDuration: dna.maxImageDuration,
        defaultTransitionDuration: dna.defaultTransitionDuration,
        overlayStyleId: dna.overlayStyleId,
        layoutMode: dna.layoutMode,
        selectionMode: 'random',
        randomizeAnimations: true,
        randomizeTransitions: true
      };

      if (screenshots.length > 0) {
        const galleryItems: GalleryItemInput[] = SmartTimelineEngine.shuffleAntiSameScene(
          screenshots.map((s) => ({
            id: s.id,
            dataUrl: s.dataUrl,
            index: s.index,
            timestamp: s.timestamp,
            formattedTime: s.formattedTime,
            width: s.width,
            height: s.height,
            qualityStatus: s.qualityStatus,
            sceneSignature: s.sceneSignature
          }))
        );
        const targetSec = updated.durationMode === 'matchVoiceover' && audioDuration > 0
          ? Math.max(1, Math.round(audioDuration * 10) / 10)
          : updated.targetDurationSeconds;
        const { slots, summary } = SmartTimelineEngine.calculateTimelineSlots(galleryItems, {
          ...updated,
          targetDurationSeconds: targetSec
        });
        const themedSlots = SmartTimelineEngine.applyFrameTheme(slots, dna.frameThemeId);
        const finalSlots = dna.useMotionFxStudio
          ? MotionFxStudioService.applyMotionFxToSlots(themedSlots)
          : themedSlots;
        setTimelineSlots(finalSlots);
        setTimelineSummary(summary);
        lastSyncedGalleryKeyRef.current = `${screenshots.length}:${screenshots[0]?.id || ''}:${screenshots[screenshots.length - 1]?.id || ''}`;
        canvasRendererRef.current.preloadImages(finalSlots).then(() => {
          renderSlideshowFrame(slideshowTime, finalSlots);
        });
      } else {
        requestAnimationFrame(() => renderSlideshowFrame(slideshowTime));
      }

      return updated;
    });

    showLivePreviewBanner(
      `🛡️ ${preset.shortLabel}${customName ? ` (${customName})` : ''}: ইউনিক চ্যানেল এডিটিং সেট হয়েছে!`
    );
  }, [savedChannels, screenshots, audioDuration, slideshowTime, renderSlideshowFrame, showLivePreviewBanner]);

  // One-click Anti-Spam Unique DNA variation (randomizes ALL visual/motion/overlay/color/frame/pacing controls without repeating)
  const handleApplyChannelAntiSpamDna = useCallback(() => {
    const preset = getChannelDnaPreset(activeChannelSlot);
    const dna = generateSmartAutoDna(activeChannelSlot);
    const customName = savedChannels[activeChannelSlot - 1]?.trim();

    setOverlayEffect(dna.overlayStyleId);
    setBackgroundEffect(dna.overlayStyleId);
    setExportFps(dna.recommendedFps);

    setChannelSettings((prev) => {
      const next = {
        ...prev,
        name: customName || prev.name,
        styleId: dna.watermarkStyleId,
        watermarkOpacity: dna.watermarkOpacity,
        ctaIntervalSeconds: dna.ctaIntervalSeconds,
        ctaStylePreset: dna.ctaStylePreset
      };
      channelSettingsRef.current = next;
      return next;
    });

    setTimelineConfig((prev) => {
      const updated: TimelineConfig = {
        ...prev,
        channelSlotNumber: activeChannelSlot,
        antiSpamVariationSeed: dna.variationSeed,
        colorGrading: dna.colorGrading,
        frameThemeId: dna.frameThemeId,
        effectCategoryPreference: dna.effectCategoryPreference,
        enableCinematicLetterbox: dna.enableCinematicLetterbox,
        enableLightLeaks: dna.enableLightLeaks,
        enableFilmGrain: dna.enableFilmGrain,
        enableAmbientBackdrop: dna.enableAmbientBackdrop,
        minImageDuration: dna.minImageDuration,
        maxImageDuration: dna.maxImageDuration,
        defaultTransitionDuration: dna.defaultTransitionDuration,
        overlayStyleId: dna.overlayStyleId,
        layoutMode: dna.layoutMode,
        selectionMode: 'random',
        randomizeAnimations: true,
        randomizeTransitions: true
      };

      if (screenshots.length > 0) {
        const shuffledGallery = SmartTimelineEngine.shuffleAntiSameScene(
          screenshots.map((s) => ({
            id: s.id,
            dataUrl: s.dataUrl,
            index: s.index,
            timestamp: s.timestamp,
            formattedTime: s.formattedTime,
            width: s.width,
            height: s.height,
            qualityStatus: s.qualityStatus,
            sceneSignature: s.sceneSignature
          }))
        );
        const targetSec = updated.durationMode === 'matchVoiceover' && audioDuration > 0
          ? Math.max(1, Math.round(audioDuration * 10) / 10)
          : updated.targetDurationSeconds;
        const { slots, summary } = SmartTimelineEngine.calculateTimelineSlots(shuffledGallery, {
          ...updated,
          targetDurationSeconds: targetSec
        });
        const themedSlots = SmartTimelineEngine.applyFrameTheme(slots, dna.frameThemeId);
        const finalSlots = dna.useMotionFxStudio
          ? MotionFxStudioService.applyMotionFxToSlots(themedSlots)
          : themedSlots;
        setTimelineSlots(finalSlots);
        setTimelineSummary(summary);
        lastSyncedGalleryKeyRef.current = `${screenshots.length}:${screenshots[0]?.id || ''}:${screenshots[screenshots.length - 1]?.id || ''}`;
        canvasRendererRef.current.preloadImages(finalSlots).then(() => {
          renderSlideshowFrame(slideshowTime, finalSlots);
        });
      }
      return updated;
    });

    showLivePreviewBanner(`🛡️ ${preset.shortLabel}: একদম নতুন Anti-Repeat এডিটিং কম্বিনেশন তৈরি হয়েছে!`);
  }, [activeChannelSlot, savedChannels, screenshots, audioDuration, slideshowTime, renderSlideshowFrame, showLivePreviewBanner]);

  const handleUpdateSlotAnimation = useCallback((slotIndex: number, animId: string) => {
    setTimelineSlots((prev) => {
      const copy = [...prev];
      if (copy[slotIndex]) {
        copy[slotIndex] = { ...copy[slotIndex], animationId: animId };
        showLivePreviewBanner(`স্লট #${slotIndex + 1} এনিমেশন আপডেট হয়েছে`);
      }
      return copy;
    });
  }, [showLivePreviewBanner]);

  const handleUpdateSlotTransition = useCallback((slotIndex: number, transType: TransitionType) => {
    setTimelineSlots((prev) => {
      const copy = [...prev];
      if (copy[slotIndex]) {
        copy[slotIndex] = { ...copy[slotIndex], transitionType: transType };
        showLivePreviewBanner(`স্লট #${slotIndex + 1} ট্রানজিশন আপডেট হয়েছে`);
      }
      return copy;
    });
  }, [showLivePreviewBanner]);

  const handleReplaceSlotImage = useCallback((slotIndex: number, newImage: GalleryItemInput) => {
    setTimelineSlots((prev) => {
      const updated = SmartTimelineEngine.replaceSlotImage(prev, slotIndex, newImage);
      canvasRendererRef.current.preloadImages(updated);
      showLivePreviewBanner(`স্লট #${slotIndex + 1} এর ছবি পরিবর্তন হয়েছে`);
      return updated;
    });
  }, [showLivePreviewBanner]);

  const handleRemoveSlot = useCallback((slotIndex: number) => {
    setTimelineSlots((prev) => {
      if (slotIndex < 0 || slotIndex >= prev.length) return prev;
      const filtered = prev.filter((_, i) => i !== slotIndex);
      let cur = 0;
      const transDur = timelineConfig.defaultTransitionDuration;
      const retimed = filtered.map((s, i) => {
        const start = cur;
        const end = start + s.duration;
        cur = i < filtered.length - 1 ? end - transDur : end;
        return {
          ...s,
          startTime: Math.round(start * 1000) / 1000,
          endTime: Math.round(end * 1000) / 1000
        };
      });
      return retimed;
    });
  }, [timelineConfig.defaultTransitionDuration]);

  const handleUpdateSlotFrame = useCallback((slotIndex: number, style: PhotoFrameStyle, color?: string, accent?: string) => {
    setTimelineSlots((prev) => {
      if (slotIndex < 0 || slotIndex >= prev.length) return prev;
      const updated = [...prev];
      updated[slotIndex] = {
        ...updated[slotIndex],
        frameStyle: style,
        frameColor: color || updated[slotIndex].frameColor,
        frameAccentColor: accent || updated[slotIndex].frameAccentColor
      };
      return updated;
    });
    showLivePreviewBanner(`স্লট #${slotIndex + 1} এর ফ্রেম স্টাইল ও কালার আপডেট হয়েছে`);
  }, [showLivePreviewBanner]);

  // Slideshow Playback Loop: Renders continuous animated canvas frames smoothly at 60fps
  useEffect(() => {
    if (!isPlayingSlideshow) {
      if (slideshowAnimRef.current) {
        cancelAnimationFrame(slideshowAnimRef.current);
        slideshowAnimRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (bgVideoRef.current) {
        bgVideoRef.current.pause();
      }
      ctaSoundService.stopAllLive();
      lastCtaCycleRef.current = null;
      return;
    }

    let lastTime = performance.now();
    let lastDrawTime = 0;
    let lastUiSyncTime = 0;
    let currentAnimTime = slideshowTime;

    // Unlock WebAudio context and preload CTA SFX on playback start
    ctaSoundService.unlock();
    lastCtaCycleRef.current = ChannelOverlayRenderer.getActiveCtaCycle(channelSettings, currentAnimTime);
    if (isAudioMuted) {
      ctaSoundService.stopAllLive();
    }

    // Start looped background video synchronized with current anim time
    if (bgVideoRef.current) {
      const vDur = bgVideoRef.current.duration || 100.59;
      bgVideoRef.current.currentTime = currentAnimTime % vDur;
      bgVideoRef.current.play().catch(() => {});
    }

    // Start looped audio playback synchronized with current anim time
    if (audioRef.current && audioUrl) {
      const aDur = audioRef.current.duration || audioDuration;
      if (aDur > 0) {
        audioRef.current.currentTime = currentAnimTime % aDur;
      } else {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.loop = true;
      audioRef.current.volume = isAudioMuted ? 0 : audioVolume;
      audioRef.current.play().catch(() => {});
    }

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      currentAnimTime += delta;
      if (currentAnimTime >= totalSlideshowDuration) {
        setIsPlayingSlideshow(false);
        setSlideshowTime(0);
        renderSlideshowFrame(0);
        ctaSoundService.stopAllLive();
        lastCtaCycleRef.current = null;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        if (bgVideoRef.current) {
          bgVideoRef.current.pause();
          bgVideoRef.current.currentTime = 0;
        }
        return;
      }

      const perf = getRenderPerformanceFlags();
      const frameIntervalMs = 1000 / Math.max(12, perf.playbackFps);
      if (now - lastDrawTime >= frameIntervalMs) {
        lastDrawTime = now;
        renderSlideshowFrame(currentAnimTime);
      }

      if (now - lastUiSyncTime >= perf.uiSyncIntervalMs) {
        lastUiSyncTime = now;
        setSlideshowTime(currentAnimTime);
      }

      // Sync Like/Comment/Subscribe CTA Sound Effects on popup appearance
      const activeCtaCycle = ChannelOverlayRenderer.getActiveCtaCycle(channelSettings, currentAnimTime);
      if (activeCtaCycle !== null && activeCtaCycle !== lastCtaCycleRef.current) {
        if (!isAudioMuted) {
          ctaSoundService.playForCycle(activeCtaCycle, Math.max(0.65, Math.min(1, audioVolume * 0.9)));
        }
      }
      lastCtaCycleRef.current = activeCtaCycle;

      // Background video loop synchronization
      if (bgVideoRef.current && !bgVideoRef.current.paused) {
        const vDur = bgVideoRef.current.duration || 100.59;
        const expectedBgTime = currentAnimTime % vDur;
        if (Math.abs(bgVideoRef.current.currentTime - expectedBgTime) > 0.4) {
          bgVideoRef.current.currentTime = expectedBgTime;
        }
      }

      // Audio loop synchronization check
      if (audioRef.current && audioUrl && !isAudioMuted) {
        const aDur = audioRef.current.duration || audioDuration;
        if (aDur > 0) {
          const expectedAudioTime = currentAnimTime % aDur;
          if (Math.abs(audioRef.current.currentTime - expectedAudioTime) > 0.4) {
            audioRef.current.currentTime = expectedAudioTime;
          }
        }
      }

      slideshowAnimRef.current = requestAnimationFrame(loop);
    };

    slideshowAnimRef.current = requestAnimationFrame(loop);
    return () => {
      if (slideshowAnimRef.current) {
        cancelAnimationFrame(slideshowAnimRef.current);
        slideshowAnimRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (bgVideoRef.current) {
        bgVideoRef.current.pause();
      }
      ctaSoundService.stopAllLive();
    };
  }, [isPlayingSlideshow, totalSlideshowDuration, renderSlideshowFrame, audioUrl, audioDuration, isAudioMuted, audioVolume, channelSettings]);

  // Automatically shuffle screenshots (Anti-Same-Scene) silently every time user enters Gallery tab,
  // and automatically rebuild randomized Video timeline every time user enters Video tab or screenshots change
  useEffect(() => {
    const prevTab = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTab;

    if (screenshots.length === 0) {
      lastSyncedGalleryKeyRef.current = '';
      if (timelineSlots.length > 0 && !isRenderingVideo) {
        setTimelineSlots([]);
        setTimelineSummary(null);
      }
      return;
    }

    if (prevTab !== 'gallery' && activeTab === 'gallery' && !isGenerating && screenshots.length > 1) {
      const shuffled = SmartTimelineEngine.shuffleAntiSameScene(screenshots).map((s, idx) => ({
        ...s,
        index: idx + 1
      }));
      setScreenshots(shuffled);
      lastSyncedGalleryKeyRef.current = '';
      return;
    }

    const galleryKey = `${screenshots.length}:${screenshots[0]?.id || ''}:${screenshots[screenshots.length - 1]?.id || ''}`;
    if (
      activeTab === 'video' &&
      !isRenderingVideo &&
      (prevTab !== 'video' || timelineSlots.length === 0 || galleryKey !== lastSyncedGalleryKeyRef.current)
    ) {
      handleGenerateSmartTimeline();
    }
  }, [activeTab, screenshots, timelineSlots.length, isGenerating, isRenderingVideo, handleGenerateSmartTimeline]);

  // Redraw when scrubbing, pausing, switching to video tab, or when user pauses/scrubs live export preview
  useEffect(() => {
    if (activeTab === 'video' && !isPlayingSlideshow && (!isRenderingVideo || !isExportFollowLive)) {
      const raf = requestAnimationFrame(() => {
        renderSlideshowFrame(slideshowTime);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeTab, slideshowTime, isPlayingSlideshow, isRenderingVideo, isExportFollowLive, timelineSlots, renderSlideshowFrame]);

  // Audio Upload Handler with Automatic Duration Detection & Instant Video Timeline Sync
  const handleAudioUpload = (file: File, explicitDuration?: number) => {
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
    const aUrl = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioUrl(aUrl);
    setAudioName(file.name);

    const applyAudioDuration = (d: number) => {
      if (!d || isNaN(d) || d <= 0) return;
      const roundedSec = Math.max(1, Math.round(d * 10) / 10);
      setAudioDuration(d);

      // Automatically apply fresh anti-repeat DNA + match timeline duration strictly to this audio!
      const dna = generateSmartAutoDna(activeChannelSlot);
      const customName = savedChannels[activeChannelSlot - 1]?.trim();
      setOverlayEffect(dna.overlayStyleId);
      setBackgroundEffect(dna.overlayStyleId);
      setExportFps(dna.recommendedFps);
      setChannelSettings((prev) => {
        const next = {
          ...prev,
          name: customName || prev.name
        };
        channelSettingsRef.current = next;
        return next;
      });

      setTimelineConfig((prev) => {
        const updated: TimelineConfig = {
          ...prev,
          targetDurationSeconds: roundedSec,
          durationMode: 'matchVoiceover' as const,
          channelSlotNumber: activeChannelSlot,
          antiSpamVariationSeed: dna.variationSeed,
          colorGrading: dna.colorGrading,
          frameThemeId: dna.frameThemeId,
          effectCategoryPreference: dna.effectCategoryPreference,
          enableCinematicLetterbox: dna.enableCinematicLetterbox,
          enableLightLeaks: dna.enableLightLeaks,
          enableFilmGrain: dna.enableFilmGrain,
          enableAmbientBackdrop: dna.enableAmbientBackdrop,
          minImageDuration: dna.minImageDuration,
          maxImageDuration: dna.maxImageDuration,
          defaultTransitionDuration: dna.defaultTransitionDuration,
          overlayStyleId: dna.overlayStyleId,
          layoutMode: dna.layoutMode,
          selectionMode: 'random',
          randomizeAnimations: true,
          randomizeTransitions: true
        };

        // Immediately generate or update smart timeline with gallery pictures (preserving any intro video)
        if (screenshots.length > 0) {
          const galleryItems: GalleryItemInput[] = SmartTimelineEngine.shuffleAntiSameScene(
            screenshots.map((s) => ({
              id: s.id,
              dataUrl: s.dataUrl,
              index: s.index,
              timestamp: s.timestamp,
              formattedTime: s.formattedTime,
              width: s.width,
              height: s.height,
              qualityStatus: s.qualityStatus,
              sceneSignature: s.sceneSignature
            }))
          );
          const { slots, summary } = SmartTimelineEngine.calculateTimelineSlots(galleryItems, updated);
          const themedSlots = SmartTimelineEngine.applyFrameTheme(slots, dna.frameThemeId);
          const finalSlots = dna.useMotionFxStudio
            ? MotionFxStudioService.applyMotionFxToSlots(themedSlots)
            : themedSlots;
          setTimelineSlots(finalSlots);
          setTimelineSummary(summary);
          setSlideshowTime(0);
          lastSyncedGalleryKeyRef.current = `${screenshots.length}:${screenshots[0]?.id || ''}:${screenshots[screenshots.length - 1]?.id || ''}`;
          renderSlideshowFrame(0, finalSlots);
          canvasRendererRef.current.preloadImages(finalSlots);
        }
        return updated;
      });

      const mins = Math.floor(roundedSec / 60);
      const secs = roundedSec % 60;

      // Automatically calculate required screenshots based on audio duration (5.4s effective duration per image)
      const neededScreenshots = Math.max(1, Math.round((roundedSec - 0.6) / 5.4));
      setScreenshotCount(neededScreenshots);
      setCustomCountInput(neededScreenshots.toString());

      showLivePreviewBanner(`ভয়েস অডিও যুক্ত হয়েছে: ${mins} মিনিট ${secs} সেকেন্ড (প্রয়োজনীয় ${neededScreenshots}টি স্ক্রিনশট অটোমেটিক সেট হয়েছে)`);
    };

    if (explicitDuration !== undefined && explicitDuration > 0) {
      applyAudioDuration(explicitDuration);
      return;
    }

    // Read audio duration immediately via a temporary Audio element with safe event listeners
    const tempAudio = new Audio();
    let handled = false;

    const onMeta = () => {
      if (handled) return;
      handled = true;
      const d = tempAudio.duration;
      if (d && !isNaN(d) && d > 0) {
        applyAudioDuration(d);
      }
    };

    tempAudio.addEventListener('loadedmetadata', onMeta);
    tempAudio.addEventListener('canplaythrough', onMeta);
    tempAudio.src = aUrl;
    tempAudio.load();

    // Fallback: low-RAM duration probe ONLY if <audio> metadata doesn't arrive within 1500ms
    setTimeout(async () => {
      if (handled) return;
      try {
        const track = await decodeAudioSourceToPcmTrack(file, {
          targetSampleRate: 24000,
          forceMono: true,
        });
        if (!handled && track && track.duration > 0) {
          handled = true;
          applyAudioDuration(track.duration);
        }
      } catch (e) {
        console.warn('Fallback audio decode failed:', e);
      }
    }, 1500);
  };

  // Remove Audio
  const removeAudio = () => {
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioFile(null);
    setAudioUrl('');
    setAudioName('');
    setAudioDuration(0);
    setTimelineConfig((prev) => ({
      ...prev,
      targetDurationSeconds: 0,
      durationMode: 'matchVoiceover'
    }));
    showLivePreviewBanner('অডিও ফাইল রিমুভ করা হয়েছে');
  };

  // Pause / Resume / Cancel ExportEngine
  const handlePauseExportVideo = () => {
    exportEngineRef.current?.pause();
    setIsExportPaused(true);
  };

  const handleResumeExportVideo = () => {
    exportEngineRef.current?.resume();
    setIsExportPaused(false);
  };

  const handleCancelExportVideo = () => {
    if (exportEngineRef.current) {
      exportEngineRef.current.cancel();
      exportEngineRef.current = null;
    }
    setIsExportPaused(false);
    setIsRenderingVideo(false);
    setRenderProgress(0);
    showLivePreviewBanner('⏹️ ভিডিও এক্সপোর্ট বাতিল করা হয়েছে');
  };

  // Frame-by-frame MP4 Export (WebCodecs H.264 + AAC + mp4-muxer)
  const exportSlideshowAsVideo = async (agentOptions?: {
    slotsOverride?: TimelineSlot[];
    screenshotsOverride?: ScreenshotItem[];
    audioFileOverride?: File | Blob;
    audioDurationOverride?: number;
    targetDurationOverrideSec?: number;
    channelSettingsOverride?: ChannelSettings;
    timelineConfigOverride?: TimelineConfig;
    channelSlotOverride?: number;
    overlayEffectOverride?: string;
    backgroundEffectOverride?: string;
    exportFpsOverride?: number;
    broadcastOverlayConfigOverride?: BroadcastOverlayConfig;
    effectsEnabledOverride?: boolean;
    keepCurrentTab?: boolean;
    isAgentMode?: boolean;
    onExportProgressUpdate?: (percent: number, info: { fps?: number; etaSeconds?: number; state?: string }) => void;
  }): Promise<{
    blob: Blob;
    url: string;
    filename: string;
    duration: number;
    sizeBytes: number;
  } | null> => {
    const shotsToUse = agentOptions?.screenshotsOverride ?? screenshots;
    const baseSlots = agentOptions?.slotsOverride ?? timelineSlots;
    if (baseSlots.length === 0 && shotsToUse.length === 0) {
      if (agentOptions?.isAgentMode) {
        throw new Error('ভিডিও রেন্ডার করার জন্য টাইমলাইনে কোনো ছবি বা দৃশ্য নেই।');
      }
      showLivePreviewBanner('ভিডিও রেন্ডার করার জন্য টাইমলাইনে কোনো ছবি বা দৃশ্য নেই।');
      return null;
    }

    const effectiveChannelSlot = agentOptions?.channelSlotOverride ?? activeChannelSlot;
    const baseChannelSettings = agentOptions?.channelSettingsOverride ?? channelSettingsRef.current;
    const fallbackSavedName = savedChannels[effectiveChannelSlot - 1]?.trim() || '';
    const effectiveChannelSettings: ChannelSettings = {
      ...baseChannelSettings,
      name: (baseChannelSettings.name || fallbackSavedName || '').trim()
    };
    const effectiveTimelineConfig = agentOptions?.timelineConfigOverride ?? timelineConfig;
    const effectiveOverlayEffect = agentOptions?.overlayEffectOverride ?? overlayEffect;
    const effectiveBgEffect = agentOptions?.backgroundEffectOverride ?? backgroundEffect;
    const effectiveExportFps = agentOptions?.exportFpsOverride ?? exportFps;
    const effectiveBroadcastConfig = agentOptions?.broadcastOverlayConfigOverride ?? broadcastOverlayConfig;
    const effectiveEffectsEnabled = agentOptions?.effectsEnabledOverride ?? effectsEnabled;

    setSlideshowTime(0);
    setIsPlayingSlideshow(false);
    exportFollowLiveRef.current = true;
    setIsExportFollowLive(true);
    ctaSoundService.stopAllLive();
    lastCtaCycleRef.current = null;
    if (audioRef.current) audioRef.current.pause();
    if (bgVideoRef.current) bgVideoRef.current.pause();

    setIsRenderingVideo(true);
    setIsExportPaused(false);
    setRenderProgress(1);

    if (!agentOptions?.keepCurrentTab) {
      setActiveTab('video');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Allow React to mount the Video tab canvas before encoding starts
      await new Promise((r) => setTimeout(r, 90));
    }

    try {
      // 1. Resolve audio Blob if present (never drop export audio just because preview speaker is muted!)
      let audioBlob: Blob | null = null;
      let fallbackVoiceDur = 0;
      if (agentOptions?.audioFileOverride) {
        audioBlob = agentOptions.audioFileOverride;
      } else {
        if (audioFile) {
          audioBlob = audioFile;
        } else if (audioUrl) {
          try {
            const resp = await fetch(audioUrl);
            if (resp.ok) audioBlob = await resp.blob();
          } catch (err) {
            console.warn('Audio blob load note:', err);
          }
        }
        if (!audioBlob && voiceStudioRef.current) {
          const vsAudio = voiceStudioRef.current.getAudioForExport();
          if (vsAudio?.file) {
            audioBlob = vsAudio.file;
            fallbackVoiceDur = vsAudio.duration || 0;
          }
        }
      }

      // 2. Determine target duration & sync timeline slots cleanly
      let activeSlots = [...baseSlots];
      const existingIntro = activeSlots.find((s) => s.isIntroVideo);
      const currentSlotsDuration = activeSlots.length > 0 ? (activeSlots[activeSlots.length - 1]?.endTime || 0) : 0;
      const effectiveAudioDuration = agentOptions?.audioDurationOverride ?? (audioDuration || fallbackVoiceDur);
      const targetDur =
        agentOptions?.targetDurationOverrideSec && agentOptions.targetDurationOverrideSec > 0
          ? Math.max(1, Math.round(agentOptions.targetDurationOverrideSec * 10) / 10)
          : effectiveTimelineConfig.durationMode === 'matchVoiceover' && effectiveAudioDuration > 0
          ? Math.max(1, Math.round(effectiveAudioDuration * 10) / 10)
          : effectiveTimelineConfig.targetDurationSeconds > 0
          ? effectiveTimelineConfig.targetDurationSeconds
          : effectiveAudioDuration > 0
          ? Math.max(1, Math.round(effectiveAudioDuration * 10) / 10)
          : Math.max(1, currentSlotsDuration || 60);

      if (shotsToUse.length > 0 && (!agentOptions?.slotsOverride || agentOptions.slotsOverride.length === 0)) {
        const galleryItems: GalleryItemInput[] = SmartTimelineEngine.shuffleAntiSameScene(
          shotsToUse.map((s) => ({
            id: s.id,
            dataUrl: s.dataUrl,
            index: s.index,
            timestamp: s.timestamp,
            formattedTime: s.formattedTime,
            width: s.width,
            height: s.height,
            qualityStatus: s.qualityStatus,
            sceneSignature: s.sceneSignature
          }))
        );
        const activeIntroSlot =
          buildIntroSlotFromConfig(
            introVideoConfigRef.current,
            videoUrlRef.current,
            shotsToUse[0]?.dataUrl || ''
          ) || (introVideoConfigRef.current.enabled ? existingIntro || null : null);
        const photoTargetSec = Math.max(1, targetDur);
        const activeConfig: TimelineConfig = {
          ...effectiveTimelineConfig,
          channelSlotNumber: effectiveTimelineConfig.channelSlotNumber || effectiveChannelSlot,
          layoutMode: effectiveTimelineConfig.layoutMode || getChannelDnaPreset(effectiveChannelSlot).layoutMode,
          selectionMode: 'random' as const,
          targetDurationSeconds: photoTargetSec,
          durationMode: 'matchVoiceover' as const
        };
        const { slots, summary } = SmartTimelineEngine.calculateTimelineSlots(galleryItems, activeConfig);
        const themedSlots = effectiveEffectsEnabled
          ? SmartTimelineEngine.applyFrameTheme(slots, effectiveTimelineConfig.frameThemeId || 'all_dynamic')
          : slots;
        const motionSlots = effectiveEffectsEnabled
          ? MotionFxStudioService.applyMotionFxToSlots(themedSlots)
          : themedSlots;

        if (activeIntroSlot) {
          const transDur = activeIntroSlot.transitionDuration || 0.6;
          const shiftedStart = Math.max(0, activeIntroSlot.duration - transDur);
          const rebuilt = [
            { ...activeIntroSlot, startTime: 0, endTime: activeIntroSlot.duration },
            ...motionSlots.map((slot) => ({
              ...slot,
              startTime: Math.round((slot.startTime + shiftedStart) * 1000) / 1000,
              endTime: Math.round((slot.endTime + shiftedStart) * 1000) / 1000
            }))
          ];
          activeSlots = rebuilt;
          setTimelineSlots(rebuilt);
        } else {
          activeSlots = motionSlots;
          setTimelineSlots(motionSlots);
        }
        lastSyncedGalleryKeyRef.current = `${shotsToUse.length}:${shotsToUse[0]?.id || ''}:${shotsToUse[shotsToUse.length - 1]?.id || ''}`;
        setTimelineSummary(summary);
      }

      const totalDur = Math.max(1, activeSlots.length > 0 ? (activeSlots[activeSlots.length - 1]?.endTime || 0) : targetDur);
      const exportIntroSlot = activeSlots.find((s) => s.isIntroVideo);
      const firstExportPhoto = exportIntroSlot ? activeSlots.find((s) => !s.isIntroVideo) : null;
      const photoStartSec = exportIntroSlot
        ? Math.max(0, firstExportPhoto ? firstExportPhoto.startTime : exportIntroSlot.duration)
        : 0;
      const photoPlayDur = Math.max(1, totalDur - photoStartSec);

      // 3. Free preview caches before export and use low-RAM sliding-window export renderer
      canvasRendererRef.current.clearCache();
      CinematicFxRenderer.clearBackdropCache();
      const exportRenderer = new CanvasTimelineRenderer({
        maxImageCache: 8,
        disableAsyncRedraw: true
      });
      await exportRenderer.prepareWindowForTime(activeSlots, 0);

      // 4. Decode audio via ExportEngine decodeAudio() helper + align after optional Intro Video
      const exportPerfFlags = getRenderPerformanceFlags();
      const targetAudioRate = await pickSupportedAudioSampleRate(exportPerfFlags.preferredAudioSampleRate);
      let decodedAudio: DecodedExportAudio | null = null;
      if (audioBlob || exportIntroSlot) {
        try {
          if (!exportIntroSlot && audioBlob) {
            decodedAudio = await decodeAudio(audioBlob, totalDur, targetAudioRate);
            const vol = audioVolume > 0 ? Math.min(1, audioVolume) : 1.0;
            const fadeInSamples = Math.min(decodedAudio.L.length, Math.floor(0.025 * decodedAudio.sampleRate));
            const fadeOutSamples = Math.min(decodedAudio.L.length, Math.floor(0.08 * decodedAudio.sampleRate));
            for (let k = 0; k < decodedAudio.L.length; k++) {
              let gain = vol;
              if (k < fadeInSamples) {
                gain *= k / Math.max(1, fadeInSamples);
              } else if (k >= decodedAudio.L.length - fadeOutSamples) {
                gain *= (decodedAudio.L.length - k) / Math.max(1, fadeOutSamples);
              }
              decodedAudio.L[k] *= gain;
              decodedAudio.R[k] *= gain;
            }
          } else {
            const totalSamples = Math.max(1, Math.ceil(totalDur * targetAudioRate));
            const fullL = new Float32Array(totalSamples);
            const fullR = new Float32Array(totalSamples);
            let actualRate = targetAudioRate;

            if (audioBlob) {
              const voiceAudio = await decodeAudio(audioBlob, photoPlayDur, targetAudioRate);
              actualRate = voiceAudio.sampleRate;
              const finalSamples = Math.max(1, Math.ceil(totalDur * actualRate));
              const dstL = actualRate === targetAudioRate ? fullL : new Float32Array(finalSamples);
              const dstR = actualRate === targetAudioRate ? fullR : new Float32Array(finalSamples);
              const vol = audioVolume > 0 ? Math.min(1, audioVolume) : 1.0;
              const startSample = Math.min(finalSamples, Math.floor(photoStartSec * actualRate));
              const copyCount = Math.min(voiceAudio.L.length, finalSamples - startSample);
              const fadeIn = Math.min(copyCount, Math.floor(0.04 * actualRate));
              const fadeOut = Math.min(copyCount, Math.floor(0.08 * actualRate));
              for (let k = 0; k < copyCount; k++) {
                let gain = vol;
                if (k < fadeIn) gain *= k / Math.max(1, fadeIn);
                else if (k >= copyCount - fadeOut) gain *= (copyCount - k) / Math.max(1, fadeOut);
                dstL[startSample + k] = voiceAudio.L[k] * gain;
                dstR[startSample + k] = voiceAudio.R[k] * gain;
              }
              decodedAudio = { L: dstL, R: dstR, sampleRate: actualRate };
            } else {
              decodedAudio = { L: fullL, R: fullR, sampleRate: actualRate };
            }

            // Safely mix Intro Video's own audio across [0 .. introSlot.duration] if unmuted & <= 60MB
            if (exportIntroSlot && !introVideoConfigRef.current.muteIntroAudio) {
              const cfg = introVideoConfigRef.current;
              const introBlob =
                cfg.sourceType === 'main_video_clip' ? videoFile : cfg.customVideoBlob;
              if (introBlob && introBlob.size <= 60 * 1024 * 1024) {
                try {
                  const introTrack = await decodeAudioSourceToPcmTrack(introBlob, {
                    targetSampleRate: decodedAudio.sampleRate,
                    forceMono: false
                  });
                  const src0 = introTrack.channels[0];
                  const src1 = introTrack.channels[1] || src0;
                  if (src0 && src0.length > 0) {
                    const sr = decodedAudio.sampleRate;
                    const srcOffset = Math.max(0, Math.floor((exportIntroSlot.introSourceStartTime || 0) * sr));
                    const introSamples = Math.min(
                      decodedAudio.L.length,
                      Math.floor(exportIntroSlot.duration * sr),
                      Math.max(0, src0.length - srcOffset)
                    );
                    const fadeIn = Math.min(introSamples, Math.floor(0.05 * sr));
                    const fadeOut = Math.min(introSamples, Math.floor(0.55 * sr));
                    for (let k = 0; k < introSamples; k++) {
                      let g = 0.92;
                      if (k < fadeIn) g *= k / Math.max(1, fadeIn);
                      else if (k >= introSamples - fadeOut) g *= (introSamples - k) / Math.max(1, fadeOut);
                      decodedAudio.L[k] = Math.max(-1, Math.min(1, decodedAudio.L[k] + src0[srcOffset + k] * g));
                      decodedAudio.R[k] = Math.max(-1, Math.min(1, decodedAudio.R[k] + src1[srcOffset + k] * g));
                    }
                  }
                  introTrack.channels = [];
                } catch (introAudioErr) {
                  console.warn('Intro audio decode skipped safely:', introAudioErr);
                }
              }
            }
          }

          if (decodedAudio && humanizeAudioEnabled) {
            decodedAudio = humanizeExportAudio(decodedAudio, {
              channelSlotNumber: effectiveChannelSlot,
              enableRoomTone: true,
              enableWarmMastering: true
            });
          }
        } catch (audioErr: any) {
          console.error('Export audio decode error:', audioErr);
          throw new Error(`অডিওসহ ভিডিও এক্সপোর্ট করা যায়নি (অডিও ডিকোড ত্রুটি): ${audioErr?.message || 'অডিও ফরম্যাট সমস্যা'}`);
        }
      }

      // 4b. Mix Like/Comment/Subscribe CTA popup sound effects into export audio track
      try {
        const exportAudioSampleRate = decodedAudio?.sampleRate || targetAudioRate;
        decodedAudio = await ctaSoundService.mixCtaSfxIntoExportAudio(
          decodedAudio,
          effectiveChannelSettings,
          totalDur,
          0.85,
          exportAudioSampleRate
        );
      } catch (ctaSfxErr) {
        console.warn('CTA SFX export mix note:', ctaSfxErr);
      }

      // 5. Run WebCodecs + mp4-muxer ExportEngine with live preview mirror & sliding-window decoding
      const fps = effectiveExportFps === 20 ? 20 : effectiveExportFps === 24 ? 24 : 30;
      const resPreset = EXPORT_RESOLUTION_PRESETS[exportResolution] || EXPORT_RESOLUTION_PRESETS['720p'];
      const mirrorInterval = Math.max(1, exportPerfFlags.exportMirrorIntervalFrames);
      const exportLayoutMode = effectiveTimelineConfig.layoutMode || getChannelDnaPreset(effectiveChannelSlot).layoutMode;
      const exportSubtitleCues = buildTimedSubtitlesFromScript(scriptText, totalDur, photoStartSec);
      let lastUiTimeSync = 0;
      const engine = new ExportEngine({
        width: resPreset.width,
        height: resPreset.height,
        fps,
        duration: totalDur,
        audio: decodedAudio,
        videoBitrate: resPreset.defaultBitrate,
        draw: async (ctx, t, frameIdx) => {
          await exportRenderer.prepareWindowForTime(activeSlots, t);
          exportRenderer.renderFrame(
            ctx.canvas as unknown as HTMLCanvasElement,
            activeSlots,
            t,
            effectiveEffectsEnabled ? effectiveBgEffect : 'none',
            null,
            {
              colorGrading: effectiveEffectsEnabled ? effectiveTimelineConfig.colorGrading : 'none',
              enableLetterbox: effectiveEffectsEnabled ? effectiveTimelineConfig.enableCinematicLetterbox : false,
              enableLightLeaks: effectiveEffectsEnabled ? effectiveTimelineConfig.enableLightLeaks : false,
              enableAmbientBackdrop: effectiveEffectsEnabled ? effectiveTimelineConfig.enableAmbientBackdrop : false,
              enableFilmGrain: effectiveEffectsEnabled ? effectiveTimelineConfig.enableFilmGrain : false,
              overlayStyleId: effectiveEffectsEnabled
                ? (effectiveOverlayEffect || effectiveTimelineConfig.overlayStyleId || effectiveBgEffect)
                : 'none',
              layoutMode: effectiveEffectsEnabled ? exportLayoutMode : 'full_cinema',
              dramaTitle: effectiveBroadcastConfig.dramaTitle,
              scheduleLabel: effectiveBroadcastConfig.scheduleLabel,
              channelSlotNumber: effectiveTimelineConfig.channelSlotNumber || effectiveChannelSlot,
              antiSpamVariationSeed: effectiveTimelineConfig.antiSpamVariationSeed || 0
            }
          );
          ChannelOverlayRenderer.renderOverlay(ctx.canvas as unknown as HTMLCanvasElement, effectiveChannelSettings, t);
          ChannelOverlayRenderer.renderBroadcastOverlay(
            ctx.canvas as unknown as HTMLCanvasElement,
            effectiveBroadcastConfig,
            exportSubtitleCues,
            effectiveChannelSettings,
            t
          );

          if (exportFollowLiveRef.current && (frameIdx === 0 || frameIdx % mirrorInterval === 0)) {
            if (activeTabRef.current === 'video') {
              const previewCanvas = slideshowCanvasRef.current;
              if (previewCanvas) {
                const pCtx = previewCanvas.getContext('2d');
                if (pCtx) {
                  pCtx.drawImage(ctx.canvas as unknown as CanvasImageSource, 0, 0, previewCanvas.width, previewCanvas.height);
                }
              }
            } else if (activeTabRef.current === 'agent') {
              const agentCanvas = agentDisplayCanvasRef.current;
              if (agentCanvas) {
                const aCtx = agentCanvas.getContext('2d');
                if (aCtx) {
                  aCtx.drawImage(ctx.canvas as unknown as CanvasImageSource, 0, 0, agentCanvas.width, agentCanvas.height);
                }
              }
            }
          }
        },
        onProgress: (p) => {
          const pct = Math.min(100, Math.round(p.percent));
          setRenderProgress(pct);
          setRenderStatusInfo({
            fps: p.fps,
            etaSeconds: p.eta,
            currentFrame: p.frame,
            totalFrames: p.total,
            state: p.state
          });
          const now = performance.now();
          if (exportFollowLiveRef.current && now - lastUiTimeSync >= 350) {
            lastUiTimeSync = now;
            const liveTime = (p.frame / Math.max(1, p.total)) * totalDur;
            setSlideshowTime(liveTime);
          }
          agentOptions?.onExportProgressUpdate?.(pct, {
            fps: p.fps,
            etaSeconds: p.eta,
            state: p.state
          });
        }
      });

      // Drop PCM references from closure immediately; ExportEngine releases its ref right after AudioEncoder flushes
      decodedAudio = null;
      audioBlob = null;

      exportEngineRef.current = engine;
      let mp4Blob: Blob;
      try {
        mp4Blob = await engine.run();
      } finally {
        exportRenderer.dispose();
        CinematicFxRenderer.clearBackdropCache();
        ChannelOverlayRenderer.clearOverlayCaches();
        canvasRendererRef.current.clearCache();
        ctaSoundService.clearExportCache();
        ctaSoundService.clearLiveBuffers();
        voiceStudioRef.current?.releaseHeavyAudioCaches();
      }

      const cleanDrama = (effectiveBroadcastConfig.dramaTitle || youtubeSeoConfig.dramaTitle || dramaName || videoName || 'Drama')
        .trim()
        .replace(/[^a-zA-Z0-9\u0980-\u09FF_-]/g, '_')
        .slice(0, 40);
      const filename = `${cleanDrama}_CH${effectiveChannelSlot}_${exportResolution}_${Date.now()}.mp4`;
      const url = triggerDownloadBlob(mp4Blob, filename);

      const exportObj = {
        blob: mp4Blob,
        url,
        filename,
        duration: totalDur,
        sizeBytes: mp4Blob.size
      };
      setExportedVideoResult((prev) => {
        if (prev?.url && prev.url !== url && prev.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(prev.url);
          } catch (_) {}
        }
        return exportObj;
      });
      if (!agentOptions?.keepCurrentTab) {
        setActiveTab('video');
        setSlideshowTime(0);
        setIsPlayingSlideshow(false);
        setTimeout(() => {
          requestAnimationFrame(() => renderSlideshowFrame(0, activeSlots));
        }, 80);
      }
      showLivePreviewBanner('✅ MP4 ভিডিও সফলভাবে এক্সপোর্ট ও ডাউনলোড হয়েছে!');
      return exportObj;
    } catch (e: any) {
      if (e?.message === 'CANCEL') {
        showLivePreviewBanner('⏹️ ভিডিও এক্সপোর্ট বাতিল করা হয়েছে');
        if (agentOptions?.isAgentMode || agentOptions?.keepCurrentTab) throw e;
      } else {
        console.error('ExportEngine error:', e);
        if (agentOptions?.isAgentMode || agentOptions?.keepCurrentTab) {
          throw e;
        }
        showLivePreviewBanner(e?.message || 'ভিডিও এক্সপোর্ট করতে সমস্যা হয়েছে।');
      }
      return null;
    } finally {
      exportEngineRef.current = null;
      exportFollowLiveRef.current = true;
      setIsExportFollowLive(true);
      setIsRenderingVideo(false);
      setIsExportPaused(false);
      setTimeout(() => setRenderProgress(0), 1000);
    }
  };

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectImportInputRef = useRef<HTMLInputElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const SESSION_DATA_KEY = 'vss_browser_session_cache_v2';

  // Load Session Data from sessionStorage on Mount
  useEffect(() => {
    isInitializedRef.current = true;
    try {
      const raw = sessionStorage.getItem(SESSION_DATA_KEY);
      if (raw) {
        const sessionData = JSON.parse(raw);
        if (sessionData.screenshots && Array.isArray(sessionData.screenshots) && sessionData.screenshots.length > 0) {
          setScreenshots(sessionData.screenshots);
        }
        if (sessionData.timelineSlots && Array.isArray(sessionData.timelineSlots) && sessionData.timelineSlots.length > 0) {
          setTimelineSlots(sessionData.timelineSlots);
        }
        if (sessionData.timelineConfig) {
          setTimelineConfig({
            ...sessionData.timelineConfig,
            durationMode: 'matchVoiceover',
            targetDurationSeconds:
              sessionData.screenshots?.length > 0 && sessionData.audioUrl && !String(sessionData.audioUrl).startsWith('blob:')
                ? sessionData.timelineConfig.targetDurationSeconds || 0
                : 0,
          });
        }
        if (sessionData.timelineSummary) setTimelineSummary(sessionData.timelineSummary);
        if (sessionData.videoName) setVideoName(sessionData.videoName);
        if (sessionData.videoUrl && !sessionData.videoUrl.startsWith('blob:')) {
          setVideoUrl(sessionData.videoUrl);
        }
        if (sessionData.duration) setDuration(sessionData.duration);
        if (sessionData.audioUrl && !String(sessionData.audioUrl).startsWith('blob:')) {
          if (sessionData.audioName) setAudioName(sessionData.audioName);
          if (sessionData.audioDuration) setAudioDuration(sessionData.audioDuration);
        }
        if (sessionData.dramaName) setDramaName(sessionData.dramaName);
        if (sessionData.zoomLevel !== undefined && sessionData.zoomLevel >= 1.0) {
          setZoomLevel(sessionData.zoomLevel);
        } else {
          setZoomLevel(DEFAULT_ZOOM_LEVEL);
        }
        if (sessionData.startTrim !== undefined && sessionData.startTrim > 0) {
          setStartTrim(sessionData.startTrim);
        } else {
          setStartTrim(DEFAULT_START_TRIM_SEC);
        }
        if (sessionData.endTrim !== undefined && sessionData.endTrim > 0) {
          setEndTrim(sessionData.endTrim);
        } else {
          setEndTrim(DEFAULT_END_TRIM_SEC);
        }
        if (sessionData.screenshotCount) {
          setScreenshotCount(sessionData.screenshotCount);
          setCustomCountInput(sessionData.screenshotCount.toString());
        }
        setStorageStatus('সেশন ডাটা সংরক্ষিত');
      } else {
        setStorageStatus('ব্রাউজার সেশন প্রস্তুত');
      }
    } catch (e) {
      console.warn('Error loading session storage:', e);
      setStorageStatus('ব্রাউজার সেশন প্রস্তুত');
    }
  }, []);

  // Synchronize All Work and Uploads into Browser Session (debounced & skips heavy >20 image arrays to avoid RAM spikes)
  useEffect(() => {
    if (!isInitializedRef.current) return;
    const timer = window.setTimeout(() => {
      const maxCachedShots = getRenderPerformanceFlags().isMobileFast ? 4 : 20;
      const skipHeavyMedia = screenshots.length > maxCachedShots || timelineSlots.length > maxCachedShots;
      try {
        const payload = {
          screenshots: skipHeavyMedia ? [] : screenshots,
          timelineSlots: skipHeavyMedia ? [] : timelineSlots,
          timelineConfig,
          timelineSummary,
          dramaName,
          scriptText,
          zoomLevel,
          startTrim,
          endTrim,
          videoName,
          videoUrl: videoUrl.startsWith('blob:') ? '' : videoUrl,
          audioName,
          audioDuration,
          screenshotCount
        };
        sessionStorage.setItem(SESSION_DATA_KEY, JSON.stringify(payload));
      } catch (err) {
        try {
          const lightweight = {
            screenshots: [],
            timelineSlots: [],
            timelineConfig,
            timelineSummary,
            dramaName,
            scriptText,
            zoomLevel,
            startTrim,
            endTrim,
            videoName,
            audioName,
            audioDuration,
            screenshotCount
          };
          sessionStorage.setItem(SESSION_DATA_KEY, JSON.stringify(lightweight));
        } catch (_) {}
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    screenshots,
    timelineSlots,
    timelineConfig,
    timelineSummary,
    dramaName,
    scriptText,
    zoomLevel,
    startTrim,
    endTrim,
    videoName,
    videoUrl,
    audioName,
    audioDuration,
    screenshotCount
  ]);

  // Format seconds
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = Math.floor(secs % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const loadVideoFile = async (file: File) => {
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setVideoName(file.name);

    // Keep user's default 140% zoom and 5m 30s (330s) trim settings!
    let targetZoom = DEFAULT_ZOOM_LEVEL;
    let targetStart = DEFAULT_START_TRIM_SEC;
    let targetEnd = DEFAULT_END_TRIM_SEC;
    try {
      const z = localStorage.getItem(STORAGE_KEY_ZOOM);
      if (z) targetZoom = parseFloat(z) || DEFAULT_ZOOM_LEVEL;
      const st = localStorage.getItem(STORAGE_KEY_START_TRIM);
      if (st !== null) targetStart = parseFloat(st) || DEFAULT_START_TRIM_SEC;
      const et = localStorage.getItem(STORAGE_KEY_END_TRIM);
      if (et !== null) targetEnd = parseFloat(et) || DEFAULT_END_TRIM_SEC;
    } catch (_) {}

    setZoomLevel(targetZoom);
    setStartTrim(targetStart);
    setEndTrim(targetEnd);
    setPanX(0);
    setPanY(0);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDur = videoRef.current.duration || 0;
      setDuration(vidDur);
      setVideoWidth(videoRef.current.videoWidth || 1280);
      setVideoHeight(videoRef.current.videoHeight || 720);

      // Maintain persistent default 5m 30s trims (clamped only if video is shorter)
      let targetStart = DEFAULT_START_TRIM_SEC;
      let targetEnd = DEFAULT_END_TRIM_SEC;
      try {
        const st = localStorage.getItem(STORAGE_KEY_START_TRIM);
        if (st !== null) targetStart = parseFloat(st);
        const et = localStorage.getItem(STORAGE_KEY_END_TRIM);
        if (et !== null) targetEnd = parseFloat(et);
      } catch (_) {}

      let resolvedStart = targetStart;
      if (vidDur > 0) {
        if (targetStart + targetEnd >= vidDur) {
          const quarter = Math.max(0, Math.floor(vidDur * 0.25));
          resolvedStart = quarter;
          setStartTrim(quarter);
          setEndTrim(quarter);
        } else {
          resolvedStart = targetStart;
          setStartTrim(targetStart);
          setEndTrim(targetEnd);
        }
        if (videoRef.current.currentTime === 0 && !isGenerating) {
          const previewSeek =
            resolvedStart > 0 && resolvedStart < vidDur - 0.5
              ? resolvedStart
              : Math.min(1.5, vidDur * 0.1);
          if (previewSeek > 0) {
            try {
              videoRef.current.currentTime = previewSeek;
            } catch (_) {}
          }
        }
      }
      setVideoPreviewReadyTick((t) => t + 1);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Drag / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1.0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: panX,
      startPanY: panY
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || zoomLevel <= 1.0) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const maxOffset = ((zoomLevel - 1.0) / zoomLevel) * 50;
    const newPanX = Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startPanX - (deltaX / 3)));
    const newPanY = Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startPanY - (deltaY / 3)));

    setPanX(newPanX);
    setPanY(newPanY);
  }, [isDragging, zoomLevel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const resetZoomAndPan = () => {
    handleUpdateZoomLevel(DEFAULT_ZOOM_LEVEL); // Reset to 140%
    setPanX(0);
    setPanY(0);
  };

  // Smart Quality & Ad Checker Result Interface
  interface FrameAnalysisResult {
    isAcceptable: boolean;
    hasAdOverlay: boolean;
    adReason?: string;
    isBlurry: boolean;
    blurReason?: string;
    sharpnessScore: number;
    overallScore: number;
    qualityTag: string;
  }

  // Active Real-Time Frame Quality, Ad, Text, Emoji & Subject Evaluator
  const evaluateFrameAnalysis = (ctx: CanvasRenderingContext2D, width: number, height: number): FrameAnalysisResult => {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Adaptive sampling step for lightning-fast real-time checks (< 1.5ms)
      const stepX = Math.max(2, Math.floor(width / 160));
      const stepY = Math.max(2, Math.floor(height / 90));

      let totalLuma = 0;
      let count = 0;
      const lumas: number[] = [];

      // White / studio background metrics across entire frame and quadrants
      let totalWhiteCount = 0;
      let rightHalfCount = 0;
      let rightWhiteCount = 0;

      // Lower-third banner examination (bottom 17% of height where TV ads and banners appear)
      const bottomCutoffY = Math.floor(height * 0.83);
      let bottomCount = 0;
      let bottomWhiteCount = 0;
      let bottomTotalLuma = 0;
      let bottomRedCount = 0;

      // Text and sharp typography transition metrics across frame
      let textTransitionsCount = 0;
      let prevScanLuma = -1;

      // Mid-frame subject region (center 64% width, center 64% height for subject clarity)
      const midXStart = Math.floor(width * 0.18);
      const midXEnd = Math.floor(width * 0.82);
      const midYStart = Math.floor(height * 0.16);
      const midYEnd = Math.floor(height * 0.80);

      let midGradientSum = 0;
      let midSamples = 0;
      let perimeterGradientSum = 0;
      let perimeterSamples = 0;

      let centerMinLuma = 255;
      let centerMaxLuma = 0;

      // Human presence metrics (warm skin tones in central focal region)
      let centerSkinCount = 0;
      // Large monochromatic/flat fabric obstruction (e.g. back of woman covered in scarf)
      let centerFlatClothCount = 0;

      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          totalLuma += luma;
          lumas.push(luma);
          count++;

          // Commercial studio pure/bright white backgrounds (#FFFFFF or near-white)
          const isNearWhite = r > 228 && g > 228 && b > 228;
          if (isNearWhite) {
            totalWhiteCount++;
          }

          // Right half metrics (commercial product/packshots like Glow & Lovely or 2000 cells)
          if (x > width * 0.48) {
            rightHalfCount++;
            if (isNearWhite) {
              rightWhiteCount++;
            }
          }

          // Lower-third banner / ad strip logic
          if (y >= bottomCutoffY) {
            bottomCount++;
            bottomTotalLuma += luma;
            if (isNearWhite) {
              bottomWhiteCount++;
            }
            if (r > 185 && g < 80 && b < 80) {
              bottomRedCount++;
            }
          }

          // Horizontal high-contrast binary text transition checking (detects printed fonts/slogans/emojis)
          if (prevScanLuma >= 0 && Math.abs(luma - prevScanLuma) > 65) {
            textTransitionsCount++;
          }
          prevScanLuma = luma;

          // Compute 2D gradient magnitude
          let localGrad = 0;
          if (x + stepX < width && y + stepY < height) {
            const rightIdx = (y * width + (x + stepX)) * 4;
            const downIdx = ((y + stepY) * width + x) * 4;
            const rLuma = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
            const dLuma = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];
            localGrad = Math.abs(rLuma - luma) + Math.abs(dLuma - luma);
          }

          const isCenter = x >= midXStart && x < midXEnd && y >= midYStart && y < midYEnd;

          if (isCenter) {
            midSamples++;
            midGradientSum += localGrad;
            if (luma < centerMinLuma) centerMinLuma = luma;
            if (luma > centerMaxLuma) centerMaxLuma = luma;

            // Human Skin Tone Recognition (standard normalized RGB for South Asian/global skin tones)
            const isSkin = r > 80 && g > 45 && b > 25 &&
                           r > g && g >= b &&
                           (r - b) >= 14 && (r - g) >= 8 &&
                           r < 242;
            if (isSkin) {
              centerSkinCount++;
            }

            // Monochromatic / flat cloth obstruction detection (e.g. back of woman with white scarf)
            const colorChroma = Math.max(r, g, b) - Math.min(r, g, b);
            const isFlatCloth = localGrad < 6.0 && (
              (colorChroma < 28 && luma > 140) || // Light/white/pale dupatta or scarf
              (colorChroma < 20 && luma < 45)      // Dark coat/shawl back
            );
            if (isFlatCloth) {
              centerFlatClothCount++;
            }
          } else {
            // Perimeter region (outer edges: building tops, window lattices, leaves)
            perimeterSamples++;
            perimeterGradientSum += localGrad;
          }
        }
      }

      if (count === 0) {
        return {
          isAcceptable: true,
          hasAdOverlay: false,
          isBlurry: false,
          sharpnessScore: 50,
          overallScore: 50,
          qualityTag: '✨ স্পষ্ট সাবজেক্ট'
        };
      }

      const meanLuma = totalLuma / count;
      let variance = 0;
      for (let i = 0; i < lumas.length; i++) {
        variance += Math.pow(lumas[i] - meanLuma, 2);
      }
      variance = variance / count;

      const overallWhiteRatio = count > 0 ? totalWhiteCount / count : 0;
      const rightWhiteRatio = rightHalfCount > 0 ? rightWhiteCount / rightHalfCount : 0;
      const bottomWhiteRatio = bottomCount > 0 ? bottomWhiteCount / bottomCount : 0;
      const bottomMeanLuma = bottomCount > 0 ? bottomTotalLuma / bottomCount : 0;
      const bottomRedRatio = bottomCount > 0 ? bottomRedCount / bottomCount : 0;
      const textRatio = count > 0 ? textTransitionsCount / count : 0;
      const boundaryStep = bottomMeanLuma - meanLuma;

      // 1. AD, COMMERCIAL, TEXT & EMOJI OVERLAY DETECTION:
      let hasAdOverlay = false;
      let adReason: string | undefined = undefined;

      // A. Commercial studio white packshots (e.g. Fair & Lovely / Glow & Lovely product ad)
      if (overallWhiteRatio > 0.15) {
        hasAdOverlay = true;
        adReason = `বাণিজ্যিক পণ্যের বিজ্ঞাপন (স্টুডিও ব্যাকগ্রাউন্ড ${(overallWhiteRatio * 100).toFixed(0)}%)`;
      }
      // B. Commercial 3D graphics with white panel on side (e.g. 2000 new skin cells ad)
      else if (rightWhiteRatio > 0.20 && textRatio > 0.04) {
        hasAdOverlay = true;
        adReason = `বিজ্ঞাপন গ্রাফিক্স ও টেক্সট প্যানেল শনাক্ত`;
      }
      // C. Predominantly white lower-third ad banner (as seen in screenshot_073)
      else if (bottomWhiteRatio > 0.22) {
        hasAdOverlay = true;
        adReason = `লোয়ার-থার্ড বিজ্ঞাপন ব্যানার শনাক্ত (সাদা ব্যানার ${(bottomWhiteRatio * 100).toFixed(0)}%)`;
      } else if (bottomMeanLuma > 212 && boundaryStep > 26) {
        hasAdOverlay = true;
        adReason = `লোয়ার-থার্ড উজ্জ্বল বিজ্ঞাপন স্ট্রিপ শনাক্ত`;
      }
      // D. High density of artificial on-screen text, slogans, or emojis
      else if (textRatio > 0.075) {
        hasAdOverlay = true;
        adReason = `অন-স্ক্রিন বিজ্ঞাপনের লেখা/ইমোজি শনাক্ত`;
      } else if (bottomRedRatio > 0.06 && bottomWhiteRatio > 0.10) {
        hasAdOverlay = true;
        adReason = `বিজ্ঞাপন লোগো ও ব্র্যান্ড গ্রাফিক্স শনাক্ত`;
      }

      // 2. SUBJECT CLARITY, DRONE SHOT & BACK-TURNED/OCCLUDED SUBJECT DETECTION:
      const sharpnessScore = midSamples > 0 ? (midGradientSum / midSamples) : 20;
      const perimeterSharpness = perimeterSamples > 0 ? (perimeterGradientSum / perimeterSamples) : 20;
      const focalRatio = perimeterSharpness > 0 ? (sharpnessScore / perimeterSharpness) : 1.0;
      const centerDynamicRange = centerMaxLuma - centerMinLuma;
      const centerSkinRatio = midSamples > 0 ? (centerSkinCount / midSamples) : 0;
      const centerFlatClothRatio = midSamples > 0 ? (centerFlatClothCount / midSamples) : 0;

      let isBlurry = false;
      let blurReason: string | undefined = undefined;

      // A. Out of focus / motion blur
      if (sharpnessScore < 9.2) {
        isBlurry = true;
        blurReason = `সাবজেক্ট অস্পষ্ট বা মোশন ব্লার (শার্পনেস: ${sharpnessScore.toFixed(1)})`;
      }
      // B. Distant Drone / Aerial / Architecture Establishing Shot (NO HUMAN SUBJECT)
      // High perimeter window/foliage clutter, but virtually zero skin tone in center (like screenshot_027)
      else if (centerSkinRatio < 0.012 && (focalRatio < 1.25 || (sharpnessScore > 11.5 && centerSkinRatio < 0.007))) {
        isBlurry = true;
        blurReason = `দূরবর্তী ড্রোন/ল্যান্ডস্কেপ দৃশ্য (প্রধান সাবজেক্ট অনুপস্থিত)`;
      }
      // C. Back-turned subject / covered face (like screenshot_106 where woman in white scarf faces away)
      else if (centerFlatClothRatio > 0.28 && centerSkinRatio < 0.02) {
        isBlurry = true;
        blurReason = `সাবজেক্ট পেছনে ঘুরে আছে বা ওড়না/পোশাকে মুখমণ্ডল আবৃত`;
      }
      // D. Awkward hug / obscured face / low focal subject definition (like screenshot_107)
      else if (centerSkinRatio < 0.022 && centerDynamicRange < 48) {
        isBlurry = true;
        blurReason = `সাবজেক্টের মুখমণ্ডল ও স্পষ্ট ফোকাস অনুপস্থিত`;
      }
      // E. Insufficient contrast / washed out frame
      else if (centerDynamicRange < 32) {
        isBlurry = true;
        blurReason = `স্পষ্ট সাবজেক্ট অনুপস্থিত (ফ্ল্যাট/কম কন্ট্রাস্ট দৃশ্য)`;
      } else if (variance < 24) {
        isBlurry = true;
        blurReason = `ফ্রেম ডিটেইলস অনুপস্থিত (ফ্ল্যাট/ব্ল্যাঙ্ক ফ্রেম)`;
      } else if (meanLuma < 16) {
        isBlurry = true;
        blurReason = `অতিরিক্ত অন্ধকার ফ্রেম`;
      } else if (meanLuma > 242) {
        isBlurry = true;
        blurReason = `অতিরিক্ত উজ্জ্বল/ফ্ল্যাশ ফ্রেম`;
      }

      const isAcceptable = !hasAdOverlay && !isBlurry;
      const overallScore = Math.max(0, Math.min(100, Math.round(
        sharpnessScore * 3.0 +
        Math.sqrt(variance) * 0.8 +
        (centerSkinRatio > 0.03 ? 25 : 0) +
        (focalRatio > 1.3 ? 15 : 0) +
        (centerDynamicRange > 60 ? 12 : 0) -
        (hasAdOverlay ? 80 : 0) -
        (isBlurry ? 60 : 0)
      )));

      return {
        isAcceptable,
        hasAdOverlay,
        adReason,
        isBlurry,
        blurReason,
        sharpnessScore,
        overallScore,
        qualityTag: isAcceptable ? '✨ স্পষ্ট সাবজেক্ট' : (hasAdOverlay ? 'বিজ্ঞাপন শনাক্ত' : 'অস্পষ্ট ফ্রেম')
      };
    } catch {
      return {
        isAcceptable: true,
        hasAdOverlay: false,
        isBlurry: false,
        sharpnessScore: 50,
        overallScore: 50,
        qualityTag: '✨ স্পষ্ট সাবজেক্ট'
      };
    }
  };

  // Fast visual scene color/brightness signature (3x2 spatial RGB grid) for anti-same-scene gallery shuffling
  const computeSceneSignatureFromCanvas = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): number[] => {
    try {
      const cols = 3;
      const rows = 2;
      const sig: number[] = [];
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const xStart = Math.floor((rx / cols) * width);
          const xEnd = Math.floor(((rx + 1) / cols) * width);
          const yStart = Math.floor((ry / rows) * height);
          const yEnd = Math.floor(((ry + 1) / rows) * height);
          const stepX = Math.max(4, Math.floor((xEnd - xStart) / 6));
          const stepY = Math.max(4, Math.floor((yEnd - yStart) / 6));
          let rSum = 0;
          let gSum = 0;
          let bSum = 0;
          let samples = 0;
          for (let y = yStart; y < yEnd; y += stepY) {
            for (let x = xStart; x < xEnd; x += stepX) {
              const idx = (y * width + x) * 4;
              rSum += data[idx];
              gSum += data[idx + 1];
              bSum += data[idx + 2];
              samples++;
            }
          }
          const div = Math.max(1, samples) * 255;
          sig.push(
            Math.round((rSum / div) * 1000) / 1000,
            Math.round((gSum / div) * 1000) / 1000,
            Math.round((bSum / div) * 1000) / 1000
          );
        }
      }
      return sig;
    } catch {
      return [];
    }
  };

  // Draw Cropped Video Frame to Canvas
  const drawCroppedFrameToCanvas = (
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement,
    zoom: number,
    pX: number,
    pY: number
  ): CanvasRenderingContext2D | null => {
    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const vWidth = videoEl.videoWidth || 1280;
    const vHeight = videoEl.videoHeight || 720;
    const shotPerf = getRenderPerformanceFlags();
    const maxShotW = shotPerf.screenshotWidth;
    const maxShotH = shotPerf.screenshotHeight;
    // Cap captured frame resolution dynamically based on device capability to avoid mobile RAM/CPU bottlenecks
    const capScale = Math.min(1, maxShotW / vWidth, maxShotH / vHeight);
    const targetW = Math.max(2, Math.round((vWidth * capScale) / 2) * 2);
    const targetH = Math.max(2, Math.round((vHeight * capScale) / 2) * 2);

    canvasEl.width = targetW;
    canvasEl.height = targetH;

    const cropWidth = vWidth / zoom;
    const cropHeight = vHeight / zoom;

    const centerX = vWidth / 2 + (pX / 50) * (vWidth - cropWidth) / 2;
    const centerY = vHeight / 2 + (pY / 50) * (vHeight - cropHeight) / 2;

    const sx = Math.max(0, Math.min(vWidth - cropWidth, centerX - cropWidth / 2));
    const sy = Math.max(0, Math.min(vHeight - cropHeight, centerY - cropHeight / 2));

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(videoEl, sx, sy, cropWidth, cropHeight, 0, 0, targetW, targetH);

    return ctx;
  };

  // Background Screenshot Generation with Real-Time Ad Detection & Candidate Replacement
  const startGeneratingScreenshots = async (agentOpts?: {
    countOverride?: number;
    videoDurationOverride?: number;
    startTrimOverride?: number;
    endTrimOverride?: number;
    onProgressUpdate?: (current: number, total: number, statusText: string) => void;
    throwOnError?: boolean;
  }): Promise<ScreenshotItem[]> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const vidDur = agentOpts?.videoDurationOverride || video?.duration || duration;
    if (!video || !canvas || vidDur <= 0) {
      if (agentOpts?.throwOnError) {
        throw new Error('মূল ভিডিও লোড হয়নি বা ভিডিওর দৈর্ঘ্য পাওয়া যায়নি।');
      }
      return [];
    }

    const rawStartTrim = agentOpts?.startTrimOverride ?? startTrim;
    const rawEndTrim = agentOpts?.endTrimOverride ?? endTrim;
    const safeTrimClamp = rawStartTrim + rawEndTrim >= vidDur - 1 ? Math.floor(vidDur * 0.25) : null;
    const startSec = Math.max(0, safeTrimClamp !== null ? safeTrimClamp : rawStartTrim);
    const endSecOffset = Math.max(0, safeTrimClamp !== null ? safeTrimClamp : rawEndTrim);
    const effectiveEnd = Math.max(startSec + 0.5, vidDur - endSecOffset);
    const effectiveDuration = effectiveEnd - startSec;
    const total = agentOpts?.countOverride ?? screenshotCount;

    if (effectiveDuration <= 0 || total <= 0) {
      const msg = 'অনুগ্রহ করে সঠিক ট্রিম এবং স্ক্রিনশট সংখ্যা নির্ধারণ করুন (শুরুর ট্রিম শেষ ট্রিম থেকে কম হতে হবে)।';
      if (agentOpts?.throwOnError) throw new Error(msg);
      showLivePreviewBanner(msg);
      return [];
    }

    setIsGenerating(true);
    cancelGenerationRef.current = false;
    setScreenshots([]);
    setSelectedIds([]);

    const newScreenshots: ScreenshotItem[] = [];
    let retriedCount = 0;

    const timestamps: number[] = [];
    if (total === 1) {
      timestamps.push(startSec + effectiveDuration / 2);
    } else {
      for (let i = 0; i < total; i++) {
        const t = startSec + (i / (total - 1)) * effectiveDuration;
        timestamps.push(Math.min(effectiveEnd, Math.max(startSec, t)));
      }
    }

    video.pause();
    setIsPlaying(false);

    // Multi-candidate seek offsets to avoid drone shots, commercial ads, text overlays & indistinct scenes
    const shotPerfFlags = getRenderPerformanceFlags();
    const allCandidateOffsets = [0, 3.2, -3.2, 6.4, -6.4, 9.6, -9.6, 12.8, -12.8, 16.0, -16.0];
    const candidateOffsets = allCandidateOffsets.slice(0, Math.max(1, shotPerfFlags.screenshotMaxCandidates));

    for (let i = 0; i < timestamps.length; i++) {
      if (cancelGenerationRef.current) break;

      const nominalTime = timestamps[i];
      let bestDataUrl = '';
      let chosenTimestamp = nominalTime;
      let finalStatus: 'passed' | 'retried' | 'reviewed' = 'passed';
      let finalTag = '✨ স্পষ্ট সাবজেক্ট';
      let wasReplaced = false;
      let replacedReason = '';
      let hadAdOrBlur = false;
      let lastAdOrBlurReason = '';
      let bestCandidateScore = -999;
      let bestCandidateDataUrl = '';
      let bestCandidateTime = nominalTime;
      let bestCandidateSig: number[] = [];
      let chosenSceneSignature: number[] = [];
      let lastDrawnTime = -1;

      const captureStatus = `ফ্রেম বিশ্লেষণ ও ক্যাপচার চলছে: ${i + 1}/${total} (${formatTime(nominalTime)})`;
      setGenerationProgress({
        current: i + 1,
        total: total,
        retried: retriedCount,
        statusText: captureStatus
      });
      agentOpts?.onProgressUpdate?.(i + 1, total, captureStatus);

      // Search through candidate offsets if smart filter is enabled
      const offsetsToTry = enableSmartFrameFilter ? candidateOffsets : [0];

      for (let cIdx = 0; cIdx < offsetsToTry.length; cIdx++) {
        if (cancelGenerationRef.current) break;
        const offset = offsetsToTry[cIdx];
        const candidateTime = Math.max(startSec, Math.min(effectiveEnd, nominalTime + offset));

        // Seek video to candidate time cleanly
        await new Promise<void>((resolve) => {
          let settled = false;
          const onSeeked = () => {
            if (settled) return;
            settled = true;
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = candidateTime;
          setTimeout(onSeeked, shotPerfFlags.screenshotSeekTimeoutMs);
        });

        if (cancelGenerationRef.current) break;
        const ctx = drawCroppedFrameToCanvas(video, canvas, zoomLevel, panX, panY);
        if (!ctx) continue;

        if (agentDisplayCanvasRef.current && (cIdx === 0 || !shotPerfFlags.isMobileFast)) {
          const aCtx = agentDisplayCanvasRef.current.getContext('2d');
          if (aCtx) {
            aCtx.clearRect(0, 0, agentDisplayCanvasRef.current.width, agentDisplayCanvasRef.current.height);
            aCtx.drawImage(
              canvas,
              0,
              0,
              agentDisplayCanvasRef.current.width,
              agentDisplayCanvasRef.current.height
            );
            lastDrawnTime = candidateTime;
          }
        }

        const evalResult = evaluateFrameAnalysis(ctx, canvas.width, canvas.height);

        const baseJpegQ = Math.min(imageQuality, shotPerfFlags.screenshotJpegQuality);
        const captureQuality =
          imageFormat === 'image/jpeg'
            ? total > 120
              ? Math.min(baseJpegQ, 0.76)
              : total > 60
                ? Math.min(baseJpegQ, 0.80)
                : baseJpegQ
            : imageQuality;

        // Only encode image DataURL and compute scene signature when candidate passes or improves best score
        if (evalResult.isAcceptable || evalResult.overallScore > bestCandidateScore) {
          const currentDataUrl = canvas.toDataURL(imageFormat, captureQuality);
          const frameSig = computeSceneSignatureFromCanvas(ctx, canvas.width, canvas.height);

          if (evalResult.overallScore > bestCandidateScore) {
            bestCandidateScore = evalResult.overallScore;
            bestCandidateDataUrl = currentDataUrl;
            bestCandidateTime = candidateTime;
            bestCandidateSig = frameSig;
          }

          if (evalResult.isAcceptable) {
            bestDataUrl = currentDataUrl;
            chosenTimestamp = candidateTime;
            chosenSceneSignature = frameSig;
            if (cIdx > 0) {
              wasReplaced = true;
              replacedReason = lastAdOrBlurReason || (evalResult.hasAdOverlay ? 'বিজ্ঞাপন/লেখা এড়ানো হয়েছে' : 'স্পষ্ট সাবজেক্ট নির্বাচন');
              finalStatus = 'retried';
              finalTag = '🔄 রিপ্লেস করা ফ্রেম';
              retriedCount++;
            }
            if (agentDisplayCanvasRef.current && lastDrawnTime !== candidateTime) {
              const aCtx = agentDisplayCanvasRef.current.getContext('2d');
              if (aCtx) {
                aCtx.clearRect(0, 0, agentDisplayCanvasRef.current.width, agentDisplayCanvasRef.current.height);
                aCtx.drawImage(canvas, 0, 0, agentDisplayCanvasRef.current.width, agentDisplayCanvasRef.current.height);
                lastDrawnTime = candidateTime;
              }
            }
            break; // Found acceptable frame!
          }
        }

        hadAdOrBlur = true;
        lastAdOrBlurReason = evalResult.adReason || evalResult.blurReason || 'বিজ্ঞাপন/অস্পষ্টতা';
      }

      if (cancelGenerationRef.current) break;

      // If no candidate was 100% acceptable, use the best scored candidate
      if (!bestDataUrl) {
        bestDataUrl = bestCandidateDataUrl;
        chosenTimestamp = bestCandidateTime;
        chosenSceneSignature = bestCandidateSig;
        if (chosenTimestamp !== nominalTime) {
          wasReplaced = true;
          replacedReason = lastAdOrBlurReason || 'বিকল্প স্পষ্ট ফ্রেম';
          retriedCount++;
        }
        finalStatus = hadAdOrBlur ? 'reviewed' : 'passed';
        finalTag = hadAdOrBlur ? '🛡️ বিকল্প স্পষ্ট ফ্রেম' : '✨ স্পষ্ট সাবজেক্ট';
      }

      setCurrentTime(chosenTimestamp);

      const isItemReplaced = wasReplaced || chosenTimestamp !== nominalTime;
      const item: ScreenshotItem = {
        id: `shot_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        dataUrl: bestDataUrl,
        timestamp: chosenTimestamp,
        formattedTime: formatTime(chosenTimestamp),
        index: i + 1,
        width: canvas.width,
        height: canvas.height,
        qualityStatus: isItemReplaced ? 'retried' : 'passed',
        qualityTag: isItemReplaced ? '🔄 রিপ্লেস করা ফ্রেম' : '✨ স্পষ্ট সাবজেক্ট',
        hasAdDetected: hadAdOrBlur,
        wasReplaced: isItemReplaced,
        replacedReason: isItemReplaced ? (replacedReason || 'বিজ্ঞাপন/অস্পষ্টতামুক্ত ফ্রেম') : undefined,
        originalTime: nominalTime,
        sceneSignature: chosenSceneSignature
      };

      newScreenshots.push(item);
      if (i < 4 || i === timestamps.length - 1 || i % 4 === 0) {
        setScreenshots([...newScreenshots]);
      }

      if (bestDataUrl && agentDisplayCanvasRef.current && !cancelGenerationRef.current && lastDrawnTime !== chosenTimestamp) {
        const acceptedImg = new Image();
        acceptedImg.onload = () => {
          if (cancelGenerationRef.current || !agentDisplayCanvasRef.current) return;
          const aCtx = agentDisplayCanvasRef.current.getContext('2d');
          if (aCtx) {
            aCtx.clearRect(0, 0, agentDisplayCanvasRef.current.width, agentDisplayCanvasRef.current.height);
            aCtx.drawImage(
              acceptedImg,
              0,
              0,
              agentDisplayCanvasRef.current.width,
              agentDisplayCanvasRef.current.height
            );
          }
        };
        acceptedImg.src = bestDataUrl;
      }

      await new Promise((r) => setTimeout(r, 8));
    }

    let finalShots = newScreenshots;
    if (!cancelGenerationRef.current && newScreenshots.length > 1) {
      finalShots = SmartTimelineEngine.shuffleAntiSameScene(newScreenshots).map((s, idx) => ({
        ...s,
        index: idx + 1
      }));
      setScreenshots(finalShots);
      lastSyncedGalleryKeyRef.current = '';
    }

    setIsGenerating(false);
    return finalShots;
  };

  // Autonomous One-Click AI Agent Pipeline Runner
  const updateAgentStep = useCallback(
    (key: AgentStepKey, status: AgentStepStatus, percent: number, detail: string) => {
      setAgentSteps((prev) =>
        prev.map((step) =>
          step.key === key ? { ...step, status, percent, detail } : step
        )
      );
    },
    []
  );

  const ensureVideoReadyForAgent = useCallback(async (): Promise<number> => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) {
      throw new Error('মূল নাটকের ভিডিও আপলোড করা হয়নি।');
    }
    if (vid.readyState >= 1 && vid.duration > 0 && !isNaN(vid.duration)) {
      return vid.duration;
    }
    return await new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        vid.removeEventListener('loadedmetadata', onReady);
        reject(new Error('ভিডিও মেটাডাটা লোড হতে বেশি সময় নিচ্ছে। অনুগ্রহ করে আবার চেষ্টা করুন।'));
      }, 10000);
      const onReady = () => {
        window.clearTimeout(timeout);
        vid.removeEventListener('loadedmetadata', onReady);
        if (vid.duration > 0 && !isNaN(vid.duration)) {
          resolve(vid.duration);
        } else {
          reject(new Error('ভিডিওর সঠিক দৈর্ঘ্য পাওয়া যায়নি।'));
        }
      };
      vid.addEventListener('loadedmetadata', onReady);
      try {
        vid.load();
      } catch (_) {}
    });
  }, [videoUrl]);

  const handleCancelAutonomousPipeline = useCallback(() => {
    agentRunIdRef.current += 1;
    agentCancelledRef.current = true;
    voiceStudioRef.current?.cancelActiveTask();
    cancelGenerationRef.current = true;
    setIsGenerating(false);
    exportEngineRef.current?.cancel();
    setIsAgentRunning(false);
    setAgentSteps((prev) =>
      prev.map((s) =>
        s.status === 'running'
          ? { ...s, status: 'error', detail: 'ব্যবহারকারী প্রক্রিয়াটি বাতিল করেছেন।' }
          : s
      )
    );
    setAgentError('⏹️ প্রক্রিয়া বাতিল করা হয়েছে। আপনি চাইলে অডিও বা সেটিংস পরিবর্তন করে আবার শুরু করতে পারেন।');
  }, []);

  const startGeneratingScreenshotsRef = useRef(startGeneratingScreenshots);
  startGeneratingScreenshotsRef.current = startGeneratingScreenshots;

  const exportSlideshowAsVideoRef = useRef(exportSlideshowAsVideo);
  exportSlideshowAsVideoRef.current = exportSlideshowAsVideo;

  const handleStartAutonomousPipeline = useCallback(async () => {
    if (isAgentRunning) return;
    if (!voiceStudioRef.current) {
      setAgentError('ভয়েস স্টুডিও প্রস্তুত নয়। অনুগ্রহ করে পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।');
      return;
    }

    const runId = ++agentRunIdRef.current;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    setIsAgentRunning(true);
    agentCancelledRef.current = false;
    setAgentError(null);
    setAgentSuccessMessage(null);
    setAgentSteps([
      { key: 'voice', label: 'ভয়েস তৈরি / যাচাই', status: 'idle', detail: '', percent: 0 },
      { key: 'bgm', label: 'ব্যাকগ্রাউন্ড মিউজিক অ্যাড', status: 'idle', detail: '', percent: 0 },
      { key: 'screenshots', label: 'ভিডিও থেকে স্মার্ট স্ক্রিনশট গ্রহণ', status: 'idle', detail: '', percent: 0 },
      { key: 'timeline', label: 'টাইমলাইন, এনিমেশন ও নাটক ওভারলে সেট', status: 'idle', detail: '', percent: 0 },
      { key: 'export', label: `${exportResolution.toUpperCase()} MP4 রেন্ডার ও সরাসরি এক্সপোর্ট`, status: 'idle', detail: '', percent: 0 },
    ]);

    try {
      // STAGE 1 & 2: Voice Preparation (Skip if recorded or already prepared) + BGM Mix
      updateAgentStep('voice', 'running', 5, 'ভয়েস উৎস পরীক্ষা করা হচ্ছে...');
      let voiceMarkedDone = false;
      const audioRes = await voiceStudioRef.current.prepareAudioForAgent({
        preferredSource: preferredVoiceSource,
        forceRegenerateVoice,
        targetDurationOverrideSec: customFinalDurationSec,
        onProgress: (stage, pct, message) => {
          if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;
          if (stage === 'voice') {
            updateAgentStep('voice', 'running', pct, message);
          } else if (stage === 'bgm') {
            if (!voiceMarkedDone) {
              voiceMarkedDone = true;
              updateAgentStep(
                'voice',
                message.includes('স্কিপ') ? 'skipped' : 'completed',
                100,
                'ভয়েস প্রস্তুত সম্পন্ন ✓'
              );
            }
            updateAgentStep('bgm', 'running', pct, message);
          }
        },
      });

      if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;

      updateAgentStep(
        'voice',
        audioRes.voiceSkipped ? 'skipped' : 'completed',
        100,
        audioRes.usedRecordedVoice
          ? 'রেকর্ড করা ভয়েস ব্যবহার করা হয়েছে — নতুন ভয়েস তৈরি স্কিপ ✓'
          : audioRes.voiceSkipped
          ? 'আগে তৈরি ভয়েস পাওয়া গেছে — পুনরায় তৈরি স্কিপ ✓'
          : `এআই ভয়েস তৈরি সম্পন্ন (${formatTime(audioRes.duration)}) ✓`
      );
      updateAgentStep(
        'bgm',
        'completed',
        100,
        audioRes.bgmApplied
          ? `ব্যাকগ্রাউন্ড মিউজিক মিক্সিং সম্পন্ন (${formatTime(audioRes.duration)}) ✓`
          : `মূল অডিও প্রস্তুত সম্পন্ন (${formatTime(audioRes.duration)}) ✓`
      );

      // Strictly lock video duration, screenshot count & timeline to exact manual duration OR natural mixed audio duration
      const targetVideoSec =
        customFinalDurationSec !== null && customFinalDurationSec > 0
          ? customFinalDurationSec
          : Math.max(1, Math.round(audioRes.duration * 10) / 10);
      const neededShots = Math.max(1, Math.round((targetVideoSec - 0.6) / 5.4));
      setScreenshotCount(neededShots);
      setCustomCountInput(String(neededShots));

      // STAGE 3: Keep user on the SAME tab and show captured screenshots directly on the top display canvas
      updateAgentStep('screenshots', 'running', 4, `ভিডিও থেকে ${neededShots}টি স্পষ্ট স্ক্রিনশট নেওয়া শুরু হচ্ছে...`);
      const vidDur = await ensureVideoReadyForAgent();
      if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;

      const capturedShots = await startGeneratingScreenshotsRef.current({
        countOverride: neededShots,
        videoDurationOverride: vidDur,
        throwOnError: true,
        onProgressUpdate: (cur, tot, txt) => {
          if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;
          updateAgentStep(
            'screenshots',
            'running',
            Math.round((cur / Math.max(1, tot)) * 100),
            txt
          );
        },
      });

      if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;
      if (!capturedShots || capturedShots.length === 0) {
        throw new Error('ভিডিও থেকে স্ক্রিনশট সংগ্রহ করা যায়নি।');
      }

      updateAgentStep(
        'screenshots',
        'completed',
        100,
        `${capturedShots.length}টি স্পষ্ট ও বিজ্ঞাপনমুক্ত স্ক্রিনশট সম্পন্ন ✓`
      );

      // STAGE 4: Smart Timeline & Natok Overlay (preserve latest channelSettings & DNA synchronously)
      updateAgentStep(
        'timeline',
        'running',
        50,
        `CH ${activeChannelSlot} অনুযায়ী স্মার্ট টাইমলাইন, ফ্রেম ও নাটকের তথ্য সাজানো হচ্ছে...`
      );
      const builtSlots = handleGenerateSmartTimeline(capturedShots, targetVideoSec);
      const snapshotTimeline = latestGeneratedTimelineRef.current;
      if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;
      updateAgentStep(
        'timeline',
        'completed',
        100,
        `${builtSlots.length}টি স্লটের স্মার্ট টাইমলাইন ও নাটক ওভারলে প্রস্তুত ✓`
      );

      // STAGE 5: Render & Export while keeping user on the SAME tab and mirroring live frames on the top display canvas
      updateAgentStep('export', 'running', 2, `${exportResolution.toUpperCase()} MP4 ভিডিও রেন্ডারিং শুরু হচ্ছে...`);
      const exported = await exportSlideshowAsVideoRef.current({
        slotsOverride: builtSlots,
        screenshotsOverride: capturedShots,
        audioFileOverride: audioRes.file,
        audioDurationOverride: audioRes.duration,
        targetDurationOverrideSec: targetVideoSec,
        channelSettingsOverride: snapshotTimeline?.channelSettings || channelSettingsRef.current,
        timelineConfigOverride: snapshotTimeline?.config,
        channelSlotOverride: activeChannelSlot,
        overlayEffectOverride: snapshotTimeline?.overlayStyleId,
        backgroundEffectOverride: snapshotTimeline?.overlayStyleId,
        exportFpsOverride: getRenderPerformanceFlags().isMobileFast ? exportFps : (snapshotTimeline?.recommendedFps || exportFps),
        broadcastOverlayConfigOverride: {
          ...broadcastOverlayConfig,
          channelSlotNumber: activeChannelSlot
        },
        effectsEnabledOverride: effectsEnabled,
        keepCurrentTab: true,
        isAgentMode: true,
        onExportProgressUpdate: (pct, info) => {
          if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;
          const etaLabel = info.etaSeconds ? ` | ETA: ${Math.ceil(info.etaSeconds)}s` : '';
          updateAgentStep(
            'export',
            'running',
            pct,
            `ভিডিও রেন্ডার ও এনকোডিং চলছে (${pct}%${etaLabel})...`
          );
        },
      });

      if (agentCancelledRef.current || agentRunIdRef.current !== runId) return;
      if (!exported) {
        throw new Error('ভিডিও এক্সপোর্ট সম্পন্ন হয়নি।');
      }

      updateAgentStep(
        'export',
        'completed',
        100,
        `সফলভাবে তৈরি ও ডাউনলোড হয়েছে: ${exported.filename} ✓`
      );
      setAgentSuccessMessage('সব কাজ অটোমেটিক সম্পন্ন হয়েছে ও আপনার MP4 ভিডিও ডাউনলোড শুরু হয়েছে!');
    } catch (err: any) {
      if (agentCancelledRef.current || agentRunIdRef.current !== runId || err?.name === 'AbortError' || err?.message === 'CANCEL') {
        return;
      }
      const msg = err?.message || 'অটো-এজেন্ট প্রক্রিয়ায় একটি সমস্যা হয়েছে।';
      setAgentError(msg);
      setAgentSteps((prev) =>
        prev.map((s) =>
          s.status === 'running' ? { ...s, status: 'error', detail: msg } : s
        )
      );
    } finally {
      if (agentRunIdRef.current === runId) {
        setIsAgentRunning(false);
      }
    }
  }, [
    isAgentRunning,
    preferredVoiceSource,
    forceRegenerateVoice,
    customFinalDurationSec,
    activeChannelSlot,
    broadcastOverlayConfig,
    effectsEnabled,
    updateAgentStep,
    ensureVideoReadyForAgent,
    handleGenerateSmartTimeline,
  ]);

  // Single Screenshot Smart Auto-Replace Action with Wide Multi-Hop Seeking
  const handleReplaceSingleScreenshot = async (id: string) => {
    if (!videoRef.current || isGenerating) return;
    const target = screenshots.find(s => s.id === id);
    if (!target) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    showLivePreviewBanner(`ছবি #${target.index}: সক্রিয়ভাবে স্পষ্ট ও বিজ্ঞাপনমুক্ত ফ্রেম খোঁজা হচ্ছে...`);

    const offsets = [3.2, -3.2, 6.4, -6.4, 9.6, -9.6, 12.8, -12.8, 16.0, -16.0];
    let foundClean = false;
    let newTimestamp = target.timestamp;
    let bestDataUrl = target.dataUrl;
    let bestScore = -999;
    let replaceReason = 'স্পষ্ট সাবজেক্ট ফ্রেম';

    let newSig = target.sceneSignature || [];

    for (const offset of offsets) {
      const candidateTime = Math.max(0, Math.min(duration, target.timestamp + offset));
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = candidateTime;
      });

      const ctx = drawCroppedFrameToCanvas(video, canvas, zoomLevel, panX, panY);
      if (!ctx) continue;

      const evalResult = evaluateFrameAnalysis(ctx, canvas.width, canvas.height);
      const frameSig = computeSceneSignatureFromCanvas(ctx, canvas.width, canvas.height);
      if (evalResult.overallScore > bestScore) {
        bestScore = evalResult.overallScore;
        bestDataUrl = canvas.toDataURL(imageFormat, imageQuality);
        newTimestamp = candidateTime;
        newSig = frameSig;
      }

      if (evalResult.isAcceptable) {
        bestDataUrl = canvas.toDataURL(imageFormat, imageQuality);
        newTimestamp = candidateTime;
        newSig = frameSig;
        foundClean = true;
        replaceReason = 'স্পষ্ট সাবজেক্ট নির্বাচন (বিজ্ঞাপন/অস্পষ্টতা মুক্ত)';
        break;
      }
    }

    const updated = screenshots.map(s => {
      if (s.id === id) {
        return {
          ...s,
          dataUrl: bestDataUrl,
          timestamp: newTimestamp,
          formattedTime: formatTime(newTimestamp),
          qualityStatus: 'retried' as const,
          qualityTag: '✨ রিপ্লেস করা স্পষ্ট ফ্রেম',
          wasReplaced: true,
          replacedReason: replaceReason,
          hasAdDetected: false,
          sceneSignature: newSig
        };
      }
      return s;
    });

    setScreenshots(updated);
    showLivePreviewBanner(`ছবি #${target.index} সফলভাবে স্পষ্ট ও বিজ্ঞাপনমুক্ত ফ্রেম দিয়ে রিপ্লেস করা হয়েছে!`);
  };

  // Batch Auto-Replace for Any Remaining Ads or Blurry Images in Gallery
  const handleAutoReplaceAllAdsAndBlur = async () => {
    if (!videoRef.current || isGenerating || isAutoReplacingBatch || screenshots.length === 0) return;
    setIsAutoReplacingBatch(true);
    showLivePreviewBanner('গ্যালারির সব ছবি সক্রিয়ভাবে স্ক্যান ও রিপ্লেস করা হচ্ছে...');

    let replacedCount = 0;
    const updatedScreenshots = [...screenshots];
    const candidateOffsets = [3.2, -3.2, 6.4, -6.4, 9.6, -9.6, 12.8, -12.8, 16.0, -16.0];

    for (let i = 0; i < updatedScreenshots.length; i++) {
      const item = updatedScreenshots[i];
      let needsReplace = item.hasAdDetected || false;

      // Verify current frame directly through evaluateFrameAnalysis
      if (canvasRef.current && videoRef.current) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            videoRef.current?.removeEventListener('seeked', onSeeked);
            resolve();
          };
          videoRef.current?.addEventListener('seeked', onSeeked);
          if (videoRef.current) videoRef.current.currentTime = item.timestamp;
        });

        const curCtx = drawCroppedFrameToCanvas(videoRef.current, canvasRef.current, zoomLevel, panX, panY);
        if (curCtx) {
          const check = evaluateFrameAnalysis(curCtx, canvasRef.current.width, canvasRef.current.height);
          if (!check.isAcceptable) {
            needsReplace = true;
          }
        }
      }

      if (!needsReplace) continue;

      // Search through candidate offsets
      for (const offset of candidateOffsets) {
        const candidateTime = Math.max(0, Math.min(duration, item.timestamp + offset));
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            videoRef.current?.removeEventListener('seeked', onSeeked);
            resolve();
          };
          videoRef.current?.addEventListener('seeked', onSeeked);
          if (videoRef.current) videoRef.current.currentTime = candidateTime;
        });

        if (canvasRef.current && videoRef.current) {
          const ctx = drawCroppedFrameToCanvas(videoRef.current, canvasRef.current, zoomLevel, panX, panY);
          if (ctx) {
            const evalResult = evaluateFrameAnalysis(ctx, canvasRef.current.width, canvasRef.current.height);
            if (evalResult.isAcceptable) {
              updatedScreenshots[i] = {
                ...item,
                dataUrl: canvasRef.current.toDataURL(imageFormat, imageQuality),
                timestamp: candidateTime,
                formattedTime: formatTime(candidateTime),
                qualityStatus: 'retried',
                qualityTag: '🔄 রিপ্লেস করা স্পষ্ট সাবজেক্ট',
                wasReplaced: true,
                replacedReason: evalResult.adReason ? 'বিজ্ঞাপনমুক্ত সাবজেক্ট' : 'স্পষ্ট সাবজেক্ট ফ্রেম',
                hasAdDetected: false,
                sceneSignature: computeSceneSignatureFromCanvas(ctx, canvasRef.current.width, canvasRef.current.height)
              };
              replacedCount++;
              break;
            }
          }
        }
      }
    }

    setScreenshots(updatedScreenshots);
    setIsAutoReplacingBatch(false);
    showLivePreviewBanner(`স্ক্যান সম্পন্ন: ${replacedCount}টি ছবি স্বয়ংক্রিয়ভাবে পরিচ্ছন্ন ও স্পষ্ট ফ্রেমে রিপ্লেস হয়েছে!`);
  };

  const stopGenerating = () => {
    cancelGenerationRef.current = true;
    setIsGenerating(false);
  };

  // Gallery Deletion Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === screenshots.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(screenshots.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const deleteSingle = async (id: string) => {
    const updated = screenshots.filter(s => s.id !== id);
    setScreenshots(updated);
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const updated = screenshots.filter(s => !selectedIds.includes(s.id));
    setScreenshots(updated);
    setSelectedIds([]);
  };

  const deleteAll = async () => {
    if (screenshots.length === 0) return;
    setScreenshots([]);
    setSelectedIds([]);
  };

  const handleUseAsInputVideo = async (blob: Blob, name: string) => {
    const file = new File([blob], name, { type: blob.type || 'video/mp4' });
    await loadVideoFile(file);
    setActiveTab('editor');
    showLivePreviewBanner(`✅ Exported video "${name}" loaded as main input video!`);
  };

  // Full Project & Session Reset (Wipe all states + sessionStorage)
  const performResetProject = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_DATA_KEY);
      sessionStorage.clear();
    } catch (_) {}

    if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);

    setVideoFile(null);
    setVideoUrl('');
    setVideoName('');
    setDuration(0);
    setCurrentTime(0);
    setScreenshots([]);
    setSelectedIds([]);
    setTimelineSlots([]);
    setTimelineSummary(null);
    setIntroVideoConfig(DEFAULT_INTRO_CONFIG);
    introVideoConfigRef.current = DEFAULT_INTRO_CONFIG;
    setIsHomepageIntroOpen(false);
    setAudioFile(null);
    setAudioUrl('');
    setAudioName('');
    setAudioDuration(0);
    setTimelineConfig((prev) => ({
      ...prev,
      targetDurationSeconds: 0,
      durationMode: 'matchVoiceover'
    }));
    setStartTrim(0);
    setEndTrim(0);
    setZoomLevel(1.0);
    setPanX(0);
    setPanY(0);
    setSlideshowTime(0);
    setIsPlaying(false);
    setIsPlayingSlideshow(false);
    setDramaName('মনের মানুষ (Moner Manush)');
    setScriptText(DEFAULT_USER_BRACKET_SCRIPT);
    setChannelSettings({
      name: '',
      styleId: 'cinematic_gold',
      channelNameEnabled: true,
      watermarkEnabled: true,
      watermarkOpacity: 0.4,
      ctaEnabled: true,
      ctaIntervalSeconds: 45,
      ctaDurationSeconds: 4.0,
      ctaText: 'Please subscribe to the channel and like this video! 👍🔔',
      ctaStylePreset: 'all_rotating'
    });
    setShowLowerThird(true);
    setShowSubtitles(true);
    setEffectsEnabled(true);
    setIsResetModalOpen(false);
    setActiveTab('editor');

    showLivePreviewBanner('Project reset completed');
  }, [videoUrl, audioUrl, showLivePreviewBanner]);

  // Export Project Backup (JSON file containing settings, screenshots, drama details, and smart timeline)
  const exportProjectBackup = () => {
    const projectData = {
      version: 2,
      createdAt: new Date().toISOString(),
      dramaName,
      channelSettings,
      videoName,
      screenshotCount,
      zoomLevel,
      startTrim,
      endTrim,
      screenshots,
      timelineSlots,
      timelineConfig,
      timelineSummary
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_screenshot_project_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Project Backup
  const importProjectBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.screenshots || json.timelineSlots || json.dramaName !== undefined) {
          if (json.screenshots) setScreenshots(json.screenshots);
          if (json.videoName) setVideoName(json.videoName);
          if (json.dramaName !== undefined) setDramaName(json.dramaName);
          if (json.screenshotCount) {
            setScreenshotCount(json.screenshotCount);
            setCustomCountInput(json.screenshotCount.toString());
          }
          if (json.zoomLevel) setZoomLevel(json.zoomLevel);
          if (json.startTrim !== undefined) setStartTrim(json.startTrim);
          if (json.endTrim !== undefined) setEndTrim(json.endTrim);
          if (json.timelineSlots) {
            setTimelineSlots(json.timelineSlots);
            canvasRendererRef.current.preloadImages(json.timelineSlots);
          }
          if (json.timelineConfig) setTimelineConfig(json.timelineConfig);
          if (json.timelineSummary) setTimelineSummary(json.timelineSummary);
          if (json.channelSettings) setChannelSettings(json.channelSettings);
          
          showLivePreviewBanner('Project imported');
        }
      } catch (err) {
        showLivePreviewBanner('Invalid project file');
      }
    };
    reader.readAsText(file);
  };

  const downloadSingle = (item: ScreenshotItem) => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    const ext = imageFormat === 'image/png' ? 'png' : imageFormat === 'image/webp' ? 'webp' : 'jpg';
    a.download = `screenshot_${item.index.toString().padStart(3, '0')}_${item.formattedTime.replace(/:/g, '-')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadSelectedAsZip = async () => {
    const itemsToDownload = selectedIds.length > 0
      ? screenshots.filter(s => selectedIds.includes(s.id))
      : screenshots;

    if (itemsToDownload.length === 0) {
      showLivePreviewBanner('No screenshots to export');
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder("video_screenshots");

    itemsToDownload.forEach((item) => {
      const base64Data = item.dataUrl.split(',')[1];
      const ext = imageFormat === 'image/png' ? 'png' : imageFormat === 'image/webp' ? 'webp' : 'jpg';
      folder?.file(`screenshot_${item.index.toString().padStart(3, '0')}_${item.formattedTime.replace(/:/g, '-')}.${ext}`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_screenshots_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculations for live timeline trim indicators
  const startTrimPct = duration > 0 ? Math.min(100, Math.max(0, (startTrim / duration) * 100)) : 0;
  const endTrimPct = duration > 0 ? Math.min(100, Math.max(0, ((duration - endTrim) / duration) * 100)) : 100;

  // Workflow Tab Navigation Configuration for Material 3 Navigation Bar
  const WORKFLOW_TABS: Array<{ id: 'agent' | 'editor' | 'gallery' | 'tailor' | 'voice' | 'video'; name: string; shortName: string; icon: any }> = [
    { id: 'agent', name: 'Auto Agent', shortName: 'Agent', icon: Sparkles },
    { id: 'voice', name: 'Voice', shortName: 'Voice', icon: Mic },
    { id: 'editor', name: 'Screenshot', shortName: 'Capture', icon: Camera },
    { id: 'video', name: 'Video', shortName: 'Video', icon: VideoIcon },
    { id: 'gallery', name: 'Gallery', shortName: 'Gallery', icon: ImageIcon },
    { id: 'tailor', name: 'Tailor', shortName: 'Tailor', icon: Scissors }
  ];

  return (
    <div className="min-h-screen bg-[#edf2fb] text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white pb-20 md:pb-6">
      {/* Hidden canvas and project import inputs (single active videoRef lives inside persistent Editor container) */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={projectImportInputRef}
        type="file"
        accept=".json"
        onChange={importProjectBackup}
        className="hidden"
      />
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setAudioDuration(d);
          if (timelineConfig.durationMode === 'matchVoiceover' && d > 0) {
            setTimelineConfig((prev) => ({ ...prev, targetDurationSeconds: Math.max(1, Math.round(d * 10) / 10) }));
          }
        }}
        onEnded={() => setIsAudioPreviewPlaying(false)}
        loop
        className="hidden"
      />
      <video
        ref={bgVideoRef}
        src="/assets/aistudio/kiki_d90fedb0.mp4"
        loop
        muted
        playsInline
        preload="none"
        crossOrigin="anonymous"
        style={{ position: 'fixed', top: -9999, left: -9999, width: 4, height: 4, opacity: 0.01, pointerEvents: 'none' }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAudioUpload(f);
        }}
        className="hidden"
      />

      {/* Android Material 3 Top App Bar with Safe-Area Status Bar / Camera Clearance */}
      <header className="sticky top-0 z-40 pt-safe-header pb-2.5 px-3 sm:px-4 bg-white/[0.98] md:bg-white/95 md:backdrop-blur-xl border-b border-indigo-100/90 shadow-[0_2px_14px_rgba(37,99,235,0.06)]">
        <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-2 min-w-0">
          {/* App Brand Zone */}
          <div className="flex items-center gap-2 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm border border-blue-400/30 shrink-0">
              <Film className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-[13px] sm:text-base font-extrabold tracking-tight text-slate-900 truncate">
              CineCraft Studio
            </h1>
          </div>

          {/* Desktop Center Navigation Tabs */}
          <nav
            aria-label="Desktop Studio Navigation"
            className="hidden md:flex items-center gap-1 p-1 bg-indigo-50/80 border border-indigo-100 rounded-2xl shrink-0"
          >
            {WORKFLOW_TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.name}</span>
                  {tab.id === 'gallery' && screenshots.length > 0 && (
                    <span className={`text-[10px] font-mono font-bold tabular-nums ${isActive ? 'text-blue-100' : 'text-blue-600'}`}>
                      ({screenshots.length})
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Compact Android App Bar Action Triggers (Clip-safe on narrow mobile viewports) */}
          <div className="flex items-center gap-1.5 shrink-0">

            <button
              type="button"
              onClick={() => setIsSeriesScheduleOpen(true)}
              className="h-9 w-9 sm:h-10 sm:w-10 xl:w-auto xl:px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200/80 text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shrink-0 relative"
              title="Series Upload Schedule"
              aria-label="Schedule"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline whitespace-nowrap">
                Schedule{todaysSeriesList.length > 0 ? ` (${todaysSeriesList.length})` : ''}
              </span>
              {todaysSeriesList.length > 0 && (
                <span className="xl:hidden absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
                  {todaysSeriesList.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setChannelSettingsModalTab('channels');
                setIsChannelSettingsOpen(true);
              }}
              className="h-9 w-9 sm:h-10 sm:w-10 xl:w-auto xl:px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shrink-0"
              title="Channel & Drama Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline whitespace-nowrap">Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setIsGeminiKeyModalOpen(true)}
              className="h-9 w-9 sm:h-10 sm:w-10 xl:w-auto xl:px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shrink-0"
              title="Gemini API Key"
              aria-label="API Key"
            >
              <Key className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline whitespace-nowrap">API Key</span>
            </button>

            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="h-9 w-9 sm:h-10 sm:w-10 xl:w-auto xl:px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shrink-0"
              title="Reset Project Data"
              aria-label="Reset"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline whitespace-nowrap">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-2.5 pt-2.5 pb-4 md:p-4 flex flex-col gap-3">
        {/* Autonomous AI Agent View (Step #1 Upfront Setup + One-Click Auto Production) */}
        {activeTab === 'agent' && (
          <div className="flex flex-col gap-3">
            <AutoAgentPanel
            activeChannelSlot={activeChannelSlot}
            savedChannels={savedChannels}
            onSelectChannelSlot={handleSelectChannelSlot}
            channelSettings={channelSettings}
            onUpdateChannelNameQuick={handleUpdateChannelNameQuick}
            onToggleChannelNameQuick={() =>
              handleUpdateChannelSettings({
                channelNameEnabled: !(channelSettings.channelNameEnabled !== false)
              })
            }
            onToggleWatermarkQuick={() =>
              handleUpdateChannelSettings({
                watermarkEnabled: !(channelSettings.watermarkEnabled !== false)
              })
            }
            onOpenChannelSettingsModal={() => {
              setChannelSettingsModalTab('channels');
              setIsChannelSettingsOpen(true);
            }}
            showLowerThird={showLowerThird}
            onToggleLowerThird={() => setShowLowerThird((v) => !v)}
            showSubtitles={showSubtitles}
            onToggleSubtitles={() => setShowSubtitles((v) => !v)}
            effectsEnabled={effectsEnabled}
            onToggleEffects={() => setEffectsEnabled((v) => !v)}
            onToggleCtaQuick={() =>
              handleUpdateChannelSettings({
                ctaEnabled: !(channelSettings.ctaEnabled !== false)
              })
            }
            seriesList={seriesList}
            activeSeries={activeSeries}
            onSelectSeriesById={handleSelectSeriesById}
            onUpdateActiveEpisode={handleUpdateActiveEpisode}
            releaseDate={activeReleaseDate}
            formattedReleaseDate={formattedReleaseDate}
            onUpdateReleaseDate={handleUpdateReleaseDate}
            broadcastPreviewText={
              broadcastOverlayConfig.dramaTitle
                ? `${broadcastOverlayConfig.dramaTitle}${broadcastOverlayConfig.episodeLabel ? ` • ${broadcastOverlayConfig.episodeLabel}` : ''}`
                : ''
            }
            voiceSnapshot={voiceStudioSnapshot}
            scriptText={scriptText}
            onScriptTextChange={setScriptText}
            onUploadRecordedVoice={async (file) => {
              setCustomFinalDurationSec(null);
              await voiceStudioRef.current?.uploadRecordedVoice(file);
            }}
            onClearRecordedVoice={() => {
              setCustomFinalDurationSec(null);
              voiceStudioRef.current?.clearRecordedVoice();
            }}
            onStartMicRecording={async () => {
              setCustomFinalDurationSec(null);
              await voiceStudioRef.current?.startMicRecording();
            }}
            onStopMicRecording={() => voiceStudioRef.current?.stopMicRecording()}
            onUploadBgm={(file) => voiceStudioRef.current?.uploadBgm(file)}
            onClearBgm={() => voiceStudioRef.current?.clearBgm()}
            onUpdateMixSettings={(opts) => voiceStudioRef.current?.setMixSettings(opts)}
            onDownloadPureVoiceMp3={() => voiceStudioRef.current?.downloadPureVoiceMp3()}
            onDownloadMasterMp3={() => voiceStudioRef.current?.downloadMasterMp3()}
            onOpenApiKeyModal={() => setIsGeminiKeyModalOpen(true)}
            videoName={videoName}
            videoUrl={videoUrl}
            sourceVideoElRef={videoRef}
            displayCanvasRef={agentDisplayCanvasRef}
            videoPreviewReadyTick={videoPreviewReadyTick}
            isSourceVideoPlaying={isPlaying}
            onToggleSourceVideoPlay={togglePlay}
            panX={panX}
            panY={panY}
            videoDuration={duration}
            videoWidth={videoWidth}
            videoHeight={videoHeight}
            startTrim={startTrim}
            endTrim={endTrim}
            zoomLevel={zoomLevel}
            onUploadVideo={async (file) => {
              await loadVideoFile(file);
            }}
            onClearVideo={() => {
              if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
              setVideoFile(null);
              setVideoUrl('');
              setVideoName('');
              setDuration(0);
              setVideoWidth(0);
              setVideoHeight(0);
              setScreenshots([]);
            }}
            onUpdateStartTrim={handleUpdateStartTrim}
            onUpdateEndTrim={handleUpdateEndTrim}
            onUpdateZoomLevel={handleUpdateZoomLevel}
            targetVideoDurationSec={effectiveHomepageDurationSec}
            autoDurationSec={autoBaselineDurationSec}
            isManualFinalDuration={customFinalDurationSec !== null}
            onChangeFinalDurationSec={(newSec) => setCustomFinalDurationSec(newSec)}
            onResetFinalDurationAuto={() => setCustomFinalDurationSec(null)}
            onAdaptScriptToFinalDuration={handleAdaptHomepageScriptToFinalDuration}
            isAdaptingScript={isAdaptingHomepageScript}
            estimatedShotsCount={estimatedHomepageShots}
            masterAudioUrl={homepageMasterAudio.url}
            masterAudioDuration={homepageMasterAudio.duration}
            masterAudioName={homepageMasterAudio.name}
            isMixingPreviewAudio={isMixingHomepageAudio}
            onMixPreviewAudio={handleMixHomepagePreviewAudio}
            preferredVoiceSource={preferredVoiceSource}
            onChangePreferredVoiceSource={(src) => {
              setPreferredVoiceSource(src);
              setCustomFinalDurationSec(null);
            }}
            forceRegenerateVoice={forceRegenerateVoice}
            onToggleForceRegenerateVoice={setForceRegenerateVoice}
            isAgentRunning={isAgentRunning}
            agentSteps={agentSteps}
            agentError={agentError}
            agentSuccessMessage={agentSuccessMessage}
            onStartAutonomousPipeline={handleStartAutonomousPipeline}
            onCancelAutonomousPipeline={handleCancelAutonomousPipeline}
            lastExportedVideo={exportedVideoResult}
            onDownloadLastExported={() => {
              if (exportedVideoResult) {
                triggerDownloadBlob(exportedVideoResult.blob, exportedVideoResult.filename, exportedVideoResult.url);
              }
            }}
            onOpenVideoTab={() => setActiveTab('video')}
            exportResolution={exportResolution}
            onUpdateExportResolution={handleUpdateExportResolution}
            exportFps={exportFps}
            onUpdateExportFps={setExportFps}
            performanceMode={performanceMode}
            onUpdatePerformanceMode={handleUpdatePerformanceMode}
            isIntroPanelOpen={isHomepageIntroOpen}
            onToggleIntroPanel={handleToggleHomepageIntroPanel}
            hasAttachedIntro={timelineSlots.some((s) => s.isIntroVideo) || introVideoConfig.enabled}
            attachedIntroDuration={
              timelineSlots.find((s) => s.isIntroVideo)?.duration ||
              (introVideoConfig.enabled ? introVideoConfig.duration : 0)
            }
            onRemoveAttachedIntro={handleRemoveIntroVideo}
          />

          {/* Exact Intro Video Table (TailorStudioPanel) — Hidden until Homepage Intro Video button is clicked */}
          {isHomepageIntroOpen && (
            <div
              ref={homepageIntroSectionRef}
              className="w-full rounded-3xl overflow-hidden border border-slate-800 bg-[#070d1b] p-2.5 sm:p-3.5 shadow-xl flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-100">
                  <Film className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Intro Video Studio (Trailer Tailor)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHomepageIntroOpen(false)}
                  className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>বন্ধ করুন</span>
                </button>
              </div>
              <TailorStudioPanel
                onAddTrailerToIntro={handleAddTrailerAsIntro}
                onUseAsInputVideo={handleUseAsInputVideo}
                onNavigateTab={setActiveTab}
                videoDuration={duration}
                screenshots={screenshots}
                videoUrl={videoUrl}
                videoName={videoName}
                startTrim={startTrim}
                endTrim={endTrim}
              />
            </div>
          )}
        </div>
        )}

        {/* Screenshot Studio View */}
        <div className={`${activeTab === 'editor' ? 'grid' : 'hidden'} grid-cols-1 lg:grid-cols-12 gap-4 items-start w-full`}>
          {/* Left Column: Responsive 16:9 Sharp Video Preview & Controls */}
          <div className="lg:col-span-7 flex flex-col gap-2 w-full">
            <div
              ref={previewContainerRef}
              onMouseDown={handleMouseDown}
              className={`w-full aspect-video bg-[#040811] relative flex items-center justify-center overflow-hidden select-none rounded-2xl border border-white/[0.1] shadow-xl ${
                zoomLevel > 1.0 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
              }`}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  preload="auto"
                  onLoadedMetadata={handleLoadedMetadata}
                  onLoadedData={() => setVideoPreviewReadyTick((t) => t + 1)}
                  onSeeked={() => {
                    if (!isGenerating) setVideoPreviewReadyTick((t) => t + 1);
                  }}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-cover pointer-events-none transition-transform duration-75"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panX}%, ${panY}%)`
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1629] text-slate-300 p-4 text-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <VideoIcon className="w-5 h-5 text-sky-400" />
                    <span>No Video</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-11 bg-blue-600 hover:bg-blue-500 border border-blue-400/40 text-white font-bold px-4 rounded-xl text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Upload Video</span>
                  </button>
                </div>
              )}

              {videoUrl && zoomLevel > 1.0 && (
                <div className="absolute top-2.5 left-2.5 bg-black/80 text-indigo-300 text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-none border border-indigo-500/40 flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" />
                  <span>{Math.round(zoomLevel * 100)}%</span>
                </div>
              )}

              {isGenerating && (
                <div className="absolute top-2.5 right-2.5 z-20 bg-rose-600/95 text-white text-[11px] font-bold font-mono tabular-nums px-2.5 py-1 rounded-none border border-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                  <span>CAPTURING {generationProgress.current}/{generationProgress.total}</span>
                </div>
              )}

              {videoUrl && !isGenerating && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <div className="bg-indigo-600 text-white p-3 rounded-none border border-indigo-400">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </div>
                </button>
              )}
            </div>

            {/* Live Capture Progress Strip + Latest Captured Frames Preview */}
            {isGenerating && (
              <div className="w-full bg-[#0f172a] border border-indigo-500/60 rounded-none p-2.5 flex flex-col gap-2 text-slate-100">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-indigo-300 truncate">
                    {generationProgress.statusText || `Capturing ${generationProgress.current}/${generationProgress.total}...`}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-[11px] font-bold text-emerald-300">
                      {Math.round((generationProgress.current / Math.max(1, generationProgress.total)) * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={isAgentRunning ? handleCancelAutonomousPipeline : stopGenerating}
                      className="h-6 px-2 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-none border border-rose-400 cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-900 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-150"
                    style={{
                      width: `${Math.max(3, Math.min(100, (generationProgress.current / Math.max(1, generationProgress.total)) * 100))}%`
                    }}
                  />
                </div>
                {screenshots.length > 0 && (
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 pt-0.5">
                    {screenshots.slice(-6).map((shot) => (
                      <div key={shot.id} className="relative aspect-video bg-slate-950 border border-slate-700 overflow-hidden">
                        <img src={shot.dataUrl} alt={`#${shot.index}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] font-mono text-white px-1">
                          #{shot.index}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Player Scrubber Box */}
            <div className="w-full bg-[#0d1629] border border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-white/[0.06] text-slate-100 shadow-lg">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-200 truncate">{videoName || 'No Video'}</span>
                <div className="flex items-center gap-1 font-mono tabular-nums shrink-0">
                  <span className="text-sky-400 font-bold">{formatTime(currentTime)}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-300">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 relative">
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={!videoUrl}
                    className="h-10 w-10 bg-[#182848] hover:bg-[#1f345d] disabled:opacity-40 rounded-xl text-slate-100 transition-all active:scale-95 border border-white/[0.08] flex items-center justify-center cursor-pointer shrink-0"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 relative flex items-center">
                    <div className="absolute inset-x-0 h-3 bg-[#080f1d] rounded-full overflow-hidden pointer-events-none flex border border-white/[0.08]">
                      <div style={{ width: `${Math.max(0, startTrimPct)}%` }} className="bg-amber-500/80 border-r border-amber-400" />
                      <div style={{ width: `${Math.max(0, endTrimPct - startTrimPct)}%` }} className="bg-emerald-500/75" />
                      <div style={{ width: `${Math.max(0, 100 - endTrimPct)}%` }} className="bg-rose-500/80 border-l border-rose-400" />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      disabled={!videoUrl}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCurrentTime(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      className="w-full accent-sky-400 h-3.5 bg-transparent rounded-full cursor-pointer z-20 relative disabled:cursor-not-allowed"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        setCurrentTime(0);
                      }
                    }}
                    disabled={!videoUrl}
                    className="h-10 w-10 bg-[#182848] hover:bg-[#1f345d] disabled:opacity-40 rounded-xl text-slate-100 transition-all active:scale-95 border border-white/[0.08] flex items-center justify-center cursor-pointer shrink-0"
                    title="Rewind"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span>Start {formatTime(startTrim)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>Active {formatTime(Math.max(0, duration - startTrim - endTrim))}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    <span>End {formatTime(endTrim)}</span>
                  </span>
                </div>
              </div>

              <div className="px-3.5 py-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono tabular-nums">
                  {videoWidth} x {videoHeight}
                </span>
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
                      setVideoFile(null);
                      setVideoUrl('');
                      setVideoName('');
                      setScreenshots([]);
                    }}
                    className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                  >
                    Clear Video
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Material 3 Control Card */}
          <div className="lg:col-span-5 w-full bg-[#0d1629] border border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-white/[0.06] text-slate-100 shadow-lg">
            <div className="px-3.5 py-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <h2 className="font-bold text-xs uppercase tracking-wide text-white">Screenshot Studio</h2>
            </div>

            {/* Video Upload & Count */}
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-300">Video File</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 bg-blue-600 hover:bg-blue-500 border border-blue-400/40 text-white font-bold px-3 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer truncate"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{videoName ? 'Change Video' : 'Upload Video'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadVideoFile(file);
                  }}
                  className="hidden"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-300">Screenshot Count</span>
                <input
                  type="text"
                  inputMode="numeric"
                  list="screenshot-suggestions"
                  value={customCountInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setCustomCountInput(val);
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num > 0) {
                      setScreenshotCount(num);
                    }
                  }}
                  className="h-9 bg-slate-900 border border-slate-700 rounded-none px-3 text-xs text-white font-mono tabular-nums font-bold focus:outline-none focus:border-indigo-500"
                  placeholder="60"
                />
                <datalist id="screenshot-suggestions">
                  {[10, 20, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300].map((num) => (
                    <option key={num} value={num} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Video Zoom */}
            <div className="p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Zoom</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateZoomLevel(DEFAULT_ZOOM_LEVEL)}
                    className={`h-7 px-2 rounded-none text-[11px] font-bold font-mono tabular-nums border cursor-pointer transition-colors ${
                      Math.round(zoomLevel * 100) === 140
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    140%
                  </button>
                  <span className="h-7 px-2 flex items-center bg-slate-900 border border-slate-700 text-indigo-300 font-mono tabular-nums font-bold text-xs rounded-none">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateZoomLevel(Math.max(1.0, Math.round((zoomLevel - 0.1) * 100) / 100))}
                  className="h-8 w-8 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-none text-slate-200 flex items-center justify-center cursor-pointer shrink-0"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={1.0}
                  max={3.0}
                  step={0.05}
                  value={zoomLevel}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleUpdateZoomLevel(val);
                    if (val === 1.0) {
                      setPanX(0);
                      setPanY(0);
                    }
                  }}
                  className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => handleUpdateZoomLevel(Math.min(3.0, Math.round((zoomLevel + 0.1) * 100) / 100))}
                  className="h-8 w-8 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-none text-slate-200 flex items-center justify-center cursor-pointer shrink-0"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={resetZoomAndPan}
                  className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-none text-slate-200 text-xs font-bold cursor-pointer shrink-0"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Trim Range */}
            <div className="p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Trim Range</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStartTrim(DEFAULT_START_TRIM_SEC);
                    handleUpdateEndTrim(DEFAULT_END_TRIM_SEC);
                  }}
                  className="h-7 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 rounded-none text-[11px] font-bold font-mono tabular-nums cursor-pointer"
                >
                  Default 05:30
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                    <span>Start Trim</span>
                    <span className="font-mono tabular-nums">{formatTime(startTrim)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(DEFAULT_START_TRIM_SEC, duration || 100)}
                    step={1}
                    value={startTrim}
                    onChange={(e) => handleUpdateStartTrim(parseFloat(e.target.value) || 0)}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-none cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-300">
                    <span>End Trim</span>
                    <span className="font-mono tabular-nums">{formatTime(endTrim)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(DEFAULT_END_TRIM_SEC, duration || 100)}
                    step={1}
                    value={endTrim}
                    onChange={(e) => handleUpdateEndTrim(parseFloat(e.target.value) || 0)}
                    className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Generate Action */}
            <div className="p-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => startGeneratingScreenshots()}
                disabled={isGenerating || duration <= 0}
                className={`flex-1 h-10 px-4 rounded-none font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                  isGenerating || duration <= 0
                    ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400/70 text-white'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="tabular-nums">Generating ({generationProgress.current}/{generationProgress.total})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span className="tabular-nums">Generate Screenshots ({screenshotCount})</span>
                  </>
                )}
              </button>

              {isGenerating && (
                <button
                  type="button"
                  onClick={stopGenerating}
                  className="h-10 w-10 bg-rose-700 hover:bg-rose-600 border border-rose-500 text-white rounded-none flex items-center justify-center cursor-pointer shrink-0"
                  title="Stop"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <div className="flex flex-col gap-3 w-full">
            {/* Dark Material 3 Gallery Toolbar */}
            <div className="bg-[#0d1629] border border-white/[0.08] rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-100 shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#182848] border border-white/[0.08] p-2 rounded-xl text-sky-400 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">Gallery</h3>
                  <span className="text-xs font-mono tabular-nums text-slate-300">
                    Total: <strong className="text-sky-300">{screenshots.length}</strong>
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-300">
                    Selected: <strong className="text-emerald-300">{selectedIds.length}</strong>
                  </span>
                </div>
              </div>

              {screenshots.length > 0 && (
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAutoReplaceAllAdsAndBlur}
                    disabled={isAutoReplacingBatch || isGenerating}
                    className="h-10 bg-amber-600 hover:bg-amber-500 border border-amber-400/40 disabled:opacity-50 text-white font-bold text-xs px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isAutoReplacingBatch ? 'animate-spin' : ''}`} />
                    <span className="truncate">Auto Replace</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="h-10 bg-[#182848] hover:bg-[#1f345d] text-slate-200 text-xs px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border border-white/[0.08] cursor-pointer active:scale-95 transition-all"
                  >
                    {selectedIds.length === screenshots.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">Select All</span>
                  </button>

                  <button
                    type="button"
                    onClick={deleteSelected}
                    disabled={selectedIds.length === 0}
                    className={`h-10 text-xs px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border cursor-pointer active:scale-95 transition-all ${
                      selectedIds.length > 0
                        ? 'bg-rose-950/80 border-rose-500/40 text-rose-200 hover:bg-rose-900'
                        : 'bg-[#080f1d] text-slate-500 cursor-not-allowed border-white/[0.06]'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Delete Selected</span>
                  </button>

                  <button
                    type="button"
                    onClick={deleteAll}
                    className="h-10 bg-[#182848] hover:bg-rose-950 text-rose-300 text-xs px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border border-white/[0.08] hover:border-rose-500/40 cursor-pointer active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Delete All</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadSelectedAsZip}
                    className="col-span-2 sm:col-span-1 h-10 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-white font-bold text-xs px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer tabular-nums active:scale-95 transition-all"
                  >
                    <FileArchive className="w-3.5 h-3.5 shrink-0" />
                    <span>ZIP Export ({selectedIds.length > 0 ? selectedIds.length : screenshots.length})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Replaced Images Summary Strip */}
            {screenshots.some((s) => s.wasReplaced) && (
              <div className="bg-[#0d1629] border border-amber-500/35 text-amber-200 rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold tabular-nums">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{screenshots.filter((s) => s.wasReplaced).length} Replaced</span>
                </div>
              </div>
            )}

            {/* Empty Gallery State */}
            {screenshots.length === 0 && !isGenerating && (
              <div className="bg-[#0d1629] border border-white/[0.08] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-slate-200">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <ImageIcon className="w-5 h-5 text-slate-400" />
                  <span>No Screenshots</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className="h-11 bg-blue-600 hover:bg-blue-500 border border-blue-400/40 text-white text-xs font-bold px-5 rounded-xl cursor-pointer active:scale-95 transition-all"
                >
                  Open Screenshot
                </button>
              </div>
            )}

            {/* Gallery Grid */}
            {screenshots.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {screenshots.slice(0, galleryVisibleLimit).map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`group relative bg-[#0d1629] border rounded-2xl overflow-hidden flex flex-col transition-colors ${
                          isSelected ? 'border-sky-400 ring-1 ring-sky-400' : 'border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        {item.wasReplaced && (
                          <div className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 flex items-center justify-between border-b border-amber-500">
                            <span>Replaced</span>
                            <span className="font-mono truncate max-w-[90px]">{item.replacedReason || 'Clean'}</span>
                          </div>
                        )}

                        <div className="relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center">
                          <img
                            src={item.dataUrl}
                            alt={`Screenshot ${item.index}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(item.id)}
                            className="absolute top-1.5 left-1.5 p-1 rounded-none bg-black/75 hover:bg-black text-white cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </button>

                          <span className="absolute top-1.5 right-1.5 bg-black/80 text-indigo-300 font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-none font-bold">
                            #{item.index}
                          </span>

                          <div className="absolute bottom-1.5 left-1.5 bg-black/80 text-slate-200 font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-none flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{item.formattedTime}</span>
                          </div>
                        </div>

                        <div className="p-1.5 bg-slate-900 flex items-center justify-between border-t border-slate-800">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setLightboxImage(item)}
                              className="text-slate-300 hover:text-white p-1.5 rounded-none hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Preview"
                            >
                              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadSingle(item)}
                              className="text-slate-300 hover:text-white p-1.5 rounded-none hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReplaceSingleScreenshot(item.id)}
                              className="text-amber-400 hover:text-amber-300 p-1.5 rounded-none hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Replace"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteSingle(item.id)}
                            className="text-rose-400 hover:text-rose-300 p-1.5 rounded-none hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {screenshots.length > galleryVisibleLimit && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setGalleryVisibleLimit((prev) => prev + 50)}
                      className="h-9 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-bold px-5 rounded-none cursor-pointer"
                    >
                      আরো ছবি দেখুন ({screenshots.length - galleryVisibleLimit}টি বাকি)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tailor / Trailer View: Exact reproduction of user screenshot studio */}
        {activeTab === 'tailor' && (
          <TailorStudioPanel
            onAddTrailerToIntro={handleAddTrailerAsIntro}
            onUseAsInputVideo={handleUseAsInputVideo}
            onNavigateTab={setActiveTab}
            videoDuration={duration}
            screenshots={screenshots}
            videoUrl={videoUrl}
            videoName={videoName}
            startTrim={startTrim}
            endTrim={endTrim}
          />
        )}

        {/* Voice Studio View (Kept mounted CSS-hidden when inactive so Auto Agent shares live state & imperative ref) */}
        <div className={activeTab === 'voice' ? 'block' : 'hidden'}>
          <VoiceStudioPanel
            ref={voiceStudioRef}
            onAudioUploaded={handleAudioUpload}
            audioUrl={audioUrl}
            audioName={audioName}
            audioDuration={audioDuration}
            audioFile={audioFile}
            onClearAudio={removeAudio}
            scriptText={scriptText}
            onScriptTextChange={setScriptText}
            onNavigateTab={setActiveTab}
            activeChannelSlot={activeChannelSlot}
            savedChannels={savedChannels}
            onSelectChannelSlot={handleSelectChannelSlot}
            seriesList={seriesList}
            activeSeries={activeSeries}
            onSelectSeriesById={handleSelectSeriesById}
            onQuickAddDrama={handleQuickAddDrama}
            onUpdateActiveEpisode={handleUpdateActiveEpisode}
            onOpenSeriesScheduleModal={() => setIsSeriesScheduleOpen(true)}
            onVoiceStudioSnapshot={setVoiceStudioSnapshot}
            onOpenApiKeyModal={() => setIsGeminiKeyModalOpen(true)}
          />
        </div>

        {/* Video View: Smart Photo Timeline & Adaptive Animation Studio */}
        {activeTab === 'video' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start w-full">
            {/* Left Column: Responsive 16:9 Preview Player & Filmstrip */}
            <div className="lg:col-span-6 flex flex-col gap-2 w-full">
              <div className="border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col bg-[#0d1629] w-full shadow-lg">
                {/* 16:9 Responsive Material Preview Display */}
                <div className="w-full aspect-video bg-[#040811] relative flex items-center justify-center overflow-hidden select-none border-b border-white/[0.08]">
                  <canvas
                    ref={slideshowCanvasRef}
                    width={previewPerfFlags.previewWidth}
                    height={previewPerfFlags.previewHeight}
                    className="w-full h-full object-contain block"
                  />

                  {isRenderingVideo && (
                    <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5">
                      {isExportFollowLive ? (
                        <div className="bg-rose-600 text-white text-[11px] font-bold font-mono tabular-nums px-2.5 py-1 rounded-none flex items-center gap-1.5 border border-rose-400">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                          <span>LIVE {renderProgress}%</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsPlayingSlideshow(false);
                            exportFollowLiveRef.current = true;
                            setIsExportFollowLive(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold font-mono tabular-nums px-2.5 py-1 rounded-none flex items-center gap-1.5 border border-indigo-400 cursor-pointer"
                          title="Return preview to live encoding frames"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                          <span>Follow Live ({renderProgress}%)</span>
                        </button>
                      )}
                    </div>
                  )}

                  {screenshots.length > 0 && (
                    <div
                      onClick={() => {
                        if (isRenderingVideo) {
                          exportFollowLiveRef.current = false;
                          setIsExportFollowLive(false);
                        }
                        setIsPlayingSlideshow((p) => !p);
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer z-20 group"
                    >
                      <div className="bg-violet-600 hover:bg-violet-500 text-white p-3 rounded-none border border-violet-400 flex items-center justify-center pointer-events-auto">
                        {isPlayingSlideshow ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </div>
                    </div>
                  )}

                  {livePreviewBanner && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-violet-700/95 text-white text-xs font-bold px-3 py-1 rounded-none border border-violet-400/50 flex items-center gap-1.5 max-w-[90%]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="truncate">{livePreviewBanner}</span>
                    </div>
                  )}

                  {screenshots.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] text-slate-200 p-4 text-center rounded-none z-20 gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <VideoIcon className="w-5 h-5 text-indigo-400" />
                        <span>No Photos</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('editor')}
                        className="h-9 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/70 text-white text-xs px-4 rounded-none font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Open Screenshot</span>
                      </button>
                    </div>
                  )}

                  {/* Player Scrubber Overlay (Always interactive — including Play/Pause/Seek during live MP4 Export) */}
                  <div className="absolute bottom-0 inset-x-0 z-30 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-1.5 pointer-events-auto">
                    <div className="flex items-center justify-between text-xs text-white select-none">
                      <span className="font-bold flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-violet-400" />
                        <span className="tabular-nums">Preview ({screenshots.length})</span>
                      </span>
                      <div className="flex items-center gap-1 font-mono tabular-nums text-white">
                        {isRenderingVideo && (
                          <span className="text-[10px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded-none">
                            {isExportFollowLive ? 'LIVE' : 'INSPECT'}
                          </span>
                        )}
                        <span className="font-bold">{formatTime(slideshowTime)}</span>
                        <span className="text-white/70">/</span>
                        <span className="font-bold">{formatTime(totalSlideshowDuration)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 select-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isRenderingVideo) {
                            exportFollowLiveRef.current = false;
                            setIsExportFollowLive(false);
                          }
                          setIsPlayingSlideshow((p) => !p);
                        }}
                        disabled={screenshots.length === 0}
                        title={isPlayingSlideshow ? 'Pause Preview' : 'Play Preview'}
                        className="p-1 text-white hover:text-violet-300 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {isPlayingSlideshow ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextVal = Math.max(0, slideshowTime - 10);
                          if (isRenderingVideo) {
                            exportFollowLiveRef.current = false;
                            setIsExportFollowLive(false);
                          }
                          setSlideshowTime(nextVal);
                          setIsPlayingSlideshow(false);
                          ctaSoundService.stopAllLive();
                          lastCtaCycleRef.current = null;
                          renderSlideshowFrame(nextVal);
                          if (audioRef.current && audioUrl) {
                            const aDur = audioRef.current.duration || audioDuration;
                            if (aDur > 0) audioRef.current.currentTime = nextVal % aDur;
                          }
                        }}
                        disabled={screenshots.length === 0}
                        title="Back 10s"
                        className="p-1 text-white hover:text-violet-300 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <Rewind className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const maxDur = totalSlideshowDuration || 0;
                          const nextVal = Math.min(maxDur, slideshowTime + 10);
                          if (isRenderingVideo) {
                            exportFollowLiveRef.current = false;
                            setIsExportFollowLive(false);
                          }
                          setSlideshowTime(nextVal);
                          setIsPlayingSlideshow(false);
                          ctaSoundService.stopAllLive();
                          lastCtaCycleRef.current = null;
                          renderSlideshowFrame(nextVal);
                          if (audioRef.current && audioUrl) {
                            const aDur = audioRef.current.duration || audioDuration;
                            if (aDur > 0) audioRef.current.currentTime = nextVal % aDur;
                          }
                        }}
                        disabled={screenshots.length === 0}
                        title="Forward 10s"
                        className="p-1 text-white hover:text-violet-300 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextMuted = !isAudioMuted;
                          setIsAudioMuted(nextMuted);
                          if (audioRef.current) {
                            audioRef.current.muted = nextMuted;
                          }
                          if (nextMuted) {
                            ctaSoundService.stopAllLive();
                          }
                          showLivePreviewBanner(nextMuted ? 'Sound muted' : 'Sound enabled');
                        }}
                        className="p-1 text-white hover:text-violet-300 transition-colors cursor-pointer"
                      >
                        {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                      </button>

                      <div className="flex-1 relative flex items-center">
                        <input
                          type="range"
                          min={0}
                          max={totalSlideshowDuration || 1}
                          step={0.05}
                          value={slideshowTime}
                          disabled={screenshots.length === 0}
                          onClick={(e) => e.stopPropagation()}
                          onInput={(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            if (isRenderingVideo) {
                              exportFollowLiveRef.current = false;
                              setIsExportFollowLive(false);
                            }
                            setSlideshowTime(val);
                            setIsPlayingSlideshow(false);
                            ctaSoundService.stopAllLive();
                            lastCtaCycleRef.current = null;
                            renderSlideshowFrame(val);
                            if (audioRef.current && audioUrl) {
                              const aDur = audioRef.current.duration || audioDuration;
                              if (aDur > 0) audioRef.current.currentTime = val % aDur;
                            }
                          }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isRenderingVideo) {
                              exportFollowLiveRef.current = false;
                              setIsExportFollowLive(false);
                            }
                            setSlideshowTime(val);
                            setIsPlayingSlideshow(false);
                            ctaSoundService.stopAllLive();
                            lastCtaCycleRef.current = null;
                            renderSlideshowFrame(val);
                            if (audioRef.current && audioUrl) {
                              const aDur = audioRef.current.duration || audioDuration;
                              if (aDur > 0) audioRef.current.currentTime = val % aDur;
                            }
                          }}
                          className="w-full accent-violet-400 h-1.5 bg-white/30 hover:bg-white/50 rounded-none cursor-pointer"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isRenderingVideo) {
                            exportFollowLiveRef.current = false;
                            setIsExportFollowLive(false);
                          }
                          setSlideshowTime(0);
                          setIsPlayingSlideshow(false);
                          ctaSoundService.stopAllLive();
                          lastCtaCycleRef.current = null;
                          renderSlideshowFrame(0);
                          if (audioRef.current) {
                            audioRef.current.currentTime = 0;
                          }
                        }}
                        disabled={screenshots.length === 0}
                        className="p-1 text-white hover:text-violet-300 disabled:opacity-40 transition-colors cursor-pointer"
                        title="Rewind"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visual Picture Timeline Track (Filmstrip) */}
                {screenshots.length > 0 && (
                  <TimelineFilmstrip
                    slots={timelineSlots}
                    currentTime={slideshowTime}
                    gallery={screenshots.map((s) => ({
                      id: s.id,
                      dataUrl: s.dataUrl,
                      index: s.index,
                      timestamp: s.timestamp,
                      formattedTime: s.formattedTime,
                      width: s.width,
                      height: s.height,
                      qualityStatus: s.qualityStatus
                    }))}
                    onSelectTime={(time) => {
                      if (isRenderingVideo) {
                        exportFollowLiveRef.current = false;
                        setIsExportFollowLive(false);
                      }
                      setSlideshowTime(time);
                      setIsPlayingSlideshow(false);
                      renderSlideshowFrame(time);
                      if (audioRef.current && audioUrl) {
                        const aDur = audioRef.current.duration || audioDuration;
                        if (aDur > 0) audioRef.current.currentTime = time % aDur;
                      }
                    }}
                    onUpdateSlotAnimation={handleUpdateSlotAnimation}
                    onUpdateSlotTransition={handleUpdateSlotTransition}
                    onReplaceSlotImage={handleReplaceSlotImage}
                    onRemoveSlot={handleRemoveSlot}
                    formatTime={formatTime}
                  />
                )}
              </div>

              {/* Compact Auto Agent Rendering / Completion Strip on Video Tab */}
              {(isAgentRunning || (agentSuccessMessage && exportedVideoResult)) && (
                <div className="bg-[#0f172a] border border-indigo-500/60 rounded-none p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-100">
                  {isAgentRunning ? (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                        <span className="font-bold text-indigo-300 truncate">
                          Rendering MP4 ({renderProgress}%) · {channelSettings.name || `CH ${activeChannelSlot}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelAutonomousPipeline}
                        className="h-7 px-3 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white font-bold rounded-none cursor-pointer shrink-0"
                      >
                        Stop
                      </button>
                    </>
                  ) : exportedVideoResult ? (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold text-emerald-300 truncate">
                          {exportedVideoResult.filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            triggerDownloadBlob(
                              exportedVideoResult.blob,
                              exportedVideoResult.filename,
                              exportedVideoResult.url
                            )
                          }
                          className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white font-bold rounded-none flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('agent')}
                          className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-none cursor-pointer"
                        >
                          Auto Agent
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>

            {/* Right Column: Smart Photo Timeline & Adaptive Animation Control Panel */}
            <div className="lg:col-span-6 flex flex-col gap-3 w-full">
              <SmartTimelinePanel
                config={timelineConfig}
                summary={timelineSummary}
                galleryCount={screenshots.length}
                audioDuration={audioDuration}
                audioName={audioName}
                audioUrl={audioUrl}
                onAudioUploadTrigger={() => audioInputRef.current?.click()}
                onRemoveAudio={removeAudio}
                onUpdateConfig={(newConfig) => {
                  setTimelineConfig((prev) => {
                    const updated = { ...prev, ...newConfig };
                    if (newConfig.targetDurationSeconds !== undefined && screenshots.length > 0) {
                      const galleryItems: GalleryItemInput[] = screenshots.map((s) => ({
                        id: s.id,
                        dataUrl: s.dataUrl,
                        index: s.index,
                        timestamp: s.timestamp,
                        formattedTime: s.formattedTime,
                        width: s.width,
                        height: s.height,
                        qualityStatus: s.qualityStatus,
                        sceneSignature: s.sceneSignature
                      }));
                      const { slots, summary } = SmartTimelineEngine.calculateTimelineSlots(galleryItems, updated);
                      const themedSlots = SmartTimelineEngine.applyFrameTheme(slots, updated.frameThemeId || 'all_dynamic');
                      setTimelineSlots(themedSlots);
                      setTimelineSummary(summary);
                      canvasRendererRef.current.preloadImages(themedSlots);
                    }
                    return updated;
                  });
                }}
                channelSettings={channelSettings}
                onUpdateChannelSettings={handleUpdateChannelSettings}
                onOpenChannelSettingsModal={() => {
                  setChannelSettingsModalTab('channels');
                  setIsChannelSettingsOpen(true);
                }}
                outputVideoFormat={outputVideoFormat}
                onUpdateOutputVideoFormat={setOutputVideoFormat}
                exportFps={exportFps}
                onUpdateExportFps={setExportFps}
                exportResolution={exportResolution}
                onUpdateExportResolution={handleUpdateExportResolution}
                performanceMode={performanceMode}
                onUpdatePerformanceMode={handleUpdatePerformanceMode}
                onExportVideo={() => exportSlideshowAsVideo()}
                onCancelExportVideo={handleCancelExportVideo}
                onPauseExportVideo={handlePauseExportVideo}
                onResumeExportVideo={handleResumeExportVideo}
                isExportPaused={isExportPaused}
                isRenderingVideo={isRenderingVideo}
                renderProgress={renderProgress}
                renderStatusInfo={renderStatusInfo}
                lastExportedVideo={exportedVideoResult}
                onDownloadLastExported={() => {
                  if (exportedVideoResult) {
                    triggerDownloadBlob(exportedVideoResult.blob, exportedVideoResult.filename, exportedVideoResult.url);
                  }
                }}
                hasIntroVideo={timelineSlots.some((s) => s.isIntroVideo)}
                onRemoveIntroVideo={handleRemoveIntroVideo}
                activeChannelSlot={activeChannelSlot}
                savedChannels={savedChannels}
                onSelectChannelSlot={handleSelectChannelSlot}
                onApplyChannelAntiSpamDna={handleApplyChannelAntiSpamDna}
                activeSeries={activeSeries}
                seriesList={seriesList}
                onSelectSeriesById={handleSelectSeriesById}
                todaysSeriesCount={todaysSeriesList.length}
                todaysSeriesIds={todaysSeriesList.map((s) => s.id)}
                onOpenSeriesScheduleModal={() => setIsSeriesScheduleOpen(true)}
                onUpdateActiveEpisode={handleUpdateActiveEpisode}
                onQuickAddDrama={handleQuickAddDrama}
                broadcastPreviewText={
                  broadcastOverlayConfig.dramaTitle
                    ? `${broadcastOverlayConfig.dramaTitle}${broadcastOverlayConfig.episodeLabel ? ` • ${broadcastOverlayConfig.episodeLabel}` : ''}`
                    : ''
                }
                releaseDate={activeReleaseDate}
                formattedReleaseDate={formattedReleaseDate}
                onUpdateReleaseDate={handleUpdateReleaseDate}
                showLowerThird={showLowerThird}
                onToggleLowerThird={() => setShowLowerThird((v) => !v)}
                showSubtitles={showSubtitles}
                onToggleSubtitles={() => setShowSubtitles((v) => !v)}
                humanizeAudioEnabled={humanizeAudioEnabled}
                onToggleHumanizeAudio={() => setHumanizeAudioEnabled((v) => !v)}
                safetyReport={safetyReport}
                onRunSafetyCheck={() =>
                  showLivePreviewBanner(
                    `🛡️ পলিসি সেফটি চেক: ${safetyReport.passedCount}/${safetyReport.totalChecks}টি পাস হয়েছে`
                  )
                }
              />
            </div>
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-4xl bg-[#10192d] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="px-4 py-3 bg-[#0b1222] border-b border-white/[0.08] flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3 font-mono tabular-nums text-slate-200">
                <span className="text-sky-300 font-bold">#{lightboxImage.index}</span>
                <span className="text-emerald-300">{lightboxImage.formattedTime}</span>
                <span className="text-slate-400">{lightboxImage.width} × {lightboxImage.height}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadSingle(lightboxImage)}
                  className="h-9 bg-blue-600 hover:bg-blue-500 text-white px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="h-9 bg-[#192642] hover:bg-[#223459] border border-white/10 text-slate-200 px-3 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
              </div>
            </div>
            <div className="bg-black flex items-center justify-center p-2">
              <img
                src={lightboxImage.dataUrl}
                alt={`Screenshot ${lightboxImage.index}`}
                className="max-h-[75vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Reset Project Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden text-slate-900">
            <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Reset Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="h-9 w-9 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="h-11 px-4 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performResetProject}
                className="h-11 px-4 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Settings Modal */}
      <ChannelSettingsModal
        isOpen={isChannelSettingsOpen}
        onClose={() => setIsChannelSettingsOpen(false)}
        settings={channelSettings}
        onSaveSettings={handleSaveChannelSettings}
        savedChannels={savedChannels}
        onUpdateSavedChannels={handleUpdateSavedChannels}
        savedDramas={savedDramas}
        onUpdateSavedDramas={handleUpdateSavedDramas}
        activeDramaName={dramaName}
        onSelectDrama={setDramaName}
        initialTab={channelSettingsModalTab}
        onQuickAddDrama={handleQuickAddDrama}
        onOpenSeriesScheduleModal={() => {
          setIsChannelSettingsOpen(false);
          setIsSeriesScheduleOpen(true);
        }}
        todaysSeriesCount={todaysSeriesList.length}
      />

      {/* Motion FX Studio Modal */}
      <MotionFXStudioModal
        isOpen={isMotionFxStudioOpen}
        onClose={() => setIsMotionFxStudioOpen(false)}
        onEffectsUpdated={() => {
          showLivePreviewBanner('Motion FX Studio updated successfully');
          renderSlideshowFrame(slideshowTime);
        }}
      />

      {/* Gemini API Key Setup Modal */}
      <GeminiApiKeyModal
        isOpen={isGeminiKeyModalOpen}
        onClose={() => setIsGeminiKeyModalOpen(false)}
        onKeysUpdated={() => {
          showLivePreviewBanner('Gemini API Key আপডেট হয়েছে');
        }}
      />

      {/* Series Schedule Manager Modal */}
      <SeriesScheduleModal
        isOpen={isSeriesScheduleOpen}
        onClose={() => setIsSeriesScheduleOpen(false)}
        seriesList={seriesList}
        activeSeriesId={activeSeriesId}
        onSaveSeriesList={handleSaveSeriesList}
        onSelectSeries={handleSelectSeries}
        dismissedTodayIds={dismissedTodayIds}
        onDismissTodaySeries={handleDismissTodaySeries}
        onClearAllTodaySeries={handleClearAllTodaySeries}
        onRestoreTodaySeries={handleRestoreTodaySeries}
      />

      {/* YouTube SEO & Algorithm Booster Modal */}
      <YouTubeSeoModal
        isOpen={isYouTubeSeoModalOpen}
        onClose={() => setIsYouTubeSeoModalOpen(false)}
        seoConfig={youtubeSeoConfig}
        onUpdateSeoConfig={(updated) => setYoutubeSeoConfig((prev) => ({ ...prev, ...updated }))}
        dramaName={activeSeries?.title || dramaName || videoName}
        channelName={channelSettings.name}
        durationSeconds={totalSlideshowDuration || 60}
        savedDramas={Array.from(new Set([...seriesList.filter((s) => s.status === 'active').map((s) => s.title), ...savedDramas]))}
        activeChannelSlot={activeChannelSlot}
      />

      {/* Mobile Android Material 3 Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/[0.98] border-t border-indigo-100 pb-safe shadow-[0_-6px_22px_rgba(15,23,42,0.08)]"
      >
        <div className="grid grid-cols-6 items-center h-[62px] px-1">
          {WORKFLOW_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none active:scale-95 transition-transform relative"
              >
                <div
                  className={`px-3 py-1 rounded-full transition-colors relative flex items-center justify-center ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-500'
                  }`}
                >
                  <IconComp className="w-[18px] h-[18px]" />
                  {tab.id === 'gallery' && screenshots.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-emerald-600 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                      {screenshots.length > 99 ? '99+' : screenshots.length}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight whitespace-nowrap ${
                    isActive ? 'font-bold text-blue-700' : 'font-medium text-slate-500'
                  }`}
                >
                  {tab.shortName}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Quiet Desktop Footer */}
      <footer className="hidden md:block bg-white border-t border-indigo-100 py-3 px-4 text-center text-xs text-slate-500">
        <p>CineCraft Studio · Persistent Browser Production Storage</p>
      </footer>
    </div>
  );
}
