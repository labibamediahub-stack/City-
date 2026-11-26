import { AnimationCategory, TransitionType, RenderContext, PhotoFrameStyle } from '../types/timeline';
import { ANIMISTA_EFFECTS, getRandomAnimistaAnimation } from './animistaEffects';
import { VIDEO2_EFFECTS } from './video2Effects';
import {
  renderStyledPhotoCard,
  getRandomFrameConfig,
  getCohesiveFrameConfig,
  PHOTO_FRAME_STYLES,
  FRAME_COLOR_PALETTES,
  FRAME_SHUFFLE_PRESETS,
  FrameShuffleMode
} from './photoFrameRenderer';

export { getRandomAnimistaAnimation } from './animistaEffects';
export {
  renderStyledPhotoCard,
  getRandomFrameConfig,
  getCohesiveFrameConfig,
  PHOTO_FRAME_STYLES,
  FRAME_COLOR_PALETTES,
  FRAME_SHUFFLE_PRESETS
};
export type { PhotoFrameStyle, FrameShuffleMode };

export interface AnimationEffectDefinition {
  id: string;
  name: string;
  category: AnimationCategory;
  description: string;
  entranceDuration: number;
  render: (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    progress: number, // 0 to 1 across the slot
    elapsed: number,  // seconds in slot
    duration: number, // total slot duration (5-7s)
    w: number,
    h: number,
    context?: RenderContext
  ) => void;
}

// Polyfill-safe rounded rectangle helper
export const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 0
) => {
  if (!r || r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  const rad = Math.max(0, Math.min(r, Math.min(w / 2, h / 2)));
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rad);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
};

// Helper to draw aspect-fit or aspect-cover image safely
export const drawFittedImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  mode: 'cover' | 'contain' = 'cover',
  cropOffsetY = 0
) => {
  if (!img) return;
  // If image is still decoding or has 0 dimensions, skip draw to avoid canvas DOMException
  if (!img.complete || !img.naturalWidth || !img.naturalHeight || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return;
  }

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const imgAspect = imgW / imgH;
  const canvasAspect = w / h;

  let drawW = w;
  let drawH = h;
  let offsetX = 0;
  let offsetY = 0;

  if (mode === 'cover') {
    if (imgAspect > canvasAspect) {
      drawW = h * imgAspect;
      offsetX = (w - drawW) / 2;
    } else {
      drawH = w / imgAspect;
      offsetY = (h - drawH) / 2 + cropOffsetY;
    }
  } else {
    if (imgAspect > canvasAspect) {
      drawH = w / imgAspect;
      offsetY = (h - drawH) / 2;
    } else {
      drawW = h * imgAspect;
      offsetX = (w - drawW) / 2;
    }
  }

  try {
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } catch (err) {
    console.warn('Canvas drawImage warning:', err);
  }
};

let _activeRenderContext: RenderContext | null = null;
export const setActiveRenderContext = (ctx: RenderContext | null) => {
  _activeRenderContext = ctx;
};
export const getActiveRenderContext = (): RenderContext | null => {
  return _activeRenderContext;
};

/**
 * Draw modern professional styled photo card with dynamic frames, glowing borders, and rich color palettes
 */
export const drawPhotoCard = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
  borderWidth = 14,
  cornerRadius = 0,
  shadowAlpha = 0.35,
  borderFill = '',
  extraScale = 1.0,
  aspectMode: 'cover' | 'contain' = 'cover',
  frameStyle?: PhotoFrameStyle,
  frameAccentColor?: string,
  context?: RenderContext
) => {
  if (!img || !img.complete || !img.naturalWidth || img.naturalWidth <= 0) return;

  const effCtx = context || _activeRenderContext;
  const slot = effCtx?.slot;
  const slotIdx = effCtx?.slotIndex ?? 0;
  const fallback = getRandomFrameConfig(slotIdx);

  const activeStyle = frameStyle || slot?.frameStyle || fallback.frameStyle;
  const activeColor = (borderFill && borderFill !== '#ffffff' && borderFill !== '')
    ? borderFill
    : (slot?.frameColor || fallback.frameColor);
  const activeAccent = frameAccentColor || slot?.frameAccentColor || fallback.frameAccentColor;
  const activeGlow = fallback.glowColor;

  ctx.save();
  ctx.translate(x, y);

  if (rotation) {
    ctx.rotate(rotation);
  }

  if (extraScale !== 1.0) {
    ctx.scale(extraScale, extraScale);
  }

  renderStyledPhotoCard(
    ctx,
    img,
    -width / 2,
    -height / 2,
    width,
    height,
    {
      frameStyle: activeStyle,
      frameColor: activeColor,
      accentColor: activeAccent,
      cornerRadius: cornerRadius || 0,
      shadowBlur: (shadowAlpha ?? 0.35) * 60,
      glowColor: activeGlow
    }
  );

  ctx.restore();
};

let cachedAmbientVignette: { canvas: HTMLCanvasElement; w: number; h: number } | null = null;
let cachedAmbientBokehSprite: HTMLCanvasElement | null = null;

function getAmbientVignette(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedAmbientVignette && cachedAmbientVignette.w === w && cachedAmbientVignette.h === h) {
    return cachedAmbientVignette.canvas;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const gCtx = c.getContext('2d');
  if (gCtx) {
    const grad = gCtx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.45,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.85
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, w, h);
  }
  cachedAmbientVignette = { canvas: c, w, h };
  return c;
}

function getAmbientBokehSprite(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedAmbientBokehSprite) return cachedAmbientBokehSprite;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const bCtx = c.getContext('2d');
  if (bCtx) {
    const half = size / 2;
    const bGrad = bCtx.createRadialGradient(half, half, 0, half, half, half);
    bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    bGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
    bGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.arc(half, half, half, 0, Math.PI * 2);
    bCtx.fill();
  }
  cachedAmbientBokehSprite = c;
  return c;
}

/**
 * Ambient background with floating bokeh discs and sparkling particle dust (from uploaded video)
 */
export const drawAmbientBackground = (
  ctx: CanvasRenderingContext2D,
  _img: HTMLImageElement,
  w: number,
  h: number,
  elapsed: number,
  _style: string = 'blur_vignette'
) => {
  ctx.save();

  const vignette = getAmbientVignette(w, h);
  if (vignette) {
    ctx.drawImage(vignette, 0, 0);
  }

  const bokehSprite = getAmbientBokehSprite();
  if (bokehSprite) {
    for (let i = 0; i < 5; i++) {
      const speed = 0.4 + i * 0.12;
      const bx = w * (0.15 + i * 0.18) + Math.sin(elapsed * speed + i * 1.2) * 25;
      const by = h * (0.2 + i * 0.15) + Math.cos(elapsed * speed * 0.8 + i * 0.9) * 20;
      const radius = 20 + (i % 3) * 14;
      ctx.drawImage(bokehSprite, bx - radius, by - radius, radius * 2, radius * 2);
    }
  }

  // Floating sparkling dust particles
  for (let j = 0; j < 10; j++) {
    const px = w * ((j * 0.091 + 0.05) % 1) + Math.sin(elapsed * 1.2 + j) * 14;
    const py = h * ((j * 0.083 + 0.1) % 1) - ((elapsed * 10 + j * 12) % h);
    const clampedPy = py < 0 ? py + h : py;
    const alpha = 0.15 + 0.15 * Math.sin(elapsed * 3.0 + j);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, clampedPy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

// Helper to safely get adjacent images for multi-card collages
const getSecondaryImages = (img: HTMLImageElement, context?: RenderContext): HTMLImageElement[] => {
  if (context?.getNeighborImages) {
    const neighbors = context.getNeighborImages();
    if (neighbors.length > 0) return neighbors;
  }
  return [img, img, img, img];
};

// All Professional Animation Effects (Including Signature Uploaded Video Multi-Card & 3D FX, and Animista Custom FX)
export const ANIMATION_LIBRARY: AnimationEffectDefinition[] = [
  ...ANIMISTA_EFFECTS,
  ...VIDEO2_EFFECTS,
  // =========================================================================
  // CATEGORY 0: UPLOADED VIDEO MULTI-CARD & 3D FX (Signature Video Recreation)
  // =========================================================================
  {
    id: 'video_polaroid_tilt_float',
    name: 'ভিডিও স্টাইল: ফটো ফ্রেম ও জুম (Photo Frame Tilt & Drift)',
    category: 'uploadedVideo',
    description: 'মসৃণ কোণে বেঁকে বোকেহ ব্যাকগ্রাউন্ডে ভেসে ওঠা আকর্ষণীয় ফ্রেমের ছবি',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const angle = -0.055 + Math.sin(p * Math.PI) * 0.035; // gentle -3 deg tilt
      const scale = 1.0 + p * 0.14;
      const cardW = w * 0.65;
      const cardH = h * 0.70;
      drawPhotoCard(ctx, img, w / 2, h / 2, cardW, cardH, angle, 16, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'video_satellite_multi_cards',
    name: 'ভিডিও স্টাইল: সিনেমাটিক ফ্লোটিং হিরো শোকেস (Cinematic Floating Showcase)',
    category: 'uploadedVideo',
    description: 'মসৃণ ৩D মোশনে ভেসে ওঠা ডাইনামিক ফ্রেমযুক্ত প্রধান ছবি ও অ্যাম্বিয়েন্ট বোকেহ ব্যাকগ্রাউন্ড',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = 1 - Math.pow(1 - enterP, 3);
      const heroScale = 0.94 + ease * 0.08 + p * 0.05;
      const heroAngle = -0.035 * (1 - ease) + Math.sin(p * Math.PI) * 0.02;

      drawPhotoCard(
        ctx,
        img,
        w / 2,
        h / 2,
        w * 0.64,
        h * 0.68,
        heroAngle,
        15,
        12,
        0.5,
        '',
        heroScale,
        'cover',
        undefined,
        undefined,
        context
      );
    }
  },
  {
    id: 'video_5card_mosaic_split',
    name: 'ভিডিও স্টাইল: ডায়নামিক সেন্টার পপ ও জুম (Dynamic Center Pop & Drift)',
    category: 'uploadedVideo',
    description: 'সেন্টারে প্রধান ছবি ইলাস্টিক জুম ও বাউন্স সহ আকর্ষকভাবে ভেসে ওঠা',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.5);
      const bounce = Math.sin(enterP * Math.PI * 0.7) * (1 - enterP) * 0.08;
      const heroScale = 0.92 + enterP * 0.1 + bounce + p * 0.04;
      const heroAngle = -0.02 + Math.sin(e * 0.5) * 0.02;

      drawPhotoCard(
        ctx,
        img,
        w / 2,
        h / 2,
        w * 0.64,
        h * 0.68,
        heroAngle,
        16,
        12,
        0.5,
        '',
        heroScale,
        'cover',
        undefined,
        undefined,
        context
      );
    }
  },
  {
    id: 'video_3d_perspective_flythrough',
    name: 'ভিডিও স্টাইল: ৩D পারসপেক্টিভ ফ্লাই-থ্রু (3D Spatial Fly-Through)',
    category: 'uploadedVideo',
    description: 'থ্রি-ডি স্পেসে হেলে থেকে ক্যামেরা পারসপেক্টিভে গতিশীলভাবে উড়ে আসা আকর্ষণীয় ফ্রেমের ফটো',
    entranceDuration: 1.3,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const easeEnter = 1 - Math.pow(1 - enterP, 3);

      ctx.save();
      ctx.translate(w / 2, h / 2);

      // 3D Perspective Transform
      const shearX = (1 - easeEnter) * -0.20 - 0.03;
      const shearY = (1 - easeEnter) * 0.10 + 0.015;
      const scale = 0.82 + easeEnter * 0.22 + p * 0.06;
      const rot = (1 - easeEnter) * -0.20 - 0.03;

      ctx.transform(scale, shearY, shearX, scale, 0, 0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.64, h * 0.68, rot, 16, 12, 0.55, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'video_cascading_stacked_cards',
    name: 'ভিডিও স্টাইল: লেয়ারড ডেপথ গ্লাইড ও জুম (Layered Depth Glide)',
    category: 'uploadedVideo',
    description: 'মসৃণ ডেপথ এপ্রোচ ও ধীরে ধীরে কেন্দ্রে স্থিতিশীল আকর্ষণীয় ফ্রেমযুক্ত ফটো',
    entranceDuration: 1.4,
    render: (ctx, img, p, _e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, _e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = 1 - Math.pow(1 - enterP, 3);
      const scale = 0.93 + ease * 0.09 + p * 0.04;
      const angle = -0.04 * (1 - ease) + Math.sin(p * Math.PI) * 0.015;

      drawPhotoCard(
        ctx,
        img,
        w / 2,
        h / 2,
        w * 0.64,
        h * 0.68,
        angle,
        16,
        14,
        0.5,
        '',
        scale,
        'cover',
        undefined,
        undefined,
        context
      );
    }
  },
  {
    id: 'video_dual_split_cards',
    name: 'ভিডিও স্টাইল: সেন্ট্রিক স্লাইড ও প্রকাশ (Centric Aperture Slide)',
    category: 'uploadedVideo',
    description: 'মসৃণ গতিতে সেন্টারে প্রবেশকারী প্রফেশনাল ফ্রেমের ফটো',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, _e, 'blur_vignette');
      const ease = 1 - Math.pow(1 - Math.min(1.0, p * 2.2), 3);
      const slideDist = (1 - ease) * 120;
      const scale = 0.94 + ease * 0.08 + p * 0.04;

      drawPhotoCard(
        ctx,
        img,
        w / 2,
        h / 2 + slideDist * 0.3,
        w * 0.64,
        h * 0.68,
        0.02 * (1 - ease),
        15,
        12,
        0.5,
        '',
        scale,
        'cover',
        undefined,
        undefined,
        context
      );
    }
  },
  {
    id: 'video_extreme_3d_flyby',
    name: 'ভিডিও স্টাইল: এক্সট্রিম ৩D ডায়াগনাল ফ্লাইবাই (Extreme 3D Diagonal Flyby)',
    category: 'uploadedVideo',
    description: 'কৌণিক ৩D কাত হয়ে স্ক্রিন অতিক্রমকারী আকর্ষণীয় গতিশীল ফটো',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, _e, 'mint_gradient');
      const ease = 1 - Math.pow(1 - Math.min(1.0, p * 2.0), 3);
      const posX = w * 0.35 + ease * (w * 0.15);
      const posY = h * 0.65 - ease * (h * 0.15);

      ctx.save();
      ctx.translate(posX, posY);
      ctx.transform(0.95 + ease * 0.08 + p * 0.04, 0.06 * (1 - ease), -0.08 * (1 - ease), 0.95 + ease * 0.08 + p * 0.04, 0, 0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.64, h * 0.68, -0.05 * (1 - ease), 16, 12, 0.52, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'video_vintage_grunge_wash',
    name: 'ভিডিও স্টাইল: ভিন্টেজ গ্রাঞ্জ ওয়াশ ও ফটো ফ্রেম (Vintage Grunge Paper Wash)',
    category: 'uploadedVideo',
    description: 'ভিন্টেজ পেপার টেক্সচার ও স্প্ল্যাশ ব্যাকগ্রাউন্ডে ফ্রেমের ছবি ও ভেসে থাকা ডাস্ট পার্টিক্যালস',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'vintage_grunge');
      const angle = -0.04 + Math.sin(p * Math.PI) * 0.025;
      const scale = 0.98 + p * 0.12;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.64, h * 0.68, angle, 16, 10, 0.5, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'video_rounded_card_pop',
    name: 'ভিডিও স্টাইল: মডার্ন রাউন্ডেড কার্ড ও ইলাস্টিক বাউন্স (Rounded Card Pop & Settle)',
    category: 'uploadedVideo',
    description: 'নরম গোল কোণা ও ফ্রেমের কার্ড যা দ্রুত বাউন্স সহ পর্দায় ভেসে ওঠে',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, _e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 3.0);
      const bounce = Math.sin(enterP * Math.PI * 0.7) * (1 - enterP) * 0.12;
      const scale = 0.92 + bounce + enterP * 0.1 + p * 0.05;
      const angle = (1 - enterP) * -0.08 - 0.02;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.64, h * 0.68, angle, 18, 22, 0.48, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'video_diagonal_cross_drift',
    name: 'ভিডিও স্টাইল: বিপরীতমুখী ডায়াগনাল ফ্লোটিং কার্ডস (Diagonal Parallax Cross-Float)',
    category: 'uploadedVideo',
    description: 'তির্যক রেখায় সমান্তরালভাবে ভেসে চলে গভীরতা তৈরি করা আকর্ষক ফটো',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, _e, 'mint_gradient');
      const ease = 1 - Math.pow(1 - Math.min(1.0, p * 2.0), 3);
      const fgX = w * 0.5 + Math.sin(p * Math.PI) * 20;
      const fgY = h * 0.5 - (1 - ease) * 40;
      drawPhotoCard(ctx, img, fgX, fgY, w * 0.64, h * 0.68, -0.04 + Math.sin(p * Math.PI) * 0.02, 16, 12, 0.5, '', 0.96 + p * 0.08, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'video_polaroid_drop_scatter',
    name: 'ভিডিও স্টাইল: ফটো ফ্রেম গ্র্যাভিটি ড্রপ ও সেটল (Photo Frame Gravity Drop)',
    category: 'uploadedVideo',
    description: 'উপর থেকে ছবির প্রিন্ট স্বাভাবিক মাধ্যাকর্ষণের মতো নিচে পড়ে কিছুটা কেঁপে স্থির হওয়া',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, _e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.5);
      const dropY = (1 - Math.pow(enterP, 2)) * -h * 0.5;
      const bounce = Math.sin(enterP * Math.PI) * (1 - enterP) * 15;
      const angle = -0.06 + Math.sin(p * Math.PI) * 0.03;
      drawPhotoCard(
        ctx,
        img,
        w / 2,
        h / 2 + dropY + bounce,
        w * 0.64,
        h * 0.68,
        angle,
        16,
        12,
        0.48,
        '',
        0.98 + p * 0.1,
        'cover',
        undefined,
        undefined,
        context
      );
    }
  },

  // ==========================================
  // CATEGORY 1: CINEMATIC CAMERA (15 effects)
  // ==========================================
  {
    id: 'ken_burns_classic',
    name: 'Ken Burns Classic',
    category: 'cinematic',
    description: 'Slow, graceful zoom-in with gentle horizontal drift',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.0 + p * 0.18;
      const panX = Math.sin(p * Math.PI) * 25;
      const panY = Math.cos(p * Math.PI) * 12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'cinematic_push_in',
    name: 'Cinematic Push-In (Hero Reveal)',
    category: 'cinematic',
    description: 'Steadily zooms deep into the center focal point of the drama scene',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const ease = Math.pow(p, 1.2);
      const scale = 1.02 + ease * 0.24;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'cinematic_pull_back',
    name: 'Cinematic Pull-Back (Wide Reveal)',
    category: 'cinematic',
    description: 'Starts close-up and reveals the entire environment and drama atmosphere',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.25 - p * 0.22;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'pan_left_to_right',
    name: 'Panoramic Sweep (Left to Right)',
    category: 'cinematic',
    description: 'Smooth panoramic horizontal camera pan from left to right',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.15;
      const panX = (0.5 - p) * 60;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'pan_right_to_left',
    name: 'Panoramic Sweep (Right to Left)',
    category: 'cinematic',
    description: 'Smooth panoramic horizontal camera pan from right to left',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.15;
      const panX = (p - 0.5) * 60;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'pan_top_to_bottom',
    name: 'Vertical Reveal (Top to Bottom)',
    category: 'cinematic',
    description: 'Slow vertical crane pan revealing character stature and setting',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.15;
      const panY = (0.5 - p) * 45;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'pan_bottom_to_top',
    name: 'Pedestal Ascent (Bottom to Top)',
    category: 'cinematic',
    description: 'Ascends from dramatic ground level to character expression',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.15;
      const panY = (p - 0.5) * 45;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'diagonal_glide_down',
    name: 'Diagonal Glide (Top-Left to Bottom-Right)',
    category: 'cinematic',
    description: 'Cinematic diagonal camera tracking with subtle focal breathing',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.14 + Math.sin(p * Math.PI) * 0.05;
      const panX = (0.5 - p) * 40;
      const panY = (0.5 - p) * 28;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'diagonal_glide_up',
    name: 'Diagonal Glide (Bottom-Left to Top-Right)',
    category: 'cinematic',
    description: 'Inspiring diagonal ascent across key visual elements',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.14 + Math.sin(p * Math.PI) * 0.05;
      const panX = (0.5 - p) * 40;
      const panY = (p - 0.5) * 28;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'vertigo_dolly_zoom',
    name: 'Vertigo Dolly Zoom (Tension Warp)',
    category: 'cinematic',
    description: 'Dramatic Hitchcock vertigo effect with foreground expansion and background shrink',
    entranceDuration: 1.3,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.05 + Math.sin(p * Math.PI * 0.8) * 0.22;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'reverse_dolly_zoom',
    name: 'Reverse Dolly Zoom (Perspective Shift)',
    category: 'cinematic',
    description: 'Pulling back lens while scaling foreground to emphasize sudden realization',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.24 - Math.sin(p * Math.PI * 0.7) * 0.18;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'anamorphic_scope_drift',
    name: 'Anamorphic Scope Drift',
    category: 'cinematic',
    description: 'Ultra-wide 2.39:1 scope cinematic drift with gentle edge softness',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.12;
      const panX = Math.sin(p * Math.PI) * 35;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'drone_floating_hover',
    name: 'Drone Aerial Hover',
    category: 'cinematic',
    description: 'Simulates a smooth cinematic drone hovering and gently banking over the scene',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const rot = Math.sin(p * Math.PI * 1.5) * 0.02;
      const scale = 1.08 + Math.cos(p * Math.PI) * 0.06;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'steadicam_subtle_bob',
    name: 'Steadicam Subtle Tracking',
    category: 'cinematic',
    description: 'Organic human steadicam walking momentum that makes drama frames feel alive',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h) => {
      const scale = 1.1;
      const bobX = Math.sin(e * 1.8) * 8;
      const bobY = Math.cos(e * 2.4) * 6;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + bobX, -h / 2 + bobY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'golden_ratio_zoom',
    name: 'Golden Ratio Focus',
    category: 'cinematic',
    description: 'Zooms precisely toward the rule-of-thirds intersection for maximum impact',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.02 + p * 0.2;
      const focusX = w * 0.62;
      const focusY = h * 0.38;
      ctx.translate(focusX, focusY);
      ctx.scale(scale, scale);
      ctx.translate(-focusX, -focusY);
      drawFittedImage(ctx, img, w, h);
    }
  },

  // ==========================================
  // CATEGORY 2: 3D PERSPECTIVE & SPATIAL (15 effects)
  // ==========================================
  {
    id: 'flip_3d_y_axis',
    name: '3D Flip Y-Axis (Smooth Card)',
    category: 'perspective3d',
    description: 'Smooth card rotation in 3D space with natural perspective scaling',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const angle = (1 - Math.min(1, p * 2.2)) * 0.16;
      const scale = 0.94 + p * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'flip_3d_x_axis',
    name: '3D Flip X-Axis (Overhead Flap)',
    category: 'perspective3d',
    description: 'Vertical 3D perspective fold opening into the full scene',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const enterP = Math.min(1, p * 2.5);
      const scaleY = 0.88 + enterP * 0.16;
      const scaleX = 0.96 + p * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'isometric_tilt_3d',
    name: '3D Isometric Perspective',
    category: 'perspective3d',
    description: 'Slight isometric angular tilt with floating depth motion',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const tilt = -0.05 + p * 0.03;
      const scale = 1.08;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(tilt);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'cube_rotation_3d',
    name: '3D Cube Spatial Slide',
    category: 'perspective3d',
    description: 'Simulates the face of a rotating 3D video display cube',
    entranceDuration: 1.3,
    render: (ctx, img, p, _e, _d, w, h) => {
      const enterProgress = Math.min(1, p * 2.0);
      const offset = (1 - enterProgress) * 70;
      const scale = 0.92 + p * 0.14;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + offset, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'floating_canvas_3d',
    name: '3D Floating Canvas',
    category: 'perspective3d',
    description: 'Image floats gracefully in a 3D dark studio space with subtle ambient shadowing',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const floatY = Math.sin(p * Math.PI * 2) * 14;
      const floatX = Math.cos(p * Math.PI) * 10;
      const scale = 1.04 + Math.sin(p * Math.PI) * 0.05;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + floatX, -h / 2 + floatY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'parallax_depth_drift',
    name: '3D Parallax Depth Drift',
    category: 'perspective3d',
    description: 'Multi-layer depth simulation creating a stereoscopic feeling in 2D stills',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.12 + p * 0.08;
      const panX = (p - 0.5) * 35;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'corner_peel_3d',
    name: '3D Corner Peeling Angle',
    category: 'perspective3d',
    description: 'Enters with a subtle corner tilt that settles into a pristine view',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const settle = Math.max(0, 1 - p * 2.5);
      const rot = settle * 0.07;
      const scale = 1.02 + p * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'horizon_tilt_dutch',
    name: '3D Dutch Angle Horizon',
    category: 'perspective3d',
    description: 'Iconic cinematic Dutch tilt used in psychological thrillers and dramatic climaxes',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const rot = -0.06 + Math.sin(p * Math.PI) * 0.04;
      const scale = 1.14 + p * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'convex_sphere_warp',
    name: '3D Lens Convex Float',
    category: 'perspective3d',
    description: 'Curved lens perspective breathing that brings viewer into the frame center',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.06 + Math.sin(p * Math.PI) * 0.09;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'vortex_intro_3d',
    name: '3D Gentle Vortex Spin',
    category: 'perspective3d',
    description: 'Begins with micro-spin and opens into a stabilized drama moment',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const spin = Math.max(0, 1 - p * 2.0) * 0.12;
      const scale = 0.94 + p * 0.16;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(spin);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'tilt_shift_focus',
    name: '3D Tilt-Shift Focus',
    category: 'perspective3d',
    description: 'Miniature diorama feel with focused center band and spatial drift',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08 + p * 0.08;
      const panY = Math.sin(p * Math.PI) * 15;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'card_cascade_drop',
    name: '3D Perspective Cascade',
    category: 'perspective3d',
    description: 'Pivots from top perspective and softly drops into place like a photographic print',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const settle = Math.max(0, 1 - p * 2.2);
      const offsetY = settle * -30;
      const scale = 0.96 + p * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + offsetY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'swing_door_reveal',
    name: '3D Swing Pivot Reveal',
    category: 'perspective3d',
    description: 'Swings open around left anchor like a gallery display door',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const enterP = Math.min(1, p * 2.0);
      const angle = (1 - enterP) * -0.15;
      const scale = 0.95 + p * 0.12;
      ctx.translate(w * 0.2, h / 2);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.translate(-w * 0.2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'shimmering_glass_angle',
    name: '3D Glass Angle Refraction',
    category: 'perspective3d',
    description: 'Subtle angular perspective with luminous highlight sheen across the image',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const rot = 0.03 * Math.cos(p * Math.PI);
      const scale = 1.07 + p * 0.06;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'multi_layer_float',
    name: '3D Multi-Layer Spatial Float',
    category: 'perspective3d',
    description: 'Gentle figure-eight infinity path floating in 3D camera space',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08;
      const posX = Math.sin(p * Math.PI * 2) * 20;
      const posY = Math.sin(p * Math.PI * 4) * 10;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + posX, -h / 2 + posY);
      drawFittedImage(ctx, img, w, h);
    }
  },

  // ==========================================
  // CATEGORY 3: DRAMA REVIEW & STORYTELLING (14 effects)
  // ==========================================
  {
    id: 'character_eye_focus',
    name: 'Character Eye Dramatic Zoom',
    category: 'dramaReview',
    description: 'Zooms towards upper-center character eyes to highlight emotional nuance',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.02 + p * 0.22;
      const focusX = w * 0.5;
      const focusY = h * 0.35;
      ctx.translate(focusX, focusY);
      ctx.scale(scale, scale);
      ctx.translate(-focusX, -focusY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'heartbeat_pulse',
    name: 'Emotional Heartbeat Pulse',
    category: 'dramaReview',
    description: 'Subtle dual-beat rhythmic pulse conveying tension, love, or danger',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h) => {
      const beat = Math.sin(e * 3.5);
      const pulse = beat > 0.8 ? (beat - 0.8) * 0.08 : 0;
      const baseScale = 1.06 + p * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.scale(baseScale + pulse, baseScale + pulse);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'suspense_tension_creep',
    name: 'Suspense Tension Creep',
    category: 'dramaReview',
    description: 'Slow, agonizing zoom-in matching intense plot twists or mystery reveals',
    entranceDuration: 1.5,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.0 + Math.pow(p, 1.4) * 0.25;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'melancholy_slow_drift',
    name: 'Melancholy Slow Drift',
    category: 'dramaReview',
    description: 'Subtle downward mournful drift suited for sad or reflective scenes',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08 + p * 0.06;
      const panY = p * 25;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'shock_zoom_snap',
    name: 'Shock Snap & Settle',
    category: 'dramaReview',
    description: 'Immediate rapid 1.2x snap followed by slow dramatic tension drift',
    entranceDuration: 0.8,
    render: (ctx, img, p, _e, _d, w, h) => {
      const enterSnap = Math.min(1, p * 4.0);
      const scale = 1.0 + (enterSnap * 0.16) + (p * 0.08);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'flashback_halo_bloom',
    name: 'Flashback Halo Drift',
    category: 'dramaReview',
    description: 'Slow luminous drift reminiscent of nostalgic drama flashback sequences',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.05 + p * 0.14;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'dual_character_pan',
    name: 'Two-Shot Dialogue Glide',
    category: 'dramaReview',
    description: 'Gently shifts from character A on the left to character B on the right',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.18;
      const panX = (0.5 - p) * 75;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'secret_clue_microzoom',
    name: 'Secret Clue Micro-Zoom',
    category: 'dramaReview',
    description: 'Targeted focus shift pointing out evidence, props, or hidden details',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.04 + p * 0.22;
      const focusX = w * 0.45;
      const focusY = h * 0.55;
      ctx.translate(focusX, focusY);
      ctx.scale(scale, scale);
      ctx.translate(-focusX, -focusY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'romantic_warm_glow',
    name: 'Romantic Warm Glow Drift',
    category: 'dramaReview',
    description: 'Soft cinematic warm drift perfect for romantic confession moments',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.04 + Math.sin(p * Math.PI) * 0.1;
      const panX = Math.sin(p * Math.PI) * 18;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'confession_soft_breathe',
    name: 'Intimate Soft Breathing',
    category: 'dramaReview',
    description: 'Slow breathing zoom that feels like holding one’s breath during a climax',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.04 + Math.sin(p * Math.PI * 1.5) * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'villain_menace_drift',
    name: 'Antagonist Menace Drift',
    category: 'dramaReview',
    description: 'Low creeping angle with slow forward intimidation factor',
    entranceDuration: 1.3,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08 + p * 0.18;
      const panY = (0.5 - p) * 20;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'plot_twist_snap',
    name: 'Plot Twist Snap Angle',
    category: 'dramaReview',
    description: 'Momentary 3-degree sharp tilt settling into deep investigative zoom',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h) => {
      const tilt = Math.max(0, 1 - p * 3) * 0.05;
      const scale = 1.05 + p * 0.18;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(tilt);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'memory_vignette_drift',
    name: 'Memory Vignette Soft Drift',
    category: 'dramaReview',
    description: 'Floating memory recollection feel with stable center focus',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.07 + Math.sin(p * Math.PI) * 0.07;
      const panY = -10 + p * 20;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'climactic_scene_rise',
    name: 'Climactic Scene Ascent',
    category: 'dramaReview',
    description: 'Power-scale ascent highlighting heroic triumph or peak dramatic resolution',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.03 + Math.pow(p, 1.2) * 0.22;
      const panY = (1 - p) * 25;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },

  // ==========================================
  // CATEGORY 4: ATMOSPHERIC & MOOD (13 effects)
  // ==========================================
  {
    id: 'warm_sunlight_sweep',
    name: 'Warm Sunlight Sweep',
    category: 'atmospheric',
    description: 'Simulates afternoon sunshine slowly tracking across the cinematic frame',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08 + p * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'anamorphic_flare_drift',
    name: 'Anamorphic Blue Flare Drift',
    category: 'atmospheric',
    description: 'Hollywood sci-fi/mystery horizontal flare track across the characters',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.1 + p * 0.06;
      const panX = (p - 0.5) * 35;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'golden_hour_ambient',
    name: 'Golden Hour Sunset Ambient',
    category: 'atmospheric',
    description: 'Rich warm amber mood with gentle horizontal glide',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.06 + Math.sin(p * Math.PI) * 0.08;
      const panX = Math.sin(p * Math.PI) * 20;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'film_noir_pulse',
    name: 'Film Noir Shadow Pulse',
    category: 'atmospheric',
    description: 'Moody shadow contrast drift for crime, detective, or courtroom scenes',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.09 + p * 0.09;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'subtle_mist_haze',
    name: 'Subtle Mist & Haze Float',
    category: 'atmospheric',
    description: 'Ethereal morning mist motion across historical or fantasy drama shots',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.07 + p * 0.07;
      const panY = Math.sin(p * Math.PI) * 12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'vintage_35mm_weave',
    name: 'Vintage 35mm Gate Weave',
    category: 'atmospheric',
    description: 'Authentic 35mm cinema film projector subtle mechanical drift',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h) => {
      const scale = 1.1;
      const weaveX = Math.sin(e * 6) * 2;
      const weaveY = Math.cos(e * 7) * 2;
      const zoom = p * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale + zoom, scale + zoom);
      ctx.translate(-w / 2 + weaveX, -h / 2 + weaveY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'cine_8mm_jitter',
    name: 'Cine 8mm Nostalgia Drift',
    category: 'atmospheric',
    description: 'Gentle nostalgic home-movie aesthetic with warm presence',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h) => {
      const scale = 1.08 + p * 0.06;
      const jitter = Math.sin(e * 5) * 1.5;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + jitter, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'night_cyber_neon',
    name: 'Night City Neon Ambient',
    category: 'atmospheric',
    description: 'Deep modern metropolitan mood with vivid focal point glide',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.12 - p * 0.06;
      const panX = (0.5 - p) * 30;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'silver_halide_grain',
    name: 'Silver Halide Grain Float',
    category: 'atmospheric',
    description: 'Fine-art analog photography float with crystal crispness',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.05 + p * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'sunset_amber_radiance',
    name: 'Sunset Amber Radiance',
    category: 'atmospheric',
    description: 'Rich amber light tracking across the scene from lower right',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08 + Math.sin(p * Math.PI) * 0.08;
      const panX = (p - 0.5) * 22;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'prism_chromatic_sep',
    name: 'Prism Chromatic Dispersion',
    category: 'atmospheric',
    description: 'High-end cinema lens chromatic edge glow with micro-pan',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.06 + p * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'dreamy_soft_diffuse',
    name: 'Dreamy Soft Diffusion',
    category: 'atmospheric',
    description: 'Silky smooth diffuse dream sequence motion',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.04 + p * 0.14;
      const panY = Math.sin(p * Math.PI) * 14;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'moody_rain_drift',
    name: 'Rainy Day Window Drift',
    category: 'atmospheric',
    description: 'Somber overcast mood with gentle vertical downward sweep',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.1;
      const panY = (p - 0.5) * 30;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },

  // ==========================================
  // CATEGORY 5: DYNAMIC MOTION & ACTION (12 effects)
  // ==========================================
  {
    id: 'dynamic_whip_pan',
    name: 'Dynamic Whip Pan Snap',
    category: 'dynamic',
    description: 'High-energy fast snap entry that decelerates into cinematic smoothness',
    entranceDuration: 0.8,
    render: (ctx, img, p, _e, _d, w, h) => {
      const settle = Math.max(0, 1 - p * 3.5);
      const panX = settle * settle * -120;
      const scale = 1.05 + p * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'impact_shake_settle',
    name: 'Impact Shake & Settle',
    category: 'dynamic',
    description: 'Action hit impact reverberation that quickly locks into sharp focus',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h) => {
      const decay = Math.max(0, 1 - p * 4.0);
      const shakeX = Math.sin(e * 30) * 12 * decay;
      const shakeY = Math.cos(e * 35) * 8 * decay;
      const scale = 1.08 + p * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + shakeX, -h / 2 + shakeY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'kinetic_zoom_bounce',
    name: 'Kinetic Zoom Bounce',
    category: 'dynamic',
    description: 'Youthful punchy zoom overshoot with elastic stabilization',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h) => {
      const enterP = Math.min(1, p * 2.5);
      const bounce = Math.sin(enterP * Math.PI * 1.5) * (1 - enterP) * 0.1;
      const scale = 1.0 + bounce + p * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'fast_slide_friction',
    name: 'Fast Slide with Friction Ease',
    category: 'dynamic',
    description: 'Slides rapidly from screen right with heavy friction damping',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h) => {
      const settle = Math.max(0, 1 - p * 3.0);
      const panX = Math.pow(settle, 3) * 100;
      const scale = 1.04 + p * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'elastic_pop_reveal',
    name: 'Elastic Pop Reveal',
    category: 'dynamic',
    description: 'Snappy comic pop entrance that stabilizes into a steady review frame',
    entranceDuration: 0.8,
    render: (ctx, img, p, _e, _d, w, h) => {
      const enterP = Math.min(1, p * 3.0);
      const scale = 0.94 + Math.sin(enterP * Math.PI * 0.5) * 0.14 + p * 0.06;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'diagonal_speed_slice',
    name: 'Diagonal Speed Slice',
    category: 'dynamic',
    description: 'Fast angular cut trajectory with progressive expansion',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h) => {
      const settle = Math.max(0, 1 - p * 3.0);
      const panX = settle * -60;
      const panY = settle * 40;
      const scale = 1.06 + p * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'cross_drift_horizon',
    name: 'Cross-Drift Horizon Sweep',
    category: 'dynamic',
    description: 'Dynamic horizontal slide with opposing subtle tilt angle',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const tilt = (p - 0.5) * 0.03;
      const panX = (0.5 - p) * 45;
      const scale = 1.12;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(tilt);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'staccato_drama_accent',
    name: 'Staccato Drama Accent',
    category: 'dynamic',
    description: 'Sharp rhythmic beats matching fast-paced recap or trailer cuts',
    entranceDuration: 0.8,
    render: (ctx, img, p, _e, _d, w, h) => {
      const step = Math.floor(p * 4) / 4;
      const scale = 1.04 + step * 0.14;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'adrenaline_push_snap',
    name: 'Adrenaline Push & Snap',
    category: 'dynamic',
    description: 'Urgent forward thrust suited for chases, fights, or sudden confrontations',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.02 + Math.pow(p, 0.8) * 0.24;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'whip_tilt_quick_cut',
    name: 'Whip Tilt Quick Cut',
    category: 'dynamic',
    description: 'Angular whip that straightens quickly into majestic center composition',
    entranceDuration: 0.8,
    render: (ctx, img, p, _e, _d, w, h) => {
      const rot = Math.max(0, 1 - p * 3.5) * -0.09;
      const scale = 1.06 + p * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'elastic_overzoom_bounce',
    name: 'Elastic Over-Zoom Bounce Back',
    category: 'dynamic',
    description: 'Zooms past target size then smoothly recoils to ideal framing',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const enterP = Math.min(1, p * 2.2);
      const recoil = Math.sin(enterP * Math.PI) * 0.08;
      const scale = 1.02 + recoil + p * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'rapid_lens_shift',
    name: 'Rapid Lens Shift',
    category: 'dynamic',
    description: 'Snappy optical shift tracking sudden action changes',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h) => {
      const panX = (Math.sin(p * Math.PI) - 0.5) * 30;
      const scale = 1.1 + p * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },

  // ==========================================
  // CATEGORY 6: ARTISTIC & EDITORIAL (11 effects)
  // ==========================================
  {
    id: 'gallery_exhibition_float',
    name: 'Gallery Exhibition Float',
    category: 'editorial',
    description: 'High-end fine art gallery presentation with pristine stillness',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.02 + p * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'minimalist_editorial_center',
    name: 'Minimalist Editorial Center',
    category: 'editorial',
    description: 'Clean magazine cover framing with subtle upward scan',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.05;
      const panY = (0.5 - p) * 20;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'torn_paper_edge_reveal',
    name: 'Torn Paper Scrapbook Reveal',
    category: 'editorial',
    description: 'Textured editorial scrap feel with gentle organic drift',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const rot = Math.sin(p * Math.PI) * 0.02;
      const scale = 1.04 + p * 0.09;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'watercolor_texture_wash',
    name: 'Watercolor Texture Wash',
    category: 'editorial',
    description: 'Soft painterly presence matching romantic historical dramas',
    entranceDuration: 1.2,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.03 + Math.sin(p * Math.PI) * 0.08;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'comic_book_vignette',
    name: 'Manhwa / Comic Panel Float',
    category: 'editorial',
    description: 'Webtoon / Manhwa dynamic frame presentation with punchy presence',
    entranceDuration: 0.9,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.07 + p * 0.1;
      const panX = Math.cos(p * Math.PI) * 15;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'high_fashion_parallax',
    name: 'High Fashion Editorial Parallax',
    category: 'editorial',
    description: 'Sleek luxury fashion editorial pacing with ultra-smooth panning',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.1;
      const panY = (p - 0.5) * 25;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2 + panY);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'retro_polaroid_drop',
    name: 'Retro Polaroid Gentle Drop',
    category: 'editorial',
    description: 'Memories captured in time with soft physical photo settling',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const settle = Math.max(0, 1 - p * 2.5);
      const rot = settle * 0.04;
      const scale = 0.98 + p * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'magazine_layout_kenburns',
    name: 'Magazine Headline Glide',
    category: 'editorial',
    description: 'Wide horizontal sweep highlighting cast ensemble and art direction',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.14;
      const panX = (0.5 - p) * 50;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'documentary_glide_clean',
    name: 'Documentary Review Glide',
    category: 'editorial',
    description: 'Clean, objective investigative documentary camera motion',
    entranceDuration: 1.1,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.03 + p * 0.12;
      const panX = (p - 0.5) * 20;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2 + panX, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'split_focus_horizon',
    name: 'Split-Focus Horizon Pan',
    category: 'editorial',
    description: 'Simulates split-diopter lens keeping foreground and background sharp',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08 + p * 0.07;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'fine_art_microbreathe',
    name: 'Fine-Art Micro-Breathe',
    category: 'editorial',
    description: 'Subtlest of all motions — lets the viewer absorb the drama acting without distraction',
    entranceDuration: 1.0,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.01 + p * 0.07;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  // Remotion Motion FX Studio: Exact Remotion specs provided by user (Original, Normal, Reverse)
  {
    id: 'remotion_motion_slide_pan',
    name: 'Remotion Slide Pan (Original)',
    category: 'cinematic',
    description: 'Remotion linear timing slide pan with smooth horizontal depth drift',
    entranceDuration: 0.6,
    render: (ctx, img, p, _e, _d, w, h) => {
      const panX = (p - 0.5) * w * 0.06;
      const scale = 1.02 + p * 0.05;
      ctx.translate(w / 2 + panX, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_slide_pan_rev',
    name: 'Remotion Slide Pan (Reverse)',
    category: 'cinematic',
    description: 'Remotion slide pan in reverse direction with depth pull',
    entranceDuration: 0.6,
    render: (ctx, img, p, _e, _d, w, h) => {
      const panX = -(p - 0.5) * w * 0.06;
      const scale = 1.07 - p * 0.05;
      ctx.translate(w / 2 + panX, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_lightleak_shimmer',
    name: 'Remotion Light Leak Shimmer (Original)',
    category: 'atmospheric',
    description: 'Remotion @remotion/light-leaks organic exposure breathe with warm flare drift',
    entranceDuration: 0.8,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.03 + Math.sin(p * Math.PI) * 0.04;
      const panY = Math.sin(p * Math.PI) * h * 0.02;
      ctx.translate(w / 2, h / 2 + panY);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_lightleak_shimmer_rev',
    name: 'Remotion Light Leak Shimmer (Reverse)',
    category: 'atmospheric',
    description: 'Remotion light leak reverse breathe with cool lens edge shimmer',
    entranceDuration: 0.8,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.07 - Math.sin(p * Math.PI) * 0.04;
      const panY = -Math.sin(p * Math.PI) * h * 0.02;
      ctx.translate(w / 2, h / 2 + panY);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_pushcut_punch',
    name: 'Remotion Push Cut Punch (Original)',
    category: 'dynamic',
    description: 'Remotion push-cut dynamic punch scale with snappy impact settle',
    entranceDuration: 0.4,
    render: (ctx, img, p, _e, _d, w, h) => {
      // Dynamic punch settle matching pushCut 11 frames
      const settle = Math.exp(-p * 3.5);
      const scale = 1.03 + settle * 0.12 * Math.cos(p * Math.PI * 3);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_pushcut_punch_rev',
    name: 'Remotion Push Cut Punch (Reverse)',
    category: 'dynamic',
    description: 'Remotion push-cut reverse punch settle',
    entranceDuration: 0.4,
    render: (ctx, img, p, _e, _d, w, h) => {
      const settle = Math.exp(-(1 - p) * 3.5);
      const scale = 1.03 - settle * 0.12 * Math.cos((1 - p) * Math.PI * 3);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_wipe_glide',
    name: 'Remotion Wipe Glide (Original)',
    category: 'cinematic',
    description: 'Remotion linear wipe horizontal perspective glide',
    entranceDuration: 0.6,
    render: (ctx, img, p, _e, _d, w, h) => {
      const shiftX = (p - 0.5) * w * 0.04;
      ctx.translate(w / 2 + shiftX, h / 2);
      ctx.scale(1.04, 1.04);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_wipe_glide_rev',
    name: 'Remotion Wipe Glide (Reverse)',
    category: 'cinematic',
    description: 'Remotion linear wipe reverse glide',
    entranceDuration: 0.6,
    render: (ctx, img, p, _e, _d, w, h) => {
      const shiftX = -(p - 0.5) * w * 0.04;
      ctx.translate(w / 2 + shiftX, h / 2);
      ctx.scale(1.04, 1.04);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_fade_depth',
    name: 'Remotion Fade Depth (Original)',
    category: 'editorial',
    description: 'Remotion linear fade gentle depth zoom with subtle 3D tilt',
    entranceDuration: 0.7,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.0 + p * 0.08;
      const angle = Math.sin(p * Math.PI) * 0.015;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  },
  {
    id: 'remotion_motion_fade_depth_rev',
    name: 'Remotion Fade Depth (Reverse)',
    category: 'editorial',
    description: 'Remotion linear fade reverse depth zoom with reverse tilt',
    entranceDuration: 0.7,
    render: (ctx, img, p, _e, _d, w, h) => {
      const scale = 1.08 - p * 0.08;
      const angle = -Math.sin(p * Math.PI) * 0.015;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      drawFittedImage(ctx, img, w, h);
    }
  }
];

export const REMOTION_MOTION_FX_ANIMATION_IDS: string[] = [
  'remotion_motion_slide_pan',
  'remotion_motion_slide_pan_rev',
  'remotion_motion_lightleak_shimmer',
  'remotion_motion_lightleak_shimmer_rev',
  'remotion_motion_pushcut_punch',
  'remotion_motion_pushcut_punch_rev',
  'remotion_motion_wipe_glide',
  'remotion_motion_wipe_glide_rev',
  'remotion_motion_fade_depth',
  'remotion_motion_fade_depth_rev'
];

export const REMOTION_TRANSITION_TYPES: TransitionType[] = [
  'remotion_slide',
  'remotion_slide_reverse',
  'remotion_lightleak',
  'remotion_lightleak_reverse',
  'remotion_fade',
  'remotion_fade_reverse',
  'remotion_pushcut',
  'remotion_pushcut_reverse',
  'remotion_wipe',
  'remotion_wipe_reverse',
  'remotion_flip',
  'remotion_flip_reverse',
  'remotion_clockWipe',
  'remotion_clockWipe_reverse',
  'remotion_iris',
  'remotion_iris_reverse',
  'remotion_zoomBlur',
  'remotion_zoomBlur_reverse',
  'remotion_dreamyZoom',
  'remotion_dreamyZoom_reverse',
  'remotion_filmBurn',
  'remotion_filmBurn_reverse',
  'remotion_linearBlur',
  'remotion_linearBlur_reverse',
  'remotion_bookFlip',
  'remotion_bookFlip_reverse',
  'remotion_zoomInOut',
  'remotion_zoomInOut_reverse',
  'remotion_dissolve',
  'remotion_dissolve_reverse',
  'remotion_ripple',
  'remotion_ripple_reverse',
  'remotion_crosswarp',
  'remotion_crosswarp_reverse',
  'remotion_crossZoom',
  'remotion_crossZoom_reverse',
  'remotion_swap',
  'remotion_swap_reverse',
  'remotion_blurSlide',
  'remotion_blurSlide_reverse',
  'remotion_cube',
  'remotion_cube_reverse',
  'remotion_spring',
  'remotion_spring_reverse'
];

export const getRandomMotionFxAnimation = (excludeId?: string): AnimationEffectDefinition => {
  let pool = ANIMATION_LIBRARY.filter((a) => REMOTION_MOTION_FX_ANIMATION_IDS.includes(a.id));
  if (excludeId && pool.length > 1) {
    pool = pool.filter((a) => a.id !== excludeId);
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] || ANIMATION_LIBRARY[0];
};

export const getRandomMotionFxTransition = (excludeType?: TransitionType): TransitionType => {
  let pool = REMOTION_TRANSITION_TYPES;
  if (excludeType && pool.length > 1) {
    pool = pool.filter((t) => t !== excludeType);
  }
  return pool[Math.floor(Math.random() * pool.length)];
};

export const getAnimationById = (id: string): AnimationEffectDefinition => {
  return ANIMATION_LIBRARY.find((a) => a.id === id) || ANIMATION_LIBRARY.find((a) => a.id === 'video_polaroid_tilt_float') || ANIMATION_LIBRARY[0];
};

export const UPLOADED_VIDEO_ANIMATION_IDS: string[] = [
  // Original 11 Video Effects
  'video_polaroid_tilt_float',
  'video_satellite_multi_cards',
  'video_5card_mosaic_split',
  'video_3d_perspective_flythrough',
  'video_cascading_stacked_cards',
  'video_dual_split_cards',
  'video_extreme_3d_flyby',
  'video_vintage_grunge_wash',
  'video_rounded_card_pop',
  'video_diagonal_cross_drift',
  'video_polaroid_drop_scatter',
  // Exactly matching 20 Video Effects from video2Effects.ts
  'video2_pixel_block_dissolve',
  'video2_perspective_slide',
  'video2_hero_spotlight',
  'video2_iris_spotlight',
  'video2_3d_depth_glide',
  'video2_slit_doors',
  'video2_gold_showcase',
  'video2_dual_cards',
  'video2_horizontal_glide',
  'video2_beveled_display',
  'video2_3d_swing',
  'video2_cinematic_dual_glide',
  'video2_letterbox_scope',
  'video2_parallax_hero_zoom',
  'video2_depth_float',
  'video2_curtain_reveal',
  'video2_horizontal_soft_glide',
  'video2_rotational_settle',
  'video2_radar_sweep',
  'video2_spiral_ingress'
];

export const getRandomUploadedVideoAnimation = (excludeId?: string): AnimationEffectDefinition => {
  let pool = ANIMATION_LIBRARY.filter((a) => a.category === 'uploadedVideo');
  if (excludeId && pool.length > 1) {
    pool = pool.filter((a) => a.id !== excludeId);
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
};

export const getRandomAnimation = (excludeId?: string, preferredCategory?: AnimationCategory): AnimationEffectDefinition => {
  let pool = ANIMATION_LIBRARY;
  if (preferredCategory) {
    const catPool = ANIMATION_LIBRARY.filter((a) => a.category === preferredCategory);
    if (catPool.length > 0) pool = catPool;
  }
  if (excludeId && pool.length > 1) {
    pool = pool.filter((a) => a.id !== excludeId);
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
};

export const TRANSITION_TYPES: { id: TransitionType; name: string; singleWordName: string; description: string }[] = [
  { id: 'cinematicDissolve', name: 'Dissolve', singleWordName: 'Dissolve', description: 'Hollywood film style exposure bloom dissolve' },
  { id: 'crossfade', name: 'Crossfade', singleWordName: 'Crossfade', description: 'Smooth standard opacity blend' },
  { id: 'smoothZoom', name: 'Zoom', singleWordName: 'Zoom', description: 'Dynamic camera zoom through' },
  { id: 'slideLeft', name: 'Slide', singleWordName: 'Slide', description: 'Smooth push horizontal' },
  { id: 'slideRight', name: 'Wipe', singleWordName: 'Wipe', description: 'Clean horizontal directional wipe' },
  { id: 'slideUp', name: 'Rise', singleWordName: 'Rise', description: 'Vertical upward cinematic movement' },
  { id: 'slideDown', name: 'Drop', singleWordName: 'Drop', description: 'Vertical downward cinematic movement' },
  { id: 'pageFlip3d', name: 'Flip', singleWordName: 'Flip', description: 'Realistic 3D page flip transition' },
  { id: 'softBlur', name: 'Blur', singleWordName: 'Blur', description: 'Defocus into sharp focal change' },
  { id: 'lightSweep', name: 'Sweep', singleWordName: 'Sweep', description: 'Radiant golden/white light beam sweep' },
  { id: 'splitPanel', name: 'Split', singleWordName: 'Split', description: 'Center split curtain reveal' },
  { id: 'motionBlur', name: 'Whip', singleWordName: 'Whip', description: 'Fast camera motion blur whip' },
  { id: 'remotion_slide', name: 'Remotion Slide', singleWordName: 'RemSlide', description: 'Remotion linearTiming(30) slide transition' },
  { id: 'remotion_slide_reverse', name: 'Remotion Slide (Reverse)', singleWordName: 'SlideRev', description: 'Remotion slide in reverse direction' },
  { id: 'remotion_lightleak', name: 'Remotion Light Leak', singleWordName: 'RemLeak', description: 'Remotion @remotion/light-leaks anamorphic flare overlay' },
  { id: 'remotion_lightleak_reverse', name: 'Remotion Light Leak (Reverse)', singleWordName: 'LeakRev', description: 'Remotion light leak reverse cool sweep' },
  { id: 'remotion_fade', name: 'Remotion Fade', singleWordName: 'RemFade', description: 'Remotion linearTiming(30) fade transition' },
  { id: 'remotion_fade_reverse', name: 'Remotion Fade (Reverse)', singleWordName: 'FadeRev', description: 'Remotion flash dip-through-white fade' },
  { id: 'remotion_pushcut', name: 'Remotion Push Cut', singleWordName: 'PushCut', description: 'Remotion pushCut(5/11) punch snap cut' },
  { id: 'remotion_pushcut_reverse', name: 'Remotion Push Cut (Reverse)', singleWordName: 'PushRev', description: 'Remotion reverse punch snap cut' },
  { id: 'remotion_wipe', name: 'Remotion Wipe', singleWordName: 'RemWipe', description: 'Remotion linearTiming(30) wipe curtain reveal' },
  { id: 'remotion_wipe_reverse', name: 'Remotion Wipe (Reverse)', singleWordName: 'WipeRev', description: 'Remotion linear wipe curtain reveal reverse' },
  { id: 'remotion_flip', name: 'Remotion Flip', singleWordName: 'RemFlip', description: 'Remotion 3D flip transition' },
  { id: 'remotion_flip_reverse', name: 'Remotion Flip (Reverse)', singleWordName: 'FlipRev', description: 'Remotion reverse 3D flip transition' },
  { id: 'remotion_clockWipe', name: 'Remotion Clock Wipe', singleWordName: 'ClockWipe', description: 'Remotion radial clock wipe transition' },
  { id: 'remotion_clockWipe_reverse', name: 'Remotion Clock Wipe (Reverse)', singleWordName: 'ClockRev', description: 'Remotion reverse clock wipe transition' },
  { id: 'remotion_iris', name: 'Remotion Iris', singleWordName: 'Iris', description: 'Remotion iris circular opening transition' },
  { id: 'remotion_iris_reverse', name: 'Remotion Iris (Reverse)', singleWordName: 'IrisRev', description: 'Remotion reverse iris closing transition' },
  { id: 'remotion_zoomBlur', name: 'Remotion Zoom Blur', singleWordName: 'ZoomBlur', description: 'Remotion zoom blur cinematic transition' },
  { id: 'remotion_zoomBlur_reverse', name: 'Remotion Zoom Blur (Reverse)', singleWordName: 'ZoomBlurRev', description: 'Remotion reverse zoom blur transition' },
  { id: 'remotion_dreamyZoom', name: 'Remotion Dreamy Zoom', singleWordName: 'Dreamy', description: 'Remotion dreamy ethereal zoom transition' },
  { id: 'remotion_dreamyZoom_reverse', name: 'Remotion Dreamy Zoom (Reverse)', singleWordName: 'DreamyRev', description: 'Remotion reverse dreamy zoom transition' },
  { id: 'remotion_filmBurn', name: 'Remotion Film Burn', singleWordName: 'FilmBurn', description: 'Remotion vintage film burn exposure flash' },
  { id: 'remotion_filmBurn_reverse', name: 'Remotion Film Burn (Reverse)', singleWordName: 'BurnRev', description: 'Remotion reverse film burn transition' },
  { id: 'remotion_linearBlur', name: 'Remotion Linear Blur', singleWordName: 'LinBlur', description: 'Remotion directional linear motion blur' },
  { id: 'remotion_linearBlur_reverse', name: 'Remotion Linear Blur (Reverse)', singleWordName: 'LinBlurRev', description: 'Remotion reverse linear motion blur' },
  { id: 'remotion_bookFlip', name: 'Remotion Book Flip', singleWordName: 'BookFlip', description: 'Remotion 3D book page curl transition' },
  { id: 'remotion_bookFlip_reverse', name: 'Remotion Book Flip (Reverse)', singleWordName: 'BookRev', description: 'Remotion reverse book page curl' },
  { id: 'remotion_zoomInOut', name: 'Remotion Zoom In-Out', singleWordName: 'ZoomIO', description: 'Remotion dynamic zoom in and out transition' },
  { id: 'remotion_zoomInOut_reverse', name: 'Remotion Zoom In-Out (Reverse)', singleWordName: 'ZoomIORev', description: 'Remotion reverse zoom in-out transition' },
  { id: 'remotion_dissolve', name: 'Remotion Dissolve', singleWordName: 'RemDiss', description: 'Remotion smooth custom dissolve' },
  { id: 'remotion_dissolve_reverse', name: 'Remotion Dissolve (Reverse)', singleWordName: 'DissRev', description: 'Remotion reverse smooth dissolve' },
  { id: 'remotion_ripple', name: 'Remotion Ripple', singleWordName: 'Ripple', description: 'Remotion water ripple displacement transition' },
  { id: 'remotion_ripple_reverse', name: 'Remotion Ripple (Reverse)', singleWordName: 'RippleRev', description: 'Remotion reverse ripple displacement' },
  { id: 'remotion_crosswarp', name: 'Remotion Crosswarp', singleWordName: 'Warp', description: 'Remotion gravitational warp transition' },
  { id: 'remotion_crosswarp_reverse', name: 'Remotion Crosswarp (Reverse)', singleWordName: 'WarpRev', description: 'Remotion reverse gravitational warp' },
  { id: 'remotion_crossZoom', name: 'Remotion Cross Zoom', singleWordName: 'CrossZoom', description: 'Remotion optical zoom transition' },
  { id: 'remotion_crossZoom_reverse', name: 'Remotion Cross Zoom (Reverse)', singleWordName: 'CZoomRev', description: 'Remotion reverse optical zoom transition' },
  { id: 'remotion_swap', name: 'Remotion Swap', singleWordName: 'Swap', description: 'Remotion side-by-side swap transition' },
  { id: 'remotion_swap_reverse', name: 'Remotion Swap (Reverse)', singleWordName: 'SwapRev', description: 'Remotion reverse side-by-side swap' },
  { id: 'remotion_blurSlide', name: 'Remotion Blur Slide', singleWordName: 'BlurSlide', description: 'Remotion slide with directional motion blur' },
  { id: 'remotion_blurSlide_reverse', name: 'Remotion Blur Slide (Reverse)', singleWordName: 'BlurSlideRev', description: 'Remotion reverse blur slide' },
  { id: 'remotion_cube', name: 'Remotion Cube 3D', singleWordName: 'Cube', description: 'Remotion 3D rotating cube transition' },
  { id: 'remotion_cube_reverse', name: 'Remotion Cube 3D (Reverse)', singleWordName: 'CubeRev', description: 'Remotion reverse 3D rotating cube' },
  { id: 'remotion_spring', name: 'Remotion Spring (springTiming: damping 200, 45f)', singleWordName: 'Spring', description: 'Remotion springTiming physics transition with damped harmonic motion' },
  { id: 'remotion_spring_reverse', name: 'Remotion Spring (Reverse: Snap In)', singleWordName: 'SpringRev', description: 'Remotion reverse spring timing transition' },
  { id: 'random', name: 'Random', singleWordName: 'Random', description: 'Adaptive automatic mix per cut' }
];

export const getRandomTransition = (excludeType?: TransitionType): TransitionType => {
    const concreteTypes: TransitionType[] = [
      'crossfade',
      'cinematicDissolve',
      'smoothZoom',
      'slideLeft',
      'slideRight',
      'slideUp',
      'slideDown',
      'pageFlip3d',
      'softBlur',
      'lightSweep',
      'splitPanel',
      'motionBlur',
      'remotion_slide',
      'remotion_slide_reverse',
      'remotion_lightleak',
      'remotion_lightleak_reverse',
      'remotion_fade',
      'remotion_fade_reverse',
      'remotion_pushcut',
      'remotion_pushcut_reverse',
      'remotion_wipe',
      'remotion_wipe_reverse',
      'remotion_flip',
      'remotion_flip_reverse',
      'remotion_clockWipe',
      'remotion_clockWipe_reverse',
      'remotion_iris',
      'remotion_iris_reverse',
      'remotion_zoomBlur',
      'remotion_zoomBlur_reverse',
      'remotion_dreamyZoom',
      'remotion_dreamyZoom_reverse',
      'remotion_filmBurn',
      'remotion_filmBurn_reverse',
      'remotion_linearBlur',
      'remotion_linearBlur_reverse',
      'remotion_bookFlip',
      'remotion_bookFlip_reverse',
      'remotion_zoomInOut',
      'remotion_zoomInOut_reverse',
      'remotion_dissolve',
      'remotion_dissolve_reverse',
      'remotion_ripple',
      'remotion_ripple_reverse',
      'remotion_crosswarp',
      'remotion_crosswarp_reverse',
      'remotion_crossZoom',
      'remotion_crossZoom_reverse',
      'remotion_swap',
      'remotion_swap_reverse',
      'remotion_blurSlide',
      'remotion_blurSlide_reverse',
      'remotion_cube',
      'remotion_cube_reverse',
      'remotion_spring',
      'remotion_spring_reverse'
    ];
  let pool = concreteTypes;
  if (excludeType && pool.length > 1) {
    pool = pool.filter((t) => t !== excludeType);
  }
  return pool[Math.floor(Math.random() * pool.length)];
};
