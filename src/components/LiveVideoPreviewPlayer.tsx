/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Clock,
  Film,
  Camera,
  Cpu,
  Sliders,
  Video as VideoIcon
} from 'lucide-react';
import { TimelineSlot } from '../types/timeline';

export type PreviewQuality = 'low' | 'medium' | 'high';

interface LiveVideoPreviewPlayerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onPrevSlot: () => void;
  onNextSlot: () => void;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  volume: number; // 0 to 1
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  isPreviewEnabled: boolean;
  onTogglePreview: () => void;
  previewQuality: PreviewQuality;
  onChangeQuality: (quality: PreviewQuality) => void;
  timelineSlots: TimelineSlot[];
  totalPhotosCount: number;
  isRenderingVideo: boolean;
  renderProgress?: number;
  livePreviewBanner?: string | null;
  onGoToScreenshot?: () => void;
  onGenerateSmartTimeline?: () => void;
}

export const LiveVideoPreviewPlayer: React.FC<LiveVideoPreviewPlayerProps> = ({
  canvasRef,
  isPlaying,
  onTogglePlay,
  onStop,
  onPrevSlot,
  onNextSlot,
  currentTime,
  totalDuration,
  onSeek,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  isPreviewEnabled,
  onTogglePreview,
  previewQuality,
  onChangeQuality,
  timelineSlots,
  totalPhotosCount,
  isRenderingVideo,
  renderProgress = 0,
  livePreviewBanner,
  onGoToScreenshot,
  onGenerateSmartTimeline
}) => {
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Synchronize Fullscreen State
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Format MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const totalSecs = Math.floor(secs);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Current Active Slot Calculation for Live Effect Info
  const activeSlotInfo = useMemo(() => {
    if (timelineSlots.length === 0) return null;
    const slotIdx = timelineSlots.findIndex(
      (s) => currentTime >= s.startTime && currentTime < s.endTime
    );
    const resolvedIdx = slotIdx >= 0 ? slotIdx : (currentTime >= totalDuration ? timelineSlots.length - 1 : 0);
    const slot = timelineSlots[resolvedIdx];
    if (!slot) return null;

    // Friendly names for animation & transition
    const getCleanName = (raw: string) => {
      if (!raw) return 'Standard';
      return raw
        .replace(/^remotion_/, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    return {
      index: resolvedIdx + 1,
      total: timelineSlots.length,
      duration: slot.duration,
      animationName: getCleanName(slot.animationId || 'Cinematic Zoom'),
      transitionName: getCleanName(slot.transitionType || 'Diagonal Reveal'),
      photoFrame: slot.frameStyle || 'Classic'
    };
  }, [timelineSlots, currentTime, totalDuration]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      onTogglePlay();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      onSeek(Math.max(0, currentTime - 2));
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      onSeek(Math.min(totalDuration, currentTime + 2));
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      onToggleMute();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      toggleFullscreen();
    }
  }, [onTogglePlay, onSeek, currentTime, totalDuration, onToggleMute]);

  const effectiveVolume = isMuted ? 0 : volume;
  const progressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0;

  return (
    <div
      ref={playerContainerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`flex flex-col bg-[#0b101b] border border-slate-800 text-slate-100 shadow-xl transition-all outline-hidden select-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen justify-center items-center p-4 bg-black'
          : 'w-full max-w-[586px] rounded-xl overflow-hidden'
      }`}
      style={{
        width: isFullscreen ? '100vw' : '586px',
        maxWidth: isFullscreen ? '100vw' : '100%'
      }}
    >
      {/* ======================================================== */}
      {/* A. 16:9 LIVE PREVIEW DISPLAY (586x330 / 16:9 Aspect Ratio) */}
      {/* ======================================================== */}
      <div
        className="relative bg-black flex items-center justify-center overflow-hidden w-full group cursor-pointer"
        style={{
          aspectRatio: '16/9',
          maxHeight: isFullscreen ? 'calc(100vh - 120px)' : '386px'
        }}
        onClick={onTogglePlay}
        onMouseEnter={() => setIsHoveringControls(true)}
        onMouseLeave={() => setIsHoveringControls(false)}
      >
        {/* The Live Render Canvas */}
        <canvas
          ref={canvasRef}
          width={previewQuality === 'low' ? 640 : previewQuality === 'medium' ? 960 : 1280}
          height={previewQuality === 'low' ? 360 : previewQuality === 'medium' ? 540 : 720}
          className={`w-full h-full object-contain block transition-opacity duration-200 ${
            !isPreviewEnabled ? 'opacity-20 filter blur-xs' : 'opacity-100'
          }`}
        />

        {/* Live Export Status Badge */}
        {isRenderingVideo && (
          <div className="absolute top-3 right-3 z-30 bg-red-600/95 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center space-x-1.5 border border-red-400/50 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white shrink-0" />
            <span>🔴 EXPORT RECORDING: {renderProgress}%</span>
          </div>
        )}

        {/* Live Banner Notice */}
        {livePreviewBanner && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none scale-up-center bg-violet-700/90 backdrop-blur-md text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg border border-violet-400/40 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>{livePreviewBanner}</span>
          </div>
        )}

        {/* PREVIEW OFF STATE OVERLAY (Requirement E) */}
        {!isPreviewEnabled && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs text-center p-4 pointer-events-none">
            <EyeOff className="w-12 h-12 text-amber-400 mb-2 animate-pulse" />
            <span className="text-sm font-bold text-white mb-0.5">Live Preview Paused</span>
            <span className="text-xs text-slate-400 max-w-xs">
              লো-র‌্যাম ও পাওয়ার সেভিং মোড সক্রিয়। Visual rendering সাময়িকভাবে বন্ধ রয়েছে।
            </span>
          </div>
        )}

        {/* EMPTY GALLERY STATE */}
        {totalPhotosCount === 0 && isPreviewEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 p-4 text-center z-20">
            <VideoIcon className="w-12 h-12 text-violet-500 mb-2 animate-bounce" />
            <p className="text-sm font-bold text-white mb-1">No Gallery Images</p>
            <p className="text-xs text-slate-400 mb-3">ভিডিও প্রিভিউ দেখার জন্য প্রথমে Screenshot ট্যাব থেকে ছবি সংগ্রহ করুন</p>
            {onGoToScreenshot && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGoToScreenshot();
                }}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-4 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer pointer-events-auto"
              >
                <Camera className="w-4 h-4" />
                <span>Go to Screenshot Tab</span>
              </button>
            )}
          </div>
        )}

        {/* GENERATE TIMELINE CALLOUT */}
        {totalPhotosCount > 0 && timelineSlots.length === 0 && isPreviewEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xs text-slate-200 p-4 text-center z-20">
            <Sparkles className="w-10 h-10 text-violet-400 mb-2 animate-pulse" />
            <h3 className="text-sm font-bold text-white mb-1">Generate Smart Timeline</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-3">
              {totalPhotosCount}টি ছবি দিয়ে মোশন, অ্যানিমেশন ও ট্রানজিশনসহ সিনেমাটিক টাইমলাইন তৈরি করুন।
            </p>
            {onGenerateSmartTimeline && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateSmartTimeline();
                }}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-bold flex items-center space-x-2 shadow-lg cursor-pointer pointer-events-auto transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Smart Timeline Now</span>
              </button>
            )}
          </div>
        )}

        {/* CENTER PLAY BUTTON & 16:9 LABEL OVERLAY (Matching Attached Screenshot) */}
        {!isPlaying && totalPhotosCount > 0 && isPreviewEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 hover:bg-black/25 transition-all pointer-events-auto">
            <div className="w-14 h-14 rounded-full bg-white/95 hover:bg-white text-slate-950 shadow-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform mb-2">
              <Play className="w-7 h-7 ml-1 fill-current" />
            </div>
            <span className="text-xs font-bold tracking-wider text-slate-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] uppercase">
              16:9 LIVE VIDEO DISPLAY
            </span>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* B & C. TIMELINE SEEK SLIDER WITH CURRENT / TOTAL TIME    */}
      {/* ======================================================== */}
      <div className="px-4 pt-3 pb-1 bg-[#0b101b] border-t border-slate-800 flex flex-col gap-1.5">
        {/* Time Labels Row: 00:45 on left, 10:00 on right */}
        <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
          <span className="tracking-wide text-sky-400">{formatTime(currentTime)}</span>
          <span className="tracking-wide text-slate-400">{formatTime(totalDuration)}</span>
        </div>

        {/* Sleek Cyan Progress Bar / Seek Slider */}
        <div className="relative w-full flex items-center group/slider py-1">
          {/* Custom Track Background */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
            {/* Bright Cyan Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-75 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Interactive Range Input Overlay */}
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.05}
            value={currentTime}
            disabled={totalPhotosCount === 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onSeek(val);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            title="ভিডিও স্ক্রাবার: টেনে যেকোনো সময়ে যান"
          />

          {/* Glowing Slider Thumb Indicator */}
          <div
            className="absolute w-3.5 h-3.5 bg-white border-2 border-sky-400 rounded-full shadow-md pointer-events-none transform -translate-x-1/2 group-hover/slider:scale-125 transition-transform"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* B & D. COMPLETE VIDEO PLAYER CONTROL BAR                 */}
      {/* ======================================================== */}
      <div className="px-4 py-2.5 bg-[#0b101b] flex items-center justify-between gap-2 border-b border-slate-800/80">
        {/* Left Playback Controls: Prev, Play/Pause, Stop, Next */}
        <div className="flex items-center space-x-1.5">
          {/* 1. Previous Slot Button (|<) */}
          <button
            type="button"
            onClick={onPrevSlot}
            disabled={totalPhotosCount === 0}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="আগের ছবি (Previous Slot)"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* 2. Play / Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={totalPhotosCount === 0}
            className="p-2 text-white hover:text-sky-300 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title={isPlaying ? 'বিরতি (Pause)' : 'চালু করুন (Play)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current text-sky-400" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* 3. Stop Button ([]) - Pauses & Rewinds to 0 */}
          <button
            type="button"
            onClick={onStop}
            disabled={totalPhotosCount === 0}
            className="p-2 text-slate-300 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="ভিডিও স্টপ ও শুরুতে ফিরুন (Stop)"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          {/* 4. Next Slot Button (>|) */}
          <button
            type="button"
            onClick={onNextSlot}
            disabled={totalPhotosCount === 0}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="পরের ছবি (Next Slot)"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Right Controls: Preview ON/OFF, Quality, Volume & Fullscreen */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* E. Live Preview ON/OFF System Toggle */}
          <button
            type="button"
            onClick={onTogglePreview}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              isPreviewEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/80'
                : 'bg-amber-950/80 text-amber-300 border-amber-500/40 hover:bg-amber-900/80'
            }`}
            title="প্রিভিউ চালু অথবা বন্ধ করে CPU/RAM সংরক্ষণ করুন"
          >
            {isPreviewEnabled ? (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Preview:</span>
                <span>ON</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Preview:</span>
                <span>OFF</span>
              </>
            )}
          </button>

          {/* F. Preview Quality Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-700/60 rounded-md p-0.5 text-[10px] font-mono">
            {(['low', 'medium', 'high'] as PreviewQuality[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onChangeQuality(q)}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold uppercase ${
                  previewQuality === q
                    ? 'bg-sky-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`প্রিভিউ রেজুলেশন: ${q === 'low' ? '360p (Low RAM)' : q === 'medium' ? '540p' : '720p HD'}`}
              >
                {q === 'low' ? 'Low' : q === 'medium' ? 'Med' : 'HD'}
              </button>
            ))}
          </div>

          {/* D. Live Audio Volume Control with Percentage Display */}
          <div
            className="relative flex items-center space-x-1.5 group/vol"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={isMuted ? 'সাউন্ড আনমিউট করুন' : 'সাউন্ড মিউট করুন'}
            >
              {isMuted || effectiveVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : effectiveVolume < 0.5 ? (
                <Volume1 className="w-4 h-4 text-sky-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {/* Volume Percentage Badge */}
            <span className="text-xs font-mono font-bold text-slate-300 w-9 text-right">
              {Math.round(effectiveVolume * 100)}%
            </span>

            {/* Expandable/Smooth Volume Slider */}
            <div className="w-16 sm:w-20 flex items-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={effectiveVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onVolumeChange(val);
                }}
                className="w-full accent-sky-400 h-1 bg-slate-700 rounded-full cursor-pointer"
                title="ভলিউম নিয়ন্ত্রণ (0% - 100%)"
              />
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video Display'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* G. LIVE EFFECT INFORMATION DISPLAY (Section G)           */}
      {/* ======================================================== */}
      <div className="px-4 py-2 bg-[#090d16] text-[11px] text-slate-400 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-y-1 gap-x-3">
        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1 font-semibold text-slate-300">
            <Film className="w-3.5 h-3.5 text-sky-400" />
            <span>Image:</span>
            <strong className="text-white font-mono">
              {activeSlotInfo ? `${activeSlotInfo.index} / ${activeSlotInfo.total}` : `0 / ${totalPhotosCount}`}
            </strong>
          </span>

          <span className="text-slate-700">•</span>

          <span className="flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Effect:</span>
            <strong className="text-slate-200 truncate max-w-[120px]">
              {activeSlotInfo?.animationName || 'None'}
            </strong>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1">
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            <span>Transition:</span>
            <strong className="text-slate-200 truncate max-w-[130px]">
              {activeSlotInfo?.transitionName || 'None'}
            </strong>
          </span>

          <span className="text-slate-700">•</span>

          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Duration:</span>
            <strong className="text-slate-200 font-mono">
              {activeSlotInfo?.duration ? `${activeSlotInfo.duration.toFixed(1)}s` : '0s'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
