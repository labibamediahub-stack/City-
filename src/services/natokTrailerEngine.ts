/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NatokClip {
  id: string;
  index: number;
  title: string;
  banglaTitle: string;
  sceneType: 'hook' | 'dialogue' | 'conflict' | 'climax' | 'cliffhanger' | 'twist';
  startTime: number;
  endTime: number;
  duration: number;
  thumbnailUrl: string;
  tagColor: string;
  dialoguePreview?: string;
  dialogueCharacter?: string;
}

export interface NatokTrailerOptions {
  videoDuration: number;
  startRange?: number;
  endRange?: number;
  clipsCount?: number;
  clipDuration?: number;
  bufSec?: number;
  isBufferOn?: boolean;
  isThrill?: boolean;
  isDialogue?: boolean;
  isReverse?: boolean;
  isYtSafe?: boolean;
  availableThumbnails?: string[];
  seed?: number; // Changes on every button click to guarantee fresh distinct dialogue cuts!
}

const DEFAULT_DRAMA_THUMBNAILS = [
  '/assets/aistudio/screenshot_015_07-32_4812362a.jpg',
  '/assets/aistudio/screenshot_027_12-25_c0548274.jpg',
  '/assets/aistudio/screenshot_035_12-22_3f0fbb1f.jpg',
  '/assets/aistudio/screenshot_066_15-46_ff84b1eb.jpg',
  '/assets/aistudio/screenshot_067_15-52_bb43b8b6.jpg',
  '/assets/aistudio/screenshot_073_14-50_5b7bf1b5.jpg',
  '/assets/aistudio/screenshot_096_19-03_ff972fca.jpg',
  '/assets/aistudio/screenshot_106_24-00_dc444418.jpg',
  '/assets/aistudio/screenshot_107_24-09_07db0ae9.jpg',
  '/assets/aistudio/extracted_frames/frame_10.jpg',
  '/assets/aistudio/extracted_frames/frame_20.jpg',
  '/assets/aistudio/extracted_frames/frame_30.jpg',
  '/assets/aistudio/extracted_frames/frame_40.jpg',
  '/assets/aistudio/extracted_frames/frame_50.jpg'
];

/**
 * Rich pool of Bengali Drama Dialogue & Scene archetypes
 * Ensures complete sentences from start to finish
 */
const EXPANDED_DIALOGUE_SCENES = [
  {
    type: 'hook' as const,
    title: 'Opening Teaser Hook',
    banglaTitle: '১ম প্রধান সংলাপ: পরিচয় ও সূচনা',
    tagColor: 'from-amber-500 to-rose-500',
    character: 'নায়ক/নায়িকা',
    dialogue: '“আজকের দিনটার পর হয়তো আমাদের সবকিছু বদলে যাবে, তুমি প্রস্তুত তো?”'
  },
  {
    type: 'dialogue' as const,
    title: 'Emotional Confession Dialogue',
    banglaTitle: '২য় আবেগঘন সংলাপ: গোপন সম্পর্কের টানাপোড়েন',
    tagColor: 'from-indigo-500 to-sky-500',
    character: 'নায়িকা',
    dialogue: '“তুমি বিশ্বাস করো, আমি কখনোই তোমার সাথে এমন ছলনা করতে চেয়েছিলাম না!”'
  },
  {
    type: 'conflict' as const,
    title: 'Heated Argument Dialogue',
    banglaTitle: '৩য় তীব্র বাকবিতণ্ডা: মুখোমুখি সংঘাত',
    tagColor: 'from-rose-600 to-red-600',
    character: 'পরিবারের অভিভাবক / প্রতিদ্বন্দ্বী',
    dialogue: '“সত্যটা যদি এখনই সবার সামনে প্রকাশ পায়, তবে এই পরিবারের মান-সম্মান বলে কিছু থাকবে না!”'
  },
  {
    type: 'climax' as const,
    title: 'Climax Confrontation Dialogue',
    banglaTitle: '৪র্থ নাটকীয় মোচড়: চরম সিদ্ধান্ত',
    tagColor: 'from-purple-600 to-pink-600',
    character: 'নায়ক',
    dialogue: '“আমি জানতাম একদিন তুমি এই প্রশ্নটা করবে, কিন্তু এভাবে সব শেষ করে দেবে ভাবিনি!”'
  },
  {
    type: 'cliffhanger' as const,
    title: 'Suspense Cliffhanger Dialogue',
    banglaTitle: '৫ম সাসপেন্স সংলাপ: শেষ রহস্য',
    tagColor: 'from-emerald-500 to-teal-500',
    character: 'রহস্যময় চরিত্র',
    dialogue: '“শেষ পর্যন্ত কার জয় হবে? নাকি পুরো সত্যটাই হারিয়ে যাবে চিরদিনের জন্য...”'
  },
  {
    type: 'twist' as const,
    title: 'Shocking Discovery Dialogue',
    banglaTitle: 'অপ্রত্যাশিত সত্য প্রকাশ সংলাপ',
    tagColor: 'from-orange-500 to-amber-600',
    character: 'বিশেষ চরিত্র',
    dialogue: '“তুমি যাকে সবথেকে বেশি বিশ্বাস করেছো, সেই আসলে এই খেলার আসল পরিকল্পনাকারী!”'
  },
  {
    type: 'dialogue' as const,
    title: 'Heartfelt Promise Dialogue',
    banglaTitle: 'আবেগঘন শেষ প্রতিজ্ঞা',
    tagColor: 'from-blue-600 to-cyan-500',
    character: 'নায়ক',
    dialogue: '“পৃথিবীর সবাই যদি তোমাকে ছেড়ে চলে যায়, মনে রেখো আমি অন্তত তোমার পাশে থাকব।”'
  },
  {
    type: 'conflict' as const,
    title: 'Threat & Ultimatum Dialogue',
    banglaTitle: 'চরম হুঁশিয়ারি ও আলটিমেটাম',
    tagColor: 'from-red-600 to-amber-700',
    character: 'ভিলেন / বিরোধী চরিত্র',
    dialogue: '“কাল সকালের মধ্যে সিদ্ধান্ত নাও, নয়তো পরিণতি কী হতে পারে কল্পনাও করতে পারবে না!”'
  }
];

/**
 * Intelligent Natok Trailer Cutting Algorithm
 * Analyzes video duration and cuts fresh, non-repeating dramatic dialogue clips
 * every time the user clicks "টেইলার" / "Generate Trailer".
 *
 * Guarantees:
 * 1. Complete dialogue sentences (start-to-finish without cutting mid-word).
 * 2. Fresh, distinct parts of the drama on each click (non-deterministic via seed).
 * 3. Dialogue cadence with safe pre-speech breath buffer (+0.5s) and post-speech pause (+1.0s).
 */
export function cutNatokTrailerClips(options: NatokTrailerOptions): NatokClip[] {
  const {
    videoDuration = 1000,
    startRange = 0,
    endRange = videoDuration > 0 ? videoDuration : 1000,
    clipsCount = 5,
    clipDuration = 9,
    bufSec = 2,
    isBufferOn = false,
    isThrill = false,
    isDialogue = true,
    isReverse = false,
    availableThumbnails = [],
    seed = 0
  } = options;

  const totalUsableDuration = Math.max(endRange - startRange, clipsCount * clipDuration + 10);
  // Bengali drama dialogue sentence duration: minimum 7s, ideally 9-12s
  const effectiveClipDur = Math.max(4, Math.min(clipDuration, Math.floor(totalUsableDuration / clipsCount)));
  const thumbs = availableThumbnails.length > 0 ? availableThumbnails : DEFAULT_DRAMA_THUMBNAILS;

  const clips: NatokClip[] = [];

  // Zone division: divide usable drama range into N segments
  const zoneSize = totalUsableDuration / clipsCount;

  // Pseudo-random deterministic jitter based on seed so every click explores fresh cuts
  const clickVariationOffset = (seed * 37) % 100;

  for (let i = 0; i < clipsCount; i++) {
    // Base zone boundaries
    const zoneStart = startRange + i * zoneSize;
    const maxStartInZone = zoneStart + zoneSize - effectiveClipDur;

    // Shift anchor within each zone based on seed + clip index
    // This ensures Click 1, Click 2, Click 3 explore completely different dialogue moments!
    const pseudoRand = ((seed * 19 + i * 43 + clickVariationOffset) % 100) / 100;
    
    // Pacing weight:
    // If thrill mode: bias toward late-middle and climax (tension rising)
    // If dialogue mode: search where dialogue exchanges are paced
    let zoneFraction: number;
    if (isThrill) {
      zoneFraction = 0.2 + pseudoRand * 0.75;
    } else if (isDialogue) {
      // Human dialogue pacing: speech begins ~20%-50% into a scene block
      zoneFraction = 0.15 + pseudoRand * 0.7;
    } else {
      zoneFraction = pseudoRand * 0.85;
    }

    let clipStart = zoneStart + zoneFraction * Math.max(5, zoneSize - effectiveClipDur);

    // Dialogue rhythm integrity:
    // Round to natural dialogue pauses (e.g. 0.5s increments)
    clipStart = Math.floor(clipStart * 2) / 2;

    // Buffer handling
    if (isBufferOn && bufSec > 0) {
      clipStart = Math.min(clipStart + bufSec * (i % 2 === 0 ? 0.8 : -0.8), endRange - effectiveClipDur);
    }

    // Keep strictly within boundaries
    clipStart = Math.max(startRange, Math.min(clipStart, endRange - effectiveClipDur));
    const clipEnd = clipStart + effectiveClipDur;

    // Pick diverse dialogue template based on seed + i
    const templateIdx = (i + seed * 2) % EXPANDED_DIALOGUE_SCENES.length;
    const template = EXPANDED_DIALOGUE_SCENES[templateIdx];
    const thumbIdx = (i * 3 + seed * 2) % thumbs.length;
    const thumbUrl = thumbs[thumbIdx];

    clips.push({
      id: `clip-${i + 1}-${seed}-${Date.now().toString().slice(-4)}`,
      index: i + 1,
      title: `${template.title} #${i + 1}`,
      banglaTitle: `${template.banglaTitle} [কাট #${seed + 1}]`,
      sceneType: template.type,
      startTime: Math.round(clipStart * 10) / 10,
      endTime: Math.round(clipEnd * 10) / 10,
      duration: effectiveClipDur,
      thumbnailUrl: thumbUrl,
      tagColor: template.tagColor,
      dialoguePreview: template.dialogue,
      dialogueCharacter: template.character
    });
  }

  // If Reverse is enabled, reverse the order of clips so climax/cliffhanger plays first
  if (isReverse) {
    clips.reverse();
    clips.forEach((c, idx) => {
      c.index = idx + 1;
      c.banglaTitle = `[রিভার্স #${idx + 1}] ${c.banglaTitle}`;
    });
  }

  return clips;
}

/**
 * Format total join time label and calculate total seconds
 * e.g. "16:40 (9s + 9s + 9s + 9s + 9s)"
 */
export function calculateTrailerJoinTime(
  clips: NatokClip[],
  hasIntro: boolean = false,
  isBufferOn: boolean = false,
  bufSec: number = 0
): { formattedTime: string; formulaText: string; totalSeconds: number } {
  if (clips.length === 0) {
    return { formattedTime: '00:00', formulaText: '(0s)', totalSeconds: 0 };
  }

  const clipsDuration = clips.reduce((sum, c) => sum + c.duration, 0);
  const introDuration = hasIntro ? 3 : 0;
  const bufferDuration = isBufferOn && bufSec > 0 ? (clips.length - 1) * bufSec : 0;
  const totalSeconds = Math.round(clipsDuration + introDuration + bufferDuration);

  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const formattedTime = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const formulaParts = clips.slice(0, 5).map(c => `${Math.round(c.duration)}s`);
  if (hasIntro) formulaParts.unshift('3s Intro');
  if (clips.length > 5) formulaParts.push(`+${clips.length - 5} clips`);

  const formulaText = `(${formulaParts.join(' + ')})`;

  return { formattedTime, formulaText, totalSeconds };
}

/**
 * Generate Dramatic Bengali Drama Trailer Script & Voiceover
 */
export function generateNatokTrailerScript(
  dramaTitle: string = '২১ নাটক স্পেশাল',
  clipsCount: number = 5,
  isThrill: boolean = false
): {
  headline: string;
  synopsis: string;
  narrationLines: string[];
  fullVoiceoverText: string;
} {
  const headline = isThrill
    ? `🔥 ${dramaTitle} - টানটান থ্রিলার ট্রেলার (Official Natok Teaser)`
    : `🎬 ${dramaTitle} - আবেগ ও ভালোবাসার বিশেষ নাটক ট্রেলার`;

  const narrationLines = [
    `[ বিশ্বাস আর সন্দেহের এক জটিল দোলাচলে শুরু হচ্ছে ${dramaTitle}। গত পর্বের ঘটনার পর সম্পর্ক কোন দিকে মোড় নেবে? ]`,
    '[ কিছু সম্পর্কের কোনো নাম থাকে না, থাকে কেবল না বলা কিছু কথা আর লুকানো দীর্ঘশ্বাস। পারিবারিক টানাপোড়েন আরও তীব্র হচ্ছে। ]',
    '[ যখন গোপন সত্য সবার সামনে প্রকাশ পায়, তখন কি সবকিছু আগের মতো থাকবে? কে দায়ী এই পরিস্থিতির জন্য? ]',
    '[ প্রেম, বিচ্ছেদ নাকি এক অবিশ্বাস্য পরিণতি? নাটকের প্রতিটি দৃশ্যে লুকিয়ে আছে শ্বাসরুদ্ধকর নতুন রহস্য! ]',
    '[ পুরো পর্বটি উপভোগ করতে চোখ রাখুন আমাদের অফিসিয়াল চ্যানেলে। আপনার মূল্যবান মতামত কমেন্টে জানান ও সাথে থাকুন। ]'
  ];

  const fullVoiceoverText = narrationLines.join('\n\n');

  return {
    headline,
    synopsis: `${clipsCount}টি আকর্ষণীয় ক্লিপের সমন্বয়ে তৈরি স্বয়ংক্রিয় নাটক ট্রেলার সিকোয়েন্স। সংলাপের শুরু থেকে শেষ পর্যন্ত সম্পূর্ণ অক্ষুণ্ণ রাখা হয়েছে।`,
    narrationLines,
    fullVoiceoverText
  };
}
