/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimelineSlot, TimelineConfig } from '../types/timeline';

export interface SafetyCheckIssue {
  id: string;
  severity: 'pass' | 'warning' | 'risk';
  titleBn: string;
  detailBn: string;
}

export interface PolicySafetyReport {
  overallLevel: 'safe' | 'caution' | 'high_risk';
  passedCount: number;
  totalChecks: number;
  issues: SafetyCheckIssue[];
}

const DECEPTIVE_PHRASES = [
  'ফুল নাটক',
  'full natok',
  'full drama',
  'অফিশিয়াল রিলিজ কনফার্ম',
  'আজ রাতেই রিলিজ ১০০%',
  'ফাঁস হয়ে গেল',
  'leaked',
  'সবাই দেখুন এখনই',
];

export function runPolicySafetyAudit(params: {
  slots: TimelineSlot[];
  config: TimelineConfig;
  galleryCount: number;
  audioDuration: number;
  dramaTitle: string;
  scriptText: string;
  seoTitle?: string;
  showLowerThird?: boolean;
  showSubtitles?: boolean;
  activeChannelSlot: number;
}): PolicySafetyReport {
  const issues: SafetyCheckIssue[] = [];
  const {
    slots,
    config,
    galleryCount,
    audioDuration,
    dramaTitle,
    scriptText,
    seoTitle,
    showLowerThird,
    showSubtitles,
    activeChannelSlot,
  } = params;

  // 1. Static Hold Check (YouTube flags static/low-effort slideshows if cuts are too slow)
  const photoSlots = slots.filter((s) => !s.isIntroVideo);
  const maxSlotDur = photoSlots.reduce((mx, s) => Math.max(mx, s.duration), 0);
  if (photoSlots.length === 0) {
    issues.push({
      id: 'timeline_empty',
      severity: 'risk',
      titleBn: 'টাইমলাইনে ছবি নেই',
      detailBn: 'ভিডিও তৈরি করতে অন্তত কিছু স্ক্রিনশট/ছবি টাইমলাইনে থাকতে হবে।',
    });
  } else if (maxSlotDur > 8.5) {
    issues.push({
      id: 'pacing_slow',
      severity: 'warning',
      titleBn: 'একই ছবি বেশি সময় স্থির থাকছে',
      detailBn: `সর্বোচ্চ স্লাইড সময় ${maxSlotDur.toFixed(1)}s। স্ট্যাটিক স্লাইডশো এড়াতে ৮ সেকেন্ডের নিচে রাখা নিরাপদ।`,
    });
  } else {
    issues.push({
      id: 'pacing_ok',
      severity: 'pass',
      titleBn: 'গতিশীল কাট পেসিং (Dynamic Cuts)',
      detailBn: `প্রতিটি স্লাইড ${maxSlotDur.toFixed(1)}s বা তার কম—স্লাইডশো হিসেবে ফ্ল্যাগ হওয়ার ঝুঁকি কম।`,
    });
  }

  // 2. Gallery Variety & Unique Visual Sequence
  const uniqueIds = new Set(photoSlots.map((s) => s.screenshotId)).size;
  if (galleryCount < 10) {
    issues.push({
      id: 'low_image_variety',
      severity: 'warning',
      titleBn: 'ছবির সংখ্যা কম',
      detailBn: `গ্যালারিতে মাত্র ${galleryCount}টি ছবি আছে। ১০ চ্যানেলে আলাদা কাটাকাটি পেতে কমপক্ষে ১৫–৩০টি ছবি ভালো।`,
    });
  } else {
    issues.push({
      id: 'variety_ok',
      severity: 'pass',
      titleBn: 'পর্যাপ্ত ভিজ্যুয়াল বৈচিত্র্য',
      detailBn: `${uniqueIds}টি ইউনিক ছবি ও চ্যানেল #${activeChannelSlot}-এর নিজস্ব সিকোয়েন্স সক্রিয়।`,
    });
  }

  // 3. Layout Architecture Uniqueness
  if (config.layoutMode && config.layoutMode !== 'full_cinema') {
    issues.push({
      id: 'layout_transformative',
      severity: 'pass',
      titleBn: 'ট্রান্সফরমেটিভ লেআউট কম্পোজিশন',
      detailBn: `CH ${activeChannelSlot}-এর জন্য "${config.layoutMode}" লেআউট সক্রিয়, যা সাধারণ স্লাইডশো থেকে আলাদা করে।`,
    });
  } else {
    issues.push({
      id: 'layout_standard',
      severity: 'warning',
      titleBn: 'স্ট্যান্ডার্ড ফুল-স্ক্রিন লেআউট',
      detailBn: '১০টি চ্যানেলে ভিন্নতা বাড়াতে স্প্লিট-স্ক্রিন, নিউজ-কার্ড বা এডিটোরিয়াল লেআউট ব্যবহার করা ভালো।',
    });
  }

  // 4. Audio Presence & Human Voiceover Check
  if (audioDuration <= 0) {
    issues.push({
      id: 'no_audio',
      severity: 'risk',
      titleBn: 'ভয়েসওভার বা অডিও সংযুক্ত নেই',
      detailBn: 'নিজস্ব ধারাভাষ্য ছাড়া শুধু ছবি আপলোড করলে YouTube Reused/Low-effort পলিসিতে বাতিল হতে পারে।',
    });
  } else {
    issues.push({
      id: 'audio_ok',
      severity: 'pass',
      titleBn: 'ভয়েসওভার ও অডিও হিউম্যানাইজেশন প্রস্তুত',
      detailBn: `${Math.round(audioDuration)} সেকেন্ডের অডিও যুক্ত আছে এবং এক্সপোর্টে রুম-টোন মাস্টারিং চলবে।`,
    });
  }

  // 5. Transformative Bangla Lower-Third / Subtitles
  if (showLowerThird || showSubtitles) {
    issues.push({
      id: 'overlay_ok',
      severity: 'pass',
      titleBn: 'তথ্যমূলক লোয়ার-থার্ড / বাংলা ক্যাপশন চালু',
      detailBn: 'ভিডিওতে দর্শকদের জন্য স্পষ্ট রিভিউ/রিলিজ তথ্য ও ক্যাপশন যুক্ত আছে।',
    });
  } else {
    issues.push({
      id: 'overlay_off',
      severity: 'warning',
      titleBn: 'তথ্যমূলক বাংলা ওভারলে বন্ধ আছে',
      detailBn: 'রিভিউ বা রিলিজ-বার ব্যাজ চালু রাখলে ভিডিওটি নিউজ/বিশ্লেষণধর্মী কনটেন্ট হিসেবে নিরাপদ থাকে।',
    });
  }

  // 6. Anti-Clickbait / Deceptive Claim Check
  const combinedText = `${dramaTitle} ${seoTitle || ''} ${scriptText.slice(0, 600)}`.toLowerCase();
  const matchedBad = DECEPTIVE_PHRASES.filter((phrase) => combinedText.includes(phrase.toLowerCase()));
  if (matchedBad.length > 0) {
    issues.push({
      id: 'clickbait_risk',
      severity: 'risk',
      titleBn: 'বিভ্রান্তিকর/ক্লিকবেইট শব্দের ঝুঁকি',
      detailBn: `শনাক্তকৃত শব্দ: "${matchedBad.join('", "')}" — এগুলো YouTube Spam/Misleading পলিসি ভঙ্গ করতে পারে।`,
    });
  } else {
    issues.push({
      id: 'text_clean',
      severity: 'pass',
      titleBn: 'টাইটেল ও স্ক্রিপ্ট পলিসি-নিরাপদ',
      detailBn: 'কোনো বিভ্রান্তিকর "Full Drama" বা ভুয়া রিলিজ দাবি শনাক্ত হয়নি।',
    });
  }

  const riskCount = issues.filter((i) => i.severity === 'risk').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const passedCount = issues.filter((i) => i.severity === 'pass').length;

  const overallLevel: PolicySafetyReport['overallLevel'] =
    riskCount > 0 ? 'high_risk' : warnCount > 1 ? 'caution' : 'safe';

  return {
    overallLevel,
    passedCount,
    totalChecks: issues.length,
    issues,
  };
}
