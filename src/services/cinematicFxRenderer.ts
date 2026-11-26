/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorGradingPreset } from '../types/timeline';

export interface ColorGradingOption {
  id: ColorGradingPreset;
  label: string;
  banglaLabel: string;
  badge: string;
  filter: string;
  tintRgba?: string;
  blendMode?: GlobalCompositeOperation;
  singleWordName: string;
}

export const COLOR_GRADING_OPTIONS: ColorGradingOption[] = [
  {
    id: 'none',
    label: 'Natural',
    singleWordName: 'Natural',
    banglaLabel: 'আসল রং (Natural)',
    badge: 'Natural',
    filter: 'none'
  },
  {
    id: 'teal_orange',
    label: 'Cinematic',
    singleWordName: 'Cinematic',
    banglaLabel: 'হলিউড সিনেমা (Teal & Orange)',
    badge: 'Cinematic',
    filter: 'contrast(1.16) saturate(1.22) hue-rotate(-8deg)',
    tintRgba: 'rgba(230, 130, 40, 0.08)',
    blendMode: 'soft-light'
  },
  {
    id: 'warm_golden',
    label: 'Golden',
    singleWordName: 'Golden',
    banglaLabel: 'রোমান্টিক গোল্ডেন আওয়ার (Golden Romance)',
    badge: 'Golden',
    filter: 'sepia(0.22) saturate(1.28) brightness(1.04) contrast(1.1)',
    tintRgba: 'rgba(255, 175, 45, 0.12)',
    blendMode: 'soft-light'
  },
  {
    id: 'moody_noir',
    label: 'Moody',
    singleWordName: 'Moody',
    banglaLabel: 'সাসপেন্স থ্রিলার (Moody Thriller)',
    badge: 'Moody',
    filter: 'contrast(1.35) saturate(0.85) brightness(0.92)',
    tintRgba: 'rgba(10, 25, 45, 0.15)',
    blendMode: 'multiply'
  },
  {
    id: 'vintage_35mm',
    label: 'Vintage',
    singleWordName: 'Vintage',
    banglaLabel: '৩৫মিমি ক্লাসিক ভিন্টেজ (Vintage 35mm)',
    badge: 'Vintage',
    filter: 'sepia(0.35) contrast(1.12) brightness(1.02) saturate(0.92)',
    tintRgba: 'rgba(240, 220, 190, 0.1)',
    blendMode: 'screen'
  },
  {
    id: 'vivid_hd',
    label: 'Vivid',
    singleWordName: 'Vivid',
    banglaLabel: 'উজ্জ্বল ক্রিস্টাল এইচডি (Vivid HD)',
    badge: 'Vivid',
    filter: 'saturate(1.42) contrast(1.18) brightness(1.02)'
  }
];

export class CinematicFxRenderer {
  /**
   * Apply cinematic color grading filter and atmospheric tint
   */
  public static applyColorGrading(
    ctx: CanvasRenderingContext2D,
    preset: ColorGradingPreset = 'none',
    w: number,
    h: number
  ): void {
    if (!preset || preset === 'none') return;
    const option = COLOR_GRADING_OPTIONS.find((o) => o.id === preset);
    if (!option) return;

    ctx.save();
    // 1. Subtle tint overlay if configured
    if (option.tintRgba) {
      ctx.globalCompositeOperation = option.blendMode || 'soft-light';
      ctx.fillStyle = option.tintRgba;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Subtle Vignette for cinematic focus
    if (preset === 'moody_noir' || preset === 'teal_orange') {
      ctx.globalCompositeOperation = 'multiply';
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, preset === 'moody_noir' ? 'rgba(0, 0, 0, 0.42)' : 'rgba(0, 0, 0, 0.22)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  /**
   * Render atmospheric anamorphic light leaks and golden sun flare sweeps
   */
  public static renderLightLeaks(
    ctx: CanvasRenderingContext2D,
    time: number,
    inTransition: boolean,
    transProgress: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Cycle flare positions smoothly across time
    const cycle = (time % 12) / 12; // 0 to 1 every 12 seconds
    const leakStrength = inTransition ? Math.sin(transProgress * Math.PI) * 0.45 + 0.15 : 0.15;

    // Flare Center
    const flareX = inTransition
      ? w * (0.1 + transProgress * 0.8)
      : w * (0.2 + Math.sin(cycle * Math.PI * 2) * 0.3);
    const flareY = h * (0.15 + Math.cos(cycle * Math.PI * 2) * 0.1);

    // Main Warm Light Leak
    const grad1 = ctx.createRadialGradient(flareX, flareY, 10, flareX, flareY, w * 0.6);
    grad1.addColorStop(0, `rgba(255, 210, 140, ${leakStrength})`);
    grad1.addColorStop(0.35, `rgba(255, 130, 60, ${leakStrength * 0.55})`);
    grad1.addColorStop(0.7, `rgba(180, 70, 255, ${leakStrength * 0.2})`);
    grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, w, h);

    // Subtle Anamorphic Horizontal Flare Streak
    const streakH = h * 0.08;
    const streakGrad = ctx.createLinearGradient(0, flareY - streakH, 0, flareY + streakH);
    streakGrad.addColorStop(0, 'rgba(120, 200, 255, 0)');
    streakGrad.addColorStop(0.5, `rgba(180, 230, 255, ${leakStrength * 0.4})`);
    streakGrad.addColorStop(1, 'rgba(120, 200, 255, 0)');

    ctx.fillStyle = streakGrad;
    ctx.fillRect(0, flareY - streakH, w, streakH * 2);

    ctx.restore();
  }

  /**
   * Render 2.35:1 Ultra-Wide Cinema Letterbox Bars
   */
  public static renderLetterbox(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 2.35:1 cinema ratio on 16:9 canvas -> letterbox bar height is approx 12.5% on top & bottom
    const barH = Math.round(h * 0.115);
    ctx.save();
    ctx.fillStyle = '#05070a';
    // Top bar
    ctx.fillRect(0, 0, w, barH);
    // Bottom bar
    ctx.fillRect(0, h - barH, w, barH);

    // Elegant subtle golden accent hairline
    ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.fillRect(0, barH - 1, w, 1);
    ctx.fillRect(0, h - barH, w, 1);

    ctx.restore();
  }

  // Pre-rendered Ambient Blurred Backdrop Cache (keyed by HTMLImageElement src)
  private static backdropCache: Map<string, HTMLCanvasElement> = new Map();
  private static readonly MAX_BACKDROP_CACHE = 14;

  /**
   * Pre-render or retrieve ultra-fast cached ambient blurred backdrop.
   * Renders at 320x180 once per image, providing fast GPU blit without unbounded RAM growth.
   */
  public static getOrCreateAmbientBackdrop(
    img: HTMLImageElement | null,
    w: number,
    h: number
  ): HTMLCanvasElement | null {
    if (!img || !img.complete || !img.naturalWidth || img.naturalWidth <= 0) return null;

    const cacheKey = img.src || `${img.naturalWidth}x${img.naturalHeight}`;
    const cached = this.backdropCache.get(cacheKey);
    if (cached) {
      this.backdropCache.delete(cacheKey);
      this.backdropCache.set(cacheKey, cached);
      return cached;
    }

    // Create downscaled canvas for superfast 0.5ms blur + hardware anti-aliasing
    const bw = 320;
    const bh = 180;
    const bCanvas = document.createElement('canvas');
    bCanvas.width = bw;
    bCanvas.height = bh;
    const bCtx = bCanvas.getContext('2d');
    if (!bCtx) return null;

    try {
      bCtx.filter = 'blur(10px) brightness(0.62) saturate(1.35)';
      const scale = 1.15;
      const drawW = bw * scale;
      const drawH = bh * scale;
      const offsetX = (bw - drawW) / 2;
      const offsetY = (bh - drawH) / 2;
      bCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
    } catch (_) {
      bCtx.drawImage(img, 0, 0, bw, bh);
    }

    // Soft radial vignette baked directly into the cache
    bCtx.filter = 'none';
    const rad = bCtx.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.32, bw / 2, bh / 2, Math.max(bw, bh) * 0.78);
    rad.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    bCtx.fillStyle = rad;
    bCtx.fillRect(0, 0, bw, bh);

    // Limit cache size with explicit GPU texture release on eviction
    while (this.backdropCache.size >= this.MAX_BACKDROP_CACHE) {
      const firstKey = this.backdropCache.keys().next().value;
      if (!firstKey) break;
      const oldCanvas = this.backdropCache.get(firstKey);
      if (oldCanvas) {
        oldCanvas.width = 0;
        oldCanvas.height = 0;
      }
      this.backdropCache.delete(firstKey);
    }

    this.backdropCache.set(cacheKey, bCanvas);
    return bCanvas;
  }

  public static clearBackdropCache(): void {
    for (const c of this.backdropCache.values()) {
      c.width = 0;
      c.height = 0;
    }
    this.backdropCache.clear();
  }

  /**
   * Render dynamic Frosted Glass / Ambient Blurred Backdrop from the active photo.
   * Utilizes pre-rendered GPU canvas cache for instant sub-millisecond drawing.
   */
  public static renderAmbientBackdrop(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    w: number,
    h: number
  ): void {
    if (!img) return;
    const cached = this.getOrCreateAmbientBackdrop(img, w, h);
    if (cached) {
      ctx.drawImage(cached, 0, 0, w, h);
      return;
    }

    // Direct fallback if cache creation failed
    ctx.save();
    try {
      ctx.filter = 'blur(16px) brightness(0.62) saturate(1.35)';
      const scale = 1.15;
      const drawW = w * scale;
      const drawH = h * scale;
      ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
    } catch (_) {}
    ctx.restore();
  }

  // Cached noise pattern for 35mm film grain
  private static noisePattern: CanvasPattern | null = null;

  private static getNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (!this.noisePattern && typeof document !== 'undefined') {
      const size = 160;
      const nCanvas = document.createElement('canvas');
      nCanvas.width = size;
      nCanvas.height = size;
      const nCtx = nCanvas.getContext('2d');
      if (nCtx) {
        const imgData = nCtx.createImageData(size, size);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = Math.floor(Math.random() * 255);
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
          d[i + 3] = 40;
        }
        nCtx.putImageData(imgData, 0, 0);
        this.noisePattern = ctx.createPattern(nCanvas, 'repeat');
      }
    }
    return this.noisePattern;
  }

  /**
   * Render organic 35mm Hollywood film grain with live flutter
   */
  public static renderFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    const pattern = this.getNoisePattern(ctx);
    if (pattern) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.085;
      const shiftX = (Math.random() - 0.5) * 80;
      const shiftY = (Math.random() - 0.5) * 80;
      ctx.translate(shiftX, shiftY);
      ctx.fillStyle = pattern;
      ctx.fillRect(-80, -80, w + 160, h + 160);
    }
    ctx.restore();
  }

  // Pre-rendered high-performance bokeh glow particle sprite
  private static bokehSprite: HTMLCanvasElement | null = null;

  private static getBokehSprite(): HTMLCanvasElement {
    if (!this.bokehSprite && typeof document !== 'undefined') {
      const size = 32;
      const bCanvas = document.createElement('canvas');
      bCanvas.width = size;
      bCanvas.height = size;
      const bCtx = bCanvas.getContext('2d');
      if (bCtx) {
        const rad = bCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        rad.addColorStop(0, 'rgba(255, 240, 195, 1)');
        rad.addColorStop(0.35, 'rgba(255, 185, 85, 0.75)');
        rad.addColorStop(0.75, 'rgba(255, 140, 40, 0.25)');
        rad.addColorStop(1, 'rgba(255, 140, 40, 0)');
        bCtx.fillStyle = rad;
        bCtx.beginPath();
        bCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        bCtx.fill();
      }
      this.bokehSprite = bCanvas;
    }
    return this.bokehSprite || document.createElement('canvas');
  }

  /**
   * Render floating golden bokeh dust particles using ultra-fast GPU blitting
   */
  public static renderBokehDust(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const sprite = this.getBokehSprite();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const particleCount = 24;
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 137.5;
      const speed = 0.035 + (i % 5) * 0.018;
      const t = (time * speed + (i * 0.38)) % 1;
      const x = ((seed * 7.1) % w) + Math.sin(time * 0.7 + i) * 32;
      const y = h * (1 - t);
      const size = 6 + (i % 5) * 5.5;
      const alpha = Math.sin(t * Math.PI) * (0.24 + (i % 4) * 0.1);

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }
}
