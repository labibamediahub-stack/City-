/**
 * Low-RAM Streaming Int16 WAV/PCM & MP3 Mixer for Long Audio (Up to 60+ Minutes)
 * Avoids giant OfflineAudioContext float32 allocations by mixing in small 4-second
 * Int16 blocks at 24kHz and assembling the final WAV or MP3 Blob locally in browser.
 */
import { Mp3Encoder } from '@breezystack/lamejs';

export interface TimelineVoicePlacement {
  chunkIndex: number;
  voiceStartSec: number;
  voiceEndSec: number;
  voiceDurationSec: number;
  isEndOfBracket: boolean;
  interludeStartSec: number;
  interludeEndSec: number;
}

export interface DecodedPcmTrack {
  sampleRate: number;
  channels: Float32Array[]; // length 1 or 2
  duration: number;
  length: number;
}

/**
 * Extract AudioBuffer into lightweight channel arrays and resample linearly if needed
 * to targetSampleRate (default 24000 Hz, matching Gemini TTS native sample rate).
 */
export function extractResampledChannels(
  audioBuffer: AudioBuffer,
  targetSampleRate = 24000
): DecodedPcmTrack {
  const srcRate = audioBuffer.sampleRate;
  const srcLen = audioBuffer.length;
  const numCh = Math.min(2, audioBuffer.numberOfChannels);

  if (srcRate === targetSampleRate) {
    const channels: Float32Array[] = [];
    for (let c = 0; c < numCh; c++) {
      channels.push(new Float32Array(audioBuffer.getChannelData(c)));
    }
    return {
      sampleRate: targetSampleRate,
      channels,
      duration: srcLen / targetSampleRate,
      length: srcLen,
    };
  }

  const ratio = srcRate / targetSampleRate;
  const dstLen = Math.max(1, Math.floor(srcLen / ratio));
  const channels: Float32Array[] = [];

  for (let c = 0; c < numCh; c++) {
    const src = audioBuffer.getChannelData(c);
    const dst = new Float32Array(dstLen);
    for (let i = 0; i < dstLen; i++) {
      const srcPos = i * ratio;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;
      const s0 = src[idx] ?? 0;
      const s1 = src[Math.min(srcLen - 1, idx + 1)] ?? s0;
      dst[i] = s0 + (s1 - s0) * frac;
    }
    channels.push(dst);
  }

  return {
    sampleRate: targetSampleRate,
    channels,
    duration: dstLen / targetSampleRate,
    length: dstLen,
  };
}

/**
 * Compute continuous BGM ducking envelope gain at timeline time `t` (in seconds).
 * Matches exact bracket-end swell & speech-duck behavior.
 */
function smoothStepCosine(p: number): number {
  const clamped = Math.min(1, Math.max(0, p));
  return 0.5 * (1 - Math.cos(Math.PI * clamped));
}

interface BgmSectionSegment {
  outStart: number;
  outEnd: number;
  srcStart: number;
}

/**
 * Smart Non-Repetitive BGM Arranger & Trimmer:
 * - Situation 1 (BGM >= Final Duration): Cleanly trims to exact target duration.
 * - Situation 2 (BGM < Final Duration): Trims dead silence at edges, arranges varied
 *   musical sections across the timeline so repetition isn't monotonous, and applies
 *   equal-power cosine/sine crossfades at every join to prevent seams or clicks.
 */
function createSmartBgmSampler(
  bgm: DecodedPcmTrack | null,
  targetOutFrames: number,
  outSampleRate: number
): ((outFrame: number) => [number, number]) | null {
  if (!bgm || bgm.length <= 0) return null;

  const ch0 = bgm.channels[0];
  const ch1 = bgm.channels[1] || ch0;
  const srcLen = bgm.length;
  const srcRate = bgm.sampleRate || outSampleRate;
  const rateScale = srcRate / outSampleRate;
  const minRequiredSrcFrames = Math.ceil(targetOutFrames * rateScale);

  // Detect active musical region (skip dead silence < 0.0035 RMS at start/end for clean loops)
  const win = Math.max(1, Math.floor(srcRate * 0.05));
  let activeStart = 0;
  for (let i = 0; i < Math.min(srcLen, Math.floor(srcLen * 0.25)); i += win) {
    let sumSq = 0;
    const end = Math.min(srcLen, i + win);
    for (let j = i; j < end; j += 4) sumSq += ch0[j] * ch0[j];
    const rms = Math.sqrt(sumSq / Math.max(1, (end - i) / 4));
    if (rms > 0.004) {
      activeStart = i;
      break;
    }
  }
  let activeEnd = srcLen;
  for (let i = srcLen - win; i > Math.max(activeStart + win * 4, Math.floor(srcLen * 0.65)); i -= win) {
    let sumSq = 0;
    const end = Math.min(srcLen, i + win);
    for (let j = i; j < end; j += 4) sumSq += ch0[j] * ch0[j];
    const rms = Math.sqrt(sumSq / Math.max(1, (end - i) / 4));
    if (rms > 0.004) {
      activeEnd = Math.min(srcLen, end);
      break;
    }
  }
  if (activeEnd - activeStart < Math.floor(srcRate * 2)) {
    activeStart = 0;
    activeEnd = srcLen;
  }

  const readLinear = (srcPos: number): [number, number] => {
    const clamped = Math.max(0, Math.min(srcLen - 1, srcPos));
    const i0 = Math.floor(clamped);
    const i1 = Math.min(srcLen - 1, i0 + 1);
    const f = clamped - i0;
    const l = ch0[i0] + (ch0[i1] - ch0[i0]) * f;
    const r = ch1[i0] + (ch1[i1] - ch1[i0]) * f;
    return [l, r];
  };

  // Situation 1: BGM is already >= Final Duration -> play cleanly from start and trim at target duration
  if (srcLen >= minRequiredSrcFrames) {
    return (outFrame: number) => readLinear(outFrame * rateScale);
  }

  // Situation 2: BGM is shorter than Final Duration -> create varied overlapping musical sections
  const activeSrcLen = activeEnd - activeStart;
  const activeOutLen = Math.max(outSampleRate, Math.floor(activeSrcLen / rateScale));
  const crossfadeFrames = Math.min(
    Math.floor(activeOutLen * 0.18),
    Math.round(1.5 * outSampleRate)
  );

  // Build candidate variations from different musical offsets inside the BGM track
  const variations: { srcStart: number; outLen: number }[] = [
    { srcStart: activeStart, outLen: activeOutLen }, // Full main track first
  ];
  if (activeSrcLen >= srcRate * 18) {
    const midOff = activeStart + Math.floor(activeSrcLen * 0.24);
    const midLen = Math.max(outSampleRate * 6, Math.floor((activeEnd - midOff) / rateScale));
    variations.push({ srcStart: midOff, outLen: midLen });

    const lateOff = activeStart + Math.floor(activeSrcLen * 0.45);
    const lateLen = Math.max(outSampleRate * 5, Math.floor((activeEnd - lateOff) / rateScale));
    if (lateLen >= outSampleRate * 8) {
      variations.push({ srcStart: lateOff, outLen: lateLen });
    }

    const bridgeOff = activeStart + Math.floor(activeSrcLen * 0.12);
    const bridgeLen = Math.max(outSampleRate * 6, Math.floor((activeSrcLen * 0.72) / rateScale));
    if (bridgeLen >= outSampleRate * 8) {
      variations.push({ srcStart: bridgeOff, outLen: bridgeLen });
    }
  }

  const timelineSegs: BgmSectionSegment[] = [];
  let cursor = 0;
  let varIdx = 0;

  while (cursor < targetOutFrames && timelineSegs.length < 4000) {
    const v = variations[varIdx % variations.length];
    const start = cursor === 0 ? 0 : Math.max(0, cursor - crossfadeFrames);
    const end = start + v.outLen;
    timelineSegs.push({
      outStart: start,
      outEnd: end,
      srcStart: v.srcStart,
    });
    cursor = end;
    varIdx++;
    if (end <= start) break;
  }

  let hintSeg = 0;
  return (outFrame: number): [number, number] => {
    while (hintSeg < timelineSegs.length - 1 && outFrame >= timelineSegs[hintSeg + 1].outStart + crossfadeFrames) {
      hintSeg++;
    }
    while (hintSeg > 0 && outFrame < timelineSegs[hintSeg].outStart) {
      hintSeg--;
    }

    const segA = timelineSegs[hintSeg];
    const segB = hintSeg + 1 < timelineSegs.length ? timelineSegs[hintSeg + 1] : null;

    // Equal-power crossfade window where segA overlaps with segB
    if (segB && outFrame >= segB.outStart && outFrame < segA.outEnd) {
      const span = Math.max(1, segA.outEnd - segB.outStart);
      const p = Math.min(1, Math.max(0, (outFrame - segB.outStart) / span));
      const gainA = Math.cos(p * Math.PI * 0.5);
      const gainB = Math.sin(p * Math.PI * 0.5);
      const [aL, aR] = readLinear(segA.srcStart + (outFrame - segA.outStart) * rateScale);
      const [bL, bR] = readLinear(segB.srcStart + (outFrame - segB.outStart) * rateScale);
      return [aL * gainA + bL * gainB, aR * gainA + bR * gainB];
    }

    const srcPos = segA.srcStart + (outFrame - segA.outStart) * rateScale;
    return readLinear(srcPos);
  };
}

function getBgmGainAtTimeWithHint(
  t: number,
  events: Array<{
    voiceStartSec: number;
    voiceEndSec: number;
    isEndOfBracket: boolean;
    interludeStartSec: number;
    interludeEndSec: number;
  }>,
  hintRef: { idx: number },
  audioMixMode: 'clean_voice' | 'voice_with_bgm' | 'pure_voice',
  bgmDuckedVolume: number,
  bgmLoudVolume: number,
  totalDurationSec: number
): number {
  if (audioMixMode === 'pure_voice') return 0;
  const speechGain = audioMixMode === 'clean_voice' ? 0 : bgmDuckedVolume;
  const introFade = t < 0.45 ? smoothStepCosine(t / 0.45) : 1.0;

  if (events.length === 0) return speechGain * introFade;

  // Advance O(1) cursor monotonically
  while (
    hintRef.idx < events.length - 1 &&
    t >= Math.max(events[hintRef.idx].voiceEndSec, events[hintRef.idx].interludeEndSec)
  ) {
    hintRef.idx++;
  }
  while (hintRef.idx > 0 && t < events[hintRef.idx].voiceStartSec) {
    hintRef.idx--;
  }

  const i = hintRef.idx;
  const ev = events[i];

  if (t >= ev.voiceStartSec && t < ev.voiceEndSec) {
    // Smooth 120ms pre-ramp up right before segment end if an interlude follows
    if (ev.isEndOfBracket && ev.interludeEndSec > ev.interludeStartSec && t >= ev.voiceEndSec - 0.12) {
      const p = smoothStepCosine((t - (ev.voiceEndSec - 0.12)) / 0.38);
      return (speechGain + p * (bgmLoudVolume - speechGain)) * introFade;
    }
    return speechGain * introFade;
  }

  if (t >= ev.interludeStartSec && t < ev.interludeEndSec) {
    const elapsed = t - ev.interludeStartSec;
    const remaining = ev.interludeEndSec - t;

    // Smooth cosine ramp up into loud swell during first 0.26s
    if (elapsed < 0.26) {
      const p = smoothStepCosine((elapsed + 0.12) / 0.38);
      return (speechGain + p * (bgmLoudVolume - speechGain)) * introFade;
    }
    // Smooth cosine duck back down over last 0.45s before next voice segment starts
    if (i < events.length - 1 && remaining < 0.45) {
      const p = smoothStepCosine(remaining / 0.45);
      return (speechGain + p * (bgmLoudVolume - speechGain)) * introFade;
    }
    // Outro fade-out at end of entire timeline
    if (i === events.length - 1 && totalDurationSec - t < 2.2) {
      const p = smoothStepCosine((totalDurationSec - t) / 2.2);
      return bgmLoudVolume * p;
    }
    return bgmLoudVolume * introFade;
  }

  // Trailing outro region after last voice finishes:
  // smoothly swells BGM up to comfortable musical bed (up to bgmLoudVolume * 0.72) and fades out cleanly at the end
  const lastVoiceEnd = events[events.length - 1].voiceEndSec;
  const outroElapsed = Math.max(0, t - lastVoiceEnd);
  const outroLevel = Math.min(bgmLoudVolume, Math.max(speechGain, bgmLoudVolume * 0.72));
  const outroRamp = outroElapsed < 0.8 ? speechGain + smoothStepCosine(outroElapsed / 0.8) * (outroLevel - speechGain) : outroLevel;

  const fadeOutRemaining = Math.max(0, totalDurationSec - t);
  if (fadeOutRemaining < 2.4) {
    return outroRamp * smoothStepCosine(fadeOutRemaining / 2.4);
  }
  return outroRamp * introFade;
}

function softLimitSample(x: number): number {
  const abs = Math.abs(x);
  if (abs <= 0.85) return x;
  const sign = x < 0 ? -1 : 1;
  return sign * (0.85 + 0.15 * Math.tanh((abs - 0.85) / 0.15));
}

/**
 * Pitch-preserving WSOLA time-stretch (50% Hann OLA) when speed != 1.0.
 * When speed is 1.0 (within 0.005), returns the original track untouched (bit-exact 1:1).
 */
function timeStretchTrack(track: DecodedPcmTrack, speed: number): DecodedPcmTrack {
  if (Math.abs(speed - 1.0) < 0.005 || track.length <= 0) {
    return track;
  }

  const srcLen = track.length;
  const sr = track.sampleRate;
  const rawWin = Math.round(0.036 * sr);
  const winLen = rawWin % 2 === 0 ? rawWin : rawWin + 1;
  const hs = winLen / 2;
  const searchRadius = Math.round(0.012 * sr);
  const outLen = Math.max(1, Math.round(srcLen / speed));

  // Fallback for ultra-short blips shorter than two windows
  if (srcLen <= winLen * 2) {
    const channels = track.channels.map((src) => {
      const dst = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const pos = i * speed;
        const idx0 = Math.min(srcLen - 1, Math.floor(pos));
        const idx1 = Math.min(srcLen - 1, idx0 + 1);
        const frac = pos - idx0;
        dst[i] = src[idx0] + (src[idx1] - src[idx0]) * frac;
      }
      return dst;
    });
    return {
      sampleRate: sr,
      channels,
      duration: outLen / sr,
      length: outLen,
    };
  }

  // Periodic Hann window (win[i] + win[i + hs] === 1.0 everywhere in overlap)
  const win = new Float32Array(winLen);
  for (let i = 0; i < winLen; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / winLen));
  }

  const ch0 = track.channels[0];
  const ch1 = track.channels[1] || null;
  const out0 = new Float32Array(outLen);
  const out1 = ch1 ? new Float32Array(outLen) : null;
  const normSum = new Float32Array(outLen);

  // Seamless start without initial half-window dip
  for (let i = 0; i < Math.min(hs, outLen, srcLen); i++) {
    const wStart = 1 - win[i];
    out0[i] = ch0[i] * wStart;
    if (out1 && ch1) out1[i] = ch1[i] * wStart;
    normSum[i] = wStart;
  }

  let prevStart = 0;
  const maxSrcStart = srcLen - winLen;

  for (let outPos = 0; outPos < outLen; outPos += hs) {
    let bestStart = 0;
    if (outPos === 0) {
      bestStart = 0;
    } else {
      const nomStart = Math.max(0, Math.min(maxSrcStart, Math.round(outPos * speed)));
      const idealStart = Math.max(0, Math.min(maxSrcStart, prevStart + hs));

      if (Math.abs(nomStart - idealStart) <= 2) {
        bestStart = nomStart;
      } else {
        const sMin = Math.max(0, nomStart - searchRadius);
        const sMax = Math.min(maxSrcStart, nomStart + searchRadius);
        let bestCoarse = nomStart;
        let bestScore = -Infinity;

        // Coarse search (stride 4) for waveform similarity in overlap region
        for (let cand = sMin; cand <= sMax; cand += 4) {
          let cross = 0;
          let norm = 0;
          for (let j = 0; j < hs; j += 4) {
            const refVal = ch0[idealStart + j];
            const candVal = ch0[cand + j];
            cross += refVal * candVal;
            norm += candVal * candVal;
          }
          const score = cross / (Math.sqrt(norm) + 1e-6);
          if (score > bestScore) {
            bestScore = score;
            bestCoarse = cand;
          }
        }

        // Fine search around best coarse candidate
        bestStart = bestCoarse;
        let bestFineScore = -Infinity;
        const fMin = Math.max(sMin, bestCoarse - 3);
        const fMax = Math.min(sMax, bestCoarse + 3);
        for (let cand = fMin; cand <= fMax; cand++) {
          let cross = 0;
          let norm = 0;
          for (let j = 0; j < hs; j += 2) {
            const refVal = ch0[idealStart + j];
            const candVal = ch0[cand + j];
            cross += refVal * candVal;
            norm += candVal * candVal;
          }
          const score = cross / (Math.sqrt(norm) + 1e-6);
          if (score > bestFineScore) {
            bestFineScore = score;
            bestStart = cand;
          }
        }
      }
    }

    prevStart = bestStart;
    const copyLen = Math.min(winLen, outLen - outPos, srcLen - bestStart);
    for (let j = 0; j < copyLen; j++) {
      const w = win[j];
      const oIdx = outPos + j;
      const sIdx = bestStart + j;
      out0[oIdx] += ch0[sIdx] * w;
      if (out1 && ch1) out1[oIdx] += ch1[sIdx] * w;
      normSum[oIdx] += w;
    }
  }

  for (let i = 0; i < outLen; i++) {
    const n = normSum[i];
    if (n > 1e-4) {
      out0[i] /= n;
      if (out1) out1[i] /= n;
    }
  }

  return {
    sampleRate: sr,
    channels: out1 ? [out0, out1] : [out0],
    duration: outLen / sr,
    length: outLen,
  };
}

function buildWavHeader(totalFrames: number, numChannels: number, sampleRate: number): ArrayBuffer {
  const dataSize = totalFrames * numChannels * 2;
  const headerBuffer = new ArrayBuffer(44);
  const view = new DataView(headerBuffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  return headerBuffer;
}

/**
 * Streaming chunked parser for uncompressed PCM/Float WAV Blobs/Files (including WAVE_FORMAT_EXTENSIBLE).
 * Reads in small 2 MiB slices so even a 350 MB (30-min) WAV file never spikes RAM
 * or triggers AudioContext.decodeAudioData allocation errors.
 */
async function tryParseWavBlobToPcmTrack(
  blob: Blob,
  targetSampleRate: number,
  forceMono: boolean
): Promise<DecodedPcmTrack | null> {
  if (blob.size < 44) return null;
  const headerSlice = await blob.slice(0, 12).arrayBuffer();
  const hView = new DataView(headerSlice);
  const readTagFromView = (v: DataView, off: number) =>
    String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3));

  if (readTagFromView(hView, 0) !== 'RIFF' || readTagFromView(hView, 8) !== 'WAVE') return null;

  let pos = 12;
  let audioFormat = 0;
  let numChannels = 0;
  let srcRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;
  let chunkWalks = 0;

  while (pos + 8 <= blob.size && chunkWalks < 64) {
    chunkWalks++;
    const chunkHdr = await blob.slice(pos, pos + 8).arrayBuffer();
    if (chunkHdr.byteLength < 8) break;
    const chView = new DataView(chunkHdr);
    const chunkId = readTagFromView(chView, 0);
    const chunkSize = chView.getUint32(4, true);
    const bodyStart = pos + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16 && bodyStart + 16 <= blob.size) {
      const readLen = Math.min(chunkSize, 40, blob.size - bodyStart);
      const fmtBuf = await blob.slice(bodyStart, bodyStart + readLen).arrayBuffer();
      const fmtView = new DataView(fmtBuf);
      audioFormat = fmtView.getUint16(0, true);
      numChannels = fmtView.getUint16(2, true);
      srcRate = fmtView.getUint32(4, true);
      bitsPerSample = fmtView.getUint16(14, true);
      // WAVE_FORMAT_EXTENSIBLE (0xFFFE) stores actual format tag (1=PCM, 3=Float) in SubFormat GUID bytes 24..25
      if (audioFormat === 0xfffe && readLen >= 26) {
        audioFormat = fmtView.getUint16(24, true);
      }
    } else if (chunkId === 'data') {
      dataOffset = bodyStart;
      const maxAvail = Math.max(0, blob.size - bodyStart);
      dataSize = chunkSize === 0 || chunkSize === 0xffffffff ? maxAvail : Math.min(chunkSize, maxAvail);
      break;
    }

    if (chunkSize === 0xffffffff) break;
    pos = bodyStart + chunkSize + (chunkSize % 2);
  }

  if (
    dataOffset < 0 ||
    dataSize <= 0 ||
    srcRate <= 0 ||
    numChannels < 1 ||
    numChannels > 8 ||
    (audioFormat !== 1 && audioFormat !== 3) ||
    (audioFormat === 1 && ![8, 16, 24, 32].includes(bitsPerSample)) ||
    (audioFormat === 3 && bitsPerSample !== 32)
  ) {
    return null;
  }

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = bytesPerSample * numChannels;
  const totalSrcFrames = Math.floor(dataSize / blockAlign);
  if (totalSrcFrames <= 0) return null;

  const outChannelsCount = forceMono || numChannels === 1 ? 1 : 2;
  const ratio = srcRate / targetSampleRate;
  const dstLen = Math.max(1, Math.floor(totalSrcFrames / ratio));
  const outChannels: Float32Array[] = Array.from(
    { length: outChannelsCount },
    () => new Float32Array(dstLen)
  );

  // Align read chunks to exact frame boundaries (max ~2 MiB per slice)
  const framesPerChunk = Math.max(4096, Math.floor((2 * 1024 * 1024) / blockAlign));
  let srcFrameBase = 0;
  let dstIdx = 0;

  while (srcFrameBase < totalSrcFrames && dstIdx < dstLen) {
    const remainingFrames = totalSrcFrames - srcFrameBase;
    const curFrames = Math.min(framesPerChunk, remainingFrames);
    const sliceStart = dataOffset + srcFrameBase * blockAlign;
    const sliceEnd = Math.min(dataOffset + dataSize, sliceStart + curFrames * blockAlign);
    const ab = await blob.slice(sliceStart, sliceEnd).arrayBuffer();
    const dv = new DataView(ab);
    const actualFrames = Math.floor(ab.byteLength / blockAlign);
    if (actualFrames <= 0) break;

    const readSample = (byteOff: number): number => {
      if (audioFormat === 3 && bitsPerSample === 32) {
        return dv.getFloat32(byteOff, true);
      }
      if (bitsPerSample === 16) {
        return dv.getInt16(byteOff, true) / 32768;
      }
      if (bitsPerSample === 8) {
        return (dv.getUint8(byteOff) - 128) / 128;
      }
      if (bitsPerSample === 24) {
        const b0 = dv.getUint8(byteOff);
        const b1 = dv.getUint8(byteOff + 1);
        const b2 = dv.getUint8(byteOff + 2);
        let v = (b2 << 16) | (b1 << 8) | b0;
        if (v & 0x800000) v |= ~0xffffff;
        return v / 8388608;
      }
      return dv.getInt32(byteOff, true) / 2147483648;
    };

    const chunkSrcEnd = srcFrameBase + actualFrames;
    while (dstIdx < dstLen) {
      const srcPos = dstIdx * ratio;
      const localF = srcPos - srcFrameBase;
      const f0 = Math.floor(localF);
      if (f0 >= actualFrames) break;
      if (f0 === actualFrames - 1 && chunkSrcEnd < totalSrcFrames) break;

      const f1 = Math.min(actualFrames - 1, f0 + 1);
      const frac = localF - f0;

      if (outChannelsCount === 1) {
        const off0 = f0 * blockAlign;
        const off1 = f1 * blockAlign;
        let s0 = 0;
        let s1 = 0;
        if (numChannels === 1) {
          s0 = readSample(off0);
          s1 = readSample(off1);
        } else {
          const chUse = Math.min(2, numChannels);
          for (let c = 0; c < chUse; c++) {
            s0 += readSample(off0 + c * bytesPerSample);
            s1 += readSample(off1 + c * bytesPerSample);
          }
          s0 /= chUse;
          s1 /= chUse;
        }
        outChannels[0][dstIdx] = s0 + (s1 - s0) * frac;
      } else {
        const off0 = f0 * blockAlign;
        const off1 = f1 * blockAlign;
        const l0 = readSample(off0);
        const l1 = readSample(off1);
        const r0 = readSample(off0 + bytesPerSample);
        const r1 = readSample(off1 + bytesPerSample);
        outChannels[0][dstIdx] = l0 + (l1 - l0) * frac;
        outChannels[1][dstIdx] = r0 + (r1 - r0) * frac;
      }
      dstIdx++;
    }

    srcFrameBase += Math.max(1, actualFrames - 1);
    if (srcFrameBase >= totalSrcFrames - 1 && actualFrames <= 1) break;
    if (sliceEnd >= dataOffset + dataSize) break;
  }

  return {
    sampleRate: targetSampleRate,
    channels: outChannels,
    duration: dstLen / targetSampleRate,
    length: dstLen,
  };
}

function downmixTrackToMonoInPlace(track: DecodedPcmTrack): DecodedPcmTrack {
  if (track.channels.length <= 1) return track;
  const l = track.channels[0];
  const r = track.channels[1];
  for (let i = 0; i < l.length; i++) {
    l[i] = (l[i] + r[i]) * 0.5;
  }
  return {
    sampleRate: track.sampleRate,
    channels: [l],
    duration: track.duration,
    length: track.length,
  };
}

async function decodeBufferViaWebAudio(
  bytes: Uint8Array,
  targetRate: number,
  forceMono: boolean
): Promise<DecodedPcmTrack> {
  const OfflineCtxClass =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const tryDecode = async (mode: 'offline48' | 'liveNative' | 'liveTarget'): Promise<AudioBuffer> => {
    const copy = bytes.slice(0).buffer;
    if (mode === 'offline48' && OfflineCtxClass) {
      const oCtx = new OfflineCtxClass(2, 1, 48000);
      return await oCtx.decodeAudioData(copy);
    }
    if (!AudioCtxClass) {
      throw new Error('এই ব্রাউজারে Web Audio ডিকোডার সমর্থিত নয়।');
    }
    const ctx = mode === 'liveTarget' ? new AudioCtxClass({ sampleRate: targetRate }) : new AudioCtxClass();
    try {
      return await ctx.decodeAudioData(copy);
    } finally {
      await ctx.close().catch(() => {});
    }
  };

  let decoded: AudioBuffer | null = null;
  let lastErr: unknown = null;

  const attempts: Array<'offline48' | 'liveNative' | 'liveTarget'> = OfflineCtxClass
    ? ['offline48', 'liveNative']
    : ['liveNative', 'liveTarget'];

  for (const mode of attempts) {
    try {
      decoded = await tryDecode(mode);
      if (decoded && decoded.length > 0 && decoded.duration > 0) break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!decoded || decoded.length === 0 || decoded.duration <= 0) {
    throw lastErr || new Error('Unable to decode audio data');
  }

  const resampled = extractResampledChannels(decoded, targetRate);
  return forceMono ? downmixTrackToMonoInPlace(resampled) : resampled;
}

function parseMpegFrameHeader(
  bytes: Uint8Array,
  offset: number
): { frameSize: number; version: number; layer: number; srIdx: number } | null {
  if (offset + 4 > bytes.length) return null;
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const version = (b1 >> 3) & 0x03; // 0=MPEG2.5, 2=MPEG2, 3=MPEG1
  const layer = (b1 >> 1) & 0x03; // 1=Layer3, 2=Layer2, 3=Layer1
  if (version === 1 || layer === 0) return null;

  const b2 = bytes[offset + 2];
  const bitrateIdx = (b2 >> 4) & 0x0f;
  const srIdx = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;
  if (bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) return null;

  const srTable: Record<number, number[]> = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12000, 8000],
  };
  const sr = srTable[version]?.[srIdx];
  if (!sr) return null;

  let kbps = 0;
  if (version === 3) {
    if (layer === 3) kbps = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0][bitrateIdx];
    else if (layer === 2) kbps = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0][bitrateIdx];
    else kbps = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0][bitrateIdx];
  } else {
    if (layer === 3) kbps = [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0][bitrateIdx];
    else kbps = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0][bitrateIdx];
  }
  if (!kbps) return null;

  const bps = kbps * 1000;
  const frameSize =
    layer === 3
      ? Math.floor(((12 * bps) / sr + padding) * 4)
      : layer === 1 && version !== 3
      ? Math.floor((72 * bps) / sr + padding)
      : Math.floor((144 * bps) / sr + padding);

  if (frameSize < 24 || frameSize > 8192) return null;
  return { frameSize, version, layer, srIdx };
}

function findFirstMp3SyncOffset(bytes: Uint8Array): number {
  let searchStart = 0;
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    const hasFooter = (bytes[5] & 0x10) !== 0;
    searchStart = Math.min(bytes.length, 10 + tagSize + (hasFooter ? 10 : 0));
  }

  const scanLimit = Math.min(bytes.length - 8, searchStart + 1024 * 1024);
  for (let i = searchStart; i < scanLimit; i++) {
    const h1 = parseMpegFrameHeader(bytes, i);
    if (!h1) continue;
    const nextOff = i + h1.frameSize;
    if (nextOff + 4 >= bytes.length) return i;
    const h2 = parseMpegFrameHeader(bytes, nextOff);
    if (h2 && h2.version === h1.version && h2.srIdx === h1.srIdx && h2.layer === h1.layer) {
      return i;
    }
  }
  return -1;
}

async function tryDecodeMp3Robust(
  bytes: Uint8Array,
  targetRate: number,
  forceMono: boolean
): Promise<DecodedPcmTrack | null> {
  const firstSync = findFirstMp3SyncOffset(bytes);
  if (firstSync < 0) return null;

  // 1. Try decoding with stripped ID3/junk header first
  if (firstSync > 0) {
    try {
      return await decodeBufferViaWebAudio(bytes.subarray(firstSync), targetRate, forceMono);
    } catch (_) {}
  }

  // 2. Frame-aligned ~1.5 MB chunked decode (handles 25-35 min MP3s & corrupt Xing/trailing frames)
  const chunkStarts: number[] = [];
  let pos = firstSync;
  let lastChunkStart = firstSync;
  const maxChunkBytes = 1500 * 1024;
  chunkStarts.push(firstSync);

  while (pos + 4 < bytes.length) {
    const hdr = parseMpegFrameHeader(bytes, pos);
    if (!hdr) {
      // Re-sync forward up to 8 KB if there is a minor glitch frame
      let resynced = -1;
      const limit = Math.min(bytes.length - 8, pos + 8192);
      for (let s = pos + 1; s < limit; s++) {
        const h1 = parseMpegFrameHeader(bytes, s);
        if (h1 && parseMpegFrameHeader(bytes, s + h1.frameSize)) {
          resynced = s;
          break;
        }
      }
      if (resynced < 0) break;
      pos = resynced;
      continue;
    }
    const nextPos = pos + hdr.frameSize;
    if (nextPos - lastChunkStart >= maxChunkBytes && nextPos + 16 < bytes.length) {
      chunkStarts.push(nextPos);
      lastChunkStart = nextPos;
    }
    pos = nextPos;
  }
  chunkStarts.push(pos > firstSync ? pos : bytes.length);

  // If MP3 is < 1.5MB (2 markers) but had trailing non-MPEG data stripped, try clean trimmed range
  if (chunkStarts.length < 3) {
    if (pos > firstSync && pos < bytes.length) {
      try {
        return await decodeBufferViaWebAudio(bytes.subarray(firstSync, pos), targetRate, forceMono);
      } catch (_) {}
    }
    return null;
  }

  const decodedParts: DecodedPcmTrack[] = [];
  let totalFrames = 0;
  let outChCount = forceMono ? 1 : 2;

  for (let c = 0; c < chunkStarts.length - 1; c++) {
    const s = chunkStarts[c];
    const e = chunkStarts[c + 1];
    if (e - s < 64) continue;
    try {
      const part = await decodeBufferViaWebAudio(bytes.subarray(s, e), targetRate, forceMono);
      decodedParts.push(part);
      totalFrames += part.length;
      if (!forceMono && part.channels.length === 1) {
        outChCount = Math.max(1, outChCount);
      }
    } catch (_) {
      // Skip a corrupted tail chunk if most chunks decoded cleanly
      if (c === 0) return null;
    }
  }

  if (decodedParts.length === 0 || totalFrames <= 0) return null;
  if (decodedParts.length === 1) return decodedParts[0];

  const finalChCount = forceMono
    ? 1
    : decodedParts.some((p) => p.channels.length > 1)
    ? 2
    : 1;
  const mergedChannels = Array.from({ length: finalChCount }, () => new Float32Array(totalFrames));

  let writeOffset = 0;
  for (const part of decodedParts) {
    const pLen = part.length;
    const p0 = part.channels[0];
    const p1 = part.channels[1] || p0;
    mergedChannels[0].set(p0, writeOffset);
    if (finalChCount > 1) {
      mergedChannels[1].set(p1, writeOffset);
    }
    writeOffset += pLen;
  }

  return {
    sampleRate: targetRate,
    channels: mergedChannels,
    duration: totalFrames / targetRate,
    length: totalFrames,
  };
}

/**
 * Silent MediaElement fallback for formats Chrome <audio> plays cleanly but
 * decodeAudioData rejects (e.g. MediaRecorder audio/webm, raw ADTS AAC, fragmented M4A).
 */
async function tryDecodeViaMediaElement(
  blob: Blob,
  targetRate: number,
  forceMono: boolean
): Promise<DecodedPcmTrack> {
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) {
    throw new Error('Unable to decode audio data');
  }

  const url = URL.createObjectURL(blob);
  const audioEl = new Audio();
  audioEl.preload = 'auto';
  audioEl.crossOrigin = 'anonymous';
  audioEl.src = url;

  let ctx: AudioContext | null = null;
  try {
    const mediaDur = await new Promise<number>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Audio metadata timeout')), 8000);
      audioEl.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve(isFinite(audioEl.duration) ? audioEl.duration : 0);
      };
      audioEl.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Unable to decode audio data'));
      };
      audioEl.load();
    });

    // Real-time capture at 4.0x is practical for tracks up to 5 minutes; longer unsupported containers need standard conversion
    if (mediaDur > 320) {
      throw new Error(
        'এই অডিও ফরম্যাটটি ব্রাউজারের সরাসরি ডিকোডারে সমর্থিত নয় (দৈর্ঘ্য ৫ মিনিটের বেশি)। অনুগ্রহ করে ফাইলটি MP3 বা WAV ফরম্যাটে আপলোড করুন।'
      );
    }

    ctx = new AudioCtxClass();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const srcNode = ctx.createMediaElementSource(audioEl);
    const chCount = forceMono ? 1 : 2;
    const procNode = ctx.createScriptProcessor(4096, chCount, chCount);
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    const capturedL: Float32Array[] = [];
    const capturedR: Float32Array[] = [];
    let totalSamples = 0;

    procNode.onaudioprocess = (ev) => {
      if (audioEl.paused && !audioEl.ended) return;
      const in0 = ev.inputBuffer.getChannelData(0);
      capturedL.push(new Float32Array(in0));
      if (!forceMono && ev.inputBuffer.numberOfChannels > 1) {
        capturedR.push(new Float32Array(ev.inputBuffer.getChannelData(1)));
      }
      totalSamples += in0.length;
    };

    srcNode.connect(procNode);
    procNode.connect(silentGain);
    silentGain.connect(ctx.destination);

    // Chromium preserves audio output cleanly up to 4.0x
    audioEl.playbackRate = 4.0;

    await new Promise<void>((resolve, reject) => {
      const maxWaitMs =
        mediaDur > 0
          ? Math.max(15000, Math.ceil((mediaDur / 4.0) * 1000) + 8000)
          : 90000;
      const timer = window.setTimeout(() => resolve(), maxWaitMs);
      audioEl.onended = () => {
        window.clearTimeout(timer);
        resolve();
      };
      audioEl.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Unable to decode audio data'));
      };
      audioEl.play().catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
    });

    try {
      procNode.disconnect();
      srcNode.disconnect();
      silentGain.disconnect();
    } catch (_) {}

    if (totalSamples === 0) {
      throw new Error('Unable to decode audio data');
    }

    const srcRate = ctx.sampleRate || 48000;
    const rawL = new Float32Array(totalSamples);
    let off = 0;
    for (const chunk of capturedL) {
      rawL.set(chunk, off);
      off += chunk.length;
    }

    const rawChannels: Float32Array[] = [rawL];
    if (!forceMono && capturedR.length === capturedL.length) {
      const rawR = new Float32Array(totalSamples);
      let offR = 0;
      for (const chunk of capturedR) {
        rawR.set(chunk, offR);
        offR += chunk.length;
      }
      rawChannels.push(rawR);
    }

    // Resample from capture sampleRate to targetRate (24kHz)
    const ratio = srcRate / targetRate;
    const dstLen = Math.max(1, Math.floor(totalSamples / ratio));
    const resampled = rawChannels.map((src) => {
      if (srcRate === targetRate) return src;
      const dst = new Float32Array(dstLen);
      for (let i = 0; i < dstLen; i++) {
        const pos = i * ratio;
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const s0 = src[idx] ?? 0;
        const s1 = src[Math.min(totalSamples - 1, idx + 1)] ?? s0;
        dst[i] = s0 + (s1 - s0) * frac;
      }
      return dst;
    });

    return {
      sampleRate: targetRate,
      channels: resampled,
      duration: resampled[0].length / targetRate,
      length: resampled[0].length,
    };
  } finally {
    try {
      audioEl.pause();
      audioEl.src = '';
    } catch (_) {}
    URL.revokeObjectURL(url);
    if (ctx) {
      await ctx.close().catch(() => {});
    }
  }
}

/**
 * Low-RAM Audio File/URL -> 24kHz PCM Track Decoder.
 * Supports huge 20-35 minute WAV/MP3/M4A/AAC/OGG/WebM with multi-tier recovery:
 * 1. Streaming chunked WAV parser (including WAVE_FORMAT_EXTENSIBLE)
 * 2. OfflineAudioContext + native-rate AudioContext
 * 3. MP3 ID3/junk header stripper + frame-aligned chunked MP3 decoder
 * 4. Silent MediaElement capture fallback for WebM/AAC/M4A clips
 */
export async function decodeAudioSourceToPcmTrack(
  source: Blob | string,
  options?: { targetSampleRate?: number; forceMono?: boolean }
): Promise<DecodedPcmTrack> {
  const targetRate = options?.targetSampleRate || 24000;
  const forceMono = Boolean(options?.forceMono);

  let blob: Blob;
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (!trimmed) throw new Error('অডিও ফাইল বা লিংক পাওয়া যায়নি।');
    const resp = await fetch(trimmed);
    if (!resp.ok) {
      throw new Error(`অডিও ফাইল লোড করতে সমস্যা হয়েছে (HTTP ${resp.status})`);
    }
    blob = await resp.blob();
  } else {
    blob = source;
  }

  if (!blob || blob.size === 0) {
    throw new Error('আপলোড করা অডিও ফাইলটি খালি বা অকার্যকর।');
  }

  // Tier 1: Streaming chunked WAV path (zero AudioContext allocation for large WAVs)
  try {
    const wavTrack = await tryParseWavBlobToPcmTrack(blob, targetRate, forceMono);
    if (wavTrack) return wavTrack;
  } catch (wavErr) {
    console.warn('Streaming WAV fallback:', wavErr);
  }

  try {
    const rawBuffer = await blob.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    // Tier 2: Standard OfflineAudioContext / native AudioContext
    try {
      return await decodeBufferViaWebAudio(rawBytes, targetRate, forceMono);
    } catch (webAudioErr) {
      // Tier 3: MP3 ID3/junk strip + frame-aligned chunked MP3 decoding
      try {
        const mp3Track = await tryDecodeMp3Robust(rawBytes, targetRate, forceMono);
        if (mp3Track) return mp3Track;
      } catch (mp3Err) {
        console.warn('Chunked MP3 fallback note:', mp3Err);
      }

      // Tier 4: Silent MediaElement fallback for MediaRecorder WebM / quirky M4A / ADTS AAC
      try {
        return await tryDecodeViaMediaElement(blob, targetRate, forceMono);
      } catch (mediaErr: any) {
        const specificMsg = String(mediaErr?.message || '');
        if (specificMsg.startsWith('এই অডিও') || specificMsg.startsWith('অডিও')) {
          throw mediaErr;
        }
        throw webAudioErr;
      }
    }
  } catch (err: any) {
    const rawMsg = String(err?.message || err || '');
    if (rawMsg.toLowerCase().includes('memory') || rawMsg.toLowerCase().includes('allocation')) {
      throw new Error(
        'অডিও ফাইলটি ব্রাউজার মেমোরির সীমা অতিক্রম করেছে। দয়া করে MP3 (128kbps) ফরম্যাটে আপলোড করুন অথবা অপ্রয়োজনীয় ট্যাব বন্ধ করুন।'
      );
    }
    throw new Error(
      rawMsg.startsWith('অডিও') || rawMsg.startsWith('এই অডিও')
        ? rawMsg
        : `অডিও ফাইল ডিকোড করা যায়নি (${rawMsg || 'অসমর্থিত ফরম্যাট'})`
    );
  }
}

/**
 * Adaptive silence/pause detector operating directly on compact 24kHz DecodedPcmTrack.
 */
export function detectSpeechPausesFromPcmTrack(
  track: DecodedPcmTrack,
  minSilenceDurationSec = 0.55,
  silenceThresholdRms?: number,
  minSpacingSec = 10.0
): number[] {
  const channelData = track.channels[0];
  if (!channelData || channelData.length === 0) return [];
  const sampleRate = track.sampleRate;
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

  let effectiveThreshold = silenceThresholdRms ?? 0.018;
  if (silenceThresholdRms === undefined && rmsList.length > 10) {
    const sortedRms = [...rmsList].sort((a, b) => a - b);
    const p15 = sortedRms[Math.floor(sortedRms.length * 0.15)] || 0.005;
    const p75 = sortedRms[Math.floor(sortedRms.length * 0.75)] || 0.08;
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
        const splitTime = Math.round((silenceStartTime + 0.12) * 10) / 10;
        if (splitTime > 3.0 && splitTime < track.duration - 3.0) {
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

export interface UploadedVoiceSegmentSpan {
  srcStartSec: number;
  srcEndSec: number;
  voiceStartSec: number;
  voiceEndSec: number;
  isEndOfBracket: boolean;
  interludeStartSec: number;
  interludeEndSec: number;
}

/**
 * Zero-Copy Uploaded Long-Voice + BGM Mixer (Safe up to 35+ minutes!).
 * Reads directly from a single compact 24kHz voiceTrack via (srcStart, srcEnd) windows
 * with zero duplicate AudioBuffer slicing, O(1) BGM ducking envelope lookup, and lazy
 * per-segment WSOLA stretching only if playback speed != 1.0x.
 */
export async function mixUploadedVoiceLowRamToWav(params: {
  voiceTrack: DecodedPcmTrack;
  segments: UploadedVoiceSegmentSpan[];
  bgmTrack: DecodedPcmTrack | null;
  totalDurationSec: number;
  effectiveVoiceSpeed: number;
  voiceVolume: number;
  audioMixMode: 'clean_voice' | 'voice_with_bgm' | 'pure_voice';
  bgmDuckedVolume: number;
  bgmLoudVolume: number;
  onProgress?: (pct: number) => void;
}): Promise<{ blob: Blob; duration: number }> {
  const sampleRate = params.voiceTrack.sampleRate || 24000;
  const numChannels = 2; // Universal Stereo 16-bit WAV
  const totalFrames = Math.max(sampleRate, Math.round(params.totalDurationSec * sampleRate));
  const actualDuration = totalFrames / sampleRate;

  const blockFrames = sampleRate * 4; // 4-second chunks (~384 KB each)
  const pcmParts: BlobPart[] = [];

  const speed = Math.max(0.5, params.effectiveVoiceSpeed || 1.0);
  const needsStretch = Math.abs(speed - 1.0) >= 0.005;
  const vVol = params.voiceVolume ?? 1.0;

  const spans = params.segments.map((seg) => ({
    ...seg,
    srcStartFrame: Math.max(0, Math.min(params.voiceTrack.length - 1, Math.floor(seg.srcStartSec * sampleRate))),
    srcEndFrame: Math.max(0, Math.min(params.voiceTrack.length, Math.ceil(seg.srcEndSec * sampleRate))),
    startFrame: Math.round(seg.voiceStartSec * sampleRate),
    endFrame: Math.round(seg.voiceEndSec * sampleRate),
  }));

  const bgm = params.bgmTrack && params.audioMixMode !== 'pure_voice' ? params.bgmTrack : null;
  const smartBgmSampler = createSmartBgmSampler(bgm, totalFrames, sampleRate);

  let activeSpanHint = 0;
  const bgmHint = { idx: 0 };

  // Lazy single-segment stretched cache (only holds 1 segment at a time when speed != 1.0)
  let stretchedCacheIdx = -1;
  let stretchedCacheTrack: DecodedPcmTrack | null = null;

  const getStretchedSegmentTrack = (idx: number): DecodedPcmTrack => {
    if (stretchedCacheIdx === idx && stretchedCacheTrack) {
      return stretchedCacheTrack;
    }
    const sp = spans[idx];
    const sliceChs = params.voiceTrack.channels.map((ch) =>
      ch.subarray(sp.srcStartFrame, sp.srcEndFrame)
    );
    stretchedCacheTrack = timeStretchTrack(
      {
        sampleRate,
        channels: sliceChs,
        duration: Math.max(0, sp.srcEndFrame - sp.srcStartFrame) / sampleRate,
        length: Math.max(0, sp.srcEndFrame - sp.srcStartFrame),
      },
      speed
    );
    stretchedCacheIdx = idx;
    return stretchedCacheTrack;
  };

  const vCh0 = params.voiceTrack.channels[0];
  const vCh1 = params.voiceTrack.channels[1] || vCh0;
  const edgeSamples = Math.round(0.012 * sampleRate);
  const globalFadeInFrames = Math.round(0.35 * sampleRate);
  const globalFadeOutFrames = Math.round((bgm ? 2.2 : 0.35) * sampleRate);
  const lastVoiceEndFrame = spans.length > 0 ? spans[spans.length - 1].endFrame : totalFrames;

  for (let blockStart = 0; blockStart < totalFrames; blockStart += blockFrames) {
    const len = Math.min(blockFrames, totalFrames - blockStart);
    const int16Block = new Int16Array(len * numChannels);

    for (let i = 0; i < len; i++) {
      const globalFrame = blockStart + i;
      const t = globalFrame / sampleRate;

      let outL = 0;
      let outR = 0;

      while (activeSpanHint < spans.length && globalFrame >= spans[activeSpanHint].endFrame) {
        activeSpanHint++;
      }

      if (activeSpanHint < spans.length) {
        const sp = spans[activeSpanHint];
        if (globalFrame >= sp.startFrame && globalFrame < sp.endFrame) {
          const localIdx = globalFrame - sp.startFrame;
          let sL = 0;
          let sR = 0;
          let maxLocalLen = 0;

          if (needsStretch) {
            const st = getStretchedSegmentTrack(activeSpanHint);
            maxLocalLen = st.length;
            if (localIdx >= 0 && localIdx < maxLocalLen) {
              const sc0 = st.channels[0];
              const sc1 = st.channels[1] || sc0;
              sL = sc0[localIdx] * vVol;
              sR = sc1[localIdx] * vVol;
            }
          } else {
            maxLocalLen = sp.srcEndFrame - sp.srcStartFrame;
            const srcIdx = sp.srcStartFrame + localIdx;
            if (localIdx >= 0 && srcIdx < sp.srcEndFrame && srcIdx < params.voiceTrack.length) {
              sL = vCh0[srcIdx] * vVol;
              sR = vCh1[srcIdx] * vVol;
            }
          }

          if (localIdx >= 0 && localIdx < maxLocalLen) {
            const fromStart = localIdx;
            const toEnd = Math.min(sp.endFrame - globalFrame, maxLocalLen - localIdx);
            const edgeGain = Math.min(
              1,
              fromStart < edgeSamples ? fromStart / edgeSamples : 1,
              toEnd < edgeSamples ? toEnd / edgeSamples : 1
            );
            outL += sL * edgeGain;
            outR += sR * edgeGain;
          }
        }
      }

      if (smartBgmSampler) {
        const bgmGain = getBgmGainAtTimeWithHint(
          t,
          spans,
          bgmHint,
          params.audioMixMode,
          params.bgmDuckedVolume,
          params.bgmLoudVolume,
          actualDuration
        );
        if (bgmGain > 0.0005) {
          const [bL, bR] = smartBgmSampler(globalFrame);
          outL += bL * bgmGain;
          outR += bR * bgmGain;
        }
      }

      // Smooth master Fade-In and Fade-Out (never clipping voice)
      let masterEnv = 1.0;
      if (globalFrame < globalFadeInFrames) {
        masterEnv *= smoothStepCosine(globalFrame / globalFadeInFrames);
      }
      const framesToEnd = totalFrames - globalFrame;
      if (framesToEnd < globalFadeOutFrames && globalFrame >= lastVoiceEndFrame) {
        masterEnv *= smoothStepCosine(Math.max(0, framesToEnd) / globalFadeOutFrames);
      }

      const clampedL = softLimitSample(outL * masterEnv);
      const clampedR = softLimitSample(outR * masterEnv);
      const outIdx = i * 2;
      int16Block[outIdx] = clampedL < 0 ? clampedL * 0x8000 : clampedL * 0x7fff;
      int16Block[outIdx + 1] = clampedR < 0 ? clampedR * 0x8000 : clampedR * 0x7fff;
    }

    pcmParts.push(new Uint8Array(int16Block.buffer));

    if (params.onProgress) {
      params.onProgress(Math.min(99, Math.round(((blockStart + len) / totalFrames) * 100)));
    }

    await new Promise((r) => setTimeout(r, 0));
  }

  stretchedCacheTrack = null;

  const headerBuffer = buildWavHeader(totalFrames, numChannels, sampleRate);
  return {
    blob: new Blob([headerBuffer, ...pcmParts], { type: 'audio/wav' }),
    duration: actualDuration,
  };
}

/**
 * Stream-mix voice tracks + optional looped BGM into a 24kHz Stereo 16-bit WAV Blob
 * in 4-second Int16 blocks to prevent Android / browser Out-Of-Memory crashes.
 */
export async function mixTimelineLowRamToWav(params: {
  voiceTracks: DecodedPcmTrack[];
  events: TimelineVoicePlacement[];
  bgmTrack: DecodedPcmTrack | null;
  totalDurationSec: number;
  effectiveVoiceSpeed: number;
  voiceVolume: number;
  audioMixMode: 'clean_voice' | 'voice_with_bgm' | 'pure_voice';
  bgmDuckedVolume: number;
  bgmLoudVolume: number;
  sampleRate?: number;
  onProgress?: (pct: number) => void;
}): Promise<{ blob: Blob; duration: number }> {
  const sampleRate = params.sampleRate || 24000;
  const numChannels = 2; // Stereo WAV
  const totalFrames = Math.max(sampleRate, Math.round(params.totalDurationSec * sampleRate));
  const actualDuration = totalFrames / sampleRate;

  const blockFrames = sampleRate * 4; // 4-second blocks (~384 KB each)
  const pcmParts: BlobPart[] = [];

  const speed = Math.max(0.5, params.effectiveVoiceSpeed || 1.0);
  const vVol = params.voiceVolume ?? 1.0;

  // Apply pitch-preserving time-stretch ONLY when speed deviates from 1.0x
  const stretchedTracks = params.voiceTracks.map((track) =>
    track ? timeStretchTrack(track, speed) : track
  );

  // Pre-compute sample boundaries for each voice placement
  const voiceSpans = params.events.map((ev, idx) => ({
    track: stretchedTracks[idx],
    startFrame: Math.round(ev.voiceStartSec * sampleRate),
    endFrame: Math.round(ev.voiceEndSec * sampleRate),
  }));

  const bgm = params.bgmTrack && params.audioMixMode !== 'pure_voice' ? params.bgmTrack : null;
  const smartBgmSampler = createSmartBgmSampler(bgm, totalFrames, sampleRate);

  let activeSpanHint = 0;
  const bgmHint = { idx: 0 };
  const globalFadeInFrames = Math.round(0.35 * sampleRate);
  const globalFadeOutFrames = Math.round((bgm ? 2.2 : 0.35) * sampleRate);
  const lastVoiceEndFrame = voiceSpans.length > 0 ? voiceSpans[voiceSpans.length - 1].endFrame : totalFrames;

  for (let blockStart = 0; blockStart < totalFrames; blockStart += blockFrames) {
    const len = Math.min(blockFrames, totalFrames - blockStart);
    const int16Block = new Int16Array(len * numChannels);

    for (let i = 0; i < len; i++) {
      const globalFrame = blockStart + i;
      const t = globalFrame / sampleRate;

      let outL = 0;
      let outR = 0;

      // Advance span hint efficiently (monotonically non-overlapping timeline)
      while (activeSpanHint < voiceSpans.length && globalFrame >= voiceSpans[activeSpanHint].endFrame) {
        activeSpanHint++;
      }

      if (activeSpanHint < voiceSpans.length) {
        const span = voiceSpans[activeSpanHint];
        if (globalFrame >= span.startFrame && globalFrame < span.endFrame && span.track) {
          const localIdx = globalFrame - span.startFrame;
          if (localIdx >= 0 && localIdx < span.track.length) {
            const ch0 = span.track.channels[0];
            const ch1 = span.track.channels[1] || ch0;

            const sL = ch0[localIdx] * vVol;
            const sR = ch1[localIdx] * vVol;

            // Gentle 12ms micro fade-in/out on chunk edges to eliminate any click
            const edgeSamples = Math.round(0.012 * sampleRate);
            const fromStart = globalFrame - span.startFrame;
            const toEnd = Math.min(span.endFrame - globalFrame, span.track.length - localIdx);
            const edgeGain = Math.min(
              1,
              fromStart < edgeSamples ? fromStart / edgeSamples : 1,
              toEnd < edgeSamples ? toEnd / edgeSamples : 1
            );

            outL += sL * edgeGain;
            outR += sR * edgeGain;
          }
        }
      }

      if (smartBgmSampler) {
        const bgmGain = getBgmGainAtTimeWithHint(
          t,
          params.events,
          bgmHint,
          params.audioMixMode,
          params.bgmDuckedVolume,
          params.bgmLoudVolume,
          actualDuration
        );
        if (bgmGain > 0.0005) {
          const [bL, bR] = smartBgmSampler(globalFrame);
          outL += bL * bgmGain;
          outR += bR * bgmGain;
        }
      }

      // Global smooth Fade In at start and smooth Fade Out at end
      let masterEnv = 1.0;
      if (globalFrame < globalFadeInFrames) {
        masterEnv *= smoothStepCosine(globalFrame / globalFadeInFrames);
      }
      const framesToEnd = totalFrames - globalFrame;
      if (framesToEnd < globalFadeOutFrames && globalFrame >= lastVoiceEndFrame) {
        masterEnv *= smoothStepCosine(Math.max(0, framesToEnd) / globalFadeOutFrames);
      }

      // Soft-knee limiting above 0.85 prevents digital clipping distortion while keeping voice 100% crisp
      const clampedL = softLimitSample(outL * masterEnv);
      const clampedR = softLimitSample(outR * masterEnv);
      const outIdx = i * 2;
      int16Block[outIdx] = clampedL < 0 ? clampedL * 0x8000 : clampedL * 0x7fff;
      int16Block[outIdx + 1] = clampedR < 0 ? clampedR * 0x8000 : clampedR * 0x7fff;
    }

    pcmParts.push(new Uint8Array(int16Block.buffer));

    if (params.onProgress) {
      params.onProgress(Math.min(99, Math.round(((blockStart + len) / totalFrames) * 100)));
    }

    // Yield periodically to keep browser UI & Cancel/Pause responsive on long 35m+ mixes
    await new Promise((r) => setTimeout(r, 0));
  }

  const headerBuffer = buildWavHeader(totalFrames, numChannels, sampleRate);

  return {
    blob: new Blob([headerBuffer, ...pcmParts], { type: 'audio/wav' }),
    duration: actualDuration,
  };
}

/**
 * 100% Local Browser-Side Streaming WAV -> MP3 Encoder (No server upload, Low-RAM chunked).
 * Reads Int16 PCM directly from a WAV Blob in 2-second blocks and encodes 128 kbps MP3.
 */
export async function encodeWavBlobToMp3LowRam(
  wavBlob: Blob,
  kbps = 128,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (!wavBlob || wavBlob.size <= 44) {
    throw new Error('MP3 রূপান্তরের জন্য বৈধ অডিও পাওয়া যায়নি।');
  }

  const hdrBuf = await wavBlob.slice(0, 44).arrayBuffer();
  const dv = new DataView(hdrBuf);
  const riffTag = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));

  let numChannels = 2;
  let sampleRate = 24000;
  let dataStart = 44;
  let dataBytes = wavBlob.size - 44;

  if (riffTag === 'RIFF') {
    numChannels = Math.max(1, Math.min(2, dv.getUint16(22, true)));
    sampleRate = dv.getUint32(24, true) || 24000;
    const declaredData = dv.getUint32(40, true);
    if (declaredData > 0 && declaredData <= wavBlob.size - 44) {
      dataBytes = declaredData;
    }
  } else {
    // Non-WAV input fallback: decode via streaming track decoder first
    const track = await decodeAudioSourceToPcmTrack(wavBlob, { targetSampleRate: 24000, forceMono: false });
    numChannels = track.channels.length >= 2 ? 2 : 1;
    sampleRate = track.sampleRate;
    const mp3Encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
    const mp3Chunks: BlobPart[] = [];
    const blockSamples = sampleRate * 2;
    const lBuf = new Int16Array(blockSamples);
    const rBuf = numChannels > 1 ? new Int16Array(blockSamples) : null;

    for (let start = 0; start < track.length; start += blockSamples) {
      const len = Math.min(blockSamples, track.length - start);
      const c0 = track.channels[0];
      const c1 = track.channels[1] || c0;
      for (let i = 0; i < len; i++) {
        const s0 = Math.max(-1, Math.min(1, c0[start + i]));
        lBuf[i] = s0 < 0 ? s0 * 0x8000 : s0 * 0x7fff;
        if (rBuf) {
          const s1 = Math.max(-1, Math.min(1, c1[start + i]));
          rBuf[i] = s1 < 0 ? s1 * 0x8000 : s1 * 0x7fff;
        }
      }
      const enc = rBuf
        ? mp3Encoder.encodeBuffer(lBuf.subarray(0, len), rBuf.subarray(0, len))
        : mp3Encoder.encodeBuffer(lBuf.subarray(0, len));
      if (enc.length > 0) mp3Chunks.push(new Uint8Array(enc));
      onProgress?.(Math.min(98, Math.round(((start + len) / track.length) * 100)));
      await new Promise((r) => setTimeout(r, 0));
    }
    const flush = mp3Encoder.flush();
    if (flush.length > 0) mp3Chunks.push(new Uint8Array(flush));
    onProgress?.(100);
    return new Blob(mp3Chunks, { type: 'audio/mp3' });
  }

  const mp3Encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Chunks: BlobPart[] = [];
  const blockAlign = numChannels * 2;
  const framesPerBlock = sampleRate * 2; // 2-second blocks (~96 KB Int16 read per slice)
  const bytesPerBlock = framesPerBlock * blockAlign;

  for (let offset = 0; offset < dataBytes; offset += bytesPerBlock) {
    const sliceLen = Math.min(bytesPerBlock, dataBytes - offset);
    const alignedLen = Math.floor(sliceLen / blockAlign) * blockAlign;
    if (alignedLen <= 0) break;

    const ab = await wavBlob.slice(dataStart + offset, dataStart + offset + alignedLen).arrayBuffer();
    const samples = new Int16Array(ab);
    const frameCount = Math.floor(samples.length / numChannels);

    let encoded: Uint8Array;
    if (numChannels === 1) {
      encoded = mp3Encoder.encodeBuffer(samples);
    } else {
      const left = new Int16Array(frameCount);
      const right = new Int16Array(frameCount);
      for (let i = 0; i < frameCount; i++) {
        left[i] = samples[i * 2];
        right[i] = samples[i * 2 + 1];
      }
      encoded = mp3Encoder.encodeBuffer(left, right);
    }
    if (encoded.length > 0) {
      mp3Chunks.push(new Uint8Array(encoded));
    }

    onProgress?.(Math.min(98, Math.round(((offset + alignedLen) / dataBytes) * 100)));
    await new Promise((r) => setTimeout(r, 0));
  }

  const flushed = mp3Encoder.flush();
  if (flushed.length > 0) {
    mp3Chunks.push(new Uint8Array(flushed));
  }
  onProgress?.(100);
  return new Blob(mp3Chunks, { type: 'audio/mp3' });
}
