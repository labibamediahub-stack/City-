/*  exportEngine.ts — ফ্রেম-বাই-ফ্রেম MP4 এক্সপোর্ট (WebCodecs H.264 + AAC + mp4-muxer)
 *  লো-র‍্যাম স্ট্রিমিং মোড: OPFS ডিস্ক স্ট্রিম অথবা ৪MB পেজড ব্লব — ১৫ থেকে ৩৫+ মিনিটের ভিডিও ক্র্যাশ ছাড়াই এক্সপোর্ট হয়।
 */
import { Muxer, StreamTarget } from 'mp4-muxer';
import { decodeAudioSourceToPcmTrack } from './lowRamAudioMixer';
import { getRenderPerformanceFlags } from './devicePerformance';

export async function pickSupportedAudioSampleRate(preferredRate = 48000): Promise<number> {
  if (typeof window === 'undefined' || !('AudioEncoder' in window)) return 48000;
  const candidates = Array.from(new Set([preferredRate, 32000, 48000]));
  for (const rate of candidates) {
    for (const codec of ['mp4a.40.2', 'opus']) {
      try {
        const res = await AudioEncoder.isConfigSupported({
          codec,
          sampleRate: rate,
          numberOfChannels: 2,
          bitrate: 128000
        });
        if (res.supported) return rate;
      } catch (_) {}
    }
  }
  return 48000;
}

const yieldNow = () =>
  new Promise<void>((r) => {
    const c = new MessageChannel();
    c.port1.onmessage = () => {
      c.port1.close();
      r();
    };
    c.port2.postMessage(0);
  }); // ব্যাকগ্রাউন্ড ট্যাবে থ্রটল হয় না

const waitDequeue = (enc: VideoEncoder | AudioEncoder) =>
  new Promise<void>((r) => {
    let d = 0;
    const f = () => {
      if (!d) {
        d = 1;
        r();
      }
    };
    enc.addEventListener('dequeue', f, { once: true });
    setTimeout(f, 50);
  });

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

const MUX_PAGE_SIZE = 4 * 1024 * 1024; // 4 MiB chunk pages (eliminates 1-2GB contiguous ArrayBuffer OOM)

interface StreamingMp4Sink {
  write: (data: Uint8Array, position: number) => void;
  finalizeBlob: () => Promise<Blob>;
  cleanup: () => Promise<void>;
}

/** Try disk-backed OPFS FileSystemWritableFileStream first (0 MB JS RAM); fallback to 4MB paged Blob store */
async function createLowRamMp4Sink(): Promise<StreamingMp4Sink> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
      const root = await navigator.storage.getDirectory();
      // Remove stale temp files from any previous crashed/completed runs to keep quota clean
      try {
        const entries = (root as unknown as { entries?: () => AsyncIterable<[string, FileSystemHandle]> }).entries?.();
        if (entries) {
          for await (const [name] of entries) {
            if (name.startsWith('export_tmp_') && name.endsWith('.mp4')) {
              await root.removeEntry(name).catch(() => {});
            }
          }
        }
      } catch (_) {}

      const tempName = `export_tmp_${Date.now()}.mp4`;
      const fileHandle = await root.getFileHandle(tempName, { create: true });
      if (typeof fileHandle.createWritable === 'function') {
        const writable = await fileHandle.createWritable();
        let writeChain: Promise<void> = Promise.resolve();
        let writeError: unknown = null;

        return {
          write: (data, position) => {
            const copy = data.slice();
            writeChain = writeChain
              .then(async () => {
                await writable.write({ type: 'write', position, data: copy });
              })
              .catch((e) => {
                if (!writeError) writeError = e;
              });
          },
          finalizeBlob: async () => {
            await writeChain;
            if (writeError) throw writeError;
            await writable.close();
            return await fileHandle.getFile();
          },
          cleanup: async () => {
            try {
              await writable.abort().catch(() => {});
            } catch (_) {}
            try {
              await root.removeEntry(tempName).catch(() => {});
            } catch (_) {}
          }
        };
      }
    }
  } catch (_) {
    // Fallback to paged in-memory/blob sink when OPFS is unavailable (e.g., private mode)
  }

  // Fallback: 4 MiB paged Blob store (never allocates a single giant contiguous 1GB+ ArrayBuffer)
  const pages = new Map<number, Blob | Uint8Array<ArrayBuffer>>();
  let totalBytesWritten = 0;
  let patchQueue: Promise<void> = Promise.resolve();

  const writeSyncOrQueued = (data: Uint8Array, position: number) => {
    let offset = 0;
    while (offset < data.byteLength) {
      const curPos = position + offset;
      const pageIdx = Math.floor(curPos / MUX_PAGE_SIZE);
      const pageOff = curPos % MUX_PAGE_SIZE;
      const spaceInPage = MUX_PAGE_SIZE - pageOff;
      const take = Math.min(spaceInPage, data.byteLength - offset);
      const slice = data.subarray(offset, offset + take);

      const existing = pages.get(pageIdx);
      if (pageIdx === 0) {
        let buf = existing instanceof Uint8Array ? existing : undefined;
        if (!buf) {
          buf = new Uint8Array(MUX_PAGE_SIZE);
          pages.set(0, buf);
        }
        buf.set(slice, pageOff);
      } else if (!existing && pageOff === 0) {
        if (take === MUX_PAGE_SIZE) {
          pages.set(pageIdx, new Blob([slice.slice()]));
        } else {
          const buf = new Uint8Array(MUX_PAGE_SIZE);
          buf.set(slice, 0);
          pages.set(pageIdx, buf);
        }
      } else if (existing instanceof Uint8Array) {
        existing.set(slice, pageOff);
        if (pageOff + take === MUX_PAGE_SIZE) {
          pages.set(pageIdx, new Blob([existing]));
        }
      } else if (existing instanceof Blob) {
        const capturedSlice = slice.slice();
        const capturedOff = pageOff;
        const capturedIdx = pageIdx;
        patchQueue = patchQueue.then(async () => {
          const prev = pages.get(capturedIdx);
          const arr = new Uint8Array(
            prev instanceof Blob ? await prev.arrayBuffer() : (prev || new Uint8Array(MUX_PAGE_SIZE))
          );
          const full = new Uint8Array(MUX_PAGE_SIZE);
          full.set(arr.subarray(0, MUX_PAGE_SIZE));
          full.set(capturedSlice, capturedOff);
          pages.set(capturedIdx, new Blob([full]));
        });
      } else {
        const buf = new Uint8Array(MUX_PAGE_SIZE);
        buf.set(slice, pageOff);
        pages.set(pageIdx, buf);
      }

      totalBytesWritten = Math.max(totalBytesWritten, curPos + take);
      offset += take;
    }
  };

  return {
    write: (data, position) => {
      const copy = data.slice();
      patchQueue = patchQueue.then(() => {
        writeSyncOrQueued(copy, position);
      });
    },
    finalizeBlob: async () => {
      await patchQueue;
      const parts: BlobPart[] = [];
      const pageCount = Math.ceil(totalBytesWritten / MUX_PAGE_SIZE);
      for (let p = 0; p < pageCount; p++) {
        const entry = pages.get(p);
        const expectedLen =
          p === pageCount - 1
            ? totalBytesWritten - p * MUX_PAGE_SIZE
            : MUX_PAGE_SIZE;
        if (!entry) {
          parts.push(new Uint8Array(expectedLen));
        } else if (entry instanceof Blob) {
          parts.push(entry.size > expectedLen ? entry.slice(0, expectedLen) : entry);
        } else {
          parts.push(new Blob([entry.subarray(0, expectedLen)]));
        }
      }
      pages.clear();
      return new Blob(parts, { type: 'video/mp4' });
    },
    cleanup: async () => {
      pages.clear();
    }
  };
}

export interface DecodedExportAudio {
  L: Float32Array;
  R: Float32Array;
  sampleRate: number;
}

export interface ExportProgressData {
  percent: number;
  frame: number;
  total: number;
  elapsed: number;
  eta: number;
  drawMs: number;
  fps: number;
  state: 'rendering' | 'paused' | 'finalizing' | 'done';
}

export interface ExportEngineOptions {
  width: number;
  height: number;
  fps?: number;
  duration: number;
  draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, t: number, i: number) => void | Promise<void>;
  audio?: DecodedExportAudio | null;
  videoBitrate?: number;
  audioBitrate?: number;
  onProgress?: (p: ExportProgressData) => void;
}

/** অডিও ফাইল/Blob -> 48kHz স্টেরিও Float32Array (ডাবল মেমোরি অ্যালোকেশন ছাড়া, প্রয়োজনে 24kHz লো-র‍্যাম ফলব্যাক সহ) */
export async function decodeAudio(blob: Blob, duration: number, sampleRate = 48000): Promise<DecodedExportAudio> {
  const buildFromRate = async (targetSr: number): Promise<DecodedExportAudio> => {
    const n = Math.max(1, Math.floor(duration * targetSr));
    const track = await decodeAudioSourceToPcmTrack(blob, {
      targetSampleRate: targetSr,
      forceMono: false,
    });
    const src0 = track.channels[0];
    if (!src0 || track.length <= 0) {
      throw new Error('অডিও ফাইল থেকে কোনো শব্দ পাওয়া যায়নি।');
    }
    const src1 = track.channels.length > 1 ? track.channels[1] : null;
    // Free original channel references after building output arrays so peak RAM never doubles
    track.channels = [];

    if (src0.length >= n) {
      const L = src0.length === n ? src0 : src0.subarray(0, n);
      const R = src1
        ? (src1.length === n ? src1 : src1.subarray(0, n))
        : L.slice(0, n); // Distinct buffer so gain/humanizer/SFX never double-applies on mono tracks
      return { L, R, sampleRate: targetSr };
    }

    const copyLen = Math.min(n, src0.length);
    const L = new Float32Array(n);
    L.set(src0.subarray(0, copyLen));
    const R = new Float32Array(n);
    R.set((src1 || src0).subarray(0, copyLen));
    return { L, R, sampleRate: targetSr };
  };

  try {
    return await buildFromRate(sampleRate);
  } catch (err: any) {
    const msg = String(err?.message || err || '').toLowerCase();
    const isMemoryErr =
      err instanceof RangeError ||
      msg.includes('memory') ||
      msg.includes('allocation') ||
      msg.includes('সীমা অতিক্রম');
    if (sampleRate > 24000 && isMemoryErr) {
      return await buildFromRate(24000);
    }
    throw err;
  }
}

export function triggerDownloadBlob(blob: Blob, filename: string, existingUrl?: string): string {
  if (!blob || blob.size === 0) return '';
  const url = existingUrl || URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) a.parentNode.removeChild(a);
      } catch (_) {}
    }, 5000);
  } catch (_) {}
  return url;
}

export class ExportEngine {
  W: number;
  H: number;
  fps: number;
  dur: number;
  draw: ExportEngineOptions['draw'];
  audio: DecodedExportAudio | null;
  onProgress: (p: ExportProgressData) => void;
  vBitrate: number;
  aBitrate: number;
  paused: boolean;
  cancelled: boolean;

  constructor(o: ExportEngineOptions) {
    this.W = even(o.width);
    this.H = even(o.height);
    this.fps = o.fps || 30;
    this.dur = o.duration;
    this.draw = o.draw;
    this.audio = o.audio || null;
    this.onProgress = o.onProgress || (() => {});
    const minDim = Math.min(this.W, this.H);
    const defaultBitrate =
      minDim >= 1080
        ? 8000000
        : minDim >= 700
        ? this.dur > 600
          ? 3200000
          : 4200000
        : minDim >= 520
        ? this.dur > 600
          ? 2200000
          : 2600000
        : this.dur > 600
        ? 1650000
        : 2000000;
    this.vBitrate = o.videoBitrate || defaultBitrate;
    this.aBitrate = o.audioBitrate || 128000;
    this.paused = false;
    this.cancelled = false;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  cancel() {
    this.cancelled = true;
  }

  /** এই ডিভাইসে কোন কোডেক চলবে তা বের করে; না চললে null */
  async pickCodec(): Promise<VideoEncoderConfig | null> {
    const { W, H, fps } = this;
    for (const hw of ['prefer-hardware', 'no-preference'] as const) {
      for (const codec of ['avc1.640028', 'avc1.4d002a', 'avc1.42002a']) {
        const cfg: VideoEncoderConfig = {
          codec,
          width: W,
          height: H,
          bitrate: this.vBitrate,
          framerate: fps,
          hardwareAcceleration: hw
        };
        try {
          if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg;
        } catch (_) {}
      }
    }
    return null;
  }

  async run(): Promise<Blob> {
    if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
      throw new Error('এই ব্রাউজার WebCodecs সমর্থন করে না — Chrome/Edge ব্যবহার করুন');
    }
    const vcfg = await this.pickCodec();
    if (!vcfg) throw new Error('H.264 এনকোডার পাওয়া যায়নি');

    const { W, H, fps } = this;
    const total = Math.ceil(this.dur * fps);
    let audioRef = this.audio;
    let acodec: string | null = null;
    if (audioRef) {
      for (const c of ['mp4a.40.2', 'opus']) {
        try {
          if (
            (
              await AudioEncoder.isConfigSupported({
                codec: c,
                sampleRate: audioRef.sampleRate,
                numberOfChannels: 2,
                bitrate: this.aBitrate
              })
            ).supported
          ) {
            acodec = c;
            break;
          }
        } catch (_) {}
      }
    }
    if (audioRef && !acodec) throw new Error('অডিও এনকোডার পাওয়া যায়নি');

    const sink = await createLowRamMp4Sink();

    const mux = new Muxer({
      target: new StreamTarget({
        chunked: true,
        chunkSize: MUX_PAGE_SIZE,
        onData: (data, position) => {
          sink.write(data, position);
        }
      }),
      fastStart: false,
      firstTimestampBehavior: 'offset',
      video: { codec: 'avc', width: W, height: H },
      ...(audioRef
        ? {
            audio: {
              codec: acodec === 'opus' ? 'opus' : 'aac',
              numberOfChannels: 2,
              sampleRate: audioRef.sampleRate
            }
          }
        : {})
    });

    let err: unknown = null;
    let ve: VideoEncoder | null = null;
    let ae: AudioEncoder | null = null;
    let exportCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
    const t0 = performance.now();
    let finalizedCleanly = false;

    try {
      ve = new VideoEncoder({
        output: (c, m) => mux.addVideoChunk(c, m),
        error: (e) => {
          err = e;
        }
      });
      ve.configure(vcfg);

      // ---- অডিও: ১ সেকেন্ডের টুকরোয় এনকোড করে সাথে সাথে মেমরি ফ্রি ----
      if (audioRef && acodec) {
        let audioChunksMuxed = 0;
        ae = new AudioEncoder({
          output: (c, m) => {
            audioChunksMuxed++;
            mux.addAudioChunk(c, m);
          },
          error: (e) => {
            err = e;
          }
        });
        ae.configure({
          codec: acodec,
          sampleRate: audioRef.sampleRate,
          numberOfChannels: 2,
          bitrate: this.aBitrate
        });
        for (let o = 0; o < audioRef.L.length; o += audioRef.sampleRate) {
          if (this.cancelled) throw new Error('CANCEL');
          if (err) throw err;
          const n = Math.min(audioRef.sampleRate, audioRef.L.length - o);
          const d = new Float32Array(n * 2);
          d.set(audioRef.L.subarray(o, o + n), 0);
          d.set(audioRef.R.subarray(o, o + n), n);
          const ad = new AudioData({
            format: 'f32-planar',
            sampleRate: audioRef.sampleRate,
            numberOfFrames: n,
            numberOfChannels: 2,
            timestamp: Math.round((o / audioRef.sampleRate) * 1e6),
            data: d
          });
          ae.encode(ad);
          ad.close();
          while (ae.encodeQueueSize > 6) await waitDequeue(ae);
        }
        await ae.flush();
        if (err) throw err;
        if (audioChunksMuxed === 0) {
          throw new Error('অডিও এনকোডার থেকে কোনো অডিও ডেটা তৈরি হয়নি।');
        }
        try {
          ae.close();
        } catch (_) {}
        ae = null;
      }

      // Release giant audio PCM arrays BEFORE video rendering starts!
      audioRef = null;
      this.audio = null;

      // ---- ভিডিও ফ্রেম ----
      const cv =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(W, H)
          : Object.assign(document.createElement('canvas'), { width: W, height: H });
      exportCanvas = cv;
      const ctx = cv.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      let drawSum = 0;
      const yieldBudgetMs = getRenderPerformanceFlags().exportYieldBudgetMs;
      let lastYieldAt = performance.now();
      let lastProgressAt = 0;

      for (let i = 0; i < total; i++) {
        if (err) throw err;
        while (this.paused && !this.cancelled) {
          this.onProgress({
            percent: (i / total) * 100,
            frame: i,
            total,
            elapsed: (performance.now() - t0) / 1e3,
            eta: 0,
            drawMs: drawSum / Math.max(1, i),
            fps: 0,
            state: 'paused'
          });
          await new Promise((r) => setTimeout(r, 120));
          lastYieldAt = performance.now();
        }
        if (this.cancelled) throw new Error('CANCEL');

        const d0 = performance.now();
        await this.draw(ctx, Math.min(i / fps, this.dur - 0.001), i);
        const frameDrawMs = performance.now() - d0;
        drawSum += frameDrawMs;

        const fr = new VideoFrame(cv, {
          timestamp: Math.round((i * 1e6) / fps),
          duration: Math.round(1e6 / fps)
        });
        ve.encode(fr, { keyFrame: i % (fps * 2) === 0 });
        fr.close();
        while (ve.encodeQueueSize > 4) await waitDequeue(ve);

        const now = performance.now();
        if (now - lastProgressAt >= 150 || i === total - 1) {
          lastProgressAt = now;
          const el = Math.max(0.05, (now - t0) / 1e3);
          const p = (i + 1) / total;
          this.onProgress({
            percent: p * 100,
            frame: i + 1,
            total,
            elapsed: el,
            eta: el * (1 - p) / p,
            drawMs: drawSum / (i + 1),
            fps: (i + 1) / el,
            state: 'rendering'
          });
        }

        if (now - lastYieldAt >= yieldBudgetMs || frameDrawMs > 22) {
          await yieldNow();
          lastYieldAt = performance.now();
        }
      }

      this.onProgress({
        percent: 99,
        frame: total,
        total,
        elapsed: (performance.now() - t0) / 1e3,
        eta: 0,
        drawMs: drawSum / Math.max(1, total),
        fps: 0,
        state: 'finalizing'
      });
      await ve.flush();
      if (err) throw err;
      mux.finalize();
      const finalBlob = await sink.finalizeBlob();
      finalizedCleanly = true;

      this.onProgress({
        percent: 100,
        frame: total,
        total,
        elapsed: (performance.now() - t0) / 1e3,
        eta: 0,
        drawMs: drawSum / Math.max(1, total),
        fps: 0,
        state: 'done'
      });
      return finalBlob;
    } finally {
      this.audio = null;
      if (exportCanvas) {
        try {
          exportCanvas.width = 0;
          exportCanvas.height = 0;
        } catch (_) {}
        exportCanvas = null;
      }
      try {
        if (ve) ve.close();
      } catch (_) {}
      try {
        if (ae) ae.close();
      } catch (_) {}
      if (!finalizedCleanly) {
        await sink.cleanup().catch(() => {});
      }
    }
  }
}
