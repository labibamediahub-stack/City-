/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SeriesItem, WeekdayKey } from '../types/timeline';

const STORAGE_KEY_SERIES_V1 = 'natok_series_schedule_v1';

export const WEEKDAYS_BN: Array<{ key: WeekdayKey; shortBn: string; fullBn: string }> = [
  { key: 'sat', shortBn: 'শনি', fullBn: 'শনিবার' },
  { key: 'sun', shortBn: 'রবি', fullBn: 'রবিবার' },
  { key: 'mon', shortBn: 'সোম', fullBn: 'সোমবার' },
  { key: 'tue', shortBn: 'মঙ্গল', fullBn: 'মঙ্গলবার' },
  { key: 'wed', shortBn: 'বুধ', fullBn: 'বুধবার' },
  { key: 'thu', shortBn: 'বৃহঃ', fullBn: 'বৃহস্পতিবার' },
  { key: 'fri', shortBn: 'শুক্র', fullBn: 'শুক্রবার' },
];

const BN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export const DEFAULT_EPISODE_NUMBER = 5;

export function parseEpisodeNumber(raw?: string | null): number {
  if (!raw) return DEFAULT_EPISODE_NUMBER;
  const ascii = raw.replace(/[০-৯]/g, (d) => BN_DIGITS[d] || d);
  const match = ascii.match(/\d+/);
  if (!match) return DEFAULT_EPISODE_NUMBER;
  const num = parseInt(match[0], 10);
  return isNaN(num) || num < 1 ? DEFAULT_EPISODE_NUMBER : num;
}

export function formatEpisodeLabel(num: number): string {
  const safe = Math.max(1, Math.round(isNaN(num) ? DEFAULT_EPISODE_NUMBER : num));
  return `পর্ব ${safe}`;
}

export const DEFAULT_ACTIVE_SERIES: SeriesItem[] = [
  {
    id: 'series_fire_ashar_golpo',
    title: 'ফিরে আসার গল্প',
    uploadDays: ['wed', 'thu'],
    releaseTimeLabel: 'বুধ ও বৃহঃ',
    currentEpisode: 'পর্ব 5',
    actorNames: '',
    defaultContentType: 'review',
    status: 'active',
    notes: 'প্রতি বুধবার ও বৃহস্পতিবার আপলোড হয়',
    createdAt: 1700000001000,
  },
  {
    id: 'series_dui_prithibir_raja',
    title: 'দুই পৃথিবীর রাজা',
    uploadDays: ['sat', 'tue'],
    releaseTimeLabel: 'শনি ও মঙ্গল',
    currentEpisode: 'পর্ব 5',
    actorNames: '',
    defaultContentType: 'review',
    status: 'active',
    notes: 'প্রতি শনিবার ও মঙ্গলবার আপলোড হয়',
    createdAt: 1700000002000,
  },
  {
    id: 'series_duniya_takar_golam',
    title: 'দুনিয়া টাকার গোলাম',
    uploadDays: ['sun'],
    releaseTimeLabel: 'প্রতি রবিবার',
    currentEpisode: 'পর্ব 5',
    actorNames: '',
    defaultContentType: 'release_update',
    status: 'active',
    notes: 'প্রতি রবিবার আপলোড হয়',
    createdAt: 1700000003000,
  },
  {
    id: 'series_chakor_jokhon_malik',
    title: 'চাকর যখন মালিক',
    uploadDays: ['tue'],
    releaseTimeLabel: 'প্রতি মঙ্গলবার',
    currentEpisode: 'পর্ব 5',
    actorNames: '',
    defaultContentType: 'review',
    status: 'active',
    notes: 'প্রতি মঙ্গলবার আপলোড হয়',
    createdAt: 1700000004000,
  },
];

export function getTodayWeekdayKey(): WeekdayKey {
  // Resolve day in Bangladesh Standard Time (Asia/Dhaka) safely
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      weekday: 'short',
    });
    const short = formatter.format(new Date()).toLowerCase().slice(0, 3);
    if (
      short === 'sat' ||
      short === 'sun' ||
      short === 'mon' ||
      short === 'tue' ||
      short === 'wed' ||
      short === 'thu' ||
      short === 'fri'
    ) {
      return short;
    }
  } catch (_) {}
  const map: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[new Date().getDay()];
}

export function formatUploadDaysBn(days: WeekdayKey[]): string {
  if (!days || days.length === 0) return 'শিডিউল নির্ধারিত নয়';
  const ordered = WEEKDAYS_BN.filter((d) => days.includes(d.key)).map((d) => d.shortBn);
  if (ordered.length === 1) return `প্রতি ${WEEKDAYS_BN.find((d) => d.key === days[0])?.fullBn || ordered[0]}`;
  return `প্রতি ${ordered.join(' ও ')}`;
}

const BN_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const BN_WEEKDAYS_BY_JS_DAY = [
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
  'শনিবার',
];

export function toBnDigits(input: string | number): string {
  const enToBn: Record<string, string> = {
    '0': '০',
    '1': '১',
    '2': '২',
    '3': '৩',
    '4': '৪',
    '5': '৫',
    '6': '৬',
    '7': '৭',
    '8': '৮',
    '9': '৯',
  };
  return String(input).replace(/[0-9]/g, (d) => enToBn[d] || d);
}

export function formatReleaseDateBn(isoDate?: string | null): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) return '';
  const [yStr, mStr, dStr] = isoDate.trim().split('-');
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);
  if (
    isNaN(year) ||
    isNaN(monthIdx) ||
    isNaN(day) ||
    monthIdx < 0 ||
    monthIdx > 11 ||
    day < 1 ||
    day > 31
  ) {
    return '';
  }
  const dateObj = new Date(year, monthIdx, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== monthIdx ||
    dateObj.getDate() !== day
  ) {
    return '';
  }
  const monthBn = BN_MONTHS[monthIdx];
  const weekdayBn = BN_WEEKDAYS_BY_JS_DAY[dateObj.getDay()];
  return `${toBnDigits(day)} ${monthBn}, রোজ ${weekdayBn}`;
}

export function formatBroadcastEpisodeLabelBn(raw?: string | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/পর্ব|episode|ep\b/i.test(trimmed)) return trimmed;
  if (/^[0-9০-৯]+$/.test(trimmed)) return `পর্ব ${trimmed}`;
  return trimmed;
}

export function formatBroadcastScheduleLabelBn(
  isoDate?: string | null,
  uploadDays?: WeekdayKey[]
): string {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) {
    const [yStr, mStr, dStr] = isoDate.trim().split('-');
    const year = parseInt(yStr, 10);
    const monthIdx = parseInt(mStr, 10) - 1;
    const day = parseInt(dStr, 10);
    if (
      !isNaN(year) &&
      !isNaN(monthIdx) &&
      !isNaN(day) &&
      monthIdx >= 0 &&
      monthIdx <= 11 &&
      day >= 1 &&
      day <= 31
    ) {
      const dateObj = new Date(year, monthIdx, day);
      if (
        dateObj.getFullYear() === year &&
        dateObj.getMonth() === monthIdx &&
        dateObj.getDate() === day
      ) {
        const monthBn = BN_MONTHS[monthIdx];
        const weekdayBn = BN_WEEKDAYS_BY_JS_DAY[dateObj.getDay()];
        return `পরবর্তী পর্ব: ${toBnDigits(day)} ${monthBn}, ${weekdayBn}`;
      }
    }
  }
  if (uploadDays && uploadDays.length > 0) {
    return `নতুন পর্ব: ${formatUploadDaysBn(uploadDays)}`;
  }
  return '';
}

export function loadSeriesList(): SeriesItem[] {
  if (typeof window === 'undefined') return DEFAULT_ACTIVE_SERIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SERIES_V1);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SERIES_V1, JSON.stringify(DEFAULT_ACTIVE_SERIES));
      return DEFAULT_ACTIVE_SERIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (_) {}
  return DEFAULT_ACTIVE_SERIES;
}

export function saveSeriesList(items: SeriesItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SERIES_V1, JSON.stringify(items));
  } catch (_) {}
}

export function getSeriesScheduledForDay(items: SeriesItem[], day: WeekdayKey): SeriesItem[] {
  return items.filter((item) => item.status === 'active' && item.uploadDays.includes(day));
}

const STORAGE_KEY_DISMISSED_TODAY_V1 = 'natok_schedule_dismissed_today_v1';

export function getTodayDateKeyDhaka(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const formatted = formatter.format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch (_) {}
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadDismissedTodayIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED_TODAY_V1);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const todayDate = getTodayDateKeyDhaka();
    if (parsed && parsed.date === todayDate && Array.isArray(parsed.ids)) {
      return parsed.ids.filter((id: unknown): id is string => typeof id === 'string');
    }
    localStorage.removeItem(STORAGE_KEY_DISMISSED_TODAY_V1);
  } catch (_) {}
  return [];
}

export function saveDismissedTodayIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const uniqueIds = Array.from(new Set(ids));
    localStorage.setItem(
      STORAGE_KEY_DISMISSED_TODAY_V1,
      JSON.stringify({
        date: getTodayDateKeyDhaka(),
        ids: uniqueIds,
      })
    );
  } catch (_) {}
}

