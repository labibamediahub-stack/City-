/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TrailerVideoEffectId =
  | 'none'
  | 'fire_sparks'
  | 'lightning'
  | 'black_noise'
  | 'vhs_glitch'
  | 'cinematic_flare'
  | 'film_scratch'
  | 'rain_storm'
  | 'golden_embers'
  | 'dark_smoke';

export interface TrailerVideoEffectOption {
  id: TrailerVideoEffectId;
  label: string;
}

/**
 * 10 Trailer Video-Only Effect Options:
 * 1 "No Effect" + 9 distinct video effects (applied ONLY to the video layer, never to video/photo frames).
 */
export const TRAILER_VIDEO_EFFECT_OPTIONS: TrailerVideoEffectOption[] = [
  { id: 'none', label: 'No Effect' },
  { id: 'fire_sparks', label: 'Fire Sparks' },
  { id: 'lightning', label: 'Lightning FX' },
  { id: 'black_noise', label: 'Black Noise' },
  { id: 'vhs_glitch', label: 'VHS Glitch' },
  { id: 'cinematic_flare', label: 'Cinema Flare' },
  { id: 'film_scratch', label: 'Film Scratch' },
  { id: 'rain_storm', label: 'Rain Storm' },
  { id: 'golden_embers', label: 'Golden Dust' },
  { id: 'dark_smoke', label: 'Dark Smoke' },
];

// Lazy cached small noise tile canvas for ultra-fast Black Noise rendering on mobile
let cachedNoiseTile: HTMLCanvasElement | null = null;

function getNoiseTileCanvas(): HTMLCanvasElement {
  if (cachedNoiseTile) return cachedNoiseTile;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const nCtx = tile.getContext('2d');
  if (nCtx) {
    const imgData = nCtx.createImageData(tile.width, tile.height);
    const data = imgData.data;
    let seed = 1337;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const r = (seed >>> 24) & 0xff;
      if (r > 215) {
        // Fine white/silver analog speck
        data[i] = 235;
        data[i + 1] = 238;
        data[i + 2] = 245;
        data[i + 3] = 95;
      } else if (r < 42) {
        // Dark black grain speck
        data[i] = 5;
        data[i + 1] = 6;
        data[i + 2] = 10;
        data[i + 3] = 155;
      } else {
        data[i] = 12;
        data[i + 1] = 12;
        data[i + 2] = 18;
        data[i + 3] = 28;
      }
    }
    nCtx.putImageData(imgData, 0, 0);
  }
  cachedNoiseTile = tile;
  return tile;
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Renders one of the 9 video-only effects directly onto a 2D canvas context.
 * Intended to be invoked AFTER drawing the video frame and BEFORE drawing any Video Frame / border.
 */
export function renderTrailerVideoEffect(
  ctx: CanvasRenderingContext2D,
  effectId: TrailerVideoEffectId | string,
  timeSec: number,
  w: number,
  h: number,
  opacity: number = 1
): void {
  const op = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
  if (!effectId || effectId === 'none' || effectId === 'Effects Off' || op <= 0.005 || w <= 0 || h <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = op;
  try {
    switch (effectId) {
      case 'fire_sparks': {
        // Warm subtle ember glow at bottom
        const bottomGlow = ctx.createLinearGradient(0, h * 0.68, 0, h);
        bottomGlow.addColorStop(0, 'rgba(255, 80, 0, 0)');
        bottomGlow.addColorStop(1, 'rgba(255, 90, 15, 0.20)');
        ctx.fillStyle = bottomGlow;
        ctx.fillRect(0, h * 0.68, w, h * 0.32);

        ctx.globalCompositeOperation = 'lighter';
        const sparkCount = 46;
        for (let i = 0; i < sparkCount; i++) {
          const speed = 0.22 + hash01(i + 1) * 0.34;
          const phase = (timeSec * speed + hash01(i * 3 + 7)) % 1;
          const baseX = hash01(i * 5 + 11) * w;
          const drift = Math.sin(timeSec * 2.2 + i * 1.9) * (w * 0.035);
          const x = (baseX + drift + w) % w;
          const y = h * (1.06 - phase * 1.15);
          const size = (1.3 + hash01(i * 7 + 3) * 2.8) * (w / 640);
          const alpha = Math.sin(phase * Math.PI) * 0.9;
          if (alpha <= 0.02) continue;

          // Outer orange glow
          ctx.fillStyle = `rgba(255, 102, 0, ${(alpha * 0.35).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, size * 2.4, 0, Math.PI * 2);
          ctx.fill();

          // Bright yellow-white ember core + slight streak
          ctx.fillStyle = `rgba(255, 224, 120, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(x, y, size * 0.8, size * 1.8, -0.15, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'lightning': {
        // Dramatic periodic storm flash + branching electric bolts
        const cycle = timeSec % 2.4;
        const strikeA = cycle > 0.15 && cycle < 0.38;
        const strikeB = cycle > 1.25 && cycle < 1.44;
        const activeStrike = strikeA || strikeB;

        // Subtle cool storm tint on video
        ctx.fillStyle = 'rgba(14, 24, 48, 0.16)';
        ctx.fillRect(0, 0, w, h);

        if (activeStrike) {
          const localP = strikeA ? (cycle - 0.15) / 0.23 : (cycle - 1.25) / 0.19;
          const flashAlpha = Math.sin(localP * Math.PI) * (strikeA ? 0.42 : 0.32);

          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(185, 225, 255, ${flashAlpha.toFixed(3)})`;
          ctx.fillRect(0, 0, w, h);

          // Draw 1-2 jagged lightning bolts
          const boltIndex = Math.floor(timeSec / 1.2);
          const startX = w * (0.2 + hash01(boltIndex * 13) * 0.6);
          let curX = startX;
          let curY = 0;
          const segments = 9;

          ctx.strokeStyle = `rgba(120, 210, 255, ${(flashAlpha * 1.4).toFixed(3)})`;
          ctx.lineWidth = Math.max(4, w * 0.008);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(curX, curY);

          const pts: Array<{ x: number; y: number }> = [{ x: curX, y: curY }];
          for (let s = 1; s <= segments; s++) {
            curY = (s / segments) * (h * 0.82);
            curX += (hash01(boltIndex * 31 + s * 7) - 0.5) * (w * 0.14);
            pts.push({ x: curX, y: curY });
            ctx.lineTo(curX, curY);
          }
          ctx.stroke();

          // White hot inner core
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.98, flashAlpha * 2.2).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.6, w * 0.003);
          ctx.beginPath();
          pts.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();

          // Small side branch
          if (pts.length > 4) {
            const branchStart = pts[3];
            ctx.lineWidth = Math.max(1.2, w * 0.0022);
            ctx.beginPath();
            ctx.moveTo(branchStart.x, branchStart.y);
            ctx.lineTo(branchStart.x + w * 0.06, branchStart.y + h * 0.11);
            ctx.lineTo(branchStart.x + w * 0.03, branchStart.y + h * 0.21);
            ctx.stroke();
          }
        }
        break;
      }

      case 'black_noise': {
        // Dark noir tint + animated analog grain noise tile + heavy dark vignette
        ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
        ctx.fillRect(0, 0, w, h);

        const tile = getNoiseTileCanvas();
        const frameBucket = Math.floor(timeSec * 24);
        const offX = -Math.floor(hash01(frameBucket * 11) * tile.width);
        const offY = -Math.floor(hash01(frameBucket * 19) * tile.height);
        const pattern = ctx.createPattern(tile, 'repeat');
        if (pattern) {
          ctx.save();
          ctx.translate(offX, offY);
          ctx.globalAlpha = 0.85 * op;
          ctx.fillStyle = pattern;
          ctx.fillRect(-offX, -offY, w + tile.width, h + tile.height);
          ctx.restore();
        }

        // Occasional dark static horizontal bands
        for (let b = 0; b < 3; b++) {
          const y = hash01(frameBucket * 7 + b * 23) * h;
          const bh = 2 + hash01(frameBucket + b) * 6;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(0, y, w, bh);
        }

        const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w * 0.65);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case 'vhs_glitch': {
        const tick = Math.floor(timeSec * 20);
        // Subtle CRT scanlines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        const lineStep = Math.max(3, Math.round(h / 110));
        for (let y = 0; y < h; y += lineStep * 2) {
          ctx.fillRect(0, y, w, 1);
        }

        // Sweeping tracking band
        const sweepY = ((timeSec * 0.35) % 1) * h;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(0, sweepY, w, h * 0.06);

        // RGB chromatic glitch strips
        ctx.globalCompositeOperation = 'lighter';
        for (let g = 0; g < 5; g++) {
          if (hash01(tick * 13 + g) > 0.55) {
            const gy = hash01(tick * 29 + g * 5) * h;
            const gh = 3 + hash01(tick + g * 9) * 14;
            const shift = (hash01(tick * 3 + g) - 0.5) * 40;
            ctx.fillStyle = 'rgba(255, 30, 80, 0.16)';
            ctx.fillRect(Math.max(0, shift), gy, w * 0.9, gh);
            ctx.fillStyle = 'rgba(0, 230, 255, 0.16)';
            ctx.fillRect(Math.max(0, -shift), gy + 1, w * 0.9, gh);
          }
        }
        break;
      }

      case 'cinematic_flare': {
        ctx.globalCompositeOperation = 'lighter';
        const sweep = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(timeSec * 0.75));
        const fx = w * sweep;
        const fy = h * (0.28 + 0.12 * Math.cos(timeSec * 0.55));

        const orb = ctx.createRadialGradient(fx, fy, 4, fx, fy, w * 0.36);
        orb.addColorStop(0, 'rgba(255, 238, 190, 0.42)');
        orb.addColorStop(0.35, 'rgba(255, 165, 65, 0.18)');
        orb.addColorStop(1, 'rgba(255, 120, 20, 0)');
        ctx.fillStyle = orb;
        ctx.fillRect(0, 0, w, h);

        // Anamorphic horizontal light streak
        const streak = ctx.createLinearGradient(0, fy, w, fy);
        streak.addColorStop(0, 'rgba(255, 195, 110, 0)');
        streak.addColorStop(Math.max(0.05, Math.min(0.95, sweep)), 'rgba(255, 235, 185, 0.34)');
        streak.addColorStop(1, 'rgba(255, 195, 110, 0)');
        ctx.fillStyle = streak;
        ctx.fillRect(0, fy - h * 0.025, w, h * 0.05);
        break;
      }

      case 'film_scratch': {
        const tick = Math.floor(timeSec * 16);
        // Subtle warm vintage projector tint
        ctx.fillStyle = 'rgba(120, 88, 45, 0.12)';
        ctx.fillRect(0, 0, w, h);

        // Vertical scratches
        for (let s = 0; s < 5; s++) {
          const sx = ((hash01(s * 17 + Math.floor(tick / 3)) * 0.9 + 0.05) + Math.sin(timeSec * 3 + s) * 0.01) * w;
          const alpha = 0.14 + hash01(tick + s * 11) * 0.24;
          ctx.strokeStyle = s % 2 === 0 ? `rgba(255, 245, 220, ${alpha.toFixed(2)})` : `rgba(20, 15, 10, ${alpha.toFixed(2)})`;
          ctx.lineWidth = s === 0 ? 1.5 : 1;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx + (hash01(tick + s) - 0.5) * 6, h);
          ctx.stroke();
        }

        // Dust flecks
        for (let d = 0; d < 14; d++) {
          const dx = hash01(tick * 7 + d * 19) * w;
          const dy = hash01(tick * 11 + d * 23) * h;
          const dr = 1 + hash01(d * 3 + tick) * 1.8;
          ctx.fillStyle = d % 3 === 0 ? 'rgba(255,245,220,0.35)' : 'rgba(15,12,10,0.45)';
          ctx.fillRect(dx, dy, dr, dr);
        }
        break;
      }

      case 'rain_storm': {
        ctx.fillStyle = 'rgba(10, 22, 38, 0.16)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(195, 225, 255, 0.34)';
        ctx.lineWidth = Math.max(1, w * 0.0016);
        ctx.lineCap = 'round';
        const dropCount = 72;
        const speed = 1.65;
        ctx.beginPath();
        for (let i = 0; i < dropCount; i++) {
          const p = (timeSec * speed + hash01(i * 13 + 5)) % 1;
          const startX = hash01(i * 29 + 3) * (w * 1.15);
          const x = startX - p * (w * 0.15);
          const y = p * (h * 1.15) - h * 0.08;
          const len = (14 + hash01(i * 7) * 20) * (h / 480);
          ctx.moveTo(x, y);
          ctx.lineTo(x - len * 0.22, y + len);
        }
        ctx.stroke();
        break;
      }

      case 'golden_embers': {
        ctx.globalCompositeOperation = 'lighter';
        const count = 34;
        for (let i = 0; i < count; i++) {
          const speed = 0.09 + hash01(i * 5 + 2) * 0.14;
          const p = (timeSec * speed + hash01(i * 11)) % 1;
          const x = ((hash01(i * 17) * w) + Math.sin(timeSec * 0.9 + i) * w * 0.04 + w) % w;
          const y = h * (1.05 - p * 1.1);
          const radius = (2.2 + hash01(i * 23) * 5.2) * (w / 640);
          const alpha = Math.sin(p * Math.PI) * 0.55;
          if (alpha <= 0.02) continue;

          ctx.fillStyle = `rgba(255, 200, 75, ${(alpha * 0.32).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, radius * 2.1, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 236, 150, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, radius * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'dark_smoke': {
        const wisps = 7;
        for (let i = 0; i < wisps; i++) {
          const drift = ((timeSec * (0.05 + i * 0.012) + hash01(i * 9)) % 1.4) - 0.2;
          const cx = w * drift;
          const cy = h * (0.62 + (i % 3) * 0.14 + Math.sin(timeSec * 0.6 + i) * 0.05);
          const r = w * (0.24 + (i % 2) * 0.1);
          const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
          g.addColorStop(0, 'rgba(18, 22, 34, 0.34)');
          g.addColorStop(0.55, 'rgba(10, 12, 20, 0.20)');
          g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }

      default:
        break;
    }
  } finally {
    ctx.restore();
  }
}
