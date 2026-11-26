/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Upload,
  Mic,
  StopCircle,
  Music,
  Film,
  Tv,
  ChevronDown,
  Video as VideoIcon,
  Calendar,
  Plus,
  Minus,
  X,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Download,
  Key,
  Trash2,
  ArrowRight,
  Clock,
  Loader2,
  SkipForward,
  Settings,
  Eye,
  EyeOff,
  Rewind,
  FastForward,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  Camera,
  RefreshCw,
  Captions,
  Bell,
  Zap
} from 'lucide-react';
import {
  CHANNEL_STYLES,
  type ChannelSettings,
  type SeriesItem
} from '../types/timeline';
import type { VoiceStudioAgentStatusSnapshot } from './VoiceStudioPanel';
import { TEN_CHANNEL_VOICE_PROFILES } from '../services/channelVoiceProfiles';
import { ChannelOverlayRenderer } from '../services/channelOverlayRenderer';
import {
  type ExportResolutionId,
  type PerformanceModeId,
  getRenderPerformanceFlags
} from '../services/devicePerformance';

export type AgentStepKey = 'voice' | 'bgm' | 'screenshots' | 'timeline' | 'export';

export type AgentStepStatus = 'idle' | 'running' | 'completed' | 'skipped' | 'error';

export interface AgentPipelineStepState {
  key: AgentStepKey;
  label: string;
  status: AgentStepStatus;
  detail: string;
  percent: number;
}

export interface AutoAgentPanelProps {
  // Channel & Watermark
  activeChannelSlot: number;
  savedChannels: string[];
  onSelectChannelSlot: (slotNumber: number) => void;
  channelSettings: ChannelSettings;
  onUpdateChannelNameQuick: (name: string) => void;
  onToggleChannelNameQuick: () => void;
  onToggleWatermarkQuick: () => void;
  onOpenChannelSettingsModal: () => void;

  // Video Overlay & Effects Toggles (all default ON)
  showLowerThird: boolean;
  onToggleLowerThird: () => void;
  showSubtitles: boolean;
  onToggleSubtitles: () => void;
  effectsEnabled: boolean;
  onToggleEffects: () => void;
  onToggleCtaQuick: () => void;

  // Natok Info (from Screenshot)
  seriesList: SeriesItem[];
  activeSeries: SeriesItem | null;
  onSelectSeriesById: (seriesId: string) => void;
  onUpdateActiveEpisode: (episode: string) => void;
  releaseDate: string;
  formattedReleaseDate: string;
  onUpdateReleaseDate: (dateStr: string) => void;
  broadcastPreviewText: string;

  // Voice & Script synced with VoiceStudioPanel
  voiceSnapshot: VoiceStudioAgentStatusSnapshot | null;
  scriptText: string;
  onScriptTextChange: (text: string) => void;
  onUploadRecordedVoice: (file: File) => Promise<void>;
  onClearRecordedVoice: () => void;
  onStartMicRecording: () => Promise<void>;
  onStopMicRecording: () => void;
  onUploadBgm: (file: File) => void;
  onClearBgm: () => void;
  onUpdateMixSettings: (opts: {
    audioMixMode?: 'clean_voice' | 'voice_with_bgm' | 'pure_voice';
    bgmDuckedVolume?: number;
    bgmLoudVolume?: number;
    interludeDuration?: number;
    speechSpeed?: number;
  }) => void;
  onOpenApiKeyModal: () => void;

  // Source Video
  videoName: string;
  videoUrl?: string;
  sourceVideoElRef?: React.RefObject<HTMLVideoElement | null>;
  displayCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  videoPreviewReadyTick?: number;
  isSourceVideoPlaying?: boolean;
  onToggleSourceVideoPlay?: () => void;
  panX?: number;
  panY?: number;
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  startTrim: number;
  endTrim: number;
  zoomLevel: number;
  onUploadVideo: (file: File) => Promise<void>;
  onClearVideo: () => void;
  onUpdateStartTrim: (val: number) => void;
  onUpdateEndTrim: (val: number) => void;
  onUpdateZoomLevel: (val: number) => void;

  // Video Duration & Screenshot Count (Auto-calculated from script/voice, or manually adjusted via Min/Sec +/-)
  targetVideoDurationSec: number;
  autoDurationSec: number;
  isManualFinalDuration: boolean;
  onChangeFinalDurationSec: (newSec: number) => void;
  onResetFinalDurationAuto: () => void;
  onAdaptScriptToFinalDuration?: () => Promise<void>;
  isAdaptingScript?: boolean;
  estimatedShotsCount: number;

  // Homepage Master Mixed Audio Preview & Control Bar
  masterAudioUrl: string;
  masterAudioDuration: number;
  masterAudioName: string;
  isMixingPreviewAudio?: boolean;
  onMixPreviewAudio?: () => Promise<void>;

  // Agent Runner State
  preferredVoiceSource: 'auto' | 'recorded' | 'script';
  onChangePreferredVoiceSource: (src: 'auto' | 'recorded' | 'script') => void;
  forceRegenerateVoice: boolean;
  onToggleForceRegenerateVoice: (val: boolean) => void;
  isAgentRunning: boolean;
  agentSteps: AgentPipelineStepState[];
  agentError: string | null;
  agentSuccessMessage: string | null;
  onStartAutonomousPipeline: () => void;
  onCancelAutonomousPipeline: () => void;
  lastExportedVideo: {
    blob: Blob;
    url: string;
    filename: string;
    duration: number;
    sizeBytes: number;
  } | null;
  onDownloadLastExported: () => void;
  onOpenVideoTab: () => void;
  exportResolution: ExportResolutionId;
  onUpdateExportResolution: (res: ExportResolutionId) => void;
  exportFps: number;
  onUpdateExportFps: (fps: number) => void;
  performanceMode: PerformanceModeId;
  onUpdatePerformanceMode: (mode: PerformanceModeId) => void;
  isIntroPanelOpen: boolean;
  onToggleIntroPanel: () => void;
  hasAttachedIntro: boolean;
  attachedIntroDuration?: number;
  onRemoveAttachedIntro: () => void;
  onDownloadPureVoiceMp3?: () => void;
  onDownloadMasterMp3?: () => void;
}

function formatMMSS(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '00:00';
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const rem = Math.floor(secs % 60);
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function AutoAgentPanel({
  activeChannelSlot,
  savedChannels,
  onSelectChannelSlot,
  channelSettings,
  onUpdateChannelNameQuick,
  onToggleChannelNameQuick,
  onToggleWatermarkQuick,
  onOpenChannelSettingsModal,
  showLowerThird,
  onToggleLowerThird,
  showSubtitles,
  onToggleSubtitles,
  effectsEnabled,
  onToggleEffects,
  onToggleCtaQuick,
  seriesList,
  activeSeries,
  onSelectSeriesById,
  onUpdateActiveEpisode,
  releaseDate,
  formattedReleaseDate,
  onUpdateReleaseDate,
  broadcastPreviewText,
  voiceSnapshot,
  scriptText,
  onScriptTextChange,
  onUploadRecordedVoice,
  onClearRecordedVoice,
  onStartMicRecording,
  onStopMicRecording,
  onUploadBgm,
  onClearBgm,
  onUpdateMixSettings,
  onOpenApiKeyModal,
  videoName,
  videoUrl = '',
  sourceVideoElRef,
  displayCanvasRef,
  videoPreviewReadyTick = 0,
  isSourceVideoPlaying = false,
  onToggleSourceVideoPlay,
  panX = 0,
  panY = 0,
  videoDuration,
  videoWidth,
  videoHeight,
  startTrim,
  endTrim,
  zoomLevel,
  onUploadVideo,
  onClearVideo,
  onUpdateStartTrim,
  onUpdateEndTrim,
  onUpdateZoomLevel,
  targetVideoDurationSec,
  autoDurationSec,
  exportResolution,
  onUpdateExportResolution,
  exportFps,
  onUpdateExportFps,
  performanceMode,
  onUpdatePerformanceMode,
  isManualFinalDuration,
  onChangeFinalDurationSec,
  onResetFinalDurationAuto,
  onAdaptScriptToFinalDuration,
  isAdaptingScript = false,
  estimatedShotsCount,
  masterAudioUrl,
  masterAudioDuration,
  masterAudioName,
  isMixingPreviewAudio = false,
  onMixPreviewAudio,
  preferredVoiceSource,
  onChangePreferredVoiceSource,
  forceRegenerateVoice,
  onToggleForceRegenerateVoice,
  isAgentRunning,
  agentSteps,
  agentError,
  agentSuccessMessage,
  onStartAutonomousPipeline,
  onCancelAutonomousPipeline,
  lastExportedVideo,
  onDownloadLastExported,
  onOpenVideoTab,
  isIntroPanelOpen,
  onToggleIntroPanel,
  hasAttachedIntro,
  attachedIntroDuration,
  onRemoveAttachedIntro,
}: AutoAgentPanelProps) {
  const voiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgmFileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceVideoInputRef = useRef<HTMLInputElement | null>(null);
  const channelDropdownRef = useRef<HTMLDivElement | null>(null);
  const watermarkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dramaSelectRef = useRef<HTMLSelectElement | null>(null);
  const episodeInputRef = useRef<HTMLInputElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const channelNameInputRef = useRef<HTMLInputElement | null>(null);
  const scriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const homepageAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [showMissingHighlights, setShowMissingHighlights] = useState(false);
  const [isPreFlightModalOpen, setIsPreFlightModalOpen] = useState(false);
  const [hpAudioPlaying, setHpAudioPlaying] = useState(false);
  const [hpAudioTime, setHpAudioTime] = useState(0);
  const [hpAudioDuration, setHpAudioDuration] = useState(0);
  const [hpAudioMuted, setHpAudioMuted] = useState(false);
  const [hpAudioVolume, setHpAudioVolume] = useState(0.9);
  const [hpAudioSpeed, setHpAudioSpeed] = useState(1.0);
  const [hpMixError, setHpMixError] = useState<string | null>(null);
  const [showExportVideoPreview, setShowExportVideoPreview] = useState<boolean>(false);
  const durationHoldTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setShowExportVideoPreview(false);
  }, [lastExportedVideo?.url]);

  const stopDurationHold = () => {
    if (durationHoldTimerRef.current !== null) {
      window.clearInterval(durationHoldTimerRef.current);
      durationHoldTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (durationHoldTimerRef.current !== null) {
        window.clearInterval(durationHoldTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isChannelMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node)) {
        setIsChannelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isChannelMenuOpen]);

  useEffect(() => {
    setHpAudioPlaying(false);
    setHpAudioTime(0);
    setHpAudioDuration(masterAudioDuration > 0 ? masterAudioDuration : 0);
    setHpMixError(null);
    if (homepageAudioRef.current) {
      homepageAudioRef.current.pause();
      homepageAudioRef.current.currentTime = 0;
    }
  }, [masterAudioUrl, masterAudioDuration]);

  useEffect(() => {
    if (isAgentRunning && homepageAudioRef.current && !homepageAudioRef.current.paused) {
      homepageAudioRef.current.pause();
      setHpAudioPlaying(false);
    }
  }, [isAgentRunning]);

  useEffect(() => {
    if (homepageAudioRef.current) {
      homepageAudioRef.current.volume = hpAudioMuted ? 0 : hpAudioVolume;
      homepageAudioRef.current.muted = hpAudioMuted;
      homepageAudioRef.current.playbackRate = hpAudioSpeed;
    }
  }, [hpAudioMuted, hpAudioVolume, hpAudioSpeed, masterAudioUrl]);

  const activeChannelProfile = useMemo(
    () =>
      TEN_CHANNEL_VOICE_PROFILES.find((p) => p.channelSlot === activeChannelSlot) ||
      TEN_CHANNEL_VOICE_PROFILES[0],
    [activeChannelSlot]
  );
  const activeCustomChannelName = savedChannels[activeChannelSlot - 1]?.trim() || '';
  const effectiveChannelName = channelSettings.name?.trim() || activeCustomChannelName;
  const activeStyleInfo = useMemo(
    () => CHANNEL_STYLES.find((s) => s.id === channelSettings.styleId) || CHANNEL_STYLES[0],
    [channelSettings.styleId]
  );

  // Live animated canvas preview of zoomed source video + selected channel name & floating watermark
  // Pauses automatically when scrolled out of view or when user is typing in an input/textarea on mobile
  useEffect(() => {
    const canvas = watermarkCanvasRef.current;
    if (!canvas) return;
    let animId = 0;
    let lastDraw = 0;
    let isInViewport = true;
    const startTs = performance.now();

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          isInViewport = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0.05 }
      );
      observer.observe(canvas);
    }

    const drawSingleFrame = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const videoEl = sourceVideoElRef?.current;
      const hasLoadedSourceVideo =
        Boolean(videoUrl) &&
        Boolean(videoEl) &&
        (videoEl?.readyState ?? 0) >= 2 &&
        (videoEl?.videoWidth ?? 0) > 0;

      if (hasLoadedSourceVideo && videoEl) {
        const vWidth = videoEl.videoWidth || 1280;
        const vHeight = videoEl.videoHeight || 720;
        const safeZoom = Math.max(1.0, zoomLevel || 1.0);
        const cropWidth = vWidth / safeZoom;
        const cropHeight = vHeight / safeZoom;
        const centerX = vWidth / 2 + ((panX || 0) / 50) * ((vWidth - cropWidth) / 2);
        const centerY = vHeight / 2 + ((panY || 0) / 50) * ((vHeight - cropHeight) / 2);
        const sx = Math.max(0, Math.min(vWidth - cropWidth, centerX - cropWidth / 2));
        const sy = Math.max(0, Math.min(vHeight - cropHeight, centerY - cropHeight / 2));

        ctx.fillStyle = '#070e1c';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(videoEl, sx, sy, cropWidth, cropHeight, 0, 0, w, h);

        if (effectiveChannelName) {
          const elapsed = (now - startTs) / 1000;
          ChannelOverlayRenderer.renderOverlay(
            canvas,
            {
              ...channelSettings,
              name: effectiveChannelName,
              ctaEnabled: false,
            },
            elapsed + 1.5
          );
        }
        return;
      }

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#020617');
      bg.addColorStop(0.5, '#0f172a');
      bg.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < w; gx += 64) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }

      if (effectiveChannelName) {
        if (channelSettings.channelNameEnabled === false && channelSettings.watermarkEnabled === false) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
          ctx.font = '600 16px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Channel Name & Watermark OFF', w / 2, h / 2);
        } else {
          const elapsed = (now - startTs) / 1000;
          ChannelOverlayRenderer.renderOverlay(
            canvas,
            {
              ...channelSettings,
              name: effectiveChannelName,
              ctaEnabled: false,
            },
            elapsed + 1.5
          );
        }
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.font = '600 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Channel Name', w / 2, h / 2);
      }
    };

    const hasAnimatedOverlay =
      Boolean(effectiveChannelName) &&
      (channelSettings.channelNameEnabled !== false || channelSettings.watermarkEnabled !== false);

    // Draw once immediately
    drawSingleFrame(performance.now());

    // Skip rAF loop if pipeline is running or nothing needs continuous animation
    if (isAgentRunning || (!isSourceVideoPlaying && !hasAnimatedOverlay)) {
      return () => {
        observer?.disconnect();
      };
    }

    const perfFlags = getRenderPerformanceFlags();
    const frameInterval = isSourceVideoPlaying
      ? perfFlags.isMobileFast
        ? 45
        : 33
      : perfFlags.isMobileFast
      ? 140
      : 80;

    const drawFrame = (now: number) => {
      if (typeof document !== 'undefined') {
        const activeTag = document.activeElement?.tagName;
        const isTyping = activeTag === 'TEXTAREA' || activeTag === 'INPUT';
        if (document.hidden || !isInViewport || (isTyping && !isSourceVideoPlaying)) {
          animId = requestAnimationFrame(drawFrame);
          return;
        }
      }
      if (now - lastDraw >= frameInterval) {
        lastDraw = now;
        drawSingleFrame(now);
      }
      animId = requestAnimationFrame(drawFrame);
    };

    animId = requestAnimationFrame(drawFrame);
    return () => {
      if (animId) cancelAnimationFrame(animId);
      observer?.disconnect();
    };
  }, [
    channelSettings,
    effectiveChannelName,
    isAgentRunning,
    videoUrl,
    sourceVideoElRef,
    zoomLevel,
    panX,
    panY,
    videoPreviewReadyTick,
    isSourceVideoPlaying,
    performanceMode,
  ]);

  const activeSeriesList = useMemo(
    () => seriesList.filter((s) => s.status === 'active'),
    [seriesList]
  );

  const hasRecordedVoice = Boolean(voiceSnapshot?.hasRecordedVoice);
  const hasScript = scriptText.trim().length > 0;
  const effectiveSourceMode: 'recorded' | 'script' =
    preferredVoiceSource === 'recorded'
      ? 'recorded'
      : preferredVoiceSource === 'script'
      ? 'script'
      : hasRecordedVoice
      ? 'recorded'
      : 'script';

  const voiceReady =
    effectiveSourceMode === 'recorded' ? hasRecordedVoice : hasScript;
  const hasBgm = Boolean(voiceSnapshot?.hasBgm);
  const hasVideo = Boolean(videoName);

  const missingFieldState = useMemo(() => {
    const missingDrama = !activeSeries;
    const missingEpisode = !(activeSeries?.currentEpisode ?? '').trim();
    const missingDate = !releaseDate;
    const missingChannelName = !effectiveChannelName;
    const missingBgm = !hasBgm;
    const missingVideo = !hasVideo;
    const missingVoiceOrScript = !voiceReady;

    return {
      drama: missingDrama,
      episode: missingEpisode,
      date: missingDate,
      channel_name: missingChannelName,
      bgm: missingBgm,
      video: missingVideo,
      voice_or_script: missingVoiceOrScript,
    };
  }, [activeSeries, releaseDate, effectiveChannelName, hasBgm, hasVideo, voiceReady]);

  const missingItemsList = useMemo(() => {
    const items: Array<{
      key: 'video' | 'voice_or_script' | 'drama' | 'episode' | 'date' | 'channel_name' | 'bgm';
      titleBn: string;
      descBn: string;
      required: boolean;
    }> = [];

    if (missingFieldState.video) {
      items.push({
        key: 'video',
        titleBn: 'আপলোড করা ভিডিও (Source Video)',
        descBn: 'স্ক্রিনশট নেওয়ার জন্য মূল ভিডিও ফাইল এখনো আপলোড করা হয়নি।',
        required: true,
      });
    }
    if (missingFieldState.voice_or_script) {
      items.push({
        key: 'voice_or_script',
        titleBn:
          effectiveSourceMode === 'recorded'
            ? 'ভয়েস অডিও (Recorded Voice)'
            : 'ভিডিও স্ক্রিপ্ট (AI Script)',
        descBn:
          effectiveSourceMode === 'recorded'
            ? 'রেকর্ড করা বা আপলোড করা ভয়েস অডিও এখনো দেওয়া হয়নি।'
            : 'এআই ভয়েস তৈরির জন্য স্ক্রিপ্ট এখনো লেখা হয়নি (অথবা রেকর্ড করা ভয়েস দিন)।',
        required: true,
      });
    }
    if (missingFieldState.drama) {
      items.push({
        key: 'drama',
        titleBn: 'নাটকের নাম (Drama)',
        descBn: 'কোনো নাটক/সিরিয়াল এখনো সিলেক্ট করা হয়নি।',
        required: false,
      });
    }
    if (missingFieldState.episode) {
      items.push({
        key: 'episode',
        titleBn: 'পর্ব সংখ্যা (Episode)',
        descBn: 'পর্ব নম্বর (Episode) এখনো দেওয়া হয়নি।',
        required: false,
      });
    }
    if (missingFieldState.date) {
      items.push({
        key: 'date',
        titleBn: 'রিলিজ ডেট (Date)',
        descBn: 'রিলিজের তারিখ এখনো সিলেক্ট করা হয়নি।',
        required: false,
      });
    }
    if (missingFieldState.channel_name) {
      items.push({
        key: 'channel_name',
        titleBn: 'চ্যানেলের নাম (Channel Name)',
        descBn: 'ওয়াটারমার্ক ও চ্যানেল পরিচয়ের জন্য চ্যানেলের নাম এখনো লেখা হয়নি।',
        required: false,
      });
    }
    if (missingFieldState.bgm) {
      items.push({
        key: 'bgm',
        titleBn: 'ব্যাকগ্রাউন্ড মিউজিক (BGM)',
        descBn: 'ব্যাকগ্রাউন্ড মিউজিক এখনো যুক্ত করা হয়নি (না দিলে শুধু ভয়েস ব্যবহার হবে)।',
        required: false,
      });
    }

    return items;
  }, [missingFieldState, effectiveSourceMode]);

  const hasRequiredMissing = missingFieldState.video || missingFieldState.voice_or_script;

  const focusFieldForMissingKey = (
    key: 'video' | 'voice_or_script' | 'drama' | 'episode' | 'date' | 'channel_name' | 'bgm',
    subAction?: 'upload_voice' | 'write_script'
  ) => {
    setShowMissingHighlights(true);
    setIsPreFlightModalOpen(false);

    setTimeout(() => {
      if (key === 'video') {
        sourceVideoInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sourceVideoInputRef.current?.click();
        return;
      }
      if (key === 'bgm') {
        bgmFileInputRef.current?.click();
        return;
      }
      if (key === 'voice_or_script') {
        if (subAction === 'upload_voice') {
          onChangePreferredVoiceSource('recorded');
          setTimeout(() => voiceFileInputRef.current?.click(), 50);
        } else {
          onChangePreferredVoiceSource('script');
          setTimeout(() => {
            scriptTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            scriptTextareaRef.current?.focus();
          }, 80);
        }
        return;
      }
      if (key === 'drama') {
        dramaSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dramaSelectRef.current?.focus();
        return;
      }
      if (key === 'episode') {
        if (!activeSeries) {
          dramaSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dramaSelectRef.current?.focus();
        } else {
          episodeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          episodeInputRef.current?.focus();
        }
        return;
      }
      if (key === 'date') {
        dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dateInputRef.current?.focus();
        return;
      }
      if (key === 'channel_name') {
        channelNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        channelNameInputRef.current?.focus();
      }
    }, 60);
  };

  const handleGenerateClick = () => {
    if (isAgentRunning) return;
    if (missingItemsList.length > 0) {
      setShowMissingHighlights(true);
      setIsPreFlightModalOpen(true);
      return;
    }
    setShowMissingHighlights(false);
    setIsPreFlightModalOpen(false);
    onStartAutonomousPipeline();
  };

  const handleDismissAndMaybeStart = () => {
    setIsPreFlightModalOpen(false);
    if (!hasRequiredMissing) {
      setShowMissingHighlights(false);
      onStartAutonomousPipeline();
    }
  };

  const formatTwoDigits = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
  const startMin = Math.floor(Math.max(0, startTrim) / 60);
  const startSec = Math.floor(Math.max(0, startTrim) % 60);
  const endMin = Math.floor(Math.max(0, endTrim) / 60);
  const endSec = Math.floor(Math.max(0, endTrim) % 60);

  const roundedFinalDurationSec = Math.max(0, Math.round(targetVideoDurationSec));
  const finalMin = Math.floor(roundedFinalDurationSec / 60);
  const finalSec = roundedFinalDurationSec % 60;

  const finalSecRef = useRef(roundedFinalDurationSec);
  finalSecRef.current = roundedFinalDurationSec;

  const stepFinalDuration = (deltaSec: number) => {
    const next = Math.max(0, Math.min(3600, finalSecRef.current + deltaSec));
    onChangeFinalDurationSec(next);
  };

  const startDurationHold = (deltaSec: number) => {
    if (isAgentRunning) return;
    stepFinalDuration(deltaSec);
    stopDurationHold();
    const startTs = Date.now();
    durationHoldTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTs;
      const mul = elapsed > 1200 ? 2 : 1;
      stepFinalDuration(deltaSec * mul);
    }, 150);
  };

  const effectiveHpDuration =
    hpAudioDuration > 0
      ? hpAudioDuration
      : masterAudioDuration > 0
      ? masterAudioDuration
      : 0;

  const toggleHpAudioPlay = () => {
    const audio = homepageAudioRef.current;
    if (!audio || !masterAudioUrl) return;
    if (audio.paused) {
      audio.play().then(() => setHpAudioPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setHpAudioPlaying(false);
    }
  };

  const seekHpAudio = (nextTime: number) => {
    const audio = homepageAudioRef.current;
    const dur = effectiveHpDuration || audio?.duration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(dur, nextTime) : 0);
    setHpAudioTime(clamped);
    if (audio) {
      audio.currentTime = clamped;
    }
  };

  const stopHpAudio = () => {
    const audio = homepageAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setHpAudioPlaying(false);
    setHpAudioTime(0);
  };

  const handleMixPreviewClick = async () => {
    if (!onMixPreviewAudio || isMixingPreviewAudio || isAgentRunning) return;
    setHpMixError(null);
    try {
      await onMixPreviewAudio();
    } catch (err: any) {
      setHpMixError(err?.message || 'অডিও মিক্সিং করতে সমস্যা হয়েছে।');
    }
  };

  const { full: formattedReleaseDateEn, short: formattedReleaseDateShortEn } = useMemo(() => {
    if (!releaseDate) return { full: '', short: '' };
    const [y, m, d] = releaseDate.split('-').map(Number);
    if (!y || !m || !d) return { full: '', short: '' };
    const dt = new Date(y, m - 1, d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      full: `${d} ${months[dt.getMonth()]}, ${daysFull[dt.getDay()]}`,
      short: `${d} ${months[dt.getMonth()]}, ${daysShort[dt.getDay()]}`
    };
  }, [releaseDate]);

  return (
    <div className="w-full flex flex-col gap-4 pb-10">
      {/* Hidden File Inputs */}
      <input
        ref={voiceFileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onChangePreferredVoiceSource('recorded');
            onUploadRecordedVoice(file);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={bgmFileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadBgm(file);
          e.target.value = '';
        }}
      />
      <input
        ref={sourceVideoInputRef}
        type="file"
        accept="video/*,.mp4,.mkv,.mov,.webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadVideo(file);
          e.target.value = '';
        }}
      />

      {/* LUMINOUS MATERIAL DESIGN 3 ANDROID PRODUCTION STUDIO */}
      <div className="grid grid-cols-1 gap-3.5">
        <section className="bg-white text-slate-900 border border-indigo-100/90 rounded-3xl overflow-hidden shadow-[0_8px_28px_rgba(30,58,138,0.08)] divide-y divide-slate-100">
          {/* Top Cinema Watermark / Zoomed Video / Live Render Monitor Showcase */}
          <div className="px-3 py-3.5 sm:px-4 sm:py-4 bg-gradient-to-b from-indigo-50/70 to-slate-50/70 flex flex-col items-center justify-center gap-2">
            <div className="w-full sm:w-[420px] md:w-[480px] lg:w-[540px] aspect-video bg-[#070e1c] border border-slate-900/15 shadow-lg rounded-none overflow-hidden shrink-0 ring-1 ring-indigo-500/15">
              <canvas
                ref={(el) => {
                  watermarkCanvasRef.current = el;
                  if (displayCanvasRef) {
                    (displayCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
                  }
                }}
                width={640}
                height={360}
                onClick={() => {
                  if (!isAgentRunning && videoUrl && onToggleSourceVideoPlay) {
                    onToggleSourceVideoPlay();
                  }
                }}
                title={!isAgentRunning && videoUrl ? (isSourceVideoPlaying ? 'Pause Video Preview' : 'Play Video Preview') : undefined}
                className={`w-full h-full block rounded-none ${!isAgentRunning && videoUrl ? 'cursor-pointer' : ''}`}
              />
            </div>

            {isAgentRunning ? (
              (() => {
                const runningStep = agentSteps.find((s) => s.status === 'running');
                return (
                  <div className="w-full sm:w-[420px] md:w-[480px] lg:w-[540px] flex items-center justify-between gap-2 bg-white border border-indigo-200 rounded-2xl px-2.5 py-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                      <span className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                        {runningStep?.detail || runningStep?.label || 'প্রসেসিং চলছে...'}
                      </span>
                      {runningStep && (
                        <span className="text-[11px] font-mono font-bold text-indigo-600 shrink-0 tabular-nums">
                          {Math.round(runningStep.percent)}%
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onCancelAutonomousPipeline}
                      className="h-8 sm:h-9 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                      <StopCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Cancel</span>
                    </button>
                  </div>
                );
              })()
            ) : videoUrl ? (
              <div className="w-full sm:w-[420px] md:w-[480px] lg:w-[540px] flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600 truncate">
                  Zoom Preview · {Math.round(zoomLevel * 100)}%
                </span>
                {onToggleSourceVideoPlay && (
                  <button
                    type="button"
                    onClick={onToggleSourceVideoPlay}
                    className="h-8 sm:h-9 px-3 rounded-xl sm:rounded-2xl bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    {isSourceVideoPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 shrink-0" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                        <span>Play</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Row 1: Release Date (Always Single Line: Left Input, Right Formatted Date + Clear) */}
          <div
            className={`bg-white flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] transition-colors ${
              showMissingHighlights && missingFieldState.date
                ? 'bg-amber-50 ring-1 ring-inset ring-amber-400'
                : ''
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 shrink-0">Date</span>
              <input
                ref={dateInputRef}
                type="date"
                disabled={isAgentRunning}
                value={releaseDate}
                onChange={(e) => onUpdateReleaseDate(e.target.value)}
                className="w-[108px] sm:w-[140px] min-w-0 h-8 sm:h-9 bg-sky-50 border border-sky-200 focus:border-blue-500 rounded-xl sm:rounded-2xl px-1.5 sm:px-2.5 text-sky-900 text-[10px] sm:text-xs font-bold focus:outline-none cursor-pointer transition-colors"
              />
            </div>
            <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-0 flex-1 overflow-hidden">
              {showMissingHighlights && missingFieldState.date && (
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 shrink-0 whitespace-nowrap">
                  · Empty
                </span>
              )}
              {formattedReleaseDateEn && (
                <span className="text-[10px] sm:text-xs font-bold text-blue-700 truncate min-w-0 text-right">
                  <span className="sm:hidden">{formattedReleaseDateShortEn}</span>
                  <span className="hidden sm:inline">{formattedReleaseDateEn}</span>
                </span>
              )}
              {releaseDate && (
                <button
                  type="button"
                  disabled={isAgentRunning}
                  onClick={() => onUpdateReleaseDate('')}
                  title="Clear Date"
                  aria-label="Clear Date"
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Drama Selector + Show Drama/Episode Text ON/OFF (Single Line) */}
          <div
            className={`bg-[#f9fbff] flex flex-nowrap items-center justify-between gap-2 px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] transition-colors ${
              showMissingHighlights && missingFieldState.drama
                ? 'bg-amber-50 ring-1 ring-inset ring-amber-400'
                : ''
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">
                Drama
              </span>
              <select
                ref={dramaSelectRef}
                value={activeSeries?.id || '__none__'}
                disabled={isAgentRunning}
                onChange={(e) => onSelectSeriesById(e.target.value)}
                className="flex-1 min-w-0 h-8 sm:h-9 bg-amber-50/70 border border-amber-200 focus:border-amber-500 rounded-xl sm:rounded-2xl px-2 sm:px-2.5 text-slate-900 text-xs font-bold focus:outline-none cursor-pointer truncate transition-colors"
              >
                <option value="__none__" className="bg-white text-slate-500">
                  -- None --
                </option>
                {activeSeriesList.map((s) => (
                  <option key={s.id} value={s.id} className="bg-white text-slate-900">
                    {s.title}
                  </option>
                ))}
              </select>
              {showMissingHighlights && missingFieldState.drama && (
                <span className="text-[10px] font-bold text-amber-700 shrink-0">· Empty</span>
              )}
            </div>

            <button
              type="button"
              disabled={isAgentRunning}
              onClick={onToggleLowerThird}
              title="Show or hide Drama Name & Episode on video"
              aria-label="Toggle Drama Name & Episode on Video"
              className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 disabled:opacity-60 ${
                showLowerThird
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 border border-slate-300 text-slate-600'
              }`}
            >
              {showLowerThird ? (
                <Eye className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{showLowerThird ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Row 3: Episode Stepper (Single Line) */}
          <div
            className={`bg-white flex flex-nowrap items-center justify-between gap-2 px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] transition-colors ${
              showMissingHighlights && missingFieldState.episode
                ? 'bg-amber-50 ring-1 ring-inset ring-amber-400'
                : ''
            }`}
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 whitespace-nowrap">
                Episode
              </span>
              {showMissingHighlights && missingFieldState.episode && (
                <span className="text-[10px] font-bold text-amber-700">· Empty</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
              <button
                type="button"
                disabled={isAgentRunning || !activeSeries}
                onClick={() => {
                  const raw = String(activeSeries?.currentEpisode ?? '').trim();
                  const bnToEn: Record<string, string> = {
                    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
                    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
                  };
                  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
                  const normalized = raw.replace(/[০-৯]/g, (d) => bnToEn[d] ?? d);
                  const match = normalized.match(/\d+/);
                  if (!match) {
                    onUpdateActiveEpisode('1');
                    return;
                  }
                  const nextNum = Math.max(1, parseInt(match[0], 10) - 1);
                  const hasBengali = /[০-৯]/.test(raw);
                  const formatted = hasBengali
                    ? String(nextNum).replace(/[0-9]/g, (d) => bnDigits[Number(d)] ?? d)
                    : String(nextNum);
                  onUpdateActiveEpisode(
                    hasBengali ? normalized.replace(match[0], formatted) : raw.replace(/\d+/, formatted)
                  );
                }}
                title="Decrease Episode"
                aria-label="Decrease Episode"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                ref={episodeInputRef}
                type="text"
                disabled={isAgentRunning}
                value={activeSeries?.currentEpisode ?? ''}
                onChange={(e) => onUpdateActiveEpisode(e.target.value)}
                placeholder="13"
                className="w-16 sm:w-20 h-8 sm:h-9 text-center bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold focus:outline-none focus:border-blue-500 rounded-xl sm:rounded-2xl"
              />
              <button
                type="button"
                disabled={isAgentRunning || !activeSeries}
                onClick={() => {
                  const raw = String(activeSeries?.currentEpisode ?? '').trim();
                  const bnToEn: Record<string, string> = {
                    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
                    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
                  };
                  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
                  const normalized = raw.replace(/[০-৯]/g, (d) => bnToEn[d] ?? d);
                  const match = normalized.match(/\d+/);
                  if (!match) {
                    onUpdateActiveEpisode('1');
                    return;
                  }
                  const nextNum = Math.max(1, parseInt(match[0], 10) + 1);
                  const hasBengali = /[০-৯]/.test(raw);
                  const formatted = hasBengali
                    ? String(nextNum).replace(/[0-9]/g, (d) => bnDigits[Number(d)] ?? d)
                    : String(nextNum);
                  onUpdateActiveEpisode(
                    hasBengali ? normalized.replace(match[0], formatted) : raw.replace(/\d+/, formatted)
                  );
                }}
                title="Increase Episode"
                aria-label="Increase Episode"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 4: Channel Selector + Show Channel Name on Video ON/OFF (Single Line) */}
          <div
            ref={channelDropdownRef}
            className="relative bg-[#f9fbff] px-2.5 sm:px-3 py-2 flex flex-nowrap items-center justify-between gap-2 min-h-[48px] sm:min-h-[54px]"
          >
            <button
              type="button"
              disabled={isAgentRunning}
              onClick={() => setIsChannelMenuOpen((v) => !v)}
              className="flex-1 min-w-0 h-8 sm:h-9 flex items-center justify-between gap-1.5 rounded-xl sm:rounded-2xl border border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 sm:px-3 text-xs font-bold text-indigo-900 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Tv className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">
                  CH {activeChannelSlot}
                  {effectiveChannelName ? ` · ${effectiveChannelName}` : ''}
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-indigo-600 shrink-0 transition-transform ${
                  isChannelMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <button
              type="button"
              disabled={isAgentRunning}
              onClick={onToggleChannelNameQuick}
              title="Show or hide Channel Name on video"
              aria-label="Toggle Channel Name on Video"
              className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 disabled:opacity-60 ${
                channelSettings.channelNameEnabled !== false
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 border border-slate-300 text-slate-600'
              }`}
            >
              {channelSettings.channelNameEnabled !== false ? (
                <Eye className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{channelSettings.channelNameEnabled !== false ? 'ON' : 'OFF'}</span>
            </button>

            {isChannelMenuOpen && (
              <div className="absolute left-2.5 right-2.5 top-full mt-1.5 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 divide-y divide-slate-100">
                {TEN_CHANNEL_VOICE_PROFILES.map((profile) => {
                  const isActive = activeChannelSlot === profile.channelSlot;
                  const customChName = savedChannels[profile.channelSlot - 1]?.trim();
                  return (
                    <button
                      key={profile.channelSlot}
                      type="button"
                      onClick={() => {
                        onSelectChannelSlot(profile.channelSlot);
                        setIsChannelMenuOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-3 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">
                        CH {profile.channelSlot}
                        {customChName ? ` · ${customChName}` : ''}
                      </span>
                      <span
                        className={`text-[10px] font-mono shrink-0 ${
                          isActive ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {profile.voiceId} ({profile.gender === 'female' ? 'F' : 'M'})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Row 5: Video Additions (Subtitles, Video Effects, Subscribe CTA — each 1 line with opposite ON/OFF) */}
          <div className="bg-white divide-y divide-slate-100">
            {/* Subtitles Toggle */}
            <div className="px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] flex flex-nowrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Captions className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate">
                  Subtitles
                </span>
              </div>
              <button
                type="button"
                disabled={isAgentRunning}
                onClick={onToggleSubtitles}
                title="Show or hide Subtitles on video"
                aria-label="Toggle Subtitles on Video"
                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 disabled:opacity-60 ${
                  showSubtitles
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 border border-slate-300 text-slate-600'
                }`}
              >
                {showSubtitles ? (
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{showSubtitles ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Video Effects Toggle */}
            <div className="bg-[#f9fbff] px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] flex flex-nowrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600 shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate">
                  Video Effects
                </span>
              </div>
              <button
                type="button"
                disabled={isAgentRunning}
                onClick={onToggleEffects}
                title="Enable or disable visual effects on video"
                aria-label="Toggle Video Effects"
                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 disabled:opacity-60 ${
                  effectsEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 border border-slate-300 text-slate-600'
                }`}
              >
                {effectsEnabled ? (
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{effectsEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Subscribe CTA Toggle */}
            <div className="px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] flex flex-nowrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate">
                  Subscribe CTA
                </span>
              </div>
              <button
                type="button"
                disabled={isAgentRunning}
                onClick={onToggleCtaQuick}
                title="Show or hide Subscribe & Like CTA popup on video"
                aria-label="Toggle Subscribe CTA on Video"
                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 disabled:opacity-60 ${
                  channelSettings.ctaEnabled !== false
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 border border-slate-300 text-slate-600'
                }`}
              >
                {channelSettings.ctaEnabled !== false ? (
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{channelSettings.ctaEnabled !== false ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* Row 6: Source Video Upload (Single Line) */}
          <div
            className={`bg-white px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] flex flex-nowrap items-center gap-1.5 min-w-0 transition-colors ${
              showMissingHighlights && missingFieldState.video
                ? 'bg-rose-50 ring-1 ring-inset ring-rose-400'
                : ''
            }`}
          >
            <button
              type="button"
              disabled={isAgentRunning}
              onClick={() => sourceVideoInputRef.current?.click()}
              className={`flex-1 min-w-0 h-8 sm:h-9 rounded-xl sm:rounded-2xl text-white text-xs font-bold px-2.5 sm:px-3 flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60 truncate shadow-sm ${
                showMissingHighlights && missingFieldState.video
                  ? 'bg-rose-600 hover:bg-rose-500 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              <VideoIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {hasVideo ? `${videoName} (${formatMMSS(videoDuration)})` : 'Upload Video'}
              </span>
            </button>
            {hasVideo && (
              <button
                type="button"
                disabled={isAgentRunning}
                onClick={onClearVideo}
                title="Remove Video"
                aria-label="Remove Video"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl border border-rose-200 hover:border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>

          {/* Row 4: Zoom Control */}
          <div className="bg-[#f9fbff] px-2.5 sm:px-3 py-2 min-h-[48px] sm:min-h-[54px] flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 shrink-0">Zoom Crop Level</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isAgentRunning || zoomLevel <= 1.0}
                onClick={() =>
                  onUpdateZoomLevel(Math.max(1.0, Math.round((zoomLevel - 0.1) * 10) / 10))
                }
                title="Zoom Out"
                aria-label="Zoom Out"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 font-bold transition-all active:scale-95"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-14 sm:w-16 h-8 sm:h-9 flex items-center justify-center font-mono text-xs font-extrabold text-blue-700 bg-sky-50 border border-sky-200 rounded-xl sm:rounded-2xl tabular-nums">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                disabled={isAgentRunning || zoomLevel >= 2.5}
                onClick={() =>
                  onUpdateZoomLevel(Math.min(2.5, Math.round((zoomLevel + 0.1) * 10) / 10))
                }
                title="Zoom In"
                aria-label="Zoom In"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-xs flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 font-bold transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 5: Start Trim & End Trim Side-by-Side (Always 2 Columns) */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 bg-white">
            {/* Start Trim */}
            <div className="px-2.5 sm:px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 min-w-0">
              <span className="text-[11px] font-bold text-amber-700 shrink-0">Start Trim</span>
              <div className="flex items-center justify-between lg:justify-end gap-1">
                <button
                  type="button"
                  disabled={isAgentRunning}
                  onClick={() => onUpdateStartTrim(Math.max(0, Math.round(startTrim) - 10))}
                  title="Decrease 10s"
                  aria-label="Decrease Start Trim"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 transition-all active:scale-95"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-0.5 font-mono text-xs font-bold text-slate-900 tabular-nums">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    disabled={isAgentRunning}
                    value={formatTwoDigits(startMin)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const m = Math.max(0, parseInt(clean || '0', 10) || 0);
                      onUpdateStartTrim(m * 60 + startSec);
                    }}
                    aria-label="Start Trim Minutes"
                    className="w-8 sm:w-9 h-8 sm:h-9 text-center bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500">m</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    disabled={isAgentRunning}
                    value={formatTwoDigits(startSec)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const s = Math.max(0, Math.min(59, parseInt(clean || '0', 10) || 0));
                      onUpdateStartTrim(startMin * 60 + s);
                    }}
                    aria-label="Start Trim Seconds"
                    className="w-8 sm:w-9 h-8 sm:h-9 text-center bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500">s</span>
                </div>
                <button
                  type="button"
                  disabled={isAgentRunning}
                  onClick={() => onUpdateStartTrim(Math.round(startTrim) + 10)}
                  title="Increase 10s"
                  aria-label="Increase Start Trim"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 transition-all active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* End Trim */}
            <div className="px-2.5 sm:px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 min-w-0">
              <span className="text-[11px] font-bold text-rose-700 shrink-0">End Trim</span>
              <div className="flex items-center justify-between lg:justify-end gap-1">
                <button
                  type="button"
                  disabled={isAgentRunning}
                  onClick={() => onUpdateEndTrim(Math.max(0, Math.round(endTrim) - 10))}
                  title="Decrease 10s"
                  aria-label="Decrease End Trim"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 transition-all active:scale-95"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-0.5 font-mono text-xs font-bold text-slate-900 tabular-nums">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    disabled={isAgentRunning}
                    value={formatTwoDigits(endMin)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const m = Math.max(0, parseInt(clean || '0', 10) || 0);
                      onUpdateEndTrim(m * 60 + endSec);
                    }}
                    aria-label="End Trim Minutes"
                    className="w-8 sm:w-9 h-8 sm:h-9 text-center bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-500">m</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    disabled={isAgentRunning}
                    value={formatTwoDigits(endSec)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      const s = Math.max(0, Math.min(59, parseInt(clean || '0', 10) || 0));
                      onUpdateEndTrim(endMin * 60 + s);
                    }}
                    aria-label="End Trim Seconds"
                    className="w-8 sm:w-9 h-8 sm:h-9 text-center bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-500">s</span>
                </div>
                <button
                  type="button"
                  disabled={isAgentRunning}
                  onClick={() => onUpdateEndTrim(Math.round(endTrim) + 10)}
                  title="Increase 10s"
                  aria-label="Increase End Trim"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 transition-all active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 6: Final Duration Bar */}
          <div className="px-2.5 sm:px-3 py-2 bg-emerald-50/50 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-900 shrink-0">Final Duration</span>
                {isManualFinalDuration && (
                  <span className="text-[11px] font-mono font-bold text-amber-700 truncate">
                    {autoDurationSec > 0
                      ? targetVideoDurationSec < autoDurationSec - 2
                        ? '· Condense'
                        : targetVideoDurationSec > autoDurationSec + 2
                          ? '· Expand'
                          : '· Custom'
                      : '· Custom'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isManualFinalDuration && effectiveSourceMode === 'script' && roundedFinalDurationSec >= 10 && onAdaptScriptToFinalDuration && (
                  <button
                    type="button"
                    disabled={isAgentRunning || isAdaptingScript}
                    onClick={() => onAdaptScriptToFinalDuration()}
                    title="নির্ধারিত মিনিট ও সেকেন্ড অনুযায়ী স্ক্রিপ্ট এখনই সাজিয়ে নিন"
                    className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95 shadow-xs"
                  >
                    <Sparkles className={`w-3 h-3 ${isAdaptingScript ? 'animate-spin' : ''}`} />
                    <span>{isAdaptingScript ? 'Fitting...' : 'Fit Script'}</span>
                  </button>
                )}
                {isManualFinalDuration && (
                  <button
                    type="button"
                    disabled={isAgentRunning}
                    onClick={onResetFinalDurationAuto}
                    title="স্ক্রিপ্ট বা অডিওর প্রাকৃতিক দৈর্ঘ্যে ফিরে যান"
                    className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Auto</span>
                  </button>
                )}
                <div
                  className="flex items-center gap-1 font-mono text-xs font-bold text-blue-700 tabular-nums"
                  title="Auto-calculated Screenshots synced to final duration"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{roundedFinalDurationSec > 0 ? `${estimatedShotsCount}p` : '0p'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Minutes Stepper */}
              <div className="flex items-center border border-emerald-200 bg-white rounded-xl sm:rounded-2xl overflow-hidden h-8 sm:h-9 shrink-0 shadow-2xs">
                <button
                  type="button"
                  disabled={isAgentRunning || roundedFinalDurationSec <= 0}
                  onMouseDown={() => startDurationHold(-60)}
                  onMouseUp={stopDurationHold}
                  onMouseLeave={stopDurationHold}
                  onTouchStart={() => startDurationHold(-60)}
                  onTouchEnd={stopDurationHold}
                  title="Decrease 1 Minute"
                  aria-label="Decrease Final Duration Minutes"
                  className="w-8 sm:w-9 h-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-r border-emerald-200 flex items-center justify-center cursor-pointer disabled:opacity-35 active:scale-95 transition-transform"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  disabled={isAgentRunning}
                  value={formatTwoDigits(finalMin)}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    const m = Math.min(60, Math.max(0, parseInt(clean || '0', 10) || 0));
                    onChangeFinalDurationSec(Math.min(3600, m * 60 + finalSec));
                  }}
                  aria-label="Final Duration Minutes"
                  className="w-8 sm:w-9 h-full text-center bg-transparent font-mono text-xs font-extrabold text-emerald-800 focus:outline-none focus:bg-emerald-50/50 tabular-nums"
                />
                <span className="text-[11px] font-mono text-slate-500 pr-2 select-none">m</span>
                <button
                  type="button"
                  disabled={isAgentRunning || roundedFinalDurationSec >= 3600}
                  onMouseDown={() => startDurationHold(60)}
                  onMouseUp={stopDurationHold}
                  onMouseLeave={stopDurationHold}
                  onTouchStart={() => startDurationHold(60)}
                  onTouchEnd={stopDurationHold}
                  title="Increase 1 Minute"
                  aria-label="Increase Final Duration Minutes"
                  className="w-8 sm:w-9 h-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-35 active:scale-95 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Seconds Stepper */}
              <div className="flex items-center border border-emerald-200 bg-white rounded-xl sm:rounded-2xl overflow-hidden h-8 sm:h-9 shrink-0 shadow-2xs">
                <button
                  type="button"
                  disabled={isAgentRunning || roundedFinalDurationSec <= 0}
                  onMouseDown={() => startDurationHold(-5)}
                  onMouseUp={stopDurationHold}
                  onMouseLeave={stopDurationHold}
                  onTouchStart={() => startDurationHold(-5)}
                  onTouchEnd={stopDurationHold}
                  title="Decrease 5 Seconds"
                  aria-label="Decrease Final Duration Seconds"
                  className="w-8 sm:w-9 h-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-r border-emerald-200 flex items-center justify-center cursor-pointer disabled:opacity-35 active:scale-95 transition-transform"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  disabled={isAgentRunning}
                  value={formatTwoDigits(finalSec)}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    const s = Math.min(59, Math.max(0, parseInt(clean || '0', 10) || 0));
                    onChangeFinalDurationSec(Math.min(3600, finalMin * 60 + s));
                  }}
                  aria-label="Final Duration Seconds"
                  className="w-8 sm:w-9 h-full text-center bg-transparent font-mono text-xs font-extrabold text-emerald-800 focus:outline-none focus:bg-emerald-50/50 tabular-nums"
                />
                <span className="text-[11px] font-mono text-slate-500 pr-2 select-none">s</span>
                <button
                  type="button"
                  disabled={isAgentRunning || roundedFinalDurationSec >= 3600}
                  onMouseDown={() => startDurationHold(5)}
                  onMouseUp={stopDurationHold}
                  onMouseLeave={stopDurationHold}
                  onTouchStart={() => startDurationHold(5)}
                  onTouchEnd={stopDurationHold}
                  title="Increase 5 Seconds"
                  aria-label="Increase Final Duration Seconds"
                  className="w-8 sm:w-9 h-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-35 active:scale-95 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-[11px] font-mono font-semibold text-emerald-800 truncate">
                {isManualFinalDuration
                  ? 'Exact Lock'
                  : voiceSnapshot?.masterMatchesCurrentSource
                    ? 'Exact Mixed'
                    : voiceReady
                      ? hasBgm && (voiceSnapshot?.breakCount || 0) > 0
                        ? `w/ ${voiceSnapshot?.breakCount} breaks`
                        : 'Auto Est.'
                      : 'Auto 00:00'}
              </span>
            </div>
          </div>

          {/* Row 7: Material 3 Segmented Voice Mode Switcher */}
          <div className="px-2.5 sm:px-3 py-2 bg-white">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 border border-slate-200/80 rounded-xl sm:rounded-2xl">
              <button
                type="button"
                disabled={isAgentRunning}
                onClick={() => onChangePreferredVoiceSource('recorded')}
                className={`h-8 sm:h-9 px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5 ${
                  effectiveSourceMode === 'recorded'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Mic className="w-3.5 h-3.5 shrink-0" />
                <span>Recorded Voice</span>
              </button>

              <button
                type="button"
                disabled={isAgentRunning}
                onClick={() => onChangePreferredVoiceSource('script')}
                className={`h-8 sm:h-9 px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5 ${
                  effectiveSourceMode === 'script'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>AI Script</span>
              </button>
            </div>
          </div>

          {/* Row 8: Voice Action Controls (Always 2 Columns Side-by-Side) */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 bg-[#f9fbff]">
            {effectiveSourceMode === 'recorded' ? (
              <>
                <div
                  className={`px-2.5 sm:px-3 py-2 flex items-center gap-1.5 min-w-0 transition-colors ${
                    showMissingHighlights && missingFieldState.voice_or_script
                      ? 'bg-rose-50 ring-1 ring-inset ring-rose-400'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    disabled={isAgentRunning}
                    onClick={() => voiceFileInputRef.current?.click()}
                    className={`flex-1 min-w-0 h-8 sm:h-9 rounded-xl sm:rounded-2xl text-white text-xs font-bold px-2.5 sm:px-3 flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60 truncate shadow-sm ${
                      showMissingHighlights && missingFieldState.voice_or_script
                        ? 'bg-rose-600 hover:bg-rose-500 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {hasRecordedVoice
                        ? `${voiceSnapshot?.recordedVoiceName || 'Voice'} (${formatMMSS(
                            voiceSnapshot?.recordedVoiceDuration || 0
                          )})`
                        : 'Upload Voice'}
                    </span>
                  </button>
                  {hasRecordedVoice && (
                    <button
                      type="button"
                      disabled={isAgentRunning}
                      onClick={onClearRecordedVoice}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl border border-rose-200 hover:border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
                      title="Remove Voice"
                      aria-label="Remove Voice"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>

                <div className="px-2.5 sm:px-3 py-2 flex items-center min-w-0">
                  {voiceSnapshot?.isRecordingMic ? (
                    <button
                      type="button"
                      onClick={onStopMicRecording}
                      className="w-full h-8 sm:h-9 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-2.5 sm:px-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 animate-pulse cursor-pointer shadow-sm active:scale-[0.97]"
                    >
                      <StopCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span>Stop ({formatMMSS(voiceSnapshot.recordingSeconds)})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isAgentRunning}
                      onClick={() => onStartMicRecording()}
                      className="w-full h-8 sm:h-9 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-2.5 sm:px-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60"
                    >
                      <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 shrink-0" />
                      <span>Record Mic</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="px-2.5 sm:px-3 py-2 flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-slate-700 shrink-0">Speed</span>
                  <select
                    value={voiceSnapshot?.speechSpeed ?? 1.0}
                    disabled={isAgentRunning}
                    onChange={(e) =>
                      onUpdateMixSettings({ speechSpeed: parseFloat(e.target.value) })
                    }
                    className="flex-1 min-w-0 h-8 sm:h-9 bg-white border border-slate-200 focus:border-blue-500 text-slate-900 rounded-xl sm:rounded-2xl px-2 sm:px-2.5 text-xs font-bold cursor-pointer"
                    title="Voice Speed"
                  >
                    <option value={0.9}>0.90x (Clear)</option>
                    <option value={0.95}>0.95x</option>
                    <option value={1.0}>1.0x (Normal)</option>
                    <option value={1.25}>1.25x</option>
                  </select>
                </div>

                <div className="px-2.5 sm:px-3 py-2 flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={onOpenApiKeyModal}
                    className="flex-1 min-w-0 h-8 sm:h-9 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.97]"
                    title="Gemini API Key"
                  >
                    <Key className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span className="truncate">API Key</span>
                  </button>
                  {voiceSnapshot?.hasPreparedAiVoice && (
                    <label
                      className="h-8 sm:h-9 px-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-1 text-[10px] text-emerald-800 font-bold cursor-pointer shrink-0"
                      title="Use Previously Generated Voice"
                    >
                      <input
                        type="checkbox"
                        checked={!forceRegenerateVoice}
                        onChange={(e) => onToggleForceRegenerateVoice(!e.target.checked)}
                        className="accent-emerald-600"
                      />
                      <span>Cached</span>
                    </label>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Row 9: Script Textarea Row (Only in Script Mode) */}
          {effectiveSourceMode === 'script' && (
            <div
              className={`p-3 bg-white flex flex-col gap-2 transition-colors ${
                showMissingHighlights && missingFieldState.voice_or_script
                  ? 'bg-rose-50 ring-1 ring-inset ring-rose-400'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">Review Script</span>
                {showMissingHighlights && missingFieldState.voice_or_script && (
                  <span className="text-[11px] font-bold text-rose-600">
                    · Required: Script or Voice
                  </span>
                )}
              </div>
              <textarea
                ref={scriptTextareaRef}
                value={scriptText}
                disabled={isAgentRunning}
                onChange={(e) => onScriptTextChange(e.target.value)}
                rows={3}
                placeholder="Write or paste review script..."
                className={`w-full bg-slate-50 border rounded-2xl p-3 text-xs text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:bg-white resize-y ${
                  showMissingHighlights && missingFieldState.voice_or_script
                    ? 'border-rose-400 focus:border-rose-500'
                    : 'border-slate-200 focus:border-blue-500'
                }`}
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                <span>{voiceSnapshot?.scriptWordCount || 0} words</span>
                <span>{formatMMSS(voiceSnapshot?.estimatedDurationSec || 0)}</span>
              </div>
            </div>
          )}

          {/* Row 10: BGM & Mix Grid (Clean 2x2 Grid on Android, 4x1 on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-slate-100 gap-[1px]">
            <div
              className={`bg-white px-2.5 sm:px-3 py-2 flex items-center gap-1.5 min-w-0 transition-colors ${
                showMissingHighlights && missingFieldState.bgm
                  ? 'bg-amber-50 ring-1 ring-inset ring-amber-400'
                  : ''
              }`}
            >
              <button
                type="button"
                disabled={isAgentRunning}
                onClick={() => bgmFileInputRef.current?.click()}
                className={`flex-1 min-w-0 h-8 sm:h-9 rounded-xl sm:rounded-2xl text-white text-xs font-bold px-2.5 sm:px-3 flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60 truncate shadow-sm ${
                  showMissingHighlights && missingFieldState.bgm
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-violet-600 hover:bg-violet-500'
                }`}
              >
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {hasBgm ? voiceSnapshot?.bgmName || 'Change BGM' : 'Add BGM'}
                </span>
              </button>
              {hasBgm && (
                <button
                  type="button"
                  disabled={isAgentRunning}
                  onClick={onClearBgm}
                  title="Remove BGM"
                  aria-label="Remove BGM"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl border border-rose-200 hover:border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>

            <div className="bg-white px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-700 shrink-0">Speech BGM</span>
              <select
                value={voiceSnapshot?.bgmDuckedVolume ?? 0.18}
                disabled={isAgentRunning}
                onChange={(e) =>
                  onUpdateMixSettings({ bgmDuckedVolume: parseFloat(e.target.value) })
                }
                className="w-full sm:flex-1 h-8 sm:h-9 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl sm:rounded-2xl px-2 sm:px-2.5 text-xs font-bold text-slate-900 cursor-pointer"
              >
                <option value={0.12}>12% Low</option>
                <option value={0.18}>18% Normal</option>
                <option value={0.22}>22% Medium</option>
                <option value={0.28}>28% Clear</option>
              </select>
            </div>

            <div className="bg-white px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-700 shrink-0">Break Loud</span>
              <select
                value={voiceSnapshot?.bgmLoudVolume ?? 0.9}
                disabled={isAgentRunning}
                onChange={(e) =>
                  onUpdateMixSettings({ bgmLoudVolume: parseFloat(e.target.value) })
                }
                className="w-full sm:flex-1 h-8 sm:h-9 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl sm:rounded-2xl px-2 sm:px-2.5 text-xs font-bold text-slate-900 cursor-pointer"
              >
                <option value={0.7}>70%</option>
                <option value={0.85}>85%</option>
                <option value={0.9}>90% Best</option>
                <option value={1.0}>100%</option>
              </select>
            </div>

            <div className="bg-white px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-700 shrink-0">Break Time</span>
              <select
                value={voiceSnapshot?.interludeDuration ?? 5.0}
                disabled={isAgentRunning}
                onChange={(e) =>
                  onUpdateMixSettings({ interludeDuration: parseFloat(e.target.value) })
                }
                className="w-full sm:flex-1 h-8 sm:h-9 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl sm:rounded-2xl px-2 sm:px-2.5 text-xs font-bold text-slate-900 cursor-pointer"
              >
                <option value={4.0}>4 Seconds</option>
                <option value={5.0}>5 Seconds</option>
                <option value={6.0}>6 Seconds</option>
              </select>
            </div>
          </div>

          {/* Row 11: Final Mixed Audio Player & Transport Controls */}
          <div className="px-2.5 sm:px-3 py-2 bg-[#f6f9ff] flex flex-col gap-2">
            <audio
              ref={homepageAudioRef}
              src={masterAudioUrl || undefined}
              preload="metadata"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (d && isFinite(d) && d > 0) setHpAudioDuration(d);
              }}
              onTimeUpdate={(e) => {
                setHpAudioTime(e.currentTarget.currentTime);
              }}
              onPlay={() => setHpAudioPlaying(true)}
              onPause={() => setHpAudioPlaying(false)}
              onEnded={() => {
                setHpAudioPlaying(false);
                setHpAudioTime(0);
              }}
              className="hidden"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Music className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-900 truncate">
                  Final Master Audio{masterAudioName ? ` · ${masterAudioName}` : ''}
                </span>
                <span className="text-[11px] font-semibold text-indigo-600 shrink-0">
                  ·{' '}
                  {voiceSnapshot?.masterMatchesCurrentSource
                    ? `${hasBgm && (voiceSnapshot?.breakCount || 0) > 0 ? `${voiceSnapshot.breakCount} BGM breaks` : 'Ready'}`
                    : voiceReady
                    ? 'Not Mixed Yet'
                    : 'Waiting for Voice'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                  Total: {effectiveHpDuration > 0 ? formatMMSS(effectiveHpDuration) : targetVideoDurationSec > 0 ? `Est. ${formatMMSS(targetVideoDurationSec)}` : '--:--'}
                </span>
                {voiceReady && onMixPreviewAudio && (
                  <button
                    type="button"
                    disabled={isMixingPreviewAudio || isAgentRunning}
                    onClick={handleMixPreviewClick}
                    className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs"
                  >
                    {isMixingPreviewAudio ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mixing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{masterAudioUrl ? 'Re-Mix Audio' : 'Mix & Listen'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {hpMixError && (
              <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {hpMixError}
              </div>
            )}

            {masterAudioUrl ? (
              <div className="flex flex-col gap-2.5 bg-white border border-indigo-100 rounded-2xl p-3 shadow-2xs">
                {/* Scrubbable Seek Slider */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-blue-700 tabular-nums w-11 shrink-0">
                    {formatMMSS(hpAudioTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.1, effectiveHpDuration)}
                    step={0.1}
                    value={Math.min(hpAudioTime, effectiveHpDuration || 0)}
                    onInput={(e) => seekHpAudio(parseFloat((e.target as HTMLInputElement).value))}
                    onChange={(e) => seekHpAudio(parseFloat(e.target.value))}
                    aria-label="Master Audio Seek Bar"
                    className="flex-1 h-2 accent-emerald-600 bg-slate-200 cursor-pointer rounded-full"
                  />
                  <span className="text-[11px] font-mono font-bold text-slate-600 tabular-nums w-11 text-right shrink-0">
                    {formatMMSS(effectiveHpDuration)}
                  </span>
                </div>

                {/* Transport Buttons + Volume + Speed */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={toggleHpAudioPlay}
                      className="h-8 sm:h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 rounded-xl sm:rounded-2xl cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                      {hpAudioPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{hpAudioPlaying ? 'Pause' : 'Play'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => seekHpAudio(hpAudioTime - 10)}
                      title="Back 10s"
                      className="h-8 sm:h-9 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold flex items-center gap-1 rounded-xl sm:rounded-2xl cursor-pointer transition-all active:scale-95"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                      <span>-10s</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => seekHpAudio(hpAudioTime + 10)}
                      title="Forward 10s"
                      className="h-8 sm:h-9 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold flex items-center gap-1 rounded-xl sm:rounded-2xl cursor-pointer transition-all active:scale-95"
                    >
                      <span>+10s</span>
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => seekHpAudio(0)}
                      title="Restart from 00:00"
                      className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center rounded-xl sm:rounded-2xl cursor-pointer transition-all active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={stopHpAudio}
                      title="Stop"
                      className="h-8 w-8 sm:h-9 sm:w-9 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center rounded-xl sm:rounded-2xl cursor-pointer transition-all active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setHpAudioMuted((m) => !m)}
                      title={hpAudioMuted ? 'Unmute' : 'Mute'}
                      className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center rounded-xl sm:rounded-2xl cursor-pointer transition-all active:scale-95"
                    >
                      {hpAudioMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={hpAudioMuted ? 0 : hpAudioVolume}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setHpAudioVolume(v);
                        if (v > 0 && hpAudioMuted) setHpAudioMuted(false);
                      }}
                      aria-label="Master Audio Volume"
                      className="w-16 h-1.5 accent-blue-600 bg-slate-200 cursor-pointer rounded-full"
                    />
                    <select
                      value={hpAudioSpeed}
                      onChange={(e) => setHpAudioSpeed(parseFloat(e.target.value))}
                      aria-label="Playback Speed"
                      className="h-8 sm:h-9 bg-slate-50 border border-slate-200 px-2 text-[11px] font-mono font-bold text-slate-900 rounded-xl sm:rounded-2xl cursor-pointer"
                    >
                      <option value={0.75}>0.75x</option>
                      <option value={1.0}>1.0x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 bg-white border border-indigo-100 rounded-2xl px-3 py-2 flex items-center justify-between gap-2 leading-relaxed">
                <span>
                  {voiceReady
                    ? 'ভয়েস + ব্যাকগ্রাউন্ড মিউজিক মিক্স করে শুনতে "Mix & Listen" বাটনে ক্লিক করুন (অথবা সরাসরি Generate দিন)।'
                    : 'ভয়েস আপলোড বা স্ক্রিপ্ট লিখলে ফাইনাল মিক্সড অডিও প্লেয়ার এখানে সক্রিয় হবে।'}
                </span>
              </div>
            )}
          </div>

          {/* Mobile Speed & Export Quality Strip */}
          <div className="px-2.5 sm:px-3 py-2 bg-[#f8faff] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                Export & Speed:
              </span>
              <select
                value={performanceMode}
                disabled={isAgentRunning}
                onChange={(e) => onUpdatePerformanceMode(e.target.value as PerformanceModeId)}
                aria-label="Device Performance Mode"
                className="h-7 sm:h-8 bg-white border border-indigo-200 rounded-xl px-2 text-[11px] font-bold text-indigo-900 focus:outline-none cursor-pointer"
              >
                <option value="auto">Auto (Smart)</option>
                <option value="mobile_fast">Mobile Fast</option>
                <option value="high_quality">High Quality</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                {(['480p', '540p', '720p'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    disabled={isAgentRunning}
                    onClick={() => onUpdateExportResolution(res)}
                    className={`h-6 px-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      exportResolution === res
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                {[20, 24, 30].map((fpsVal) => (
                  <button
                    key={fpsVal}
                    type="button"
                    disabled={isAgentRunning}
                    onClick={() => onUpdateExportFps(fpsVal)}
                    className={`h-6 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                      exportFps === fpsVal
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {fpsVal}f
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 12: Watermark + Intro Video Toggle + Settings on One Line */}
          <div className="px-2.5 sm:px-3 py-2 bg-white flex flex-nowrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={isAgentRunning}
              onClick={onToggleWatermarkQuick}
              className={`flex-1 min-w-0 h-8 sm:h-9 px-2.5 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.97] disabled:opacity-60 shadow-xs ${
                channelSettings.watermarkEnabled !== false
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
              }`}
              title="Toggle Watermark"
            >
              {channelSettings.watermarkEnabled !== false ? (
                <Eye className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">
                {channelSettings.watermarkEnabled !== false ? 'Watermark ON' : 'Watermark OFF'}
              </span>
            </button>

            <button
              type="button"
              disabled={isAgentRunning}
              onClick={onToggleIntroPanel}
              title="ইন্ট্রো ভিডিও স্টুডিও খুলুন / বন্ধ করুন"
              className={`flex-1 min-w-0 h-8 sm:h-9 px-2.5 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.97] disabled:opacity-60 shadow-xs ${
                isIntroPanelOpen
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500'
                  : hasAttachedIntro
                  ? 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-400 text-indigo-800'
                  : 'bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700'
              }`}
            >
              <Film className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {hasAttachedIntro
                  ? `ইন্ট্রো যুক্ত (${Math.round((attachedIntroDuration || 0) * 10) / 10}s)`
                  : isIntroPanelOpen
                  ? 'Intro Video ▲'
                  : 'Intro Video'}
              </span>
            </button>

            <button
              type="button"
              disabled={isAgentRunning}
              onClick={onOpenChannelSettingsModal}
              title="Channel & Watermark Settings"
              className="flex-1 min-w-0 h-8 sm:h-9 px-2.5 rounded-xl sm:rounded-2xl border border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-all active:scale-[0.97] shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Settings</span>
            </button>
          </div>

          {/* Row 13: Bottom Primary Action Row (Generate & Auto Export / Stop) */}
          <div className="px-2.5 sm:px-3 py-2 bg-[#f1f5fe] flex flex-col gap-1.5">
            {hasAttachedIntro && (
              <div className="text-[11px] font-bold text-indigo-800 bg-indigo-100/70 border border-indigo-200 rounded-xl px-2.5 py-1 flex items-center justify-between gap-2">
                <span>
                  🎬 ইন্ট্রো ভিডিও যুক্ত আছে ({Math.round((attachedIntroDuration || 0) * 10) / 10}s) — পিকচারের সামনে জয়েন হয়ে এক্সপোর্ট হবে
                </span>
                <button
                  type="button"
                  disabled={isAgentRunning}
                  onClick={onRemoveAttachedIntro}
                  className="text-rose-700 hover:underline shrink-0 cursor-pointer"
                >
                  বাদ দিন
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isAgentRunning}
                onClick={handleGenerateClick}
                className={`flex-1 min-w-0 h-8 sm:h-9 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] shadow-md ${
                  !isAgentRunning
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                }`}
              >
                {isAgentRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="truncate">Processing Video...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="truncate">Generate & Auto Export</span>
                  </>
                )}
              </button>

              {isAgentRunning && (
                <button
                  type="button"
                  onClick={onCancelAutonomousPipeline}
                  className="h-8 sm:h-9 bg-rose-600 hover:bg-rose-500 text-white px-3 rounded-xl sm:rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm transition-all active:scale-95"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* PRE-FLIGHT MISSING FIELDS NOTIFICATION DIALOG */}
      {isPreFlightModalOpen && missingItemsList.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preflight-missing-title"
        >
          <div className="w-full max-w-lg bg-white text-slate-900 border border-amber-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3 bg-amber-50/70">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h2 id="preflight-missing-title" className="text-sm font-bold text-slate-900">
                    কিছু তথ্য এখনো পূরণ করা হয়নি ({missingItemsList.length}টি)
                  </h2>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    যে তথ্যগুলো যুক্ত করতে চান সেটিতে ক্লিক করে পূরণ করুন। আর প্রয়োজন না থাকলে কেটে দিন—বাদ দিয়েই অটোমেটিক ভিডিও তৈরি শুরু হবে।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissAndMaybeStart}
                title={
                  hasRequiredMissing
                    ? 'বন্ধ করুন (প্রয়োজনীয় ঘরগুলো হাইলাইট থাকবে)'
                    : 'কেটে দিন ও বাদ দিয়ে অটোমেটিক ভিডিও তৈরি শুরু করুন'
                }
                aria-label="Close missing fields notification"
                className="w-9 h-9 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-600 flex items-center justify-center rounded-xl cursor-pointer shrink-0 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Missing Items List */}
            <div className="p-3.5 overflow-y-auto flex flex-col gap-2.5">
              {missingItemsList.map((item) => (
                <div
                  key={item.key}
                  className={`p-3 border rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 ${
                    item.required
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{item.titleBn}</span>
                      <span
                        className={`text-[11px] font-bold ${
                          item.required ? 'text-rose-600' : 'text-amber-700'
                        }`}
                      >
                        · {item.required ? 'প্রয়োজনীয়' : 'ঐচ্ছিক'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.descBn}</p>
                  </div>

                  {item.key === 'voice_or_script' ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => focusFieldForMissingKey('voice_or_script', 'upload_voice')}
                        className="h-10 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all"
                      >
                        ভয়েস দিন
                      </button>
                      <button
                        type="button"
                        onClick={() => focusFieldForMissingKey('voice_or_script', 'write_script')}
                        className="h-10 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all"
                      >
                        স্ক্রিপ্ট লিখুন
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => focusFieldForMissingKey(item.key)}
                      className={`h-10 px-3 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 transition-all ${
                        item.required
                          ? 'bg-rose-600 hover:bg-rose-500'
                          : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>যুক্ত করুন</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => focusFieldForMissingKey(missingItemsList[0].key)}
                className="h-11 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-2xl cursor-pointer active:scale-95 transition-all"
              >
                হ্যাঁ, ঘরগুলো পূরণ করবো
              </button>

              {!hasRequiredMissing ? (
                <button
                  type="button"
                  onClick={handleDismissAndMaybeStart}
                  className="h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>বাদ দিয়ে ভিডিও তৈরি শুরু করুন</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPreFlightModalOpen(false)}
                  className="h-11 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-2xl cursor-pointer active:scale-95 transition-all shadow-xs"
                >
                  প্রয়োজনীয় ঘর পূরণ করুন
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIVE EXECUTION TRACKER / ERROR / FINAL OUTPUT (MATERIAL LIGHT CARDS) */}
      {(agentSteps.some((s) => s.status !== 'idle') || agentError || (agentSuccessMessage && lastExportedVideo && !isAgentRunning)) && (
      <section className="bg-white text-slate-900 rounded-3xl p-4 sm:p-5 border border-indigo-100 shadow-[0_8px_28px_rgba(30,58,138,0.08)] flex flex-col gap-3.5">
        {/* LIVE 5-STAGE AGENT EXECUTION TRACKER */}
        {agentSteps.some((s) => s.status !== 'idle') && (
          <div className="flex flex-col gap-2">
            {agentSteps.map((step, idx) => {
              const isRunning = step.status === 'running';
              const isDone = step.status === 'completed';
              const isSkipped = step.status === 'skipped';
              const isError = step.status === 'error';

              return (
                <div
                  key={step.key}
                  className={`rounded-2xl border px-3.5 py-2.5 flex flex-col gap-1.5 transition-colors ${
                    isRunning
                      ? 'bg-indigo-50/90 border-indigo-300 text-slate-900'
                      : isDone
                      ? 'bg-emerald-50/80 border-emerald-200 text-slate-900'
                      : isSkipped
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : isError
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-slate-50/50 border-slate-200 text-slate-500 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      {isRunning ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : isSkipped ? (
                        <SkipForward className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : isError ? (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>
                        {idx + 1}. {step.label}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] font-bold text-slate-700 tabular-nums shrink-0">
                      {isSkipped
                        ? 'স্কিপড ✓'
                        : isDone
                        ? '১০০% সম্পন্ন'
                        : isRunning
                        ? `${Math.round(step.percent)}%`
                        : isError
                        ? 'ত্রুটি'
                        : 'অপেক্ষমাণ'}
                    </span>
                  </div>

                  {step.detail && (
                    <p className="text-[11px] text-slate-600 pl-6">{step.detail}</p>
                  )}

                  {isRunning && (
                    <div className="ml-6 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(4, Math.min(100, step.percent))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Error Message */}
        {agentError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{agentError}</span>
          </div>
        )}

        {/* Final Success & Direct Download + On-Demand Video Preview (low-RAM safe) */}
        {agentSuccessMessage && lastExportedVideo && !isAgentRunning && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center gap-4">
            {showExportVideoPreview ? (
              <video
                src={lastExportedVideo.url}
                controls
                preload="metadata"
                autoPlay
                className="w-full lg:w-80 aspect-video bg-black rounded-2xl border border-emerald-300 shadow-xs shrink-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowExportVideoPreview(true)}
                className="w-full lg:w-80 aspect-video bg-slate-900 hover:bg-slate-800 rounded-2xl border border-emerald-300 shadow-xs shrink-0 flex flex-col items-center justify-center gap-2 text-white cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center shadow-md">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
                <span className="text-xs font-bold text-emerald-200">ভিডিও প্রিভিউ দেখতে ক্লিক করুন</span>
              </button>
            )}
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{agentSuccessMessage}</span>
              </div>
              <p className="text-xs text-emerald-800 font-mono tabular-nums">
                {lastExportedVideo.filename} · {formatMMSS(lastExportedVideo.duration)} ·{' '}
                {(lastExportedVideo.sizeBytes / (1024 * 1024)).toFixed(1)} MB
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onDownloadLastExported}
                  className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 rounded-2xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>MP4 ভিডিও ডাউনলোড করুন</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenVideoTab}
                  className="h-11 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold px-4 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <span>ভিডিও টাইমলাইনে দেখুন</span>
                  <ArrowRight className="w-4 h-4 text-indigo-600" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
