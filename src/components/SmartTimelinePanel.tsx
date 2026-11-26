/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Sparkles,
  Sliders,
  Music,
  CheckCircle2,
  Zap,
  Upload,
  Plus,
  Minus,
  Check,
  Repeat,
  Tv,
  Download,
  StopCircle,
  Bell,
  X,
  Film,
  ShieldCheck,
  Calendar,
  LayoutGrid,
  Captions,
  Tv2,
  AudioWaveform,
  AlertTriangle
} from 'lucide-react';
import {
  TimelineConfig,
  TimelineSummary,
  ChannelSettings,
  ChannelLayoutMode,
  SeriesItem
} from '../types/timeline';
import { TEN_CHANNEL_DNA_PRESETS } from '../services/channelDnaPresets';
import { PolicySafetyReport } from '../services/spamSafetyChecker';
import { type ExportResolutionId, type PerformanceModeId } from '../services/devicePerformance';

const CHANNEL_LAYOUT_LABELS_EN: Record<ChannelLayoutMode, string> = {
  full_cinema: 'Full Cinema',
  news_desk_card: 'News Desk Card',
  split_comparison: 'Split Comparison',
  polaroid_collage: 'Polaroid Collage',
  documentary_bar: 'Documentary Bar',
  editorial_frame: 'Editorial Frame',
  triptych_mosaic: 'Triptych Mosaic',
  panoramic_reel: 'Panoramic Reel',
  spotlight_pip: 'Spotlight PiP',
  spotlight_diary: 'Diary Card'
};

interface SmartTimelinePanelProps {
  config: TimelineConfig;
  summary: TimelineSummary | null;
  galleryCount: number;
  audioDuration: number;
  audioName: string;
  audioUrl?: string;
  channelSettings?: ChannelSettings;
  onUpdateChannelSettings?: (settings: Partial<ChannelSettings>) => void;
  onOpenChannelSettingsModal?: () => void;
  onAudioUploadTrigger?: () => void;
  onRemoveAudio?: () => void;
  onUpdateConfig: (newConfig: Partial<TimelineConfig>) => void;
  outputVideoFormat?: 'mp4' | 'webm';
  onUpdateOutputVideoFormat?: (format: 'mp4' | 'webm') => void;
  exportFps?: number;
  onUpdateExportFps?: (fps: number) => void;
  exportResolution?: ExportResolutionId;
  onUpdateExportResolution?: (res: ExportResolutionId) => void;
  performanceMode?: PerformanceModeId;
  onUpdatePerformanceMode?: (mode: PerformanceModeId) => void;
  onExportVideo?: () => void;
  onCancelExportVideo?: () => void;
  onPauseExportVideo?: () => void;
  onResumeExportVideo?: () => void;
  isExportPaused?: boolean;
  isRenderingVideo?: boolean;
  renderProgress?: number;
  renderStatusInfo?: {
    fps?: number;
    etaSeconds?: number;
    currentFrame?: number;
    totalFrames?: number;
    state?: string;
    message?: string;
  };
  lastExportedVideo?: {
    blob: Blob;
    url: string;
    filename: string;
    duration: number;
    sizeBytes: number;
  } | null;
  onDownloadLastExported?: () => void;
  hasIntroVideo?: boolean;
  onRemoveIntroVideo?: () => void;
  activeChannelSlot?: number;
  savedChannels?: string[];
  onSelectChannelSlot?: (slotNumber: number) => void;
  onApplyChannelAntiSpamDna?: () => void;
  activeSeries?: SeriesItem | null;
  seriesList?: SeriesItem[];
  onSelectSeriesById?: (seriesId: string) => void;
  todaysSeriesCount?: number;
  todaysSeriesIds?: string[];
  onOpenSeriesScheduleModal?: () => void;
  onUpdateActiveEpisode?: (episode: string) => void;
  onQuickAddDrama?: (title: string, episode?: string) => void;
  broadcastPreviewText?: string;
  releaseDate?: string;
  formattedReleaseDate?: string;
  onUpdateReleaseDate?: (isoDate: string) => void;
  showLowerThird?: boolean;
  onToggleLowerThird?: () => void;
  showSubtitles?: boolean;
  onToggleSubtitles?: () => void;
  humanizeAudioEnabled?: boolean;
  onToggleHumanizeAudio?: () => void;
  safetyReport?: PolicySafetyReport | null;
  onRunSafetyCheck?: () => void;
}

export const SmartTimelinePanel: React.FC<SmartTimelinePanelProps> = ({
  config,
  galleryCount,
  audioDuration,
  audioName,
  channelSettings,
  onUpdateChannelSettings,
  onOpenChannelSettingsModal,
  onAudioUploadTrigger,
  onRemoveAudio,
  onUpdateConfig,
  outputVideoFormat = 'mp4',
  onUpdateOutputVideoFormat,
  exportFps = 24,
  onUpdateExportFps,
  exportResolution = '720p',
  onUpdateExportResolution,
  performanceMode = 'auto',
  onUpdatePerformanceMode,
  onExportVideo,
  onCancelExportVideo,
  onPauseExportVideo,
  onResumeExportVideo,
  isExportPaused = false,
  isRenderingVideo = false,
  renderProgress = 0,
  renderStatusInfo,
  lastExportedVideo,
  onDownloadLastExported,
  hasIntroVideo,
  onRemoveIntroVideo,
  activeChannelSlot = 1,
  savedChannels = [],
  onSelectChannelSlot,
  onApplyChannelAntiSpamDna,
  activeSeries = null,
  seriesList = [],
  onSelectSeriesById,
  todaysSeriesCount = 0,
  todaysSeriesIds = [],
  onOpenSeriesScheduleModal,
  onUpdateActiveEpisode,
  onQuickAddDrama,
  broadcastPreviewText,
  releaseDate = '',
  formattedReleaseDate = '',
  onUpdateReleaseDate,
  showLowerThird = true,
  onToggleLowerThird,
  showSubtitles = true,
  onToggleSubtitles,
  humanizeAudioEnabled = true,
  onToggleHumanizeAudio,
  safetyReport = null,
  onRunSafetyCheck
}) => {
  const [customMin, setCustomMin] = useState<number>(Math.floor(config.targetDurationSeconds / 60));
  const [customSec, setCustomSec] = useState<number>(Math.round(config.targetDurationSeconds % 60));
  const [isCtaModalOpen, setIsCtaModalOpen] = useState<boolean>(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickTitleInput, setQuickTitleInput] = useState<string>('');
  const [quickEpisodeInput, setQuickEpisodeInput] = useState<string>('নতুন পর্ব');
  const [ctaTextInput, setCtaTextInput] = useState<string>(
    channelSettings?.ctaText || 'Please subscribe to the channel and like this video! 👍🔔'
  );

  useEffect(() => {
    if (channelSettings?.ctaText) {
      setCtaTextInput(channelSettings.ctaText);
    }
  }, [channelSettings?.ctaText]);

  useEffect(() => {
    setCustomMin(Math.floor(config.targetDurationSeconds / 60));
    setCustomSec(Math.round(config.targetDurationSeconds % 60));
  }, [config.targetDurationSeconds]);

  const applyDuration = (mins: number, secs: number) => {
    const validMins = Math.max(0, isNaN(mins) ? 0 : mins);
    const validSecs = Math.max(0, Math.min(59, isNaN(secs) ? 0 : secs));
    const totalSec = Math.max(1, validMins * 60 + validSecs);
    setCustomMin(validMins);
    setCustomSec(validSecs);
    onUpdateConfig({ targetDurationSeconds: totalSec, durationMode: 'fixed' });
  };

  const handleSyncToAudio = () => {
    if (audioDuration <= 0) return;
    const exactSec = Math.max(1, Math.round(audioDuration * 10) / 10);
    setCustomMin(Math.floor(exactSec / 60));
    setCustomSec(Math.round(exactSec % 60));
    onUpdateConfig({ targetDurationSeconds: exactSec, durationMode: 'matchVoiceover' });
  };

  const handleMinChange = (valStr: string) => {
    const m = parseInt(valStr, 10);
    applyDuration(isNaN(m) ? 0 : m, customSec);
  };

  const handleSecChange = (valStr: string) => {
    const s = parseInt(valStr, 10);
    applyDuration(customMin, isNaN(s) ? 0 : s);
  };

  const audioMins = audioDuration > 0 ? Math.floor(audioDuration / 60) : 0;
  const audioSecs = audioDuration > 0 ? Math.round(audioDuration % 60) : 0;

  const isAudioShorter = audioDuration > 0 && config.targetDurationSeconds > Math.round(audioDuration) + 1;
  const isAudioLonger = audioDuration > 0 && config.targetDurationSeconds < Math.round(audioDuration) - 1;

  const estimatedSlots =
    config.targetDurationSeconds > 0
      ? Math.max(1, Math.round((config.targetDurationSeconds - 0.6) / 5.4))
      : 0;
  const willNeedImageLoop = galleryCount > 0 && estimatedSlots > 0 && galleryCount < estimatedSlots;

  return (
    <div className="w-full bg-[#0f172a] border border-slate-800 rounded-none divide-y divide-slate-800 text-slate-100">
      {hasIntroVideo && (
        <div className="px-3 py-2 bg-violet-950/50 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-violet-200 truncate">
            <Film className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">Intro Active</span>
          </span>
          {onRemoveIntroVideo && (
            <button
              type="button"
              onClick={onRemoveIntroVideo}
              className="h-7 px-2.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded-none text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Remove</span>
            </button>
          )}
        </div>
      )}

      {/* Row 1: Duration Steppers & Audio Control */}
      <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mr-0.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Duration</span>
            {config.durationMode === 'matchVoiceover' && (
              <span className="text-[9px] font-mono px-1 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                AUTO
              </span>
            )}
          </span>

          {/* Minutes Stepper */}
          <div className="flex items-center border border-slate-700 rounded-none bg-slate-900">
            <button
              type="button"
              onClick={() => handleMinChange(String(Math.max(0, customMin - 1)))}
              className="h-8 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Decrease 1 min"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={String(customMin).padStart(2, '0')}
              onChange={(e) => handleMinChange(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-9 h-8 bg-slate-950 text-center font-mono tabular-nums font-bold text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleMinChange(String(Math.min(180, customMin + 1)))}
              className="h-8 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Increase 1 min"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <span className="font-mono font-bold text-slate-400 text-xs">:</span>

          {/* Seconds Stepper */}
          <div className="flex items-center border border-slate-700 rounded-none bg-slate-900">
            <button
              type="button"
              onClick={() => handleSecChange(String(Math.max(0, customSec - 5)))}
              className="h-8 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Decrease 5 secs"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={String(customSec).padStart(2, '0')}
              onChange={(e) => handleSecChange(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-9 h-8 bg-slate-950 text-center font-mono tabular-nums font-bold text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSecChange(String(Math.min(59, customSec + 5)))}
              className="h-8 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Increase 5 secs"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Audio Control */}
        <div className="flex items-center gap-1.5 min-w-0">
          {audioDuration > 0 ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-violet-700/70 rounded-none px-2 h-8 max-w-[220px]">
              <Music className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-100 truncate" title={audioName}>
                {audioName || 'Audio'}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-violet-300 shrink-0">
                {audioMins}:{String(audioSecs).padStart(2, '0')}
              </span>
              {(config.durationMode !== 'matchVoiceover' ||
                Math.abs(config.targetDurationSeconds - audioDuration) > 1) && (
                <button
                  type="button"
                  onClick={handleSyncToAudio}
                  className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 px-1 border-l border-slate-700 cursor-pointer shrink-0"
                  title="Sync Timeline to Audio"
                >
                  Sync
                </button>
              )}
              {onRemoveAudio && (
                <button
                  type="button"
                  onClick={onRemoveAudio}
                  className="text-rose-400 hover:text-rose-300 cursor-pointer shrink-0"
                  title="Remove Audio"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onAudioUploadTrigger}
              className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white border border-violet-400/70 rounded-none text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>Upload Audio</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Format, FPS, Channel Slot & Unique DNA */}
      <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Format Toggle */}
          <div className="flex items-center border border-slate-700 rounded-none bg-slate-900">
            <button
              type="button"
              onClick={() => onUpdateOutputVideoFormat?.('mp4')}
              className={`h-8 px-2.5 text-[11px] font-bold rounded-none transition-colors cursor-pointer ${
                outputVideoFormat === 'mp4'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              MP4
            </button>
            <button
              type="button"
              onClick={() => onUpdateOutputVideoFormat?.('webm')}
              className={`h-8 px-2.5 text-[11px] font-bold rounded-none border-l border-slate-700 transition-colors cursor-pointer ${
                outputVideoFormat === 'webm'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              WebM
            </button>
          </div>

          {/* FPS Toggle (20 / 24 / 30) */}
          <div className="flex items-center border border-slate-700 rounded-none bg-slate-900">
            {[20, 24, 30].map((fpsVal, idx) => (
              <button
                key={fpsVal}
                type="button"
                onClick={() => onUpdateExportFps?.(fpsVal)}
                className={`h-8 px-2 text-[11px] font-bold rounded-none flex items-center gap-1 transition-colors cursor-pointer ${
                  idx > 0 ? 'border-l border-slate-700' : ''
                } ${
                  exportFps === fpsVal
                    ? fpsVal <= 24
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {fpsVal === 20 && <Zap className="w-3 h-3 text-amber-300" />}
                <span className="tabular-nums">{fpsVal} FPS</span>
              </button>
            ))}
          </div>

          {/* Export Resolution Toggle (480p / 540p / 720p) */}
          <div className="flex items-center border border-slate-700 rounded-none bg-slate-900">
            {(['480p', '540p', '720p'] as const).map((res, idx) => (
              <button
                key={res}
                type="button"
                onClick={() => onUpdateExportResolution?.(res)}
                className={`h-8 px-2 text-[11px] font-bold rounded-none transition-colors cursor-pointer ${
                  idx > 0 ? 'border-l border-slate-700' : ''
                } ${
                  exportResolution === res
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {res}
              </button>
            ))}
          </div>

          {/* Mobile Speed Mode Selector */}
          <select
            value={performanceMode}
            onChange={(e) => onUpdatePerformanceMode?.(e.target.value as PerformanceModeId)}
            aria-label="Speed Mode"
            className="h-8 px-2 bg-slate-900 border border-slate-700 text-[11px] font-bold text-amber-300 rounded-none focus:outline-none cursor-pointer"
          >
            <option value="auto">Auto Speed</option>
            <option value="mobile_fast">Mobile Fast</option>
            <option value="high_quality">High Quality</option>
          </select>
        </div>

        {/* Channel Slot & Unique DNA */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 sm:flex-initial justify-end">
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-none px-2 h-8 min-w-0 max-w-[190px]">
            <Tv className="w-3.5 h-3.5 text-indigo-400 shrink-0 mr-1.5" />
            <select
              value={activeChannelSlot}
              onChange={(e) => onSelectChannelSlot?.(Number(e.target.value))}
              className="bg-slate-900 text-[11px] font-bold text-slate-100 focus:outline-none cursor-pointer truncate w-full"
            >
              {TEN_CHANNEL_DNA_PRESETS.map((preset, idx) => {
                const customName = savedChannels?.[idx]?.trim();
                const label = customName
                  ? `${preset.shortLabel}: ${customName}`
                  : `${preset.shortLabel} • ${preset.themeTitle}`;
                return (
                  <option key={preset.slotNumber} value={preset.slotNumber} className="bg-slate-900 text-white">
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={onApplyChannelAntiSpamDna}
            disabled={galleryCount === 0}
            className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white border border-emerald-400/70 rounded-none text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Unique DNA</span>
          </button>
        </div>
      </div>

      {/* Row 3: Primary Actions (Channel, Subscribe, Download, Export) */}
      <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={onOpenChannelSettingsModal}
          className="h-9 px-2 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/70 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
        >
          <Sliders className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Channel</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCtaModalOpen(true)}
          className="h-9 px-2 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/70 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
        >
          <Bell className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="truncate">Subscribe</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (lastExportedVideo && onDownloadLastExported) {
              onDownloadLastExported();
            } else if (onExportVideo) {
              onExportVideo();
            }
          }}
          className="h-9 px-2 bg-teal-600 hover:bg-teal-500 text-white border border-teal-400/70 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Download</span>
        </button>

        <button
          type="button"
          onClick={isRenderingVideo ? onCancelExportVideo : onExportVideo}
          disabled={!isRenderingVideo && galleryCount === 0}
          className={`h-9 px-2 border rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate ${
            isRenderingVideo
              ? 'bg-rose-700 hover:bg-rose-600 border-rose-400 text-white animate-pulse'
              : 'bg-violet-600 hover:bg-violet-500 border-violet-400/70 disabled:opacity-50 text-white'
          }`}
        >
          {isRenderingVideo ? (
            <>
              <StopCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate tabular-nums">Cancel ({renderProgress}%)</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">Export</span>
            </>
          )}
        </button>
      </div>

      {/* Export Progress Strip */}
      {isRenderingVideo && (
        <div className="px-2.5 py-2 bg-slate-950/70 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="font-mono tabular-nums text-indigo-300">
              {renderProgress}%{renderStatusInfo?.totalFrames ? ` (${renderStatusInfo.currentFrame || 0}/${renderStatusInfo.totalFrames})` : ''}
            </span>
            <div className="flex items-center gap-1.5">
              {isExportPaused ? (
                onResumeExportVideo && (
                  <button
                    type="button"
                    onClick={onResumeExportVideo}
                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none text-[11px] font-bold cursor-pointer"
                  >
                    Resume
                  </button>
                )
              ) : (
                onPauseExportVideo && (
                  <button
                    type="button"
                    onClick={onPauseExportVideo}
                    className="h-7 px-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-none text-[11px] font-bold cursor-pointer"
                  >
                    Pause
                  </button>
                )
              )}
              {onCancelExportVideo && (
                <button
                  type="button"
                  onClick={onCancelExportVideo}
                  className="h-7 px-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded-none text-[11px] font-bold cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-none overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-150"
              style={{ width: `${Math.max(1, renderProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Row 4: Layout & Overlays Control */}
      <div className="p-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-none px-2 h-8 flex-1 min-w-[160px]">
            <LayoutGrid className="w-3.5 h-3.5 text-violet-400 shrink-0 mr-1.5" />
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5 shrink-0">Layout</span>
            <select
              value={config.layoutMode || 'full_cinema'}
              onChange={(e) => onUpdateConfig({ layoutMode: e.target.value as ChannelLayoutMode })}
              className="bg-slate-900 text-xs font-bold text-slate-100 focus:outline-none cursor-pointer w-full truncate"
            >
              {(Object.keys(CHANNEL_LAYOUT_LABELS_EN) as ChannelLayoutMode[]).map((mode) => (
                <option key={mode} value={mode} className="bg-slate-900 text-white">
                  {CHANNEL_LAYOUT_LABELS_EN[mode]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              onRunSafetyCheck?.();
              setIsSafetyModalOpen(true);
            }}
            className={`h-8 px-2.5 rounded-none text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-colors shrink-0 ${
              safetyReport?.overallLevel === 'high_risk'
                ? 'bg-rose-950/80 text-rose-200 border-rose-700 hover:bg-rose-900'
                : safetyReport?.overallLevel === 'caution'
                ? 'bg-amber-950/80 text-amber-200 border-amber-700 hover:bg-amber-900'
                : 'bg-emerald-950/80 text-emerald-200 border-emerald-700 hover:bg-emerald-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="tabular-nums">
              Safety{safetyReport ? ` (${safetyReport.passedCount}/${safetyReport.totalChecks})` : ''}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={onToggleLowerThird}
            className={`h-8 px-2 rounded-none text-[11px] font-bold flex items-center justify-center gap-1 border transition-colors cursor-pointer truncate ${
              showLowerThird
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Tv2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Lower Third</span>
          </button>

          <button
            type="button"
            onClick={onToggleSubtitles}
            className={`h-8 px-2 rounded-none text-[11px] font-bold flex items-center justify-center gap-1 border transition-colors cursor-pointer truncate ${
              showSubtitles
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Captions className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Captions</span>
          </button>

          <button
            type="button"
            onClick={onToggleHumanizeAudio}
            className={`h-8 px-2 rounded-none text-[11px] font-bold flex items-center justify-center gap-1 border transition-colors cursor-pointer truncate ${
              humanizeAudioEnabled
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <AudioWaveform className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Room Tone</span>
          </button>
        </div>
      </div>

      {/* Loop Status Pills (Compact Icons Only) */}
      {(isAudioShorter || (galleryCount > 0 && willNeedImageLoop)) && (
        <div className="px-2.5 py-1.5 bg-slate-950/60 flex flex-wrap items-center gap-3 text-[11px] font-bold">
          {isAudioShorter && (
            <span className="flex items-center gap-1 text-amber-300">
              <Repeat className="w-3.5 h-3.5 shrink-0" />
              <span>Audio Loop</span>
            </span>
          )}
          {galleryCount > 0 && willNeedImageLoop && (
            <span className="flex items-center gap-1 text-amber-300">
              <Repeat className="w-3.5 h-3.5 shrink-0" />
              <span className="tabular-nums">Photo Loop ({galleryCount})</span>
            </span>
          )}
        </div>
      )}

      {/* Row 5: Active Drama, Episode & Release Date */}
      <div className="p-2.5 flex flex-col gap-2 bg-slate-950/40">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-7 flex items-center bg-slate-900 border border-slate-700 rounded-none px-2 h-8">
            <Film className="w-3.5 h-3.5 text-amber-400 shrink-0 mr-1.5" />
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5 shrink-0">Drama</span>
            <select
              value={activeSeries?.id || '__none__'}
              onChange={(e) => onSelectSeriesById?.(e.target.value)}
              className="bg-slate-900 text-xs font-bold text-amber-300 focus:outline-none cursor-pointer w-full truncate"
            >
              {seriesList
                .filter((s) => s.status === 'active')
                .map((s) => {
                  const isToday = todaysSeriesIds.includes(s.id);
                  return (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {isToday ? `★ ${s.title}` : s.title}
                    </option>
                  );
                })}
              <option value="__none__" className="bg-slate-900 text-slate-400">
                None
              </option>
            </select>
          </div>

          {activeSeries && (
            <div className="sm:col-span-5 flex items-center bg-slate-900 border border-slate-700 rounded-none px-2 h-8">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5 shrink-0">Episode</span>
              <input
                type="text"
                value={activeSeries.currentEpisode || ''}
                onChange={(e) => onUpdateActiveEpisode?.(e.target.value)}
                placeholder="নতুন পর্ব"
                className="bg-transparent text-xs font-bold text-white w-full focus:outline-none placeholder-slate-500"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-none px-2 h-8">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1.5" />
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => onUpdateReleaseDate?.(e.target.value)}
                className="bg-transparent text-xs font-bold text-cyan-300 focus:outline-none cursor-pointer [color-scheme:dark]"
              />
              {releaseDate && (
                <button
                  type="button"
                  onClick={() => onUpdateReleaseDate?.('')}
                  className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                  title="Clear Date"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {formattedReleaseDate && (
              <span className="h-8 px-2 flex items-center bg-cyan-950/60 border border-cyan-700/60 text-cyan-200 text-[11px] font-bold rounded-none">
                {formattedReleaseDate}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsQuickAddOpen((v) => !v)}
              className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/70 rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Drama</span>
            </button>

            <button
              type="button"
              onClick={onOpenSeriesScheduleModal}
              className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors tabular-nums"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Schedule{todaysSeriesCount > 0 ? ` (${todaysSeriesCount})` : ''}</span>
            </button>
          </div>
        </div>

        {/* Inline Quick-Add Form Drawer */}
        {isQuickAddOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = quickTitleInput.trim();
              if (!clean) return;
              onQuickAddDrama?.(clean, quickEpisodeInput.trim() || 'নতুন পর্ব');
              setQuickTitleInput('');
              setQuickEpisodeInput('নতুন পর্ব');
              setIsQuickAddOpen(false);
            }}
            className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-1.5"
          >
            <input
              type="text"
              required
              autoFocus
              value={quickTitleInput}
              onChange={(e) => setQuickTitleInput(e.target.value)}
              placeholder="Drama title"
              className="flex-1 min-w-[140px] h-8 bg-slate-900 border border-indigo-500 rounded-none px-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            <input
              type="text"
              value={quickEpisodeInput}
              onChange={(e) => setQuickEpisodeInput(e.target.value)}
              placeholder="Episode"
              className="w-24 h-8 bg-slate-900 border border-slate-700 rounded-none px-2 text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(false)}
              className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-none text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Active Lower-Third Status Line */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 pt-1.5 border-t border-slate-800">
          <span className="font-bold text-emerald-300 truncate">
            {broadcastPreviewText || 'None'}
            {formattedReleaseDate ? ` • ${formattedReleaseDate}` : ''}
          </span>
          <span className="font-mono font-bold text-cyan-300 tabular-nums shrink-0">CH {activeChannelSlot}</span>
        </div>
      </div>

      {/* Subscribe & Like CTA Modal */}
      {isCtaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-none shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
            <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm text-white">Subscribe CTA</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCtaModalOpen(false)}
                className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-none text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-3">
              <div className="flex items-center justify-between bg-slate-900 p-2.5 border border-slate-800 rounded-none">
                <span className="font-bold text-xs text-slate-200">CTA Overlay</span>
                <button
                  type="button"
                  onClick={() => onUpdateChannelSettings?.({ ctaEnabled: !(channelSettings?.ctaEnabled ?? true) })}
                  className={`h-8 px-3 rounded-none font-bold text-xs border transition-colors cursor-pointer ${
                    (channelSettings?.ctaEnabled ?? true)
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {(channelSettings?.ctaEnabled ?? true) ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-xs text-slate-300">Interval</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[15, 30, 40, 45, 50, 65].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onUpdateChannelSettings?.({ ctaIntervalSeconds: sec, ctaEnabled: true })}
                      className={`h-8 px-2 rounded-none text-xs font-bold font-mono tabular-nums border transition-colors cursor-pointer ${
                        (channelSettings?.ctaIntervalSeconds ?? 45) === sec
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-xs text-slate-300">CTA Text</span>
                <input
                  type="text"
                  value={ctaTextInput}
                  onChange={(e) => {
                    setCtaTextInput(e.target.value);
                    onUpdateChannelSettings?.({ ctaText: e.target.value });
                  }}
                  placeholder="Subscribe text"
                  className="w-full h-9 bg-slate-900 border border-slate-700 rounded-none px-3 text-xs font-semibold text-white focus:outline-none focus:border-rose-500"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    'Please subscribe to the channel and like this video! 👍🔔',
                    'If you enjoyed this video, please like & subscribe! ❤️✨',
                    'Subscribe now for more amazing videos! 🔔🔥',
                    'Please Like & Subscribe to our Channel! 👍🔔'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCtaTextInput(preset);
                        onUpdateChannelSettings?.({ ctaText: preset });
                      }}
                      className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 px-2.5 py-1.5 rounded-none border border-slate-800 cursor-pointer text-left truncate"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCtaModalOpen(false)}
                className="h-9 px-5 bg-rose-600 hover:bg-rose-500 text-white rounded-none text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Audit Modal */}
      {isSafetyModalOpen && safetyReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-none shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh] text-slate-100">
            <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  className={`w-5 h-5 ${
                    safetyReport.overallLevel === 'high_risk'
                      ? 'text-rose-400'
                      : safetyReport.overallLevel === 'caution'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                />
                <h3 className="font-bold text-sm text-white">
                  Safety Audit
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {safetyReport.passedCount}/{safetyReport.totalChecks}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSafetyModalOpen(false)}
                className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-none text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-slate-800 text-xs">
              {safetyReport.issues.map((issue) => (
                <div key={issue.id} className="py-2.5 flex items-start gap-2.5">
                  {issue.severity === 'pass' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        issue.severity === 'risk' ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-100">{issue.titleBn}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{issue.detailBn}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onRunSafetyCheck?.()}
                className="h-9 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-none text-xs font-bold cursor-pointer"
              >
                Rescan
              </button>
              <button
                type="button"
                onClick={() => setIsSafetyModalOpen(false)}
                className="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
