/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ExportResolutionId = '480p' | '540p' | '720p';
export type PerformanceModeId = 'auto' | 'mobile_fast' | 'high_quality';

export interface ExportResolutionPreset {
  id: ExportResolutionId;
  width: number;
  height: number;
  label: string;
  shortLabel: string;
  defaultBitrate: number;
}

export const EXPORT_RESOLUTION_PRESETS: Record<ExportResolutionId, ExportResolutionPreset> = {
  '480p': {
    id: '480p',
    width: 854,
    height: 480,
    label: '480p (Fast Mobile)',
    shortLabel: '480p',
    defaultBitrate: 2000000,
  },
  '540p': {
    id: '540p',
    width: 960,
    height: 540,
    label: '540p (Mobile HD)',
    shortLabel: '540p',
    defaultBitrate: 2600000,
  },
  '720p': {
    id: '720p',
    width: 1280,
    height: 720,
    label: '720p (Full HD)',
    shortLabel: '720p',
    defaultBitrate: 4200000,
  },
};

export interface DeviceCapabilities {
  isMobile: boolean;
  isLowEnd: boolean;
  cpuCores: number;
  ramGb: number;
}

export interface RenderPerformanceFlags {
  mode: PerformanceModeId;
  isMobile: boolean;
  isLowEnd: boolean;
  isMobileFast: boolean;
  reduceShadowBlur: boolean;
  maxShadowBlur: number;
  particleScale: number;
  previewWidth: number;
  previewHeight: number;
  playbackFps: number;
  uiSyncIntervalMs: number;
  screenshotWidth: number;
  screenshotHeight: number;
  screenshotJpegQuality: number;
  screenshotSeekTimeoutMs: number;
  screenshotMaxCandidates: number;
  preferredAudioSampleRate: number;
  exportYieldBudgetMs: number;
  exportMirrorIntervalFrames: number;
}

const PERF_MODE_STORAGE_KEY = 'cinecraft_perf_mode_v1';
const EXPORT_RES_STORAGE_KEY = 'cinecraft_export_resolution_v1';

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isMobile: false, isLowEnd: false, cpuCores: 8, ramGb: 8 };
  }

  const ua = navigator.userAgent || '';
  const touchCapable =
    typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0;
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const narrowScreen = window.innerWidth > 0 && window.innerWidth <= 920;
  const isMobile = mobileUa || (touchCapable && narrowScreen);

  const cpuCores =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : isMobile
      ? 4
      : 8;

  const rawMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const ramGb =
    typeof rawMem === 'number' && rawMem > 0 ? rawMem : isMobile ? 4 : 8;

  const isLowEnd = isMobile || cpuCores <= 4 || ramGb <= 4;

  return {
    isMobile,
    isLowEnd,
    cpuCores,
    ramGb,
  };
}

export function getSavedPerformanceMode(): PerformanceModeId {
  if (typeof window === 'undefined') return 'auto';
  try {
    const val = window.localStorage.getItem(PERF_MODE_STORAGE_KEY);
    if (val === 'mobile_fast' || val === 'high_quality' || val === 'auto') {
      return val;
    }
  } catch (_) {}
  return 'auto';
}

export function savePerformanceMode(mode: PerformanceModeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERF_MODE_STORAGE_KEY, mode);
  } catch (_) {}
  refreshRenderPerformanceFlags(mode);
}

export function getSavedExportResolution(): ExportResolutionId {
  const caps = detectDeviceCapabilities();
  const fallback: ExportResolutionId = caps.isMobile ? '540p' : '720p';
  if (typeof window === 'undefined') return fallback;
  try {
    const val = window.localStorage.getItem(EXPORT_RES_STORAGE_KEY);
    if (val === '480p' || val === '540p' || val === '720p') {
      return val;
    }
  } catch (_) {}
  return fallback;
}

export function saveExportResolution(res: ExportResolutionId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPORT_RES_STORAGE_KEY, res);
  } catch (_) {}
}

export function getDefaultExportFpsForDevice(): 20 | 24 | 30 {
  const flags = getRenderPerformanceFlags();
  return flags.isMobileFast ? 20 : 24;
}

let cachedFlags: RenderPerformanceFlags | null = null;

function computeFlags(overrideMode?: PerformanceModeId): RenderPerformanceFlags {
  const caps = detectDeviceCapabilities();
  const mode = overrideMode ?? getSavedPerformanceMode();
  const isMobileFast =
    mode === 'mobile_fast' || (mode === 'auto' && (caps.isMobile || caps.isLowEnd));

  return {
    mode,
    isMobile: caps.isMobile,
    isLowEnd: caps.isLowEnd,
    isMobileFast,
    reduceShadowBlur: isMobileFast,
    maxShadowBlur: isMobileFast ? 6 : 45,
    particleScale: isMobileFast ? 0.55 : 1,
    previewWidth: isMobileFast ? 640 : 960,
    previewHeight: isMobileFast ? 360 : 540,
    playbackFps: isMobileFast ? 22 : 30,
    uiSyncIntervalMs: isMobileFast ? 220 : 120,
    screenshotWidth: isMobileFast ? 960 : 1280,
    screenshotHeight: isMobileFast ? 540 : 720,
    screenshotJpegQuality: isMobileFast ? 0.82 : 0.9,
    screenshotSeekTimeoutMs: isMobileFast ? 900 : 1450,
    screenshotMaxCandidates: isMobileFast ? 5 : 11,
    preferredAudioSampleRate: isMobileFast ? 24000 : 48000,
    exportYieldBudgetMs: isMobileFast ? 18 : 28,
    exportMirrorIntervalFrames: isMobileFast ? 15 : 8,
  };
}

export function refreshRenderPerformanceFlags(overrideMode?: PerformanceModeId): RenderPerformanceFlags {
  cachedFlags = computeFlags(overrideMode);
  return cachedFlags;
}

export function getRenderPerformanceFlags(): RenderPerformanceFlags {
  if (!cachedFlags) {
    cachedFlags = computeFlags();
  }
  return cachedFlags;
}
