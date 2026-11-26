/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TrailerSoundFilterPreset =
  | 'anti_copyright'
  | 'cinema_warm'
  | 'crisp_dialogue'
  | 'deep_thrill'
  | 'clean_bypass';

export type TrailerBgmPreset =
  | 'cinematic_pad'
  | 'thrill_tension'
  | 'emotional_piano'
  | 'custom'
  | 'off';

export const TRAILER_SOUND_FILTER_OPTIONS: Array<{ id: TrailerSoundFilterPreset; label: string }> = [
  { id: 'anti_copyright', label: 'Anti-Copyright Pro (ফিল্টার)' },
  { id: 'cinema_warm', label: 'Cinema Warm (সিনেমা ওয়ার্ম)' },
  { id: 'crisp_dialogue', label: 'Crisp Dialogue (স্পষ্ট সংলাপ)' },
  { id: 'deep_thrill', label: 'Deep Thriller (থ্রিলার ইফেক্ট)' },
  { id: 'clean_bypass', label: 'Natural (ফিল্টার বন্ধ)' }
];

export const TRAILER_BGM_OPTIONS: Array<{ id: TrailerBgmPreset; label: string }> = [
  { id: 'cinematic_pad', label: 'Cinematic Safe BGM (সিনেমাটিক)' },
  { id: 'thrill_tension', label: 'Thrill Tension BGM (থ্রিলার)' },
  { id: 'emotional_piano', label: 'Emotional Drone BGM (ইমোশনাল)' },
  { id: 'custom', label: 'Custom BGM (নিজস্ব অডিও)' },
  { id: 'off', label: 'BGM Off (বিজিএম বন্ধ)' }
];

export interface AudioDspSettings {
  isYtSafe: boolean;
  isStudio: boolean;
  isThrill: boolean;
  isDialogue: boolean;
  isCrossfade: boolean;
  pitchShiftSemitones: number; // -3 to +3 semitones (0 = normal)
  bassBoostDb: number;        // -6 to +12 dB
  vocalClarityDb: number;     // -6 to +12 dB
  masterVolume: number;       // 0 to 1
  isMuted: boolean;
  soundFilterPreset?: TrailerSoundFilterPreset;
  bgmPreset?: TrailerBgmPreset;
  bgmVolume?: number;         // 0 to 0.5
}

export const DEFAULT_DSP_SETTINGS: AudioDspSettings = {
  isYtSafe: true,
  isStudio: false,
  isThrill: false,
  isDialogue: true,
  isCrossfade: true,
  pitchShiftSemitones: 0.5,
  bassBoostDb: 3,
  vocalClarityDb: 4,
  masterVolume: 1.0,
  isMuted: false,
  soundFilterPreset: 'anti_copyright',
  bgmPreset: 'cinematic_pad',
  bgmVolume: 0.16
};

interface FilterProfileValues {
  highpassHz: number;
  midNotchFreq: number;
  midNotchGain: number;
  bassOffsetDb: number;
  vocalOffsetDb: number;
  highShelfGainDb: number;
  ambienceWet: number;
}

function resolveFilterProfile(s: AudioDspSettings): FilterProfileValues {
  const preset = s.soundFilterPreset || 'anti_copyright';
  switch (preset) {
    case 'cinema_warm':
      return {
        highpassHz: 85,
        midNotchFreq: 540,
        midNotchGain: -1.8,
        bassOffsetDb: 2.5,
        vocalOffsetDb: 2.5,
        highShelfGainDb: -2.0,
        ambienceWet: 0.12
      };
    case 'crisp_dialogue':
      return {
        highpassHz: 125,
        midNotchFreq: 720,
        midNotchGain: -3.2,
        bassOffsetDb: -1.0,
        vocalOffsetDb: 5.0,
        highShelfGainDb: 1.5,
        ambienceWet: 0.08
      };
    case 'deep_thrill':
      return {
        highpassHz: 75,
        midNotchFreq: 600,
        midNotchGain: -2.6,
        bassOffsetDb: 4.5,
        vocalOffsetDb: 3.0,
        highShelfGainDb: -1.5,
        ambienceWet: 0.16
      };
    case 'clean_bypass':
      return {
        highpassHz: s.isYtSafe ? 90 : 35,
        midNotchFreq: 640,
        midNotchGain: s.isYtSafe ? -1.5 : 0,
        bassOffsetDb: 0,
        vocalOffsetDb: 0,
        highShelfGainDb: 0,
        ambienceWet: s.isYtSafe ? 0.06 : 0
      };
    case 'anti_copyright':
    default:
      return {
        highpassHz: 108,
        midNotchFreq: 640,
        midNotchGain: -2.8,
        bassOffsetDb: 1.5,
        vocalOffsetDb: 4.0,
        highShelfGainDb: -2.2,
        ambienceWet: 0.13
      };
  }
}

interface ProceduralBgmHandle {
  stop: () => void;
  setPreset: (preset: TrailerBgmPreset) => void;
}

/**
 * Lightweight, 100% offline, copyright-free procedural WebAudio BGM bed
 * designed specifically to transform trailer audio fingerprints without drowning out dialogue.
 */
function startProceduralBgmBed(
  ctx: AudioContext,
  targetGain: GainNode,
  initialPreset: TrailerBgmPreset
): ProceduralBgmHandle {
  const activeNodes: AudioNode[] = [];
  const activeTimers: number[] = [];

  const teardown = () => {
    activeTimers.forEach((t) => window.clearInterval(t));
    activeTimers.length = 0;
    activeNodes.forEach((n) => {
      try {
        if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
          (n as OscillatorNode).stop();
        }
      } catch (_) {}
      try {
        n.disconnect();
      } catch (_) {}
    });
    activeNodes.length = 0;
  };

  const build = (preset: TrailerBgmPreset) => {
    teardown();
    if (preset === 'off' || preset === 'custom') return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset === 'thrill_tension' ? 420 : preset === 'emotional_piano' ? 920 : 640;
    filter.Q.value = 1.4;
    filter.connect(targetGain);
    activeNodes.push(filter);

    // Subtle slow filter movement so waveform is never static
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = preset === 'thrill_tension' ? 0.35 : 0.14;
    lfoGain.gain.value = preset === 'thrill_tension' ? 140 : 210;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    activeNodes.push(lfo, lfoGain);

    // Harmonic chord voices (copyright-free ambient frequencies)
    const freqs =
      preset === 'thrill_tension'
        ? [73.42, 110.0, 146.83, 155.56] // D2 - A2 - D3 - Eb3 suspense
        : preset === 'emotional_piano'
        ? [130.81, 164.81, 196.0, 246.94] // C3 - E3 - G3 - B3 warm maj7 pad
        : [110.0, 164.81, 220.0, 261.63]; // A2 - E3 - A3 - C4 cinematic Am pad

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const vGain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (idx - 1.5) * 6;
      vGain.gain.value = idx === 0 ? 0.34 : 0.18;
      osc.connect(vGain);
      vGain.connect(filter);
      osc.start();
      activeNodes.push(osc, vGain);
    });

    // For Thrill Tension mode, add a gentle rhythmic sub-pulse
    if (preset === 'thrill_tension') {
      const triggerPulse = () => {
        try {
          if (ctx.state !== 'running') return;
          const t = ctx.currentTime;
          const pOsc = ctx.createOscillator();
          const pGain = ctx.createGain();
          pOsc.type = 'sine';
          pOsc.frequency.setValueAtTime(92, t);
          pOsc.frequency.exponentialRampToValueAtTime(42, t + 0.22);
          pGain.gain.setValueAtTime(0.001, t);
          pGain.gain.linearRampToValueAtTime(0.45, t + 0.02);
          pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
          pOsc.connect(pGain);
          pGain.connect(targetGain);
          pOsc.start(t);
          pOsc.stop(t + 0.34);
        } catch (_) {}
      };
      const timer = window.setInterval(triggerPulse, 720);
      activeTimers.push(timer);
    }
  };

  build(initialPreset);

  return {
    stop: teardown,
    setPreset: build
  };
}

export interface TrailerExportAudioHandle {
  destination: MediaStreamAudioDestinationNode;
  cleanup: () => void;
}

/**
 * Builds an isolated WebAudio DSP + Copyright-Safe BGM export pipeline for Trailer rendering (`handleExportTrailerVideo`).
 * Guarantees the exported intro/trailer audio has pitch/tempo shift, multi-band EQ, room ambience, compression, and BGM.
 */
export async function createTrailerExportAudioPipeline(
  audioCtx: AudioContext,
  videoEl: HTMLVideoElement,
  options: {
    isYtSafe: boolean;
    isStudio: boolean;
    isThrill: boolean;
    isDialogue: boolean;
    bassBoostDb: number;
    vocalClarityDb: number;
    masterVolume: number;
    isMuted: boolean;
    soundFilterPreset: TrailerSoundFilterPreset;
    bgmPreset: TrailerBgmPreset;
    bgmVolume: number;
    customBgmFile?: File | null;
  }
): Promise<TrailerExportAudioHandle> {
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  // Subtle time-stretch + pitch shift breaks Content-ID waveform & melody matching
  if (options.isYtSafe) {
    videoEl.playbackRate = 1.03;
    (videoEl as any).preservesPitch = false;
  } else {
    videoEl.playbackRate = 1.0;
    (videoEl as any).preservesPitch = true;
  }

  const dest = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createMediaElementSource(videoEl);

  const profile = resolveFilterProfile({
    ...DEFAULT_DSP_SETTINGS,
    ...options
  });

  // 1. Multi-stage Sound Filter Chain
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = profile.highpassHz;
  highpass.Q.value = 0.8;

  const midNotch = audioCtx.createBiquadFilter();
  midNotch.type = 'peaking';
  midNotch.frequency.value = profile.midNotchFreq;
  midNotch.Q.value = 1.3;
  midNotch.gain.value = profile.midNotchGain;

  const bass = audioCtx.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = 175;
  bass.gain.value = options.bassBoostDb + profile.bassOffsetDb + (options.isThrill ? 3.5 : 0) + (options.isStudio ? 1.5 : 0);

  const vocal = audioCtx.createBiquadFilter();
  vocal.type = 'peaking';
  vocal.frequency.value = 2750;
  vocal.Q.value = 1.15;
  vocal.gain.value = options.vocalClarityDb + profile.vocalOffsetDb + (options.isDialogue ? 4.0 : 0) + (options.isStudio ? 2.5 : 0);

  const highShelf = audioCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8200;
  highShelf.gain.value = profile.highShelfGainDb + (options.isStudio ? 2.5 : 0);

  // Subtle room ambience delay to alter phase correlation cleanly without muddy echo
  const dryGain = audioCtx.createGain();
  dryGain.gain.value = 1.0;

  const ambienceDelay = audioCtx.createDelay(0.1);
  ambienceDelay.delayTime.value = 0.019;
  const ambienceFilter = audioCtx.createBiquadFilter();
  ambienceFilter.type = 'lowpass';
  ambienceFilter.frequency.value = 2100;
  const ambienceGain = audioCtx.createGain();
  ambienceGain.gain.value = profile.ambienceWet;

  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 18;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = options.isMuted ? 0 : Math.max(0, Math.min(1.4, options.masterVolume));

  source.connect(highpass);
  highpass.connect(midNotch);
  midNotch.connect(bass);
  bass.connect(vocal);
  vocal.connect(highShelf);

  highShelf.connect(dryGain);
  dryGain.connect(compressor);

  highShelf.connect(ambienceDelay);
  ambienceDelay.connect(ambienceFilter);
  ambienceFilter.connect(ambienceGain);
  ambienceGain.connect(compressor);

  compressor.connect(masterGain);
  masterGain.connect(dest);

  // 2. Copyright-Safe BGM Layer (Custom Audio File OR Built-in Procedural BGM)
  const bgmGain = audioCtx.createGain();
  bgmGain.gain.value = options.isMuted || options.bgmPreset === 'off' ? 0 : Math.max(0, Math.min(0.45, options.bgmVolume));
  bgmGain.connect(compressor);

  let bgmHandle: ProceduralBgmHandle | null = null;
  let customBgmSource: AudioBufferSourceNode | null = null;

  if (options.bgmPreset === 'custom' && options.customBgmFile) {
    try {
      const arr = await options.customBgmFile.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arr);
      customBgmSource = audioCtx.createBufferSource();
      customBgmSource.buffer = decoded;
      customBgmSource.loop = true;
      customBgmSource.connect(bgmGain);
      customBgmSource.start(0);
    } catch (e) {
      console.warn('Custom trailer BGM fallback to cinematic pad:', e);
      bgmHandle = startProceduralBgmBed(audioCtx, bgmGain, 'cinematic_pad');
    }
  } else if (options.bgmPreset !== 'off') {
    const effectivePreset: TrailerBgmPreset =
      options.bgmPreset === 'custom' ? 'cinematic_pad' : options.bgmPreset;
    bgmHandle = startProceduralBgmBed(audioCtx, bgmGain, effectivePreset);
  }

  return {
    destination: dest,
    cleanup: () => {
      try {
        bgmHandle?.stop();
      } catch (_) {}
      try {
        customBgmSource?.stop();
        customBgmSource?.disconnect();
      } catch (_) {}
      try {
        source.disconnect();
        masterGain.disconnect();
      } catch (_) {}
    }
  };
}

/**
 * Web Audio DSP Manager for YouTube Safety, Dual-Track A/B Mixing, Sound Filtering & Preview BGM
 */
export class YouTubeSafetyAudioEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNodeA: MediaElementAudioSourceNode | null = null;
  private sourceNodeB: MediaElementAudioSourceNode | null = null;
  private trackGainA: GainNode | null = null;
  private trackGainB: GainNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private midNotchFilter: BiquadFilterNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private vocalFilter: BiquadFilterNode | null = null;
  private highShelfFilter: BiquadFilterNode | null = null;
  private ambienceDelay: BiquadFilterNode | null = null;
  private ambienceDelayNode: DelayNode | null = null;
  private ambienceGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private previewBgmGain: GainNode | null = null;
  private previewBgmHandle: ProceduralBgmHandle | null = null;
  private isPreviewBgmActive = false;
  private boundVideoA: HTMLVideoElement | null = null;
  private boundVideoB: HTMLVideoElement | null = null;
  private currentSettings: AudioDspSettings = { ...DEFAULT_DSP_SETTINGS };

  constructor() {}

  private initAudioContext() {
    if (this.audioCtx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.audioCtx = new AudioContextClass();

    if (this.audioCtx.state === 'suspended') {
      const resume = () => {
        this.audioCtx?.resume();
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('click', resume);
      window.addEventListener('keydown', resume);
    }

    // Master DSP Chain
    this.highpassFilter = this.audioCtx.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 105;

    this.midNotchFilter = this.audioCtx.createBiquadFilter();
    this.midNotchFilter.type = 'peaking';
    this.midNotchFilter.frequency.value = 640;
    this.midNotchFilter.Q.value = 1.3;
    this.midNotchFilter.gain.value = -2.5;

    this.bassFilter = this.audioCtx.createBiquadFilter();
    this.bassFilter.type = 'lowshelf';
    this.bassFilter.frequency.value = 180;
    this.bassFilter.gain.value = 2;

    this.vocalFilter = this.audioCtx.createBiquadFilter();
    this.vocalFilter.type = 'peaking';
    this.vocalFilter.frequency.value = 2750;
    this.vocalFilter.Q.value = 1.2;
    this.vocalFilter.gain.value = 4;

    this.highShelfFilter = this.audioCtx.createBiquadFilter();
    this.highShelfFilter.type = 'highshelf';
    this.highShelfFilter.frequency.value = 8200;
    this.highShelfFilter.gain.value = -1.5;

    this.ambienceDelayNode = this.audioCtx.createDelay(0.1);
    this.ambienceDelayNode.delayTime.value = 0.019;
    this.ambienceDelay = this.audioCtx.createBiquadFilter();
    this.ambienceDelay.type = 'lowpass';
    this.ambienceDelay.frequency.value = 2100;
    this.ambienceGain = this.audioCtx.createGain();
    this.ambienceGain.gain.value = 0.12;

    this.compressor = this.audioCtx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.ratio.value = 3;

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 1.0;

    this.previewBgmGain = this.audioCtx.createGain();
    this.previewBgmGain.gain.value = 0.0;
    this.previewBgmGain.connect(this.compressor);

    // Filters -> Dry + Ambience -> Compressor -> Master
    this.highpassFilter.connect(this.midNotchFilter);
    this.midNotchFilter.connect(this.bassFilter);
    this.bassFilter.connect(this.vocalFilter);
    this.vocalFilter.connect(this.highShelfFilter);

    this.highShelfFilter.connect(this.compressor);
    this.highShelfFilter.connect(this.ambienceDelayNode);
    this.ambienceDelayNode.connect(this.ambienceDelay);
    this.ambienceDelay.connect(this.ambienceGain);
    this.ambienceGain.connect(this.compressor);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.audioCtx.destination);
  }

  public setPreviewBgmPlaying(playing: boolean) {
    this.isPreviewBgmActive = playing;
    if (!this.audioCtx) {
      if (playing) this.initAudioContext();
      else return;
    }
    if (!this.audioCtx || !this.previewBgmGain) return;

    if (this.audioCtx.state === 'suspended' && playing) {
      this.audioCtx.resume().catch(() => {});
    }

    const preset = this.currentSettings.bgmPreset || 'cinematic_pad';
    if (playing && !this.currentSettings.isMuted && preset !== 'off' && preset !== 'custom') {
      if (!this.previewBgmHandle) {
        this.previewBgmHandle = startProceduralBgmBed(this.audioCtx, this.previewBgmGain, preset);
      }
      const targetVol = Math.max(0, Math.min(0.45, this.currentSettings.bgmVolume ?? 0.16));
      this.previewBgmGain.gain.setTargetAtTime(targetVol, this.audioCtx.currentTime, 0.08);
    } else {
      this.previewBgmGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
      if (!playing && this.previewBgmHandle) {
        this.previewBgmHandle.stop();
        this.previewBgmHandle = null;
      }
    }
  }

  /**
   * Create a MediaStream destination to record the DSP master audio stream directly
   */
  public createStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.initAudioContext();
    if (!this.audioCtx || !this.masterGain) return null;
    try {
      const dest = this.audioCtx.createMediaStreamDestination();
      this.masterGain.connect(dest);
      return dest;
    } catch (_) {
      return null;
    }
  }

  /**
   * Attach Dual Video Elements for A/B Layered Crossfading & Audio Feathering
   */
  public attachDualVideoElements(videoA: HTMLVideoElement, videoB: HTMLVideoElement) {
    this.initAudioContext();
    if (!this.audioCtx || !this.highpassFilter) return;

    // Attach or re-attach Video A
    if (this.boundVideoA !== videoA || !this.sourceNodeA) {
      try {
        if (this.sourceNodeA) {
          try { this.sourceNodeA.disconnect(); } catch (_) {}
          this.sourceNodeA = null;
        }
        this.boundVideoA = videoA;
        this.sourceNodeA = this.audioCtx.createMediaElementSource(videoA);
        if (!this.trackGainA) {
          this.trackGainA = this.audioCtx.createGain();
        }
        this.trackGainA.gain.value = 1.0;
        this.sourceNodeA.connect(this.trackGainA);
        this.trackGainA.connect(this.highpassFilter);
      } catch (e) {
        console.warn('Track A attach warning:', e);
      }
    }

    // Attach or re-attach Video B
    if (this.boundVideoB !== videoB || !this.sourceNodeB) {
      try {
        if (this.sourceNodeB) {
          try { this.sourceNodeB.disconnect(); } catch (_) {}
          this.sourceNodeB = null;
        }
        this.boundVideoB = videoB;
        this.sourceNodeB = this.audioCtx.createMediaElementSource(videoB);
        if (!this.trackGainB) {
          this.trackGainB = this.audioCtx.createGain();
        }
        this.trackGainB.gain.value = 0.0;
        this.sourceNodeB.connect(this.trackGainB);
        this.trackGainB.connect(this.highpassFilter);
      } catch (e) {
        console.warn('Track B attach warning:', e);
      }
    }

    this.applySettings(this.currentSettings);
  }

  /**
   * Execute 1-Second Audio Feathering & Crossfade between Track A and Track B
   */
  public featherAudioCrossfade(fromTrack: 'A' | 'B', durationSec: number = 1.0) {
    if (!this.audioCtx || !this.trackGainA || !this.trackGainB) return;

    const now = this.audioCtx.currentTime;
    const fadeOutNode = fromTrack === 'A' ? this.trackGainA : this.trackGainB;
    const fadeInNode = fromTrack === 'A' ? this.trackGainB : this.trackGainA;

    fadeOutNode.gain.cancelScheduledValues(now);
    fadeOutNode.gain.setValueAtTime(fadeOutNode.gain.value, now);
    fadeOutNode.gain.linearRampToValueAtTime(0.001, now + durationSec);

    fadeInNode.gain.cancelScheduledValues(now);
    fadeInNode.gain.setValueAtTime(0.001, now);
    fadeInNode.gain.linearRampToValueAtTime(1.0, now + durationSec);
  }

  /**
   * Smoothly fade out audio when trailer finishes without starting any next track
   */
  public featherFadeOutOnly(track: 'A' | 'B', durationSec: number = 1.0) {
    if (!this.audioCtx || !this.trackGainA || !this.trackGainB) return;
    const now = this.audioCtx.currentTime;
    const node = track === 'A' ? this.trackGainA : this.trackGainB;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(0.0001, now + durationSec);
  }

  /**
   * Instantly snap active audio track (for direct seek)
   */
  public setActiveTrackInstant(activeTrack: 'A' | 'B') {
    if (!this.audioCtx || !this.trackGainA || !this.trackGainB) return;
    const now = this.audioCtx.currentTime;
    this.trackGainA.gain.cancelScheduledValues(now);
    this.trackGainB.gain.cancelScheduledValues(now);
    this.trackGainA.gain.setValueAtTime(activeTrack === 'A' ? 1.0 : 0.0, now);
    this.trackGainB.gain.setValueAtTime(activeTrack === 'B' ? 1.0 : 0.0, now);
  }

  /**
   * Apply DSP parameters dynamically
   */
  public applySettings(settings: Partial<AudioDspSettings>) {
    const prevPreset = this.currentSettings.bgmPreset;
    this.currentSettings = { ...this.currentSettings, ...settings };
    const s = this.currentSettings;

    // Apply speed/pitch to both video elements
    [this.boundVideoA, this.boundVideoB].forEach((vid) => {
      if (vid) {
        if (s.isYtSafe) {
          vid.playbackRate = 1.03; // 3% time/pitch stretch for Content-ID safety
          (vid as any).preservesPitch = false;
        } else {
          vid.playbackRate = 1.0;
          (vid as any).preservesPitch = true;
        }
      }
    });

    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const profile = resolveFilterProfile(s);

    if (this.highpassFilter) {
      this.highpassFilter.frequency.setTargetAtTime(profile.highpassHz, now, 0.05);
    }

    if (this.midNotchFilter) {
      this.midNotchFilter.frequency.setTargetAtTime(profile.midNotchFreq, now, 0.05);
      this.midNotchFilter.gain.setTargetAtTime(profile.midNotchGain, now, 0.05);
    }

    if (this.bassFilter) {
      let bassGain = s.bassBoostDb + profile.bassOffsetDb;
      if (s.isThrill) bassGain += 3.5;
      if (s.isStudio) bassGain += 1.5;
      this.bassFilter.gain.setTargetAtTime(bassGain, now, 0.05);
    }

    if (this.vocalFilter) {
      let vocalGain = s.vocalClarityDb + profile.vocalOffsetDb;
      if (s.isDialogue) vocalGain += 4;
      if (s.isStudio) vocalGain += 2.5;
      this.vocalFilter.gain.setTargetAtTime(vocalGain, now, 0.05);
    }

    if (this.highShelfFilter) {
      const highGain = profile.highShelfGainDb + (s.isStudio ? 2.5 : 0);
      this.highShelfFilter.gain.setTargetAtTime(highGain, now, 0.05);
    }

    if (this.ambienceGain) {
      this.ambienceGain.gain.setTargetAtTime(profile.ambienceWet, now, 0.05);
    }

    if (this.masterGain) {
      const targetGain = s.isMuted ? 0 : Math.max(0, Math.min(1.5, s.masterVolume));
      this.masterGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }

    if (this.previewBgmGain && this.isPreviewBgmActive) {
      const preset = s.bgmPreset || 'cinematic_pad';
      if (prevPreset !== preset && this.previewBgmHandle) {
        this.previewBgmHandle.setPreset(preset);
      }
      const targetVol = s.isMuted || preset === 'off' || preset === 'custom'
        ? 0
        : Math.max(0, Math.min(0.45, s.bgmVolume ?? 0.16));
      this.previewBgmGain.gain.setTargetAtTime(targetVol, now, 0.06);
    }
  }

  public getSettings(): AudioDspSettings {
    return { ...this.currentSettings };
  }
}

// Global Singleton
export const ytAudioEngine = new YouTubeSafetyAudioEngine();
