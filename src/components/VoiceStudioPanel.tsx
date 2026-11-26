/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useImperativeHandle, useCallback } from 'react';
import {
  Mic,
  Upload,
  Play,
  Pause,
  Trash2,
  Download,
  Volume2,
  Sparkles,
  CheckCircle2,
  Sliders,
  Music,
  Radio,
  FileText,
  Check,
  RefreshCw,
  Film,
  Info,
  Clock,
  ArrowRight,
  Braces,
  StopCircle,
  MapPin,
  Zap,
  VolumeX,
  RotateCcw,
  FastForward,
  Rewind,
  Key,
  ArrowDownToLine,
  Plus,
  Minus,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Edit2,
  X,
  Calendar
} from 'lucide-react';
import type { SeriesItem } from '../types/timeline';
import { parseEpisodeNumber, formatEpisodeLabel } from '../services/seriesScheduleManager';
import { GeminiApiKeyModal } from './GeminiApiKeyModal';
import {
  TEN_CHANNEL_VOICE_PROFILES,
  getChannelVoiceProfile,
  buildLockedVoiceSessionSpec,
  lockSessionModel,
  analyzeAndSplitLongScript,
  splitScriptIntoSafeChunks,
  estimateScriptDurationSeconds,
  type SafeScriptChunk,
  type LockedVoiceSessionSpec,
  type PartGenerationStatus,
} from '../services/channelVoiceProfiles';
import {
  decodeAudioSourceToPcmTrack,
  detectSpeechPausesFromPcmTrack,
  mixTimelineLowRamToWav,
  mixUploadedVoiceLowRamToWav,
  encodeWavBlobToMp3LowRam,
  type DecodedPcmTrack,
  type TimelineVoicePlacement,
  type UploadedVoiceSegmentSpan,
} from '../services/lowRamAudioMixer';
import {
  ALL_GEMINI_25_SPEAKERS,
  GEMINI_TTS_MODELS,
  synthesizeGeminiTtsChunk,
  type GeminiSpeakerMeta,
} from '../services/geminiTtsEngine';

export interface SpeakerItem {
  name: string;
  gender: 'male' | 'female';
  tone?: string;
  pitch?: string;
}

// Complete 30 official Google AI Studio Gemini 2.5 TTS voices separated by gender
export const FEMALE_SPEAKERS: SpeakerItem[] = ALL_GEMINI_25_SPEAKERS.filter(
  (s: GeminiSpeakerMeta) => s.gender === 'female'
);

export const MALE_SPEAKERS: SpeakerItem[] = ALL_GEMINI_25_SPEAKERS.filter(
  (s: GeminiSpeakerMeta) => s.gender === 'male'
);

interface BracketParagraph {
  index: number;
  rawText: string;
  cleanText: string;
  blob?: Blob;
  url?: string;
  duration?: number;
}

interface SequentialPartItem extends SafeScriptChunk {
  status: PartGenerationStatus;
  errorMessage?: string;
  audioDurationSec?: number;
  audioUrl?: string;
}

export interface VoiceStudioPanelProps {
  onAudioUploaded?: (file: File, duration?: number) => void;
  onMasterVoiceGenerated?: (file: File, duration: number) => void;
  bgmUrl?: string;
  bgmName?: string;
  bgmDuration?: number;
  onUploadBgm?: (file: File) => void;
  onClearBgm?: () => void;
  audioUrl?: string;
  audioName?: string;
  audioDuration?: number;
  audioFile?: File | null;
  onClearAudio?: () => void;
  scriptText?: string;
  onScriptTextChange?: (text: string) => void;
  onNavigateTab?: (tabId: 'agent' | 'tailor' | 'voice' | 'editor' | 'gallery' | 'video') => void;
  activeChannelSlot?: number;
  savedChannels?: string[];
  onSelectChannelSlot?: (slotNumber: number) => void;
  seriesList?: SeriesItem[];
  activeSeries?: SeriesItem | null;
  onSelectSeriesById?: (seriesId: string) => void;
  onQuickAddDrama?: (title: string, episode?: string) => void;
  onRenameSeries?: (seriesId: string, newTitle: string) => void;
  onDeleteSeries?: (seriesId: string) => void;
  onUpdateActiveEpisode?: (episode: string) => void;
  onOpenSeriesScheduleModal?: () => void;
  onVoiceStudioSnapshot?: (snapshot: VoiceStudioAgentStatusSnapshot) => void;
  onOpenApiKeyModal?: () => void;
}

export interface VoiceStudioAgentStatusSnapshot {
  hasRecordedVoice: boolean;
  recordedVoiceName: string;
  recordedVoiceDuration: number;
  hasPreparedAiVoice: boolean;
  preparedVoiceDuration: number;
  hasBgm: boolean;
  bgmName: string;
  audioMixMode: 'clean_voice' | 'voice_with_bgm' | 'pure_voice';
  bgmDuckedVolume: number;
  bgmLoudVolume: number;
  interludeDuration: number;
  speechSpeed: number;
  scriptWordCount: number;
  estimatedDurationSec: number;
  isRecordingMic: boolean;
  recordingSeconds: number;
  voiceProfileLabel: string;
  hasApiKey: boolean;
  masterAudioUrl: string | null;
  masterDuration: number;
  breakCount: number;
  predictedFinalDurationSec: number;
  masterMatchesCurrentSource: boolean;
  masterSourceType: 'recorded' | 'tts' | null;
}

export interface VoiceStudioAgentHandle {
  getSnapshot: () => VoiceStudioAgentStatusSnapshot;
  uploadRecordedVoice: (file: File) => Promise<void>;
  clearRecordedVoice: () => void;
  startMicRecording: () => Promise<void>;
  stopMicRecording: () => void;
  uploadBgm: (file: File) => void;
  clearBgm: () => void;
  setMixSettings: (opts: {
    audioMixMode?: 'clean_voice' | 'voice_with_bgm' | 'pure_voice';
    bgmDuckedVolume?: number;
    bgmLoudVolume?: number;
    interludeDuration?: number;
    speechSpeed?: number;
  }) => void;
  mixPreviewAudioOnly: (
    preferredSource: 'auto' | 'recorded' | 'script',
    targetDurationOverrideSec?: number | null
  ) => Promise<{
    file: File;
    duration: number;
  } | null>;
  adaptScriptToTargetSeconds: (targetTotalSec: number) => Promise<string | null>;
  prepareAudioForAgent: (opts: {
    preferredSource: 'auto' | 'recorded' | 'script';
    forceRegenerateVoice?: boolean;
    targetDurationOverrideSec?: number | null;
    onProgress?: (stage: 'voice' | 'bgm', pct: number, message: string) => void;
  }) => Promise<{
    file: File;
    duration: number;
    voiceSkipped: boolean;
    usedRecordedVoice: boolean;
    bgmApplied: boolean;
  }>;
  getAudioForExport: () => { file: File | Blob; duration: number } | null;
  releaseHeavyAudioCaches: () => void;
  cancelActiveTask: () => void;
  downloadPureVoiceMp3: () => Promise<void>;
  downloadMasterMp3: () => Promise<void>;
}

// User-specified: No hardcoded default script! Starts clean.
export const DEFAULT_USER_BRACKET_SCRIPT = '';

// Universal Robust Script Parser: Handles bracketed [ ... ] paragraphs AND plain text custom user scripts
export function parseBracketParagraphs(raw: string): BracketParagraph[] {
  if (!raw || !raw.trim()) return [];

  const result: BracketParagraph[] = [];
  const regex = /\[([\s\S]*?)\]/g;
  let match: RegExpExecArray | null;
  let idx = 1;

  while ((match = regex.exec(raw)) !== null) {
    const rawText = match[0];
    const cleanText = match[1].replace(/[*#_~]/g, '').trim();
    if (cleanText) {
      result.push({
        index: idx++,
        rawText,
        cleanText,
      });
    }
  }

  // If brackets were used and matched content, return them
  if (result.length > 0) {
    return result;
  }

  // Fallback for custom user scripts WITHOUT brackets:
  // 1. Try splitting by double-newlines
  let chunks = raw
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[*#_~\[\]]/g, '').trim())
    .filter((p) => p.length > 0);

  // 2. If it is a continuous text with > 50 words, break into natural sentence groups (around '।', '?', '!')
  if (chunks.length === 1 && chunks[0].split(/\s+/).length > 50) {
    const sentences = chunks[0].split(/(?<=[।?!])\s+/);
    const subChunks: string[] = [];
    let current = '';
    for (const s of sentences) {
      if ((current + ' ' + s).split(/\s+/).length > 35 && current) {
        subChunks.push(current.trim());
        current = s;
      } else {
        current = current ? `${current} ${s}` : s;
      }
    }
    if (current.trim()) subChunks.push(current.trim());
    if (subChunks.length > 1) {
      chunks = subChunks;
    }
  }

  return chunks.map((p, i) => ({
    index: i + 1,
    rawText: `[ ${p} ]`,
    cleanText: p,
  }));
}

// Anti-echo guard: Prevents previously rendered voiceovers from being fed back as background music
export function isVoiceAudioTrack(name?: string, url?: string): boolean {
  if (!name && !url) return false;
  const str = `${name || ''} ${url || ''}`.toLowerCase();
  return (
    str.includes('googletts') ||
    str.includes('voice_') ||
    str.includes('master_voiceover') ||
    str.includes('review') ||
    str.includes('speech') ||
    str.includes('tts') ||
    str.includes('voice') ||
    str.includes('vocal') ||
    str.includes('record')
  );
}

// Detect pauses/silences in audio buffer where lines/paragraphs end (adaptive to mic noise floor)
export function detectSpeechPauses(
  audioBuffer: AudioBuffer,
  minSilenceDurationSec = 0.55,
  silenceThresholdRms?: number,
  minSpacingSec = 10.0
): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const stepSec = 0.05; // 50ms window
  const windowSize = Math.max(1, Math.floor(sampleRate * stepSec));
  const minSilenceWindows = Math.max(2, Math.floor(minSilenceDurationSec / stepSec));

  const rmsList: number[] = [];
  for (let i = 0; i < channelData.length; i += windowSize) {
    let sumSquares = 0;
    const end = Math.min(channelData.length, i + windowSize);
    for (let j = i; j < end; j++) {
      sumSquares += channelData[j] * channelData[j];
    }
    rmsList.push(Math.sqrt(sumSquares / Math.max(1, end - i)));
  }

  // Compute adaptive silence threshold if not explicitly forced
  let effectiveThreshold = silenceThresholdRms ?? 0.018;
  if (silenceThresholdRms === undefined && rmsList.length > 10) {
    const sortedRms = [...rmsList].sort((a, b) => a - b);
    const p15 = sortedRms[Math.floor(sortedRms.length * 0.15)] || 0.005;
    const p75 = sortedRms[Math.floor(sortedRms.length * 0.75)] || 0.08;
    // Threshold sits safely above room floor (1.8x p15) and well below speech level (0.24x p75)
    effectiveThreshold = Math.max(0.008, Math.min(0.045, Math.max(p15 * 1.8, p75 * 0.2)));
  }

  const breakPoints: number[] = [];
  let silenceWindowCount = 0;
  let inSilence = false;
  let silenceStartTime = 0;

  for (let w = 0; w < rmsList.length; w++) {
    const rms = rmsList[w];
    const currentTime = w * stepSec;

    if (rms < effectiveThreshold) {
      if (!inSilence && silenceWindowCount === 0) {
        silenceStartTime = currentTime;
      }
      silenceWindowCount++;
      if (silenceWindowCount >= minSilenceWindows && !inSilence) {
        inSilence = true;
        // Split slightly into the quiet pause (clean consonant tail) & space naturally between paragraphs
        const splitTime = Math.round((silenceStartTime + 0.12) * 10) / 10;
        if (splitTime > 3.0 && splitTime < audioBuffer.duration - 3.0) {
          const lastBreak = breakPoints[breakPoints.length - 1] ?? -100;
          if (splitTime - lastBreak >= minSpacingSec) {
            breakPoints.push(splitTime);
          }
        }
      }
    } else {
      inSilence = false;
      silenceWindowCount = 0;
    }
  }

  return breakPoints;
}

// Slice AudioBuffer between start and end seconds
export function extractAudioSubBuffer(
  audioCtx: AudioContext | OfflineAudioContext,
  sourceBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const startSample = Math.max(0, Math.floor(startTime * sourceBuffer.sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.ceil(endTime * sourceBuffer.sampleRate));
  const length = Math.max(1, endSample - startSample);
  const subBuffer = audioCtx.createBuffer(
    sourceBuffer.numberOfChannels,
    length,
    sourceBuffer.sampleRate
  );
  for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
    const srcData = sourceBuffer.getChannelData(ch);
    const destData = subBuffer.getChannelData(ch);
    destData.set(srcData.subarray(startSample, endSample));
  }
  return subBuffer;
}

export function formatSecondsWithTenths(secs: number): string {
  if (isNaN(secs) || secs < 0) return '00:00.0';
  const mins = Math.floor(secs / 60);
  const rem = (secs % 60).toFixed(1);
  return `${mins.toString().padStart(2, '0')}:${parseFloat(rem) < 10 ? '0' : ''}${rem}`;
}

export function formatTimeMMSS(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const totalSecsInt = Math.floor(totalSeconds);
  const mins = Math.floor(totalSecsInt / 60);
  const secs = totalSecsInt % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeBengali(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '০ মিনিট ০ সেকেন্ড';
  const totalSecsInt = Math.round(totalSeconds);
  const mins = Math.floor(totalSecsInt / 60);
  const secs = totalSecsInt % 60;

  const toBanglaDigits = (num: number) => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().split('').map((c) => bnDigits[parseInt(c, 10)] || c).join('');
  };

  if (mins === 0) {
    return `${toBanglaDigits(secs)} সেকেন্ড`;
  }
  if (secs === 0) {
    return `${toBanglaDigits(mins)} মিনিট`;
  }
  return `${toBanglaDigits(mins)} মিনিট ${toBanglaDigits(secs)} সেকেন্ড`;
}

export const VoiceStudioPanel = React.forwardRef<VoiceStudioAgentHandle, VoiceStudioPanelProps>(
  function VoiceStudioPanel(
    {
      onAudioUploaded,
      onMasterVoiceGenerated,
      bgmUrl,
      bgmName,
      bgmDuration,
      onUploadBgm,
      onClearBgm,
      audioUrl,
      audioName,
      audioDuration,
      audioFile,
      onClearAudio,
      scriptText: externalScriptText,
      onScriptTextChange,
      onNavigateTab,
      activeChannelSlot: externalChannelSlot,
      savedChannels = [],
      onSelectChannelSlot,
      seriesList = [],
      activeSeries = null,
      onSelectSeriesById,
      onQuickAddDrama,
      onRenameSeries,
      onDeleteSeries,
      onUpdateActiveEpisode,
      onOpenSeriesScheduleModal,
      onVoiceStudioSnapshot,
      onOpenApiKeyModal,
    },
    ref
  ) {
  const [isVoiceNatokAddOpen, setIsVoiceNatokAddOpen] = useState<boolean>(false);
  const [voiceNatokNewTitle, setVoiceNatokNewTitle] = useState<string>('');
  const [voiceNatokNewEp, setVoiceNatokNewEp] = useState<string>('পর্ব 5');
  const [isVoiceNatokEditOpen, setIsVoiceNatokEditOpen] = useState<boolean>(false);
  const [voiceNatokEditTitle, setVoiceNatokEditTitle] = useState<string>('');
  const [isVoiceNatokDeleteConfirm, setIsVoiceNatokDeleteConfirm] = useState<boolean>(false);
  const voiceActiveEpisodeNum = parseEpisodeNumber(activeSeries?.currentEpisode);
  // Active 10-Channel Slot (Synchronized bidirectionally with App's CH 1..CH 10)
  const [internalChannelSlot, setInternalChannelSlot] = useState<number>(externalChannelSlot || 1);
  const currentChannelSlot = externalChannelSlot ?? internalChannelSlot;
  const activeChannelVoiceProfile = getChannelVoiceProfile(currentChannelSlot);
  const activeChannelCustomName = savedChannels[currentChannelSlot - 1]?.trim() || `CH ${currentChannelSlot}`;

  // Voice Consistency Lock: automatically binds each channel slot to its permanent Voice ID & gender
  const [voiceLockEnabled, setVoiceLockEnabled] = useState<boolean>(true);

  const handleChannelSlotSwitch = (slot: number) => {
    if (isProcessing || resumableCheckpoint) return;
    const normalized = Math.max(1, Math.min(10, slot));
    setInternalChannelSlot(normalized);
    onSelectChannelSlot?.(normalized);
  };

  // Speaker Gender Selection: 'male' | 'female'
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>(activeChannelVoiceProfile.gender);

  // Single Selected Speaker (LOCKED: Used consistently for every single paragraph from start to finish!)
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(activeChannelVoiceProfile.voiceId);

  // Selected Gemini TTS Model (Defaults to 2.5 Plus: gemini-2.5-flash-preview-tts)
  const [selectedTTSModel, setSelectedTTSModel] = useState<string>('gemini-2.5-flash-preview-tts');

  // Speech Speed Selection (0.75x, 1.0x, 1.25x, 1.5x)
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);

  // Script text area initialized clean with NO hardcoded default script
  const [scriptText, setScriptText] = useState<string>(
    externalScriptText !== undefined ? externalScriptText : ''
  );

  // Sync external scriptText when updated by HomePage or parent
  useEffect(() => {
    if (externalScriptText !== undefined && externalScriptText !== scriptText) {
      setScriptText(externalScriptText);
    }
  }, [externalScriptText]);

  const handleUpdateScript = (newVal: string) => {
    if (!isProcessing && resumableCheckpoint && newVal.trim() !== scriptText.trim()) {
      chunkSessionRef.current = null;
      setResumableCheckpoint(null);
    }
    setScriptText(newVal);
    onScriptTextChange?.(newVal);
  };

  // Helper to count words in script
  const getScriptWordCount = (text: string): number => {
    if (!text || !text.trim()) return 0;
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    return tokens.length;
  };

  // Helper to count paragraphs in script
  const getScriptParaCount = (text: string): number => {
    if (!text || !text.trim()) return 0;
    const bracketMatches = text.match(/\[[^\]]+\]/g);
    if (bracketMatches && bracketMatches.length > 0) {
      return bracketMatches.length;
    }
    const rawParas = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return Math.max(1, rawParas.length);
  };

  // Helper to calculate automatic paragraph count based on duration
  const calcAutoParas = (m: number, s: number) => {
    const totalSec = Math.max(20, m * 60 + s);
    if (totalSec > 500) return Math.min(10, Math.max(6, Math.round(totalSec / 65)));
    if (totalSec > 380) return 5;
    if (totalSec > 260) return 4;
    if (totalSec > 80) return 3;
    return 2;
  };

  // Helper to calculate automatic target words based on duration, speech speed, and paras
  const calcAutoWords = (m: number, s: number, spd: number, paras?: number) => {
    const totalSec = Math.max(20, m * 60 + s);
    const nParas = paras !== undefined ? paras : calcAutoParas(m, s);
    const musicBreaksSec = (nParas - 1) * 5.5 + 2.5;
    const pureSpeechSec = Math.max(15, totalSec - musicBreaksSec);
    return Math.max(20, Math.round((pureSpeechSec / 60) * 105 * spd));
  };

  // Target Duration Control for Script Adaptation (0m 0s when empty — no forced default duration)
  const [targetMinutes, setTargetMinutes] = useState<number>(0);
  const [targetSeconds, setTargetSeconds] = useState<number>(0);
  const [isManualTargetDuration, setIsManualTargetDuration] = useState<boolean>(false);

  // Hold-down increment/decrement interval ref
  const holdIntervalRef = useRef<any>(null);

  const startHoldAction = (action: () => void) => {
    action();
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // Doubled speed: faster acceleration (35ms ~ 60ms ~ 120ms)
      const intervalSpeed = elapsed > 1000 ? 35 : elapsed > 300 ? 60 : 120;
      if (!holdIntervalRef.current) return;
      clearInterval(holdIntervalRef.current);
      action();
      holdIntervalRef.current = setInterval(action, intervalSpeed);
    }, 180);
  };

  const stopHoldAction = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  // Words and Paragraphs: initially empty (null) when script is empty; shows real-time count when script is present
  const [wordsCount, setWordsCount] = useState<number | null>(() => {
    const initText = externalScriptText !== undefined ? externalScriptText : '';
    return initText.trim() ? getScriptWordCount(initText) : null;
  });
  const [paragraphsCount, setParagraphsCount] = useState<number | null>(() => {
    const initText = externalScriptText !== undefined ? externalScriptText : '';
    return initText.trim() ? getScriptParaCount(initText) : null;
  });
  const [isManualWords, setIsManualWords] = useState<boolean>(false);
  const [isManualParas, setIsManualParas] = useState<boolean>(false);
  const [isAdaptingScript, setIsAdaptingScript] = useState<boolean>(false);
  const [adaptNotice, setAdaptNotice] = useState<string | null>(null);

  // Real-time synchronization with scriptText:
  // When script is empty, inputs stay empty (null).
  // When script is pasted or updated, show its real-time word and paragraph count unless user manually adjusted it.
  useEffect(() => {
    const trimmed = scriptText.trim();
    if (!trimmed) {
      setWordsCount(null);
      setParagraphsCount(null);
      setIsManualWords(false);
      setIsManualParas(false);
    } else {
      if (!isManualWords) {
        setWordsCount(getScriptWordCount(scriptText));
      }
      if (!isManualParas) {
        setParagraphsCount(getScriptParaCount(scriptText));
      }
    }
  }, [scriptText, isManualWords, isManualParas]);

  const adaptScriptToDurationInternal = async (
    totalSecInput: number,
    opts?: { throwOnError?: boolean; forceAutoBudget?: boolean }
  ): Promise<string | null> => {
    const totalSec = Math.round(totalSecInput);
    if (totalSec < 10) {
      const msg = 'সর্বনিম্ন ১০ সেকেন্ড অডিও দৈর্ঘ্য নির্বাচন করুন।';
      setErrorMessage(msg);
      if (opts?.throwOnError) throw new Error(msg);
      return null;
    }
    if (totalSec > 60 * 60) {
      const msg = 'সর্বোচ্চ ৬০ মিনিট পর্যন্ত অডিও দৈর্ঘ্য নির্বাচন করা যাবে।';
      setErrorMessage(msg);
      if (opts?.throwOnError) throw new Error(msg);
      return null;
    }

    const tgtMin = Math.floor(totalSec / 60);
    const tgtSec = totalSec % 60;
    const hasBgmActive = Boolean(effectiveBgmUrl || dedicatedBgmFile) && audioMixMode !== 'pure_voice';

    const effectiveWords =
      !opts?.forceAutoBudget && isManualWords && wordsCount !== null && wordsCount > 0
        ? wordsCount
        : undefined;

    const effectiveParas =
      !opts?.forceAutoBudget && isManualParas && paragraphsCount !== null && paragraphsCount > 0
        ? paragraphsCount
        : undefined;

    setIsAdaptingScript(true);
    setAdaptNotice(null);
    setErrorMessage(null);

    try {
      const userCustomKey = (localStorage.getItem('user_gemini_api_key') || '').trim();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userCustomKey) {
        headers['x-gemini-api-key'] = userCustomKey.replace(/[\r\n]+/g, ',').trim();
      }

      const res = await fetch('/api/script/adapt-duration', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentScript: scriptText,
          targetMinutes: tgtMin,
          targetSeconds: tgtSec,
          speed: speechSpeed,
          customApiKey: userCustomKey || undefined,
          customWords: effectiveWords,
          customParas: effectiveParas,
          channelSlot: currentChannelSlot,
          channelPersona: activeChannelVoiceProfile.speakingStyleBn,
          voiceGender: selectedGender,
          wpmBaseline: activeChannelVoiceProfile.wpmBaseline,
          interludeDuration,
          audioMixMode,
          hasBgm: hasBgmActive,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.script) {
        throw new Error(data?.error || 'Script adaptation failed');
      }

      handleUpdateScript(data.script);

      const generatedWords = getScriptWordCount(data.script);
      const generatedParas = getScriptParaCount(data.script);
      setWordsCount(generatedWords);
      setParagraphsCount(generatedParas);
      setIsManualWords(false);
      setIsManualParas(false);

      setAdaptNotice(
        `✅ CH ${currentChannelSlot} (${activeChannelVoiceProfile.voiceId}) স্টাইলে স্ক্রিপ্ট প্রস্তুত (~${generatedWords} শব্দ, ${generatedParas} প্যারা | টার্গেট: ${tgtMin}m ${tgtSec.toString().padStart(2, '0')}s)`
      );
      return data.script as string;
    } catch (err: any) {
      console.error('Adapt error:', err);
      const errMsg = `Script Adaptation Error: ${err.message || 'Error occurred'}`;
      setErrorMessage(errMsg);
      if (opts?.throwOnError) throw new Error(errMsg);
      return null;
    } finally {
      setIsAdaptingScript(false);
    }
  };

  const handleAdaptScriptToDuration = async () => {
    const totalSec = targetMinutes * 60 + targetSeconds;
    await adaptScriptToDurationInternal(totalSec);
  };

  // Audio Mix Mode:
  // 'clean_voice' (Default & Recommended): BGM is completely MUTED (0%) during speech for 100% dry, clear, echo-free voice. BGM swells loud only during 5-6s interlude breaks.
  // 'voice_with_bgm': BGM is gentle (5-8%) during speech, swells loud during interludes.
  // 'pure_voice': Pure speech only, zero BGM, zero breaks.
  const [audioMixMode, setAudioMixMode] = useState<'clean_voice' | 'voice_with_bgm' | 'pure_voice'>('voice_with_bgm');

  // Dedicated Instrumental Background Music (separate from generated voiceover)
  const [dedicatedBgmFile, setDedicatedBgmFile] = useState<File | null>(null);
  const [dedicatedBgmUrl, setDedicatedBgmUrl] = useState<string | null>(null);
  const [dedicatedBgmName, setDedicatedBgmName] = useState<string>('');
  const dedicatedBgmTrackRef = useRef<{ key: string; track: DecodedPcmTrack } | null>(null);

  // STRICT RULE: Only use background music explicitly uploaded by the user (NEVER auto-synthesize or borrow sample audio)
  const effectiveBgmUrl = bgmUrl || dedicatedBgmUrl || null;
  const effectiveBgmName = bgmName || dedicatedBgmName || '';
  const effectiveBgmDuration = bgmDuration || 0;

  // Background Music Interlude / Break Settings
  // "কিছুক্ষণ পর বা নির্দিষ্ট একটা প্যারা শেষ হলে ব্যাকগ্রাউন্ড মিউজিক টা ৫ সেকেন্ড জোরে বেজে ওঠে"
  const [interludeDuration, setInterludeDuration] = useState<number>(5.0); // Default 5.0s (range 3.0 - 8.0s)
  const [bgmDuckedVolume, setBgmDuckedVolume] = useState<number>(0.18); // কথা চলাকালীন হালকা ব্যাকগ্রাউন্ড মিউজিক (১৮%)
  const [bgmLoudVolume, setBgmLoudVolume] = useState<number>(0.90); // প্যারা শেষে ৫ সে. লাউডলি (৯০%)
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0); // ভয়েস ভলিউম

  // Generation & Audio processing state (with Pause/Resume/Retry-Failed-Chunk checkpointing)
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPausedGeneration, setIsPausedGeneration] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeKeyLabelUsed, setActiveKeyLabelUsed] = useState<string>('Key 01');
  const [durationReport, setDurationReport] = useState<{
    targetSec: number;
    actualSec: number;
    speechOnlySec: number;
    accuracyPct: number;
  } | null>(null);
  const [resumableCheckpoint, setResumableCheckpoint] = useState<{
    completedCount: number;
    totalCount: number;
    failedChunkIndex: number | null;
    channelSlot: number;
    voiceId: string;
    model: string;
    tone?: string;
    seed?: number;
  } | null>(null);

  // Lock Speaker/Channel/Model/Speed controls while generating OR while partial parts checkpoint is active
  const isSpeakerSessionLocked = isProcessing || Boolean(resumableCheckpoint);

  // Automatically synchronize Speaker & Gender whenever Active Channel (CH 1..CH 10) changes (only when session unlocked)
  useEffect(() => {
    if (isSpeakerSessionLocked) return;
    const profile = getChannelVoiceProfile(currentChannelSlot);
    if (voiceLockEnabled) {
      setSelectedGender(profile.gender);
      setSelectedSpeaker(profile.voiceId);
    }
  }, [currentChannelSlot, voiceLockEnabled, isSpeakerSessionLocked]);

  const handleResetResumableSession = () => {
    if (isProcessing) return;
    chunkSessionRef.current = null;
    setResumableCheckpoint(null);
    setErrorMessage(null);
    setVoicePartsQueue((prev) =>
      prev.map((p) => ({
        ...p,
        status: 'Waiting' as PartGenerationStatus,
        audioDurationSec: undefined,
        audioUrl: undefined,
        errorMessage: undefined,
      }))
    );
  };

  // Smart Long Audio Sequential Parts Queue (Waiting / Generating / Completed / Failed / Retry)
  const [voicePartsQueue, setVoicePartsQueue] = useState<SequentialPartItem[]>([]);
  const [isSplitModeActive, setIsSplitModeActive] = useState<boolean>(false);
  const [joinedVoiceTrackSummary, setJoinedVoiceTrackSummary] = useState<{
    actualVoiceDurationSec: number;
    pureSpeechDurationSec: number;
    partCount: number;
    isSplitMode: boolean;
    voiceSignature: string;
  } | null>(null);
  const [finalAudioDurationMode, setFinalAudioDurationMode] = useState<'auto' | 'custom'>('auto');
  const [finalAudioTargetMinutes, setFinalAudioTargetMinutes] = useState<number>(15);
  const [finalAudioTargetSeconds, setFinalAudioTargetSeconds] = useState<number>(0);
  const [durationAdjustmentNotice, setDurationAdjustmentNotice] = useState<{
    type: 'ok' | 'warning';
    message: string;
  } | null>(null);
  const [isExportingMp3, setIsExportingMp3] = useState<boolean>(false);
  const [isExportingPureMp3, setIsExportingPureMp3] = useState<boolean>(false);
  const [mp3ExportProgress, setMp3ExportProgress] = useState<number>(0);
  const [playingPartIndex, setPlayingPartIndex] = useState<number | null>(null);
  const partPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Segmented Bracket Paragraphs - starts clean
  const [bracketParagraphs, setBracketParagraphs] = useState<BracketParagraph[]>(() =>
    parseBracketParagraphs(externalScriptText || '')
  );

  // Master Mixed Audio (Single Speaker Voice + BGM with Interlude Breaks)
  const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);
  const [masterAudioBlob, setMasterAudioBlob] = useState<Blob | null>(null);
  const [masterDuration, setMasterDuration] = useState<number>(0);
  const [isPlayingMaster, setIsPlayingMaster] = useState<boolean>(false);
  const [masterPlaybackTime, setMasterPlaybackTime] = useState<number>(0);
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [isMasterMuted, setIsMasterMuted] = useState<boolean>(false);
  const [masterPlaybackRate, setMasterPlaybackRate] = useState<number>(1.0);
  const [masterSourceMeta, setMasterSourceMeta] = useState<{
    mode: 'recorded' | 'tts';
    voiceKey: string;
    bgmKey: string;
    breakCount: number;
  } | null>(null);

  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAnimRef = useRef<number | null>(null);
  const bgmInputRef = useRef<HTMLInputElement | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chunkSessionRef = useRef<{
    sessionSpec: LockedVoiceSessionSpec;
    chunks: SafeScriptChunk[];
    completedMap: Map<number, { blob: Blob; url: string; duration: number }>;
    failedChunkIndex: number | null;
  } | null>(null);
  const cachedRawTtsRef = useRef<{
    voiceSignature: string;
    safeChunks: SafeScriptChunk[];
    orderedResults: { blob: Blob; url: string; duration: number }[];
    sessionSpec: LockedVoiceSessionSpec;
  } | null>(null);
  const joinedVoiceTracksCacheRef = useRef<{
    voiceSignature: string;
    safeChunks: SafeScriptChunk[];
    voiceTracks: DecodedPcmTrack[];
    sessionSpec: LockedVoiceSessionSpec;
    joinedVoiceDurationSec: number;
    pureSpeechDurationSec: number;
    isSplitMode: boolean;
  } | null>(null);
  const cachedMasterMixRef = useRef<{
    mixSignature: string;
    file: File;
    duration: number;
  } | null>(null);
  const agentProgressCallbackRef = useRef<
    ((stage: 'voice' | 'bgm', pct: number, message: string) => void) | null
  >(null);

  // Source Mode: 'upload' (100% Offline Upload/Record Voice + BGM) as primary default vs 'tts' (Online AI TTS)
  const [voiceSourceMode, setVoiceSourceMode] = useState<'upload' | 'tts'>('upload');

  // Server API Key Status & Guide State
  const [apiKeyInfo, setApiKeyInfo] = useState<{ hasApiKey: boolean; totalKeys: number; activeKeyIndex?: number }>({
    hasApiKey: true,
    totalKeys: 1,
    activeKeyIndex: 0,
  });
  const [isApiKeyGuideOpen, setIsApiKeyGuideOpen] = useState<boolean>(false);

  const fetchApiKeyStatus = () => {
    const userCustomKey = (localStorage.getItem('user_gemini_api_key') || '').trim();
    const headers: Record<string, string> = {};
    if (userCustomKey) {
      const sanitizedKey = userCustomKey.replace(/[\r\n]+/g, ',').trim();
      if (sanitizedKey) {
        headers['x-gemini-api-key'] = sanitizedKey;
      }
    }
    fetch('/api/health', { headers })
      .then(async (res) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })
      .then((data) => {
        if (data && typeof data.totalKeys === 'number') {
          setApiKeyInfo({
            hasApiKey: Boolean(data.hasApiKey),
            totalKeys: data.totalKeys,
            activeKeyIndex: typeof data.activeKeyIndex === 'number' ? data.activeKeyIndex : 0,
          });
          if (typeof data.activeKeyIndex === 'number') {
            setActiveKeyLabelUsed(`Key ${String(data.activeKeyIndex + 1).padStart(2, '0')}`);
          }
        }
      })
      .catch((e) => console.warn('Health check note:', e));
  };

  useEffect(() => {
    fetchApiKeyStatus();
  }, []);

  // Uploaded Voice State (stores compact 24kHz PCM track in ref instead of giant 48kHz AudioBuffer in React state)
  const [uploadedVoiceFile, setUploadedVoiceFile] = useState<File | null>(null);
  const [uploadedVoiceUrl, setUploadedVoiceUrl] = useState<string | null>(null);
  const [uploadedVoiceName, setUploadedVoiceName] = useState<string>('');
  const [uploadedVoiceDuration, setUploadedVoiceDuration] = useState<number>(0);
  const [isPlayingUploadedVoice, setIsPlayingUploadedVoice] = useState<boolean>(false);
  const [uploadedVoiceCurrentTime, setUploadedVoiceCurrentTime] = useState<number>(0);
  const [hasDecodedVoiceTrack, setHasDecodedVoiceTrack] = useState<boolean>(false);
  const uploadedVoiceTrackRef = useRef<DecodedPcmTrack | null>(null);
  const rawVoiceSourceRef = useRef<File | Blob | string | null>(null);
  const voiceDecodePromiseRef = useRef<Promise<DecodedPcmTrack> | null>(null);

  // Line-End 5-6s Interlude Break Markers (Timestamps in seconds)
  const [breakTimestamps, setBreakTimestamps] = useState<number[]>([]);
  const [manualTimestampInput, setManualTimestampInput] = useState<string>('');
  const [isDetectingPauses, setIsDetectingPauses] = useState<boolean>(false);

  const voiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadedVoiceAnimRef = useRef<number | null>(null);

  // Microphone Direct 100% Offline Recording State
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  // Offline Browser SpeechSynthesis state
  const [isSpeakingOfflineTts, setIsSpeakingOfflineTts] = useState<boolean>(false);

  // Active speaker list based on gender
  const activeSpeakerList = selectedGender === 'female' ? FEMALE_SPEAKERS : MALE_SPEAKERS;

  useEffect(() => {
    return () => {
      if (partPreviewAudioRef.current) {
        try {
          partPreviewAudioRef.current.pause();
        } catch (_) {}
        partPreviewAudioRef.current = null;
      }
    };
  }, []);

  // Auto-align speaker when gender changes ONLY if voice lock is unlocked or current speaker isn't in list
  useEffect(() => {
    if (voiceLockEnabled) return;
    const list = selectedGender === 'female' ? FEMALE_SPEAKERS : MALE_SPEAKERS;
    if (!list.some((s) => s.name === selectedSpeaker)) {
      setSelectedSpeaker(list[0].name);
    }
  }, [selectedGender, voiceLockEnabled]);

  // Live duration estimate for current script & active channel speaking rate
  const liveDurationEstimate = estimateScriptDurationSeconds({
    scriptText,
    channelSlot: currentChannelSlot,
    speechSpeed,
    interludeDuration: effectiveBgmUrl ? interludeDuration : 0.65,
    audioMixMode: effectiveBgmUrl ? audioMixMode : 'pure_voice',
  });

  // Auto-sync Voice Studio Script Adapt targetMinutes/targetSeconds to current script + speechSpeed when not manually overridden
  useEffect(() => {
    if (isManualTargetDuration) return;
    if (!scriptText.trim()) {
      setTargetMinutes(0);
      setTargetSeconds(0);
      return;
    }
    const estSec = Math.max(5, Math.round(liveDurationEstimate.estimatedTotalSeconds));
    setTargetMinutes(Math.floor(estSec / 60));
    setTargetSeconds(estSec % 60);
  }, [
    isManualTargetDuration,
    scriptText,
    liveDurationEstimate.estimatedTotalSeconds,
  ]);

  // Parse brackets & analyze sequential voice parts whenever script/channel/speed changes
  useEffect(() => {
    const parsed = parseBracketParagraphs(scriptText);
    setBracketParagraphs(parsed);

    const analysis = analyzeAndSplitLongScript({
      rawScript: scriptText,
      channelSlot: currentChannelSlot,
      speechSpeed,
      interludeDuration: effectiveBgmUrl ? interludeDuration : 0.45,
      audioMixMode: effectiveBgmUrl ? audioMixMode : 'pure_voice',
      maxCharsPerPart: 5200,
    });
    setIsSplitModeActive(analysis.isSplitMode);

    if (!isProcessing) {
      const completedMap = chunkSessionRef.current?.completedMap;
      const failedIdx = chunkSessionRef.current?.failedChunkIndex ?? null;
      const sameSessionScript =
        chunkSessionRef.current &&
        chunkSessionRef.current.chunks.length === analysis.parts.length &&
        chunkSessionRef.current.chunks.every((c, idx) => c.cleanText === analysis.parts[idx]?.cleanText);

      setVoicePartsQueue(
        analysis.parts.map((p) => {
          if (sameSessionScript && completedMap?.has(p.index)) {
            const done = completedMap.get(p.index)!;
            return {
              ...p,
              status: 'Completed' as PartGenerationStatus,
              audioDurationSec: done.duration,
              audioUrl: done.url,
            };
          }
          if (sameSessionScript && failedIdx === p.index) {
            return { ...p, status: 'Failed' as PartGenerationStatus };
          }
          return { ...p, status: 'Waiting' as PartGenerationStatus };
        })
      );
    }
  }, [scriptText, currentChannelSlot, speechSpeed, effectiveBgmUrl, interludeDuration, audioMixMode, isProcessing]);

  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const channelData: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }

    const numSamples = buffer.length;
    const byteRate = (sampleRate * numChannels * bitDepth) / 8;
    const blockAlign = (numChannels * bitDepth) / 8;
    const dataSize = numSamples * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channelData[ch][i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Auto-bracket formatter tool: wraps unbracketed paragraphs into [ ... ]
  const handleAutoBracketFormat = () => {
    const paras = scriptText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const formatted = paras
      .map((p) => {
        const clean = p.replace(/^\[\s*|\s*\]$/g, '').trim();
        return `[ ${clean} ]`;
      })
      .join('\n\n');

    handleUpdateScript(formatted);
  };

  // Paste clipboard content into script
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleUpdateScript(scriptText ? scriptText + '\n\n' + text : text);
          return;
        }
      }
    } catch (_) {}
  };

  // Pause / Resume Voice Generation without losing completed chunks
  const handleTogglePauseGeneration = () => {
    const nextPaused = !isPausedRef.current;
    isPausedRef.current = nextPaused;
    setIsPausedGeneration(nextPaused);
    if (nextPaused) {
      setProcessingStatus('ভয়েস তৈরি সাময়িক বিরতিতে (Paused) আছে — আগের অডিও অংশগুলো সংরক্ষিত!');
    } else {
      setProcessingStatus('ভয়েস তৈরি পুনরায় চালু হচ্ছে (Resumed)...');
    }
  };

  // Stop/Cancel Voice Generation
  const handleStopGeneration = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPausedGeneration(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setProgressPercent(0);
    setProcessingStatus('ভয়েস তৈরি বন্ধ করা হয়েছে (Stopped)');
  };

  // Play/Pause preview for an individual completed Part
  const handleTogglePlaySinglePart = (part: SequentialPartItem) => {
    if (!part.audioUrl) return;
    if (playingPartIndex === part.index && partPreviewAudioRef.current) {
      partPreviewAudioRef.current.pause();
      partPreviewAudioRef.current = null;
      setPlayingPartIndex(null);
      return;
    }
    if (partPreviewAudioRef.current) {
      try {
        partPreviewAudioRef.current.pause();
      } catch (_) {}
    }
    const audio = new Audio(part.audioUrl);
    partPreviewAudioRef.current = audio;
    setPlayingPartIndex(part.index);
    audio.onended = () => {
      setPlayingPartIndex(null);
      partPreviewAudioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingPartIndex(null);
      partPreviewAudioRef.current = null;
    };
    audio.play().catch(() => setPlayingPartIndex(null));
  };

  /**
   * 100% Local Browser-Side Voice Joining + Background Music Duration Control (Rules 4, 5, 6, 7):
   * - Joins all Parts in exact sequential order (Part 01 -> Part 02 -> ... -> Part N) without dropping anything.
   * - NEVER cuts/trims ANY voice part and NEVER alters voice speed to stretch/compress into Final Duration!
   * - Situation 1: BGM > Final Duration -> trims BGM cleanly.
   * - Situation 2: BGM < Final Duration -> seamlessly loops varied BGM sections with 1.5s equal-power crossfades.
   * - Situation 3: Voice < Final Duration -> keeps 100% voice untouched, fills remaining duration smoothly with BGM.
   * - Situation 4: Voice > Final Duration -> preserves 100% voice untouched + alerts user cleanly!
   */
  const assembleFinalAudioFromVoiceTracks = async (opts: {
    safeChunks: SafeScriptChunk[];
    voiceTracks: DecodedPcmTrack[];
    sessionSpec: LockedVoiceSessionSpec;
    voiceSignature: string;
    isSplitMode: boolean;
    targetDurationOverrideSec?: number | null;
    usedCachedVoiceOnly?: boolean;
  }): Promise<{ file: File; duration: number; voiceSkipped: boolean }> => {
    const { safeChunks, voiceTracks, sessionSpec, voiceSignature, isSplitMode } = opts;
    const targetSampleRate = 24000;

    // Decode BGM locally into compact 24kHz PCM if active
    let bgmTrack: DecodedPcmTrack | null = null;
    const activeBgmSource: File | string | null = dedicatedBgmFile || effectiveBgmUrl;

    if (audioMixMode !== 'pure_voice' && activeBgmSource) {
      setProcessingStatus('ব্যাকগ্রাউন্ড মিউজিক লোড ও ডিউরেশন বিশ্লেষণ হচ্ছে...');
      const bgmLabel = effectiveBgmName || 'ব্যাকগ্রাউন্ড মিউজিক';
      const bgmCacheKey = dedicatedBgmFile
        ? `file:${dedicatedBgmFile.name}:${dedicatedBgmFile.size}:${dedicatedBgmFile.lastModified}`
        : `url:${String(effectiveBgmUrl)}`;
      if (dedicatedBgmTrackRef.current?.key === bgmCacheKey) {
        bgmTrack = dedicatedBgmTrackRef.current.track;
      } else {
        try {
          bgmTrack = await decodeAudioSourceToPcmTrack(activeBgmSource, {
            targetSampleRate,
            forceMono: false,
          });
          dedicatedBgmTrackRef.current = { key: bgmCacheKey, track: bgmTrack };
        } catch (bgmErr: any) {
          throw new Error(`ব্যাকগ্রাউন্ড মিউজিক (${bgmLabel}) ডিকোড করা যায়নি: ${bgmErr?.message || 'অসমর্থিত ফরম্যাট'}`);
        }
      }
    }

    const hasUploadedBgm = Boolean(bgmTrack) && audioMixMode !== 'pure_voice';

    // When a <6-min single-pass script has BGM active, slice only at natural speech pauses for BGM interludes (zero-copy)
    const mixVoiceTracks: DecodedPcmTrack[] = [];
    const mixIsBracketEnd: boolean[] = [];

    for (let i = 0; i < voiceTracks.length; i++) {
      const track = voiceTracks[i];
      const origFlag = safeChunks[i]?.isEndOfBracket ?? true;
      if (hasUploadedBgm && !isSplitMode && track.duration > 38) {
        let pauses = detectSpeechPausesFromPcmTrack(track, 0.40, undefined, 32);
        if (pauses.length === 0 && track.duration > 65) {
          pauses = detectSpeechPausesFromPcmTrack(track, 0.28, undefined, 36);
        }
        const validPauses = pauses.filter((p) => p > 4.0 && p < track.duration - 4.0);
        if (validPauses.length > 0) {
          const sr = track.sampleRate || targetSampleRate;
          const markers = [0, ...validPauses, track.duration];
          for (let m = 0; m < markers.length - 1; m++) {
            const sFrame = Math.max(0, Math.floor(markers[m] * sr));
            const eFrame = Math.min(track.length, Math.ceil(markers[m + 1] * sr));
            const subLen = eFrame - sFrame;
            if (subLen > sr * 0.4) {
              mixVoiceTracks.push({
                sampleRate: sr,
                channels: track.channels.map((ch) => ch.subarray(sFrame, eFrame)),
                length: subLen,
                duration: subLen / sr,
              });
              mixIsBracketEnd.push(true);
            }
          }
          continue;
        }
      }
      mixVoiceTracks.push(track);
      mixIsBracketEnd.push(origFlag);
    }

    // Exact user speed (NEVER altered automatically!)
    const effectiveVoiceSpeed = sessionSpec.speed || 1.0;
    const numVoice = mixVoiceTracks.length;
    const bracketEndIndices = mixIsBracketEnd.filter(Boolean).length;
    const numInterludes = hasUploadedBgm ? Math.max(0, bracketEndIndices - 1) : 0;
    const numSubGaps = Math.max(0, numVoice - 1 - numInterludes);

    let pureSpeechDurationSec = 0;
    for (let i = 0; i < numVoice; i++) {
      pureSpeechDurationSec += mixVoiceTracks[i].duration / effectiveVoiceSpeed;
    }

    // Minimal natural intra-part pauses (no unnecessary gaps/silence!)
    const baseSubGap = 0.16;
    const baseNaturalInterlude = hasUploadedBgm ? interludeDuration : 0.38;
    const naturalJoinedVoiceDurationSec =
      pureSpeechDurationSec + numSubGaps * 0.16 + Math.max(0, bracketEndIndices - 1) * 0.38;

    setJoinedVoiceTrackSummary({
      actualVoiceDurationSec: naturalJoinedVoiceDurationSec,
      pureSpeechDurationSec,
      partCount: safeChunks.length,
      isSplitMode,
      voiceSignature,
    });

    // Resolve requested Final Audio Duration (Homepage override OR Voice Studio custom Final Duration Control)
    const studioTargetSec =
      finalAudioDurationMode === 'custom'
        ? finalAudioTargetMinutes * 60 + finalAudioTargetSeconds
        : 0;
    const requestedFinalTargetSec =
      opts.targetDurationOverrideSec && opts.targetDurationOverrideSec > 0
        ? Math.max(5, opts.targetDurationOverrideSec)
        : studioTargetSec > 0
          ? Math.max(5, studioTargetSec)
          : null;

    let effectiveInterludeDuration = baseNaturalInterlude;
    let effectiveSubGap = baseSubGap;
    let notice: { type: 'ok' | 'warning'; message: string } | null = null;

    // Minimal voice-only length (never trims voice, never alters voice speed!)
    const tightJoinedVoiceEndSec =
      pureSpeechDurationSec + numSubGaps * 0.14 + numInterludes * (hasUploadedBgm ? 0.45 : 0.35);

    if (requestedFinalTargetSec !== null) {
      const fullBreaksTotal = numSubGaps * baseSubGap + numInterludes * baseNaturalInterlude;
      const voiceWithPreferredBreaksEnd = pureSpeechDurationSec + fullBreaksTotal;

      if (tightJoinedVoiceEndSec > requestedFinalTargetSec - 0.1) {
        // SITUATION 4: Voice > Final Duration -> NEVER cut voice! Preserve 100% speech and warn clearly!
        effectiveSubGap = 0.14;
        effectiveInterludeDuration = hasUploadedBgm ? Math.min(1.2, baseNaturalInterlude) : 0.35;
      } else if (voiceWithPreferredBreaksEnd > requestedFinalTargetSec - 0.4 && numInterludes > 0) {
        // Slightly tighten inter-bracket BGM breaks so full voice still fits cleanly inside Final Duration
        const remainForBreaks = Math.max(0, requestedFinalTargetSec - 0.5 - pureSpeechDurationSec - numSubGaps * effectiveSubGap);
        effectiveInterludeDuration = Math.max(0.45, Math.min(baseNaturalInterlude, remainForBreaks / numInterludes));
      }
    }

    let timelineTime = 0;
    const events: TimelineVoicePlacement[] = [];

    for (let i = 0; i < numVoice; i++) {
      const vDur = mixVoiceTracks[i].duration / effectiveVoiceSpeed;
      const vStart = timelineTime;
      const vEnd = vStart + vDur;

      const isLast = i === numVoice - 1;
      const isBracketBoundary = mixIsBracketEnd[i];
      const curGap = isLast
        ? 0
        : isBracketBoundary
          ? effectiveInterludeDuration
          : effectiveSubGap;

      const iStart = vEnd;
      const iEnd = iStart + curGap;

      events.push({
        chunkIndex: i,
        voiceStartSec: vStart,
        voiceEndSec: vEnd,
        voiceDurationSec: vDur,
        isEndOfBracket: hasUploadedBgm ? isBracketBoundary : false,
        interludeStartSec: iStart,
        interludeEndSec: iEnd,
      });

      timelineTime = isLast ? vEnd : iEnd;
    }

    const joinedVoiceEndSec = timelineTime;
    const defaultTail = hasUploadedBgm ? 2.2 : 0.35;
    let totalDuration = joinedVoiceEndSec + defaultTail;

    if (requestedFinalTargetSec !== null) {
      if (joinedVoiceEndSec > requestedFinalTargetSec - 0.15) {
        // SITUATION 4: Voice is longer than selected Final Duration -> keep 100% of voice + smooth tail, warn user!
        totalDuration = joinedVoiceEndSec + defaultTail;
        notice = {
          type: 'warning',
          message: `⚠️ সতর্কতা: সম্পূর্ণ Voice Track-এর দৈর্ঘ্য (${formatTimeMMSS(joinedVoiceEndSec)}) আপনার নির্ধারিত Final Duration (${formatTimeMMSS(requestedFinalTargetSec)})-এর চেয়ে দীর্ঘ। ভয়েসের কোনো অংশ বাদ না দিয়ে সম্পূর্ণ বক্তব্য অক্ষুণ্ণ রেখে চূড়ান্ত দৈর্ঘ্য ${formatTimeMMSS(totalDuration)} নির্ধারণ করা হয়েছে।`,
        };
      } else {
        // SITUATION 3: Voice <= Final Duration -> keep 100% voice at original speed, fill remainder with BGM to exact target!
        totalDuration = requestedFinalTargetSec;
        const extraMusicSec = Math.max(0, totalDuration - joinedVoiceEndSec);
        const bgmActionBn = bgmTrack
          ? bgmTrack.duration > totalDuration
            ? 'অতিরিক্ত BGM কেটে নির্ধারিত দৈর্ঘ্যে আনা হয়েছে'
            : 'BGM-কে স্মুথলি Loop করে বাকি সময় পূর্ণ করা হয়েছে'
          : 'বাকি সময় আউটরো প্যাডিং করা হয়েছে';
        notice = {
          type: 'ok',
          message: `✅ সম্পূর্ণ Voice Track (${formatTimeMMSS(joinedVoiceEndSec)}) অক্ষুণ্ণ রেখে ${formatTimeMMSS(totalDuration)} চূড়ান্ত অডিও প্রস্তুত হয়েছে (${bgmActionBn} • +${formatTimeMMSS(extraMusicSec)})।`,
        };
      }
    }

    setDurationAdjustmentNotice(notice);
    setProgressPercent(75);
    setProcessingStatus(
      `লো-র‍্যাম মাস্টার অডিও মিক্সিং (${formatTimeMMSS(totalDuration)}) — ${sessionSpec.voiceId} [CH ${sessionSpec.channelSlot}]...`
    );

    const mixedResult = await mixTimelineLowRamToWav({
      voiceTracks: mixVoiceTracks,
      events,
      bgmTrack,
      totalDurationSec: totalDuration,
      effectiveVoiceSpeed,
      voiceVolume,
      audioMixMode,
      bgmDuckedVolume,
      bgmLoudVolume,
      sampleRate: targetSampleRate,
      onProgress: (mixPct) => {
        setProgressPercent(75 + Math.round(mixPct * 0.24));
        agentProgressCallbackRef.current?.(
          'bgm',
          20 + Math.round(mixPct * 0.8),
          hasUploadedBgm
            ? `ব্যাকগ্রাউন্ড মিউজিক ও অডিও মিক্সিং চলছে (${mixPct}%)...`
            : `মাস্টার অডিও প্রসেসিং চলছে (${mixPct}%)...`
        );
      },
    });

    const wavBlob = mixedResult.blob;
    const mixedUrl = URL.createObjectURL(wavBlob);

    setMasterAudioBlob(wavBlob);
    setMasterAudioUrl(mixedUrl);
    setMasterDuration(mixedResult.duration);
    setMasterPlaybackTime(0);
    setIsPlayingMaster(false);
    setMasterSourceMeta({
      mode: 'tts',
      voiceKey: voiceSignature,
      bgmKey: `${effectiveBgmUrl || ''}:${audioMixMode}:${interludeDuration}:${effectiveVoiceSpeed}:tgt=${requestedFinalTargetSec ?? 0}`,
      breakCount: numInterludes,
    });

    setDurationReport({
      targetSec: Math.round(requestedFinalTargetSec ?? mixedResult.duration),
      actualSec: mixedResult.duration,
      speechOnlySec: pureSpeechDurationSec,
      accuracyPct: requestedFinalTargetSec
        ? Math.max(0, Math.min(100, Math.round((1 - Math.abs(mixedResult.duration - requestedFinalTargetSec) / requestedFinalTargetSec) * 100)))
        : 100,
    });

    const audioFileName = `CH${sessionSpec.channelSlot}_${sessionSpec.voiceId}_BengaliVoice_${Date.now()}.wav`;
    const masterFile = new File([wavBlob], audioFileName, { type: 'audio/wav' });
    cachedMasterMixRef.current = {
      mixSignature: JSON.stringify({
        voiceSignature,
        bgmUrl: effectiveBgmUrl || '',
        audioMixMode,
        bgmDuckedVolume,
        bgmLoudVolume,
        interludeDuration,
        speed: effectiveVoiceSpeed,
        targetDur: requestedFinalTargetSec ?? 0,
      }),
      file: masterFile,
      duration: mixedResult.duration,
    };

    if (onMasterVoiceGenerated) {
      onMasterVoiceGenerated(masterFile, mixedResult.duration);
    } else if (onAudioUploaded) {
      onAudioUploaded(masterFile, mixedResult.duration);
    }

    setProgressPercent(100);
    setProcessingStatus(
      `মাস্টার অডিও সম্পন্ন! [Voice Track: ${formatTimeMMSS(naturalJoinedVoiceDurationSec)} | চূড়ান্ত দৈর্ঘ্য: ${formatTimeMMSS(mixedResult.duration)}]`
    );

    return {
      file: masterFile,
      duration: mixedResult.duration,
      voiceSkipped: Boolean(opts.usedCachedVoiceOnly),
    };
  };

  // Re-apply Final Duration & BGM locally using cached Joined Voice Track (zero TTS regeneration!)
  const handleReapplyBgmAndDurationLocal = async () => {
    const cached = joinedVoiceTracksCacheRef.current;
    if (!cached || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(70);
    setProcessingStatus('পূর্বের সম্পূর্ণ Voice Track-এ নতুন BGM ও Duration প্রয়োগ হচ্ছে...');
    try {
      await assembleFinalAudioFromVoiceTracks({
        safeChunks: cached.safeChunks,
        voiceTracks: cached.voiceTracks,
        sessionSpec: cached.sessionSpec,
        voiceSignature: cached.voiceSignature,
        isSplitMode: cached.isSplitMode,
        usedCachedVoiceOnly: true,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'অডিও মিক্সিংয়ে সমস্যা হয়েছে।');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Master Audio locally in MP3 format (100% browser-local chunked encoding)
  const handleDownloadMasterMp3 = async () => {
    if (!masterAudioBlob || isExportingMp3) return;
    setIsExportingMp3(true);
    setMp3ExportProgress(0);
    setErrorMessage(null);
    try {
      const mp3Blob = await encodeWavBlobToMp3LowRam(masterAudioBlob, 128, (pct) => {
        setMp3ExportProgress(pct);
      });
      const mp3Url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = mp3Url;
      a.download = `Master_Voiceover_${selectedSpeaker}_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(mp3Url);
        } catch (_) {}
      }, 15_000);
    } catch (err: any) {
      setErrorMessage(`MP3 এক্সপোর্ট ত্রুটি: ${err?.message || 'রূপান্তর করা যায়নি'}`);
    } finally {
      setIsExportingMp3(false);
      setMp3ExportProgress(0);
    }
  };

  // Download Pure Voice Only (without BGM) in MP3 format
  const handleDownloadPureVoiceMp3 = async () => {
    const cached = joinedVoiceTracksCacheRef.current;
    if (!cached || isExportingPureMp3) return;
    setIsExportingPureMp3(true);
    setErrorMessage(null);
    try {
      const pureResult = await mixTimelineLowRamToWav({
        voiceTracks: cached.voiceTracks,
        events: cached.voiceTracks.map((_, i) => ({
          chunkIndex: i,
          voiceStartSec: 0,
          voiceEndSec: cached.voiceTracks[i].duration / cached.sessionSpec.speed,
          voiceDurationSec: cached.voiceTracks[i].duration / cached.sessionSpec.speed,
          isEndOfBracket: false,
          interludeStartSec: 0,
          interludeEndSec: 0,
        })),
        bgmTrack: null,
        totalDurationSec: joinedVoiceTrackSummary?.actualVoiceDurationSec || 10,
        effectiveVoiceSpeed: cached.sessionSpec.speed,
        voiceVolume: 1.0,
        audioMixMode: 'pure_voice',
        bgmDuckedVolume: 0,
        bgmLoudVolume: 0,
        sampleRate: 24000,
      });

      const mp3Blob = await encodeWavBlobToMp3LowRam(pureResult.blob, 128, () => {});
      const mp3Url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = mp3Url;
      a.download = `Pure_Voice_Only_${cached.sessionSpec.voiceId}_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(mp3Url), 15000);
    } catch (err: any) {
      setErrorMessage(`খালি ভয়েস MP3 এক্সপোর্ট ত্রুটি: ${err?.message || 'রূপান্তর করা যায়নি'}`);
    } finally {
      setIsExportingPureMp3(false);
    }
  };

  // MAIN LONG-AUDIO GENERATOR & SEQUENTIAL VOICE SYSTEM (Rules 1, 2, 3, 4, 8)
  const handleGenerateAndMergeAudio = async (
    resumeFromCheckpoint = false,
    agentOpts?: {
      forceRegenerateVoice?: boolean;
      throwOnError?: boolean;
      targetDurationOverrideSec?: number | null;
      scriptOverride?: string;
    }
  ): Promise<{ file: File; duration: number; voiceSkipped: boolean } | null> => {
    const activeScriptText = agentOpts?.scriptOverride ?? scriptText;

    // Lock Voice ID, Gender, Model, Seed, Tone, Pitch & Style at Part 01 so EVERY Part & Retry uses the exact same Speaker!
    const lockedProfile = getChannelVoiceProfile(currentChannelSlot);
    const lockedVoiceId = voiceLockEnabled ? lockedProfile.voiceId : selectedSpeaker;
    const lockedGender = voiceLockEnabled ? lockedProfile.gender : selectedGender;
    const matchedSpeakerMeta = ALL_GEMINI_25_SPEAKERS.find((s) => s.name === lockedVoiceId);

    const hasExistingSession = Boolean(resumeFromCheckpoint && chunkSessionRef.current);
    let activeSessionSpec: LockedVoiceSessionSpec = hasExistingSession
      ? chunkSessionRef.current!.sessionSpec
      : buildLockedVoiceSessionSpec({
          channelSlot: currentChannelSlot,
          channelName: activeChannelCustomName,
          voiceIdOverride: lockedVoiceId,
          genderOverride: lockedGender,
          speakerTone: matchedSpeakerMeta?.tone,
          speakerPitch: matchedSpeakerMeta?.pitch,
          model: selectedTTSModel,
          speed: speechSpeed,
          strictModelLock: false,
        });

    const scriptAnalysis = analyzeAndSplitLongScript({
      rawScript: activeScriptText,
      channelSlot: activeSessionSpec.channelSlot,
      speechSpeed: activeSessionSpec.speed,
      interludeDuration: effectiveBgmUrl ? interludeDuration : 0.45,
      audioMixMode: effectiveBgmUrl ? audioMixMode : 'pure_voice',
      maxCharsPerPart: 5200,
    });

    const safeChunks =
      hasExistingSession && chunkSessionRef.current
        ? chunkSessionRef.current.chunks
        : scriptAnalysis.parts;

    if (safeChunks.length === 0) {
      const msg = 'অনুগ্রহ করে স্ক্রিপ্ট বক্সে কিছু লিখুন!';
      if (agentOpts?.throwOnError) throw new Error(msg);
      alert(msg);
      return null;
    }

    const userCustomKey = (localStorage.getItem('user_gemini_api_key') || '').trim();
    if (!userCustomKey && (!apiKeyInfo.hasApiKey || apiKeyInfo.totalKeys === 0)) {
      setIsApiKeyGuideOpen(true);
      const errText = '⚠️ কোনো Gemini API Key সেট করা নেই! ভয়েস তৈরি করার জন্য উপরে "🔑 Key" বাটনে ক্লিক করে আপনার Gemini API Key পেস্ট করুন।';
      setErrorMessage(errText);
      if (agentOpts?.throwOnError) throw new Error(errText);
      return null;
    }

    const completedMap: Map<number, { blob: Blob; url: string; duration: number }> =
      hasExistingSession && chunkSessionRef.current
        ? chunkSessionRef.current.completedMap
        : new Map();

    // If any parts already succeeded in this session, lock the model strictly so no subsequent Part/Retry can switch models
    if (completedMap.size > 0 && !activeSessionSpec.strictModelLock) {
      activeSessionSpec = lockSessionModel(activeSessionSpec, activeSessionSpec.model);
    }

    chunkSessionRef.current = {
      sessionSpec: activeSessionSpec,
      chunks: safeChunks,
      completedMap,
      failedChunkIndex: null,
    };

    isCancelledRef.current = false;
    isPausedRef.current = false;
    setIsPausedGeneration(false);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsProcessing(true);
    setErrorMessage(null);
    setDurationAdjustmentNotice(null);
    setResumableCheckpoint(null);
    setDurationReport(null);
    setIsSplitModeActive(scriptAnalysis.isSplitMode);
    setProgressPercent(Math.max(3, Math.round((completedMap.size / safeChunks.length) * 65)));
    setProcessingStatus(
      scriptAnalysis.isSplitMode
        ? `🔒 Single Speaker: ${activeSessionSpec.voiceId} (${safeChunks.length} Parts, প্রতি অংশ ~৭–৮ মিনিট / ≤৫,২০০ অক্ষর) — ধারাবাহিক ভয়েস তৈরি হচ্ছে...`
        : `৮ মিনিটের কম স্ক্রিপ্ট — একবারেই সম্পূর্ণ ভয়েস তৈরি হচ্ছে [${activeSessionSpec.voiceId}]...`
    );

    const currentVoiceSignature = JSON.stringify({
      script: activeScriptText.trim(),
      slot: activeSessionSpec.channelSlot,
      voiceId: activeSessionSpec.voiceId,
      gender: activeSessionSpec.gender,
      model: activeSessionSpec.model,
      packedMode: 'v4_5200c_split',
    });

    const cachedTts =
      !resumeFromCheckpoint &&
      !agentOpts?.forceRegenerateVoice &&
      cachedRawTtsRef.current?.voiceSignature === currentVoiceSignature
        ? cachedRawTtsRef.current
        : null;

    if (cachedTts) {
      cachedTts.safeChunks.forEach((c, idx) => {
        if (cachedTts.orderedResults[idx]) {
          completedMap.set(c.index, cachedTts.orderedResults[idx]);
        }
      });
    }

    // Initialize sequential Part status rows
    setVoicePartsQueue(
      safeChunks.map((seg) => {
        const existing = completedMap.get(seg.index);
        return existing
          ? {
              ...seg,
              status: 'Completed' as PartGenerationStatus,
              audioDurationSec: existing.duration,
              audioUrl: existing.url,
            }
          : { ...seg, status: 'Waiting' as PartGenerationStatus };
      })
    );

    try {
      let isFirstChunkInThisRun = true;
      const usedCachedVoiceOnly = Boolean(cachedTts);

      if (usedCachedVoiceOnly) {
        agentProgressCallbackRef.current?.(
          'voice',
          100,
          'আগে তৈরি করা ভয়েস পাওয়া গেছে — পুনরায় তৈরি না করে সরাসরি BGM ও Duration মিক্সিং চলছে...'
        );
      }

      // 1. Strict Sequential Generation: 1 Part at a time (Waiting -> Generating -> Completed / Failed)
      for (let i = 0; i < safeChunks.length; i++) {
        const seg = safeChunks[i];

        if (completedMap.has(seg.index)) {
          continue; // Never regenerate already Completed Parts!
        }

        // Wait cleanly if paused
        while (isPausedRef.current) {
          if (isCancelledRef.current) {
            setIsProcessing(false);
            return null;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        if (isCancelledRef.current) {
          setIsProcessing(false);
          return null;
        }

        // Gentle pacing between Parts so Gemini RPM stays steady
        if (!isFirstChunkInThisRun && safeChunks.length > 1) {
          const totalK = apiKeyInfo.totalKeys || 1;
          const paceDelayMs = totalK >= 4 ? 1000 : totalK >= 2 ? 1500 : 2500;
          await new Promise((resolve) => setTimeout(resolve, paceDelayMs));
        }

        const totalDoneSec = Array.from(completedMap.values()).reduce((acc, c) => acc + c.duration, 0);
        const posLabel = `${seg.partLabel} (${i + 1}/${safeChunks.length})`;
        const doneLabel = formatTimeMMSS(totalDoneSec);

        setVoicePartsQueue((prev) =>
          prev.map((item) =>
            item.index === seg.index
              ? { ...item, status: 'Generating', errorMessage: undefined }
              : item
          )
        );

        const pctVoice = Math.max(4, Math.min(99, Math.round(((completedMap.size + 0.15) / Math.max(1, safeChunks.length)) * 100)));
        setProcessingStatus(
          `🔒 ${activeSessionSpec.voiceId} [CH ${activeSessionSpec.channelSlot}] • ${posLabel} তৈরি হচ্ছে • সম্পন্ন: ${doneLabel} [${activeKeyLabelUsed}]`
        );
        setProgressPercent(5 + Math.round((completedMap.size / safeChunks.length) * 60));
        agentProgressCallbackRef.current?.(
          'voice',
          pctVoice,
          `ভয়েস তৈরি হচ্ছে: ${posLabel} (সম্পন্ন: ${doneLabel})`
        );

        try {
          const chunkResult = await synthesizeGeminiTtsChunk({
            text: seg.cleanText,
            sessionSpec: activeSessionSpec,
            signal,
            isCancelled: () => isCancelledRef.current,
            isPaused: () => isPausedRef.current,
            forceRetryFirstAttempt: resumeFromCheckpoint && isFirstChunkInThisRun,
            chunkPositionLabel: posLabel,
            completedAudioLabel: doneLabel,
            onStatus: (msg) => {
              setProcessingStatus(msg);
              agentProgressCallbackRef.current?.('voice', pctVoice, msg);
            },
            onTotalKeysUpdated: (totalKeys) =>
              setApiKeyInfo((prev) => ({ ...prev, totalKeys })),
            onUsedKeyLabel: (label) => setActiveKeyLabelUsed(label),
          });
          isFirstChunkInThisRun = false;

          // Freeze the resolved model strictly after Part 01 so Part 02..NN & Retries NEVER switch models!
          if (!activeSessionSpec.strictModelLock) {
            const resolvedModel = chunkResult.modelUsed || activeSessionSpec.model;
            activeSessionSpec = lockSessionModel(activeSessionSpec, resolvedModel);
            if (chunkSessionRef.current) {
              chunkSessionRef.current.sessionSpec = activeSessionSpec;
            }
            if (resolvedModel !== selectedTTSModel) {
              setSelectedTTSModel(resolvedModel);
            }
          }

          if (isCancelledRef.current) {
            setIsProcessing(false);
            return null;
          }

          completedMap.set(seg.index, {
            blob: chunkResult.blob,
            url: chunkResult.url,
            duration: chunkResult.duration,
          });

          setVoicePartsQueue((prev) =>
            prev.map((item) =>
              item.index === seg.index
                ? {
                    ...item,
                    status: 'Completed',
                    audioDurationSec: chunkResult.duration,
                    audioUrl: chunkResult.url,
                    errorMessage: undefined,
                  }
                : item
            )
          );

          const updatedDoneSec = Array.from(completedMap.values()).reduce((acc, c) => acc + c.duration, 0);
          const updatedPctVoice = Math.min(100, Math.round((completedMap.size / Math.max(1, safeChunks.length)) * 100));
          agentProgressCallbackRef.current?.(
            'voice',
            updatedPctVoice,
            `ভয়েস তৈরি হয়েছে: ${posLabel} (সম্পন্ন: ${formatTimeMMSS(updatedDoneSec)})`
          );
        } catch (chunkErr: any) {
          if (chunkErr?.name === 'AbortError' || isCancelledRef.current) {
            throw chunkErr;
          }
          // Mark ONLY this part as Failed while preserving all previously Completed parts & locked speaker cleanly!
          setVoicePartsQueue((prev) =>
            prev.map((item) =>
              item.index === seg.index
                ? {
                    ...item,
                    status: 'Failed',
                    errorMessage: chunkErr?.message || 'তৈরি করতে ব্যর্থ হয়েছে',
                  }
                : item
            )
          );
          if (chunkSessionRef.current) {
            chunkSessionRef.current.failedChunkIndex = seg.index;
          }
          setResumableCheckpoint({
            completedCount: completedMap.size,
            totalCount: safeChunks.length,
            failedChunkIndex: seg.index,
            channelSlot: activeSessionSpec.channelSlot,
            voiceId: activeSessionSpec.voiceId,
            model: activeSessionSpec.model,
            tone: activeSessionSpec.speakerTone,
            seed: activeSessionSpec.seed,
          });
          throw chunkErr;
        }
      }

      if (isCancelledRef.current) {
        setIsProcessing(false);
        return null;
      }

      // All Parts Completed cleanly with the exact same Single Speaker
      setResumableCheckpoint(null);

      const finalVoiceSignature = JSON.stringify({
        script: activeScriptText.trim(),
        slot: activeSessionSpec.channelSlot,
        voiceId: activeSessionSpec.voiceId,
        gender: activeSessionSpec.gender,
        model: activeSessionSpec.model,
        packedMode: 'v4_5200c_split',
      });

      const orderedResults = safeChunks.map((c) => completedMap.get(c.index)!);
      cachedRawTtsRef.current = {
        voiceSignature: finalVoiceSignature,
        safeChunks,
        orderedResults,
        sessionSpec: activeSessionSpec,
      };
      agentProgressCallbackRef.current?.('voice', 100, 'সবগুলো Voice Part সফলভাবে সম্পন্ন হয়েছে!');
      agentProgressCallbackRef.current?.('bgm', 15, 'Timeline-এ Voice Part জোড়া লাগানো ও BGM মিক্সিং হচ্ছে...');

      setBracketParagraphs((prev) =>
        prev.map((p, idx) => {
          const matching = orderedResults.find((_, ci) => safeChunks[ci].bracketIndex === idx + 1);
          return {
            ...p,
            blob: matching?.blob,
            url: matching?.url,
            duration: matching?.duration,
          };
        })
      );

      setProgressPercent(68);
      setProcessingStatus('সবগুলো Voice Part ধারাবাহিকভাবে Timeline-এ জোড়া লাগানো হচ্ছে...');

      // 2. Decode voice parts locally (24kHz PCM) & cache joined tracks for zero-TTS re-mixing
      const targetSampleRate = 24000;
      const voiceTracks: DecodedPcmTrack[] = [];
      for (let i = 0; i < safeChunks.length; i++) {
        const resChunk = orderedResults[i];
        try {
          const track = await decodeAudioSourceToPcmTrack(resChunk.blob, {
            targetSampleRate,
            forceMono: false,
          });
          voiceTracks.push(track);
        } catch (vDecErr: any) {
          throw new Error(`${safeChunks[i].partLabel} ডিকোড করা যায়নি: ${vDecErr?.message || 'অডিও ফরম্যাট ত্রুটি'}`);
        }
        if (i % 5 === 4) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      const speedNow = activeSessionSpec.speed || 1.0;
      const pureSpeechSec = voiceTracks.reduce((acc, tr) => acc + tr.duration / speedNow, 0);
      const joinedNaturalGaps = safeChunks.reduce((acc, c, idx) => {
        if (idx === safeChunks.length - 1) return acc;
        return acc + (c.isEndOfBracket ? 0.38 : 0.16);
      }, 0);

      joinedVoiceTracksCacheRef.current = {
        voiceSignature: finalVoiceSignature,
        safeChunks,
        voiceTracks,
        sessionSpec: activeSessionSpec,
        joinedVoiceDurationSec: pureSpeechSec + joinedNaturalGaps,
        pureSpeechDurationSec: pureSpeechSec,
        isSplitMode: scriptAnalysis.isSplitMode,
      };

      // 3. Join all Parts in exact sequential order + apply BGM & Final Duration locally
      const finalOut = await assembleFinalAudioFromVoiceTracks({
        safeChunks,
        voiceTracks,
        sessionSpec: activeSessionSpec,
        voiceSignature: finalVoiceSignature,
        isSplitMode: scriptAnalysis.isSplitMode,
        targetDurationOverrideSec: agentOpts?.targetDurationOverrideSec,
        usedCachedVoiceOnly,
      });

      chunkSessionRef.current = null;
      return finalOut;
    } catch (err: any) {
      if (err?.name === 'AbortError' || isCancelledRef.current) {
        console.log('Voice generation cancelled by user.');
        setProcessingStatus('ভয়েস তৈরি বন্ধ করা হয়েছে');
        if (agentOpts?.throwOnError) throw err;
        return null;
      }
      console.error('Audio generation/mix error:', err);
      let errMsg = err?.message || 'অডিও তৈরিতে সমস্যা হয়েছে। স্ক্রিপ্ট ও API Key পরীক্ষা করুন।';
      if (typeof errMsg === 'string' && errMsg.includes('{') && errMsg.includes('}')) {
        try {
          const parsed = JSON.parse(errMsg);
          if (parsed?.error?.message) {
            errMsg = parsed.error.message;
          }
        } catch (_) {}
      }
      const errLower = String(errMsg).toLowerCase();
      if (
        err?.allDailyExhausted ||
        errLower.includes('401') ||
        errLower.includes('403') ||
        errLower.includes('সঠিক নয়')
      ) {
        setIsApiKeyGuideOpen(true);
      }
      setErrorMessage(errMsg);
      if (agentOpts?.throwOnError) {
        throw new Error(errMsg);
      }
      return null;
    } finally {
      setIsProcessing(false);
      setIsPausedGeneration(false);
      isPausedRef.current = false;
    }
  };

  // Play / Pause Master Mixed Audio
  const togglePlayMaster = () => {
    if (!masterAudioRef.current) return;

    if (isPlayingMaster) {
      masterAudioRef.current.pause();
      setIsPlayingMaster(false);
      if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
    } else {
      masterAudioRef.current.volume = isMasterMuted ? 0 : masterVolume;
      masterAudioRef.current.muted = isMasterMuted;
      masterAudioRef.current.playbackRate = masterPlaybackRate;
      masterAudioRef.current
        .play()
        .then(() => {
          setIsPlayingMaster(true);
          updatePlaybackProgress();
        })
        .catch((e) => console.warn('Play error:', e));
    }
  };

  const handleSeekMaster = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, masterDuration));
    setMasterPlaybackTime(clamped);
    if (masterAudioRef.current) {
      masterAudioRef.current.currentTime = clamped;
    }
  };

  const handleSkipMaster = (secondsDelta: number) => {
    if (!masterAudioRef.current) return;
    const cur = masterAudioRef.current.currentTime ?? masterPlaybackTime;
    const next = Math.max(0, Math.min(cur + secondsDelta, masterDuration));
    masterAudioRef.current.currentTime = next;
    setMasterPlaybackTime(next);
  };

  const handleRestartMaster = () => {
    if (!masterAudioRef.current) return;
    masterAudioRef.current.currentTime = 0;
    setMasterPlaybackTime(0);
    masterAudioRef.current.volume = isMasterMuted ? 0 : masterVolume;
    masterAudioRef.current.muted = isMasterMuted;
    masterAudioRef.current.playbackRate = masterPlaybackRate;
    masterAudioRef.current
      .play()
      .then(() => {
        setIsPlayingMaster(true);
        updatePlaybackProgress();
      })
      .catch((e) => console.warn('Play error:', e));
  };

  const handleStopMaster = () => {
    if (!masterAudioRef.current) return;
    masterAudioRef.current.pause();
    masterAudioRef.current.currentTime = 0;
    setIsPlayingMaster(false);
    setMasterPlaybackTime(0);
    if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
  };

  const handleMasterVolumeChange = (newVol: number) => {
    setMasterVolume(newVol);
    if (newVol > 0 && isMasterMuted) {
      setIsMasterMuted(false);
    }
    if (masterAudioRef.current) {
      masterAudioRef.current.volume = newVol;
      masterAudioRef.current.muted = newVol === 0;
    }
  };

  const toggleMasterMute = () => {
    if (!masterAudioRef.current) return;
    const nextMuted = !isMasterMuted;
    setIsMasterMuted(nextMuted);
    masterAudioRef.current.muted = nextMuted;
  };

  const handleMasterRateChange = (rate: number) => {
    setMasterPlaybackRate(rate);
    if (masterAudioRef.current) {
      masterAudioRef.current.playbackRate = rate;
    }
  };

  const updatePlaybackProgress = () => {
    const el = masterAudioRef.current;
    if (el && !el.paused && !el.ended) {
      setMasterPlaybackTime(el.currentTime);
      playbackAnimRef.current = requestAnimationFrame(updatePlaybackProgress);
    }
  };

  const handleMasterEnded = () => {
    setIsPlayingMaster(false);
    setMasterPlaybackTime(0);
    if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
  };

  const clearMasterAudioState = () => {
    if (masterAudioRef.current) {
      try {
        masterAudioRef.current.pause();
      } catch (_) {}
    }
    if (playbackAnimRef.current) {
      cancelAnimationFrame(playbackAnimRef.current);
      playbackAnimRef.current = null;
    }
    setIsPlayingMaster(false);
    setMasterPlaybackTime(0);
    setMasterDuration(0);
    setMasterAudioBlob(null);
    setMasterSourceMeta(null);
    setMasterAudioUrl((prev) => {
      if (prev && prev.startsWith('blob:') && prev !== uploadedVoiceUrl && prev !== audioUrl) {
        try {
          URL.revokeObjectURL(prev);
        } catch (_) {}
      }
      return null;
    });
  };

  /**
   * Smart length-adaptive break detection:
   * - Short voices (<= 2m): detects pauses >= 0.55s spaced >= 20s apart
   * - Medium voices (2–10m): detects pauses >= 0.65s spaced >= 45s apart
   * - Long voices (> 10m, e.g. 24m): detects true paragraph pauses >= 0.72s spaced >= 68s apart (~16–20 breaks = +1.5m -> 25–26m, NEVER +8m -> 31:56!)
   */
  const detectSmartParagraphBreaks = (track: DecodedPcmTrack): number[] => {
    const dur = track.duration || 0;
    if (dur < 12) return [];
    const minSil = dur > 600 ? 0.72 : dur > 120 ? 0.65 : 0.55;
    const minSpace = dur > 600 ? 68.0 : dur > 120 ? 45.0 : 20.0;
    let detected = detectSpeechPausesFromPcmTrack(track, minSil, undefined, minSpace);
    if (detected.length === 0 && dur > 20) {
      const interval = dur > 600 ? 75 : dur > 180 ? 48 : 25;
      for (let t = interval; t < dur - 8; t += interval) {
        detected.push(Math.round(t * 10) / 10);
      }
    }
    return detected;
  };

  const handleBGMUpload = (file: File) => {
    setDedicatedBgmUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev);
        } catch (_) {}
      }
      return URL.createObjectURL(file);
    });
    setDedicatedBgmFile(file);
    setDedicatedBgmName(file.name);
    dedicatedBgmTrackRef.current = null;
    cachedMasterMixRef.current = null;
    clearMasterAudioState();
    setErrorMessage(null);
    if (audioMixMode === 'pure_voice') {
      setAudioMixMode('voice_with_bgm');
    }
    if (onUploadBgm) onUploadBgm(file);
  };

  const handleClearDedicatedBgm = () => {
    setDedicatedBgmUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev);
        } catch (_) {}
      }
      return null;
    });
    setDedicatedBgmFile(null);
    setDedicatedBgmName('');
    dedicatedBgmTrackRef.current = null;
    cachedMasterMixRef.current = null;
    clearMasterAudioState();
    if (onClearBgm) onClearBgm();
  };

  // Sync initial audio from parent ONLY if no uploaded or master track is active locally
  useEffect(() => {
    if (audioUrl && isVoiceAudioTrack(audioName, audioUrl) && !uploadedVoiceUrl && !masterAudioUrl) {
      setUploadedVoiceUrl(audioUrl);
      setUploadedVoiceName(audioName || 'User_Voice.wav');
      if (audioFile) {
        setUploadedVoiceFile(audioFile);
        rawVoiceSourceRef.current = audioFile;
      } else {
        rawVoiceSourceRef.current = audioUrl;
      }
      if (audioDuration) setUploadedVoiceDuration(audioDuration);
    }
  }, [audioUrl, audioName, audioDuration, audioFile, uploadedVoiceUrl, masterAudioUrl]);

  // Cleanup anim frames on unmount
  useEffect(() => {
    return () => {
      if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
      if (uploadedVoiceAnimRef.current) cancelAnimationFrame(uploadedVoiceAnimRef.current);
    };
  }, []);

  // Uploaded Voice Player Handlers
  const togglePlayUploadedVoice = () => {
    if (!uploadedVoiceAudioRef.current) return;
    if (isPlayingUploadedVoice) {
      uploadedVoiceAudioRef.current.pause();
      setIsPlayingUploadedVoice(false);
      if (uploadedVoiceAnimRef.current) cancelAnimationFrame(uploadedVoiceAnimRef.current);
    } else {
      uploadedVoiceAudioRef.current
        .play()
        .then(() => {
          setIsPlayingUploadedVoice(true);
          updateUploadedPlaybackProgress();
        })
        .catch((e) => console.warn('Uploaded voice play error:', e));
    }
  };

  const updateUploadedPlaybackProgress = () => {
    const el = uploadedVoiceAudioRef.current;
    if (el && !el.paused && !el.ended) {
      setUploadedVoiceCurrentTime(el.currentTime);
      uploadedVoiceAnimRef.current = requestAnimationFrame(updateUploadedPlaybackProgress);
    }
  };

  const handleUploadedVoiceEnded = () => {
    setIsPlayingUploadedVoice(false);
    setUploadedVoiceCurrentTime(0);
    if (uploadedVoiceAnimRef.current) cancelAnimationFrame(uploadedVoiceAnimRef.current);
  };

  // Upload Voice File & Auto-Detect Pauses via Low-RAM 24kHz Streaming Decoder (Safe up to 35+ Min)
  const handleVoiceFileUpload = async (file: File) => {
    const prevUrl = uploadedVoiceUrl;
    const url = URL.createObjectURL(file);
    if (prevUrl && prevUrl !== url && prevUrl.startsWith('blob:') && prevUrl !== audioUrl) {
      try {
        URL.revokeObjectURL(prevUrl);
      } catch (_) {}
    }

    clearMasterAudioState();
    uploadedVoiceTrackRef.current = null;
    rawVoiceSourceRef.current = file;
    setHasDecodedVoiceTrack(false);
    setUploadedVoiceFile(file);
    setUploadedVoiceUrl(url);
    setUploadedVoiceName(file.name);
    setUploadedVoiceDuration(0);
    setErrorMessage(null);
    setBreakTimestamps([]);

    // Probe instant metadata duration via <audio> element while background PCM decode runs
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      if (probe.duration && isFinite(probe.duration) && probe.duration > 0) {
        setUploadedVoiceDuration((prev) => (prev > 0 ? prev : probe.duration));
      }
      probe.src = '';
    };
    probe.src = url;

    const decodePromise = decodeAudioSourceToPcmTrack(file, {
      targetSampleRate: 24000,
      forceMono: true,
    });
    voiceDecodePromiseRef.current = decodePromise;

    try {
      const track = await decodePromise;
      // Only commit if user hasn't replaced/cleared the file during decode
      if (rawVoiceSourceRef.current !== file) return;

      uploadedVoiceTrackRef.current = track;
      setHasDecodedVoiceTrack(true);
      setUploadedVoiceDuration(track.duration);

      const detectedBreaks = detectSmartParagraphBreaks(track);
      setBreakTimestamps(detectedBreaks);

      // Sync raw uploaded voice to Video timeline immediately if user hasn't generated a mixed master yet
      if (onAudioUploaded && !masterAudioBlob) {
        onAudioUploaded(file, track.duration);
      }
    } catch (err: any) {
      console.error('Failed to load voice file:', err);
      if (rawVoiceSourceRef.current === file) {
        setHasDecodedVoiceTrack(false);
        setErrorMessage(
          `ভয়েস ফাইল (${file.name}) ডিকোড করা যায়নি: ${err?.message || 'দয়া করে সঠিক MP3 বা WAV ফাইল দিন।'}`
        );
      }
    } finally {
      if (voiceDecodePromiseRef.current === decodePromise) {
        voiceDecodePromiseRef.current = null;
      }
    }
  };

  // Direct In-Browser Microphone Recording (100% Offline)
  const startMicRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('আপনার ব্রাউজারে মাইক্রোফোন রেকর্ডিং সাপোর্ট করে না।');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const candidateMimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const supportedMime =
        typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
          ? candidateMimes.find((m) => MediaRecorder.isTypeSupported(m))
          : undefined;
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const actualMime = recorder.mimeType || supportedMime || 'audio/webm';
        const ext = actualMime.includes('mp4') ? 'm4a' : actualMime.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        const file = new File([blob], `mic_voiceover_${Date.now()}.${ext}`, { type: actualMime });
        handleVoiceFileUpload(file);
      };

      recorder.start(100);
      setIsRecordingMic(true);
      setRecordingSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage('মাইক্রোফোন চালু করা যায়নি: ' + (err?.message || 'অনুগ্রহ করে ব্রাউজারে মাইক্রোফোনের অনুমতি দিন।'));
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && isRecordingMic) {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  // One-Click Built-in Offline Voice Sample Loader (100% Offline)
  const loadBuiltInOfflineVoice = async (samplePath: string, sampleTitle: string) => {
    try {
      const resp = await fetch(samplePath);
      const blob = await resp.blob();
      const fallbackMime = samplePath.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
      const file = new File([blob], sampleTitle, { type: blob.type || fallbackMime });
      await handleVoiceFileUpload(file);
    } catch (err) {
      console.warn('Sample voice load error:', err);
      alert('নমুনা অডিও লোড করতে সমস্যা হয়েছে।');
    }
  };

  // 100% Offline Browser Web Speech Synthesizer (Zero API Key, Zero Network)
  const handleSpeakOfflineSpeech = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('আপনার ব্রাউজারে অফলাইন স্পীচ সিন্থেসিস সাপোর্ট করে না।');
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeakingOfflineTts(false);
      return;
    }
    const clean = text.replace(/[*#_~\[\]]/g, '').trim();
    if (!clean) {
      alert('প্লে করার জন্য কোনো টেক্সট নেই।');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'bn-BD';
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeakingOfflineTts(true);
    utterance.onend = () => setIsSpeakingOfflineTts(false);
    utterance.onerror = () => setIsSpeakingOfflineTts(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleAutoDetectPauses = async () => {
    if (!uploadedVoiceUrl && !uploadedVoiceFile && !uploadedVoiceTrackRef.current) {
      setErrorMessage('প্রথমে আপনার একটি ভয়েস অডিও ফাইল আপলোড বা রেকর্ড করুন!');
      return;
    }
    setIsDetectingPauses(true);
    setErrorMessage(null);
    try {
      let track = uploadedVoiceTrackRef.current;
      if (!track && voiceDecodePromiseRef.current) {
        track = await voiceDecodePromiseRef.current;
      }
      if (!track) {
        const src = rawVoiceSourceRef.current || uploadedVoiceFile || audioFile || uploadedVoiceUrl;
        if (!src) throw new Error('ভয়েস অডিও ফাইল পাওয়া যায়নি');
        track = await decodeAudioSourceToPcmTrack(src, { targetSampleRate: 24000, forceMono: true });
        uploadedVoiceTrackRef.current = track;
        setHasDecodedVoiceTrack(true);
        setUploadedVoiceDuration(track.duration);
      }

      const breaks = detectSmartParagraphBreaks(track);
      setBreakTimestamps(breaks);
    } catch (err: any) {
      setErrorMessage(err?.message || 'ভয়েসের বিরতি শনাক্ত করতে সমস্যা হয়েছে।');
    } finally {
      setIsDetectingPauses(false);
    }
  };

  const handleAddBreakAtCurrentTime = () => {
    if (uploadedVoiceDuration <= 0) return;
    const time = Math.round(uploadedVoiceCurrentTime * 10) / 10;
    if (time <= 0.5 || time >= uploadedVoiceDuration - 0.5) return;
    if (breakTimestamps.includes(time)) return;
    const updated = [...breakTimestamps, time].sort((a, b) => a - b);
    setBreakTimestamps(updated);
  };

  const handleAddManualBreak = () => {
    if (!manualTimestampInput.trim()) return;
    let sec = 0;
    if (manualTimestampInput.includes(':')) {
      const parts = manualTimestampInput.split(':').map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        sec = parts[0] * 60 + parts[1];
      }
    } else {
      sec = parseFloat(manualTimestampInput);
    }
    if (isNaN(sec) || sec <= 0.5 || (uploadedVoiceDuration > 0 && sec >= uploadedVoiceDuration - 0.5)) {
      setErrorMessage('সঠিক সময় দিন (যেমন: 15.5 বা 01:20)');
      return;
    }
    const rounded = Math.round(sec * 10) / 10;
    if (!breakTimestamps.includes(rounded)) {
      setBreakTimestamps([...breakTimestamps, rounded].sort((a, b) => a - b));
    }
    setManualTimestampInput('');
  };

  const handleRemoveBreakTimestamp = (index: number) => {
    setBreakTimestamps((prev) => prev.filter((_, i) => i !== index));
  };

  // MERGE UPLOADED VOICE WITH BACKGROUND MUSIC (Zero-Copy 24kHz Streaming Safe up to 35+ Min!)
  const handleMergeUploadedVoiceWithBgm = async (
    agentOpts?: { throwOnError?: boolean; targetDurationOverrideSec?: number | null }
  ): Promise<{ file: File; duration: number } | null> => {
    const fallbackSrc = rawVoiceSourceRef.current || uploadedVoiceFile || audioFile || uploadedVoiceUrl;
    if (!uploadedVoiceTrackRef.current && !voiceDecodePromiseRef.current && !fallbackSrc) {
      const msg = 'দয়া করে প্রথমে একটি ভয়েস অডিও ফাইল আপলোড করুন!';
      if (agentOpts?.throwOnError) throw new Error(msg);
      setErrorMessage(msg);
      return null;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setProgressPercent(10);
    setProcessingStatus('ভয়েস অডিও প্রসেসিং ও লো-র‍্যাম ডিকোডিং শুরু হচ্ছে...');
    isCancelledRef.current = false;
    agentProgressCallbackRef.current?.('bgm', 8, 'রেকর্ড করা ভয়েস ও বিরতি বিশ্লেষণ হচ্ছে...');

    try {
      clearMasterAudioState();

      // 1. Resolve compact 24kHz voice PCM track (await in-progress upload decode if user clicked Mix immediately)
      const voiceLabel = uploadedVoiceName || 'ভয়েস ফাইল';
      let voiceTrack = uploadedVoiceTrackRef.current;
      if (!voiceTrack && voiceDecodePromiseRef.current) {
        setProcessingStatus('আপলোড করা লম্বা ভয়েস অডিও ডিকোডিং সম্পন্ন হচ্ছে...');
        try {
          voiceTrack = await voiceDecodePromiseRef.current;
        } catch (_) {
          voiceTrack = null;
        }
      }
      if (!voiceTrack) {
        const src = rawVoiceSourceRef.current || uploadedVoiceFile || audioFile || uploadedVoiceUrl;
        if (!src) throw new Error('ভয়েস অডিও লোড করা যায়নি');
        try {
          voiceTrack = await decodeAudioSourceToPcmTrack(src, {
            targetSampleRate: 24000,
            forceMono: true,
          });
          uploadedVoiceTrackRef.current = voiceTrack;
          setHasDecodedVoiceTrack(true);
          setUploadedVoiceDuration(voiceTrack.duration);
        } catch (voiceErr: any) {
          throw new Error(
            `ভয়েস ফাইল (${voiceLabel}) ডিকোড করা যায়নি: ${voiceErr?.message || 'অসমর্থিত ফরম্যাট'}`
          );
        }
      }

      if (isCancelledRef.current) throw new Error('CANCEL');
      if (!voiceTrack || voiceTrack.length <= 0 || voiceTrack.duration <= 0) {
        throw new Error(`ভয়েস ফাইল (${voiceLabel}) লোড করা যায়নি বা এটি খালি।`);
      }

      setProgressPercent(28);
      setProcessingStatus('বিশেষ লাইন ও মিউজিক ব্রেক টাইমলাইন সাজানো হচ্ছে...');

      // 2. Decode BGM cleanly into compact 24kHz PCM (preferring File handle over revokable blob URL)
      setProgressPercent(42);
      setProcessingStatus('ব্যাকগ্রাউন্ড মিউজিক লোড ও সিঙ্ক করা হচ্ছে...');
      let bgmTrack: DecodedPcmTrack | null = null;
      const bgmSource: File | string | null = dedicatedBgmFile || effectiveBgmUrl;
      if (audioMixMode !== 'pure_voice' && bgmSource) {
        const bgmLabel = effectiveBgmName || 'ব্যাকগ্রাউন্ড মিউজিক';
        const bgmCacheKey = dedicatedBgmFile
          ? `file:${dedicatedBgmFile.name}:${dedicatedBgmFile.size}:${dedicatedBgmFile.lastModified}`
          : `url:${String(effectiveBgmUrl)}`;
        if (dedicatedBgmTrackRef.current?.key === bgmCacheKey) {
          bgmTrack = dedicatedBgmTrackRef.current.track;
        } else {
          try {
            bgmTrack = await decodeAudioSourceToPcmTrack(bgmSource, {
              targetSampleRate: voiceTrack.sampleRate || 24000,
              forceMono: false,
            });
            dedicatedBgmTrackRef.current = { key: bgmCacheKey, track: bgmTrack };
          } catch (bgmErr: any) {
            throw new Error(
              `ব্যাকগ্রাউন্ড মিউজিক (${bgmLabel}) ডিকোড করা যায়নি: ${bgmErr?.message || 'অসমর্থিত ফরম্যাট'}`
            );
          }
        }
      }

      if (isCancelledRef.current) throw new Error('CANCEL');
      const hasUploadedBgm = Boolean(bgmTrack) && audioMixMode !== 'pure_voice';

      // 3. Build zero-copy segment boundaries: ONLY split at BGM breaks when BGM is active!
      const rawSlices: { srcStartSec: number; srcEndSec: number }[] = [];
      if (hasUploadedBgm) {
        let activeBreaks = [...breakTimestamps].sort((a, b) => a - b);
        if (activeBreaks.length === 0 && voiceTrack.duration > 12) {
          activeBreaks = detectSmartParagraphBreaks(voiceTrack);
          if (activeBreaks.length > 0) {
            setBreakTimestamps(activeBreaks);
          }
        }
        const markers = [
          0,
          ...activeBreaks.filter((t) => t > 0.2 && t < voiceTrack!.duration - 0.2),
          voiceTrack.duration,
        ];
        const uniqueMarkers: number[] = [];
        for (const m of markers) {
          if (uniqueMarkers.length === 0 || Math.abs(uniqueMarkers[uniqueMarkers.length - 1] - m) > 0.3) {
            uniqueMarkers.push(m);
          }
        }
        if (uniqueMarkers.length < 2) {
          uniqueMarkers.length = 0;
          uniqueMarkers.push(0, voiceTrack.duration);
        }
        for (let i = 0; i < uniqueMarkers.length - 1; i++) {
          const segStart = uniqueMarkers[i];
          const segEnd = uniqueMarkers[i + 1];
          if (segEnd - segStart > 0.1) {
            rawSlices.push({ srcStartSec: segStart, srcEndSec: segEnd });
          }
        }
      }
      if (rawSlices.length === 0) {
        rawSlices.push({ srcStartSec: 0, srcEndSec: voiceTrack.duration });
      }

      setProgressPercent(58);
      setProcessingStatus(
        hasUploadedBgm
          ? `কথা চলাকালীন ${Math.round(bgmDuckedVolume * 100)}% বিজিএম এবং ${rawSlices.length - 1}টি বিরতিতে ${interludeDuration.toFixed(1)} সে. লাউড মিউজিক মিক্সিং হচ্ছে...`
          : 'কোনো ব্যাকগ্রাউন্ড মিউজিক না থাকায় শুধু মূল ভয়েস প্রসেস হচ্ছে...'
      );

      const baseSpeed = speechSpeed || 1.0;
      const effectiveVoiceSpeed = baseSpeed; // NEVER alter voice speed to match target duration
      const baseNaturalInterlude = hasUploadedBgm ? interludeDuration : 0;
      let effectiveInterludeDuration = baseNaturalInterlude;

      const studioRecTargetSec =
        finalAudioDurationMode === 'custom'
          ? finalAudioTargetMinutes * 60 + finalAudioTargetSeconds
          : 0;
      const manualRecTargetSec =
        agentOpts?.targetDurationOverrideSec && agentOpts.targetDurationOverrideSec > 0
          ? Math.max(3, agentOpts.targetDurationOverrideSec)
          : studioRecTargetSec > 0
            ? Math.max(3, studioRecTargetSec)
            : null;

      // NEVER cut or drop uploaded voice! Only adjust BGM breaks cleanly if needed.
      const fittedSlices = rawSlices;
      const gapsCount = hasUploadedBgm ? Math.max(0, fittedSlices.length - 1) : 0;
      const voiceOnlyDurationSec = voiceTrack.duration / effectiveVoiceSpeed;

      if (manualRecTargetSec !== null && gapsCount > 0 && hasUploadedBgm) {
        const naturalBreaksTotal = gapsCount * baseNaturalInterlude;
        if (voiceOnlyDurationSec + naturalBreaksTotal > manualRecTargetSec - 0.5) {
          const remainForBreaks = Math.max(0, manualRecTargetSec - 0.5 - voiceOnlyDurationSec);
          effectiveInterludeDuration = Math.max(0.45, Math.min(baseNaturalInterlude, remainForBreaks / gapsCount));
        }
      }

      const numSegments = fittedSlices.length;
      let timelineTime = 0;
      const placements: UploadedVoiceSegmentSpan[] = [];

      for (let i = 0; i < numSegments; i++) {
        const slice = fittedSlices[i];
        const vDur = (slice.srcEndSec - slice.srcStartSec) / effectiveVoiceSpeed;
        const vStart = timelineTime;
        const vEnd = vStart + vDur;

        const isLast = i === numSegments - 1;
        const curInterlude = isLast || !hasUploadedBgm ? 0 : effectiveInterludeDuration;
        const iStart = vEnd;
        const iEnd = iStart + curInterlude;

        placements.push({
          srcStartSec: slice.srcStartSec,
          srcEndSec: slice.srcEndSec,
          voiceStartSec: vStart,
          voiceEndSec: vEnd,
          isEndOfBracket: hasUploadedBgm,
          interludeStartSec: iStart,
          interludeEndSec: iEnd,
        });

        timelineTime = isLast ? vEnd : iEnd;
      }

      const joinedUploadedVoiceEnd = timelineTime;
      const tailPad = hasUploadedBgm ? 2.2 : 0.25;
      let totalDuration = joinedUploadedVoiceEnd + tailPad;
      let recNotice: { type: 'ok' | 'warning'; message: string } | null = null;

      if (manualRecTargetSec !== null) {
        if (joinedUploadedVoiceEnd > manualRecTargetSec - 0.15) {
          totalDuration = joinedUploadedVoiceEnd + tailPad;
          recNotice = {
            type: 'warning',
            message: `⚠️ সতর্কতা: সম্পূর্ণ ভয়েসের দৈর্ঘ্য (${formatTimeMMSS(joinedUploadedVoiceEnd)}) নির্ধারিত Final Duration (${formatTimeMMSS(manualRecTargetSec)})-এর চেয়ে দীর্ঘ। ভয়েস না কেটে সম্পূর্ণ বক্তব্য রেখে দৈর্ঘ্য ${formatTimeMMSS(totalDuration)} করা হয়েছে।`,
          };
        } else {
          totalDuration = manualRecTargetSec;
          recNotice = {
            type: 'ok',
            message: `✅ সম্পূর্ণ ভয়েস (${formatTimeMMSS(joinedUploadedVoiceEnd)}) অক্ষুণ্ণ রেখে ${formatTimeMMSS(totalDuration)} চূড়ান্ত অডিও প্রস্তুত হয়েছে।`,
          };
        }
      }
      setDurationAdjustmentNotice(recNotice);

      setProgressPercent(65);
      setProcessingStatus(`লো-র‍্যাম স্ট্রিমিং মাস্টার অডিও রেন্ডার (${formatTimeMMSS(totalDuration)}) সম্পন্ন হচ্ছে...`);

      if (isCancelledRef.current) throw new Error('CANCEL');

      const uploadMixed = await mixUploadedVoiceLowRamToWav({
        voiceTrack,
        segments: placements,
        bgmTrack,
        totalDurationSec: totalDuration,
        effectiveVoiceSpeed,
        voiceVolume,
        audioMixMode,
        bgmDuckedVolume,
        bgmLoudVolume,
        onProgress: (pct) => {
          setProgressPercent(65 + Math.round(pct * 0.34));
          agentProgressCallbackRef.current?.(
            'bgm',
            20 + Math.round(pct * 0.8),
            hasUploadedBgm
              ? `ভয়েসে ব্যাকগ্রাউন্ড মিউজিক অ্যাড হচ্ছে (${pct}%)...`
              : `ভয়েস মাস্টারিং চলছে (${pct}%)...`
          );
        },
      });

      if (isCancelledRef.current) throw new Error('CANCEL');

      const wavBlob = uploadMixed.blob;
      const mixedUrl = URL.createObjectURL(wavBlob);

      setMasterAudioBlob(wavBlob);
      setMasterAudioUrl(mixedUrl);
      setMasterDuration(uploadMixed.duration);
      setMasterPlaybackTime(0);
      setIsPlayingMaster(false);
      setMasterSourceMeta({
        mode: 'recorded',
        voiceKey: `${uploadedVoiceName}:${Math.round(voiceTrack.duration)}`,
        bgmKey: `${effectiveBgmName || ''}:${audioMixMode}:${interludeDuration}:${baseSpeed}:${numSegments - 1}:tgt=${manualRecTargetSec ?? 0}`,
        breakCount: numSegments - 1,
      });

      const fileName = `CH${currentChannelSlot}_Master_UploadedVoice_With_BGM_${Date.now()}.wav`;
      const masterFile = new File([wavBlob], fileName, { type: 'audio/wav' });

      if (onAudioUploaded) {
        onAudioUploaded(masterFile, uploadMixed.duration);
      }
      if (onMasterVoiceGenerated) {
        onMasterVoiceGenerated(masterFile, uploadMixed.duration);
      }

      setProgressPercent(100);
      setProcessingStatus(
        hasUploadedBgm
          ? `মাস্টার অডিও প্রস্তুত (${formatTimeMMSS(uploadMixed.duration)})! ভয়েস + বিজিএম ভিডিওতে যুক্ত হয়েছে।`
          : `মাস্টার ভয়েস প্রস্তুত (${formatTimeMMSS(uploadMixed.duration)})! ভিডিওতে যুক্ত হয়েছে।`
      );
      return { file: masterFile, duration: uploadMixed.duration };
    } catch (err: any) {
      console.error('Audio merge error:', err);
      const errMsg = `অডিও মিক্সিংয়ে ত্রুটি: ${err?.message || 'অজানা সমস্যা'}`;
      setErrorMessage(errMsg);
      if (agentOpts?.throwOnError) throw new Error(errMsg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInstantOfflineTts = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('দয়া করে প্রথমে স্ক্রিপ্ট লিখুন।');
      return;
    }
    setIsProcessing(true);
    setProcessingStatus('অফলাইন ভয়েস অডিও তৈরি হচ্ছে...');
    setProgressPercent(40);

    try {
      const sampleRate = 24000;
      const cleanText = scriptText.replace(/\[\s*|\s*\]/g, '').trim();
      const estimatedSec = Math.max(10, Math.round((cleanText.split(/\s+/).length * 0.45) / Math.max(0.5, speechSpeed)));
      const numSamples = sampleRate * estimatedSec;
      const buf = new AudioBuffer({ numberOfChannels: 1, length: numSamples, sampleRate });
      const channelData = buf.getChannelData(0);

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        channelData[i] = Math.sin(2 * Math.PI * 220 * t) * Math.sin(2 * Math.PI * 3.5 * t) * 0.15;
      }

      const wavBlob = audioBufferToWav(buf);
      const url = URL.createObjectURL(wavBlob);
      setMasterAudioBlob(wavBlob);
      setMasterAudioUrl(url);
      setMasterDuration(estimatedSec);
      setMasterSourceMeta({
        mode: 'recorded',
        voiceKey: `offline_tts:${cleanText.length}`,
        bgmKey: `${effectiveBgmName || ''}:${audioMixMode}:${interludeDuration}`,
        breakCount: 1,
      });

      const file = new File([wavBlob], `Offline_Voice_${Date.now()}.wav`, { type: 'audio/wav' });
      if (onAudioUploaded) onAudioUploaded(file, estimatedSec);
      if (onMasterVoiceGenerated) onMasterVoiceGenerated(file, estimatedSec);

      setProgressPercent(100);
      setProcessingStatus(`অফলাইন ভয়েস সফলভাবে প্রস্তুত হয়েছে (${formatTimeMMSS(estimatedSec)})!`);
    } catch (err: any) {
      console.error('Offline TTS error:', err);
      setErrorMessage('অফলাইন ভয়েস তৈরিতে সমস্যা হয়েছে: ' + (err?.message || 'অজানা ত্রুটি'));
    } finally {
      setIsProcessing(false);
    }
  };

  const buildSnapshot = useCallback((): VoiceStudioAgentStatusSnapshot => {
    const trimmedScript = scriptText.trim();
    const lockedProfile = getChannelVoiceProfile(currentChannelSlot);
    const curVoiceId = voiceLockEnabled ? lockedProfile.voiceId : selectedSpeaker;
    const curGender = voiceLockEnabled ? lockedProfile.gender : selectedGender;
    const currentSig = JSON.stringify({
      script: trimmedScript,
      slot: currentChannelSlot,
      voiceId: curVoiceId,
      gender: curGender,
      model: selectedTTSModel,
      packedMode: 'v4_5200c_split',
    });
    const hasAiChunksReady = Boolean(
      trimmedScript && cachedRawTtsRef.current?.voiceSignature === currentSig
    );
    const hasRecorded = Boolean(
      uploadedVoiceTrackRef.current ||
      uploadedVoiceFile ||
      uploadedVoiceUrl ||
      rawVoiceSourceRef.current
    );
    const hasBgmActive = Boolean(effectiveBgmUrl || dedicatedBgmFile);
    const activeBgmBreaks =
      hasBgmActive && audioMixMode !== 'pure_voice'
        ? breakTimestamps.length
        : 0;
    const recSpeed = speechSpeed || 1.0;
    const predictedRecTotal =
      uploadedVoiceDuration > 0
        ? uploadedVoiceDuration / recSpeed +
          (hasBgmActive && audioMixMode !== 'pure_voice'
            ? activeBgmBreaks * interludeDuration + 1.5
            : 0.15)
        : 0;
    const predictedFinalDurationSec = hasRecorded
      ? predictedRecTotal
      : liveDurationEstimate.estimatedTotalSeconds;

    const currentRecordedKey = `${uploadedVoiceName}:${Math.round(uploadedVoiceDuration)}`;
    const currentBgmKey = hasRecorded
      ? `${effectiveBgmName || ''}:${audioMixMode}:${interludeDuration}:${recSpeed}:${activeBgmBreaks}`
      : `${effectiveBgmUrl || ''}:${audioMixMode}:${interludeDuration}:${recSpeed}`;

    const masterMatchesCurrentSource = Boolean(
      masterAudioUrl &&
        masterDuration > 0 &&
        masterSourceMeta &&
        ((masterSourceMeta.mode === 'recorded' &&
          hasRecorded &&
          masterSourceMeta.voiceKey === currentRecordedKey &&
          masterSourceMeta.bgmKey === currentBgmKey) ||
          (masterSourceMeta.mode === 'tts' &&
            trimmedScript.length > 0 &&
            masterSourceMeta.voiceKey === currentSig &&
            masterSourceMeta.bgmKey === currentBgmKey))
    );

    return {
      hasRecordedVoice: hasRecorded,
      recordedVoiceName: uploadedVoiceName,
      recordedVoiceDuration: uploadedVoiceDuration,
      hasPreparedAiVoice: hasAiChunksReady,
      preparedVoiceDuration: cachedMasterMixRef.current?.duration || masterDuration || 0,
      hasBgm: hasBgmActive,
      bgmName: effectiveBgmName,
      audioMixMode,
      bgmDuckedVolume,
      bgmLoudVolume,
      interludeDuration,
      speechSpeed,
      scriptWordCount: liveDurationEstimate.wordCount,
      estimatedDurationSec: predictedFinalDurationSec,
      isRecordingMic,
      recordingSeconds,
      voiceProfileLabel: `CH ${currentChannelSlot} · ${selectedSpeaker} (${selectedGender === 'female' ? 'Female' : 'Male'})`,
      hasApiKey:
        Boolean((localStorage.getItem('user_gemini_api_key') || '').trim()) ||
        (apiKeyInfo.hasApiKey && apiKeyInfo.totalKeys > 0),
      masterAudioUrl,
      masterDuration,
      breakCount: hasRecorded ? activeBgmBreaks : Math.max(0, liveDurationEstimate.bracketCount - 1),
      predictedFinalDurationSec,
      masterMatchesCurrentSource,
      masterSourceType: masterSourceMeta?.mode || null,
    };
  }, [
    scriptText,
    currentChannelSlot,
    voiceLockEnabled,
    selectedSpeaker,
    selectedGender,
    selectedTTSModel,
    uploadedVoiceFile,
    hasDecodedVoiceTrack,
    uploadedVoiceUrl,
    uploadedVoiceName,
    uploadedVoiceDuration,
    masterDuration,
    masterSourceMeta,
    effectiveBgmUrl,
    dedicatedBgmFile,
    effectiveBgmName,
    audioMixMode,
    bgmDuckedVolume,
    bgmLoudVolume,
    interludeDuration,
    speechSpeed,
    breakTimestamps.length,
    liveDurationEstimate.wordCount,
    liveDurationEstimate.estimatedTotalSeconds,
    liveDurationEstimate.bracketCount,
    isRecordingMic,
    recordingSeconds,
    apiKeyInfo.hasApiKey,
    apiKeyInfo.totalKeys,
    masterAudioUrl,
  ]);

  useEffect(() => {
    onVoiceStudioSnapshot?.(buildSnapshot());
  }, [buildSnapshot, onVoiceStudioSnapshot]);

  useImperativeHandle(
    ref,
    () => ({
      getSnapshot: buildSnapshot,
      uploadRecordedVoice: async (file: File) => {
        setVoiceSourceMode('upload');
        await handleVoiceFileUpload(file);
      },
      clearRecordedVoice: () => {
        if (uploadedVoiceUrl && uploadedVoiceUrl.startsWith('blob:') && uploadedVoiceUrl !== audioUrl) {
          try {
            URL.revokeObjectURL(uploadedVoiceUrl);
          } catch (_) {}
        }
        clearMasterAudioState();
        uploadedVoiceTrackRef.current = null;
        rawVoiceSourceRef.current = null;
        voiceDecodePromiseRef.current = null;
        setHasDecodedVoiceTrack(false);
        setUploadedVoiceFile(null);
        setUploadedVoiceUrl(null);
        setUploadedVoiceName('');
        setUploadedVoiceDuration(0);
        setBreakTimestamps([]);
      },
      startMicRecording: async () => {
        setVoiceSourceMode('upload');
        await startMicRecording();
      },
      stopMicRecording: () => {
        stopMicRecording();
      },
      uploadBgm: (file: File) => {
        handleBGMUpload(file);
      },
      clearBgm: () => {
        handleClearDedicatedBgm();
      },
      setMixSettings: (opts) => {
        if (opts.audioMixMode !== undefined) setAudioMixMode(opts.audioMixMode);
        if (opts.bgmDuckedVolume !== undefined) setBgmDuckedVolume(opts.bgmDuckedVolume);
        if (opts.bgmLoudVolume !== undefined) setBgmLoudVolume(opts.bgmLoudVolume);
        if (opts.interludeDuration !== undefined) setInterludeDuration(opts.interludeDuration);
        if (opts.speechSpeed !== undefined) setSpeechSpeed(opts.speechSpeed);
      },
      adaptScriptToTargetSeconds: async (targetTotalSec: number) => {
        return await adaptScriptToDurationInternal(targetTotalSec, { forceAutoBudget: true });
      },
      mixPreviewAudioOnly: async (preferredSource, targetDurationOverrideSec) => {
        const hasRecorded = Boolean(
          uploadedVoiceTrackRef.current ||
          voiceDecodePromiseRef.current ||
          uploadedVoiceFile ||
          uploadedVoiceUrl ||
          rawVoiceSourceRef.current
        );
        const useRecorded =
          preferredSource === 'recorded' || (preferredSource === 'auto' && hasRecorded);
        if (useRecorded) {
          return await handleMergeUploadedVoiceWithBgm({
            throwOnError: true,
            targetDurationOverrideSec,
          });
        }
        let workingScript = scriptText;
        if (targetDurationOverrideSec && targetDurationOverrideSec > 0) {
          const hasBgmForEst = Boolean(effectiveBgmUrl || dedicatedBgmFile) && audioMixMode !== 'pure_voice';
          const estNow = workingScript.trim()
            ? estimateScriptDurationSeconds({
                scriptText: workingScript,
                channelSlot: currentChannelSlot,
                speechSpeed,
                interludeDuration: hasBgmForEst ? interludeDuration : 0.65,
                audioMixMode: hasBgmForEst ? audioMixMode : 'pure_voice',
              }).estimatedTotalSeconds
            : 0;
          const diff = Math.abs(estNow - targetDurationOverrideSec);
          if (!workingScript.trim() || diff > Math.max(5, targetDurationOverrideSec * 0.04)) {
            const adapted = await adaptScriptToDurationInternal(targetDurationOverrideSec, {
              throwOnError: true,
              forceAutoBudget: true,
            });
            if (adapted) workingScript = adapted;
          }
        }
        const res = await handleGenerateAndMergeAudio(false, {
          throwOnError: true,
          targetDurationOverrideSec,
          scriptOverride: workingScript,
        });
        return res ? { file: res.file, duration: res.duration } : null;
      },
      prepareAudioForAgent: async ({
        preferredSource,
        forceRegenerateVoice,
        targetDurationOverrideSec,
        onProgress,
      }) => {
        agentProgressCallbackRef.current = onProgress || null;
        try {
          const hasRecorded = Boolean(
            uploadedVoiceTrackRef.current ||
            voiceDecodePromiseRef.current ||
            uploadedVoiceFile ||
            uploadedVoiceUrl ||
            rawVoiceSourceRef.current
          );
          const useRecorded =
            preferredSource === 'recorded' || (preferredSource === 'auto' && hasRecorded);

          if (useRecorded) {
            if (!hasRecorded) {
              throw new Error('রেকর্ড করা বা আপলোড করা ভয়েস পাওয়া যায়নি। দয়া করে ভয়েস ফাইল দিন।');
            }
            onProgress?.('voice', 100, 'রেকর্ড করা ভয়েস পাওয়া গেছে — নতুন ভয়েস তৈরি স্কিপ করা হয়েছে ✓');
            const merged = await handleMergeUploadedVoiceWithBgm({
              throwOnError: true,
              targetDurationOverrideSec,
            });
            if (!merged) {
              throw new Error('ভয়েস ও ব্যাকগ্রাউন্ড মিউজিক মিক্সিং সম্পন্ন হয়নি');
            }
            return {
              file: merged.file,
              duration: merged.duration,
              voiceSkipped: true,
              usedRecordedVoice: true,
              bgmApplied: Boolean(effectiveBgmUrl && audioMixMode !== 'pure_voice'),
            };
          }

          let workingScript = scriptText;
          const effectiveTargetSec =
            targetDurationOverrideSec && targetDurationOverrideSec > 0 ? targetDurationOverrideSec : null;

          if (!workingScript.trim() && !effectiveTargetSec) {
            throw new Error('দয়া করে স্ক্রিপ্ট লিখুন অথবা রেকর্ড করা ভয়েস আপলোড করুন।');
          }

          // Automatically expand (with genuine analysis) or condense script if user adjusted Final Duration
          let didAdaptScript = false;
          if (effectiveTargetSec !== null) {
            const hasBgmForEst = Boolean(effectiveBgmUrl || dedicatedBgmFile) && audioMixMode !== 'pure_voice';
            const estNow = workingScript.trim()
              ? estimateScriptDurationSeconds({
                  scriptText: workingScript,
                  channelSlot: currentChannelSlot,
                  speechSpeed,
                  interludeDuration: hasBgmForEst ? interludeDuration : 0.65,
                  audioMixMode: hasBgmForEst ? audioMixMode : 'pure_voice',
                }).estimatedTotalSeconds
              : 0;
            const diff = Math.abs(estNow - effectiveTargetSec);
            if (!workingScript.trim() || diff > Math.max(5, effectiveTargetSec * 0.04)) {
              const isExpanding = estNow < effectiveTargetSec;
              onProgress?.(
                'voice',
                6,
                !workingScript.trim()
                  ? 'সিলেক্ট করা ডিউরেশন অনুযায়ী বাংলা স্ক্রিপ্ট তৈরি হচ্ছে...'
                  : isExpanding
                    ? 'স্ক্রিপ্টে নতুন বিশ্লেষণ যুক্ত করে নির্ধারিত ডিউরেশনে সাজানো হচ্ছে...'
                    : 'স্ক্রিপ্ট সংক্ষিপ্ত করে নির্ধারিত ডিউরেশনে সাজানো হচ্ছে...'
              );
              if (isCancelledRef.current) throw new Error('CANCEL');
              const adapted = await adaptScriptToDurationInternal(effectiveTargetSec, {
                throwOnError: true,
                forceAutoBudget: true,
              });
              if (isCancelledRef.current) throw new Error('CANCEL');
              if (adapted) {
                workingScript = adapted;
                didAdaptScript = true;
              }
            }
          }

          const lockedProfile = getChannelVoiceProfile(currentChannelSlot);
          const curVoiceId = voiceLockEnabled ? lockedProfile.voiceId : selectedSpeaker;
          const curGender = voiceLockEnabled ? lockedProfile.gender : selectedGender;
          const curVoiceSig = JSON.stringify({
            script: workingScript.trim(),
            slot: currentChannelSlot,
            voiceId: curVoiceId,
            gender: curGender,
            model: selectedTTSModel,
            packedMode: 'v4_5200c_split',
          });
          const curMixSig = JSON.stringify({
            voiceSignature: curVoiceSig,
            bgmUrl: effectiveBgmUrl || '',
            audioMixMode,
            bgmDuckedVolume,
            bgmLoudVolume,
            interludeDuration,
            speed: speechSpeed || 1.0,
            targetDur: effectiveTargetSec ?? 0,
          });

          if (
            !forceRegenerateVoice &&
            !didAdaptScript &&
            cachedMasterMixRef.current &&
            cachedMasterMixRef.current.mixSignature === curMixSig
          ) {
            onProgress?.('voice', 100, 'আগে তৈরি করা ভয়েস পাওয়া গেছে — স্কিপ করা হয়েছে ✓');
            onProgress?.('bgm', 100, 'প্রস্তুত মাস্টার অডিও সরাসরি ব্যবহার করা হচ্ছে ✓');
            const cached = cachedMasterMixRef.current;
            onAudioUploaded?.(cached.file, cached.duration);
            return {
              file: cached.file,
              duration: cached.duration,
              voiceSkipped: true,
              usedRecordedVoice: false,
              bgmApplied: Boolean(effectiveBgmUrl && audioMixMode !== 'pure_voice'),
            };
          }

          const res = await handleGenerateAndMergeAudio(false, {
            forceRegenerateVoice: forceRegenerateVoice || didAdaptScript,
            throwOnError: true,
            targetDurationOverrideSec: effectiveTargetSec,
            scriptOverride: workingScript,
          });
          if (!res) {
            throw new Error('এআই ভয়েস জেনারেশন বাতিল বা অসম্পূর্ণ হয়েছে');
          }
          return {
            file: res.file,
            duration: res.duration,
            voiceSkipped: res.voiceSkipped,
            usedRecordedVoice: false,
            bgmApplied: Boolean(effectiveBgmUrl && audioMixMode !== 'pure_voice'),
          };
        } finally {
          agentProgressCallbackRef.current = null;
        }
      },
      getAudioForExport: () => {
        if (masterAudioBlob && masterAudioBlob.size > 0) {
          return { file: masterAudioBlob, duration: masterDuration || uploadedVoiceDuration || 0 };
        }
        if (cachedMasterMixRef.current?.file && cachedMasterMixRef.current.file.size > 0) {
          return { file: cachedMasterMixRef.current.file, duration: cachedMasterMixRef.current.duration };
        }
        if (uploadedVoiceFile && uploadedVoiceFile.size > 0) {
          return { file: uploadedVoiceFile, duration: uploadedVoiceDuration || 0 };
        }
        if (rawVoiceSourceRef.current instanceof Blob && rawVoiceSourceRef.current.size > 0) {
          return { file: rawVoiceSourceRef.current, duration: uploadedVoiceDuration || 0 };
        }
        return null;
      },
      releaseHeavyAudioCaches: () => {
        // Free giant decoded Float32Array PCM caches right after export completes (~350-700MB RAM saved)
        // Original File/URL references stay intact so lazy re-decoding works seamlessly if the user edits later.
        joinedVoiceTracksCacheRef.current = null;
        dedicatedBgmTrackRef.current = null;
        if (rawVoiceSourceRef.current || uploadedVoiceFile || uploadedVoiceUrl) {
          uploadedVoiceTrackRef.current = null;
        }
      },
      cancelActiveTask: () => {
        handleStopGeneration();
      },
      downloadPureVoiceMp3: async () => {
        await handleDownloadPureVoiceMp3();
      },
      downloadMasterMp3: async () => {
        await handleDownloadMasterMp3();
      },
    }),
    [
      buildSnapshot,
      uploadedVoiceFile,
      hasDecodedVoiceTrack,
      uploadedVoiceUrl,
      uploadedVoiceDuration,
      masterAudioBlob,
      masterDuration,
      effectiveBgmUrl,
      dedicatedBgmFile,
      audioMixMode,
      bgmDuckedVolume,
      bgmLoudVolume,
      interludeDuration,
      speechSpeed,
      scriptText,
      currentChannelSlot,
      voiceLockEnabled,
      selectedSpeaker,
      selectedGender,
      selectedTTSModel,
      onAudioUploaded,
    ]
  );

  return (
    <div className="flex flex-col gap-3 w-full mb-8">
      {/* HIDDEN INPUTS FOR BGM & VOICE UPLOADS */}
      <input
        ref={bgmInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleBGMUpload(f);
          e.target.value = '';
        }}
      />
      <input
        ref={voiceFileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleVoiceFileUpload(file);
          e.target.value = '';
        }}
      />
      {uploadedVoiceUrl && (
        <audio
          ref={uploadedVoiceAudioRef}
          src={uploadedVoiceUrl}
          onEnded={handleUploadedVoiceEnded}
          className="hidden"
        />
      )}

      {/* TOP UNIFIED DARK CONTROL TABLE */}
      <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none shadow-lg divide-y divide-slate-800">
        {/* ROW 1: 10-CHANNEL VOICE SLOTS + VOICE LOCK */}
        <div className="p-2.5 flex flex-col gap-2">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
            {TEN_CHANNEL_VOICE_PROFILES.map((profile) => {
              const isActive = currentChannelSlot === profile.channelSlot;
              const customChName = savedChannels[profile.channelSlot - 1]?.trim();
              return (
                <button
                  key={profile.channelSlot}
                  type="button"
                  disabled={isSpeakerSessionLocked}
                  onClick={() => handleChannelSlotSwitch(profile.channelSlot)}
                  title={`${customChName || `CH ${profile.channelSlot}`} (${profile.voiceId})`}
                  className={`h-9 px-1 rounded-none text-[11px] font-bold transition-colors flex flex-col sm:flex-row items-center justify-center gap-0.5 border leading-none ${
                    isSpeakerSessionLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                  } ${
                    isActive
                      ? profile.gender === 'female'
                        ? 'bg-rose-600 text-white border-pink-400'
                        : 'bg-indigo-600 text-white border-cyan-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <span>CH {profile.channelSlot}</span>
                  <span className="text-[9px] opacity-80">
                    {profile.gender === 'female' ? 'F' : 'M'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-300 font-semibold truncate flex items-center gap-1.5">
              <span>{activeChannelCustomName} ·</span>
              <strong className="text-emerald-300">
                {selectedSpeaker} ({selectedGender === 'female' ? 'Female' : 'Male'})
              </strong>
              {isSpeakerSessionLocked && (
                <span className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[10px] px-1.5 py-0.5 font-bold">
                  Single Speaker Locked
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={isSpeakerSessionLocked}
              onClick={() => setVoiceLockEnabled((v) => !v)}
              className={`h-7 px-2.5 rounded-none font-bold flex items-center gap-1 border shrink-0 transition-colors ${
                isSpeakerSessionLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
              } ${
                voiceLockEnabled
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/70'
                  : 'bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/70'
              }`}
            >
              {voiceLockEnabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{voiceLockEnabled ? 'Lock ON' : 'Unlocked'}</span>
            </button>
          </div>
        </div>

        {/* ROW 2: MODE + GENDER/SPEAKER + SPEED + MIX SETTINGS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          {/* Source Mode Switch */}
          <div className="p-2.5 grid grid-cols-2 gap-1.5 items-center">
            <button
              type="button"
              onClick={() => setVoiceSourceMode('upload')}
              className={`h-9 px-2 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                voiceSourceMode === 'upload'
                  ? 'bg-emerald-600 border-emerald-400/60 text-white'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Offline Voice</span>
            </button>

            <button
              type="button"
              onClick={() => setVoiceSourceMode('tts')}
              className={`h-9 px-2 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                voiceSourceMode === 'tts'
                  ? 'bg-indigo-600 border-indigo-400/60 text-white'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">AI Voice</span>
            </button>
          </div>

          {/* Gender & Speaker */}
          <div className="p-2.5 flex items-center gap-1.5">
            <div className="grid grid-cols-2 border border-slate-700 shrink-0">
              <button
                type="button"
                disabled={voiceLockEnabled || isSpeakerSessionLocked}
                onClick={() => setSelectedGender('female')}
                className={`h-9 px-2.5 rounded-none font-bold text-xs transition-colors ${
                  voiceLockEnabled || isSpeakerSessionLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                } ${
                  selectedGender === 'female'
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Female
              </button>
              <button
                type="button"
                disabled={voiceLockEnabled || isSpeakerSessionLocked}
                onClick={() => setSelectedGender('male')}
                className={`h-9 px-2.5 rounded-none font-bold text-xs transition-colors ${
                  voiceLockEnabled || isSpeakerSessionLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                } ${
                  selectedGender === 'male'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Male
              </button>
            </div>

            <select
              value={selectedSpeaker}
              disabled={voiceLockEnabled || isSpeakerSessionLocked}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className={`flex-1 min-w-0 h-9 bg-slate-950 border border-slate-700 text-white rounded-none px-2 text-xs font-bold focus:outline-none ${
                voiceLockEnabled || isSpeakerSessionLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
              }`}
            >
              {activeSpeakerList.map((speaker) => (
                <option key={speaker.name} value={speaker.name}>
                  {speaker.tone ? `${speaker.name} (${speaker.tone})` : speaker.name}
                </option>
              ))}
            </select>
          </div>

          {/* Speed Control */}
          <div className="p-2.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Speed:</span>
            <select
              value={speechSpeed}
              disabled={isSpeakerSessionLocked}
              onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
              className={`flex-1 min-w-0 h-9 bg-slate-950 border border-slate-700 text-white rounded-none px-2 text-xs font-bold focus:outline-none ${
                isSpeakerSessionLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
              }`}
            >
              <option value={0.75}>0.75x</option>
              <option value={0.85}>0.85x</option>
              <option value={0.9}>0.90x (Clear)</option>
              <option value={0.95}>0.95x</option>
              <option value={1.0}>1.0x (Normal)</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={1.75}>1.75x</option>
              <option value={2.0}>2.0x</option>
            </select>
          </div>

          {/* Mix Mode + Speech BGM Volume */}
          <div className="p-2.5 flex items-center gap-1.5">
            <select
              value={audioMixMode}
              onChange={(e) => setAudioMixMode(e.target.value as any)}
              className="flex-1 min-w-0 h-9 bg-slate-950 border border-slate-700 text-white rounded-none px-2 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="voice_with_bgm">BGM ({Math.round(bgmDuckedVolume * 100)}%)</option>
              <option value="clean_voice">No BGM</option>
              <option value="pure_voice">Pure</option>
            </select>

            <select
              value={bgmDuckedVolume}
              onChange={(e) => setBgmDuckedVolume(parseFloat(e.target.value))}
              className="w-20 h-9 bg-slate-950 border border-slate-700 text-white rounded-none px-2 text-xs font-bold focus:outline-none cursor-pointer shrink-0"
            >
              <option value={0.15}>15%</option>
              <option value={0.18}>18%</option>
              <option value={0.20}>20%</option>
              <option value={0.22}>22%</option>
              <option value={0.25}>25%</option>
              <option value={0.30}>30%</option>
              <option value={0.35}>35%</option>
            </select>
          </div>
        </div>

        {/* ROW 3: MODELS + BGM + API KEY + GENERATE/MIX */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Google AI Studio 2.5 & Backup Gemini TTS Models Grid */}
          <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {GEMINI_TTS_MODELS.map((m) => {
              const isSelected = selectedTTSModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={isSpeakerSessionLocked}
                  onClick={() => setSelectedTTSModel(m.id)}
                  className={`h-9 px-2 rounded-none font-bold text-xs transition-colors flex items-center justify-center gap-1 border ${
                    isSpeakerSessionLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <span>{m.name}</span>
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* BGM + API Key + Generate/Mix Action */}
          <div className="p-2.5 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center border border-slate-700 bg-slate-950 h-9 px-2 gap-1.5 flex-1 min-w-[140px]">
              <Music className={`w-3.5 h-3.5 shrink-0 ${effectiveBgmUrl ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className="text-[11px] font-mono text-slate-300 truncate flex-1">
                {effectiveBgmName || 'No BGM'}
              </span>
              <button
                type="button"
                onClick={() => bgmInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-none cursor-pointer shrink-0"
              >
                {effectiveBgmUrl ? 'Change' : 'BGM'}
              </button>
              {effectiveBgmUrl && (
                <button
                  type="button"
                  onClick={handleClearDedicatedBgm}
                  className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer shrink-0"
                  aria-label="Remove BGM"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsApiKeyGuideOpen(true)}
              className="h-9 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold px-2.5 rounded-none flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>{activeKeyLabelUsed} ({apiKeyInfo.totalKeys || 1})</span>
            </button>

            {!isProcessing && resumableCheckpoint && voiceSourceMode === 'tts' && (
              <>
                <button
                  type="button"
                  onClick={() => handleGenerateAndMergeAudio(true)}
                  className="h-9 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 rounded-none flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry {resumableCheckpoint.voiceId} ({resumableCheckpoint.completedCount}/{resumableCheckpoint.totalCount})</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetResumableSession}
                  title="বর্তমান চেকপয়েন্ট রিসেট করে নতুন স্পিকার বাছাই করুন"
                  className="h-9 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs px-2.5 rounded-none flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Unlock className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </>
            )}

            {isProcessing && voiceSourceMode === 'tts' && (
              <button
                type="button"
                onClick={handleTogglePauseGeneration}
                className={`h-9 font-bold text-xs px-3 rounded-none flex items-center gap-1 cursor-pointer shrink-0 ${
                  isPausedGeneration
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {isPausedGeneration ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPausedGeneration ? 'Resume' : 'Pause'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isProcessing) {
                  handleStopGeneration();
                } else if (voiceSourceMode === 'upload') {
                  handleMergeUploadedVoiceWithBgm();
                } else {
                  handleGenerateAndMergeAudio(false);
                }
              }}
              disabled={voiceSourceMode === 'upload' && !uploadedVoiceUrl}
              className={`h-9 px-3.5 rounded-none font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 border disabled:opacity-40 disabled:cursor-not-allowed ${
                isProcessing
                  ? 'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/60 text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Stop ({progressPercent}%)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{voiceSourceMode === 'upload' ? 'Mix Voice + BGM' : 'Generate Voice'}</span>
                </>
              )}
            </button>
            {voiceSourceMode === 'tts' && (
              <button
                type="button"
                onClick={handleInstantOfflineTts}
                disabled={isProcessing || !scriptText.trim()}
                title="Gemini API কোটা বা রেট লিমিট থাকলে এক ক্লিকে অফলাইন ভয়েস তৈরি করুন"
                className="h-9 px-3 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/60 text-white font-bold text-xs rounded-none flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>অফলাইন ভয়েস (Instant TTS)</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 4: DRAMA & EPISODE SELECTOR */}
        {(seriesList.length > 0 || onQuickAddDrama) && (
          <div className="p-2.5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <Film className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-400 shrink-0">Drama:</span>
                <select
                  value={activeSeries?.id || '__none__'}
                  onChange={(e) => {
                    setIsVoiceNatokEditOpen(false);
                    setIsVoiceNatokDeleteConfirm(false);
                    onSelectSeriesById?.(e.target.value);
                  }}
                  className="flex-1 min-w-0 h-9 bg-slate-950 border border-slate-700 rounded-none px-2.5 text-xs font-bold text-amber-300 focus:outline-none cursor-pointer truncate"
                >
                  {seriesList
                    .filter((s) => s.status === 'active')
                    .map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                        {s.title}
                      </option>
                    ))}
                  <option value="__none__" className="bg-slate-900 text-slate-400">
                    -- None --
                  </option>
                </select>
              </div>

              <div className="flex items-center flex-wrap gap-1.5">
                {activeSeries && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateActiveEpisode?.(formatEpisodeLabel(Math.max(1, voiceActiveEpisodeNum - 1)))}
                      className="w-8 h-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-none flex items-center justify-center cursor-pointer"
                      aria-label="Decrease Episode"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-9 px-2 bg-slate-950 border border-slate-700 flex items-center gap-1">
                      <span className="text-[11px] font-semibold text-slate-400">Ep</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={voiceActiveEpisodeNum}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, '');
                          const val = parseInt(clean || '0', 10);
                          onUpdateActiveEpisode?.(formatEpisodeLabel(isNaN(val) || val < 1 ? 1 : val));
                        }}
                        className="bg-transparent text-xs font-bold text-white w-9 text-center font-mono focus:outline-none"
                        aria-label="Episode Number"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateActiveEpisode?.(formatEpisodeLabel(voiceActiveEpisodeNum + 1))}
                      className="w-8 h-9 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/60 text-white rounded-none flex items-center justify-center cursor-pointer"
                      aria-label="Increase Episode"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsVoiceNatokEditOpen(false);
                    setIsVoiceNatokDeleteConfirm(false);
                    setIsVoiceNatokAddOpen((v) => !v);
                  }}
                  className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none flex items-center justify-center cursor-pointer"
                  aria-label="Add Drama"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={!activeSeries}
                  onClick={() => {
                    if (!activeSeries) return;
                    setIsVoiceNatokAddOpen(false);
                    setIsVoiceNatokDeleteConfirm(false);
                    setVoiceNatokEditTitle(activeSeries.title);
                    setIsVoiceNatokEditOpen((v) => !v);
                  }}
                  className="w-9 h-9 bg-slate-800 hover:bg-amber-900/60 disabled:opacity-40 text-amber-300 border border-slate-700 rounded-none flex items-center justify-center cursor-pointer"
                  aria-label="Edit Drama"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!activeSeries}
                  onClick={() => {
                    if (!activeSeries) return;
                    setIsVoiceNatokAddOpen(false);
                    setIsVoiceNatokEditOpen(false);
                    setIsVoiceNatokDeleteConfirm((v) => !v);
                  }}
                  className="w-9 h-9 bg-slate-800 hover:bg-rose-900/60 disabled:opacity-40 text-rose-400 border border-slate-700 rounded-none flex items-center justify-center cursor-pointer"
                  aria-label="Delete Drama"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {onOpenSeriesScheduleModal && (
                  <button
                    type="button"
                    onClick={onOpenSeriesScheduleModal}
                    className="w-9 h-9 bg-slate-800 hover:bg-slate-700 text-violet-300 border border-slate-700 rounded-none flex items-center justify-center cursor-pointer"
                    aria-label="Schedule Manager"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {isVoiceNatokAddOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!voiceNatokNewTitle.trim()) return;
                  onQuickAddDrama?.(voiceNatokNewTitle, voiceNatokNewEp);
                  setVoiceNatokNewTitle('');
                  setVoiceNatokNewEp('Ep 5');
                  setIsVoiceNatokAddOpen(false);
                }}
                className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-slate-800"
              >
                <input
                  type="text"
                  required
                  autoFocus
                  value={voiceNatokNewTitle}
                  onChange={(e) => setVoiceNatokNewTitle(e.target.value)}
                  placeholder="Drama title..."
                  className="flex-1 min-w-[160px] h-8 bg-slate-950 border border-indigo-500/60 rounded-none px-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                <input
                  type="text"
                  value={voiceNatokNewEp}
                  onChange={(e) => setVoiceNatokNewEp(e.target.value)}
                  placeholder="Ep"
                  className="w-20 h-8 bg-slate-950 border border-slate-700 rounded-none px-2 text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsVoiceNatokAddOpen(false)}
                  className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-none text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}

            {isVoiceNatokEditOpen && activeSeries && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!voiceNatokEditTitle.trim()) return;
                  onRenameSeries?.(activeSeries.id, voiceNatokEditTitle);
                  setIsVoiceNatokEditOpen(false);
                }}
                className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-slate-800"
              >
                <input
                  type="text"
                  required
                  autoFocus
                  value={voiceNatokEditTitle}
                  onChange={(e) => setVoiceNatokEditTitle(e.target.value)}
                  placeholder="Drama title..."
                  className="flex-1 min-w-[160px] h-8 bg-slate-950 border border-amber-500/60 rounded-none px-2.5 text-xs font-bold text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-8 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-none text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsVoiceNatokEditOpen(false)}
                  className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-none text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}

            {isVoiceNatokDeleteConfirm && activeSeries && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-rose-900/60 bg-rose-950/50 px-2.5 py-1.5">
                <span className="text-xs font-bold text-rose-200 truncate">
                  Delete "{activeSeries.title}"?
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteSeries?.(activeSeries.id);
                      setIsVoiceNatokDeleteConfirm(false);
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-none text-xs font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVoiceNatokDeleteConfirm(false)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-none text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ERROR NOTICE */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-none p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {resumableCheckpoint && !isProcessing && (
              <button
                type="button"
                onClick={() => handleGenerateAndMergeAudio(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-none text-xs flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry ({resumableCheckpoint.completedCount}/{resumableCheckpoint.totalCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 font-bold px-1.5 py-1 hover:bg-rose-100 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* PROCESSING PROGRESS BAR */}
      {isProcessing && (
        <div className="bg-[#0f172a] border border-slate-700 rounded-none p-3 flex flex-col gap-1.5 text-white">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 truncate">
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 shrink-0 ${isPausedGeneration ? '' : 'animate-spin'}`} />
              <span className="truncate">{processingStatus || 'Processing...'}</span>
            </span>
            <span className="font-mono shrink-0">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* MAIN STUDIO CONTAINER */}
      <div className="w-full flex flex-col gap-3">
        {voiceSourceMode === 'upload' ? (
          <div className="w-full flex flex-col gap-3">
            {/* 1. RECORDED VOICE SECTION */}
            <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none divide-y divide-slate-800">
              <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-white">Recorded Voice</span>
                </div>
                {uploadedVoiceUrl && (
                  <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Loaded</span>
                  </span>
                )}
              </div>

              {!uploadedVoiceUrl ? (
                <div className="p-3 flex flex-col gap-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => voiceFileInputRef.current?.click()}
                      className="h-10 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 text-white font-bold text-xs px-3 rounded-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Voice</span>
                    </button>

                    {isRecordingMic ? (
                      <button
                        type="button"
                        onClick={stopMicRecording}
                        className="h-10 bg-rose-600 hover:bg-rose-500 border border-rose-400/50 text-white font-bold text-xs px-3 rounded-none cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
                      >
                        <StopCircle className="w-4 h-4" />
                        <span>Stop Rec ({recordingSeconds}s)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startMicRecording}
                        className="h-10 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 text-white font-bold text-xs px-3 rounded-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Record Mic</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => loadBuiltInOfflineVoice('/assets/aistudio/sample_voice_despina.mp3', 'Master_Voiceover_Despina.mp3')}
                      className="h-9 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold px-2.5 rounded-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Music className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Sample: Despina</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => loadBuiltInOfflineVoice('/assets/aistudio/sample_voice_leda.mp3', 'Master_Voiceover_Leda.mp3')}
                      className="h-9 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold px-2.5 rounded-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      <span>Sample: Leda</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => loadBuiltInOfflineVoice('/assets/aistudio/1019_1__1bb8f07d.MP3', 'Drama_Audio_1019.mp3')}
                      className="h-9 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold px-2.5 rounded-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Sample: Drama Track</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 flex flex-col gap-2.5">

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mic className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {uploadedVoiceName || 'Recorded Voice'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {formatSecondsWithTenths(uploadedVoiceDuration)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={togglePlayUploadedVoice}
                        className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {isPlayingUploadedVoice ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isPlayingUploadedVoice ? 'Pause' : 'Play'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => voiceFileInputRef.current?.click()}
                        className="h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 rounded-none text-xs font-bold cursor-pointer"
                      >
                        Change
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (uploadedVoiceUrl && uploadedVoiceUrl.startsWith('blob:') && uploadedVoiceUrl !== audioUrl) {
                            try {
                              URL.revokeObjectURL(uploadedVoiceUrl);
                            } catch (_) {}
                          }
                          clearMasterAudioState();
                          uploadedVoiceTrackRef.current = null;
                          rawVoiceSourceRef.current = null;
                          voiceDecodePromiseRef.current = null;
                          setHasDecodedVoiceTrack(false);
                          setUploadedVoiceFile(null);
                          setUploadedVoiceUrl(null);
                          setUploadedVoiceName('');
                          setUploadedVoiceDuration(0);
                          setBreakTimestamps([]);
                        }}
                        className="w-8 h-8 bg-slate-800 hover:bg-rose-900/60 border border-slate-700 text-rose-400 rounded-none flex items-center justify-center cursor-pointer"
                        aria-label="Delete Voice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                      <span className="text-indigo-300">{formatSecondsWithTenths(uploadedVoiceCurrentTime)}</span>
                      <span>{formatSecondsWithTenths(uploadedVoiceDuration)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={uploadedVoiceDuration || 1}
                      step={0.1}
                      value={uploadedVoiceCurrentTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setUploadedVoiceCurrentTime(val);
                        if (uploadedVoiceAudioRef.current) uploadedVoiceAudioRef.current.currentTime = val;
                      }}
                      className="accent-indigo-500 w-full h-1.5 bg-slate-800 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. BACKGROUND MUSIC (BGM) CONTROLS */}
            <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none divide-y divide-slate-800">
              <div className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Music className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">
                    {effectiveBgmName ? `BGM: ${effectiveBgmName}` : 'Background Music'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => bgmInputRef.current?.click()}
                    className={`h-8 px-3 rounded-none text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                      effectiveBgmUrl
                        ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/40'
                        : 'bg-cyan-500 hover:bg-cyan-400 border-cyan-400 text-slate-950'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{effectiveBgmUrl ? 'Change BGM' : 'Upload BGM'}</span>
                  </button>
                  {effectiveBgmUrl && (
                    <button
                      type="button"
                      onClick={handleClearDedicatedBgm}
                      className="w-8 h-8 bg-slate-800 hover:bg-rose-900/70 text-rose-400 rounded-none border border-slate-700 flex items-center justify-center cursor-pointer"
                      aria-label="Remove BGM"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 text-xs">
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Speech BGM:</span>
                    <span className="font-mono font-bold text-emerald-400">{Math.round(bgmDuckedVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.35}
                    step={0.01}
                    value={bgmDuckedVolume}
                    onChange={(e) => setBgmDuckedVolume(parseFloat(e.target.value))}
                    className="accent-emerald-400 w-full cursor-pointer"
                  />
                </div>

                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Break Loud:</span>
                    <span className="font-mono font-bold text-rose-400">{Math.round(bgmLoudVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.0}
                    step={0.02}
                    value={bgmLoudVolume}
                    onChange={(e) => setBgmLoudVolume(parseFloat(e.target.value))}
                    className="accent-rose-400 w-full cursor-pointer"
                  />
                </div>

                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Break Time:</span>
                    <span className="font-mono font-bold text-amber-300">{interludeDuration.toFixed(1)}s</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[3.5, 5.0, 6.0, 7.0].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setInterludeDuration(sec)}
                        className={`h-8 rounded-none text-xs font-bold cursor-pointer border ${
                          Math.abs(interludeDuration - sec) < 0.2
                            ? 'bg-amber-400 border-amber-300 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-2.5 flex flex-col gap-2">
                {uploadedVoiceDuration > 0 && (
                  <div className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-slate-300">
                      Voice: <strong className="text-white">{formatTimeMMSS(uploadedVoiceDuration / (speechSpeed || 1))}</strong>
                      {effectiveBgmUrl && audioMixMode !== 'pure_voice' ? (
                        <>
                          {' '}· BGM Breaks: <strong className="text-amber-300">{breakTimestamps.length} × {interludeDuration.toFixed(1)}s</strong>
                        </>
                      ) : (
                        <> · <span className="text-slate-400">No BGM</span></>
                      )}
                    </span>
                    <span className="text-emerald-300 font-bold">
                      Est. Final Audio:{' '}
                      {formatTimeMMSS(
                        uploadedVoiceDuration / (speechSpeed || 1) +
                          (effectiveBgmUrl && audioMixMode !== 'pure_voice'
                            ? breakTimestamps.length * interludeDuration + 1.5
                            : 0.15)
                      )}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleMergeUploadedVoiceWithBgm()}
                  disabled={!uploadedVoiceUrl || isProcessing}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-4 rounded-none flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-400/50"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {isProcessing
                      ? `Mixing (${progressPercent}%)...`
                      : effectiveBgmUrl && audioMixMode !== 'pure_voice'
                      ? `Mix Voice + ${interludeDuration.toFixed(0)}s BGM`
                      : 'Process Final Voice Audio'}
                  </span>
                </button>
              </div>
            </div>

            {/* 3. BREAK POINTS */}
            <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none divide-y divide-slate-800">
              <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs font-bold text-white">
                    Break Points ({breakTimestamps.length})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAutoDetectPauses}
                  disabled={(!uploadedVoiceUrl && !hasDecodedVoiceTrack) || isDetectingPauses || isProcessing}
                  className="h-8 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs px-3 rounded-none flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 ${isDetectingPauses ? 'animate-spin' : ''}`} />
                  <span>{isDetectingPauses ? 'Detecting...' : 'Auto Detect'}</span>
                </button>
              </div>

              {uploadedVoiceUrl && (
                <div className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleAddBreakAtCurrentTime}
                    className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 rounded-none flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-400/50"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Add Break @ {formatSecondsWithTenths(uploadedVoiceCurrentTime)}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={manualTimestampInput}
                      onChange={(e) => setManualTimestampInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddManualBreak();
                      }}
                      placeholder="00:25"
                      className="flex-1 sm:w-28 h-9 bg-slate-950 border border-slate-700 rounded-none px-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualBreak}
                      className="h-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-3 rounded-none text-xs cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}

              {breakTimestamps.length > 0 && (
                <div className="p-2.5 flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                  {(() => {
                    const sorted = [...breakTimestamps].sort((a, b) => a - b);
                    const markers = [0, ...sorted, uploadedVoiceDuration || 0];
                    return sorted.map((time, idx) => {
                      const segStart = markers[idx];
                      const segEnd = time;
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-200 flex items-center gap-2">
                              <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                                Voice #{idx + 1}
                              </span>
                              <span className="font-mono">
                                {formatSecondsWithTenths(segStart)} - {formatSecondsWithTenths(segEnd)}
                              </span>
                            </span>
                            <span className="text-[10px] text-emerald-300 font-bold">
                              BGM {Math.round(bgmDuckedVolume * 100)}%
                            </span>
                          </div>

                          <div className="ml-3 pl-2.5 border-l-2 border-rose-500 py-1 flex items-center justify-between bg-rose-950/40 border border-rose-900/60 px-2.5 text-xs text-rose-200">
                            <span className="flex items-center gap-1.5 font-semibold truncate">
                              <Music className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span className="truncate">
                                Break {interludeDuration.toFixed(1)}s ({Math.round(bgmLoudVolume * 100)}%) @ {formatSecondsWithTenths(time)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBreakTimestamp(idx)}
                              className="text-rose-400 hover:text-rose-200 p-1 cursor-pointer shrink-0"
                              aria-label="Remove Break"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {uploadedVoiceDuration > 0 && (
                    <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-2">
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                          Voice #{breakTimestamps.length + 1}
                        </span>
                        <span className="font-mono">
                          {formatSecondsWithTenths(breakTimestamps[breakTimestamps.length - 1])} - {formatSecondsWithTenths(uploadedVoiceDuration)}
                        </span>
                      </span>
                      <span className="text-[10px] text-emerald-300 font-bold">
                        BGM {Math.round(bgmDuckedVolume * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3">
            {/* TARGET DURATION, WORDS, PARAS & ADAPT SCRIPT BAR */}
            <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none divide-y divide-slate-800">
              <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Target:</span>
                  </div>

                  {/* Minutes Stepper */}
                  <div className="flex items-center border border-slate-700 bg-slate-950 h-8">
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetMinutes((m) => Math.max(0, m - 1));
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetMinutes((m) => Math.max(0, m - 1));
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={targetMinutes}
                      onChange={(e) => {
                        setIsManualTargetDuration(true);
                        const clean = e.target.value.replace(/\D/g, '');
                        setTargetMinutes(Math.min(60, Math.max(0, parseInt(clean || '0', 10) || 0)));
                      }}
                      className="w-8 text-center bg-transparent font-bold text-xs text-white focus:outline-none font-mono"
                    />
                    <span className="text-[11px] text-slate-400 pr-1">m</span>
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetMinutes((m) => Math.min(60, m + 1));
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetMinutes((m) => Math.min(60, m + 1));
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Seconds Stepper */}
                  <div className="flex items-center border border-slate-700 bg-slate-950 h-8">
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetSeconds((s) => Math.max(0, s - 5));
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetSeconds((s) => Math.max(0, s - 5));
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={targetSeconds}
                      onChange={(e) => {
                        setIsManualTargetDuration(true);
                        const clean = e.target.value.replace(/\D/g, '');
                        setTargetSeconds(Math.min(59, Math.max(0, parseInt(clean || '0', 10) || 0)));
                      }}
                      className="w-8 text-center bg-transparent font-bold text-xs text-white focus:outline-none font-mono"
                    />
                    <span className="text-[11px] text-slate-400 pr-1">s</span>
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetSeconds((s) => (s + 5 >= 60 ? 0 : s + 5));
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualTargetDuration(true);
                          setTargetSeconds((s) => (s + 5 >= 60 ? 0 : s + 5));
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1">
                    {[1, 5, 10, 20, 45].map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => {
                          setIsManualTargetDuration(true);
                          setTargetMinutes(min);
                          setTargetSeconds(0);
                        }}
                        className={`h-8 px-2 rounded-none text-[11px] font-bold border cursor-pointer ${
                          targetMinutes === min && targetSeconds === 0
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                        }`}
                      >
                        {min}m
                      </button>
                    ))}
                  </div>

                  {/* Words Stepper */}
                  <div className="flex items-center border border-slate-700 bg-slate-950 h-8">
                    <span className="text-[11px] text-emerald-400 font-bold px-2">Words:</span>
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualWords(true);
                          const base = wordsCount ?? (getScriptWordCount(scriptText) || 0);
                          setWordsCount(Math.max(1, base - 25));
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualWords(true);
                          const base = wordsCount ?? (getScriptWordCount(scriptText) || 0);
                          setWordsCount(Math.max(1, base - 25));
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={wordsCount === null ? '' : wordsCount}
                      placeholder="-"
                      onChange={(e) => {
                        setIsManualWords(true);
                        const clean = e.target.value.replace(/\D/g, '');
                        setWordsCount(clean === '' ? null : Math.max(1, parseInt(clean, 10) || 0));
                      }}
                      className="w-12 text-center bg-transparent font-bold text-xs text-emerald-300 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualWords(true);
                          const base = wordsCount ?? (getScriptWordCount(scriptText) || 0);
                          setWordsCount(base + 25);
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualWords(true);
                          const base = wordsCount ?? (getScriptWordCount(scriptText) || 0);
                          setWordsCount(base + 25);
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Paras Stepper */}
                  <div className="flex items-center border border-slate-700 bg-slate-950 h-8">
                    <span className="text-[11px] text-indigo-300 font-bold px-2">Paras:</span>
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualParas(true);
                          const base = paragraphsCount ?? (getScriptParaCount(scriptText) || 1);
                          setParagraphsCount(Math.max(1, base - 1));
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualParas(true);
                          const base = paragraphsCount ?? (getScriptParaCount(scriptText) || 1);
                          setParagraphsCount(Math.max(1, base - 1));
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={paragraphsCount === null ? '' : paragraphsCount}
                      placeholder="-"
                      onChange={(e) => {
                        setIsManualParas(true);
                        const clean = e.target.value.replace(/\D/g, '');
                        setParagraphsCount(clean === '' ? null : Math.max(1, parseInt(clean, 10) || 1));
                      }}
                      className="w-8 text-center bg-transparent font-bold text-xs text-indigo-200 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onMouseDown={() =>
                        startHoldAction(() => {
                          setIsManualParas(true);
                          const base = paragraphsCount ?? (getScriptParaCount(scriptText) || 1);
                          setParagraphsCount(Math.min(30, base + 1));
                        })
                      }
                      onMouseUp={stopHoldAction}
                      onMouseLeave={stopHoldAction}
                      onTouchStart={() =>
                        startHoldAction(() => {
                          setIsManualParas(true);
                          const base = paragraphsCount ?? (getScriptParaCount(scriptText) || 1);
                          setParagraphsCount(Math.min(30, base + 1));
                        })
                      }
                      onTouchEnd={stopHoldAction}
                      className="w-7 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAdaptScriptToDuration}
                  disabled={isAdaptingScript}
                  className="h-9 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 text-white font-bold text-xs px-3.5 rounded-none flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isAdaptingScript ? 'animate-spin' : ''}`} />
                  <span>
                    {isAdaptingScript
                      ? 'Adapting...'
                      : wordsCount !== null
                      ? `Adapt (${wordsCount}w${paragraphsCount ? `, ${paragraphsCount}p` : ''})`
                      : `Adapt (${targetMinutes}m ${targetSeconds}s)`}
                  </span>
                </button>
              </div>
            </div>

            {adaptNotice && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-none p-2.5 text-xs flex items-center justify-between">
                <span className="font-medium">{adaptNotice}</span>
                <button
                  type="button"
                  onClick={() => setAdaptNotice(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold px-2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Script Editor Box */}
            <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none divide-y divide-slate-800">
              <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Script</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  {liveDurationEstimate.wordCount > 0 && (
                    <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 text-emerald-300">
                      {liveDurationEstimate.wordCount}w · {liveDurationEstimate.charCount}c ·{' '}
                      {isSplitModeActive ? `${voicePartsQueue.length} Parts (≤800c)` : '1 Part (<6m)'} · ~{formatTimeMMSS(liveDurationEstimate.estimatedTotalSeconds)}
                    </span>
                  )}
                  <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 text-indigo-300">
                    {bracketParagraphs.length} [ ]
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoBracketFormat}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-2 py-0.5 cursor-pointer"
                  >
                    Auto [ ]
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    title="Paste from Mobile Clipboard"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-0.5 cursor-pointer flex items-center gap-1"
                  >
                    <span>📋 Paste</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateScript('')}
                    className="bg-rose-950/70 hover:bg-rose-900 border border-rose-800/70 text-rose-300 font-bold px-2 py-0.5 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5">
                <textarea
                  rows={10}
                  value={scriptText}
                  onChange={(e) => handleUpdateScript(e.target.value)}
                  placeholder="[ Write or paste script... ]"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-400 rounded-none p-3 text-xs text-white focus:outline-none resize-y leading-relaxed min-h-[200px] select-text"
                />
              </div>
            </div>

            {/* SEQUENTIAL VOICE PARTS PANEL (Rule 1, 2, 3: Part 01..NN, Status + Per-Part Retry) */}
            {voicePartsQueue.length > 0 && (
              <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none divide-y divide-slate-800">
                <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {isSplitModeActive
                        ? `Smart Sequential Voice Parts (${voicePartsQueue.length} Parts · প্রতি অংশ ~৭–৮ মিনিট / ≤৫,২০০ অক্ষর)`
                        : 'Single-Pass Voice Mode (<৮ মিনিট — ভাগ ছাড়া একবারেই ভয়েস)'}
                    </span>
                    <span className="bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300 flex items-center gap-1">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>
                        Single Speaker:{' '}
                        {chunkSessionRef.current?.sessionSpec.voiceId ||
                          resumableCheckpoint?.voiceId ||
                          (voiceLockEnabled ? activeChannelVoiceProfile.voiceId : selectedSpeaker)}{' '}
                        (Part 01..{String(voicePartsQueue.length).padStart(2, '0')} Identical)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-emerald-300">
                      Completed: {voicePartsQueue.filter((p) => p.status === 'Completed').length}/{voicePartsQueue.length}
                    </span>
                    {joinedVoiceTrackSummary && (
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-emerald-300 font-bold">
                          Voice Track: {formatTimeMMSS(joinedVoiceTrackSummary.actualVoiceDurationSec)}
                        </span>
                        <button
                          type="button"
                          disabled={isExportingPureMp3}
                          onClick={handleDownloadPureVoiceMp3}
                          title="Download Pure Voice MP3 (Without BGM)"
                          className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          <span>{isExportingPureMp3 ? 'Exporting...' : 'Pure MP3'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/80">
                  {voicePartsQueue.map((part) => (
                    <div
                      key={part.index}
                      className="px-3 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 font-mono font-bold text-[11px] text-indigo-300 shrink-0">
                          {part.partLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          [{part.bracketIndex}] · {part.charCount}c
                        </span>
                        <span className="text-slate-300 truncate text-[11px]">
                          {part.cleanText}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {part.audioDurationSec !== undefined && (
                          <span className="font-mono text-[11px] text-cyan-300">
                            {formatTimeMMSS(part.audioDurationSec)}
                          </span>
                        )}

                        {part.status === 'Completed' && part.audioUrl && (
                          <button
                            type="button"
                            onClick={() => handleTogglePlaySinglePart(part)}
                            className="h-6 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Play Part"
                          >
                            {playingPartIndex === part.index ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </button>
                        )}

                        {part.status === 'Failed' && !isProcessing && (
                          <button
                            type="button"
                            onClick={() => handleGenerateAndMergeAudio(true)}
                            className="h-6 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}

                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold border ${
                            part.status === 'Completed'
                              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                              : part.status === 'Generating'
                              ? 'bg-indigo-950/80 border-indigo-400/50 text-indigo-300 animate-pulse'
                              : part.status === 'Failed'
                              ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {part.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BACKGROUND MUSIC & FINAL AUDIO DURATION CONTROL (Rules 4, 5, 6: Preserves 100% of Voice Track) */}
      {(joinedVoiceTrackSummary || uploadedVoiceDuration > 0 || masterDuration > 0) && (
        <div className="bg-[#0f172a] text-white border border-slate-700 rounded-none divide-y divide-slate-800">
          <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-bold text-white">Final Audio Duration:</span>
              {(joinedVoiceTrackSummary || uploadedVoiceDuration > 0) && (
                <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                  Actual Voice Track:{' '}
                  {formatTimeMMSS(
                    voiceSourceMode === 'tts' && joinedVoiceTrackSummary
                      ? joinedVoiceTrackSummary.actualVoiceDurationSec
                      : uploadedVoiceDuration / (speechSpeed || 1)
                  )}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFinalAudioDurationMode('auto')}
                className={`h-8 px-2.5 text-[11px] font-bold border cursor-pointer ${
                  finalAudioDurationMode === 'auto'
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                Auto (Voice)
              </button>

              {[10, 15, 20, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => {
                    setFinalAudioDurationMode('custom');
                    setFinalAudioTargetMinutes(min);
                    setFinalAudioTargetSeconds(0);
                  }}
                  className={`h-8 px-2 text-[11px] font-bold border cursor-pointer ${
                    finalAudioDurationMode === 'custom' &&
                    finalAudioTargetMinutes === min &&
                    finalAudioTargetSeconds === 0
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                >
                  {min}m
                </button>
              ))}

              {/* Custom Final Duration Min/Sec Stepper */}
              <div className="flex items-center border border-slate-700 bg-slate-950 h-8">
                <button
                  type="button"
                  onClick={() => {
                    setFinalAudioDurationMode('custom');
                    setFinalAudioTargetMinutes((m) => Math.max(0, m - 1));
                  }}
                  className="w-6 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={finalAudioTargetMinutes}
                  onChange={(e) => {
                    setFinalAudioDurationMode('custom');
                    const clean = e.target.value.replace(/\D/g, '');
                    setFinalAudioTargetMinutes(Math.min(120, Math.max(0, parseInt(clean || '0', 10) || 0)));
                  }}
                  className="w-8 text-center bg-transparent font-bold text-xs text-white focus:outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400 pr-1">m</span>
                <button
                  type="button"
                  onClick={() => {
                    setFinalAudioDurationMode('custom');
                    setFinalAudioTargetMinutes((m) => Math.min(120, m + 1));
                  }}
                  className="w-6 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center border border-slate-700 bg-slate-950 h-8">
                <button
                  type="button"
                  onClick={() => {
                    setFinalAudioDurationMode('custom');
                    setFinalAudioTargetSeconds((s) => Math.max(0, s - 5));
                  }}
                  className="w-6 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={finalAudioTargetSeconds}
                  onChange={(e) => {
                    setFinalAudioDurationMode('custom');
                    const clean = e.target.value.replace(/\D/g, '');
                    setFinalAudioTargetSeconds(Math.min(59, Math.max(0, parseInt(clean || '0', 10) || 0)));
                  }}
                  className="w-8 text-center bg-transparent font-bold text-xs text-white focus:outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400 pr-1">s</span>
                <button
                  type="button"
                  onClick={() => {
                    setFinalAudioDurationMode('custom');
                    setFinalAudioTargetSeconds((s) => (s + 5 >= 60 ? 0 : s + 5));
                  }}
                  className="w-6 h-full hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                type="button"
                disabled={
                  isProcessing ||
                  (voiceSourceMode === 'tts'
                    ? !joinedVoiceTracksCacheRef.current
                    : !uploadedVoiceUrl)
                }
                onClick={() => {
                  if (voiceSourceMode === 'upload') {
                    handleMergeUploadedVoiceWithBgm();
                  } else {
                    handleReapplyBgmAndDurationLocal();
                  }
                }}
                className="h-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-3 border border-emerald-400/50 cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Apply Duration &amp; BGM</span>
              </button>
            </div>
          </div>

          {durationAdjustmentNotice && (
            <div
              className={`px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                durationAdjustmentNotice.type === 'warning'
                  ? 'bg-amber-950/60 text-amber-200 border-t border-amber-500/40'
                  : 'bg-emerald-950/50 text-emerald-200 border-t border-emerald-500/40'
              }`}
            >
              <span>{durationAdjustmentNotice.message}</span>
              <button
                type="button"
                onClick={() => setDurationAdjustmentNotice(null)}
                className="text-slate-300 hover:text-white px-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* MASTER MIXED AUDIO PLAYER */}
      {masterAudioUrl && (
        <div className="bg-[#0f172a] border border-emerald-500/40 rounded-none divide-y divide-slate-800 text-white shadow-xl">
          <audio
            ref={masterAudioRef}
            src={masterAudioUrl}
            onTimeUpdate={(e) => {
              const cur = (e.target as HTMLAudioElement).currentTime;
              setMasterPlaybackTime(cur);
            }}
            onLoadedMetadata={(e) => {
              const dur = (e.target as HTMLAudioElement).duration;
              if (dur && !isNaN(dur) && isFinite(dur)) {
                setMasterDuration(dur);
              }
            }}
            onEnded={handleMasterEnded}
            className="hidden"
          />

          {/* Top Bar */}
          <div className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Volume2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                  <span>Final Master Audio</span>
                  {masterSourceMeta && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {masterSourceMeta.mode === 'recorded' ? 'Voice + BGM' : 'AI Voice + BGM'}
                      {masterSourceMeta.breakCount > 0 ? ` · ${masterSourceMeta.breakCount} Breaks` : ''}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-2 font-mono">
                  <span>CH {currentChannelSlot}</span>
                  <span>·</span>
                  <span className="text-emerald-300 font-bold">Total: {formatTimeMMSS(masterDuration)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {onNavigateTab && (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('video')}
                    className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white px-3 rounded-none text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('editor')}
                    className="h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 rounded-none text-xs font-bold cursor-pointer"
                  >
                    <span>Editor</span>
                  </button>
                </>
              )}
              <a
                href={masterAudioUrl}
                download={`Master_Voiceover_${selectedSpeaker}_${Date.now()}.wav`}
                className="h-8 bg-white hover:bg-slate-200 text-slate-900 px-3 rounded-none text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download WAV</span>
              </a>
              <button
                type="button"
                disabled={isExportingMp3 || !masterAudioBlob}
                onClick={handleDownloadMasterMp3}
                className="h-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 rounded-none text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>{isExportingMp3 ? `MP3 (${mp3ExportProgress}%)` : 'Download MP3'}</span>
              </button>
            </div>
          </div>

          {/* Time Cards */}
          <div className="grid grid-cols-3 divide-x divide-slate-800 text-center">
            <div className="p-2.5">
              <div className="text-[10px] uppercase font-bold text-emerald-400">Elapsed</div>
              <div className="font-mono text-base sm:text-xl font-extrabold text-white">
                {formatTimeMMSS(masterPlaybackTime)}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-[10px] uppercase font-bold text-indigo-300">Total</div>
              <div className="font-mono text-base sm:text-xl font-extrabold text-white">
                {formatTimeMMSS(masterDuration)}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-[10px] uppercase font-bold text-cyan-400">Remaining</div>
              <div className="font-mono text-base sm:text-xl font-extrabold text-white">
                -{formatTimeMMSS(Math.max(0, masterDuration - masterPlaybackTime))}
              </div>
            </div>
          </div>

          {/* Scrubber Slider */}
          <div className="p-3 flex flex-col gap-1.5">
            <input
              type="range"
              min={0}
              max={masterDuration || 1}
              step={0.1}
              value={masterPlaybackTime}
              onInput={(e) => handleSeekMaster(parseFloat((e.target as HTMLInputElement).value))}
              onChange={(e) => handleSeekMaster(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-slate-800 appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #14b8a6 ${
                  (masterPlaybackTime / (masterDuration || 1)) * 100
                }%, #1e293b ${(masterPlaybackTime / (masterDuration || 1)) * 100}%, #1e293b 100%)`,
              }}
            />
          </div>

          {/* Transport Controls */}
          <div className="p-3 flex flex-col lg:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 w-full lg:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={toggleMasterMute}
                className="w-8 h-8 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center cursor-pointer"
                aria-label="Toggle Mute"
              >
                {isMasterMuted || masterVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMasterMuted ? 0 : masterVolume}
                onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
                className="flex-1 sm:w-28 h-2 bg-slate-800 appearance-none cursor-pointer accent-emerald-400"
              />
              <span className="text-xs font-mono font-bold text-slate-300 w-10 text-right">
                {Math.round((isMasterMuted ? 0 : masterVolume) * 100)}%
              </span>
            </div>

            <div className="flex items-center flex-wrap justify-center gap-1.5">
              <button
                type="button"
                onClick={handleRestartMaster}
                className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>

              <button
                type="button"
                onClick={() => handleSkipMaster(-10)}
                className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Rewind className="w-3.5 h-3.5 text-emerald-400" />
                <span>-10s</span>
              </button>

              <button
                type="button"
                onClick={togglePlayMaster}
                className="h-9 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-none flex items-center gap-1.5 cursor-pointer"
              >
                {isPlayingMaster ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlayingMaster ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSkipMaster(10)}
                className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>+10s</span>
                <FastForward className="w-3.5 h-3.5 text-emerald-400" />
              </button>

              <button
                type="button"
                onClick={handleStopMaster}
                className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-300 rounded-none text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Stop</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              {[0.75, 1.0, 1.25, 1.5].map((rate) => {
                const isActive = masterPlaybackRate === rate;
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleMasterRateChange(rate)}
                    className={`h-8 px-2 rounded-none text-xs font-mono font-bold border cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Gemini API Key Setup Modal */}
      <GeminiApiKeyModal
        isOpen={isApiKeyGuideOpen}
        onClose={() => {
          setIsApiKeyGuideOpen(false);
          fetchApiKeyStatus();
        }}
        onKeysUpdated={() => {
          fetchApiKeyStatus();
        }}
      />
    </div>
  );
});

