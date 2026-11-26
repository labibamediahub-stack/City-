import { TimelineSlot, TransitionType, RenderContext, ColorGradingPreset, ChannelLayoutMode } from '../types/timeline';
import { getAnimationById, setActiveRenderContext } from './animationLibrary';
import { BackgroundFxRenderer } from './backgroundFxRenderer';
import { CinematicFxRenderer } from './cinematicFxRenderer';
import { CinematicOverlayRenderer } from './cinematicOverlayRenderer';
import { getEffectiveChannelFingerprint } from './channelDnaPresets';
import { getRenderPerformanceFlags } from './devicePerformance';

export class CanvasTimelineRenderer {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private videoCache: Map<string, HTMLVideoElement> = new Map();
  private offscreenCanvasA: HTMLCanvasElement;
  private offscreenCanvasB: HTMLCanvasElement;
  private offscreenCtxA: CanvasRenderingContext2D | null;
  private offscreenCtxB: CanvasRenderingContext2D | null;
  private layoutScratchCanvas: HTMLCanvasElement;
  private layoutScratchCtx: CanvasRenderingContext2D | null;
  private blurScratchCanvas: HTMLCanvasElement;
  private blurScratchCtx: CanvasRenderingContext2D | null;
  private lastPreparedWindowKey = '';
  private lastRenderedImage: HTMLImageElement | null = null;
  private readonly maxImageCache: number;
  private readonly disableAsyncRedraw: boolean;

  constructor(options?: { maxImageCache?: number; disableAsyncRedraw?: boolean }) {
    this.maxImageCache = Math.max(8, options?.maxImageCache ?? 18);
    this.disableAsyncRedraw = Boolean(options?.disableAsyncRedraw);
    this.offscreenCanvasA = document.createElement('canvas');
    this.offscreenCanvasB = document.createElement('canvas');
    this.layoutScratchCanvas = document.createElement('canvas');
    this.blurScratchCanvas = document.createElement('canvas');
    this.offscreenCanvasA.width = 1280;
    this.offscreenCanvasA.height = 720;
    this.offscreenCanvasB.width = 1280;
    this.offscreenCanvasB.height = 720;
    this.layoutScratchCanvas.width = 1280;
    this.layoutScratchCanvas.height = 720;
    this.blurScratchCanvas.width = 160;
    this.blurScratchCanvas.height = 90;
    this.offscreenCtxA = this.offscreenCanvasA.getContext('2d');
    this.offscreenCtxB = this.offscreenCanvasB.getContext('2d');
    this.layoutScratchCtx = this.layoutScratchCanvas.getContext('2d');
    this.blurScratchCtx = this.blurScratchCanvas.getContext('2d');
  }

  private evictOldestImageIfNeeded(protectedKeys?: Set<string>): void {
    while (this.imageCache.size > this.maxImageCache) {
      let keyToDelete: string | undefined;
      for (const k of this.imageCache.keys()) {
        if (!protectedKeys || !protectedKeys.has(k)) {
          keyToDelete = k;
          break;
        }
      }
      if (!keyToDelete) {
        keyToDelete = this.imageCache.keys().next().value;
      }
      if (!keyToDelete) break;
      const oldImg = this.imageCache.get(keyToDelete);
      this.imageCache.delete(keyToDelete);
      if (oldImg && oldImg !== this.lastRenderedImage) {
        try {
          oldImg.src = '';
        } catch (_) {}
      }
    }
  }

  public clearCache(): void {
    for (const img of this.imageCache.values()) {
      try {
        img.src = '';
      } catch (_) {}
    }
    this.imageCache.clear();
    for (const vid of this.videoCache.values()) {
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      } catch (_) {}
    }
    this.videoCache.clear();
    this.lastRenderedImage = null;
    this.lastPreparedWindowKey = '';
  }

  public dispose(): void {
    this.clearCache();
    try {
      this.offscreenCanvasA.width = 0;
      this.offscreenCanvasA.height = 0;
      this.offscreenCanvasB.width = 0;
      this.offscreenCanvasB.height = 0;
      this.layoutScratchCanvas.width = 0;
      this.layoutScratchCanvas.height = 0;
      this.blurScratchCanvas.width = 0;
      this.blurScratchCanvas.height = 0;
    } catch (_) {}
  }

  private decodeSingleImage(dataUrl: string): Promise<HTMLImageElement | null> {
    const existing = this.imageCache.get(dataUrl);
    if (existing) {
      this.imageCache.delete(dataUrl);
      this.imageCache.set(dataUrl, existing);
      if (existing.complete && existing.naturalWidth > 0) {
        return Promise.resolve(existing);
      }
    }

    return new Promise<HTMLImageElement | null>((resolve) => {
      let settled = false;
      const img = existing || new Image();
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(img.naturalWidth > 0 ? img : null);
      };
      const timer = setTimeout(done, 1500);

      if (!existing) {
        if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
          img.crossOrigin = 'anonymous';
        }
        this.imageCache.set(dataUrl, img);
        this.evictOldestImageIfNeeded();
        img.src = dataUrl;
      }

      if (img.complete && img.naturalWidth > 0) {
        done();
        return;
      }

      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });

      if (typeof img.decode === 'function') {
        img.decode().then(done).catch(done);
      }
    });
  }

  /**
   * Pre-load ONLY the initial window of slots (never decodes 300+ images at once!)
   */
  public async preloadImages(slots: TimelineSlot[]): Promise<void> {
    if (!slots || slots.length === 0) return;
    const initialCount = Math.min(slots.length, Math.min(12, this.maxImageCache));
    const promises: Promise<HTMLImageElement | null>[] = [];
    for (let i = 0; i < initialCount; i++) {
      promises.push(this.decodeSingleImage(slots[i].dataUrl));
    }
    await Promise.all(promises);
  }

  /**
   * Low-RAM sliding window pre-decoder for sequential video export.
   * Ensures active slot, transition target, and ±2 neighbor images are decoded in O(1) memory.
   */
  public async prepareWindowForTime(slots: TimelineSlot[], time: number): Promise<void> {
    if (!slots || slots.length === 0) return;
    const totalDur = slots[slots.length - 1].endTime;
    const clampedTime = Math.max(0, Math.min(totalDur, time));

    let activeIdx = -1;
    for (let i = 0; i < slots.length; i++) {
      if (clampedTime >= slots[i].startTime && clampedTime <= slots[i].endTime) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx === -1) {
      activeIdx = slots.findIndex((s) => clampedTime <= s.endTime);
      if (activeIdx === -1) activeIdx = slots.length - 1;
    }

    const windowKey = `${slots.length}:${activeIdx}:${slots[activeIdx]?.dataUrl?.slice(0, 40) || ''}`;
    const activeSlot = slots[activeIdx];
    if (activeSlot?.isIntroVideo && activeSlot.videoUrl && this.disableAsyncRedraw) {
      const vid = this.getVideo(activeSlot.videoUrl);
      const inSlotTime = Math.max(0, Math.min(activeSlot.duration, clampedTime - activeSlot.startTime));
      const targetVidTime = Math.max(0, (activeSlot.introSourceStartTime || 0) + inSlotTime);
      await this.ensureVideoFrameAtTime(vid, targetVidTime);
    }

    if (windowKey === this.lastPreparedWindowKey) {
      const curUrl = slots[activeIdx]?.dataUrl;
      const curImg = curUrl ? this.imageCache.get(curUrl) : null;
      if (!curUrl || (curImg && curImg.complete && curImg.naturalWidth > 0)) {
        return;
      }
    }
    this.lastPreparedWindowKey = windowKey;

    const windowIndices = new Set<number>([
      activeIdx,
      (activeIdx + 1) % slots.length,
      (activeIdx + 2) % slots.length,
      (activeIdx - 1 + slots.length) % slots.length,
      (activeIdx - 2 + slots.length) % slots.length,
    ]);

    const protectedKeys = new Set<string>();
    const pending: Promise<HTMLImageElement | null>[] = [];
    for (const idx of windowIndices) {
      const url = slots[idx]?.dataUrl;
      if (!url) continue;
      protectedKeys.add(url);
      const cached = this.imageCache.get(url);
      if (cached && cached.complete && cached.naturalWidth > 0) {
        // Touch MRU
        this.imageCache.delete(url);
        this.imageCache.set(url, cached);
      } else {
        pending.push(this.decodeSingleImage(url));
      }
    }

    if (pending.length > 0) {
      await Promise.all(pending);
    }
    this.evictOldestImageIfNeeded(protectedKeys);
  }

  /**
   * Retrieve cached image or initiate asynchronous load with callback
   */
  public getImage(dataUrl: string, onReady?: () => void): HTMLImageElement {
    let img = this.imageCache.get(dataUrl);

    if (!img) {
      img = new Image();
      if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      this.imageCache.set(dataUrl, img);
      this.evictOldestImageIfNeeded();

      if (onReady && !this.disableAsyncRedraw) {
        const handleReady = () => onReady();
        img.addEventListener('load', handleReady, { once: true });
        if (typeof img.decode === 'function') {
          img.decode().then(handleReady).catch(() => {});
        }
      }

      img.src = dataUrl;
    } else {
      // Refresh MRU position
      this.imageCache.delete(dataUrl);
      this.imageCache.set(dataUrl, img);
      if (onReady && !this.disableAsyncRedraw && (!img.complete || img.naturalWidth === 0)) {
        const handleReady = () => onReady();
        img.addEventListener('load', handleReady, { once: true });
        if (typeof img.decode === 'function') {
          img.decode().then(handleReady).catch(() => {});
        }
      }
    }

    return img;
  }

  /**
   * Retrieve cached video element or create and preload
   */
  public getVideo(videoUrl: string, onReady?: () => void): HTMLVideoElement {
    let vid = this.videoCache.get(videoUrl);
    if (!vid) {
      vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.src = videoUrl;
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      if (onReady) {
        vid.addEventListener('canplay', () => onReady(), { once: true });
        vid.addEventListener('seeked', () => onReady(), { once: true });
      }
      this.videoCache.set(videoUrl, vid);
    }
    return vid;
  }

  private async ensureVideoFrameAtTime(vid: HTMLVideoElement, targetTime: number): Promise<void> {
    if (vid.readyState < 1) {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          vid.removeEventListener('loadeddata', finish);
          vid.removeEventListener('loadedmetadata', finish);
          vid.removeEventListener('error', finish);
          resolve();
        };
        vid.addEventListener('loadeddata', finish, { once: true });
        vid.addEventListener('loadedmetadata', finish, { once: true });
        vid.addEventListener('error', finish, { once: true });
        window.setTimeout(finish, 1800);
        try {
          if (vid.networkState === 0) vid.load();
        } catch (_) {}
      });
    }

    const clamped =
      vid.duration && isFinite(vid.duration) && vid.duration > 0
        ? Math.max(0, Math.min(Math.max(0, vid.duration - 0.05), targetTime))
        : Math.max(0, targetTime);

    if (Math.abs(vid.currentTime - clamped) <= 0.018 && vid.readyState >= 2) {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const onSeeked = () => {
        if (settled) return;
        settled = true;
        vid.removeEventListener('seeked', onSeeked);
        vid.removeEventListener('error', onSeeked);
        resolve();
      };
      vid.addEventListener('seeked', onSeeked, { once: true });
      vid.addEventListener('error', onSeeked, { once: true });
      try {
        vid.currentTime = clamped;
      } catch (_) {
        onSeeked();
      }
      window.setTimeout(onSeeked, 950);
    });
  }

  private renderIntroVideoSlot(
    ctx: CanvasRenderingContext2D,
    vid: HTMLVideoElement,
    fallbackImg: HTMLImageElement | null,
    slot: TimelineSlot,
    clampedTime: number,
    w: number,
    h: number
  ): void {
    const zoom = Math.max(1.0, Math.min(2.5, slot.introZoom ?? 1.0));
    const pX = Math.max(-50, Math.min(50, slot.introPanX ?? 0));
    const pY = Math.max(-50, Math.min(50, slot.introPanY ?? 0));
    const mirror = Boolean(slot.introMirror);
    const effect = slot.introEffect || 'none';

    const drawSource = (src: CanvasImageSource, srcW: number, srcH: number) => {
      const targetAspect = w / h;
      const srcAspect = srcW / Math.max(1, srcH);
      let baseW = srcW;
      let baseH = srcH;
      if (srcAspect > targetAspect) {
        baseW = srcH * targetAspect;
      } else {
        baseH = srcW / targetAspect;
      }

      const cropW = baseW / zoom;
      const cropH = baseH / zoom;
      const maxShiftX = Math.max(0, srcW - cropW);
      const maxShiftY = Math.max(0, srcH - cropH);
      const sx = Math.max(0, Math.min(maxShiftX, (srcW - cropW) / 2 + (pX / 50) * (maxShiftX / 2)));
      const sy = Math.max(0, Math.min(maxShiftY, (srcH - cropH) / 2 + (pY / 50) * (maxShiftY / 2)));

      ctx.save();
      if (mirror) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(src, sx, sy, cropW, cropH, 0, 0, w, h);
      ctx.restore();
    };

    if (vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
      drawSource(vid, vid.videoWidth, vid.videoHeight);
    } else if (fallbackImg && fallbackImg.complete && fallbackImg.naturalWidth > 0) {
      drawSource(fallbackImg, fallbackImg.naturalWidth, fallbackImg.naturalHeight);
    } else {
      ctx.fillStyle = '#040811';
      ctx.fillRect(0, 0, w, h);
    }

    if (effect !== 'none') {
      if (
        effect === 'warm_golden' ||
        effect === 'vivid_hd' ||
        effect === 'teal_orange' ||
        effect === 'vintage_35mm'
      ) {
        CinematicFxRenderer.applyColorGrading(ctx, effect, w, h);
      } else if (effect === 'cinema_dark') {
        CinematicFxRenderer.applyColorGrading(ctx, 'moody_noir', w, h);
        const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.42)');
        ctx.save();
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      } else if (effect === 'soft_blur_glow') {
        ctx.save();
        const glowAlpha = 0.12 + 0.05 * Math.sin(clampedTime * 2.5);
        const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.1, w * 0.5, h * 0.5, w * 0.65);
        glow.addColorStop(0, `rgba(255, 232, 196, ${glowAlpha.toFixed(3)})`);
        glow.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }
  }

  /**
   * Render frame at exact time `t` onto target canvas
   */
  public renderFrame(
    targetCanvas: HTMLCanvasElement,
    slots: TimelineSlot[],
    time: number,
    bgEffect: string = 'reference_video',
    bgVideoElement?: HTMLVideoElement | null,
    cinematicOptions?: {
      colorGrading?: ColorGradingPreset;
      enableLetterbox?: boolean;
      enableLightLeaks?: boolean;
      enableAmbientBackdrop?: boolean;
      enableFilmGrain?: boolean;
      overlayStyleId?: string;
      layoutMode?: ChannelLayoutMode;
      dramaTitle?: string;
      scheduleLabel?: string;
      channelSlotNumber?: number;
      antiSpamVariationSeed?: number;
    }
  ): void {
    if (!targetCanvas || slots.length === 0) return;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const w = targetCanvas.width || 1280;
    const h = targetCanvas.height || 720;

    // Resize offscreens if needed
    if (this.offscreenCanvasA.width !== w || this.offscreenCanvasA.height !== h) {
      this.offscreenCanvasA.width = w;
      this.offscreenCanvasA.height = h;
      this.offscreenCanvasB.width = w;
      this.offscreenCanvasB.height = h;
      this.layoutScratchCanvas.width = w;
      this.layoutScratchCanvas.height = h;
    }

    const totalDur = slots[slots.length - 1].endTime;
    const clampedTime = Math.max(0, Math.min(totalDur, time));

    // Find active slot index safely
    let slotAIndex = -1;
    for (let i = 0; i < slots.length; i++) {
      if (clampedTime >= slots[i].startTime && clampedTime <= slots[i].endTime) {
        slotAIndex = i;
        break;
      }
    }

    if (slotAIndex === -1) {
      slotAIndex = slots.findIndex((s) => clampedTime <= s.endTime);
      if (slotAIndex === -1) slotAIndex = slots.length - 1;
    }

    const slotA = slots[slotAIndex];
    if (!slotA) return;

    const isLastSlot = slotAIndex === slots.length - 1;
    const nextSlot = !isLastSlot ? slots[slotAIndex + 1] : null;

    // Redraw callback in case image was just initiated or finished decoding (disabled during batch export)
    const triggerRedraw = this.disableAsyncRedraw
      ? undefined
      : () => {
          this.renderFrame(targetCanvas, slots, time, bgEffect, bgVideoElement, cinematicOptions);
        };

    const imgA = this.getImage(slotA.dataUrl, triggerRedraw);
    const isImgAReady = imgA && imgA.complete && imgA.naturalWidth > 0;

    // Check if in transition overlap
    const inTransition = nextSlot && clampedTime >= nextSlot.startTime && clampedTime <= slotA.endTime;
    const imgB = (inTransition && nextSlot) ? this.getImage(nextSlot.dataUrl, triggerRedraw) : null;
    const isImgBReady = imgB && imgB.complete && imgB.naturalWidth > 0;

    const buildContext = (idx: number): RenderContext => {
      return {
        slot: slots[idx],
        slots,
        slotIndex: idx,
        getImage: (url: string) => this.getImage(url, triggerRedraw),
        getNeighborImages: () => {
          const neighbors: HTMLImageElement[] = [];
          if (slots.length <= 1) return neighbors;
          const neighborIndices = [
            (idx - 1 + slots.length) % slots.length,
            (idx + 1) % slots.length,
            (idx + 2) % slots.length,
            (idx - 2 + slots.length) % slots.length
          ];
          for (const nIdx of neighborIndices) {
            const nSlot = slots[nIdx];
            if (nSlot) {
              const nImg = this.getImage(nSlot.dataUrl, triggerRedraw);
              if (nImg && nImg.complete && nImg.naturalWidth > 0) {
                neighbors.push(nImg);
              }
            }
          }
          return neighbors;
        }
      };
    };

    if (!inTransition || !nextSlot || !imgB || !isImgBReady || !this.offscreenCtxA || !this.offscreenCtxB) {
      // Direct render of slot A
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      
      const renderTargetImg = isImgAReady ? imgA : (this.lastRenderedImage || imgA);

      if (cinematicOptions?.enableAmbientBackdrop || bgEffect === 'ambient_blur') {
        CinematicFxRenderer.renderAmbientBackdrop(ctx, renderTargetImg, w, h);
      } else {
        BackgroundFxRenderer.renderBackground(ctx, bgEffect, clampedTime, w, h, bgVideoElement);
      }

      if (slotA.isIntroVideo && slotA.videoUrl) {
        const vidA = this.getVideo(slotA.videoUrl, triggerRedraw);
        const inSlotTime = Math.max(0, Math.min(slotA.duration, clampedTime - slotA.startTime));
        const targetVidTime = Math.max(0, (slotA.introSourceStartTime || 0) + inSlotTime);
        if (!this.disableAsyncRedraw && Math.abs(vidA.currentTime - targetVidTime) > 0.08) {
          vidA.currentTime = targetVidTime;
        }
        this.renderIntroVideoSlot(ctx, vidA, renderTargetImg, slotA, clampedTime, w, h);
      } else {
        const elapsed = Math.max(0, clampedTime - slotA.startTime);
        const progress = Math.min(1.0, elapsed / Math.max(0.1, slotA.duration));
        const anim = getAnimationById(slotA.animationId);

        if (renderTargetImg) {
          const contextA = buildContext(slotAIndex);
          setActiveRenderContext(contextA);
          const fp = cinematicOptions?.channelSlotNumber
            ? getEffectiveChannelFingerprint(
                cinematicOptions.channelSlotNumber,
                cinematicOptions.antiSpamVariationSeed || 0
              )
            : null;
          const breathScale = 1 + 0.004 * Math.sin(clampedTime * 0.45 + (cinematicOptions?.channelSlotNumber || 1));
          ctx.save();
          if (fp) {
            ctx.translate(w / 2 + fp.panX, h / 2 + fp.panY);
            ctx.scale(fp.zoomBias * breathScale, fp.zoomBias * breathScale);
            ctx.translate(-w / 2, -h / 2);
          } else {
            ctx.translate(w / 2, h / 2);
            ctx.scale(breathScale, breathScale);
            ctx.translate(-w / 2, -h / 2);
          }
          try {
            anim.render(ctx, renderTargetImg, progress, elapsed, slotA.duration, w, h, contextA);
          } finally {
            ctx.restore();
            setActiveRenderContext(null);
          }
          if (isImgAReady) {
            this.lastRenderedImage = imgA;
          }
        }
      }

      // Apply channel-specific architectural layout composition (breaks identical slideshow hashes across 10 channels)
      if (!slotA.isIntroVideo && cinematicOptions?.layoutMode && cinematicOptions.layoutMode !== 'full_cinema') {
        const neighbors = buildContext(slotAIndex).getNeighborImages?.() || [];
        this.applyChannelLayoutArchitecture(
          ctx,
          cinematicOptions.layoutMode,
          renderTargetImg,
          neighbors,
          clampedTime,
          slotAIndex,
          slots.length,
          w,
          h,
          cinematicOptions.dramaTitle,
          cinematicOptions.scheduleLabel
        );
      }

      // Cinema Post-Processing Pipeline
      if (cinematicOptions?.colorGrading && cinematicOptions.colorGrading !== 'none') {
        CinematicFxRenderer.applyColorGrading(ctx, cinematicOptions.colorGrading, w, h);
      }
      if (cinematicOptions?.channelSlotNumber) {
        const fpTint = getEffectiveChannelFingerprint(
          cinematicOptions.channelSlotNumber,
          cinematicOptions.antiSpamVariationSeed || 0
        ).tintCss;
        ctx.save();
        ctx.fillStyle = fpTint;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      if (cinematicOptions?.enableLightLeaks) {
        CinematicFxRenderer.renderLightLeaks(ctx, clampedTime, false, 0, w, h);
      }
      if (cinematicOptions?.overlayStyleId && cinematicOptions.overlayStyleId !== 'none') {
        CinematicOverlayRenderer.renderOverlay(ctx, cinematicOptions.overlayStyleId, clampedTime, w, h);
      }
      if (cinematicOptions?.enableFilmGrain) {
        CinematicFxRenderer.renderFilmGrain(ctx, w, h);
      }
      if (cinematicOptions?.enableLetterbox) {
        CinematicFxRenderer.renderLetterbox(ctx, w, h);
      }

      ctx.restore();
      return;
    }

    // In Transition: Render Slot A on Offscreen A, Slot B on Offscreen B, then blend onto target canvas
    const transDuration = Math.max(0.1, slotA.endTime - nextSlot.startTime);
    const transProgress = Math.min(1.0, Math.max(0, (clampedTime - nextSlot.startTime) / transDuration));

    const renderTargetImgA = isImgAReady ? imgA : (this.lastRenderedImage || imgA);

    // Offscreen A (Outgoing)
    this.offscreenCtxA.save();
    this.offscreenCtxA.clearRect(0, 0, w, h);
    if (cinematicOptions?.enableAmbientBackdrop || bgEffect === 'ambient_blur') {
      CinematicFxRenderer.renderAmbientBackdrop(this.offscreenCtxA, renderTargetImgA, w, h);
    } else {
      BackgroundFxRenderer.renderBackground(this.offscreenCtxA, bgEffect, clampedTime, w, h, bgVideoElement);
    }

    if (slotA.isIntroVideo && slotA.videoUrl) {
      const vidA = this.getVideo(slotA.videoUrl, triggerRedraw);
      const inSlotTime = Math.max(0, Math.min(slotA.duration, clampedTime - slotA.startTime));
      const targetVidTime = Math.max(0, (slotA.introSourceStartTime || 0) + inSlotTime);
      if (!this.disableAsyncRedraw && Math.abs(vidA.currentTime - targetVidTime) > 0.08) {
        vidA.currentTime = targetVidTime;
      }
      this.renderIntroVideoSlot(
        this.offscreenCtxA,
        vidA,
        isImgAReady ? imgA : null,
        slotA,
        clampedTime,
        w,
        h
      );
    } else {
      const elapsedA = Math.max(0, clampedTime - slotA.startTime);
      const progressA = Math.min(1.0, elapsedA / Math.max(0.1, slotA.duration));
      const animA = getAnimationById(slotA.animationId);
      const contextA = buildContext(slotAIndex);
      setActiveRenderContext(contextA);
      const fpA = cinematicOptions?.channelSlotNumber
        ? getEffectiveChannelFingerprint(
            cinematicOptions.channelSlotNumber,
            cinematicOptions.antiSpamVariationSeed || 0
          )
        : null;
      const breathScaleA = 1 + 0.004 * Math.sin(clampedTime * 0.45 + (cinematicOptions?.channelSlotNumber || 1));
      this.offscreenCtxA.save();
      if (fpA) {
        this.offscreenCtxA.translate(w / 2 + fpA.panX, h / 2 + fpA.panY);
        this.offscreenCtxA.scale(fpA.zoomBias * breathScaleA, fpA.zoomBias * breathScaleA);
        this.offscreenCtxA.translate(-w / 2, -h / 2);
      } else {
        this.offscreenCtxA.translate(w / 2, h / 2);
        this.offscreenCtxA.scale(breathScaleA, breathScaleA);
        this.offscreenCtxA.translate(-w / 2, -h / 2);
      }
      try {
        animA.render(this.offscreenCtxA, renderTargetImgA, progressA, elapsedA, slotA.duration, w, h, contextA);
      } finally {
        this.offscreenCtxA.restore();
        setActiveRenderContext(null);
      }
    }
    this.offscreenCtxA.restore();

    // Offscreen B (Incoming)
    this.offscreenCtxB.save();
    this.offscreenCtxB.clearRect(0, 0, w, h);
    if (cinematicOptions?.enableAmbientBackdrop || bgEffect === 'ambient_blur') {
      CinematicFxRenderer.renderAmbientBackdrop(this.offscreenCtxB, imgB, w, h);
    } else {
      BackgroundFxRenderer.renderBackground(this.offscreenCtxB, bgEffect, clampedTime, w, h, bgVideoElement);
    }
    const elapsedB = Math.max(0, clampedTime - nextSlot.startTime);
    const progressB = Math.min(1.0, elapsedB / Math.max(0.1, nextSlot.duration));
    const animB = getAnimationById(nextSlot.animationId);
    const contextB = buildContext(slotAIndex + 1);
    setActiveRenderContext(contextB);
    const fpB = cinematicOptions?.channelSlotNumber
      ? getEffectiveChannelFingerprint(
          cinematicOptions.channelSlotNumber,
          cinematicOptions.antiSpamVariationSeed || 0
        )
      : null;
    const breathScaleB = 1 + 0.004 * Math.sin(clampedTime * 0.45 + (cinematicOptions?.channelSlotNumber || 1));
    this.offscreenCtxB.save();
    if (fpB) {
      this.offscreenCtxB.translate(w / 2 + fpB.panX, h / 2 + fpB.panY);
      this.offscreenCtxB.scale(fpB.zoomBias * breathScaleB, fpB.zoomBias * breathScaleB);
      this.offscreenCtxB.translate(-w / 2, -h / 2);
    } else {
      this.offscreenCtxB.translate(w / 2, h / 2);
      this.offscreenCtxB.scale(breathScaleB, breathScaleB);
      this.offscreenCtxB.translate(-w / 2, -h / 2);
    }
    try {
      animB.render(this.offscreenCtxB, imgB, progressB, elapsedB, nextSlot.duration, w, h, contextB);
    } finally {
      this.offscreenCtxB.restore();
      setActiveRenderContext(null);
    }
    this.offscreenCtxB.restore();

    if (isImgBReady) {
      this.lastRenderedImage = imgB;
    }

    // Composite Transition onto target canvas
    this.compositeTransition(
      ctx,
      this.offscreenCanvasA,
      this.offscreenCanvasB,
      slotA.transitionType,
      transProgress,
      w,
      h
    );

    // Apply channel-specific architectural layout composition on transition frame too
    if (!slotA.isIntroVideo && cinematicOptions?.layoutMode && cinematicOptions.layoutMode !== 'full_cinema') {
      const neighbors = buildContext(slotAIndex).getNeighborImages?.() || [];
      this.applyChannelLayoutArchitecture(
        ctx,
        cinematicOptions.layoutMode,
        isImgBReady && transProgress > 0.5 ? imgB : renderTargetImgA,
        neighbors,
        clampedTime,
        slotAIndex,
        slots.length,
        w,
        h,
        cinematicOptions.dramaTitle,
        cinematicOptions.scheduleLabel
      );
    }

    // Cinema Post-Processing Pipeline
    if (cinematicOptions?.colorGrading && cinematicOptions.colorGrading !== 'none') {
      CinematicFxRenderer.applyColorGrading(ctx, cinematicOptions.colorGrading, w, h);
    }
    if (cinematicOptions?.channelSlotNumber) {
      const fpTint = getEffectiveChannelFingerprint(
        cinematicOptions.channelSlotNumber,
        cinematicOptions.antiSpamVariationSeed || 0
      ).tintCss;
      ctx.save();
      ctx.fillStyle = fpTint;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (cinematicOptions?.enableLightLeaks) {
      CinematicFxRenderer.renderLightLeaks(ctx, clampedTime, true, transProgress, w, h);
    }
    if (cinematicOptions?.overlayStyleId && cinematicOptions.overlayStyleId !== 'none') {
      CinematicOverlayRenderer.renderOverlay(ctx, cinematicOptions.overlayStyleId, clampedTime, w, h);
    }
    if (cinematicOptions?.enableFilmGrain) {
      CinematicFxRenderer.renderFilmGrain(ctx, w, h);
    }
    if (cinematicOptions?.enableLetterbox) {
      CinematicFxRenderer.renderLetterbox(ctx, w, h);
    }
  }

  /**
   * Renders distinct architectural screen layouts per channel so 10 channels using
   * screenshots from the same drama produce genuinely different visual compositions.
   */
  private applyChannelLayoutArchitecture(
    ctx: CanvasRenderingContext2D,
    layoutMode: ChannelLayoutMode,
    mainImg: HTMLImageElement | null,
    neighbors: HTMLImageElement[],
    time: number,
    slotIndex: number,
    totalSlots: number,
    w: number,
    h: number,
    dramaTitle?: string,
    scheduleLabel?: string
  ): void {
    const sCtx = this.layoutScratchCtx;
    if (!sCtx) return;

    // Copy current rendered full frame into scratch so we can crop/re-compose cleanly
    sCtx.clearRect(0, 0, w, h);
    sCtx.drawImage(ctx.canvas, 0, 0, w, h);

    const secondaryImg = neighbors[0] || mainImg;
    const tertiaryImg = neighbors[1] || neighbors[0] || mainImg;

    const drawCover = (
      target: CanvasRenderingContext2D,
      img: HTMLImageElement | HTMLCanvasElement,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      scaleExtra = 1.04
    ) => {
      const iw = img instanceof HTMLImageElement ? img.naturalWidth || w : img.width;
      const ih = img instanceof HTMLImageElement ? img.naturalHeight || h : img.height;
      if (!iw || !ih) return;
      const imgRatio = iw / ih;
      const boxRatio = dw / dh;
      let sw = iw;
      let sh = ih;
      let sx = 0;
      let sy = 0;
      if (imgRatio > boxRatio) {
        sw = ih * boxRatio;
        sx = (iw - sw) / 2;
      } else {
        sh = iw / boxRatio;
        sy = (ih - sh) / 2;
      }
      const zoomSw = sw / scaleExtra;
      const zoomSh = sh / scaleExtra;
      const zoomSx = sx + (sw - zoomSw) / 2;
      const zoomSy = sy + (sh - zoomSh) / 2;
      target.drawImage(img, zoomSx, zoomSy, zoomSw, zoomSh, dx, dy, dw, dh);
    };

    const perfFlags = getRenderPerformanceFlags();
    const drawBackdropBlur = (opacity = 0.35) => {
      ctx.save();
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = opacity;
      if (this.blurScratchCtx) {
        const bw = 128;
        const bh = 72;
        if (this.blurScratchCanvas.width !== bw || this.blurScratchCanvas.height !== bh) {
          this.blurScratchCanvas.width = bw;
          this.blurScratchCanvas.height = bh;
        }
        this.blurScratchCtx.imageSmoothingEnabled = true;
        this.blurScratchCtx.imageSmoothingQuality = 'low';
        this.blurScratchCtx.drawImage(this.layoutScratchCanvas, 0, 0, bw, bh);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(this.blurScratchCanvas, -24, -24, w + 48, h + 48);
      } else {
        ctx.drawImage(this.layoutScratchCanvas, -24, -24, w + 48, h + 48);
      }
      ctx.restore();
    };

    const drawRoundedClip = (x: number, y: number, bw: number, bh: number, r: number) => {
      const rr = Math.min(r, bw / 2, bh / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + bw - rr, y);
      ctx.arcTo(x + bw, y, x + bw, y + rr, rr);
      ctx.lineTo(x + bw, y + bh - rr);
      ctx.arcTo(x + bw, y + bh, x + bw - rr, y + bh, rr);
      ctx.lineTo(x + rr, y + bh);
      ctx.arcTo(x, y + bh, x, y + bh - rr, rr);
      ctx.lineTo(x, y + rr);
      ctx.arcTo(x, y, x + rr, y, rr);
      ctx.closePath();
    };

    const cleanDrama = (dramaTitle || 'নাটক রিভিউ ও আপডেট').replace(/\s*\([^)]*\)/g, '').trim();
    const sched = (scheduleLabel || 'গল্প বিশ্লেষণ ও আপডেট').trim();

    switch (layoutMode) {
      case 'split_comparison': {
        // Two vertical comparison panels with moving divider & accent glow
        ctx.save();
        drawBackdropBlur(0.28);
        const gap = Math.round(w * 0.012);
        const leftW = Math.round(w * 0.56);
        const rightX = leftW + gap;
        const rightW = w - rightX;

        ctx.save();
        drawRoundedClip(Math.round(w * 0.02), Math.round(h * 0.06), leftW - Math.round(w * 0.02), Math.round(h * 0.88), 16);
        ctx.clip();
        drawCover(ctx, this.layoutScratchCanvas, Math.round(w * 0.02), Math.round(h * 0.06), leftW - Math.round(w * 0.02), Math.round(h * 0.88), 1.02);
        ctx.restore();

        if (secondaryImg) {
          const drift = 1.03 + 0.03 * Math.sin(time * 0.9);
          ctx.save();
          drawRoundedClip(rightX, Math.round(h * 0.06), rightW - Math.round(w * 0.02), Math.round(h * 0.88), 16);
          ctx.clip();
          drawCover(ctx, secondaryImg, rightX, Math.round(h * 0.06), rightW - Math.round(w * 0.02), Math.round(h * 0.88), drift);
          ctx.restore();
        }

        // Crisp glowing vertical accent line
        ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.fillRect(leftW + Math.round(gap / 2) - 2, Math.round(h * 0.08), 4, Math.round(h * 0.84));
        ctx.restore();
        break;
      }

      case 'news_desk_card': {
        // Broadcast Review Desk: Left framed video window + Right translucent info panel
        ctx.save();
        drawBackdropBlur(0.32);

        const pad = Math.round(w * 0.03);
        const mainW = Math.round(w * 0.66);
        const mainH = Math.round(h * 0.78);
        const mainY = Math.round(h * 0.11);

        // Main framed visual
        ctx.save();
        if (!perfFlags.reduceShadowBlur) {
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 24;
        }
        drawRoundedClip(pad, mainY, mainW, mainH, 16);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.clip();
        drawCover(ctx, this.layoutScratchCanvas, pad, mainY, mainW, mainH, 1.01);
        ctx.restore();

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.lineWidth = 2;
        drawRoundedClip(pad, mainY, mainW, mainH, 16);
        ctx.stroke();

        // Right Review Desk Card
        const cardX = pad + mainW + Math.round(w * 0.02);
        const cardW = w - cardX - pad;
        ctx.save();
        drawRoundedClip(cardX, mainY, cardW, mainH, 16);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Secondary preview thumbnail inside right card
        const thumbH = Math.round(mainH * 0.42);
        if (secondaryImg) {
          ctx.save();
          drawRoundedClip(cardX + 14, mainY + 14, cardW - 28, thumbH, 10);
          ctx.clip();
          drawCover(ctx, secondaryImg, cardX + 14, mainY + 14, cardW - 28, thumbH, 1.05 + 0.02 * Math.sin(time));
          ctx.restore();
        }

        // Info typography inside right card
        const textX = cardX + 18;
        let textY = mainY + thumbH + 46;
        ctx.fillStyle = '#FBBF24';
        ctx.font = `700 ${Math.round(w * 0.013)}px "Hind Siliguri", sans-serif`;
        ctx.fillText('নাটক রিভিউ ডেসক', textX, textY);

        textY += 34;
        ctx.fillStyle = '#F8FAFC';
        ctx.font = `700 ${Math.round(w * 0.017)}px "Hind Siliguri", sans-serif`;
        ctx.fillText(cleanDrama.slice(0, 22), textX, textY);

        textY += 32;
        ctx.fillStyle = '#94A3B8';
        ctx.font = `600 ${Math.round(w * 0.0125)}px "Hind Siliguri", sans-serif`;
        ctx.fillText(sched, textX, textY, cardW - 36);

        ctx.restore();
        ctx.restore();
        break;
      }

      case 'triptych_mosaic': {
        // Main hero canvas on left 68% + 2 stacked animated neighbor scene cards on right 28%
        ctx.save();
        drawBackdropBlur(0.32);
        const pad = Math.round(w * 0.026);
        const gap = Math.round(w * 0.016);
        const leftW = Math.round(w * 0.67);
        const fullH = Math.round(h * 0.84);
        const topY = Math.round(h * 0.08);

        ctx.save();
        drawRoundedClip(pad, topY, leftW, fullH, 16);
        ctx.clip();
        drawCover(ctx, this.layoutScratchCanvas, pad, topY, leftW, fullH, 1.02);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        drawRoundedClip(pad, topY, leftW, fullH, 16);
        ctx.stroke();

        const rightX = pad + leftW + gap;
        const rightW = w - rightX - pad;
        const cardH = Math.round((fullH - gap) / 2);

        if (secondaryImg) {
          ctx.save();
          drawRoundedClip(rightX, topY, rightW, cardH, 14);
          ctx.clip();
          drawCover(ctx, secondaryImg, rightX, topY, rightW, cardH, 1.04 + 0.03 * Math.sin(time * 0.8));
          ctx.restore();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.5;
          drawRoundedClip(rightX, topY, rightW, cardH, 14);
          ctx.stroke();
        }
        if (tertiaryImg) {
          ctx.save();
          drawRoundedClip(rightX, topY + cardH + gap, rightW, cardH, 14);
          ctx.clip();
          drawCover(ctx, tertiaryImg, rightX, topY + cardH + gap, rightW, cardH, 1.05 + 0.03 * Math.cos(time * 0.8));
          ctx.restore();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
          ctx.lineWidth = 1.5;
          drawRoundedClip(rightX, topY + cardH + gap, rightW, cardH, 14);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'polaroid_collage': {
        // Dual angled Polaroid cards floating over blurred motion backdrop
        ctx.save();
        drawBackdropBlur(0.45);
        if (secondaryImg) {
          ctx.save();
          ctx.translate(w * 0.28, h * 0.52);
          ctx.rotate(-0.07 + 0.012 * Math.sin(time * 0.7));
          const pw = w * 0.42;
          const ph = h * 0.68;
          ctx.fillStyle = '#f8fafc';
          if (!perfFlags.reduceShadowBlur) {
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = 22;
          }
          drawRoundedClip(-pw / 2, -ph / 2, pw, ph, 10);
          ctx.fill();
          ctx.shadowBlur = 0;
          drawCover(ctx, secondaryImg, -pw / 2 + 12, -ph / 2 + 12, pw - 24, ph - 52, 1.04);
          ctx.restore();
        }

        // Foreground hero card
        ctx.save();
        ctx.translate(w * 0.60, h * 0.49);
        ctx.rotate(0.035 + 0.01 * Math.cos(time * 0.8));
        const mw = w * 0.54;
        const mh = h * 0.76;
        ctx.fillStyle = '#ffffff';
        if (!perfFlags.reduceShadowBlur) {
          ctx.shadowColor = 'rgba(0,0,0,0.65)';
          ctx.shadowBlur = 28;
        }
        drawRoundedClip(-mw / 2, -mh / 2, mw, mh, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        drawCover(ctx, this.layoutScratchCanvas, -mw / 2 + 14, -mh / 2 + 14, mw - 28, mh - 56, 1.01);
        ctx.restore();
        ctx.restore();
        break;
      }

      case 'documentary_bar': {
        // Top Documentary Progress & Chapter Strip + Framed Wide Canvas
        ctx.save();
        drawBackdropBlur(0.25);
        const padX = Math.round(w * 0.035);
        const topBarH = Math.round(h * 0.075);
        const boxY = topBarH + Math.round(h * 0.025);
        const boxH = h - boxY - Math.round(h * 0.055);

        ctx.save();
        drawRoundedClip(padX, boxY, w - padX * 2, boxH, 12);
        ctx.clip();
        drawCover(ctx, this.layoutScratchCanvas, padX, boxY, w - padX * 2, boxH, 1.01);
        ctx.restore();

        // Top Documentary Progress Bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, w, topBarH);
        const segProgress = Math.min(1, (slotIndex + 1) / Math.max(1, totalSlots));
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(0, topBarH - 3, Math.round(w * segProgress), 3);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = `700 ${Math.round(w * 0.0145)}px "Hind Siliguri", sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(cleanDrama, w - padX, Math.round(topBarH * 0.62));
        ctx.restore();
        break;
      }

      case 'editorial_frame': {
        // Left vertical editorial accent column + right wide frame
        ctx.save();
        drawBackdropBlur(0.32);
        const sideW = Math.round(w * 0.24);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        ctx.fillRect(0, 0, sideW, h);
        ctx.fillStyle = '#FB7185';
        ctx.fillRect(sideW - 3, 0, 3, h);

        if (secondaryImg) {
          ctx.save();
          drawRoundedClip(18, Math.round(h * 0.16), sideW - 36, Math.round(h * 0.28), 10);
          ctx.clip();
          drawCover(ctx, secondaryImg, 18, Math.round(h * 0.16), sideW - 36, Math.round(h * 0.28), 1.06);
          ctx.restore();
        }
        ctx.fillStyle = '#FDE047';
        ctx.font = `700 ${Math.round(w * 0.013)}px "Hind Siliguri", sans-serif`;
        ctx.fillText('এডিটোরিয়াল বিশ্লেষণ', 20, Math.round(h * 0.51));
        ctx.fillStyle = '#F8FAFC';
        ctx.font = `700 ${Math.round(w * 0.0165)}px "Hind Siliguri", sans-serif`;
        ctx.fillText(cleanDrama.slice(0, 18), 20, Math.round(h * 0.57));
        ctx.fillStyle = '#CBD5E1';
        ctx.font = `600 ${Math.round(w * 0.012)}px "Hind Siliguri", sans-serif`;
        ctx.fillText(sched.slice(0, 24), 20, Math.round(h * 0.63));

        const pad = Math.round(w * 0.025);
        const rx = sideW + pad;
        const rw = w - rx - pad;
        const ry = Math.round(h * 0.07);
        const rh = Math.round(h * 0.86);
        ctx.save();
        drawRoundedClip(rx, ry, rw, rh, 14);
        ctx.clip();
        drawCover(ctx, this.layoutScratchCanvas, rx, ry, rw, rh, 1.02);
        ctx.restore();
        ctx.restore();
        break;
      }

      case 'panoramic_reel': {
        // Ultra-wide 2.35:1 cinematic strip floating over blurred scene backdrop
        ctx.save();
        drawBackdropBlur(0.42);
        const stripH = Math.round(h * 0.72);
        const stripY = Math.round((h - stripH) / 2);
        ctx.save();
        if (!perfFlags.reduceShadowBlur) {
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 24;
        }
        drawRoundedClip(Math.round(w * 0.02), stripY, Math.round(w * 0.96), stripH, 10);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.clip();
        drawCover(ctx, this.layoutScratchCanvas, Math.round(w * 0.02), stripY, Math.round(w * 0.96), stripH, 1.03);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(Math.round(w * 0.02), stripY, Math.round(w * 0.96), stripH);
        ctx.restore();
        break;
      }

      case 'spotlight_pip': {
        // Main canvas with clean Picture-in-Picture secondary frame in top-right
        ctx.save();
        if (secondaryImg) {
          const pipW = Math.round(w * 0.25);
          const pipH = Math.round(h * 0.26);
          const pipX = w - pipW - Math.round(w * 0.03);
          const pipY = Math.round(h * 0.06);

          ctx.save();
          if (!perfFlags.reduceShadowBlur) {
            ctx.shadowColor = 'rgba(0,0,0,0.65)';
            ctx.shadowBlur = 18;
          }
          drawRoundedClip(pipX, pipY, pipW, pipH, 12);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.clip();
          drawCover(ctx, secondaryImg, pipX, pipY, pipW, pipH, 1.04 + 0.03 * Math.sin(time));
          ctx.restore();

          ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
          ctx.lineWidth = 2.5;
          drawRoundedClip(pipX, pipY, pipW, pipH, 12);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'spotlight_diary': {
        // Storybook card with subtle dark bezel & floating scene badge
        ctx.save();
        drawBackdropBlur(0.38);
        const mx = Math.round(w * 0.06);
        const my = Math.round(h * 0.08);
        const mw = w - mx * 2;
        const mh = h - my * 2;
        ctx.save();
        if (!perfFlags.reduceShadowBlur) {
          ctx.shadowColor = 'rgba(0,0,0,0.65)';
          ctx.shadowBlur = 24;
        }
        drawRoundedClip(mx, my, mw, mh, 18);
        ctx.fillStyle = '#0b1120';
        ctx.fill();
        ctx.clip();
        drawCover(ctx, this.layoutScratchCanvas, mx, my, mw, mh, 1.02);
        ctx.restore();

        ctx.strokeStyle = 'rgba(20, 184, 166, 0.6)';
        ctx.lineWidth = 2.5;
        drawRoundedClip(mx, my, mw, mh, 18);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'full_cinema':
      default:
        break;
    }
  }

  /**
   * High performance canvas transition compositor
   */
  private compositeTransition(
    ctx: CanvasRenderingContext2D,
    canvasA: HTMLCanvasElement,
    canvasB: HTMLCanvasElement,
    type: TransitionType,
    p: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const ease = this.easeInOutCubic(p);

    switch (type) {
      case 'crossfade': {
        // Smooth alpha blending
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        break;
      }

      case 'cinematicDissolve': {
        // Dissolve with warm exposure lift in the middle
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);

        // Exposure bloom peak at 50%
        const bloom = Math.sin(p * Math.PI) * 0.22;
        if (bloom > 0.02) {
          ctx.globalAlpha = bloom;
          ctx.fillStyle = '#fff4e6';
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }

      case 'smoothZoom': {
        // Outgoing zooms out, incoming zooms in from 0.88 to 1.0
        const scaleA = 1.0 + ease * 0.15;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const scaleB = 0.88 + ease * 0.12;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'slideLeft': {
        const offset = ease * w;
        ctx.drawImage(canvasA, -offset, 0);
        ctx.drawImage(canvasB, w - offset, 0);
        break;
      }

      case 'slideRight': {
        const offset = ease * w;
        ctx.drawImage(canvasA, offset, 0);
        ctx.drawImage(canvasB, -w + offset, 0);
        break;
      }

      case 'slideUp': {
        const offset = ease * h;
        ctx.drawImage(canvasA, 0, -offset);
        ctx.drawImage(canvasB, 0, h - offset);
        break;
      }

      case 'slideDown': {
        const offset = ease * h;
        ctx.drawImage(canvasA, 0, offset);
        ctx.drawImage(canvasB, 0, -h + offset);
        break;
      }

      case 'pageFlip3d': {
        // 3D perspective fold around center axis
        if (p < 0.5) {
          const flipScale = Math.max(0.01, Math.cos(p * Math.PI));
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(flipScale, 1.0);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasA, 0, 0);
          ctx.restore();
        } else {
          const flipScale = Math.max(0.01, Math.abs(Math.cos(p * Math.PI)));
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(flipScale, 1.0);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasB, 0, 0);
          ctx.restore();
        }
        break;
      }

      case 'softBlur': {
        // Soft focal dissolve
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        // Soft vignette blur veil
        const veil = Math.sin(p * Math.PI) * 0.35;
        if (veil > 0.05) {
          ctx.globalAlpha = veil;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }

      case 'lightSweep': {
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);

        // Anamorphic horizontal streak
        const sweepX = ease * w * 1.4 - w * 0.2;
        const streakGrad = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
        streakGrad.addColorStop(0, 'rgba(255,245,210,0)');
        streakGrad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
        streakGrad.addColorStop(1, 'rgba(255,245,210,0)');
        ctx.globalAlpha = Math.sin(p * Math.PI);
        ctx.fillStyle = streakGrad;
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case 'splitPanel': {
        const splitW = (w / 2) * (1 - ease);
        ctx.drawImage(canvasA, 0, 0, w / 2, h, 0 - (w / 2 - splitW), 0, w / 2, h);
        ctx.drawImage(canvasA, w / 2, 0, w / 2, h, w / 2 + (w / 2 - splitW), 0, w / 2, h);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(canvasB, 0, 0);
        break;
      }

      case 'motionBlur': {
        const streak = (1 - Math.abs(p - 0.5) * 2) * 40;
        ctx.drawImage(canvasA, -streak * (1 - ease), 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, streak * ease, 0);
        break;
      }

      // Remotion Transitions: Exact implementation of user-provided Remotion specs
      case 'remotion_slide': {
        // Remotion presentation={slide()} with linearTiming(30)
        const offset = p * w;
        ctx.drawImage(canvasA, -offset, 0);
        ctx.drawImage(canvasB, w - offset, 0);
        break;
      }

      case 'remotion_slide_reverse': {
        // Remotion slide (Reverse: slides in from left to right)
        const offset = p * w;
        ctx.drawImage(canvasA, offset, 0);
        ctx.drawImage(canvasB, -w + offset, 0);
        break;
      }

      case 'remotion_lightleak': {
        // Remotion @remotion/light-leaks with TransitionSeries.Overlay durationInFrames=20
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = p;
        ctx.drawImage(canvasB, 0, 0);

        // Anamorphic cinematic golden/amber/magenta light leak sweep
        const leakProgress = Math.sin(p * Math.PI);
        if (leakProgress > 0.02) {
          const leakX = p * w * 1.5 - w * 0.25;
          const leakGrad = ctx.createRadialGradient(
            leakX,
            h * 0.35,
            10,
            leakX,
            h * 0.35,
            Math.max(w * 0.65, h * 0.9)
          );
          leakGrad.addColorStop(0, `rgba(255, 250, 220, ${0.85 * leakProgress})`);
          leakGrad.addColorStop(0.25, `rgba(255, 179, 71, ${0.75 * leakProgress})`);
          leakGrad.addColorStop(0.55, `rgba(255, 64, 129, ${0.55 * leakProgress})`);
          leakGrad.addColorStop(0.85, `rgba(180, 50, 255, ${0.35 * leakProgress})`);
          leakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = leakGrad;
          ctx.fillRect(0, 0, w, h);

          // Horizontal anamorphic flare streak
          const streakY = h * 0.35;
          const streakGrad = ctx.createLinearGradient(0, streakY - 35, 0, streakY + 35);
          streakGrad.addColorStop(0, 'rgba(255, 220, 150, 0)');
          streakGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.9 * leakProgress})`);
          streakGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
          ctx.fillStyle = streakGrad;
          ctx.fillRect(0, streakY - 35, w, 70);
          ctx.restore();
        }
        break;
      }

      case 'remotion_lightleak_reverse': {
        // Remotion LightLeak (Reverse: cool cyan/violet flare sweeping opposite)
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = p;
        ctx.drawImage(canvasB, 0, 0);

        const leakProgress = Math.sin(p * Math.PI);
        if (leakProgress > 0.02) {
          const leakX = (1.0 - p) * w * 1.5 - w * 0.25;
          const leakGrad = ctx.createRadialGradient(
            leakX,
            h * 0.65,
            10,
            leakX,
            h * 0.65,
            Math.max(w * 0.65, h * 0.9)
          );
          leakGrad.addColorStop(0, `rgba(220, 250, 255, ${0.85 * leakProgress})`);
          leakGrad.addColorStop(0.3, `rgba(0, 212, 255, ${0.7 * leakProgress})`);
          leakGrad.addColorStop(0.65, `rgba(138, 43, 226, ${0.5 * leakProgress})`);
          leakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = leakGrad;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      case 'remotion_fade': {
        // Remotion presentation={fade()} with linearTiming(30)
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = p;
        ctx.drawImage(canvasB, 0, 0);
        break;
      }

      case 'remotion_fade_reverse': {
        // Remotion fade (Reverse: high-key flash dip-through-white)
        if (p < 0.5) {
          const fadeP = p * 2;
          ctx.drawImage(canvasA, 0, 0);
          ctx.globalAlpha = fadeP;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        } else {
          const fadeP = (p - 0.5) * 2;
          ctx.drawImage(canvasB, 0, 0);
          ctx.globalAlpha = 1 - fadeP;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }

      case 'remotion_pushcut': {
        // Remotion presentation={pushCut({ cutProgress: 5 / 11 })} timing={linearTiming(11)}
        // cutProgress = 5 / 11 ~ 0.4545
        const cutPoint = 5 / 11;
        if (p < cutPoint) {
          // Outgoing punch frames: scales up dramatically with subtle shake
          const punchRatio = p / cutPoint;
          const scaleA = 1.0 + punchRatio * 0.16;
          const shakeX = Math.sin(punchRatio * Math.PI * 4) * 4 * punchRatio;
          ctx.save();
          ctx.translate(w / 2 + shakeX, h / 2);
          ctx.scale(scaleA, scaleA);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasA, 0, 0);
          ctx.restore();
        } else {
          // Instant cut punch-in snap: incoming starts expanded and snaps with dynamic inertia
          const postRatio = (p - cutPoint) / (1.0 - cutPoint);
          const snapEase = 1.0 - Math.pow(1.0 - postRatio, 3);
          const scaleB = 1.18 - snapEase * 0.18;
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleB, scaleB);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasB, 0, 0);
          ctx.restore();
        }
        break;
      }

      case 'remotion_pushcut_reverse': {
        // Remotion pushCut (Reverse: incoming punch-in from distance)
        const cutPoint = 5 / 11;
        if (p < cutPoint) {
          const punchRatio = p / cutPoint;
          const scaleA = 1.0 - punchRatio * 0.14;
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleA, scaleA);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasA, 0, 0);
          ctx.restore();
        } else {
          const postRatio = (p - cutPoint) / (1.0 - cutPoint);
          const snapEase = 1.0 - Math.pow(1.0 - postRatio, 3);
          const scaleB = 0.85 + snapEase * 0.15;
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleB, scaleB);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasB, 0, 0);
          ctx.restore();
        }
        break;
      }

      case 'remotion_wipe': {
        // Remotion presentation={wipe()} timing={linearTiming(30)}
        // Linear curtain reveal from left to right
        ctx.drawImage(canvasA, 0, 0);
        const wipeX = p * w;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, wipeX, h);
        ctx.clip();
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_wipe_reverse': {
        // Remotion wipe (Reverse: Linear curtain reveal from right to left)
        ctx.drawImage(canvasA, 0, 0);
        const wipeW = p * w;
        ctx.save();
        ctx.beginPath();
        ctx.rect(w - wipeW, 0, wipeW, h);
        ctx.clip();
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_flip': {
        const angle = p * Math.PI;
        const scaleX = Math.cos(angle);
        if (p < 0.5) {
          ctx.drawImage(canvasA, 0, 0);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleX, 1);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = Math.abs(scaleX);
          ctx.drawImage(canvasA, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(canvasB, 0, 0);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(-scaleX, 1);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = Math.abs(scaleX);
          ctx.drawImage(canvasB, 0, 0);
          ctx.restore();
        }
        break;
      }

      case 'remotion_flip_reverse': {
        const angle = -p * Math.PI;
        const scaleX = Math.cos(angle);
        if (p < 0.5) {
          ctx.drawImage(canvasB, 0, 0);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleX, 1);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = Math.abs(scaleX);
          ctx.drawImage(canvasB, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(canvasA, 0, 0);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(-scaleX, 1);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = Math.abs(scaleX);
          ctx.drawImage(canvasA, 0, 0);
          ctx.restore();
        }
        break;
      }

      case 'remotion_clockWipe': {
        ctx.drawImage(canvasA, 0, 0);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        const angle = p * Math.PI * 2 - Math.PI / 2;
        ctx.arc(w / 2, h / 2, Math.max(w, h), -Math.PI / 2, angle, false);
        ctx.lineTo(w / 2, h / 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_clockWipe_reverse': {
        ctx.drawImage(canvasA, 0, 0);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        const angle = -p * Math.PI * 2 - Math.PI / 2;
        ctx.arc(w / 2, h / 2, Math.max(w, h), -Math.PI / 2, angle, true);
        ctx.lineTo(w / 2, h / 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_iris': {
        ctx.drawImage(canvasA, 0, 0);
        const maxRadius = Math.sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2));
        const radius = p * maxRadius;
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_iris_reverse': {
        ctx.drawImage(canvasB, 0, 0);
        const maxRadius = Math.sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2));
        const radius = (1 - p) * maxRadius;
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();
        break;
      }

      // 4. Remotion Zoom Blur
      case 'remotion_zoomBlur': {
        const scaleA = 1.0 + ease * 0.22;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const scaleB = 0.85 + ease * 0.15;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();

        // Shutter blur flash peak at 50%
        const blurPeak = Math.sin(p * Math.PI) * 0.3;
        if (blurPeak > 0.05) {
          ctx.save();
          ctx.globalAlpha = blurPeak;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      case 'remotion_zoomBlur_reverse': {
        const scaleA = 1.0 - ease * 0.18;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const scaleB = 1.25 - ease * 0.25;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      // 5. Remotion Dreamy Zoom: dreamyZoom({ rotation: 6, scale: 1.2 })
      case 'remotion_dreamyZoom': {
        const rotA = (p * 6 * Math.PI) / 180;
        const scaleA = 1.0 + ease * 0.2;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rotA);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const rotB = -((1.0 - p) * 6 * Math.PI) / 180;
        const scaleB = 1.15 - (1.0 - ease) * 0.15;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rotB);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();

        // Ethereal dreamy pastel bloom overlay
        const dreamGlow = Math.sin(p * Math.PI) * 0.38;
        if (dreamGlow > 0.02) {
          ctx.save();
          ctx.globalAlpha = dreamGlow;
          ctx.fillStyle = '#ffe8f0';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      case 'remotion_dreamyZoom_reverse': {
        const rotA = (-p * 6 * Math.PI) / 180;
        const scaleA = 1.0 + ease * 0.2;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rotA);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const rotB = ((1.0 - p) * 6 * Math.PI) / 180;
        const scaleB = 1.15 - (1.0 - ease) * 0.15;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rotB);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();

        const dreamGlow = Math.sin(p * Math.PI) * 0.38;
        if (dreamGlow > 0.02) {
          ctx.save();
          ctx.globalAlpha = dreamGlow;
          ctx.fillStyle = '#e8f0ff';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      // 6. Remotion Film Burn: filmBurn({ seed: 2.31 })
      case 'remotion_filmBurn': {
        ctx.drawImage(canvasA, 0, 0);
        ctx.save();
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();

        // Organic 35mm Celluloid Film Burn Flare & Gate Blowout
        const burnIntensity = Math.sin(p * Math.PI);
        if (burnIntensity > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          // Radial celluloid burn hole from seed position (seed 2.31 -> x: 65%, y: 40%)
          const cx = w * 0.65;
          const cy = h * 0.40;
          const burnGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * 0.85);
          burnGrad.addColorStop(0, `rgba(255, 255, 240, ${burnIntensity * 0.95})`);
          burnGrad.addColorStop(0.2, `rgba(255, 190, 60, ${burnIntensity * 0.85})`);
          burnGrad.addColorStop(0.5, `rgba(255, 60, 20, ${burnIntensity * 0.65})`);
          burnGrad.addColorStop(0.8, `rgba(180, 20, 80, ${burnIntensity * 0.4})`);
          burnGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = burnGrad;
          ctx.fillRect(0, 0, w, h);

          // Horizontal anamorphic projector flicker streak
          const streakY = h * 0.40;
          const sGrad = ctx.createLinearGradient(0, streakY - 40, 0, streakY + 40);
          sGrad.addColorStop(0, 'rgba(255, 120, 0, 0)');
          sGrad.addColorStop(0.5, `rgba(255, 255, 255, ${burnIntensity * 0.9})`);
          sGrad.addColorStop(1, 'rgba(255, 120, 0, 0)');
          ctx.fillStyle = sGrad;
          ctx.fillRect(0, streakY - 40, w, 80);
          ctx.restore();
        }
        break;
      }

      case 'remotion_filmBurn_reverse': {
        ctx.drawImage(canvasA, 0, 0);
        ctx.save();
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();

        const burnIntensity = Math.sin(p * Math.PI);
        if (burnIntensity > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const cx = w * 0.35;
          const cy = h * 0.60;
          const burnGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * 0.85);
          burnGrad.addColorStop(0, `rgba(255, 255, 255, ${burnIntensity * 0.95})`);
          burnGrad.addColorStop(0.25, `rgba(255, 210, 80, ${burnIntensity * 0.8})`);
          burnGrad.addColorStop(0.55, `rgba(255, 80, 30, ${burnIntensity * 0.55})`);
          burnGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = burnGrad;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      // 7. Remotion Linear Blur: linearBlur({ intensity: 0.1 })
      case 'remotion_linearBlur': {
        const streakAmount = Math.sin(p * Math.PI) * 45;
        // Draw frame A with left streak
        if (p < 0.7) {
          ctx.save();
          ctx.globalAlpha = 1.0 - ease;
          for (let step = -2; step <= 2; step++) {
            ctx.drawImage(canvasA, step * (streakAmount * 0.25), 0);
          }
          ctx.restore();
        }
        // Draw frame B with right streak
        if (p > 0.3) {
          ctx.save();
          ctx.globalAlpha = ease;
          for (let step = -2; step <= 2; step++) {
            ctx.drawImage(canvasB, step * (streakAmount * 0.25), 0);
          }
          ctx.restore();
        }
        break;
      }

      case 'remotion_linearBlur_reverse': {
        const streakAmount = Math.sin(p * Math.PI) * 45;
        if (p < 0.7) {
          ctx.save();
          ctx.globalAlpha = 1.0 - ease;
          for (let step = -2; step <= 2; step++) {
            ctx.drawImage(canvasA, 0, step * (streakAmount * 0.25));
          }
          ctx.restore();
        }
        if (p > 0.3) {
          ctx.save();
          ctx.globalAlpha = ease;
          for (let step = -2; step <= 2; step++) {
            ctx.drawImage(canvasB, 0, step * (streakAmount * 0.25));
          }
          ctx.restore();
        }
        break;
      }

      // 8. Remotion Book Flip: bookFlip({})
      case 'remotion_bookFlip': {
        ctx.drawImage(canvasB, 0, 0);
        if (p < 1.0) {
          const curlX = w * (1.0 - ease);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, curlX, h);
          ctx.clip();
          ctx.drawImage(canvasA, 0, 0);

          // Spine shadow gradient along curl edge
          const shadowGrad = ctx.createLinearGradient(curlX - 60, 0, curlX, 0);
          shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          shadowGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.35)');
          shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
          ctx.fillStyle = shadowGrad;
          ctx.fillRect(curlX - 60, 0, 60, h);
          ctx.restore();
        }
        break;
      }

      case 'remotion_bookFlip_reverse': {
        ctx.drawImage(canvasB, 0, 0);
        if (p < 1.0) {
          const curlX = w * ease;
          ctx.save();
          ctx.beginPath();
          ctx.rect(curlX, 0, w - curlX, h);
          ctx.clip();
          ctx.drawImage(canvasA, 0, 0);

          const shadowGrad = ctx.createLinearGradient(curlX, 0, curlX + 60, 0);
          shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
          shadowGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.35)');
          shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = shadowGrad;
          ctx.fillRect(curlX, 0, 60, h);
          ctx.restore();
        }
        break;
      }

      // 9. Remotion Zoom In-Out: zoomInOut({})
      case 'remotion_zoomInOut': {
        if (p < 0.5) {
          const pA = p * 2;
          const scaleA = 1.0 + Math.pow(pA, 2) * 0.45;
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleA, scaleA);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = 1.0 - pA * 0.85;
          ctx.drawImage(canvasA, 0, 0);
          ctx.restore();
        } else {
          const pB = (p - 0.5) * 2;
          const scaleB = 0.65 + (1.0 - Math.pow(1.0 - pB, 2)) * 0.35;
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleB, scaleB);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = pB;
          ctx.drawImage(canvasB, 0, 0);
          ctx.restore();
        }
        break;
      }

      case 'remotion_zoomInOut_reverse': {
        if (p < 0.5) {
          const pA = p * 2;
          const scaleA = 1.0 - Math.pow(pA, 2) * 0.35;
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleA, scaleA);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = 1.0 - pA;
          ctx.drawImage(canvasA, 0, 0);
          ctx.restore();
        } else {
          const pB = (p - 0.5) * 2;
          const scaleB = 1.45 - (1.0 - Math.pow(1.0 - pB, 2)) * 0.45;
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleB, scaleB);
          ctx.translate(-w / 2, -h / 2);
          ctx.globalAlpha = pB;
          ctx.drawImage(canvasB, 0, 0);
          ctx.restore();
        }
        break;
      }

      // 10. Remotion Dissolve: dissolve({})
      case 'remotion_dissolve': {
        ctx.drawImage(canvasA, 0, 0);
        ctx.save();
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_dissolve_reverse': {
        // Dip through clean white ambient dissolve
        if (p < 0.5) {
          const pA = p * 2;
          ctx.drawImage(canvasA, 0, 0);
          ctx.save();
          ctx.globalAlpha = pA;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        } else {
          const pB = (p - 0.5) * 2;
          ctx.drawImage(canvasB, 0, 0);
          ctx.save();
          ctx.globalAlpha = 1.0 - pB;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      // 11. Remotion Ripple: ripple({})
      case 'remotion_ripple': {
        ctx.drawImage(canvasA, 0, 0);
        const maxR = Math.sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2));
        const currentR = ease * maxR;
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, currentR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();

        // Water ripple refraction wave highlight ring
        const ringProgress = Math.sin(p * Math.PI);
        if (ringProgress > 0.05) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${ringProgress * 0.75})`;
          ctx.lineWidth = 6 + ringProgress * 12;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, currentR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      case 'remotion_ripple_reverse': {
        ctx.drawImage(canvasB, 0, 0);
        const maxR = Math.sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2));
        const currentR = (1.0 - ease) * maxR;
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, currentR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const ringProgress = Math.sin(p * Math.PI);
        if (ringProgress > 0.05) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${ringProgress * 0.75})`;
          ctx.lineWidth = 6 + ringProgress * 12;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, currentR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      // 12. Remotion Crosswarp: crosswarp({})
      case 'remotion_crosswarp': {
        const twistA = ease * 0.18;
        const scaleA = 1.0 - ease * 0.35;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(twistA);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const twistB = -(1.0 - ease) * 0.18;
        const scaleB = 0.65 + ease * 0.35;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(twistB);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_crosswarp_reverse': {
        const twistA = -ease * 0.18;
        const scaleA = 1.0 + ease * 0.35;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(twistA);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const twistB = (1.0 - ease) * 0.18;
        const scaleB = 1.35 - ease * 0.35;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(twistB);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      // 13. Remotion Cross Zoom: crossZoom({ strength: 0.4 })
      case 'remotion_crossZoom': {
        const scaleA = 1.0 + ease * 0.55;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const scaleB = 0.55 + ease * 0.45;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();

        const flare = Math.sin(p * Math.PI) * 0.35;
        if (flare > 0.04) {
          ctx.save();
          ctx.globalAlpha = flare;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      case 'remotion_crossZoom_reverse': {
        const scaleA = 1.0 - ease * 0.45;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const scaleB = 1.55 - ease * 0.55;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      // 14. Remotion Swap: swap({})
      case 'remotion_swap': {
        // 3D Card Swap: Outgoing card falls into back-left, incoming rises from back-right
        const offsetA = -ease * w * 0.85;
        const scaleA = 1.0 - ease * 0.22;
        ctx.save();
        ctx.translate(offsetA, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease * 0.7;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const offsetB = (1.0 - ease) * w * 0.85;
        const scaleB = 0.78 + ease * 0.22;
        ctx.save();
        ctx.translate(offsetB, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        // Drop shadow for incoming card
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 30;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_swap_reverse': {
        const offsetA = ease * w * 0.85;
        const scaleA = 1.0 - ease * 0.22;
        ctx.save();
        ctx.translate(offsetA, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = 1.0 - ease * 0.7;
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const offsetB = -(1.0 - ease) * w * 0.85;
        const scaleB = 0.78 + ease * 0.22;
        ctx.save();
        ctx.translate(offsetB, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = ease;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 30;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      // 15. Remotion Blur Slide: blurSlide({ direction: 'from-left' })
      case 'remotion_blurSlide': {
        const off = ease * w;
        const streak = Math.sin(p * Math.PI) * 25;
        ctx.save();
        ctx.drawImage(canvasA, -off - streak, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, w - off + streak * 0.5, 0);
        ctx.restore();
        break;
      }

      case 'remotion_blurSlide_reverse': {
        const off = ease * w;
        const streak = Math.sin(p * Math.PI) * 25;
        ctx.save();
        ctx.drawImage(canvasA, off + streak, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, -w + off - streak * 0.5, 0);
        ctx.restore();
        break;
      }

      // 16. Remotion Cube: cube({ direction: "from-left" })
      case 'remotion_cube': {
        // True 3D Rotating Cube transition
        const angle = ease * (Math.PI / 2);
        if (angle < Math.PI / 4) {
          // Face A dominant
          const scaleXA = Math.cos(angle);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleXA, 1.0);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasA, 0, 0);
          // 3D perspective shading
          ctx.globalAlpha = Math.sin(angle) * 0.6;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        } else {
          // Face B dominant
          const angleB = Math.PI / 2 - angle;
          const scaleXB = Math.cos(angleB);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(scaleXB, 1.0);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasB, 0, 0);
          ctx.globalAlpha = Math.sin(angleB) * 0.6;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      case 'remotion_cube_reverse': {
        const angle = ease * (Math.PI / 2);
        if (angle < Math.PI / 4) {
          const scaleXA = Math.cos(angle);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(-scaleXA, 1.0);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasA, 0, 0);
          ctx.globalAlpha = Math.sin(angle) * 0.6;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        } else {
          const angleB = Math.PI / 2 - angle;
          const scaleXB = Math.cos(angleB);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(-scaleXB, 1.0);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(canvasB, 0, 0);
          ctx.globalAlpha = Math.sin(angleB) * 0.6;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
      }

      // 17. Remotion Spring Timing: springTiming({ durationInFrames: 45, config: { damping: 200 }, durationRestThreshold: 0.0001 })
      case 'remotion_spring': {
        const springVal = this.remotionSpringEasing(p, 200);
        
        // Outgoing frame A: damped scale down to 0.88 with subtle spring pushback
        const scaleA = 1.0 - springVal * 0.12;
        const offsetA = -springVal * w * 0.28;
        ctx.save();
        ctx.translate(offsetA, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = Math.max(0, 1.0 - springVal * 0.95);
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        // Incoming frame B: customPresentation({ width, height }) spring slide from right with elastic settle
        const offsetB = (1.0 - springVal) * w;
        const scaleB = 0.92 + springVal * 0.08;
        ctx.save();
        ctx.translate(offsetB, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = Math.min(1.0, springVal * 1.25);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 35;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      case 'remotion_spring_reverse': {
        const springVal = this.remotionSpringEasing(p, 200);
        const scaleA = 1.0 - springVal * 0.12;
        const offsetA = springVal * w * 0.28;
        ctx.save();
        ctx.translate(offsetA, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleA, scaleA);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = Math.max(0, 1.0 - springVal * 0.95);
        ctx.drawImage(canvasA, 0, 0);
        ctx.restore();

        const offsetB = -(1.0 - springVal) * w;
        const scaleB = 0.92 + springVal * 0.08;
        ctx.save();
        ctx.translate(offsetB, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleB, scaleB);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = Math.min(1.0, springVal * 1.25);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 35;
        ctx.drawImage(canvasB, 0, 0);
        ctx.restore();
        break;
      }

      default: {
        ctx.drawImage(canvasA, 0, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(canvasB, 0, 0);
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Remotion springTiming physics solver (durationInFrames: 45, damping: 200, threshold: 0.0001)
   */
  private remotionSpringEasing(p: number, damping = 200): number {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    // Damped harmonic oscillator with damping 200
    // Yields smooth, organic settling with micro-recoil
    const omega = 14.0;
    const decay = (damping / 200) * 5.8;
    const val = 1.0 - Math.exp(-decay * p) * Math.cos(omega * (1.0 - p) * 0.5);
    return Math.min(1.0, Math.max(0.0, val));
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
