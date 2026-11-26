import { ChannelSettings } from '../types/timeline';
import { ChannelOverlayRenderer } from './channelOverlayRenderer';
import { DecodedExportAudio } from './exportEngine';
import { decodeAudioSourceToPcmTrack } from './lowRamAudioMixer';

/**
 * All 6 user-provided Like/Comment/Subscribe CTA Sound Effect files
 * served locally from /public/assets/aistudio/.
 */
export const CTA_SOUND_EFFECT_URLS: readonly string[] = [
  '/assets/aistudio/dragon-studio-notification-sound-effect-372475_3b6c199a.mp3',
  '/assets/aistudio/dragon-studio-new-notification-3-398649_053a2fe6.mp3',
  '/assets/aistudio/dragon-studio-simple-whoosh-382724_c2efd9d9.mp3',
  '/assets/aistudio/dragon-studio-suspenseful-boom-451863_2fab60e6.mp3',
  '/assets/aistudio/dragon-studio-whoosh-cinematic-376875_ea7eefa6.mp3',
  '/assets/aistudio/universfield-new-notification-051-494246_b1559967.mp3'
];

interface CachedPcm {
  L: Float32Array;
  R: Float32Array;
  sampleRate: number;
}

class CtaSoundService {
  private liveAudioCtx: AudioContext | null = null;
  private liveBuffers: Map<string, AudioBuffer> = new Map();
  private liveLoadPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private activeHtmlAudio: Set<HTMLAudioElement> = new Set();
  private exportPcmCache: Map<string, CachedPcm> = new Map();

  private getOrCreateLiveAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.liveAudioCtx || this.liveAudioCtx.state === 'closed') {
      this.liveAudioCtx = new AudioCtx();
    }
    if (this.liveAudioCtx.state === 'suspended') {
      this.liveAudioCtx.resume().catch(() => {});
    }
    return this.liveAudioCtx;
  }

  private loadLiveBuffer(url: string): Promise<AudioBuffer | null> {
    const existing = this.liveBuffers.get(url);
    if (existing) return Promise.resolve(existing);

    const pending = this.liveLoadPromises.get(url);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const ctx = this.getOrCreateLiveAudioContext();
        if (!ctx) return null;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const arr = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr.slice(0));
        this.liveBuffers.set(url, decoded);
        return decoded;
      } catch (err) {
        console.warn('CTA SFX preload failed:', url, err);
        return null;
      } finally {
        this.liveLoadPromises.delete(url);
      }
    })();

    this.liveLoadPromises.set(url, promise);
    return promise;
  }

  /** Preload all 6 CTA sound effect MP3s into memory for instant zero-lag playback */
  public preloadAll(): void {
    if (typeof window === 'undefined') return;
    for (const url of CTA_SOUND_EFFECT_URLS) {
      void this.loadLiveBuffer(url);
    }
  }

  /** Unlock WebAudio context on user Play click */
  public unlock(): void {
    const ctx = this.getOrCreateLiveAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.preloadAll();
  }

  /** Stop any currently ringing CTA sound effects (e.g. on pause, mute, seek, tab switch) */
  public stopAllLive(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources.clear();

    for (const el of this.activeHtmlAudio) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch (_) {}
    }
    this.activeHtmlAudio.clear();
  }

  /** Get the sound effect URL assigned to a CTA cycle index (rotates through all 6 uploaded SFX) */
  public getSfxUrlForCycle(cycleIndex: number): string {
    const idx = ((cycleIndex % CTA_SOUND_EFFECT_URLS.length) + CTA_SOUND_EFFECT_URLS.length) % CTA_SOUND_EFFECT_URLS.length;
    return CTA_SOUND_EFFECT_URLS[idx];
  }

  /** Play the CTA sound effect for a specific popup cycle during live preview */
  public playForCycle(cycleIndex: number, volume = 0.85): void {
    if (typeof window === 'undefined') return;
    const url = this.getSfxUrlForCycle(cycleIndex);
    const safeVol = Math.max(0, Math.min(1, volume));
    if (safeVol <= 0) return;

    const ctx = this.getOrCreateLiveAudioContext();
    const cached = this.liveBuffers.get(url);

    if (ctx && cached) {
      try {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const source = ctx.createBufferSource();
        source.buffer = cached;
        const gain = ctx.createGain();
        gain.gain.value = safeVol;
        source.connect(gain);
        gain.connect(ctx.destination);
        this.activeSources.add(source);
        source.onended = () => {
          this.activeSources.delete(source);
          try {
            source.disconnect();
            gain.disconnect();
          } catch (_) {}
        };
        source.start(0);
        return;
      } catch (_) {}
    }

    // Fallback: HTMLAudioElement + background WebAudio decode for subsequent cycles
    void this.loadLiveBuffer(url);
    try {
      const audio = new Audio(url);
      audio.volume = safeVol;
      this.activeHtmlAudio.add(audio);
      audio.onended = () => this.activeHtmlAudio.delete(audio);
      audio.onerror = () => this.activeHtmlAudio.delete(audio);
      audio.play().catch(() => {
        this.activeHtmlAudio.delete(audio);
      });
    } catch (_) {}
  }

  /**
   * Compute every exact CTA popup onset timestamp & cycle index matching
   * ChannelOverlayRenderer.renderCtaPopup(ctx, settings, time, w, h).
   */
  public getCtaOnsetEvents(
    settings: ChannelSettings | undefined,
    totalDuration: number
  ): Array<{ time: number; cycleIndex: number }> {
    if (!settings || settings.ctaEnabled === false || totalDuration <= 2.0) {
      return [];
    }

    const interval = Math.max(5, settings.ctaIntervalSeconds ?? 15);
    const events: Array<{ time: number; cycleIndex: number }> = [];

    // First popup appears at t = 2.0s (cycleIndex = 0) because renderCtaPopup skips time < 2.0
    if (totalDuration > 2.0 && ChannelOverlayRenderer.getActiveCtaCycle(settings, 2.001) === 0) {
      events.push({ time: 2.0, cycleIndex: 0 });
    }

    // Subsequent popups appear at t = k * interval (cycleIndex = k)
    for (let k = 1; ; k++) {
      const onset = k * interval;
      if (onset >= totalDuration) break;
      if (ChannelOverlayRenderer.getActiveCtaCycle(settings, onset + 0.001) !== null) {
        events.push({ time: onset, cycleIndex: k });
      }
    }

    return events;
  }

  private async decodeSfxForExport(url: string, sampleRate = 48000): Promise<CachedPcm | null> {
    const cacheKey = `${url}@${sampleRate}`;
    const existing = this.exportPcmCache.get(cacheKey);
    if (existing) return existing;

    try {
      const track = await decodeAudioSourceToPcmTrack(url, {
        targetSampleRate: sampleRate,
        forceMono: false,
      });
      const a = track.channels[0];
      const b = track.channels.length > 1 ? track.channels[1] : a;
      if (!a || a.length === 0) return null;
      const pcm: CachedPcm = { L: a, R: b || a, sampleRate };
      this.exportPcmCache.set(cacheKey, pcm);
      return pcm;
    } catch (err) {
      console.warn('Export SFX decode failed:', url, err);
      return null;
    }
  }

  /**
   * Mix all CTA popup sound effects into the 48kHz stereo PCM buffer for MP4 export.
   * If `baseAudio` is null and CTA popups are enabled, creates a clean 48kHz stereo track
   * containing the CTA sound effects at exact popup timestamps.
   */
  public async mixCtaSfxIntoExportAudio(
    baseAudio: DecodedExportAudio | null,
    settings: ChannelSettings | undefined,
    totalDuration: number,
    sfxVolume = 0.85,
    sampleRate = 48000
  ): Promise<DecodedExportAudio | null> {
    const events = this.getCtaOnsetEvents(settings, totalDuration);
    if (events.length === 0) {
      return baseAudio;
    }

    const totalSamples = baseAudio
      ? baseAudio.L.length
      : Math.max(1, Math.floor(totalDuration * sampleRate));
    const sr = baseAudio ? baseAudio.sampleRate : sampleRate;

    const L = baseAudio ? baseAudio.L : new Float32Array(totalSamples);
    const R = baseAudio ? baseAudio.R : new Float32Array(totalSamples);

    // Decode only the unique SFX URLs actually needed for this video's CTA events
    const uniqueUrls = Array.from(new Set(events.map((e) => this.getSfxUrlForCycle(e.cycleIndex))));
    const decodedMap = new Map<string, CachedPcm>();
    await Promise.all(
      uniqueUrls.map(async (url) => {
        const pcm = await this.decodeSfxForExport(url, sr);
        if (pcm) decodedMap.set(url, pcm);
      })
    );

    if (decodedMap.size === 0) {
      return baseAudio;
    }

    const gain = Math.max(0, Math.min(1, sfxVolume));
    for (const ev of events) {
      const url = this.getSfxUrlForCycle(ev.cycleIndex);
      const sfx = decodedMap.get(url);
      if (!sfx) continue;

      const startIdx = Math.max(0, Math.floor(ev.time * sr));
      const mixLen = Math.min(sfx.L.length, totalSamples - startIdx);
      for (let i = 0; i < mixLen; i++) {
        const idx = startIdx + i;
        const mixedL = L[idx] + sfx.L[i] * gain;
        const mixedR = R[idx] + sfx.R[i] * gain;
        L[idx] = mixedL > 1 ? 1 : mixedL < -1 ? -1 : mixedL;
        R[idx] = mixedR > 1 ? 1 : mixedR < -1 ? -1 : mixedR;
      }
    }

    return { L, R, sampleRate: sr };
  }

  /** Free decoded export SFX PCM buffers after MP4 export completes */
  public clearExportCache(): void {
    this.exportPcmCache.clear();
  }

  /** Free decoded live WebAudio buffers when leaving preview/video tab */
  public clearLiveBuffers(): void {
    this.stopAllLive();
    this.liveBuffers.clear();
    this.liveLoadPromises.clear();
  }
}

export const ctaSoundService = new CtaSoundService();
