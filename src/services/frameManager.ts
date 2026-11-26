/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CustomFrameItem {
  id: string;
  name: string;
  type: 'video' | 'photo';
  dataUrl: string; // Transparent PNG or SVG data URL
  aspectRatio?: '16:9' | '4:3' | '1:1';
  borderThickness?: number;
  isCustom: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'user_custom_frames_v1';

export const BUILTIN_VIDEO_FRAMES: CustomFrameItem[] = [
  {
    id: 'vf_default',
    name: 'ডিফল্ট ভিডিও ফ্রেম',
    type: 'video',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'vf_cinematic_scope',
    name: 'সিনেমাটিক স্কোপ (2.35:1)',
    type: 'video',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'vf_filmstrip_perforated',
    name: 'ফিল্মস্ট্রিপ বর্ডার',
    type: 'video',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'vf_minimal_neon',
    name: 'মিনিমালিস্টিক সাইবার ফ্রেম',
    type: 'video',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'vf_gold_luxury',
    name: 'গোল্ড লাক্সারি ফ্রেম',
    type: 'video',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'vf_vintage_crt',
    name: 'ভিন্টেজ টিভি বর্ডার',
    type: 'video',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  }
];

export const BUILTIN_PHOTO_FRAMES: CustomFrameItem[] = [
  {
    id: 'pf_default',
    name: 'ডিফল্ট ফটো ফ্রেম',
    type: 'photo',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'pf_classic_modern',
    name: 'ক্লাসিক মডার্ন বর্ডার',
    type: 'photo',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'pf_royal_gold',
    name: 'রয়েল মেটালিক গোল্ড',
    type: 'photo',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'pf_polaroid',
    name: 'পোলারয়েড ভিন্টেজ',
    type: 'photo',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'pf_double_outline',
    name: 'ডাবল আউটলাইন রিং',
    type: 'photo',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  },
  {
    id: 'pf_frosted_glass',
    name: 'ফ্রস্টেড গ্লাসিমরফিজম',
    type: 'photo',
    dataUrl: '',
    isCustom: false,
    createdAt: 0
  }
];

/**
 * Load all custom uploaded frames from localStorage
 */
export function loadCustomFrames(): CustomFrameItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading custom frames:', e);
    return [];
  }
}

/**
 * Save custom frames
 */
export function saveCustomFrames(frames: CustomFrameItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(frames));
  } catch (e) {
    console.error('Error saving custom frames:', e);
  }
}

/**
 * Add a newly uploaded custom frame
 */
export function addCustomFrame(
  name: string,
  type: 'video' | 'photo',
  dataUrl: string
): CustomFrameItem {
  const existing = loadCustomFrames();
  const newFrame: CustomFrameItem = {
    id: `custom_frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || (type === 'video' ? 'আপলোডকৃত ভিডিও ফ্রেম' : 'আপলোডকৃত ফটো ফ্রেম'),
    type,
    dataUrl,
    isCustom: true,
    createdAt: Date.now()
  };

  const updated = [newFrame, ...existing];
  saveCustomFrames(updated);
  return newFrame;
}

/**
 * Delete a custom frame by ID
 */
export function deleteCustomFrame(id: string): void {
  const existing = loadCustomFrames();
  const updated = existing.filter((f) => f.id !== id);
  saveCustomFrames(updated);
}

/**
 * Edit custom frame name
 */
export function updateCustomFrameName(id: string, newName: string): void {
  const existing = loadCustomFrames();
  const updated = existing.map((f) => (f.id === id ? { ...f, name: newName.trim() } : f));
  saveCustomFrames(updated);
}
