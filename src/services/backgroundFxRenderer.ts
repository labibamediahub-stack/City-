/**
 * Background FX Engine for Video Timeline Slideshow
 * Replicates and renders visual background effects from the reference video (kiki_d90fedb0.mp4)
 * with seamless continuous looping for any video duration.
 */

export interface BackgroundFxOption {
  id: string;
  name: string; // Strictly 2-word English name
}

export const BACKGROUND_FX_OPTIONS: BackgroundFxOption[] = [
  { id: 'ambient_blur', name: 'Ambient Blur' },
  { id: 'reference_video', name: 'Reference Video' },
  { id: 'starlight_dust', name: 'Starlight Dust' },
  { id: 'floral_burst', name: 'Floral Burst' },
  { id: 'golden_glitter', name: 'Golden Glitter' },
  { id: 'cinema_bokeh', name: 'Cinema Bokeh' },
  { id: 'crystal_snow', name: 'Crystal Snow' },
  { id: 'prism_aura', name: 'Prism Aura' },
  { id: 'cosmic_sparkle', name: 'Cosmic Sparkle' },
  { id: 'dreamy_blur', name: 'Dreamy Blur' },
  { id: 'golden_rain', name: 'Golden Rain' }
];

import { getRenderPerformanceFlags } from './devicePerformance';

export class BackgroundFxRenderer {
  private static bokehSprites: HTMLCanvasElement[] | null = null;

  private static getBokehSprites(): HTMLCanvasElement[] {
    if (!this.bokehSprites && typeof document !== 'undefined') {
      const colors = [
        'rgba(239, 83, 80, 0.35)',
        'rgba(102, 187, 106, 0.35)',
        'rgba(255, 202, 40, 0.40)',
        'rgba(38, 198, 218, 0.35)',
        'rgba(255, 255, 255, 0.25)'
      ];
      this.bokehSprites = colors.map((color) => {
        const size = 64;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const cCtx = c.getContext('2d');
        if (cCtx) {
          const half = size / 2;
          const grad = cCtx.createRadialGradient(half, half, half * 0.45, half, half, half * 0.92);
          grad.addColorStop(0, color);
          grad.addColorStop(0.85, color);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          cCtx.fillStyle = grad;
          cCtx.beginPath();
          cCtx.arc(half, half, half * 0.92, 0, Math.PI * 2);
          cCtx.fill();
          cCtx.strokeStyle = color;
          cCtx.lineWidth = 1.2;
          cCtx.beginPath();
          cCtx.arc(half, half, half * 0.85, 0, Math.PI * 2);
          cCtx.stroke();
        }
        return c;
      });
    }
    return this.bokehSprites || [];
  }
  /**
   * Render background effect onto target canvas context at time `t`.
   * Loops seamlessly for any total video duration.
   */
  public static renderBackground(
    ctx: CanvasRenderingContext2D,
    effectId: string,
    time: number,
    w: number,
    h: number,
    bgVideoElement?: HTMLVideoElement | null
  ): void {
    ctx.save();

    // 1. If Reference Video is selected and video element is ready, draw it
    if (effectId === 'reference_video' && bgVideoElement && (bgVideoElement.readyState >= 1 || bgVideoElement.videoWidth > 0)) {
      try {
        ctx.drawImage(bgVideoElement, 0, 0, w, h);
        // Subtle cinematic vignette to keep center photos readable
        const rad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        rad.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
        rad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        return;
      } catch (_) {
        // Fallback to procedural starlight dust if video decode is unavailable
      }
    }

    // 2. Procedural effects matching reference video segments
    switch (effectId) {
      case 'floral_burst':
        this.renderFloralBurst(ctx, time, w, h);
        break;

      case 'golden_glitter':
        this.renderGoldenGlitter(ctx, time, w, h);
        break;

      case 'cinema_bokeh':
        this.renderCinemaBokeh(ctx, time, w, h);
        break;

      case 'crystal_snow':
        this.renderCrystalSnow(ctx, time, w, h);
        break;

      case 'prism_aura':
        this.renderPrismAura(ctx, time, w, h);
        break;

      case 'cosmic_sparkle':
        this.renderCosmicSparkle(ctx, time, w, h);
        break;

      case 'dreamy_blur':
        this.renderDreamyBlur(ctx, time, w, h);
        break;

      case 'golden_rain':
        this.renderGoldenRain(ctx, time, w, h);
        break;

      case 'none':
        ctx.fillStyle = '#070b14';
        ctx.fillRect(0, 0, w, h);
        break;

      case 'reference_video':
      case 'starlight_dust':
      default:
        this.renderStarlightDust(ctx, time, w, h);
        break;
    }

    ctx.restore();
  }

  /**
   * 1. Starlight Dust (Matching reference video 0-15s):
   * Atmospheric teal-slate background with drifting twinkling 4-point star sparkles
   */
  private static renderStarlightDust(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    // Teal-slate gradient backdrop from reference video
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#36535f');
    bgGrad.addColorStop(0.5, '#2e4954');
    bgGrad.addColorStop(1, '#233942');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const count = Math.round(45 * getRenderPerformanceFlags().particleScale);
    for (let i = 0; i < count; i++) {
      const seed = i * 137.5;
      const speed = 0.08 + (i % 5) * 0.04;
      const px = ((seed + time * 18 * speed) % (w + 40)) - 20;
      const py = ((seed * 1.7 + Math.sin(time * 0.8 + i) * 25 + time * 12 * speed) % (h + 40)) - 20;
      const tw = (Math.sin(time * 2.5 + i * 2.1) + 1) / 2;
      const size = (1.5 + (i % 4) * 1.2) * (0.6 + 0.4 * tw);

      ctx.save();
      ctx.translate(px, py);

      // Star core with hardware-accelerated concentric glow circles (100x faster than shadowBlur)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + 0.25 * tw})`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.65 + 0.35 * tw})`;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      // 4-point cross diffraction spike for larger stars
      if (i % 3 === 0) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.45 * tw})`;
        ctx.lineWidth = 1;
        const spike = size * 3.5;
        ctx.beginPath();
        ctx.moveTo(-spike, 0);
        ctx.lineTo(spike, 0);
        ctx.moveTo(0, -spike);
        ctx.lineTo(0, spike);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * 2. Floral Burst (Matching reference video 15-30s):
   * Glowing pink floral starburst particles framing the video perimeter
   */
  private static renderFloralBurst(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
    bgGrad.addColorStop(0, '#2d4b53');
    bgGrad.addColorStop(1, '#1b2f35');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const perimeterCount = Math.round(36 * getRenderPerformanceFlags().particleScale);
    for (let i = 0; i < perimeterCount; i++) {
      const angle = (i / perimeterCount) * Math.PI * 2;
      const rx = (w * 0.44) + Math.sin(time * 0.5 + i) * 15;
      const ry = (h * 0.42) + Math.cos(time * 0.5 + i) * 12;
      const cx = w / 2 + Math.cos(angle) * rx;
      const cy = h / 2 + Math.sin(angle) * ry;

      const pulse = (Math.sin(time * 3 + i * 1.5) + 1) / 2;
      const burstSize = 14 + (i % 3) * 6 + pulse * 6;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.3 + i);

      // Multi-petal starburst
      const petals = 8 + (i % 4) * 2;
      ctx.strokeStyle = `rgba(244, 143, 177, ${0.5 + 0.45 * pulse})`;
      ctx.lineWidth = 1.4;
      for (let p = 0; p < petals; p++) {
        const pAngle = (p / petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(pAngle) * burstSize, Math.sin(pAngle) * burstSize);
        ctx.stroke();
      }

      // Soft ambient aura
      ctx.fillStyle = `rgba(244, 143, 177, ${0.2 + 0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Center bright core
      ctx.fillStyle = `rgba(255, 235, 238, ${0.8 + 0.2 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 3. Golden Glitter (Matching reference video 30-45s):
   * Golden sequins/petals falling gently with 4-point flare sparkles
   */
  private static renderGoldenGlitter(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#2e4952');
    bgGrad.addColorStop(1, '#1e333a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const count = Math.round(50 * getRenderPerformanceFlags().particleScale);
    for (let i = 0; i < count; i++) {
      const seed = i * 223.7;
      const speed = 0.5 + (i % 4) * 0.25;
      const px = (seed + Math.sin(time * 1.2 + i) * 40) % w;
      const py = (time * 50 * speed + seed * 1.3) % (h + 60) - 30;
      const rot = time * (1.5 + (i % 3)) + i;
      const scaleX = Math.cos(rot);
      const isCoin = i % 2 === 0;

      ctx.save();
      ctx.translate(px, py);

      if (isCoin) {
        // 3D spinning gold petal/disc
        ctx.scale(scaleX, 1);
        ctx.fillStyle = (i % 3 === 0) ? '#FFE082' : '#FFD54F';
        ctx.beginPath();
        ctx.arc(0, 0, 4 + (i % 3) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Sparkling star flare with dual glow
        const tw = (Math.sin(time * 3 + i) + 1) / 2;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.25 + 0.3 * tw})`;
        ctx.beginPath();
        ctx.arc(0, 0, 5 + tw * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 2 + tw * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * tw})`;
        ctx.lineWidth = 1;
        const arm = 6 + tw * 6;
        ctx.beginPath();
        ctx.moveTo(-arm, 0);
        ctx.lineTo(arm, 0);
        ctx.moveTo(0, -arm);
        ctx.lineTo(0, arm);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * 4. Cinema Bokeh (Matching reference video 45-60s):
   * Floating circular out-of-focus bokeh orbs in emerald, ruby, amber and cyan
   */
  private static renderCinemaBokeh(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#1c2d33');
    bgGrad.addColorStop(1, '#121c21');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const sprites = this.getBokehSprites();
    const orbs = Math.round(30 * getRenderPerformanceFlags().particleScale);
    for (let i = 0; i < orbs; i++) {
      const seed = i * 491.3;
      const speed = 0.2 + (i % 4) * 0.12;
      const ox = (seed + Math.cos(time * 0.4 + i) * 60) % w;
      const oy = ((seed * 1.5 - time * 25 * speed) % (h + 120)) - 60;
      const radius = 16 + (i % 6) * 10;
      const sprite = sprites[i % sprites.length];
      if (sprite) {
        ctx.drawImage(sprite, ox - radius, oy - radius, radius * 2, radius * 2);
      }
    }
  }

  /**
   * 5. Crystal Snow (Matching reference video 60-75s):
   * Glowing winter floral crystal flakes drifting downwards
   */
  private static renderCrystalSnow(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#2e4952');
    bgGrad.addColorStop(1, '#1b2c32');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const flakes = 35;
    for (let i = 0; i < flakes; i++) {
      const seed = i * 311.9;
      const speed = 0.3 + (i % 3) * 0.2;
      const fx = (seed + Math.sin(time * 0.9 + i) * 35) % w;
      const fy = (seed * 1.2 + time * 35 * speed) % (h + 50) - 25;
      const rot = time * 0.5 + i;
      const size = 6 + (i % 4) * 3;

      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rot);

      // 6-arm crystal snowflake
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.3;

      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * size, Math.sin(ang) * size);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * 6. Prism Aura:
   * Diagonal chromatic aurora sweeps with soft specular streaks
   */
  private static renderPrismAura(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const offset = (Math.sin(time * 0.8) + 1) / 2;
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#1a2936');
    bgGrad.addColorStop(0.5, '#203d4a');
    bgGrad.addColorStop(1, '#142229');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Dynamic rainbow aura band
    const bandX = (w * 0.5) + Math.sin(time * 0.6) * (w * 0.25);
    const auraGrad = ctx.createLinearGradient(bandX - 250, 0, bandX + 250, h);
    auraGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
    auraGrad.addColorStop(0.3, 'rgba(0, 229, 255, 0.18)');
    auraGrad.addColorStop(0.5, 'rgba(224, 64, 251, 0.22)');
    auraGrad.addColorStop(0.7, 'rgba(255, 215, 0, 0.16)');
    auraGrad.addColorStop(1, 'rgba(255, 64, 129, 0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * 7. Cosmic Sparkle:
   * Deep violet nebula background with radiant starry sparkle clusters
   */
  private static renderCosmicSparkle(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 50, w * 0.5, h * 0.5, w * 0.7);
    bgGrad.addColorStop(0, '#2d2146');
    bgGrad.addColorStop(0.6, '#171a2e');
    bgGrad.addColorStop(1, '#0e111c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const stars = 40;
    for (let i = 0; i < stars; i++) {
      const seed = i * 181.1;
      const sx = (seed * 1.5 + Math.sin(time * 0.4 + i) * 20) % w;
      const sy = (seed * 2.3 + Math.cos(time * 0.3 + i) * 20) % h;
      const tw = (Math.sin(time * 3.2 + i * 1.7) + 1) / 2;
      const r = 1.5 + (i % 3) * 1.5;

      ctx.save();
      ctx.translate(sx, sy);
      // Soft purple aura
      ctx.fillStyle = `rgba(179, 136, 255, ${0.25 + 0.25 * tw})`;
      ctx.beginPath();
      ctx.arc(0, 0, (r * 2.5) + tw * 2, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = (i % 2 === 0) ? '#D1C4E9' : '#B388FF';
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.7 + 0.3 * tw), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 8. Dreamy Blur:
   * Warm cinematic dual-tone vignette with soft pulsing color breathing
   */
  private static renderDreamyBlur(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    const breathe = (Math.sin(time * 1.2) + 1) / 2;
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, w * (0.2 + breathe * 0.05), w / 2, h / 2, w * 0.75);
    bgGrad.addColorStop(0, '#2c434c');
    bgGrad.addColorStop(0.6, '#1e3037');
    bgGrad.addColorStop(1, '#0e181c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft ambient motes
    for (let i = 0; i < 20; i++) {
      const seed = i * 277.3;
      const mx = (seed + Math.sin(time * 0.3 + i) * 50) % w;
      const my = (seed * 1.6 + Math.cos(time * 0.25 + i) * 40) % h;
      const mSize = 25 + (i % 4) * 20;
      ctx.save();
      ctx.fillStyle = `rgba(178, 223, 219, ${0.06 + 0.04 * Math.sin(time + i)})`;
      ctx.beginPath();
      ctx.arc(mx, my, mSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 9. Golden Rain:
   * Shimmering vertical gold streak rain lines falling with warm reflection
   */
  private static renderGoldenRain(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
    ctx.fillStyle = '#1e3137';
    ctx.fillRect(0, 0, w, h);

    const rainLines = Math.round(35 * getRenderPerformanceFlags().particleScale);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < rainLines; i++) {
      const seed = i * 163.7;
      const speed = 1.2 + (i % 4) * 0.4;
      const rx = (seed * 2.1) % w;
      const ry = (seed + time * 120 * speed) % (h + 80) - 40;
      const len = 18 + (i % 4) * 12;

      ctx.strokeStyle = 'rgba(255, 224, 130, 0.55)';
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx, ry + len);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(rx, ry + len * 0.65);
      ctx.lineTo(rx, ry + len);
      ctx.stroke();
    }
  }
}
