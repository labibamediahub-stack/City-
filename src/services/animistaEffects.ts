import { AnimationEffectDefinition, drawPhotoCard, drawAmbientBackground, drawFittedImage } from './animationLibrary';
import { RenderContext } from '../types/timeline';

// Cubic bezier helpers matching Animista CSS curves
const cubicEase = (t: number, p1x: number, p1y: number, p2x: number, p2y: number): number => {
  // Approximate standard 1D cubic bezier interpolation for canvas
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  // Simple Newton iteration
  let u = t;
  for (let i = 0; i < 5; i++) {
    const currentX = ((ax * u + bx) * u + cx) * u;
    const slope = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(slope) < 1e-5) break;
    u -= (currentX - t) / slope;
    u = Math.max(0, Math.min(1, u));
  }
  return ((ay * u + by) * u + cy) * u;
};

// Preset Animista Curves
const easeScaleUp = (t: number) => cubicEase(t, 0.390, 0.575, 0.565, 1.000);
const easeScaleDown = (t: number) => cubicEase(t, 0.250, 0.460, 0.450, 0.940);
const easeFlip = (t: number) => cubicEase(t, 0.455, 0.030, 0.515, 0.955);
const easeSlide = (t: number) => cubicEase(t, 0.250, 0.460, 0.450, 0.940);
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const ANIMISTA_EFFECTS: AnimationEffectDefinition[] = [
  // -------------------------------------------------------------
  // 1. SCALE UP CENTER (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_scale_up_center',
    name: 'Animista: Scale-Up Center (Normal)',
    category: 'animista',
    description: 'কেন্দ্রে থেকে মসৃণ ০.৫x থেকে ১.০x স্কেল-আপ প্রবেশ',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scale = 0.5 + ease * 0.5 + p * 0.05;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'animista_scale_up_center_rev',
    name: 'Animista: Scale-Up Center (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: ১.০x থেকে ০.৫x সেন্টারে সংকুচিত হয়ে স্কেল-ডাউন',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scale = 1.0 - ease * 0.5;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },

  // -------------------------------------------------------------
  // 2. SCALE UP TOP-RIGHT (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_scale_up_tr',
    name: 'Animista: Scale-Up Top-Right (Normal)',
    category: 'animista',
    description: 'উপরের ডান কোণা থেকে ০.৫x থেকে ১.০x স্কেল-আপ',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scale = 0.5 + ease * 0.5;
      const offsetX = (1 - ease) * (w * 0.2);
      const offsetY = (1 - ease) * (-h * 0.2);
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'animista_scale_up_tr_rev',
    name: 'Animista: Scale-Up Top-Right (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: কেন্দ্র থেকে উপরের ডানে সংকুচিত হওয়া',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scale = 1.0 - ease * 0.5;
      const offsetX = ease * (w * 0.2);
      const offsetY = ease * (-h * 0.2);
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },

  // -------------------------------------------------------------
  // 3. SCALE UP HORIZONTAL CENTER (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_scale_up_hor_center',
    name: 'Animista: Scale-Up Hor-Center (Normal)',
    category: 'animista',
    description: 'অনুভূমিকভাবে ০.৪x থেকে ১.০x প্রসারিত হয়ে পর্দা উন্মোচন',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scaleX = 0.4 + ease * 0.6;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_scale_up_hor_center_rev',
    name: 'Animista: Scale-Up Hor-Center (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: আনুভূমিকভাবে ১.০x থেকে ০.৪x চেপে যাওয়া',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scaleX = 1.0 - ease * 0.6;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 4. SCALE UP VERTICAL TOP (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_scale_up_ver_top',
    name: 'Animista: Scale-Up Ver-Top (Normal)',
    category: 'animista',
    description: 'উপরের প্রান্ত থেকে উল্লম্বভাবে ০.৪x থেকে ১.০x খুলে যাওয়া',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scaleY = 0.4 + ease * 0.6;
      ctx.save();
      ctx.translate(w / 2, h / 2 - (1 - ease) * 40);
      ctx.scale(1.0, scaleY);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_scale_up_ver_top_rev',
    name: 'Animista: Scale-Up Ver-Top (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: কেন্দ্র থেকে উপরে সংকুচিত হয়ে গুটিয়ে যাওয়া',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleUp(enterP);
      const scaleY = 1.0 - ease * 0.6;
      ctx.save();
      ctx.translate(w / 2, h / 2 - ease * 40);
      ctx.scale(1.0, scaleY);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 5. SCALE DOWN TOP-RIGHT (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_scale_down_tr',
    name: 'Animista: Scale-Down Top-Right (Normal)',
    category: 'animista',
    description: '১.০x থেকে ০.৫x উপরের ডানে সংকুচিত হয়ে সেটল হওয়া',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleDown(enterP);
      const scale = 1.0 - ease * 0.5;
      const offsetX = ease * (w * 0.15);
      const offsetY = ease * (-h * 0.15);
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'animista_scale_down_tr_rev',
    name: 'Animista: Scale-Down Top-Right (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: ০.৫x থেকে বৃদ্ধি পেয়ে পুরো কেন্দ্রে আসা',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleDown(enterP);
      const scale = 0.5 + ease * 0.5;
      const offsetX = (1 - ease) * (w * 0.15);
      const offsetY = (1 - ease) * (-h * 0.15);
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },

  // -------------------------------------------------------------
  // 6. SCALE DOWN HORIZONTAL CENTER (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_scale_down_hor_center',
    name: 'Animista: Scale-Down Hor-Center (Normal)',
    category: 'animista',
    description: 'অনুভূমিকভাবে ১.০x থেকে ০.৩x পাতলা হয়ে যাওয়া',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleDown(enterP);
      const scaleX = 1.0 - ease * 0.65;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_scale_down_hor_center_rev',
    name: 'Animista: Scale-Down Hor-Center (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: পাতলা স্ল্যাব থেকে অনুভূমিকভাবে ১.০x বিস্তার',
    entranceDuration: 0.8,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeScaleDown(enterP);
      const scaleX = 0.35 + ease * 0.65;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 7. ROTATE CENTER 360 (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_rotate_center',
    name: 'Animista: Rotate-Center 360° (Normal)',
    category: 'animista',
    description: 'ঘড়ির কাঁটার দিকে মসৃণ ৩৬০ ডিগ্রি পূর্ণ ঘূর্ণন',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const angle = (1 - easeInOut(enterP)) * -Math.PI * 2;
      const scale = 0.88 + enterP * 0.12;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'animista_rotate_center_rev',
    name: 'Animista: Rotate-Center 360° (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: ঘড়ির কাঁটার বিপরীত দিকে ৩৬০ ডিগ্রি ঘূর্ণন',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const angle = (1 - easeInOut(enterP)) * Math.PI * 2;
      const scale = 0.88 + enterP * 0.12;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },

  // -------------------------------------------------------------
  // 8. ROTATE VERTICAL RIGHT 3D (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_rotate_vert_right',
    name: 'Animista: Rotate-Vert-Right 3D (Normal)',
    category: 'animista',
    description: 'ডান প্রান্তকে অক্ষ করে ৩D স্পেসে ৩৬০ ডিগ্রি স্পিন',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.0);
      const cosVal = Math.cos((1 - easeFlip(enterP)) * Math.PI * 2);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.abs(cosVal), 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_rotate_vert_right_rev',
    name: 'Animista: Rotate-Vert-Right 3D (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: বাঁ প্রান্তকে অক্ষ করে ৩D স্পেসে উল্টো স্পিন',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.0);
      const cosVal = Math.cos(easeFlip(enterP) * Math.PI * 2);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.abs(cosVal), 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 9. ROTATE DIAGONAL 2 3D (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_rotate_diagonal_2',
    name: 'Animista: Rotate-Diagonal-2 3D (Normal)',
    category: 'animista',
    description: 'তির্যক কোণ (-১, ১, ০) বরাবর ৩D ড্রামাটিক ৩৬০ ডিগ্রি রোলেশন',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const angle = (1 - enterP) * -Math.PI * 2;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.transform(Math.cos(angle * 0.5), Math.sin(angle * 0.3), -Math.sin(angle * 0.3), Math.cos(angle * 0.5), 0, 0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, angle * 0.2, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_rotate_diagonal_2_rev',
    name: 'Animista: Rotate-Diagonal-2 3D (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: তির্যক বিপরীত কোণে ৩D ৩৬০ ডিগ্রি রোলেশন',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const angle = (1 - enterP) * Math.PI * 2;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.transform(Math.cos(angle * 0.5), -Math.sin(angle * 0.3), Math.sin(angle * 0.3), Math.cos(angle * 0.5), 0, 0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, -angle * 0.2, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 10. ROTATE SCALE UP (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_rotate_scale_up',
    name: 'Animista: Rotate-Scale-Up (Normal)',
    category: 'animista',
    description: 'ঘুরতে ঘুরতে ২x পর্যন্ত প্রসারিত হয়ে আবার ১x আকারে ফেরা',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.0);
      const scalePeak = Math.sin(enterP * Math.PI) * 0.5; // reaches 1.5x
      const scale = 1.0 + scalePeak;
      const angle = (1 - enterP) * -Math.PI * 2;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'animista_rotate_scale_up_rev',
    name: 'Animista: Rotate-Scale-Up (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: বিপরীত দিকে ঘুরতে ঘুরতে ২x স্কেল-আপ হয়ে সেটল',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.0);
      const scalePeak = Math.sin(enterP * Math.PI) * 0.5;
      const scale = 1.0 + scalePeak;
      const angle = (1 - enterP) * Math.PI * 2;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
    }
  },

  // -------------------------------------------------------------
  // 11. FLIP VERTICAL 3D (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_flip_vertical_fwd',
    name: 'Animista: Flip-Vertical-Fwd 3D (Normal)',
    category: 'animista',
    description: 'উল্লম্ব অক্ষ ধরে সামনের দিকে ১৮০ ডিগ্রি 3D ফ্লিপ',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = easeFlip(enterP);
      const cosVal = Math.cos((1 - ease) * Math.PI);
      const scale = 0.95 + Math.sin(ease * Math.PI) * 0.15;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.abs(cosVal) * scale, scale);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_flip_vertical_fwd_rev',
    name: 'Animista: Flip-Vertical-Fwd 3D (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: উল্টো দিক থেকে ১৮০ ডিগ্রি 3D ফ্লিপ হয়ে সোজা হওয়া',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = easeFlip(enterP);
      const cosVal = Math.cos(ease * Math.PI);
      const scale = 0.95 + Math.sin(ease * Math.PI) * 0.15;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.abs(cosVal) * scale, scale);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 12. SLIDE TOP (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_slide_top',
    name: 'Animista: Slide-Top (Normal)',
    category: 'animista',
    description: 'উপর থেকে নিচে মসৃণভাবে নেমে এসে কেন্দ্রে অবস্থান নেওয়া',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeSlide(enterP);
      const offsetY = (1 - ease) * -140;
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'animista_slide_top_rev',
    name: 'Animista: Slide-Top (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: নিচ থেকে উপরে মসৃণভাবে উঠে কেন্দ্রে অবস্থান নেওয়া',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeSlide(enterP);
      const offsetY = (1 - ease) * 140;
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
    }
  },

  // -------------------------------------------------------------
  // 13. SLIDE RIGHT (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_slide_right',
    name: 'Animista: Slide-Right (Normal)',
    category: 'animista',
    description: 'ডান দিক থেকে ১০০px দ্রুত স্লাইড করে ভেতরে প্রবেশ',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeSlide(enterP);
      const offsetX = (1 - ease) * 160;
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
    }
  },
  {
    id: 'animista_slide_right_rev',
    name: 'Animista: Slide-Right (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: বাঁ দিক থেকে ১০০px দ্রুত স্লাইড করে ভেতরে প্রবেশ',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeSlide(enterP);
      const offsetX = (1 - ease) * -160;
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
    }
  },

  // -------------------------------------------------------------
  // 14. SLIDE ROTATE HORIZONTAL TOP 3D (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_slide_rotate_hor_top',
    name: 'Animista: Slide-Rotate-Hor-Top 3D (Normal)',
    category: 'animista',
    description: 'উপর থেকে -৯০ ডিগ্রি ফ্ল্যাপ হয়ে নিচে সোজা হয়ে সেটল',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeSlide(enterP);
      const offsetY = (1 - ease) * -120;
      const scaleY = 0.2 + ease * 0.8;
      ctx.save();
      ctx.translate(w / 2, h / 2 + offsetY);
      ctx.scale(1.0, scaleY);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_slide_rotate_hor_top_rev',
    name: 'Animista: Slide-Rotate-Hor-Top 3D (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: নিচ থেকে +৯০ ডিগ্রি ফ্ল্যাপ হয়ে উপরে সোজা হয়ে সেটল',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = easeSlide(enterP);
      const offsetY = (1 - ease) * 120;
      const scaleY = 0.2 + ease * 0.8;
      ctx.save();
      ctx.translate(w / 2, h / 2 + offsetY);
      ctx.scale(1.0, scaleY);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 15. ROTATE IN CENTER (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_rotate_in_center',
    name: 'Animista: Rotate-In-Center (Normal)',
    category: 'animista',
    description: 'অপাসিটি ০ থেকে ১ এবং -৩৬০° ঘূর্ণন সহ ফোকাসে আসা',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = easeInOut(enterP);
      const angle = (1 - ease) * -Math.PI * 2;
      const scale = 0.6 + ease * 0.4;
      ctx.save();
      ctx.globalAlpha = 0.3 + ease * 0.7;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_rotate_in_center_rev',
    name: 'Animista: Rotate-In-Center (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: কেন্দ্র থেকে ৩৬০° বিপরীত স্পিন হয়ে রূপান্তর',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = easeInOut(enterP);
      const angle = (1 - ease) * Math.PI * 2;
      const scale = 0.6 + ease * 0.4;
      ctx.save();
      ctx.globalAlpha = 0.3 + ease * 0.7;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 16. SWIRL OUT FORWARD (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_swirl_out_fwd',
    name: 'Animista: Swirl-Out-Fwd (Normal)',
    category: 'animista',
    description: 'ঘুরতে ঘুরতে ৫৪০° কোণে ৫x আকারে ঘূর্ণায়মান হয়ে ফ্রেমে ছড়িয়ে পড়া',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 1.8);
      // 0% -> rotate(0) scale(1) -> 100% -> rotate(540deg) scale(2.2)
      const ease = Math.pow(enterP, 2);
      const angle = ease * (Math.PI * 3); // 540 deg
      const scale = 1.0 + ease * 1.2;
      const alpha = Math.max(0.2, 1 - ease * 0.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_swirl_out_fwd_rev',
    name: 'Animista: Swirl-Out-Fwd (Reverse - Swirl In)',
    category: 'animista',
    description: 'উল্টো মোড: ৫৪০° ঘূর্ণন ও প্রসারিত আকার থেকে সেন্টারে একত্রিত হয়ে আসা',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 1.8);
      const ease = 1 - Math.pow(1 - enterP, 2);
      const angle = (1 - ease) * (Math.PI * 3);
      const scale = 2.0 - ease * 1.0;
      const alpha = 0.3 + ease * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawPhotoCard(ctx, img, w / 2, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 17. SWIRL OUT TOP FORWARD (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_swirl_out_top_fwd',
    name: 'Animista: Swirl-Out-Top-Fwd (Normal)',
    category: 'animista',
    description: 'উপরের শীর্ষ কেন্দ্রকে কেন্দ্র করে ৫৪০° ঘূর্ণনে ছড়িয়ে পড়া',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 1.8);
      const ease = Math.pow(enterP, 2);
      const angle = ease * (Math.PI * 3);
      const scale = 1.0 + ease * 1.2;
      const offsetY = ease * -80;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, 1 - ease * 0.4);
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_swirl_out_top_fwd_rev',
    name: 'Animista: Swirl-Out-Top-Fwd (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: উপর থেকে ৫৪০° ঘূর্ণনে নেমে এসে মূল ফ্রেমে ফেরা',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 1.8);
      const ease = 1 - Math.pow(1 - enterP, 2);
      const angle = (1 - ease) * (Math.PI * 3);
      const scale = 2.0 - ease * 1.0;
      const offsetY = (1 - ease) * -80;
      ctx.save();
      ctx.globalAlpha = 0.3 + ease * 0.7;
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 18. SWIRL OUT BOTTOM BACKWARD (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_swirl_out_bottom_bck',
    name: 'Animista: Swirl-Out-Bottom-Bck (Normal)',
    category: 'animista',
    description: 'নিচের অংশকে অক্ষ করে -৫৪০° ঘূর্ণনে সংকুচিত হয়ে মিলিয়ে যাওয়া',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 1.8);
      const ease = Math.pow(enterP, 2);
      const angle = ease * (-Math.PI * 3);
      const scale = 1.0 - ease * 0.6;
      const offsetY = ease * 70;
      ctx.save();
      ctx.globalAlpha = Math.max(0.3, 1 - ease * 0.4);
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_swirl_out_bottom_bck_rev',
    name: 'Animista: Swirl-Out-Bottom-Bck (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: নিচের বিন্দু থেকে -৫৪০° ঘূর্ণন খুলে কেন্দ্রে পূর্ণ বিস্তার',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 1.8);
      const ease = 1 - Math.pow(1 - enterP, 2);
      const angle = (1 - ease) * (-Math.PI * 3);
      const scale = 0.4 + ease * 0.6;
      const offsetY = (1 - ease) * 70;
      ctx.save();
      ctx.globalAlpha = 0.3 + ease * 0.7;
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 19. SWIRL OUT LEFT BACKWARD (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_swirl_out_left_bck',
    name: 'Animista: Swirl-Out-Left-Bck (Normal)',
    category: 'animista',
    description: 'বাঁ প্রান্তকে অক্ষ করে -৫৪০° ঘূর্ণনে সংকুচিত হওয়া',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 1.8);
      const ease = Math.pow(enterP, 2);
      const angle = ease * (-Math.PI * 3);
      const scale = 1.0 - ease * 0.6;
      const offsetX = ease * -80;
      ctx.save();
      ctx.globalAlpha = Math.max(0.3, 1 - ease * 0.4);
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_swirl_out_left_bck_rev',
    name: 'Animista: Swirl-Out-Left-Bck (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: বাঁ প্রান্ত থেকে -৫৪০° বিপরীত ঘূর্ণনে কেন্দ্রে বিকশিত হওয়া',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 1.8);
      const ease = 1 - Math.pow(1 - enterP, 2);
      const angle = (1 - ease) * (-Math.PI * 3);
      const scale = 0.4 + ease * 0.6;
      const offsetX = (1 - ease) * -80;
      ctx.save();
      ctx.globalAlpha = 0.3 + ease * 0.7;
      drawPhotoCard(ctx, img, w / 2 + offsetX, h / 2, w * 0.65, h * 0.68, angle, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 20. TRACKING IN EXPAND (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_tracking_in_expand',
    name: 'Animista: Tracking-In-Expand (Normal)',
    category: 'animista',
    description: 'সঙ্কুচিত অনুভূমিক অপাসিটি ০ থেকে ১ এবং মসৃণ টাইপোগ্রাফিক বিস্তার',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = cubicEase(enterP, 0.215, 0.610, 0.355, 1.000);
      const scaleX = 0.5 + ease * 0.5;
      const alpha = 0.2 + ease * 0.8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_tracking_in_expand_rev',
    name: 'Animista: Tracking-In-Expand (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: পূর্ণ বিস্তার থেকে কেন্দ্রে সঙ্কুচিত হয়ে মিলিয়ে যাওয়া',
    entranceDuration: 0.9,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.2);
      const ease = cubicEase(enterP, 0.215, 0.610, 0.355, 1.000);
      const scaleX = 1.0 - ease * 0.5;
      const alpha = 1.0 - ease * 0.7;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, alpha);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, 1.0);
      drawPhotoCard(ctx, img, 0, 0, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', 1.0, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 21. TRACKING IN EXPAND FORWARD BOTTOM 3D (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_tracking_in_fwd_bottom',
    name: 'Animista: Tracking-In-Fwd-Bottom 3D (Normal)',
    category: 'animista',
    description: 'নিচের গভীর ৩D স্পেস থেকে উড়ে এসে কেন্দ্রে লক হওয়া',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = cubicEase(enterP, 0.215, 0.610, 0.355, 1.000);
      const scale = 0.45 + ease * 0.55;
      const offsetY = (1 - ease) * 140;
      const alpha = 0.3 + ease * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_tracking_in_fwd_bottom_rev',
    name: 'Animista: Tracking-In-Fwd-Bottom 3D (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: কেন্দ্র থেকে নিচের গভীর ৩D স্পেসে উড়ে চলে যাওয়া',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'mint_gradient');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = cubicEase(enterP, 0.215, 0.610, 0.355, 1.000);
      const scale = 1.0 - ease * 0.55;
      const offsetY = ease * 140;
      const alpha = 1.0 - ease * 0.7;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, alpha);
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },

  // -------------------------------------------------------------
  // 22. TRACKING IN CONTRACT BACK BOTTOM 3D (Normal & Reverse)
  // -------------------------------------------------------------
  {
    id: 'animista_tracking_in_contract_bck_bottom',
    name: 'Animista: Tracking-Contract-Bck-Bottom 3D (Normal)',
    category: 'animista',
    description: 'উঁচু ৩D পারসপেক্টিভ ও নিচের দূরত্ব থেকে সামনে এসে স্থিত হওয়া',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = cubicEase(enterP, 0.215, 0.610, 0.355, 1.000);
      const scale = 1.35 - ease * 0.35;
      const offsetY = (1 - ease) * 120;
      const alpha = 0.35 + ease * 0.65;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  },
  {
    id: 'animista_tracking_in_contract_bck_bottom_rev',
    name: 'Animista: Tracking-Contract-Bck-Bottom 3D (Reverse)',
    category: 'animista',
    description: 'উল্টো মোড: কেন্দ্র থেকে উঁচু ৩D পারসপেক্টিভ ও দূরে সরে যাওয়া',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const enterP = Math.min(1.0, p * 2.0);
      const ease = cubicEase(enterP, 0.215, 0.610, 0.355, 1.000);
      const scale = 1.0 + ease * 0.35;
      const offsetY = ease * 120;
      const alpha = 1.0 - ease * 0.65;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, alpha);
      drawPhotoCard(ctx, img, w / 2, h / 2 + offsetY, w * 0.65, h * 0.68, 0, 15, 12, 0.45, '', scale, 'cover', undefined, undefined, context);
      ctx.restore();
    }
  }
];

export const getRandomAnimistaAnimation = (excludeId?: string): AnimationEffectDefinition => {
  let pool = ANIMISTA_EFFECTS;
  if (excludeId && pool.length > 1) {
    pool = pool.filter((a) => a.id !== excludeId);
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
};
