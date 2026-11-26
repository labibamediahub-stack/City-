/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Clapperboard,
  RotateCcw,
  Mic,
  Minus,
  Plus,
  ChevronDown,
  Download,
  Film,
  Sparkles,
  Scissors,
  Trash2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  X,
  FlipHorizontal,
  Music,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import {
  NatokClip,
  cutNatokTrailerClips,
  calculateTrailerJoinTime,
  generateNatokTrailerScript
} from '../services/natokTrailerEngine';
import {
  ytAudioEngine,
  createTrailerExportAudioPipeline,
  TRAILER_SOUND_FILTER_OPTIONS,
  TRAILER_BGM_OPTIONS,
  type TrailerSoundFilterPreset,
  type TrailerBgmPreset
} from '../services/youtubeSafetyAudioEngine';
import {
  TRAILER_VIDEO_EFFECT_OPTIONS,
  renderTrailerVideoEffect,
  type TrailerVideoEffectId
} from '../services/trailerVideoEffects';
import {
  CustomFrameItem,
  loadCustomFrames
} from '../services/frameManager';
import { FrameManagerModal } from './FrameManagerModal';

interface TailorStudioPanelProps {
  onAddTrailerToIntro?: (trailerBlob: Blob, trailerUrl: string, trailerDuration: number, posterUrl: string) => void;
  onUseAsInputVideo?: (videoBlob: Blob, videoName: string) => void;
  onNavigateTab?: (tab: 'tailor' | 'voice' | 'editor' | 'gallery' | 'video') => void;
  videoDuration?: number;
  screenshots?: any[];
  videoUrl?: string;
  videoName?: string;
  startTrim?: number;
  endTrim?: number;
}

export const TailorStudioPanel: React.FC<TailorStudioPanelProps> = ({
  onAddTrailerToIntro,
  onUseAsInputVideo,
  onNavigateTab,
  videoDuration = 1000,
  screenshots = [],
  videoUrl = '',
  videoName = 'Drama Episode',
  startTrim = 0,
  endTrim = 0
}) => {
  // Dual-Track A/B Video Elements for 1-Second Layered Crossfade & Audio Feathering
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);

  // Active video source (fallback to bundled sample video if none loaded)
  const effectiveVideoUrl = videoUrl || '/assets/aistudio/22_1cc2c2b3.mp4';
  const totalVideoDuration = videoDuration > 0 ? Math.round(videoDuration) : 1000;

  const [trimStartSec, setTrimStartSec] = useState<number>(startTrim > 0 ? startTrim : 0);
  const [trimEndSec, setTrimEndSec] = useState<number>(endTrim > 0 ? endTrim : 0);

  const effectiveStart = Math.min(totalVideoDuration, Math.max(0, trimStartSec));
  const effectiveEnd = Math.max(0, totalVideoDuration - Math.min(totalVideoDuration, Math.max(0, trimEndSec)));
  const activeDuration = Math.max(0, effectiveEnd - effectiveStart);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const [isYtSafe, setIsYtSafe] = useState<boolean>(true);
  const [isThrill, setIsThrill] = useState<boolean>(false);
  const [isStudio, setIsStudio] = useState<boolean>(false);
  const [isReverse, setIsReverse] = useState<boolean>(false);
  const [isDialogue, setIsDialogue] = useState<boolean>(true);
  const [isCrossfade, setIsCrossfade] = useState<boolean>(true);

  const [activeTrack, setActiveTrack] = useState<'A' | 'B'>('A');
  const [topTrack, setTopTrack] = useState<'A' | 'B'>('B');
  const [trackAOpacity, setTrackAOpacity] = useState<number>(1.0);
  const [trackBOpacity, setTrackBOpacity] = useState<number>(0.0);
  const isCrossfadingRef = useRef<boolean>(false);
  const crossfadeTimeoutRef = useRef<any>(null);
  const activeTrackRef = useRef<'A' | 'B'>('A');
  const activeClipIndexRef = useRef<number>(0);
  const transitionedClipsRef = useRef<Set<number>>(new Set());

  const [audioVolume, setAudioVolume] = useState<number>(1.0);
  const [isTrailerMuted, setIsTrailerMuted] = useState<boolean>(false);
  const [bassBoostDb, setBassBoostDb] = useState<number>(3);
  const [vocalClarityDb, setVocalClarityDb] = useState<number>(4);

  const [isBufferOn, setIsBufferOn] = useState<boolean>(false);
  const [bufSec, setBufSec] = useState<number>(2);
  const [clipsCount, setClipsCount] = useState<number>(5);
  const [clipDuration, setClipDuration] = useState<number>(9);

  const [customFramesList, setCustomFramesList] = useState<CustomFrameItem[]>(() => loadCustomFrames());
  const [isFrameModalOpen, setIsFrameModalOpen] = useState<boolean>(false);
  const [selectedPhotoFrame, setSelectedPhotoFrame] = useState<string>('Photo Frame');
  const [selectedVideoFrame, setSelectedVideoFrame] = useState<string>('Video Frame');
  const [activeCustomVideoFrame, setActiveCustomVideoFrame] = useState<CustomFrameItem | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<TrailerVideoEffectId>('none');
  const [isEffectMenuOpen, setIsEffectMenuOpen] = useState<boolean>(false);
  const effectDropdownRef = useRef<HTMLDivElement | null>(null);
  const [effectOpacity, setEffectOpacity] = useState<number>(0.75);
  const effectOpacityRef = useRef<number>(0.75);
  effectOpacityRef.current = effectOpacity;
  const lastEffectTimeSecRef = useRef<number>(0);

  // Copyright-Safe Trailer Audio Controls (BGM + Sound Filter)
  const [soundFilterPreset, setSoundFilterPreset] = useState<TrailerSoundFilterPreset>('anti_copyright');
  const [bgmPreset, setBgmPreset] = useState<TrailerBgmPreset>('cinematic_pad');
  const [bgmVolume, setBgmVolume] = useState<number>(0.16);
  const [customBgmFile, setCustomBgmFile] = useState<File | null>(null);
  const [customBgmUrl, setCustomBgmUrl] = useState<string>('');
  const customBgmInputRef = useRef<HTMLInputElement | null>(null);
  const customBgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const effectOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [outputFormat, setOutputFormat] = useState<'mp4' | 'webm'>('mp4');
  const [hasIntro, setHasIntro] = useState<boolean>(false);
  const [isMirror, setIsMirror] = useState<boolean>(false);
  const [trailerSeed, setTrailerSeed] = useState<number>(0);

  const [natokClips, setNatokClips] = useState<NatokClip[]>([]);

  const [activeClipIndex, setActiveClipIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [trailerCurrentSec, setTrailerCurrentSec] = useState<number>(0);
  const [rawVideoCurrentSec, setRawVideoCurrentSec] = useState<number>(0);
  const [isTrailerMode, setIsTrailerMode] = useState<boolean>(true);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const wasPlayingBeforeScrubRef = useRef<boolean>(false);
  const scrubRafRef = useRef<number | null>(null);
  const [lastExportedTrailer, setLastExportedTrailer] = useState<{
    blob: Blob;
    url: string;
    name: string;
    duration: number;
  } | null>(null);

  const [showAiScriptModal, setShowAiScriptModal] = useState<boolean>(false);
  const [aiScriptData, setAiScriptData] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const joinTimeStats = calculateTrailerJoinTime(natokClips, hasIntro, isBufferOn, bufSec);

  const activePlayerDuration = isTrailerMode
    ? Math.max(1, joinTimeStats.totalSeconds)
    : Math.max(1, effectiveEnd - effectiveStart);

  const activePlayerCurrentSec = isTrailerMode
    ? trailerCurrentSec
    : Math.max(0, rawVideoCurrentSec - effectiveStart);

  useEffect(() => {
    if (videoRefA.current && videoRefB.current) {
      ytAudioEngine.attachDualVideoElements(videoRefA.current, videoRefB.current);
    }
  }, [effectiveVideoUrl]);

  useEffect(() => {
    ytAudioEngine.applySettings({
      isYtSafe,
      isStudio,
      isThrill,
      isDialogue,
      isCrossfade,
      pitchShiftSemitones: isYtSafe ? 0.8 : 0,
      bassBoostDb,
      vocalClarityDb,
      masterVolume: isTrailerMuted ? 0 : audioVolume,
      isMuted: isTrailerMuted,
      soundFilterPreset,
      bgmPreset,
      bgmVolume
    });
  }, [
    isYtSafe,
    isStudio,
    isThrill,
    isDialogue,
    isCrossfade,
    bassBoostDb,
    vocalClarityDb,
    audioVolume,
    isTrailerMuted,
    soundFilterPreset,
    bgmPreset,
    bgmVolume
  ]);

  // Keep preview procedural/custom BGM synced with play/pause & mute state
  useEffect(() => {
    const shouldPlayBgm = isPlaying && !isTrailerMuted && bgmPreset !== 'off';
    ytAudioEngine.setPreviewBgmPlaying(shouldPlayBgm && bgmPreset !== 'custom');

    const customEl = customBgmAudioRef.current;
    if (customEl) {
      customEl.volume = Math.max(0, Math.min(0.45, bgmVolume));
      if (shouldPlayBgm && bgmPreset === 'custom' && customBgmUrl) {
        customEl.play().catch(() => {});
      } else {
        customEl.pause();
      }
    }
  }, [isPlaying, isTrailerMuted, bgmPreset, bgmVolume, customBgmUrl]);

  useEffect(() => {
    return () => {
      ytAudioEngine.setPreviewBgmPlaying(false);
    };
  }, []);

  // Close compact video-effect dropdown when clicking/tapping outside
  useEffect(() => {
    if (!isEffectMenuOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (effectDropdownRef.current && !effectDropdownRef.current.contains(e.target as Node)) {
        setIsEffectMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [isEffectMenuOpen]);

  // Video-only effect preview loop (strictly on the video layer below Video Frames)
  useEffect(() => {
    const canvas = effectOverlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!selectedEffect || selectedEffect === 'none') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let animId = 0;
    let lastFrameTime = 0;
    const startMs = performance.now();
    const frameIntervalMs = 42; // ~24fps smooth & battery-friendly on mobile

    const drawEffectFrame = (now: number) => {
      if (document.hidden) {
        animId = requestAnimationFrame(drawEffectFrame);
        return;
      }
      if (now - lastFrameTime >= frameIntervalMs || lastFrameTime === 0) {
        lastFrameTime = now;
        const tSec = isPlaying ? (now - startMs) / 1000 : (now - startMs) / 2200;
        lastEffectTimeSecRef.current = tSec;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderTrailerVideoEffect(ctx, selectedEffect, tSec, canvas.width, canvas.height, effectOpacityRef.current);
      }
      animId = requestAnimationFrame(drawEffectFrame);
    };

    animId = requestAnimationFrame(drawEffectFrame);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [selectedEffect, isPlaying]);

  // Real-time smooth slider tracker loop while video is playing
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    const trackSmoothProgress = () => {
      // Do not overwrite slider position while user is scrubbing
      if (isScrubbingRef.current) {
        animId = requestAnimationFrame(trackSmoothProgress);
        return;
      }
      const curTrack = activeTrackRef.current;
      const vid = curTrack === 'A' ? videoRefA.current : videoRefB.current;
      if (vid && !vid.paused && !vid.seeking) {
        const vTime = vid.currentTime;
        if (!isTrailerMode) {
          setRawVideoCurrentSec(vTime);
        } else {
          const curIdx = activeClipIndexRef.current;
          const clip = natokClips[curIdx];
          if (clip) {
            let cumulative = hasIntro ? 3 : 0;
            for (let i = 0; i < curIdx; i++) {
              cumulative += natokClips[i].duration + (isBufferOn ? bufSec : 0);
            }
            const offset = Math.max(0, Math.min(vTime - clip.startTime, clip.duration));
            setTrailerCurrentSec(cumulative + offset);
          }
        }
      }
      animId = requestAnimationFrame(trackSmoothProgress);
    };
    animId = requestAnimationFrame(trackSmoothProgress);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isTrailerMode, natokClips, hasIntro, isBufferOn, bufSec]);

  const triggerNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(null);
    }, 4500);
  };

  const handleCutNatokTrailer = useCallback(() => {
    const thumbs = screenshots.map((s) => s.dataUrl).filter(Boolean);
    const nextSeed = trailerSeed + 1;
    setTrailerSeed(nextSeed);

    const newClips = cutNatokTrailerClips({
      videoDuration: totalVideoDuration,
      startRange: effectiveStart,
      endRange: effectiveEnd,
      clipsCount,
      clipDuration,
      bufSec,
      isBufferOn,
      isThrill,
      isDialogue,
      isReverse,
      availableThumbnails: thumbs,
      seed: nextSeed
    });

    setNatokClips(newClips);
    setActiveClipIndex(0);
    setTrailerCurrentSec(0);
    setActiveTrack('A');
    setTopTrack('A');
    activeTrackRef.current = 'A';
    activeClipIndexRef.current = 0;
    transitionedClipsRef.current.clear();
    setTrackAOpacity(1.0);
    setTrackBOpacity(0.0);
    isCrossfadingRef.current = false;
    if (crossfadeTimeoutRef.current) clearTimeout(crossfadeTimeoutRef.current);
    ytAudioEngine.setActiveTrackInstant('A');

    if (videoRefA.current && newClips.length > 0) {
      videoRefA.current.currentTime = newClips[0].startTime;
      videoRefA.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    if (videoRefB.current) {
      videoRefB.current.pause();
      if (newClips.length > 1) {
        videoRefB.current.currentTime = newClips[1].startTime;
      }
    }

    const { formattedTime } = calculateTrailerJoinTime(newClips, hasIntro, isBufferOn, bufSec);
    triggerNotification(
      `🎬 [New Cut #${nextSeed}] Generated ${newClips.length} clips with dialogue preserved! Duration: ${formattedTime}`
    );
  }, [
    trailerSeed,
    totalVideoDuration,
    effectiveStart,
    effectiveEnd,
    clipsCount,
    clipDuration,
    bufSec,
    isBufferOn,
    isThrill,
    isDialogue,
    isReverse,
    screenshots,
    hasIntro
  ]);

  const preBufferUpcomingClip = useCallback((clipIdx: number, idleTrack: 'A' | 'B') => {
    if (clipIdx >= natokClips.length || clipIdx < 0) return;
    const clip = natokClips[clipIdx];
    if (!clip) return;

    const idleVid = idleTrack === 'A' ? videoRefA.current : videoRefB.current;
    if (!idleVid) return;

    if (Math.abs(idleVid.currentTime - clip.startTime) > 0.15) {
      idleVid.currentTime = clip.startTime;
    }
    idleVid.pause();
  }, [natokClips]);

  const togglePlay = () => {
    const curTrack = activeTrackRef.current;
    const currentVideo = curTrack === 'A' ? videoRefA.current : videoRefB.current;
    if (!currentVideo) return;

    if (isPlaying) {
      videoRefA.current?.pause();
      videoRefB.current?.pause();
      setIsPlaying(false);
    } else {
      const curIdx = activeClipIndexRef.current;
      const currentClip = natokClips[curIdx];
      if (
        curIdx >= natokClips.length - 1 &&
        currentClip &&
        currentVideo.currentTime >= currentClip.endTime - 0.2
      ) {
        handleSelectClip(0);
      } else {
        if (curTrack === 'A') {
          setTrackAOpacity(1.0);
        } else {
          setTrackBOpacity(1.0);
        }
        ytAudioEngine.setActiveTrackInstant(curTrack);
        currentVideo.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const startOneSecondPreCrossfade = useCallback(
    (currentTrack: 'A' | 'B', nextClipIdx: number) => {
      if (isCrossfadingRef.current || natokClips.length === 0) return;
      isCrossfadingRef.current = true;

      const nextTrack = currentTrack === 'A' ? 'B' : 'A';
      const outgoingVideo = currentTrack === 'A' ? videoRefA.current : videoRefB.current;
      const incomingVideo = nextTrack === 'A' ? videoRefA.current : videoRefB.current;
      const nextClip = natokClips[nextClipIdx];

      if (!incomingVideo || !outgoingVideo || !nextClip) {
        isCrossfadingRef.current = false;
        return;
      }

      setTopTrack(nextTrack);

      if (Math.abs(incomingVideo.currentTime - nextClip.startTime) > 0.3) {
        incomingVideo.currentTime = nextClip.startTime;
      }

      if (nextTrack === 'B') {
        setTrackBOpacity(0.0);
        setTrackAOpacity(1.0);
      } else {
        setTrackAOpacity(0.0);
        setTrackBOpacity(1.0);
      }

      activeTrackRef.current = nextTrack;
      activeClipIndexRef.current = nextClipIdx;
      setActiveTrack(nextTrack);
      setActiveClipIndex(nextClipIdx);

      const executeSmoothCrossfade = () => {
        ytAudioEngine.featherAudioCrossfade(currentTrack, 1.0);

        if (nextTrack === 'B') {
          setTrackBOpacity(1.0);
          setTrackAOpacity(0.0);
        } else {
          setTrackAOpacity(1.0);
          setTrackBOpacity(0.0);
        }

        if (crossfadeTimeoutRef.current) clearTimeout(crossfadeTimeoutRef.current);
        crossfadeTimeoutRef.current = setTimeout(() => {
          outgoingVideo.pause();
          if (currentTrack === 'A') {
            setTrackAOpacity(0.0);
          } else {
            setTrackBOpacity(0.0);
          }
          isCrossfadingRef.current = false;
          preBufferUpcomingClip(nextClipIdx + 1, currentTrack);
        }, 1000);
      };

      const playPromise = incomingVideo.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            requestAnimationFrame(executeSmoothCrossfade);
          })
          .catch(() => {
            requestAnimationFrame(executeSmoothCrossfade);
          });
      } else {
        requestAnimationFrame(executeSmoothCrossfade);
      }
    },
    [natokClips, preBufferUpcomingClip]
  );

  const handleTimeUpdateForTrack = (track: 'A' | 'B') => {
    if (isScrubbingRef.current || track !== activeTrackRef.current || natokClips.length === 0) return;

    const vid = track === 'A' ? videoRefA.current : videoRefB.current;
    if (!vid) return;

    const vTime = vid.currentTime;
    setRawVideoCurrentSec(vTime);

    if (!isTrailerMode) {
      if (vTime >= effectiveEnd) {
        vid.pause();
        setIsPlaying(false);
      }
      return;
    }

    const currentClipIdx = activeClipIndexRef.current;
    const currentClip = natokClips[currentClipIdx];
    if (!currentClip) return;

    const isLastClip = currentClipIdx >= natokClips.length - 1;
    const timeRemainingInClip = currentClip.endTime - vTime;

    if (isLastClip) {
      if (timeRemainingInClip <= 1.05 && timeRemainingInClip > 0.05 && !isCrossfadingRef.current) {
        isCrossfadingRef.current = true;
        ytAudioEngine.featherFadeOutOnly(track, 1.0);
        if (track === 'A') {
          setTrackAOpacity(0.0);
        } else {
          setTrackBOpacity(0.0);
        }
      } else if (vTime >= currentClip.endTime) {
        videoRefA.current?.pause();
        videoRefB.current?.pause();
        setIsPlaying(false);
        isCrossfadingRef.current = false;
        triggerNotification('🎬 Trailer playback finished successfully!');
        return;
      }
    } else {
      if (
        timeRemainingInClip <= 1.05 &&
        timeRemainingInClip > 0.05 &&
        !transitionedClipsRef.current.has(currentClipIdx) &&
        !isCrossfadingRef.current
      ) {
        transitionedClipsRef.current.add(currentClipIdx);
        startOneSecondPreCrossfade(track, currentClipIdx + 1);
      }
    }

    let cumulative = hasIntro ? 3 : 0;
    for (let i = 0; i < currentClipIdx; i++) {
      cumulative += natokClips[i].duration + (isBufferOn ? bufSec : 0);
    }
    const offsetInClip = Math.max(0, Math.min(vTime - currentClip.startTime, currentClip.duration));
    setTrailerCurrentSec(cumulative + offsetInClip);
  };

  const handleSelectClip = (idx: number) => {
    if (!natokClips[idx]) return;
    if (crossfadeTimeoutRef.current) clearTimeout(crossfadeTimeoutRef.current);
    isCrossfadingRef.current = false;

    activeTrackRef.current = 'A';
    activeClipIndexRef.current = idx;
    transitionedClipsRef.current.clear();
    for (let i = 0; i < idx; i++) {
      transitionedClipsRef.current.add(i);
    }

    setActiveClipIndex(idx);
    setActiveTrack('A');
    setTopTrack('A');
    setTrackAOpacity(1.0);
    setTrackBOpacity(0.0);
    ytAudioEngine.setActiveTrackInstant('A');

    if (videoRefA.current) {
      videoRefA.current.currentTime = natokClips[idx].startTime;
      if (!isPlaying) {
        videoRefA.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
    if (videoRefB.current) {
      videoRefB.current.pause();
      preBufferUpcomingClip(idx + 1, 'B');
    }
  };

  const handleNudgeClipStart = (idx: number, delta: number) => {
    setNatokClips((prev) =>
      prev.map((clip, i) => {
        if (i !== idx) return clip;
        const newStart = Math.max(effectiveStart, Math.min(clip.startTime + delta, effectiveEnd - clip.duration));
        return {
          ...clip,
          startTime: Math.round(newStart * 10) / 10,
          endTime: Math.round((newStart + clip.duration) * 10) / 10
        };
      })
    );
    if (idx === activeClipIndex) {
      const activeVid = activeTrack === 'A' ? videoRefA.current : videoRefB.current;
      if (activeVid) {
        activeVid.currentTime = Math.max(effectiveStart, natokClips[idx].startTime + delta);
      }
    }
  };

  const handleDeleteClip = (idx: number) => {
    if (natokClips.length <= 1) {
      triggerNotification('At least 1 clip is required!');
      return;
    }
    const updated = natokClips.filter((_, i) => i !== idx);
    setNatokClips(updated);
    if (activeClipIndex >= updated.length) {
      setActiveClipIndex(0);
    }
  };

  const handleAddClip = () => {
    const lastClip = natokClips[natokClips.length - 1];
    const newStart = lastClip ? Math.min(lastClip.endTime + 10, effectiveEnd - clipDuration) : effectiveStart + 10;
    const newClip: NatokClip = {
      id: `clip-${natokClips.length + 1}-${Date.now().toString().slice(-4)}`,
      index: natokClips.length + 1,
      title: `Custom Clip #${natokClips.length + 1}`,
      banglaTitle: `Clip #${natokClips.length + 1} (New Cut)`,
      sceneType: 'conflict',
      startTime: Math.round(newStart * 10) / 10,
      endTime: Math.round((newStart + clipDuration) * 10) / 10,
      duration: clipDuration,
      thumbnailUrl: screenshots[0]?.dataUrl || '/assets/aistudio/screenshot_027_12-25_c0548274.jpg',
      tagColor: 'from-amber-500 to-indigo-500'
    };
    setNatokClips([...natokClips, newClip]);
    triggerNotification(`+1 New Clip #${natokClips.length + 1} added!`);
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
  };

  const formatTimeStr = (secs: number) => {
    const safe = Math.max(0, isNaN(secs) ? 0 : Math.round(secs));
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleOpenAiScript = () => {
    const script = generateNatokTrailerScript(videoName, natokClips.length, isThrill);
    setAiScriptData(script);
    setShowAiScriptModal(true);
  };

  const handleSpeakScript = () => {
    if (!aiScriptData) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(aiScriptData.fullVoiceoverText);
    utter.rate = isThrill ? 1.05 : 0.95;
    utter.pitch = 1.0;
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const handleCopyScript = () => {
    if (!aiScriptData) return;
    navigator.clipboard.writeText(aiScriptData.fullVoiceoverText);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleSelectVideoFrameFromModal = (frame: CustomFrameItem) => {
    setSelectedVideoFrame(frame.name);
    if (frame.dataUrl) {
      setActiveCustomVideoFrame(frame);
    } else {
      setActiveCustomVideoFrame(null);
    }
    setCustomFramesList(loadCustomFrames());
    triggerNotification(`🎬 Video frame selected: ${frame.name}`);
  };

  const handleSelectPhotoFrameFromModal = (frame: CustomFrameItem) => {
    setSelectedPhotoFrame(frame.name);
    setCustomFramesList(loadCustomFrames());
    triggerNotification(`🖼️ Photo frame selected: ${frame.name}`);
  };

  const handleExportTrailerVideo = async (autoAddToIntro: boolean = true) => {
    if (natokClips.length === 0) {
      triggerNotification('টেইলার রেন্ডার করার মতো কোনো দৃশ্য নেই।');
      return;
    }

    // Pause live preview playback so preview audio & BGM do not overlap recording
    videoRefA.current?.pause();
    videoRefB.current?.pause();
    setIsPlaying(false);

    setIsRecording(true);
    setRecordProgress(5);
    triggerNotification(`🎬 কপিরাইট-সেফ অডিও ও ইফেক্টসহ টেইলার রেন্ডারিং শুরু হচ্ছে (${outputFormat.toUpperCase()})...`);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not supported');

      // Create a background video element dedicated to recording the clip sequence
      const renderVid = document.createElement('video');
      renderVid.style.position = 'fixed';
      renderVid.style.opacity = '0';
      renderVid.style.pointerEvents = 'none';
      renderVid.crossOrigin = 'anonymous';
      renderVid.src = effectiveVideoUrl;
      renderVid.muted = false;
      renderVid.playsInline = true;
      document.body.appendChild(renderVid);

      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 2500);
        renderVid.onloadedmetadata = () => {
          clearTimeout(t);
          resolve();
        };
        renderVid.onerror = () => {
          clearTimeout(t);
          resolve();
        };
        renderVid.load();
      });

      // Stream & Copyright-Safe Audio DSP + BGM mixing
      const canvasStream = canvas.captureStream(30);
      let combinedStream: MediaStream = canvasStream;
      let renderAudioCtx: AudioContext | null = null;
      let audioPipelineCleanup: (() => void) | null = null;

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          renderAudioCtx = new AudioCtx();
          const pipeline = await createTrailerExportAudioPipeline(renderAudioCtx, renderVid, {
            isYtSafe,
            isStudio,
            isThrill,
            isDialogue,
            bassBoostDb,
            vocalClarityDb,
            masterVolume: audioVolume,
            isMuted: isTrailerMuted,
            soundFilterPreset,
            bgmPreset,
            bgmVolume,
            customBgmFile
          });
          audioPipelineCleanup = pipeline.cleanup;
          combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...pipeline.destination.stream.getAudioTracks()
          ]);
        }
      } catch (audioErr) {
        console.warn('Audio mixing setup fallback:', audioErr);
      }

      // Codec selection - prioritizes true MP4 codecs when MP4 is selected
      let chosenMime = '';
      let isRealMp4 = false;
      if (outputFormat === 'mp4') {
        const mp4Types = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1',
          'video/mp4;codecs=h264',
          'video/mp4'
        ];
        chosenMime = mp4Types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
        if (chosenMime) {
          isRealMp4 = true;
        }
      }
      if (!chosenMime) {
        const webmTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=h264',
          'video/webm'
        ];
        chosenMime = webmTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || 'video/webm';
        isRealMp4 = false;
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: chosenMime,
        videoBitsPerSecond: 5000000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const introSec = hasIntro ? 3 : 0;
      const totalSeconds = Math.max(3, joinTimeStats.totalSeconds);
      let capturedThumb = '';

      recorder.onstop = () => {
        const realFormat = isRealMp4 ? 'mp4' : 'webm';
        const finalBlobType = isRealMp4 ? 'video/mp4' : 'video/webm';
        const blob = new Blob(chunks, { type: finalBlobType });

        if (blob.size < 1024) {
          setIsRecording(false);
          triggerNotification('❌ ভিডিও রেন্ডারিং ব্যর্থ: আউটপুট ফাইল অসম্পূর্ণ।');
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        const cleanDramaName = (videoName || 'natok_trailer').replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_');
        const filename = `${cleanDramaName}_trailer_${Date.now()}.${realFormat}`;

        // 1. Direct download as real MP4 / WEBM
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setIsRecording(false);
        setRecordProgress(100);

        setLastExportedTrailer({
          blob,
          url: blobUrl,
          name: filename,
          duration: totalSeconds
        });

        // 2. Automatically add to Timeline as Intro Video
        if (autoAddToIntro && onAddTrailerToIntro) {
          const thumb = capturedThumb || natokClips[0]?.thumbnailUrl || '';
          onAddTrailerToIntro(blob, blobUrl, totalSeconds, thumb);
          triggerNotification(`✅ টেইলার ${realFormat.toUpperCase()} ডাউনলোড সম্পন্ন এবং টাইমলাইনের শুরুতে ইন্ট্রো হিসেবে যুক্ত হয়েছে!`);
        } else {
          triggerNotification(`✅ টেইলার ${realFormat.toUpperCase()} ডাউনলোড সম্পন্ন হয়েছে!`);
        }

        try {
          audioPipelineCleanup?.();
          renderVid.pause();
          if (renderVid.parentNode) {
            renderVid.parentNode.removeChild(renderVid);
          }
          if (renderAudioCtx && renderAudioCtx.state !== 'closed') {
            renderAudioCtx.close().catch(() => {});
          }
        } catch (_) {}
      };

      // Preload custom video frame image once so frame rendering never misses frames
      let preloadedCustomFrameImg: HTMLImageElement | null = null;
      if (activeCustomVideoFrame?.dataUrl) {
        preloadedCustomFrameImg = new Image();
        preloadedCustomFrameImg.src = activeCustomVideoFrame.dataUrl;
      }

      recorder.start(100);

      // Frame animation across the sequence of clips
      const fps = 30;
      const stepMs = 1000 / fps;
      let currentClipIdx = 0;
      let clipTime = 0;
      let elapsedTotal = 0;
      let isInIntro = hasIntro;

      renderVid.currentTime = natokClips[0].startTime;
      renderVid.play().catch(() => {});

      const timer = setInterval(() => {
        elapsedTotal += stepMs / 1000;
        setRecordProgress(Math.min(99, Math.round((elapsedTotal / totalSeconds) * 100)));

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (isInIntro && elapsedTotal < introSec) {
          // Render dramatic intro title card
          ctx.fillStyle = '#080d1a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const grad = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 40,
            canvas.width / 2, canvas.height / 2, 480
          );
          grad.addColorStop(0, 'rgba(147, 51, 234, 0.4)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.font = 'bold 44px sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(videoName || 'DRAMA TRAILER', canvas.width / 2, canvas.height / 2 - 25);

          ctx.font = 'bold 22px sans-serif';
          ctx.fillStyle = '#c084fc';
          ctx.fillText('SPECIAL PREVIEW / নাটক ট্রেলার', canvas.width / 2, canvas.height / 2 + 35);
        } else {
          if (isInIntro) {
            isInIntro = false;
            clipTime = 0;
            currentClipIdx = 0;
            renderVid.currentTime = natokClips[0].startTime;
            renderVid.play().catch(() => {});
          }

          const curClip = natokClips[currentClipIdx];
          if (curClip) {
            clipTime += stepMs / 1000;
            if (clipTime >= curClip.duration) {
              currentClipIdx++;
              clipTime = 0;
              if (currentClipIdx < natokClips.length) {
                renderVid.currentTime = natokClips[currentClipIdx].startTime;
                renderVid.play().catch(() => {});
              }
            }

            if (isMirror) {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }

            try {
              ctx.drawImage(renderVid, 0, 0, canvas.width, canvas.height);
            } catch (_) {}

            if (isMirror) {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
            }

            // Render Video-Only Effect strictly on the video layer (BEFORE Video Frames!)
            if (selectedEffect && selectedEffect !== 'none') {
              renderTrailerVideoEffect(ctx, selectedEffect, elapsedTotal, canvas.width, canvas.height, effectOpacityRef.current);
            }

            // Render Video Frames AFTER video effect so effects never cover frames
            if (preloadedCustomFrameImg && preloadedCustomFrameImg.complete && preloadedCustomFrameImg.naturalWidth > 0) {
              ctx.drawImage(preloadedCustomFrameImg, 0, 0, canvas.width, canvas.height);
            }
            if (selectedVideoFrame.includes('Cinema Scope')) {
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, canvas.width, 52);
              ctx.fillRect(0, canvas.height - 52, canvas.width, 52);
            } else if (selectedVideoFrame.includes('Filmstrip')) {
              ctx.save();
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
              ctx.lineWidth = 8;
              ctx.setLineDash([16, 10]);
              ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
              ctx.restore();
            } else if (selectedVideoFrame.includes('Minimalist')) {
              ctx.strokeStyle = 'rgba(34, 211, 238, 0.72)';
              ctx.lineWidth = 4;
              ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
            } else if (selectedVideoFrame.includes('Gold')) {
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
              ctx.lineWidth = 10;
              ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            }
          }
        }

        if (!capturedThumb && elapsedTotal >= (hasIntro ? 3.2 : 0.5)) {
          try {
            capturedThumb = canvas.toDataURL('image/jpeg', 0.85);
          } catch (_) {}
        }

        ctx.restore();

        if (elapsedTotal >= totalSeconds || currentClipIdx >= natokClips.length) {
          clearInterval(timer);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, stepMs);

    } catch (err) {
      console.error('Trailer render error:', err);
      setIsRecording(false);
      triggerNotification('রেন্ডার ব্যর্থ হয়েছে, ব্রাউজারের কোডেক সেটিংস চেক করুন।');
    }
  };

  const handleScrubStart = () => {
    isScrubbingRef.current = true;
    wasPlayingBeforeScrubRef.current = isPlaying;
    if (isPlaying) {
      videoRefA.current?.pause();
      videoRefB.current?.pause();
      setIsPlaying(false);
    }
  };

  const handleScrubEnd = () => {
    isScrubbingRef.current = false;
    if (wasPlayingBeforeScrubRef.current) {
      const curTrack = activeTrackRef.current;
      const vid = curTrack === 'A' ? videoRefA.current : videoRefB.current;
      if (vid) {
        vid.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const handlePlayerScrub = (newVal: number) => {
    if (isNaN(newVal) || newVal < 0) return;

    if (isTrailerMode) {
      setTrailerCurrentSec(newVal);
      let accumulated = hasIntro ? 3 : 0;
      for (let i = 0; i < natokClips.length; i++) {
        const dur = natokClips[i].duration + (isBufferOn ? bufSec : 0);
        if (newVal <= accumulated + dur || i === natokClips.length - 1) {
          const inClip = Math.max(0, Math.min(newVal - accumulated, natokClips[i].duration));
          const targetTime = natokClips[i].startTime + inClip;

          if (activeClipIndexRef.current !== i) {
            activeClipIndexRef.current = i;
            setActiveClipIndex(i);
          }

          const curVid = activeTrackRef.current === 'A' ? videoRefA.current : videoRefB.current;
          if (curVid) {
            if (scrubRafRef.current) cancelAnimationFrame(scrubRafRef.current);
            scrubRafRef.current = requestAnimationFrame(() => {
              if (Math.abs(curVid.currentTime - targetTime) > 0.05) {
                curVid.currentTime = targetTime;
              }
            });
          }
          break;
        }
        accumulated += dur;
      }
    } else {
      const targetTime = Math.min(effectiveEnd, Math.max(effectiveStart, effectiveStart + newVal));
      setRawVideoCurrentSec(targetTime);
      const curVid = activeTrackRef.current === 'A' ? videoRefA.current : videoRefB.current;
      if (curVid) {
        if (scrubRafRef.current) cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = requestAnimationFrame(() => {
          if (Math.abs(curVid.currentTime - targetTime) > 0.05) {
            curVid.currentTime = targetTime;
          }
        });
      }
    }
  };

  const handleUseAsInputVideoClick = () => {
    if (lastExportedTrailer) {
      if (onUseAsInputVideo) {
        onUseAsInputVideo(lastExportedTrailer.blob, lastExportedTrailer.name);
      }
      if (onNavigateTab) {
        onNavigateTab('editor');
      }
      triggerNotification('✅ টেইলার ভিডিওটি মূল এডিটিং টাইমলাইনে ইনপুট ভিডিও হিসেবে সফলভাবে সেট করা হয়েছে!');
    } else {
      triggerNotification('টেইলার আগে রেন্ডার হতে হবে। রেন্ডারিং শুরু হচ্ছে...');
      handleExportTrailerVideo(true);
    }
  };

  const handleStartTrimChange = (newVal: number) => {
    setTrimStartSec(newVal);
    const curTrack = activeTrackRef.current;
    const activeVid = curTrack === 'A' ? videoRefA.current : videoRefB.current;
    if (activeVid) {
      activeVid.currentTime = newVal;
    }
  };

  const handleEndTrimChange = (newVal: number) => {
    setTrimEndSec(newVal);
    const endPoint = Math.max(0, totalVideoDuration - newVal);
    const curTrack = activeTrackRef.current;
    const activeVid = curTrack === 'A' ? videoRefA.current : videoRefB.current;
    if (activeVid) {
      activeVid.currentTime = endPoint;
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none text-slate-100">
      {/* Dynamic Status Toast Banner */}
      {statusNotification && (
        <div className="w-full bg-[#0f172a] border border-amber-500/60 text-amber-200 px-3 py-2 rounded-none text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{statusNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotification(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Grid: Video Preview (Left) & Tailor Controls (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 w-full items-start">
        {/* Left: Responsive 16:9 Sharp Preview Display & Under-Screen Controls */}
        <div className="xl:col-span-6 flex flex-col gap-2 w-full">
          <div
            id="tailor-tv-screen"
            onClick={togglePlay}
            className="w-full aspect-video bg-black relative overflow-hidden flex items-center justify-center cursor-pointer select-none rounded-none border border-slate-800"
            title="Play / Pause"
          >
            {activeCustomVideoFrame?.dataUrl && (
              <img
                src={activeCustomVideoFrame.dataUrl}
                alt="Custom Frame Overlay"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
              />
            )}

            {selectedVideoFrame.includes('Cinema Scope') && (
              <>
                <div className="absolute top-0 inset-x-0 h-6 bg-black z-20 pointer-events-none border-b border-slate-900" />
                <div className="absolute bottom-0 inset-x-0 h-6 bg-black z-20 pointer-events-none border-t border-slate-900" />
              </>
            )}

            {selectedVideoFrame.includes('Filmstrip') && (
              <div className="absolute inset-0 border-4 border-dashed border-amber-500/40 z-20 pointer-events-none" />
            )}

            {selectedVideoFrame.includes('Minimalist') && (
              <div className="absolute inset-1 border-2 border-cyan-400/70 z-20 pointer-events-none" />
            )}

            {selectedVideoFrame.includes('Gold') && (
              <div className="absolute inset-1.5 border-4 border-amber-500/80 z-20 pointer-events-none" />
            )}

            <video
              ref={videoRefA}
              src={effectiveVideoUrl}
              preload="auto"
              playsInline
              muted={isTrailerMuted}
              onTimeUpdate={() => handleTimeUpdateForTrack('A')}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
                isMirror ? 'scale-x-[-1]' : ''
              } ${topTrack === 'A' ? 'z-10' : 'z-5'}`}
              style={{
                opacity: trackAOpacity,
                transform: `scale(${zoomLevel})${isMirror ? ' scaleX(-1)' : ''}`
              }}
            />

            <video
              ref={videoRefB}
              src={effectiveVideoUrl}
              preload="auto"
              playsInline
              muted={isTrailerMuted}
              onTimeUpdate={() => handleTimeUpdateForTrack('B')}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
                isMirror ? 'scale-x-[-1]' : ''
              } ${topTrack === 'B' ? 'z-10' : 'z-5'}`}
              style={{
                opacity: trackBOpacity,
                transform: `scale(${zoomLevel})${isMirror ? ' scaleX(-1)' : ''}`
              }}
            />

            {/* Video-Only Effect Layer (sits directly on top of <video>, strictly below z-20 Video Frames) */}
            <canvas
              ref={effectOverlayCanvasRef}
              width={640}
              height={360}
              className="absolute inset-0 w-full h-full pointer-events-none z-[15]"
            />

            {customBgmUrl && (
              <audio
                ref={customBgmAudioRef}
                src={customBgmUrl}
                loop
                preload="auto"
                className="hidden"
              />
            )}
          </div>

          {/* Under-Screen Player Bar */}
          <div className="w-full bg-[#0f172a] border border-slate-800 p-2 rounded-none flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={togglePlay}
                className={`h-8 px-3 rounded-none border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                  isPlaying
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isTrailerMuted;
                  setIsTrailerMuted(nextMuted);
                  if (videoRefA.current) videoRefA.current.muted = nextMuted;
                  if (videoRefB.current) videoRefB.current.muted = nextMuted;
                  ytAudioEngine.applySettings({ isMuted: nextMuted });
                  triggerNotification(nextMuted ? 'Audio muted' : 'Audio enabled');
                }}
                className={`h-8 px-2.5 rounded-none border font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shrink-0 ${
                  !isTrailerMuted
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isTrailerMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-200" />}
                <span>{isTrailerMuted ? 'Muted' : 'Sound'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <span className="text-[11px] font-mono tabular-nums text-amber-400 shrink-0">
                {formatTimeStr(activePlayerCurrentSec)}
              </span>

              <input
                type="range"
                min={0}
                max={Math.max(1, activePlayerDuration)}
                step="any"
                value={activePlayerCurrentSec}
                onPointerDown={handleScrubStart}
                onPointerUp={handleScrubEnd}
                onTouchStart={handleScrubStart}
                onTouchEnd={handleScrubEnd}
                onMouseDown={handleScrubStart}
                onMouseUp={handleScrubEnd}
                onChange={(e) => handlePlayerScrub(parseFloat(e.target.value))}
                className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-none cursor-pointer"
              />

              <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                {formatTimeStr(activePlayerDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Tailor Controls Table */}
        <div className="xl:col-span-6 w-full bg-[#0f172a] border border-slate-800 rounded-none divide-y divide-slate-800">
          {/* Row 0: Title & Stats */}
          <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wide">
                Trailer Tailor
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono tabular-nums bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded-none border border-amber-700/60">
                Total: {joinTimeStats.formattedTime}
              </span>
              <span className="text-[11px] font-mono tabular-nums bg-slate-900 text-slate-300 px-2 py-0.5 rounded-none border border-slate-700">
                Active: {formatTimeStr(activeDuration)}
              </span>
            </div>
          </div>

          {/* Row 1: Trim Range */}
          <div className="p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Trim Range</span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-300">
                {formatTimeStr(effectiveStart)} - {formatTimeStr(effectiveEnd)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Start Trim</span>
                  <span className="text-amber-400 font-mono tabular-nums">{formatTimeStr(trimStartSec)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, totalVideoDuration - 10)}
                  step={1}
                  value={trimStartSec}
                  onChange={(e) => handleStartTrimChange(Number(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-none cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>End Trim</span>
                  <span className="text-rose-400 font-mono tabular-nums">{formatTimeStr(trimEndSec)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, totalVideoDuration - 10)}
                  step={1}
                  value={trimEndSec}
                  onChange={(e) => handleEndTrimChange(Number(e.target.value))}
                  className="w-full accent-rose-400 h-1.5 bg-slate-800 rounded-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Zoom Level */}
          <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
              <span>Zoom</span>
              <span className="text-amber-400 font-mono tabular-nums">{zoomLevel.toFixed(1)}x</span>
            </span>

            <div className="flex items-center gap-2 flex-1 min-w-[160px] sm:max-w-[65%]">
              <input
                type="range"
                min={1.0}
                max={2.0}
                step={0.1}
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-none cursor-pointer"
              />
              <button
                type="button"
                onClick={handleResetZoom}
                className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-none text-[11px] font-bold cursor-pointer shrink-0"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Row 3: Mode Toggles */}
          <div className="p-2.5 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            <button
              type="button"
              onClick={() => setIsYtSafe(!isYtSafe)}
              className={`h-8 px-1.5 rounded-none text-[11px] font-bold border transition-colors cursor-pointer truncate ${
                isYtSafe ? 'bg-sky-600 text-white border-sky-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              YT Safe
            </button>

            <button
              type="button"
              onClick={() => setIsThrill(!isThrill)}
              className={`h-8 px-1.5 rounded-none text-[11px] font-bold border transition-colors cursor-pointer truncate ${
                isThrill ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Thrill
            </button>

            <button
              type="button"
              onClick={() => setIsStudio(!isStudio)}
              className={`h-8 px-1.5 rounded-none text-[11px] font-bold border transition-colors cursor-pointer truncate ${
                isStudio ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Studio
            </button>

            <button
              type="button"
              onClick={() => setIsReverse(!isReverse)}
              className={`h-8 px-1.5 rounded-none text-[11px] font-bold border transition-colors cursor-pointer truncate ${
                isReverse ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Reverse
            </button>

            <button
              type="button"
              onClick={() => setIsDialogue(!isDialogue)}
              className={`h-8 px-1.5 rounded-none text-[11px] font-bold border transition-colors cursor-pointer truncate ${
                isDialogue ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Dialogue
            </button>

            <button
              type="button"
              onClick={() => setIsCrossfade(!isCrossfade)}
              className={`h-8 px-1.5 rounded-none text-[11px] font-bold border transition-colors cursor-pointer truncate ${
                isCrossfade ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Crossfade
            </button>
          </div>

          {/* Row 4: Buffer & Clip Steppers */}
          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-700 px-2.5 h-9 rounded-none text-xs">
              <button
                type="button"
                onClick={() => setIsBufferOn(!isBufferOn)}
                className={`px-2 py-1 rounded-none font-bold text-[11px] cursor-pointer transition-colors ${
                  isBufferOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                Buffer {isBufferOn ? 'ON' : 'OFF'}
              </button>

              {isBufferOn && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBufSec(Math.max(1, bufSec - 1))}
                    className="h-7 w-7 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center rounded-none cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono tabular-nums font-bold text-amber-300 w-7 text-center">{bufSec}s</span>
                  <button
                    type="button"
                    onClick={() => setBufSec(bufSec + 1)}
                    className="h-7 w-7 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center rounded-none cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-slate-900 border border-slate-700 px-2.5 h-9 rounded-none text-xs gap-2">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px] font-bold">Clips</span>
                <button
                  type="button"
                  onClick={() => setClipsCount(Math.max(2, clipsCount - 1))}
                  className="h-6 w-6 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center rounded-none cursor-pointer"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="font-mono tabular-nums font-bold text-amber-300 w-5 text-center">{clipsCount}</span>
                <button
                  type="button"
                  onClick={() => setClipsCount(clipsCount + 1)}
                  className="h-6 w-6 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center rounded-none cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px] font-bold">Len</span>
                <button
                  type="button"
                  onClick={() => setClipDuration(Math.max(4, clipDuration - 1))}
                  className="h-6 w-6 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center rounded-none cursor-pointer"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="font-mono tabular-nums font-bold text-amber-300 w-6 text-center">{clipDuration}s</span>
                <button
                  type="button"
                  onClick={() => setClipDuration(clipDuration + 1)}
                  className="h-6 w-6 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center rounded-none cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 5: Frames, Effects & Custom Frame Manager */}
          <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <div className="relative">
              <select
                value={selectedPhotoFrame}
                onChange={(e) => {
                  setSelectedPhotoFrame(e.target.value);
                  triggerNotification(`Photo Frame: ${e.target.value}`);
                }}
                className="w-full h-8 bg-slate-900 border border-slate-700 rounded-none pl-2 pr-6 text-xs font-bold text-slate-200 cursor-pointer focus:outline-none truncate appearance-none"
              >
                <option value="Photo Frame">Photo Frame</option>
                <option value="Classic Border">Classic Border</option>
                <option value="Gold Luxury">Gold Luxury</option>
                <option value="Neon Glow">Neon Glow</option>
                <option value="Polaroid Vintage">Polaroid Vintage</option>
                {customFramesList
                  .filter((f) => f.type === 'photo')
                  .map((cf) => (
                    <option key={cf.id} value={cf.name}>
                      {cf.name}
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={selectedVideoFrame}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedVideoFrame(val);
                  const foundCustom = customFramesList.find((f) => f.name === val && f.type === 'video');
                  setActiveCustomVideoFrame(foundCustom || null);
                  triggerNotification(`Video Frame: ${val}`);
                }}
                className="w-full h-8 bg-slate-900 border border-slate-700 rounded-none pl-2 pr-6 text-xs font-bold text-slate-200 cursor-pointer focus:outline-none truncate appearance-none"
              >
                <option value="Video Frame">Video Frame</option>
                <option value="Cinema Scope">Cinema Scope</option>
                <option value="Filmstrip Border">Filmstrip Border</option>
                <option value="Minimalist Frame">Minimalist Frame</option>
                <option value="Gold Luxury">Gold Luxury</option>
                {customFramesList
                  .filter((f) => f.type === 'video')
                  .map((cf) => (
                    <option key={cf.id} value={cf.name}>
                      {cf.name}
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div ref={effectDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsEffectMenuOpen((prev) => !prev)}
                title="Video Effect (শুধুমাত্র ভিডিওতে যুক্ত হবে)"
                aria-expanded={isEffectMenuOpen}
                aria-haspopup="listbox"
                className={`w-full h-8 bg-slate-900 border rounded-none pl-2 pr-6 text-xs font-bold flex items-center justify-between cursor-pointer truncate ${
                  selectedEffect === 'none'
                    ? 'border-slate-700 text-slate-300'
                    : 'border-amber-500/60 text-amber-300'
                }`}
              >
                <span className="truncate">
                  {TRAILER_VIDEO_EFFECT_OPTIONS.find((opt) => opt.id === selectedEffect)?.label || 'No Effect'}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-amber-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${
                    isEffectMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isEffectMenuOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-full mt-1 z-40 bg-[#0b1222] border border-amber-500/60 shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-800/80"
                >
                  {TRAILER_VIDEO_EFFECT_OPTIONS.map((opt) => {
                    const active = opt.id === selectedEffect;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSelectedEffect(opt.id);
                          setIsEffectMenuOpen(false);
                          triggerNotification(
                            opt.id === 'none'
                              ? 'Video Effect: No Effect'
                              : `Video Effect: ${opt.label}`
                          );
                        }}
                        className={`w-full h-7 px-2 text-left text-[11px] font-bold flex items-center justify-between gap-1 cursor-pointer transition-colors ${
                          active
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {active && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFrameModalOpen(true)}
              className="h-8 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-600/80 text-indigo-200 px-2 rounded-none font-bold text-xs flex items-center justify-center gap-1 cursor-pointer truncate"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <span className="truncate">Upload Frame</span>
            </button>

            {/* Real-Time Video Effect Opacity Slider */}
            <div className="col-span-2 sm:col-span-4 flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-2.5 h-8">
              <span className="text-[11px] font-bold text-amber-300 shrink-0">
                Effect Opacity
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                disabled={selectedEffect === 'none'}
                value={selectedEffect === 'none' ? 0 : Math.round(effectOpacity * 100)}
                onChange={(e) => {
                  const nextOpacity = Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100));
                  effectOpacityRef.current = nextOpacity;
                  setEffectOpacity(nextOpacity);
                  const ovCanvas = effectOverlayCanvasRef.current;
                  const ovCtx = ovCanvas?.getContext('2d');
                  if (ovCanvas && ovCtx && selectedEffect !== 'none') {
                    ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
                    renderTrailerVideoEffect(
                      ovCtx,
                      selectedEffect,
                      lastEffectTimeSecRef.current,
                      ovCanvas.width,
                      ovCanvas.height,
                      nextOpacity
                    );
                  }
                }}
                aria-label="Video Effect Opacity"
                className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-none cursor-pointer disabled:opacity-40"
              />
              <span className="text-[11px] font-mono tabular-nums font-bold text-amber-300 w-9 text-right shrink-0">
                {selectedEffect === 'none' ? '0%' : `${Math.round(effectOpacity * 100)}%`}
              </span>
            </div>
          </div>

          {/* Row 5b: Copyright-Safe Trailer Audio (BGM & Sound Filter) */}
          <div className="p-2.5 flex flex-col gap-2 bg-slate-950/40">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Copyright-Safe Trailer Audio (BGM ও সাউন্ড ফিল্টার)</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {isYtSafe ? 'Pitch +3% • EQ • Ambience' : 'Standard Audio'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
              <div className="sm:col-span-4 relative">
                <Sliders className="w-3 h-3 text-sky-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={soundFilterPreset}
                  onChange={(e) => {
                    const val = e.target.value as TrailerSoundFilterPreset;
                    setSoundFilterPreset(val);
                    triggerNotification(`🎛️ সাউন্ড ফিল্টার: ${TRAILER_SOUND_FILTER_OPTIONS.find((o) => o.id === val)?.label || val}`);
                  }}
                  title="Trailer Sound Filter"
                  className="w-full h-8 bg-slate-900 border border-slate-700 rounded-none pl-6 pr-6 text-[11px] font-bold text-sky-200 cursor-pointer focus:outline-none truncate appearance-none"
                >
                  {TRAILER_SOUND_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="sm:col-span-5 flex items-center gap-1">
                <div className="relative flex-1 min-w-0">
                  <Music className="w-3 h-3 text-emerald-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={bgmPreset}
                    onChange={(e) => {
                      const val = e.target.value as TrailerBgmPreset;
                      if (val === 'custom' && !customBgmFile) {
                        customBgmInputRef.current?.click();
                      }
                      setBgmPreset(val);
                      triggerNotification(`🎵 টেইলার BGM: ${TRAILER_BGM_OPTIONS.find((o) => o.id === val)?.label || val}`);
                    }}
                    title="Trailer Copyright-Free BGM"
                    className="w-full h-8 bg-slate-900 border border-slate-700 rounded-none pl-6 pr-6 text-[11px] font-bold text-emerald-200 cursor-pointer focus:outline-none truncate appearance-none"
                  >
                    {TRAILER_BGM_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => customBgmInputRef.current?.click()}
                  title={customBgmFile ? `Custom BGM: ${customBgmFile.name}` : 'নিজস্ব BGM অডিও আপলোড'}
                  className="h-8 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-[10px] font-bold rounded-none cursor-pointer shrink-0"
                >
                  {customBgmFile ? 'Change' : '+BGM'}
                </button>
                <input
                  ref={customBgmInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (customBgmUrl) {
                        try { URL.revokeObjectURL(customBgmUrl); } catch (_) {}
                      }
                      const nextUrl = URL.createObjectURL(file);
                      setCustomBgmFile(file);
                      setCustomBgmUrl(nextUrl);
                      setBgmPreset('custom');
                      triggerNotification(`🎵 নিজস্ব BGM যুক্ত হয়েছে: ${file.name}`);
                    }
                  }}
                />
              </div>

              <div className="sm:col-span-3 flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2 h-8">
                <span className="text-[10px] font-bold text-slate-400 shrink-0">BGM</span>
                <input
                  type="range"
                  min={0}
                  max={0.4}
                  step={0.02}
                  value={bgmPreset === 'off' ? 0 : bgmVolume}
                  disabled={bgmPreset === 'off'}
                  onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 h-1 bg-slate-800 cursor-pointer disabled:opacity-40"
                />
                <span className="text-[10px] font-mono tabular-nums text-emerald-300 w-7 text-right shrink-0">
                  {bgmPreset === 'off' ? '0%' : `${Math.round(bgmVolume * 100)}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Row 6: Generate Trailer, AI Script, Download + Format */}
          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handleCutNatokTrailer}
              className="h-9 bg-violet-700 hover:bg-violet-600 border border-violet-500 text-white px-2 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
            >
              <Clapperboard className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">Generate Trailer</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAiScript}
              className="h-9 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-2 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
            >
              <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">AI Script</span>
            </button>

            <div className="h-9 flex items-center justify-between bg-slate-900 border border-slate-700 rounded-none p-0.5 overflow-hidden">
              <button
                type="button"
                onClick={() => handleExportTrailerVideo(true)}
                disabled={isRecording}
                className="flex-1 h-full hover:text-white text-slate-200 text-xs font-bold flex items-center justify-center gap-1 px-2 transition-colors cursor-pointer truncate disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate tabular-nums">{isRecording ? `${recordProgress}%` : 'Download'}</span>
              </button>

              <div className="flex items-center border-l border-slate-700 h-full shrink-0">
                <button
                  type="button"
                  onClick={() => setOutputFormat('mp4')}
                  className={`h-full text-[10px] font-bold px-2 transition-colors cursor-pointer ${
                    outputFormat === 'mp4'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  MP4
                </button>
                <button
                  type="button"
                  onClick={() => setOutputFormat('webm')}
                  className={`h-full text-[10px] font-bold px-2 border-l border-slate-700 transition-colors cursor-pointer ${
                    outputFormat === 'webm'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  WEBM
                </button>
              </div>
            </div>
          </div>

          {/* Row 7: Add Intro, Use as Input Video, Mirror */}
          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (isRecording) return;
                handleExportTrailerVideo(true);
              }}
              disabled={isRecording}
              className="h-9 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/70 text-white font-bold text-xs px-2 rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate tabular-nums">
                {isRecording ? `${recordProgress}%` : 'Add Intro'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleUseAsInputVideoClick}
              disabled={isRecording}
              className="h-9 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/70 text-white font-bold text-xs px-2 rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate disabled:opacity-50"
            >
              <Film className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Use as Input</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextMirror = !isMirror;
                setIsMirror(nextMirror);
                triggerNotification(nextMirror ? 'Mirror ON' : 'Mirror OFF');
              }}
              className={`h-9 px-2 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer truncate ${
                isMirror
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isMirror ? 'Mirror ON' : 'Mirror'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Continuous Timeline */}
      <div className="w-full bg-[#0f172a] border border-slate-800 rounded-none divide-y divide-slate-800 select-none">
        <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Film className="w-4 h-4 text-purple-400 shrink-0" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
              Trailer Timeline
            </h3>
            <span className="bg-slate-900 text-amber-300 text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-none border border-slate-700">
              {joinTimeStats.formattedTime} ({natokClips.length} clips)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddClip}
              className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 rounded-none font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Clip</span>
            </button>
            <button
              type="button"
              onClick={handleCutNatokTrailer}
              className="h-8 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs px-3 rounded-none font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recut</span>
            </button>
          </div>
        </div>

        {/* Continuous Filmstrip Track */}
        <div className="relative w-full h-20 md:h-24 bg-black overflow-hidden flex flex-row items-stretch">
          {natokClips.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-3 gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Clapperboard className="w-4 h-4 text-amber-400" />
                <span>No Clips</span>
              </div>
              <button
                type="button"
                onClick={handleCutNatokTrailer}
                className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-none cursor-pointer"
              >
                Generate Trailer
              </button>
            </div>
          ) : (
            natokClips.map((clip, idx) => {
              const isActive = idx === activeClipIndex;
              const totalDurationAll = natokClips.reduce((sum, c) => sum + c.duration, 0) || 1;
              const widthPct = (clip.duration / totalDurationAll) * 100;

              return (
                <div
                  key={clip.id}
                  onClick={() => handleSelectClip(idx)}
                  style={{ width: `${widthPct}%` }}
                  className={`relative h-full overflow-hidden cursor-pointer border-r border-amber-500/40 last:border-r-0 group flex items-center justify-center shrink-0 ${
                    isActive ? 'ring-2 ring-inset ring-amber-400 z-10' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <img
                    src={clip.thumbnailUrl}
                    alt={clip.title}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none ${isMirror ? 'scale-x-[-1]' : ''}`}
                  />

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent py-1 px-1.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-white pointer-events-none">
                    <span className="text-amber-300 font-bold">{formatTimeStr(clip.startTime)}</span>
                    <span className="text-slate-300 font-semibold">{clip.duration.toFixed(0)}s</span>
                  </div>

                  {isActive && (
                    <div className="absolute top-1 left-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1 rounded-none">
                      Active
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div
            style={{
              left: `${Math.min(100, Math.max(0, (trailerCurrentSec / Math.max(1, joinTimeStats.totalSeconds)) * 100))}%`
            }}
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-20 pointer-events-none -translate-x-1/2"
          />
        </div>

        {natokClips[activeClipIndex] && (
          <div className="p-2.5 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span className="text-amber-400 font-bold">
                {formatTimeStr(natokClips[activeClipIndex].startTime)} - {formatTimeStr(natokClips[activeClipIndex].endTime)}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">{natokClips[activeClipIndex].duration}s</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleNudgeClipStart(activeClipIndex, -1)}
                className="h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 rounded-none text-[11px] font-mono tabular-nums cursor-pointer"
              >
                -1s
              </button>
              <button
                type="button"
                onClick={() => handleNudgeClipStart(activeClipIndex, 1)}
                className="h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 rounded-none text-[11px] font-mono tabular-nums cursor-pointer"
              >
                +1s
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClip(activeClipIndex)}
                className="h-7 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 px-2.5 rounded-none text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <FrameManagerModal
        isOpen={isFrameModalOpen}
        onClose={() => setIsFrameModalOpen(false)}
        onSelectVideoFrame={handleSelectVideoFrameFromModal}
        onSelectPhotoFrame={handleSelectPhotoFrameFromModal}
        activeVideoFrameId={selectedVideoFrame}
        activePhotoFrameId={selectedPhotoFrame}
      />

      {showAiScriptModal && aiScriptData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-none max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] text-slate-100">
            <div className="px-4 py-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">AI Script</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                  setShowAiScriptModal(false);
                }}
                className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-none text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-3">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-none">
                <h4 className="text-xs font-bold text-amber-300">{aiScriptData.headline}</h4>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-3 rounded-none flex flex-col gap-2 max-h-60 overflow-y-auto">
                {aiScriptData.narrationLines.map((line: string, i: number) => (
                  <div key={i} className="text-xs text-slate-200 pl-2 border-l-2 border-indigo-500 py-0.5">
                    <span className="text-indigo-400 font-mono tabular-nums font-bold mr-1.5">#{i + 1}</span>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleSpeakScript}
                className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 rounded-none font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-300" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Listen</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="h-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 rounded-none font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                    setShowAiScriptModal(false);
                  }}
                  className="h-9 bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 rounded-none font-bold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
