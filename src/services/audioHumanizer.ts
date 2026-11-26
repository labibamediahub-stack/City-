/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DecodedExportAudio } from './exportEngine';

export interface AudioHumanizeOptions {
  enableRoomTone?: boolean;
  roomToneDb?: number; // e.g. -46 dB subtle studio floor (eliminates robotic digital-zero silence)
  enableWarmMastering?: boolean; // gentle broadcast soft-limiter + subtle warmth
  enableSubtlePitchMicroShift?: boolean;
  channelSlotNumber?: number;
}

/**
 * Humanizes exported voiceover audio so there is no dead digital-zero silence
 * between sentences and gives each channel a slightly distinct studio warmth profile.
 */
export function humanizeExportAudio(
  audio: DecodedExportAudio | null,
  options: AudioHumanizeOptions = {}
): DecodedExportAudio | null {
  if (!audio || audio.L.length === 0) return audio;

  const {
    enableRoomTone = true,
    roomToneDb = -46,
    enableWarmMastering = true,
    channelSlotNumber = 1,
  } = options;

  const len = audio.L.length;
  const outL = audio.L;
  const outR = audio.R;

  // Subtle deterministic pink-noise generator seeded per channel so each channel has natural studio air
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let seed = (channelSlotNumber * 2654435761 + 1013904223) >>> 0;
  const nextRand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  const roomAmp = enableRoomTone ? Math.pow(10, roomToneDb / 20) : 0;

  // One-pole low-pass state for gentle studio warmth (varies subtly per channel)
  const warmthAlpha = 0.08 + ((channelSlotNumber % 5) * 0.015);
  let lpL = 0;
  let lpR = 0;

  // Envelope follower for gentle broadcast soft-knee compression / leveling
  let env = 0;
  const attack = 0.015;
  const release = 0.0008;

  for (let i = 0; i < len; i++) {
    let sL = outL[i];
    let sR = outR[i];

    // Gentle low-end warmth blend
    if (enableWarmMastering) {
      lpL += warmthAlpha * (sL - lpL);
      lpR += warmthAlpha * (sR - lpR);
      sL = sL * 0.94 + lpL * 0.08;
      sR = sR * 0.94 + lpR * 0.08;

      const peak = Math.max(Math.abs(sL), Math.abs(sR));
      if (peak > env) {
        env += attack * (peak - env);
      } else {
        env += release * (peak - env);
      }

      // Soft broadcast leveling when signal is active
      if (env > 0.35) {
        const excess = env - 0.35;
        const targetEnv = 0.35 + excess * 0.68;
        const compGain = targetEnv / Math.max(1e-5, env);
        sL *= compGain;
        sR *= compGain;
      }
    }

    // Ultra-subtle studio room tone (removes 100% digital zero flatlines)
    if (enableRoomTone && roomAmp > 0) {
      const white = nextRand();
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      const pink = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      // Subtle stereo room decorrelation
      sL += pink * roomAmp;
      sR += (pink * 0.92 + white * 0.04) * roomAmp;
    }

    // Fast soft safety limiter (rational tanh approximation, ~5x faster on mobile CPUs)
    const xL = sL * 0.98;
    const xR = sR * 0.98;
    outL[i] = xL > 3 ? 1 : xL < -3 ? -1 : (xL * (27 + xL * xL)) / (27 + 9 * xL * xL);
    outR[i] = xR > 3 ? 1 : xR < -3 ? -1 : (xR * (27 + xR * xR)) / (27 + 9 * xR * xR);
  }

  return audio;
}
