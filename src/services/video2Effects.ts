/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimationEffectDefinition, drawAmbientBackground, roundRect } from './animationLibrary';
import { renderStyledPhotoCard, getRandomFrameConfig } from './photoFrameRenderer';
import { RenderContext } from '../types/timeline';

// Helper to safely extract secondary neighbor images for multi-card collages
const getSecondaries = (img: HTMLImageElement, context?: RenderContext): HTMLImageElement[] => {
  if (context?.getNeighborImages) {
    const neighbors = context.getNeighborImages();
    if (neighbors.length > 0) return neighbors;
  }
  return [img, img, img, img, img, img];
};

// Helper to get frame parameters for current slot with harmonious fallback
const getSlotFrame = (context?: RenderContext, defaultIndex = 0) => {
  if (context?.slot?.frameStyle) {
    return {
      style: context.slot.frameStyle,
      color: context.slot.frameColor || '#f59e0b',
      accent: context.slot.frameAccentColor || '#fef08a'
    };
  }
  const cfg = getRandomFrameConfig(context?.slotIndex ?? defaultIndex);
  return {
    style: cfg.frameStyle,
    color: cfg.frameColor,
    accent: cfg.frameAccentColor
  };
};

// Smooth cubic ease out helper for rock-solid, jitter-free entrance
const smoothEaseOut = (t: number): number => {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
};

export const VIDEO2_EFFECTS: AnimationEffectDefinition[] = [
  // 1. Cinematic Smooth Dissolve & Soft Zoom
  {
    id: 'video2_pixel_block_dissolve',
    name: 'Cinematic Soft Zoom & Fade',
    category: 'uploadedVideo',
    description: 'Smooth cubic scale-up from 0.94x to 1.0x with soft fade and rock-steady presentation',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 1);
      const enterP = Math.min(1.0, p * 2.2);
      const ease = smoothEaseOut(enterP);

      const cardW = w * 0.65;
      const cardH = h * 0.68;
      const scale = 0.94 + ease * 0.06 + p * 0.025;
      const alpha = 0.4 + ease * 0.6;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 30,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 2. Cinematic 3D Perspective Slide
  {
    id: 'video2_perspective_slide',
    name: 'Cinematic 3D Perspective Slide',
    category: 'uploadedVideo',
    description: 'Smooth 3D slide-in from right with stable centered focus',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'vignette');
      const frame = getSlotFrame(context, 2);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.62;
      const cardH = h * 0.65;
      const startX = w * 1.3;
      const targetX = (w - cardW) / 2;
      const x = startX + (targetX - startX) * ease;
      const scale = 0.95 + ease * 0.05;

      ctx.save();
      ctx.globalAlpha = Math.min(1, ease * 1.2);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, x, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 3. Hero Spotlight Reveal
  {
    id: 'video2_hero_spotlight',
    name: 'Hero Spotlight Reveal',
    category: 'uploadedVideo',
    description: 'Soft glow and smooth scale-up with pristine centered subject focus',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'radial_spotlight');
      const frame = getSlotFrame(context, 3);
      const ease = smoothEaseOut(Math.min(1, p * 2.2));

      const cardW = w * 0.64;
      const cardH = h * 0.67;
      const scale = 0.9 + ease * 0.1;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 40,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 4. Luminous Iris Spotlight
  {
    id: 'video2_iris_spotlight',
    name: 'Luminous Iris Spotlight',
    category: 'uploadedVideo',
    description: 'Smooth iris aperture reveal with soft spotlight focus',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 4);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.65;
      const cardH = h * 0.68;

      ctx.save();
      ctx.beginPath();
      const radius = Math.max(w, h) * ease * 0.9;
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.clip();

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 30,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 5. Cinematic 3D Depth Glide
  {
    id: 'video2_3d_depth_glide',
    name: 'Cinematic 3D Depth Glide',
    category: 'uploadedVideo',
    description: 'Elegant 3D depth approach locking into stable centered alignment',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'cinematic_gradient');
      const frame = getSlotFrame(context, 5);
      const ease = smoothEaseOut(Math.min(1, p * 1.9));

      const cardW = w * 0.66;
      const cardH = h * 0.69;
      const scale = 0.8 + ease * 0.2;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 6. Horizontal Slit Doors
  {
    id: 'video2_slit_doors',
    name: 'Horizontal Slit Doors',
    category: 'uploadedVideo',
    description: 'Clean horizontal split doors opening smoothly from center',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 6);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.65;
      const cardH = h * 0.68;

      ctx.save();
      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 30,
        cornerRadius: 0
      });

      // Doors closing/opening
      const doorOffset = (1 - ease) * (h / 2);
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, w, h / 2 - doorOffset);
      ctx.fillRect(0, h / 2 + doorOffset, w, h / 2 - doorOffset);
      ctx.restore();
    }
  },

  // 7. Centerpiece Gold Showcase
  {
    id: 'video2_gold_showcase',
    name: 'Centerpiece Gold Showcase',
    category: 'uploadedVideo',
    description: 'Elegant steady photo card presentation on illuminated circular stage',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'radial_spotlight');
      const frame = getSlotFrame(context, 7);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.62;
      const cardH = h * 0.65;
      const scale = 0.92 + ease * 0.08;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 45,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 8. Dual Floating Presentation
  {
    id: 'video2_dual_cards',
    name: 'Cinematic Floating Showcase',
    category: 'uploadedVideo',
    description: 'Smooth floating photo frame gracefully settling into stable centered view',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 8);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.65;
      const cardH = h * 0.68;
      const scale = 0.94 + ease * 0.06 + p * 0.02;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 9. Horizontal Glide & Focus
  {
    id: 'video2_horizontal_glide',
    name: 'Horizontal Glide & Focus',
    category: 'uploadedVideo',
    description: 'Smooth slide-in from left locking pristine photo into center',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'cinematic_gradient');
      const frame = getSlotFrame(context, 9);
      const ease = smoothEaseOut(Math.min(1, p * 2.1));

      const cardW = w * 0.65;
      const cardH = h * 0.68;
      const startX = -cardW * 1.2;
      const targetX = (w - cardW) / 2;
      const x = startX + (targetX - startX) * ease;

      ctx.save();
      ctx.globalAlpha = ease;
      renderStyledPhotoCard(ctx, img, x, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 30,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 10. Classic Beveled Display
  {
    id: 'video2_beveled_display',
    name: 'Classic Beveled Display',
    category: 'uploadedVideo',
    description: 'Elegant rounded corner beveled frame with bright central presentation',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 10);
      const ease = smoothEaseOut(Math.min(1, p * 2.2));

      const cardW = w * 0.65;
      const cardH = h * 0.68;
      const scale = 0.95 + ease * 0.05;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: 'metallic_gold',
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 11. Cinematic 3D Swing
  {
    id: 'video2_3d_swing',
    name: 'Cinematic 3D Swing',
    category: 'uploadedVideo',
    description: 'Smooth 3D space traversal settling into parallel alignment',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'vignette');
      const frame = getSlotFrame(context, 11);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.64;
      const cardH = h * 0.67;
      const scale = 0.9 + ease * 0.1;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 30,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 12. Cinematic Dual Glide
  {
    id: 'video2_cinematic_dual_glide',
    name: 'Cinematic Dual Glide',
    category: 'uploadedVideo',
    description: 'Dual opposing frames sliding from top and bottom into center',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 12);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.62;
      const cardH = h * 0.65;
      const offsetY = (1 - ease) * 150;

      ctx.save();
      ctx.globalAlpha = ease;
      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2 - offsetY, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 13. Cinematic Letterbox Scope
  {
    id: 'video2_letterbox_scope',
    name: 'Cinematic Letterbox Scope',
    category: 'uploadedVideo',
    description: 'Wide cinematic letterbox scope opening with dramatic smooth zoom',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'cinematic_gradient');
      const frame = getSlotFrame(context, 13);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.68;
      const cardH = h * 0.71;
      const scale = 0.88 + ease * 0.12;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 40,
        cornerRadius: 0
      });

      // Letterbox bars
      const barH = (1 - ease) * 45;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);
      ctx.restore();
    }
  },

  // 14. Parallax Hero Zoom
  {
    id: 'video2_parallax_hero_zoom',
    name: 'Parallax Hero Zoom',
    category: 'uploadedVideo',
    description: 'Smooth cinematic parallax scale and soft shadow without any cropping',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'radial_spotlight');
      const frame = getSlotFrame(context, 14);
      const ease = smoothEaseOut(Math.min(1, p * 2.1));

      const cardW = w * 0.65;
      const cardH = h * 0.68;
      const scale = 0.95 + ease * 0.05 + p * 0.02;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 15. Depth Float & Bokeh
  {
    id: 'video2_depth_float',
    name: 'Depth Float & Bokeh',
    category: 'uploadedVideo',
    description: 'Smooth floating emergence from depth with focused center presentation',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 15);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.64;
      const cardH = h * 0.67;
      const scale = 0.9 + ease * 0.1;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 38,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 16. Vertical Curtain Reveal
  {
    id: 'video2_curtain_reveal',
    name: 'Vertical Curtain Reveal',
    category: 'uploadedVideo',
    description: 'Smooth vertical curtain opening revealing pristine photo',
    entranceDuration: 1.0,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 16);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.65;
      const cardH = h * 0.68;

      ctx.save();
      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 30,
        cornerRadius: 0
      });

      const curtainW = (1 - ease) * (w / 2);
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, curtainW, h);
      ctx.fillRect(w - curtainW, 0, curtainW, h);
      ctx.restore();
    }
  },

  // 17. Horizontal Soft Glide
  {
    id: 'video2_horizontal_soft_glide',
    name: 'Horizontal Soft Glide',
    category: 'uploadedVideo',
    description: 'Smooth right-to-left slide into full centered focus',
    entranceDuration: 1.1,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'cinematic_gradient');
      const frame = getSlotFrame(context, 17);
      const ease = smoothEaseOut(Math.min(1, p * 2.1));

      const cardW = w * 0.65;
      const cardH = h * 0.68;
      const startX = w * 1.2;
      const targetX = (w - cardW) / 2;
      const x = startX + (targetX - startX) * ease;

      ctx.save();
      ctx.globalAlpha = ease;
      renderStyledPhotoCard(ctx, img, x, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 30,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 18. Smooth Rotational Settle
  {
    id: 'video2_rotational_settle',
    name: 'Smooth Rotational Settle',
    category: 'uploadedVideo',
    description: 'Gentle angular rotation settling smoothly into straight center',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'vignette');
      const frame = getSlotFrame(context, 18);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.63;
      const cardH = h * 0.66;
      const rot = (1 - ease) * 0.05;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 19. Radial Radar Beam Sweep
  {
    id: 'video2_radar_sweep',
    name: 'Radial Radar Beam Sweep',
    category: 'uploadedVideo',
    description: '360-degree bright radar beam sweep revealing full picture frame',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'radial_spotlight');
      const frame = getSlotFrame(context, 19);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.65;
      const cardH = h * 0.68;

      ctx.save();
      ctx.globalAlpha = ease;
      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  },

  // 20. Spiral Ingress Settle
  {
    id: 'video2_spiral_ingress',
    name: 'Spiral Ingress Settle',
    category: 'uploadedVideo',
    description: 'Smooth convergent ingress from all directions into stable center',
    entranceDuration: 1.2,
    render: (ctx, img, p, e, _d, w, h, context) => {
      drawAmbientBackground(ctx, img, w, h, e, 'blur_vignette');
      const frame = getSlotFrame(context, 20);
      const ease = smoothEaseOut(Math.min(1, p * 2.0));

      const cardW = w * 0.65;
      const cardH = h * 0.68;
      const scale = 0.8 + ease * 0.2;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);

      renderStyledPhotoCard(ctx, img, (w - cardW) / 2, (h - cardH) / 2, cardW, cardH, {
        frameStyle: frame.style,
        frameColor: frame.color,
        accentColor: frame.accent,
        shadowBlur: 35,
        cornerRadius: 0
      });
      ctx.restore();
    }
  }
];
