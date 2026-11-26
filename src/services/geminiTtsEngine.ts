/**
 * Clean, rebuilt Google AI Studio Gemini 2.5 TTS Synthesis Engine
 * Handles all 30 official Google AI Studio 2.5 speakers, timeout-safe chunk fetching,
 * Pause/Cancel-aware RPM countdowns, and accurate WAV audio decoding.
 */
import type { LockedVoiceSessionSpec } from './channelVoiceProfiles';

export interface GeminiSpeakerMeta {
  name: string;
  gender: 'female' | 'male';
  tone: string;
  pitch: string;
}

export const ALL_GEMINI_25_SPEAKERS: GeminiSpeakerMeta[] = [
  // Female Voices (13)
  { name: 'Despina', gender: 'female', tone: 'Smooth', pitch: 'Middle pitch' },
  { name: 'Aoede', gender: 'female', tone: 'Breezy', pitch: 'Middle pitch' },
  { name: 'Kore', gender: 'female', tone: 'Firm', pitch: 'Middle pitch' },
  { name: 'Leda', gender: 'female', tone: 'Youthful', pitch: 'Higher pitch' },
  { name: 'Zephyr', gender: 'female', tone: 'Bright', pitch: 'Higher pitch' },
  { name: 'Achernar', gender: 'female', tone: 'Soft', pitch: 'Higher pitch' },
  { name: 'Autonoe', gender: 'female', tone: 'Bright', pitch: 'Middle pitch' },
  { name: 'Callirrhoe', gender: 'female', tone: 'Easy-going', pitch: 'Middle pitch' },
  { name: 'Erinome', gender: 'female', tone: 'Clear', pitch: 'Middle pitch' },
  { name: 'Laomedeia', gender: 'female', tone: 'Upbeat', pitch: 'Higher pitch' },
  { name: 'Pulcherrima', gender: 'female', tone: 'Forward', pitch: 'Middle pitch' },
  { name: 'Sulafat', gender: 'female', tone: 'Warm', pitch: 'Middle pitch' },
  { name: 'Vindemiatrix', gender: 'female', tone: 'Gentle', pitch: 'Middle pitch' },

  // Male Voices (17)
  { name: 'Puck', gender: 'male', tone: 'Upbeat', pitch: 'Middle pitch' },
  { name: 'Charon', gender: 'male', tone: 'Informative', pitch: 'Lower pitch' },
  { name: 'Fenrir', gender: 'male', tone: 'Excitable', pitch: 'Lower middle pitch' },
  { name: 'Orus', gender: 'male', tone: 'Firm', pitch: 'Lower middle pitch' },
  { name: 'Enceladus', gender: 'male', tone: 'Breathy', pitch: 'Lower pitch' },
  { name: 'Achird', gender: 'male', tone: 'Friendly', pitch: 'Lower middle pitch' },
  { name: 'Algenib', gender: 'male', tone: 'Gravelly', pitch: 'Lower pitch' },
  { name: 'Algieba', gender: 'male', tone: 'Smooth', pitch: 'Lower pitch' },
  { name: 'Alnilam', gender: 'male', tone: 'Firm', pitch: 'Lower middle pitch' },
  { name: 'Gacrux', gender: 'male', tone: 'Mature', pitch: 'Middle pitch' },
  { name: 'Iapetus', gender: 'male', tone: 'Clear', pitch: 'Lower middle pitch' },
  { name: 'Rasalgethi', gender: 'male', tone: 'Informative', pitch: 'Middle pitch' },
  { name: 'Sadachbia', gender: 'male', tone: 'Lively', pitch: 'Lower pitch' },
  { name: 'Sadaltager', gender: 'male', tone: 'Knowledgeable', pitch: 'Middle pitch' },
  { name: 'Schedar', gender: 'male', tone: 'Even', pitch: 'Lower middle pitch' },
  { name: 'Umbriel', gender: 'male', tone: 'Easy-going', pitch: 'Lower middle pitch' },
  { name: 'Zubenelgenubi', gender: 'male', tone: 'Casual', pitch: 'Lower middle pitch' },
];

export const GEMINI_TTS_MODELS = [
  { id: 'gemini-2.5-flash-preview-tts', name: '2.5 Flash TTS' },
  { id: 'gemini-2.5-pro-preview-tts', name: '2.5 Pro TTS' },
  { id: 'gemini-3.1-flash-tts-preview', name: '3.1 Flash TTS' },
  { id: 'gemini-3.8-flash-lite-tts', name: '3.8 Lite TTS' },
] as const;

export interface TtsChunkSynthesisResult {
  blob: Blob;
  url: string;
  duration: number;
  usedKeyLabel?: string;
  modelUsed?: string;
  voiceNameUsed?: string;
}

export interface SynthesizeChunkOptions {
  text: string;
  sessionSpec: LockedVoiceSessionSpec;
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  isPaused?: () => boolean;
  forceRetryFirstAttempt?: boolean;
  chunkPositionLabel?: string;
  completedAudioLabel?: string;
  onStatus?: (msg: string) => void;
  onTotalKeysUpdated?: (totalKeys: number) => void;
  onUsedKeyLabel?: (label: string) => void;
}

async function waitPauseAware(
  waitSeconds: number,
  buildMessage: (remainingSec: number) => string,
  signal?: AbortSignal,
  isCancelled?: () => boolean,
  isPaused?: () => boolean,
  onStatus?: (msg: string) => void
): Promise<void> {
  for (let rem = waitSeconds; rem > 0; rem--) {
    if (signal?.aborted || isCancelled?.()) {
      throw new Error('TTS cancelled by user');
    }
    while (isPaused?.()) {
      if (signal?.aborted || isCancelled?.()) {
        throw new Error('TTS cancelled by user');
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    onStatus?.(buildMessage(rem));
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/**
 * Fast, zero-AudioContext WAV duration reader from standard 44-byte RIFF/PCM headers.
 * Prevents allocating duplicate 30MB Float32 AudioBuffers on mobile phones.
 */
function readWavHeaderDurationSec(bytes: Uint8Array): number | null {
  try {
    if (bytes.length < 44) return null;
    if (
      bytes[0] !== 0x52 || // R
      bytes[1] !== 0x49 || // I
      bytes[2] !== 0x46 || // F
      bytes[3] !== 0x46 || // F
      bytes[8] !== 0x57 || // W
      bytes[9] !== 0x41 || // A
      bytes[10] !== 0x56 || // V
      bytes[11] !== 0x45 // E
    ) {
      return null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    let byteRate = 0;
    let dataSize = 0;

    while (offset + 8 <= bytes.length) {
      const id =
        String.fromCharCode(bytes[offset]) +
        String.fromCharCode(bytes[offset + 1]) +
        String.fromCharCode(bytes[offset + 2]) +
        String.fromCharCode(bytes[offset + 3]);
      const chunkSize = view.getUint32(offset + 4, true);

      if (id === 'fmt ' && offset + 8 + 12 <= bytes.length) {
        byteRate = view.getUint32(offset + 8 + 8, true);
      } else if (id === 'data') {
        dataSize = Math.min(chunkSize, bytes.length - (offset + 8));
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }

    if (byteRate > 0 && dataSize > 0) {
      return dataSize / byteRate;
    }
  } catch (_) {}
  return null;
}

export async function synthesizeGeminiTtsChunk(
  opts: SynthesizeChunkOptions
): Promise<TtsChunkSynthesisResult> {
  const {
    text,
    sessionSpec,
    signal,
    isCancelled,
    isPaused,
    forceRetryFirstAttempt,
    chunkPositionLabel = 'অংশ',
    completedAudioLabel = '00:00',
    onStatus,
    onTotalKeysUpdated,
    onUsedKeyLabel,
  } = opts;

  let lastError: any = null;
  const maxAttempts = 5;
  let rpmWaitCycles = 0;
  const maxRpmWaitCycles = 4;
  let shouldForceRetry = Boolean(forceRetryFirstAttempt);

  let attempt = 1;
  while (attempt <= maxAttempts) {
    if (signal?.aborted || isCancelled?.()) {
      throw new Error('TTS cancelled by user');
    }

    const reqAbortController = new AbortController();
    let timedOutByClient = false;
    const onParentAbort = () => {
      try {
        reqAbortController.abort('user_cancelled');
      } catch (_) {}
    };

    if (signal) {
      if (signal.aborted) throw new Error('TTS cancelled by user');
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    const clientTimeoutMs = text.length > 1200 ? 270_000 : 85_000;
    const reqTimeoutTimer = window.setTimeout(() => {
      timedOutByClient = true;
      try {
        reqAbortController.abort('request_timeout');
      } catch (_) {}
    }, clientTimeoutMs);

    const attemptStartMs = Date.now();
    const heartbeatTimer = window.setInterval(() => {
      if (signal?.aborted || isCancelled?.() || isPaused?.()) return;
      const elapsedSec = Math.max(1, Math.floor((Date.now() - attemptStartMs) / 1000));
      if (elapsedSec < 2) return;
      const retryTag = attempt > 1 ? ` · রিট্রাই ${attempt}/${maxAttempts}` : '';
      onStatus?.(
        `ভয়েস তৈরি হচ্ছে: ${chunkPositionLabel} • ${elapsedSec} সে.${retryTag} (সম্পন্ন: ${completedAudioLabel})`
      );
    }, 1000);

    const cleanup = () => {
      window.clearTimeout(reqTimeoutTimer);
      window.clearInterval(heartbeatTimer);
      if (signal) signal.removeEventListener('abort', onParentAbort);
    };

    try {
      const userCustomKey = (localStorage.getItem('user_gemini_api_key') || '').trim();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userCustomKey) {
        const sanitizedKeyHeader = userCustomKey.replace(/[\r\n]+/g, ',').trim();
        if (sanitizedKeyHeader) headers['x-gemini-api-key'] = sanitizedKeyHeader;
      }

      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          voiceName: sessionSpec.voiceId,
          channelSlot: sessionSpec.channelSlot,
          model: sessionSpec.model,
          strictModelLock: sessionSpec.strictModelLock,
          seed: sessionSpec.seed,
          temperature: sessionSpec.temperature,
          speechStylePrompt: sessionSpec.speechStylePrompt,
          voiceSessionId: sessionSpec.sessionId,
          partLabel: chunkPositionLabel,
          forceRetry: shouldForceRetry,
          customApiKey: userCustomKey || undefined,
        }),
        signal: reqAbortController.signal,
      });

      cleanup();
      shouldForceRetry = false;

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        if (attempt < maxAttempts) {
          await waitPauseAware(
            3,
            (rem) => `সার্ভার পুনঃসংযোগ হচ্ছে (${rem} সে.) • ${chunkPositionLabel}`,
            signal,
            isCancelled,
            isPaused,
            onStatus
          );
          attempt += 1;
          continue;
        }
        throw new Error('ভয়েস সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে আবার রিট্রাই করুন।');
      }

      if (typeof data?.totalKeys === 'number') {
        onTotalKeysUpdated?.(data.totalKeys);
      }

      if (!response.ok || !data?.audioBase64) {
        const errorMsg = String(data?.error || '');

        // Pause-aware auto-wait on per-minute RPM limit so long 1-35m scripts resume automatically!
        if (data?.isRateLimitPerMinute && !data?.allKeysExhausted && rpmWaitCycles < maxRpmWaitCycles) {
          rpmWaitCycles += 1;
          const waitSec = Math.min(75, Math.max(8, Number(data?.retryAfterSeconds) || 32));
          await waitPauseAware(
            waitSec,
            (rem) =>
              `⏳ সাময়িক RPM রেট লিমিট — ${rem} সে. পর স্বয়ংক্রিয়ভাবে ${chunkPositionLabel} শুরু হবে (বিরতি ${rpmWaitCycles}/${maxRpmWaitCycles})...`,
            signal,
            isCancelled,
            isPaused,
            onStatus
          );
          shouldForceRetry = true;
          continue;
        }

        if ((response.status === 504 || data?.retryableTimeout) && attempt < maxAttempts) {
          const waitSec = Math.min(8, Math.max(2, Number(data?.retryAfterSeconds) || 4));
          await waitPauseAware(
            waitSec,
            (rem) => `⏳ ভয়েস সার্ভার সাড়া দিতে দেরি করেছে — ${rem} সে. পর স্বয়ংক্রিয় রিট্রাই (${chunkPositionLabel})...`,
            signal,
            isCancelled,
            isPaused,
            onStatus
          );
          attempt += 1;
          continue;
        }

        if (response.status === 429 || data?.isRateLimitPerMinute || data?.allKeysExhausted) {
          const quotaErr: any = new Error(
            errorMsg ||
              '⚠️ সকল সক্রিয় Gemini API Key-এর দৈনিক কোটা পূর্ণ হয়েছে। সম্পন্ন হওয়া অংশগুলো সংরক্ষিত আছে — 🔑 Key বাটনে নতুন আলাদা Gmail-এর API Key দিয়ে Resume করলেই এখান থেকে চলবে!'
          );
          quotaErr.allDailyExhausted = true;
          throw quotaErr;
        }

        if (response.status === 401 || response.status === 403 || data?.validKeysCount === 0) {
          const authErr: any = new Error(
            errorMsg || '⚠️ আপনার Gemini API Key-টি সঠিক নয় (401/403 Invalid)। দয়া করে 🔑 Key বাটনে সঠিক API Key দিন।'
          );
          authErr.allDailyExhausted = true;
          throw authErr;
        }

        if (attempt < maxAttempts) {
          await waitPauseAware(
            4,
            (rem) => `ভয়েস রিকানেক্ট হচ্ছে (${rem} সে.) • ${chunkPositionLabel}`,
            signal,
            isCancelled,
            isPaused,
            onStatus
          );
          attempt += 1;
          continue;
        }

        throw new Error(errorMsg || `ভয়েস তৈরি ব্যর্থ হয়েছে (স্ট্যাটাস: ${response.status})`);
      }

      if (data?.usedKeyLabel) {
        onUsedKeyLabel?.(data.usedKeyLabel);
      }

      // Zero-overhead Uint8Array allocation (8x lower RAM on mobile than boxed JS Array)
      const byteCharacters = atob(data.audioBase64);
      const len = byteCharacters.length;
      const byteArray = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const mime = data.mimeType || 'audio/wav';
      const blob = new Blob([byteArray], { type: mime });
      const url = URL.createObjectURL(blob);

      const speedFactor = Math.max(0.5, sessionSpec.speed || 1);
      const headerDur = readWavHeaderDurationSec(byteArray);
      let duration =
        headerDur !== null
          ? Math.max(0.5, headerDur / speedFactor)
          : Math.max(1, (text.length * 0.085) / speedFactor);

      if (headerDur === null) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const tempCtx = new AudioCtx();
          const decoded = await tempCtx.decodeAudioData(byteArray.buffer.slice(0));
          duration = Math.max(0.5, decoded.duration / speedFactor);
          await tempCtx.close();
        } catch (decErr) {
          console.warn('Direct audio decode note:', decErr);
        }
      }

      if (data?.voiceName && String(data.voiceName).trim() !== sessionSpec.voiceId) {
        throw new Error(
          `স্পিকার অসঙ্গতি ধরা পড়েছে: প্রত্যাশিত ${sessionSpec.voiceId}, পাওয়া গেছে ${data.voiceName}`
        );
      }

      return {
        blob,
        url,
        duration,
        usedKeyLabel: data?.usedKeyLabel,
        modelUsed: data?.model,
        voiceNameUsed: data?.voiceName || sessionSpec.voiceId,
      };
    } catch (err: any) {
      cleanup();
      lastError = err;

      if (signal?.aborted || isCancelled?.() || err?.allDailyExhausted) {
        throw err;
      }

      if ((timedOutByClient || reqAbortController.signal.aborted) && attempt < maxAttempts) {
        await waitPauseAware(
          4,
          (rem) => `⏳ সংযোগ সাড়া দিতে দেরি হয়েছে — ${rem} সে. পর পরের চেষ্টা (${chunkPositionLabel})...`,
          signal,
          isCancelled,
          isPaused,
          onStatus
        );
        attempt += 1;
        continue;
      }

      if (attempt >= maxAttempts) {
        throw err;
      }

      await waitPauseAware(
        3,
        (rem) => `নেটওয়ার্ক রিকানেক্ট হচ্ছে (${rem} সে.) • ${chunkPositionLabel}`,
        signal,
        isCancelled,
        isPaused,
        onStatus
      );
      attempt += 1;
    }
  }

  throw lastError || new Error('ভয়েস তৈরি করা যায়নি। অনুগ্রহ করে API Key ও ইন্টারনেট সংযোগ পরীক্ষা করুন।');
}
