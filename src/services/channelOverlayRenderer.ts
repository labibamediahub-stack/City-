import { ChannelSettings, ChannelStyleId, BroadcastOverlayConfig } from '../types/timeline';
import { TimedSubtitleCue, getActiveSubtitleAtTime } from './subtitleEngine';
import { getRenderPerformanceFlags } from './devicePerformance';

export class ChannelOverlayRenderer {
  private static lowerThirdSprite: { key: string; canvas: HTMLCanvasElement; pad: number; boxW: number; boxH: number } | null = null;
  private static subtitleSprite: { key: string; canvas: HTMLCanvasElement; boxW: number; boxH: number } | null = null;
  private static watermarkSprite: { key: string; canvas: HTMLCanvasElement; textW: number; textH: number; pad: number } | null = null;
  private static ctaSprite: { key: string; canvas: HTMLCanvasElement; boxW: number; boxH: number; pad: number } | null = null;
  private static topLeftSprite: { key: string; canvas: HTMLCanvasElement; padX: number; boxH: number; pad: number } | null = null;

  public static clearOverlayCaches(): void {
    [this.lowerThirdSprite, this.subtitleSprite, this.watermarkSprite, this.ctaSprite, this.topLeftSprite].forEach((entry) => {
      if (entry?.canvas) {
        try {
          entry.canvas.width = 0;
          entry.canvas.height = 0;
        } catch (_) {}
      }
    });
    this.lowerThirdSprite = null;
    this.subtitleSprite = null;
    this.watermarkSprite = null;
    this.ctaSprite = null;
    this.topLeftSprite = null;
  }
  /**
   * Main overlay render function: paints both Top-Left Channel Name and Animated Watermark
   * directly onto the canvas. Works for live canvas preview, scrubbing, and exported MP4 frames.
   */
  public static renderOverlay(
    canvas: HTMLCanvasElement,
    settings: ChannelSettings | null | undefined,
    time: number
  ): void {
    if (!canvas || !settings) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width || 1280;
    const h = canvas.height || 720;
    const cleanName = settings.name ? settings.name.trim() : '';
    const styleId: ChannelStyleId = settings.styleId || 'cinematic_gold';

    // 1. Render Top-Left Main Channel Name (if channel name set & enabled, default ON)
    if (cleanName) {
      if (settings.channelNameEnabled !== false) {
        this.renderTopLeftChannelName(ctx, cleanName, styleId, time, w, h);
      }

      // 2. Render Floating Animated Watermark if enabled (default ON)
      if (settings.watermarkEnabled !== false) {
        this.renderFloatingWatermark(
          ctx,
          cleanName,
          styleId,
          settings.watermarkOpacity ?? 0.4,
          time,
          w,
          h
        );
      }
    }

    // 3. Render Subscribe & Like CTA Animated Popup at bottom-center (default ON)
    if (settings.ctaEnabled !== false) {
      this.renderCtaPopup(ctx, settings, time, w, h);
    }
  }

  /**
   * Renders modern broadcast-grade Bangla Lower-Third (drama title, episode, honest schedule badge)
   * and Dynamic Bangla Subtitles timed from the narration script, automatically clearing the CTA zone.
   */
  public static renderBroadcastOverlay(
    canvas: HTMLCanvasElement,
    broadcast: BroadcastOverlayConfig | null | undefined,
    subtitleCues: TimedSubtitleCue[],
    settings: ChannelSettings | null | undefined,
    time: number
  ): void {
    if (!canvas || !broadcast || !broadcast.enabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width || 1280;
    const h = canvas.height || 720;
    const isCtaActive = this.getActiveCtaCycle(settings || undefined, time) !== null;

    // 1. Broadcast Bangla Lower-Third (Top-Right or Bottom-Left clean info card)
    if (broadcast.showLowerThird && broadcast.dramaTitle?.trim()) {
      this.renderBanglaLowerThird(ctx, broadcast, time, w, h, isCtaActive);
    }

    // 2. Dynamic Bangla Subtitles (automatically lifts slightly if CTA pill is visible)
    if (broadcast.showSubtitles && subtitleCues && subtitleCues.length > 0) {
      const activeCue = getActiveSubtitleAtTime(subtitleCues, time);
      if (activeCue) {
        this.renderSubtitleBar(ctx, activeCue.text, w, h, isCtaActive);
      }
    }
  }

  private static renderBanglaLowerThird(
    ctx: CanvasRenderingContext2D,
    broadcast: BroadcastOverlayConfig,
    time: number,
    w: number,
    h: number,
    isCtaActive: boolean
  ): void {
    const cleanDrama = broadcast.dramaTitle.replace(/\s*\([^)]*\)/g, '').trim();
    const ep = broadcast.episodeLabel?.trim() || '';
    const primaryLine = ep ? `${cleanDrama} • ${ep}` : cleanDrama;
    const typePart = broadcast.contentTypeLabel?.trim() || '';
    const schedPart = broadcast.scheduleLabel?.trim() || '';
    const secondaryLine =
      [typePart, schedPart].filter((x) => x.length > 0).join('  •  ') ||
      'নাটক রিভিউ ও গল্প বিশ্লেষণ';

    const accentPalette = [
      '#F59E0B',
      '#06B6D4',
      '#F43F5E',
      '#10B981',
      '#8B5CF6',
      '#EA580C',
      '#3B82F6',
      '#EC4899',
      '#14B8A6',
      '#EAB308'
    ];
    const accent =
      broadcast.accentColor ||
      accentPalette[(Math.max(1, broadcast.channelSlotNumber || 1) - 1) % accentPalette.length];

    const reduceShadow = getRenderPerformanceFlags().reduceShadowBlur;
    const cacheKey = `${primaryLine}|${typePart}|${schedPart}|${accent}|${w}|${h}|${reduceShadow ? 1 : 0}`;

    if (!this.lowerThirdSprite || this.lowerThirdSprite.key !== cacheKey) {
      const sprite = this.lowerThirdSprite?.canvas || document.createElement('canvas');
      const sCtx = sprite.getContext('2d');
      if (!sCtx) return;

      const titleFont = Math.max(15, Math.min(24, Math.round(w * 0.0175)));
      const subFont = Math.max(12, Math.min(18, Math.round(w * 0.0125)));

      sCtx.font = `700 ${titleFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
      const w1 = sCtx.measureText(primaryLine).width;

      const sepText = '  •  ';
      sCtx.font = `600 ${subFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
      const wType = typePart ? sCtx.measureText(typePart).width : 0;
      const wSep = typePart && schedPart ? sCtx.measureText(sepText).width : 0;
      sCtx.font = `700 ${subFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
      const wSched = schedPart ? sCtx.measureText(schedPart).width : 0;
      const w2 = typePart || schedPart ? wType + wSep + wSched : sCtx.measureText(secondaryLine).width;

      const padX = 18;
      const boxW = Math.ceil(Math.min(w * 0.58, Math.max(w1, w2) + padX * 2 + 12));
      const boxH = Math.round(titleFont + subFont + 24);
      const pad = reduceShadow ? 4 : 16;

      sprite.width = boxW + pad * 2;
      sprite.height = boxH + pad * 2;

      const dCtx = sprite.getContext('2d');
      if (!dCtx) return;

      const x = pad;
      const y = pad;

      dCtx.save();
      if (!reduceShadow) {
        dCtx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        dCtx.shadowBlur = 14;
      }
      dCtx.fillStyle = 'rgba(10, 15, 28, 0.84)';
      this.drawRoundedRect(dCtx, x, y, boxW, boxH, 10);
      dCtx.fill();

      dCtx.shadowBlur = 0;
      dCtx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      dCtx.lineWidth = 1;
      this.drawRoundedRect(dCtx, x, y, boxW, boxH, 10);
      dCtx.stroke();

      dCtx.fillStyle = accent;
      this.drawRoundedRect(dCtx, x + 6, y + 7, 5, boxH - 14, 3);
      dCtx.fill();

      const maxTextW = boxW - padX * 2;
      const textX = x + padX + 4;
      dCtx.fillStyle = '#FFFFFF';
      dCtx.textAlign = 'left';
      dCtx.textBaseline = 'top';
      dCtx.font = `700 ${titleFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
      dCtx.fillText(primaryLine, textX, y + 8, maxTextW);

      const subY = y + 10 + titleFont + 2;
      if (typePart && schedPart) {
        const scale = w2 > maxTextW && w2 > 0 ? maxTextW / w2 : 1;
        let cursorX = textX;

        dCtx.fillStyle = 'rgba(226, 232, 240, 0.92)';
        dCtx.font = `600 ${subFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
        dCtx.fillText(typePart, cursorX, subY, wType * scale);
        cursorX += wType * scale;

        dCtx.fillStyle = 'rgba(148, 163, 184, 0.75)';
        dCtx.fillText(sepText, cursorX, subY, wSep * scale);
        cursorX += wSep * scale;

        dCtx.fillStyle = accent;
        dCtx.font = `700 ${subFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
        dCtx.fillText(schedPart, cursorX, subY, wSched * scale);
      } else {
        dCtx.fillStyle = accent;
        dCtx.font = `600 ${subFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
        dCtx.fillText(secondaryLine, textX, subY, maxTextW);
      }
      dCtx.restore();

      this.lowerThirdSprite = { key: cacheKey, canvas: sprite, pad, boxW, boxH };
    }

    const { canvas: sprite, pad, boxH } = this.lowerThirdSprite;
    const x = Math.round(w * 0.028);
    const y = isCtaActive ? Math.round(h - boxH - h * 0.16) : Math.round(h - boxH - h * 0.045);
    const slideAlpha = Math.min(1, time / 0.8);

    ctx.save();
    ctx.globalAlpha = 0.96 * slideAlpha;
    ctx.drawImage(sprite, x - pad, y - pad);
    ctx.restore();
  }

  private static renderSubtitleBar(
    ctx: CanvasRenderingContext2D,
    text: string,
    w: number,
    h: number,
    isCtaActive: boolean
  ): void {
    const cacheKey = `${text}|${w}|${h}`;
    if (!this.subtitleSprite || this.subtitleSprite.key !== cacheKey) {
      const sprite = this.subtitleSprite?.canvas || document.createElement('canvas');
      const sCtx = sprite.getContext('2d');
      if (!sCtx) return;

      const fontSize = Math.max(17, Math.min(26, Math.round(w * 0.0195)));
      sCtx.font = `700 ${fontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;

      const maxTextWidth = w * 0.78;
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const test = currentLine ? `${currentLine} ${word}` : word;
        if (sCtx.measureText(test).width > maxTextWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = Math.round(fontSize * 1.32);
      const padX = 20;
      const padY = 10;
      const widest = Math.max(0, ...lines.map((l) => sCtx.measureText(l).width));
      const boxW = Math.ceil(Math.min(w * 0.88, widest + padX * 2));
      const boxH = lines.length * lineHeight + padY * 2;

      sprite.width = boxW;
      sprite.height = boxH;

      const dCtx = sprite.getContext('2d');
      if (!dCtx) return;

      dCtx.save();
      dCtx.fillStyle = 'rgba(5, 8, 16, 0.78)';
      this.drawRoundedRect(dCtx, 0, 0, boxW, boxH, 10);
      dCtx.fill();

      dCtx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      dCtx.lineWidth = 1;
      this.drawRoundedRect(dCtx, 0, 0, boxW, boxH, 10);
      dCtx.stroke();

      dCtx.fillStyle = '#FFFFFF';
      dCtx.textAlign = 'center';
      dCtx.textBaseline = 'top';
      dCtx.font = `700 ${fontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
      if (!getRenderPerformanceFlags().reduceShadowBlur) {
        dCtx.shadowColor = 'rgba(0,0,0,0.9)';
        dCtx.shadowBlur = 4;
      }

      for (let i = 0; i < lines.length; i++) {
        dCtx.fillText(lines[i], boxW / 2, padY + i * lineHeight, boxW - padX);
      }
      dCtx.restore();

      this.subtitleSprite = { key: cacheKey, canvas: sprite, boxW, boxH };
    }

    const { canvas: sprite, boxW, boxH } = this.subtitleSprite;
    const x = Math.round((w - boxW) / 2);
    const y = isCtaActive
      ? Math.round(h - boxH - h * 0.17)
      : Math.round(h - boxH - h * 0.055);
    ctx.drawImage(sprite, x, y);
  }

  /**
   * Render Top-Left Main Channel Name with 10 distinct professional styles & subtle animations
   */
  private static renderTopLeftChannelName(
    ctx: CanvasRenderingContext2D,
    name: string,
    styleId: ChannelStyleId,
    time: number,
    w: number,
    h: number
  ): void {
    const baseFontSize = Math.max(16, Math.min(36, Math.round(w * 0.021)));
    const posX = Math.round(w * 0.032);
    const posY = Math.round(h * 0.075);
    const reduceShadow = getRenderPerformanceFlags().reduceShadowBlur;

    const staticSpriteStyles: ChannelStyleId[] = [
      'neon_cyan',
      'royal_silver',
      'fire_glow',
      'electric_blue',
      'elegant_white',
      'shadow_edge',
      'orbit_motion'
    ];

    if (staticSpriteStyles.includes(styleId)) {
      const cacheKey = `${name}|${styleId}|${w}|${h}|${reduceShadow ? 1 : 0}`;
      if (!this.topLeftSprite || this.topLeftSprite.key !== cacheKey) {
        const sprite = this.topLeftSprite?.canvas || document.createElement('canvas');
        const sCtx = sprite.getContext('2d');
        if (!sCtx) return;

        sCtx.font = `bold ${baseFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
        const textW = sCtx.measureText(name).width;
        const textH = baseFontSize * 1.25;
        const padX = baseFontSize * 0.6;
        const padY = baseFontSize * 0.35;
        const boxW = Math.ceil(textW + padX * 2);
        const boxH = Math.ceil(textH + padY * 2);
        const pad = reduceShadow ? 4 : 18;

        sprite.width = boxW + pad * 2;
        sprite.height = boxH + pad * 2;

        const dCtx = sprite.getContext('2d');
        if (!dCtx) return;

        dCtx.save();
        dCtx.translate(pad + padX, pad + boxH / 2);
        dCtx.font = `bold ${baseFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
        dCtx.textBaseline = 'middle';

        switch (styleId) {
          case 'neon_cyan': {
            dCtx.fillStyle = 'rgba(3, 15, 24, 0.78)';
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 6);
            dCtx.fill();
            dCtx.strokeStyle = '#00E5FF';
            dCtx.lineWidth = 1.5;
            if (!reduceShadow) {
              dCtx.shadowColor = '#00E5FF';
              dCtx.shadowBlur = 12;
            }
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 6);
            dCtx.stroke();
            dCtx.fillStyle = '#E0F7FA';
            dCtx.fillText(name, 0, 0);
            dCtx.fillStyle = '#00E5FF';
            dCtx.fillText(name, 0, 0);
            break;
          }
          case 'royal_silver': {
            dCtx.fillStyle = 'rgba(18, 22, 28, 0.75)';
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.fill();
            const borderGrad = dCtx.createLinearGradient(-padX, 0, boxW, 0);
            borderGrad.addColorStop(0, '#ECEFF1');
            borderGrad.addColorStop(0.5, '#90A4AE');
            borderGrad.addColorStop(1, '#CFD8DC');
            dCtx.strokeStyle = borderGrad;
            dCtx.lineWidth = 1.5;
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.stroke();
            const textGrad = dCtx.createLinearGradient(0, -boxH / 2, 0, boxH / 2);
            textGrad.addColorStop(0, '#FFFFFF');
            textGrad.addColorStop(0.4, '#ECEFF1');
            textGrad.addColorStop(1, '#B0BEC5');
            if (!reduceShadow) {
              dCtx.shadowColor = 'rgba(207, 216, 220, 0.8)';
              dCtx.shadowBlur = 6;
            }
            dCtx.fillStyle = textGrad;
            dCtx.fillText(name, 0, 0);
            break;
          }
          case 'fire_glow': {
            dCtx.fillStyle = 'rgba(28, 8, 3, 0.78)';
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.fill();
            dCtx.strokeStyle = 'rgba(255, 87, 34, 0.85)';
            dCtx.lineWidth = 1.5;
            if (!reduceShadow) {
              dCtx.shadowColor = '#FF3D00';
              dCtx.shadowBlur = 11;
            }
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.stroke();
            const fireGrad = dCtx.createLinearGradient(0, -boxH / 2, textW, boxH / 2);
            fireGrad.addColorStop(0, '#FFF9C4');
            fireGrad.addColorStop(0.3, '#FF9800');
            fireGrad.addColorStop(1, '#FF3D00');
            dCtx.fillStyle = fireGrad;
            dCtx.fillText(name, 0, 0);
            break;
          }
          case 'electric_blue': {
            dCtx.fillStyle = 'rgba(5, 12, 35, 0.8)';
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.fill();
            dCtx.strokeStyle = '#2979FF';
            dCtx.lineWidth = 1.5;
            if (!reduceShadow) {
              dCtx.shadowColor = '#00B0FF';
              dCtx.shadowBlur = 12;
            }
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.stroke();
            const blueGrad = dCtx.createLinearGradient(0, 0, textW, 0);
            blueGrad.addColorStop(0, '#E1F5FE');
            blueGrad.addColorStop(0.5, '#40C4FF');
            blueGrad.addColorStop(1, '#2979FF');
            dCtx.fillStyle = blueGrad;
            dCtx.fillText(name, 0, 0);
            break;
          }
          case 'elegant_white': {
            dCtx.fillStyle = 'rgba(4, 24, 18, 0.8)';
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.fill();
            dCtx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
            dCtx.lineWidth = 1.5;
            if (!reduceShadow) {
              dCtx.shadowColor = '#10B981';
              dCtx.shadowBlur = 10;
            }
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.stroke();
            dCtx.fillStyle = '#ECFDF5';
            dCtx.fillText(name, 0, 0);
            break;
          }
          case 'shadow_edge': {
            dCtx.fillStyle = 'rgba(22, 6, 12, 0.85)';
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 6);
            dCtx.fill();
            dCtx.strokeStyle = 'rgba(255, 64, 129, 0.8)';
            dCtx.lineWidth = 1.5;
            if (!reduceShadow) {
              dCtx.shadowColor = '#FF4081';
              dCtx.shadowBlur = 8;
            }
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 6);
            dCtx.stroke();
            dCtx.shadowBlur = 0;
            dCtx.fillStyle = '#000000';
            dCtx.fillText(name, 2, 2);
            dCtx.fillStyle = '#FFE4E6';
            dCtx.fillText(name, 0, 0);
            break;
          }
          case 'orbit_motion':
          default: {
            dCtx.fillStyle = 'rgba(16, 12, 32, 0.8)';
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.fill();
            dCtx.strokeStyle = 'rgba(179, 136, 255, 0.8)';
            dCtx.lineWidth = 1.5;
            if (!reduceShadow) {
              dCtx.shadowColor = '#B388FF';
              dCtx.shadowBlur = 10;
            }
            this.drawRoundedRect(dCtx, -padX, -boxH / 2, boxW, boxH, 8);
            dCtx.stroke();
            const orbitGrad = dCtx.createLinearGradient(0, 0, textW, 0);
            orbitGrad.addColorStop(0, '#EDE7F6');
            orbitGrad.addColorStop(0.5, '#B388FF');
            orbitGrad.addColorStop(1, '#7C4DFF');
            dCtx.fillStyle = orbitGrad;
            dCtx.fillText(name, 0, 0);
            break;
          }
        }
        dCtx.restore();
        this.topLeftSprite = { key: cacheKey, canvas: sprite, padX, boxH, pad };
      }

      const { canvas: sprite, padX, boxH, pad } = this.topLeftSprite;
      ctx.save();
      if (styleId === 'elegant_white') {
        const zoom = 1 + 0.08 * Math.sin(time * 2.2);
        ctx.translate(posX, posY);
        ctx.scale(zoom, zoom);
      } else if (styleId === 'shadow_edge') {
        ctx.translate(posX, posY);
        ctx.rotate(Math.sin(time * 1.5) * 0.16);
      } else if (styleId === 'orbit_motion') {
        ctx.translate(posX + Math.cos(time * 0.9) * 5, posY + Math.sin(time * 1.4) * 6);
      } else {
        ctx.translate(posX, posY);
      }
      ctx.drawImage(sprite, -(pad + padX), -(pad + boxH / 2));
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.font = `bold ${baseFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(name);
    const textW = metrics.width;
    const textH = baseFontSize * 1.25;
    const padX = baseFontSize * 0.6;
    const padY = baseFontSize * 0.35;
    const boxW = textW + padX * 2;
    const boxH = textH + padY * 2;

    switch (styleId) {
      case 'cinematic_gold': {
        const shimmer = (Math.sin(time * 2.2) + 1) / 2;
        const pulse = 1 + 0.012 * Math.sin(time * 2.0);

        ctx.translate(posX, posY);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = 'rgba(15, 12, 5, 0.72)';
        this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 8);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 215, 0, ${0.4 + 0.3 * shimmer})`;
        ctx.lineWidth = 1.5;
        this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 8);
        ctx.stroke();

        const grad = ctx.createLinearGradient(0, -boxH / 2, textW, boxH / 2);
        grad.addColorStop(0, '#FFF3B0');
        grad.addColorStop(0.5, '#FFD700');
        grad.addColorStop(1, '#FFA000');

        if (!reduceShadow) {
          ctx.shadowColor = 'rgba(255, 215, 0, 0.7)';
          ctx.shadowBlur = 10 + 5 * shimmer;
        }
        ctx.fillStyle = grad;
        ctx.fillText(name, 0, 0);

        const sweepX = -padX + (boxW + padX * 2) * ((time * 0.3) % 1.5);
        const sweepGrad = ctx.createLinearGradient(sweepX - 25, 0, sweepX + 25, 0);
        sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        sweepGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
        sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sweepGrad;
        this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 8);
        ctx.fill();
        break;
      }

      case 'gradient_pulse': {
        const pulse = 1 + 0.018 * Math.sin(time * 2.8);
        ctx.translate(posX, posY);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = 'rgba(18, 8, 30, 0.78)';
        this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 8);
        ctx.fill();

        const offset = (Math.sin(time * 1.5) + 1) / 2;
        const grad = ctx.createLinearGradient(0, 0, textW, 0);
        grad.addColorStop(0, offset < 0.5 ? '#E040FB' : '#00E5FF');
        grad.addColorStop(0.5, '#FF4081');
        grad.addColorStop(1, offset < 0.5 ? '#00E5FF' : '#FFD700');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 8);
        ctx.stroke();

        if (!reduceShadow) {
          ctx.shadowColor = 'rgba(224, 64, 251, 0.7)';
          ctx.shadowBlur = 8;
        }
        ctx.fillStyle = grad;
        ctx.fillText(name, 0, 0);
        break;
      }

      case 'glass_shine':
      default: {
        ctx.translate(posX, posY);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 10);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 10);
        ctx.stroke();

        if (!reduceShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 6;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(name, 0, 0);

        const sweepProgress = (time * 0.4) % 2.0;
        if (sweepProgress < 1.0) {
          const sweepX = -padX + (boxW + padX * 2) * sweepProgress;
          const sweepGrad = ctx.createLinearGradient(sweepX - 20, 0, sweepX + 20, 0);
          sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          sweepGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
          sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = sweepGrad;
          this.drawRoundedRect(ctx, -padX, -boxH / 2, boxW, boxH, 10);
          ctx.fill();
        }
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Render Floating Animated Watermark roaming smoothly across the canvas
   */
  private static renderFloatingWatermark(
    ctx: CanvasRenderingContext2D,
    name: string,
    styleId: ChannelStyleId,
    opacity: number,
    time: number,
    w: number,
    h: number
  ): void {
    const cacheKey = `${name}|${styleId}|${w}|${h}`;
    if (!this.watermarkSprite || this.watermarkSprite.key !== cacheKey) {
      const sprite = this.watermarkSprite?.canvas || document.createElement('canvas');
      const sCtx = sprite.getContext('2d');
      if (!sCtx) return;

      const wmFontSize = Math.max(12, Math.min(22, Math.round(w * 0.014)));
      sCtx.font = `bold ${wmFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
      const textW = Math.ceil(sCtx.measureText(name).width);
      const textH = Math.ceil(wmFontSize * 1.2);
      const pad = 10;

      sprite.width = textW + pad * 2;
      sprite.height = textH + pad * 2;

      const dCtx = sprite.getContext('2d');
      if (!dCtx) return;

      let textColor = '#FFFFFF';
      if (styleId === 'cinematic_gold') textColor = '#FFE082';
      else if (styleId === 'neon_cyan') textColor = '#80DEEA';
      else if (styleId === 'fire_glow') textColor = '#FFCC80';
      else if (styleId === 'electric_blue') textColor = '#82B1FF';
      else if (styleId === 'gradient_pulse') textColor = '#F8BBD0';
      else if (styleId === 'royal_silver') textColor = '#ECEFF1';
      else if (styleId === 'shadow_edge') textColor = '#F1F5F9';
      else if (styleId === 'glass_shine') textColor = '#E2E8F0';
      else if (styleId === 'orbit_motion') textColor = '#D8B4FE';

      dCtx.save();
      dCtx.font = `bold ${wmFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
      dCtx.textBaseline = 'middle';
      dCtx.textAlign = 'center';
      dCtx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      dCtx.shadowBlur = 4;
      dCtx.shadowOffsetX = 1;
      dCtx.shadowOffsetY = 1;
      dCtx.fillStyle = textColor;
      dCtx.fillText(name, sprite.width / 2, sprite.height / 2);
      dCtx.restore();

      this.watermarkSprite = { key: cacheKey, canvas: sprite, textW, textH, pad };
    }

    const { canvas: sprite, textW, textH, pad } = this.watermarkSprite;
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    const marginX = w * 0.08;
    const marginY = h * 0.12;
    const travelRangeX = Math.max(20, w - marginX * 2 - textW);
    const travelRangeY = Math.max(20, h - marginY * 2 - textH);

    const normX = (Math.sin(time * 0.28 + 0.8) + 1) / 2;
    const normY = (Math.cos(time * 0.22 + 1.4) + 1) / 2;
    const posX = marginX + travelRangeX * normX;
    const posY = marginY + travelRangeY * normY;
    const tilt = Math.sin(time * 0.2) * 0.05;

    ctx.save();
    ctx.globalAlpha = clampedOpacity;
    ctx.translate(posX + textW / 2, posY + textH / 2);
    ctx.rotate(tilt);
    ctx.drawImage(sprite, -(textW / 2 + pad), -(textH / 2 + pad));
    ctx.restore();
  }

  /**
   * Returns the active CTA popup cycle index (0, 1, 2, ...) at `time`,
   * or `null` if CTA is disabled or currently hidden between intervals.
   */
  public static getActiveCtaCycle(
    settings: ChannelSettings | undefined,
    time: number
  ): number | null {
    if (!settings || settings.ctaEnabled === false) return null;
    const interval = Math.max(5, settings.ctaIntervalSeconds ?? 15);
    const duration = Math.max(2.5, Math.min(6, settings.ctaDurationSeconds ?? 4.0));

    // Don't show in the first 2 seconds of playback
    if (time < 2.0) return null;

    const phase = time % interval;
    if (phase >= duration) {
      return null; // currently in dormant phase between intervals
    }

    return Math.floor(time / interval);
  }

  /**
   * Render Subscribe & Like Call-To-Action (CTA) Animated Popup at bottom-center
   * Supports customizable interval (e.g. 10s, 15s, 20s), smooth slide up / down easing,
   * animated vibrating bell, like emoji, and rotating vibrant styles & colors!
   */
  private static renderCtaPopup(
    ctx: CanvasRenderingContext2D,
    settings: ChannelSettings,
    time: number,
    w: number,
    h: number
  ): void {
    const cycleIndex = this.getActiveCtaCycle(settings, time);
    if (cycleIndex === null) return;

    const interval = Math.max(5, settings.ctaIntervalSeconds ?? 15);
    const duration = Math.max(2.5, Math.min(6, settings.ctaDurationSeconds ?? 4.0));
    const phase = time % interval;
    const progress = phase / duration;

    const animWindow = 0.16;
    let opacity = 1.0;
    let yOffset = 0;
    let scale = 1.0;

    if (progress < animWindow) {
      const t = progress / animWindow;
      const ease = Math.sin((t * Math.PI) / 2);
      opacity = ease;
      yOffset = (1 - ease) * 36;
      scale = 0.9 + 0.1 * ease;
    } else if (progress > 1.0 - animWindow) {
      const t = (1.0 - progress) / animWindow;
      const ease = Math.sin((t * Math.PI) / 2);
      opacity = ease;
      yOffset = (1 - ease) * 36;
      scale = 0.9 + 0.1 * ease;
    } else {
      scale = 1.0 + 0.012 * Math.sin(time * 3.5);
    }

    const styleCount = 5;
    const presetMap: Record<string, number> = {
      youtube_red: 0,
      neon_cyan: 1,
      royal_sunset: 2,
      emerald_mint: 3,
      glass_aurora: 4
    };
    const presetStyle =
      settings.ctaStylePreset && settings.ctaStylePreset !== 'all_rotating'
        ? presetMap[settings.ctaStylePreset]
        : undefined;
    const currentStyle = presetStyle !== undefined ? presetStyle : cycleIndex % styleCount;
    const text =
      settings.ctaText?.trim() || 'দয়া করে চ্যানেলটি সাবস্ক্রাইব করুন এবং ভিডিওটিতে লাইক দিন 👍🔔';
    const reduceShadow = getRenderPerformanceFlags().reduceShadowBlur;
    const cacheKey = `${currentStyle}|${text}|${w}|${h}|${reduceShadow ? 1 : 0}`;

    if (!this.ctaSprite || this.ctaSprite.key !== cacheKey) {
      const sprite = this.ctaSprite?.canvas || document.createElement('canvas');
      const sCtx = sprite.getContext('2d');
      if (!sCtx) return;

      const baseFontSize = Math.max(13, Math.min(22, Math.round(w * 0.016)));
      const btnFontSize = Math.max(11, Math.min(17, Math.round(w * 0.013)));
      sCtx.font = `bold ${baseFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
      const textWidth = sCtx.measureText(text).width;

      const padX = baseFontSize * 1.3;
      const boxH = Math.round(baseFontSize * 2.4);
      const btnWidth = Math.round(btnFontSize * 7.6);
      const boxW = Math.round(textWidth + padX * 2 + btnWidth + 20);
      const pad = reduceShadow ? 6 : 22;

      sprite.width = boxW + pad * 2;
      sprite.height = boxH + pad * 2;

      const dCtx = sprite.getContext('2d');
      if (!dCtx) return;

      dCtx.save();
      dCtx.translate(sprite.width / 2, sprite.height / 2);

      const halfW = boxW / 2;
      const halfH = boxH / 2;

      let bgGradient: CanvasGradient;
      let borderColor = 'rgba(255, 255, 255, 0.5)';
      let glowColor = 'rgba(0, 0, 0, 0.4)';
      let btnBg = '#FFFFFF';
      let btnTextColor = '#DC2626';
      let btnText = '🔔 সাবস্ক্রাইব';

      switch (currentStyle) {
        case 0: {
          bgGradient = dCtx.createLinearGradient(-halfW, 0, halfW, 0);
          bgGradient.addColorStop(0, '#991B1B');
          bgGradient.addColorStop(0.5, '#DC2626');
          bgGradient.addColorStop(1, '#7F1D1D');
          borderColor = 'rgba(254, 240, 138, 0.95)';
          glowColor = 'rgba(220, 38, 38, 0.7)';
          btnBg = '#FEF08A';
          btnTextColor = '#991B1B';
          btnText = '🔔 সাবস্ক্রাইব';
          break;
        }
        case 1: {
          bgGradient = dCtx.createLinearGradient(-halfW, 0, halfW, 0);
          bgGradient.addColorStop(0, '#4C1D95');
          bgGradient.addColorStop(0.5, '#0891B2');
          bgGradient.addColorStop(1, '#0E7490');
          borderColor = '#22D3EE';
          glowColor = 'rgba(34, 211, 238, 0.7)';
          btnBg = '#22D3EE';
          btnTextColor = '#083344';
          btnText = '✨ LIKE & SUB';
          break;
        }
        case 2: {
          bgGradient = dCtx.createLinearGradient(-halfW, 0, halfW, 0);
          bgGradient.addColorStop(0, '#C2410C');
          bgGradient.addColorStop(0.5, '#EA580C');
          bgGradient.addColorStop(1, '#BE123C');
          borderColor = '#FDE047';
          glowColor = 'rgba(234, 88, 12, 0.65)';
          btnBg = '#FFFFFF';
          btnTextColor = '#C2410C';
          btnText = '👍 লাইক দিন';
          break;
        }
        case 3: {
          bgGradient = dCtx.createLinearGradient(-halfW, 0, halfW, 0);
          bgGradient.addColorStop(0, '#065F46');
          bgGradient.addColorStop(0.5, '#059669');
          bgGradient.addColorStop(1, '#064E3B');
          borderColor = '#6EE7B7';
          glowColor = 'rgba(16, 185, 129, 0.65)';
          btnBg = '#A7F3D0';
          btnTextColor = '#064E3B';
          btnText = '🔔 SUBSCRIBE';
          break;
        }
        default: {
          bgGradient = dCtx.createLinearGradient(-halfW, 0, halfW, 0);
          bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.94)');
          bgGradient.addColorStop(0.5, 'rgba(30, 41, 59, 0.94)');
          bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.94)');
          borderColor = 'rgba(244, 114, 182, 0.9)';
          glowColor = 'rgba(236, 72, 153, 0.55)';
          btnBg = '#F472B6';
          btnTextColor = '#831843';
          btnText = '💖 SUB & LIKE';
          break;
        }
      }

      if (!reduceShadow) {
        dCtx.shadowColor = glowColor;
        dCtx.shadowBlur = 16;
        dCtx.shadowOffsetX = 0;
        dCtx.shadowOffsetY = 4;
      }

      dCtx.fillStyle = bgGradient;
      this.drawRoundedRect(dCtx, -halfW, -halfH, boxW, boxH, boxH / 2);
      dCtx.fill();

      dCtx.shadowBlur = 0;
      dCtx.strokeStyle = borderColor;
      dCtx.lineWidth = 2.2;
      this.drawRoundedRect(dCtx, -halfW, -halfH, boxW, boxH, boxH / 2);
      dCtx.stroke();

      dCtx.fillStyle = '#FFFFFF';
      dCtx.textAlign = 'left';
      dCtx.textBaseline = 'middle';
      dCtx.font = `bold ${baseFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
      dCtx.fillText(text, -halfW + padX, 0);

      const btnX = halfW - padX - btnWidth;
      const btnY = -boxH * 0.35;
      const btnH = boxH * 0.7;

      dCtx.fillStyle = btnBg;
      this.drawRoundedRect(dCtx, btnX, btnY, btnWidth, btnH, btnH / 2);
      dCtx.fill();

      dCtx.fillStyle = btnTextColor;
      dCtx.textAlign = 'center';
      dCtx.textBaseline = 'middle';
      dCtx.font = `900 ${btnFontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, sans-serif`;
      dCtx.fillText(btnText, btnX + btnWidth / 2, 0);
      dCtx.restore();

      this.ctaSprite = { key: cacheKey, canvas: sprite, boxW, boxH, pad };
    }

    const { canvas: sprite } = this.ctaSprite;
    const posX = w / 2;
    const posY = h - Math.round(h * 0.09) + yOffset;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.translate(posX, posY);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
  }

  /**
   * Helper to draw clean rounded rectangles
   */
  private static drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
