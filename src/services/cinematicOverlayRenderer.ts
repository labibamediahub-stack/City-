/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getRenderPerformanceFlags } from './devicePerformance';

export interface OverlayStyleOption {
  id: string;
  name: string;
  nameBn: string;
  description: string;
  category: 'nature' | 'light' | 'cinematic' | 'particles';
}

export const OVERLAY_STYLE_OPTIONS: OverlayStyleOption[] = [
  {
    id: 'starlight_dust',
    name: 'Dust Overlay',
    nameBn: 'স্টারলাইট ডাস্ট (Dust)',
    description: 'ভাসমান গোল্ডেন স্টারলাইট ডাস্ট পার্টিকেলস',
    category: 'particles'
  },
  {
    id: 'crystal_snow',
    name: 'Snow Overlay',
    nameBn: 'ক্রিস্টাল স্নো (Snow)',
    description: 'ঝরঝরে সিনেমাটিক তুষারপাত ও ক্রিস্টাল উইন্ড ফ্লো',
    category: 'nature'
  },
  {
    id: 'golden_rain',
    name: 'Rain Overlay',
    nameBn: 'গোল্ডেন রেইন (Rain)',
    description: 'উষ্ণ প্রতিফলিত বৃষ্টির ধারা ও ড্রপলেটস',
    category: 'nature'
  },
  {
    id: 'cosmic_particle',
    name: 'Particle Overlay',
    nameBn: 'পার্টিকেল স্পার্কল (Particle)',
    description: 'কসমিক উজ্জ্বল গ্লোয়িং স্পার্কল ও ভাসমান কণা',
    category: 'particles'
  },
  {
    id: 'cinematic_light',
    name: 'Cinematic Light Overlay',
    nameBn: 'সিনেমাটিক লাইট (Light)',
    description: 'ড্রিম অ্যানামরফিক লাইট স্ট্রিম ও রেইডিয়ান্ট আভা',
    category: 'light'
  },
  {
    id: 'cinema_bokeh',
    name: 'Bokeh Overlay',
    nameBn: 'সিনেমা বোকেহ (Bokeh)',
    description: 'সফট ড্রিম গোল্ডেন বোকেহ ডিস্ক ও ফোকাস ব্লুম',
    category: 'light'
  },
  {
    id: 'film_grain',
    name: 'Film Grain Overlay',
    nameBn: '৩৫মিমি ফিল্ম গ্রেইন (Grain)',
    description: 'অর্গানিক হলিউড ৩৫মিমি এনালগ গ্রেইন টেক্সচার',
    category: 'cinematic'
  },
  {
    id: 'light_leak',
    name: 'Light Leak Overlay',
    nameBn: 'লাইট লিক সোয়াইপ (Light Leak)',
    description: 'উষ্ণ অ্যানামরফিক সান-ফ্লেয়ার ও সুইপিং লাইট লিক',
    category: 'light'
  },
  {
    id: 'lens_flare',
    name: 'Lens Flare Overlay',
    nameBn: 'অ্যানামরফিক লেন্স ফ্লেয়ার (Flare)',
    description: 'হরাইজন্টাল ব্লু/গোল্ডেন অ্যানামরফিক লেন্স ফ্লেয়ার',
    category: 'light'
  },
  {
    id: 'dreamy_fog',
    name: 'Fog Overlay',
    nameBn: 'সিনেমাটিক ফগ ও মিস্ট (Fog)',
    description: 'বায়ুমণ্ডলীয় মৃদু কুয়াশা ও রোলিং মিস্ট',
    category: 'nature'
  },
  {
    id: 'floral_burst',
    name: 'Floral Burst Overlay',
    nameBn: 'ফ্লোরাল স্টারবার্স্ট (Floral)',
    description: 'চারপাশে নরম রোমান্টিক পাপড়ি ও গ্লো স্পার্কস',
    category: 'nature'
  },
  {
    id: 'none',
    name: 'None (Disabled)',
    nameBn: 'কোনো ওভারলে নেই (Off)',
    description: 'ওভারলে নিষ্ক্রিয় রাখুন',
    category: 'cinematic'
  }
];

/**
 * Universal Shared Real-Time Overlay Renderer
 * Faithful rendering across Live Preview, Timeline Playback, and Final Video Export.
 * Renders directly ON TOP of the composited video frame.
 */
export class CinematicOverlayRenderer {
  // Pre-rendered sprite cache for high-speed GPU blitting
  private static snowflakeSprite: HTMLCanvasElement | null = null;
  private static bokehSprite: HTMLCanvasElement | null = null;
  private static cosmicParticleSprite: HTMLCanvasElement | null = null;
  private static dustSprite: HTMLCanvasElement | null = null;
  private static petalSprite: HTMLCanvasElement | null = null;
  private static grainPattern: CanvasPattern | null = null;

  private static getSnowflakeSprite(): HTMLCanvasElement {
    if (!this.snowflakeSprite && typeof document !== 'undefined') {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        const cx = size / 2;
        const cy = size / 2;
        const r = size * 0.42;
        for (let a = 0; a < 6; a++) {
          const angle = (a * Math.PI) / 3;
          const x2 = cx + Math.cos(angle) * r;
          const y2 = cy + Math.sin(angle) * r;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Small crystal branches
          const bx = cx + Math.cos(angle) * (r * 0.55);
          const by = cy + Math.sin(angle) * (r * 0.55);
          const bAngle1 = angle + Math.PI / 4;
          const bAngle2 = angle - Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(bAngle1) * (r * 0.35), by + Math.sin(bAngle1) * (r * 0.35));
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(bAngle2) * (r * 0.35), by + Math.sin(bAngle2) * (r * 0.35));
          ctx.stroke();
        }
      }
      this.snowflakeSprite = canvas;
    }
    return this.snowflakeSprite || document.createElement('canvas');
  }

  private static getBokehSprite(): HTMLCanvasElement {
    if (!this.bokehSprite && typeof document !== 'undefined') {
      const size = 48;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        rad.addColorStop(0, 'rgba(255, 245, 215, 0.95)');
        rad.addColorStop(0.35, 'rgba(255, 195, 95, 0.7)');
        rad.addColorStop(0.75, 'rgba(255, 150, 40, 0.22)');
        rad.addColorStop(1, 'rgba(255, 150, 40, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      this.bokehSprite = canvas;
    }
    return this.bokehSprite || document.createElement('canvas');
  }

  private static getCosmicParticleSprite(): HTMLCanvasElement {
    if (!this.cosmicParticleSprite && typeof document !== 'undefined') {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        rad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        rad.addColorStop(0.3, 'rgba(200, 225, 255, 0.8)');
        rad.addColorStop(1, 'rgba(150, 100, 255, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      this.cosmicParticleSprite = canvas;
    }
    return this.cosmicParticleSprite || document.createElement('canvas');
  }

  private static getDustSprite(): HTMLCanvasElement {
    if (!this.dustSprite && typeof document !== 'undefined') {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        rad.addColorStop(0, 'rgba(255, 240, 180, 1)');
        rad.addColorStop(0.4, 'rgba(255, 190, 80, 0.7)');
        rad.addColorStop(1, 'rgba(255, 140, 40, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      this.dustSprite = canvas;
    }
    return this.dustSprite || document.createElement('canvas');
  }

  private static getPetalSprite(): HTMLCanvasElement {
    if (!this.petalSprite && typeof document !== 'undefined') {
      const size = 36;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(size / 2, size / 2);
        const rad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.45);
        rad.addColorStop(0, 'rgba(255, 200, 220, 0.95)');
        rad.addColorStop(0.6, 'rgba(255, 140, 180, 0.6)');
        rad.addColorStop(1, 'rgba(255, 140, 180, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.45, size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      this.petalSprite = canvas;
    }
    return this.petalSprite || document.createElement('canvas');
  }

  private static getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (!this.grainPattern && typeof document !== 'undefined') {
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const nCtx = canvas.getContext('2d');
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
        this.grainPattern = ctx.createPattern(canvas, 'repeat');
      }
    }
    return this.grainPattern;
  }

  /**
   * Main Overlay Render Function:
   * Paints chosen overlay style directly on top of the video canvas context.
   */
  public static renderOverlay(
    ctx: CanvasRenderingContext2D,
    overlayId: string = 'starlight_dust',
    time: number,
    w: number,
    h: number
  ): void {
    if (!overlayId || overlayId === 'none') return;

    ctx.save();

    switch (overlayId) {
      case 'crystal_snow':
      case 'snow':
        this.renderSnow(ctx, time, w, h);
        break;

      case 'golden_rain':
      case 'rain':
        this.renderRain(ctx, time, w, h);
        break;

      case 'cosmic_particle':
      case 'particle':
        this.renderParticles(ctx, time, w, h);
        break;

      case 'cinematic_light':
      case 'prism_aura':
        this.renderCinematicLight(ctx, time, w, h);
        break;

      case 'cinema_bokeh':
      case 'bokeh':
        this.renderBokeh(ctx, time, w, h);
        break;

      case 'film_grain':
        this.renderFilmGrain(ctx, time, w, h);
        break;

      case 'light_leak':
        this.renderLightLeak(ctx, time, w, h);
        break;

      case 'lens_flare':
        this.renderLensFlare(ctx, time, w, h);
        break;

      case 'dreamy_fog':
      case 'fog':
        this.renderFog(ctx, time, w, h);
        break;

      case 'floral_burst':
        this.renderFloralBurst(ctx, time, w, h);
        break;

      case 'starlight_dust':
      case 'dust':
      default:
        this.renderStarlightDust(ctx, time, w, h);
        break;
    }

    ctx.restore();
  }

  // 1. Crystal Snow Overlay
  private static renderSnow(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const sprite = this.getSnowflakeSprite();
    ctx.globalCompositeOperation = 'screen';
    const flakeCount = Math.round(42 * getRenderPerformanceFlags().particleScale);

    for (let i = 0; i < flakeCount; i++) {
      const seed = (i * 97.3) % 1;
      const speed = 0.065 + (i % 6) * 0.025;
      const t = (time * speed + seed) % 1;
      const sway = Math.sin(time * 1.4 + i * 1.7) * 28;
      const x = (((i * 123.7) % w) + sway + w) % w;
      const y = t * (h + 40) - 20;
      const size = 12 + (i % 5) * 5;
      const alpha = Math.sin(t * Math.PI) * (0.45 + (i % 3) * 0.2);

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  }

  // 2. Golden Rain Overlay
  private static renderRain(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    ctx.globalCompositeOperation = 'screen';
    const rainCount = Math.round(48 * getRenderPerformanceFlags().particleScale);

    for (let i = 0; i < rainCount; i++) {
      const seed = (i * 73.1) % 1;
      const speed = 0.45 + (i % 4) * 0.15;
      const t = (time * speed + seed) % 1;
      const slant = 18;
      const x = ((i * 37.9) % w) + t * slant;
      const y = t * (h + 80) - 40;
      const len = 35 + (i % 4) * 25;
      const alpha = (0.25 + (i % 3) * 0.15) * Math.sin(t * Math.PI);

      ctx.strokeStyle = `rgba(255, 220, 140, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + slant * 0.3, y + len);
      ctx.stroke();
    }
  }

  // 3. Cosmic Particles Overlay
  private static renderParticles(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const sprite = this.getCosmicParticleSprite();
    ctx.globalCompositeOperation = 'screen';
    const count = Math.round(36 * getRenderPerformanceFlags().particleScale);

    for (let i = 0; i < count; i++) {
      const seed = i * 47.9;
      const speed = 0.04 + (i % 5) * 0.02;
      const t = (time * speed + (i * 0.28)) % 1;
      const x = ((seed * 11.3) % w) + Math.cos(time * 0.8 + i) * 25;
      const y = h * (1 - t);
      const rad = 2.5 + (i % 4) * 2.5;
      const size = rad * 6;
      const alpha = Math.sin(t * Math.PI) * 0.7;

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  }

  // 4. Cinematic Light Overlay
  private static renderCinematicLight(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    ctx.globalCompositeOperation = 'screen';
    const cycle = (time * 0.08) % 1;
    const sweepX = w * (0.2 + Math.sin(cycle * Math.PI * 2) * 0.35);
    const sweepY = h * 0.25;

    // Radiant anamorphic sun-shaft aura
    const grad = ctx.createRadialGradient(sweepX, sweepY, 20, sweepX, sweepY, w * 0.75);
    grad.addColorStop(0, 'rgba(255, 235, 175, 0.38)');
    grad.addColorStop(0.35, 'rgba(255, 160, 80, 0.22)');
    grad.addColorStop(0.7, 'rgba(140, 180, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal beam
    const beamGrad = ctx.createLinearGradient(0, sweepY - 30, 0, sweepY + 30);
    beamGrad.addColorStop(0, 'rgba(255, 240, 200, 0)');
    beamGrad.addColorStop(0.5, 'rgba(255, 240, 200, 0.25)');
    beamGrad.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, sweepY - 30, w, 60);
  }

  // 5. Cinema Bokeh Overlay
  private static renderBokeh(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const sprite = this.getBokehSprite();
    ctx.globalCompositeOperation = 'screen';
    const count = Math.round(28 * getRenderPerformanceFlags().particleScale);

    for (let i = 0; i < count; i++) {
      const seed = i * 137.5;
      const speed = 0.03 + (i % 5) * 0.015;
      const t = (time * speed + (i * 0.35)) % 1;
      const x = ((seed * 7.3) % w) + Math.sin(time * 0.6 + i) * 35;
      const y = h * (1 - t);
      const size = 16 + (i % 6) * 14;
      const alpha = Math.sin(t * Math.PI) * (0.3 + (i % 4) * 0.12);

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  }

  // 6. Film Grain Overlay
  private static renderFilmGrain(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const pattern = this.getGrainPattern(ctx);
    if (!pattern) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.11;
    const shiftX = (Math.sin(time * 23.7) * 40);
    const shiftY = (Math.cos(time * 31.3) * 40);
    ctx.translate(shiftX, shiftY);
    ctx.fillStyle = pattern;
    ctx.fillRect(-60, -60, w + 120, h + 120);
    ctx.restore();
  }

  // 7. Light Leak Overlay
  private static renderLightLeak(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    ctx.globalCompositeOperation = 'screen';
    const cycle = (time * 0.12) % 1;
    const pulse = 0.28 + Math.sin(time * 1.5) * 0.12;
    const x = w * (0.15 + Math.sin(cycle * Math.PI * 2) * 0.4);
    const y = h * 0.2;

    const rad = ctx.createRadialGradient(x, y, 10, x, y, w * 0.65);
    rad.addColorStop(0, `rgba(255, 215, 120, ${pulse})`);
    rad.addColorStop(0.35, `rgba(255, 125, 45, ${pulse * 0.65})`);
    rad.addColorStop(0.7, `rgba(180, 60, 240, ${pulse * 0.25})`);
    rad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  }

  // 8. Lens Flare Overlay
  private static renderLensFlare(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    ctx.globalCompositeOperation = 'screen';
    const cycle = (time * 0.09) % 1;
    const cx = w * (0.2 + Math.sin(cycle * Math.PI * 2) * 0.35);
    const cy = h * 0.35;

    // Core bright star
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    core.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    core.addColorStop(0.2, 'rgba(160, 220, 255, 0.6)');
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal Anamorphic Streak across whole width
    const streakH = 14;
    const sGrad = ctx.createLinearGradient(0, cy - streakH, 0, cy + streakH);
    sGrad.addColorStop(0, 'rgba(80, 180, 255, 0)');
    sGrad.addColorStop(0.5, 'rgba(180, 240, 255, 0.7)');
    sGrad.addColorStop(1, 'rgba(80, 180, 255, 0)');
    ctx.fillStyle = sGrad;
    ctx.fillRect(0, cy - streakH, w, streakH * 2);
  }

  // 9. Fog Overlay
  private static renderFog(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    ctx.globalCompositeOperation = 'screen';
    const fogLayers = 3;
    for (let l = 0; l < fogLayers; l++) {
      const speed = 0.03 + l * 0.02;
      const drift = (time * speed * w) % w;
      const alpha = 0.12 + Math.sin(time * 0.5 + l) * 0.04;

      const grad = ctx.createLinearGradient(0, h * (0.4 + l * 0.2), 0, h);
      grad.addColorStop(0, 'rgba(210, 225, 245, 0)');
      grad.addColorStop(0.6, `rgba(220, 235, 250, ${alpha})`);
      grad.addColorStop(1, `rgba(200, 215, 235, ${alpha * 1.5})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.35, w, h * 0.65);
    }
  }

  // 10. Floral Burst Overlay
  private static renderFloralBurst(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const sprite = this.getPetalSprite();
    ctx.globalCompositeOperation = 'screen';
    const petalCount = Math.round(30 * getRenderPerformanceFlags().particleScale);
    for (let i = 0; i < petalCount; i++) {
      const seed = i * 61.7;
      const speed = 0.05 + (i % 4) * 0.02;
      const t = (time * speed + (i * 0.33)) % 1;
      const x = ((seed * 13.9) % w) + Math.sin(time * 0.9 + i) * 30;
      const y = t * (h + 30) - 15;
      const size = (10 + (i % 5) * 5) * 2.2;
      const alpha = Math.sin(t * Math.PI) * 0.45;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(x, y);
      ctx.rotate(time * 0.8 + i);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  // 11. Starlight Dust Overlay (Default)
  private static renderStarlightDust(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const sprite = this.getDustSprite();
    ctx.globalCompositeOperation = 'screen';
    const dustCount = Math.round(38 * getRenderPerformanceFlags().particleScale);

    for (let i = 0; i < dustCount; i++) {
      const seed = i * 83.1;
      const speed = 0.04 + (i % 5) * 0.02;
      const t = (time * speed + (i * 0.25)) % 1;
      const x = ((seed * 19.3) % w) + Math.sin(time * 0.8 + i) * 22;
      const y = h * (1 - t);
      const rad = 2 + (i % 4) * 2.2;
      const size = rad * 7;
      const alpha = Math.sin(t * Math.PI) * (0.4 + (i % 3) * 0.2);

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  }
}
