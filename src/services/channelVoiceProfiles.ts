/**
 * 10-Channel Independent Bangladeshi Bengali AI Voice Profiles & Safe Long-Script Chunker
 * Strictly maps CH 1 .. CH 10 to 5 Male + 5 Female distinct Gemini TTS voices
 * so every YouTube channel maintains an unmistakable, non-robotic human identity.
 */

export type ChannelVoiceGender = 'female' | 'male';

export interface ChannelVoiceProfile {
  channelSlot: number; // 1..10
  voiceId: string; // Prebuilt Gemini TTS voiceName
  gender: ChannelVoiceGender;
  displayNameBn: string;
  personaTitleBn: string;
  speakingStyleBn: string;
  speechStylePrompt: string;
  wpmBaseline: number; // Natural Bangladeshi Bengali narration words-per-minute at 1.0x
  preferredPace: string;
}

export interface LockedVoiceSessionSpec {
  sessionId: string;
  channelSlot: number;
  channelName: string;
  voiceId: string;
  gender: ChannelVoiceGender;
  speakerTone: string;
  speakerPitch: string;
  speechStylePrompt: string;
  model: string;
  strictModelLock: boolean;
  speed: number;
  seed: number;
  temperature: number;
}

export const TEN_CHANNEL_VOICE_PROFILES: ChannelVoiceProfile[] = [
  {
    channelSlot: 1,
    voiceId: 'Despina',
    gender: 'female',
    displayNameBn: 'ডেসপিনা (নম্র ও সিনেম্যাটিক)',
    personaTitleBn: 'আবেগী গল্প বিশ্লেষক (নারী কণ্ঠ ১)',
    speakingStyleBn: 'উষ্ণ, দরদি ও সিনেম্যাটিক বাংলাদেশি বাংলা উচ্চারণ',
    speechStylePrompt:
      'Natural warm Bangladeshi Bengali female narrator (bn-BD). Authentic Dhaka standard Bengali pronunciation, expressive emotional storytelling for drama reviews, gentle natural breath pauses at punctuation, human cadence, zero robotic monotone.',
    wpmBaseline: 106,
    preferredPace: 'Measured, warm and cinematic (1.0x)',
  },
  {
    channelSlot: 2,
    voiceId: 'Puck',
    gender: 'male',
    displayNameBn: 'পাক (রহস্য ও টানটান উপস্থাপনা)',
    personaTitleBn: 'থ্রিলার ও রহস্য বিশ্লেষক (পুরুষ কণ্ঠ ১)',
    speakingStyleBn: 'তীক্ষ্ণ, প্রাণবন্ত ও কৌতূহল-জাগানিয়া বাংলাদেশি বাংলা',
    speechStylePrompt:
      'Natural engaging Bangladeshi Bengali male narrator (bn-BD). Crisp Dhaka Bengali articulation, suspenseful drama commentary style, dynamic curiosity inflection on questions and plot twists, natural breathing, zero robotic tone.',
    wpmBaseline: 112,
    preferredPace: 'Crisp, suspenseful and engaging (1.0x)',
  },
  {
    channelSlot: 3,
    voiceId: 'Kore',
    gender: 'female',
    displayNameBn: 'কোরে (পারিবারিক ও সাবলীল)',
    personaTitleBn: 'সম্পর্ক ও নাটক পর্যালোচক (নারী কণ্ঠ ২)',
    speakingStyleBn: 'স্পষ্ট, প্রাণবন্ত ও ঘরোয়া বাংলাদেশি বাংলা বাচনভঙ্গি',
    speechStylePrompt:
      'Natural expressive Bangladeshi Bengali female storyteller (bn-BD). Pure Bengali phonetics, conversational yet authoritative family-drama review tone, subtle empathetic pauses around emotional dilemmas, realistic studio voice.',
    wpmBaseline: 108,
    preferredPace: 'Conversational, fluid and expressive (1.0x)',
  },
  {
    channelSlot: 4,
    voiceId: 'Charon',
    gender: 'male',
    displayNameBn: 'ক্যারন (গম্ভীর ও গভীর বিশ্লেষণ)',
    personaTitleBn: 'গম্ভীর কাহিনি কথক (পুরুষ কণ্ঠ ২)',
    speakingStyleBn: 'ভরাট, গম্ভীর ও আস্থাভাজন বাংলাদেশি বাংলা কণ্ঠ',
    speechStylePrompt:
      'Deep, resonant Bangladeshi Bengali male narrator (bn-BD). Calm, trustworthy documentary and serious drama analysis voice, rich chest resonance, deliberate pauses after heavy truths, pure standard Bengali pronunciation.',
    wpmBaseline: 102,
    preferredPace: 'Deep, grounded and deliberate (1.0x)',
  },
  {
    channelSlot: 5,
    voiceId: 'Leda',
    gender: 'female',
    displayNameBn: 'লেডা (মর্মস্পর্শী ও সংবেদনশীল)',
    personaTitleBn: 'হৃদয়ছোঁয়া গল্পকথক (নারী কণ্ঠ ৩)',
    speakingStyleBn: 'কোমল, আবেগঘন ও শ্রুতিমধুর বাংলাদেশি বাংলা',
    speechStylePrompt:
      'Soft, empathetic Bangladeshi Bengali female voice (bn-BD). Tender emotional storytelling for relationship conflict and family sacrifice dramas, gentle breathing pauses, sweet clear native pronunciation without artificial pitch.',
    wpmBaseline: 104,
    preferredPace: 'Gentle, emotional and heartfelt (1.0x)',
  },
  {
    channelSlot: 6,
    voiceId: 'Fenrir',
    gender: 'male',
    displayNameBn: 'ফেনরির (দৃঢ় ও নাটকীয়)',
    personaTitleBn: 'তীব্র দ্বন্দ্ব ও টুইস্ট বিশ্লেষক (পুরুষ কণ্ঠ ৩)',
    speakingStyleBn: 'বলিষ্ঠ, নাটকীয় ও আকর্ষণীয় বাংলাদেশি বাংলা',
    speechStylePrompt:
      'Bold, dramatic Bangladeshi Bengali male host (bn-BD). Strong narrative authority for intense confrontations and cliffhanger drama breakdowns, expressive rises and falls, natural air and pauses, completely human delivery.',
    wpmBaseline: 108,
    preferredPace: 'Dynamic, dramatic and impactful (1.0x)',
  },
  {
    channelSlot: 7,
    voiceId: 'Aoede',
    gender: 'female',
    displayNameBn: 'আওয়েদে (আধুনিক ও স্পষ্ট)',
    personaTitleBn: 'আধুনিক ড্রামা উপস্থাপক (নারী কণ্ঠ ৪)',
    speakingStyleBn: 'সাবলীল, প্রমিত ও পরিশীলিত বাংলাদেশি বাংলা',
    speechStylePrompt:
      'Polished, graceful Bangladeshi Bengali female presenter (bn-BD). Modern Dhaka broadcast standard Bengali, clear syllable articulation, balanced emotional warmth and analytical clarity, smooth sentence flow.',
    wpmBaseline: 109,
    preferredPace: 'Smooth, articulate and modern (1.0x)',
  },
  {
    channelSlot: 8,
    voiceId: 'Orus',
    gender: 'male',
    displayNameBn: 'ওরাস (শান্ত ও ভারসাম্যপূর্ণ)',
    personaTitleBn: 'নিরপেক্ষ গল্প বিশ্লেষক (পুরুষ কণ্ঠ ৪)',
    speakingStyleBn: 'শান্ত, পরিচ্ছন্ন ও চিন্তাশীল বাংলাদেশি বাংলা',
    speechStylePrompt:
      'Steady, thoughtful Bangladeshi Bengali male narrator (bn-BD). Balanced analytical storytelling for long-form drama episodes, relaxed studio mic warmth, natural cadence without rushing words.',
    wpmBaseline: 105,
    preferredPace: 'Calm, thoughtful and steady (1.0x)',
  },
  {
    channelSlot: 9,
    voiceId: 'Zephyr',
    gender: 'female',
    displayNameBn: 'জেফির (সতেজ ও ছন্দময়)',
    personaTitleBn: 'গতিশীল রিভিউ উপস্থাপক (নারী কণ্ঠ ৫)',
    speakingStyleBn: 'প্রাণচঞ্চল, ছন্দময় ও শ্রোতাবান্ধব বাংলাদেশি বাংলা',
    speechStylePrompt:
      'Fresh, lively Bangladeshi Bengali female narrator (bn-BD). Engaging rhythm that holds audience retention over long reviews, natural conversational pauses, crisp native Bengali consonants and vowels.',
    wpmBaseline: 111,
    preferredPace: 'Lively, rhythmic and engaging (1.0x)',
  },
  {
    channelSlot: 10,
    voiceId: 'Enceladus',
    gender: 'male',
    displayNameBn: 'এনসেলাডাস (আন্তরিক ও ঘরোয়া)',
    personaTitleBn: 'আন্তরিক গল্প বন্ধু (পুরুষ কণ্ঠ ৫)',
    speakingStyleBn: 'আন্তরিক, ঘরোয়া ও প্রাণখোলা বাংলাদেশি বাংলা',
    speechStylePrompt:
      'Warm, approachable Bangladeshi Bengali male storyteller (bn-BD). Friendly one-on-one storytelling feel as if talking directly to viewers, authentic native Bengali flow, natural breath pauses, zero synthetic sound.',
    wpmBaseline: 107,
    preferredPace: 'Warm, intimate and natural (1.0x)',
  },
];

export function getChannelVoiceProfile(slotNumber: number): ChannelVoiceProfile {
  const safeSlot = ((Math.max(1, Math.round(slotNumber)) - 1) % 10) + 1;
  return (
    TEN_CHANNEL_VOICE_PROFILES.find((p) => p.channelSlot === safeSlot) ||
    TEN_CHANNEL_VOICE_PROFILES[0]
  );
}

/**
 * Computes a deterministic 31-bit seed from channelSlot + voiceId + style
 * so the same speaker retains uniform pitch, timbre, accent, and delivery across every Part & Retry.
 */
function computeDeterministicVoiceSeed(channelSlot: number, voiceId: string): number {
  const key = `ch${channelSlot}:${voiceId.toLowerCase()}:bn-bd`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 900_000) + 100_000;
}

/**
 * Freeze voice identity parameters at the start of a generation job
 * so key rotation, multi-part splitting, or chunk retries NEVER change the speaker, gender, model, or tone.
 */
export function buildLockedVoiceSessionSpec(params: {
  channelSlot: number;
  channelName?: string;
  voiceIdOverride?: string;
  genderOverride?: ChannelVoiceGender;
  speakerTone?: string;
  speakerPitch?: string;
  model: string;
  speed: number;
  strictModelLock?: boolean;
}): LockedVoiceSessionSpec {
  const profile = getChannelVoiceProfile(params.channelSlot);
  const voiceId = (params.voiceIdOverride || profile.voiceId).trim();
  const gender = params.genderOverride || profile.gender;
  const normalizedModel = (params.model || 'gemini-2.5-flash-preview-tts').trim();
  const speakerTone = (params.speakerTone || 'Natural').trim();
  const speakerPitch = (params.speakerPitch || 'Balanced pitch').trim();
  const seed = computeDeterministicVoiceSeed(profile.channelSlot, voiceId);
  const temperature = 0.65;
  const sessionId = `vs_${profile.channelSlot}_${voiceId}_${Date.now().toString(36)}`;

  // Ensure style prompt aligns cleanly with the actually locked voiceId even when Voice Lock is unlocked
  const effectiveStylePrompt =
    voiceId === profile.voiceId
      ? profile.speechStylePrompt
      : `Natural expressive Bangladeshi Bengali ${gender} narrator (${voiceId}, ${speakerTone}, ${speakerPitch}, bn-BD). Maintain identical tone, pitch, cadence, accent, and studio delivery continuously across all sequential script parts.`;

  return Object.freeze({
    sessionId,
    channelSlot: profile.channelSlot,
    channelName: params.channelName?.trim() || `CH ${profile.channelSlot}`,
    voiceId,
    gender,
    speakerTone,
    speakerPitch,
    speechStylePrompt: effectiveStylePrompt,
    model: normalizedModel,
    strictModelLock: Boolean(params.strictModelLock),
    speed: params.speed,
    seed,
    temperature,
  });
}

/**
 * Freezes the resolved TTS model onto the existing LockedVoiceSessionSpec once Part 01 succeeds
 * so Part 02..Part NN and every Retry strictly use the exact same model, speaker, seed & config.
 */
export function lockSessionModel(
  spec: LockedVoiceSessionSpec,
  resolvedModel?: string
): LockedVoiceSessionSpec {
  const lockedModel = (resolvedModel || spec.model).trim() || spec.model;
  if (spec.strictModelLock && spec.model === lockedModel) {
    return spec;
  }
  return Object.freeze({
    ...spec,
    model: lockedModel,
    strictModelLock: true,
  });
}

export type PartGenerationStatus = 'Waiting' | 'Generating' | 'Completed' | 'Failed';

export interface SafeScriptChunk {
  index: number; // 1-based
  partLabel: string; // "Part 01", "Part 02", ...
  bracketIndex: number; // Original bracket paragraph index (for BGM interlude boundaries)
  isEndOfBracket: boolean; // True ONLY for the last sub-chunk of a [ ... ] bracket paragraph
  cleanText: string;
  charCount: number;
  wordCount: number;
}

export interface SmartScriptAnalysisResult {
  isSplitMode: boolean; // false when estimated speech < 6 minutes (< 360s), true when >= 6 minutes
  estimatedSpeechSeconds: number;
  estimatedTotalSeconds: number;
  totalChars: number;
  totalWords: number;
  bracketCount: number;
  parts: SafeScriptChunk[];
}

export interface ChunkSplitOptions {
  /** Pack adjacent plain-text (unbracketed) paragraphs up to maxCharsPerPart */
  packPlainParagraphs?: boolean;
  /** Merge all blocks up to maxCharsPerPart */
  mergeAllParagraphs?: boolean;
  /** Force character-capped splitting even under 6 minutes (default: false -> under 6m stays single-pass) */
  forceSplitUnderSixMinutes?: boolean;
  /** Hard maximum characters per split part (default: 800) */
  maxCharsPerPart?: number;
  /** Speech speed for <6m estimation */
  speechSpeed?: number;
  /** Channel slot for WPM baseline estimation */
  channelSlot?: number;
}

export const DEFAULT_LONG_TTS_MAX_CHARS = 5200;
export const DEFAULT_LONG_TTS_TARGET_CHARS = 4800;
export const SINGLE_PASS_MAX_SPEECH_SEC = 480; // ~8 minutes single-pass threshold

/**
 * Splits a single block of text into parts strictly <= maxChars (default 5200 ≈ ~7-8 min),
 * preferring sentence boundaries (। ? ! . ॥) first, then clause punctuation (, ; — – :),
 * then word boundaries — guaranteeing ZERO dropped characters and NO part > maxChars.
 */
function splitBlockByCharLimit(
  blockText: string,
  maxChars = DEFAULT_LONG_TTS_MAX_CHARS,
  targetChars = DEFAULT_LONG_TTS_TARGET_CHARS
): string[] {
  const normalized = blockText.replace(/[ \t]+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  // 1. Split cleanly into sentences at Bengali/English sentence delimiters
  const rawSentences = normalized
    .split(/(?<=[।॥?!\.])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Break any single overlong sentence (> maxChars) at clause punctuation or word boundaries
  const atomicUnits: string[] = [];
  for (const sentence of rawSentences) {
    if (sentence.length <= maxChars) {
      atomicUnits.push(sentence);
      continue;
    }

    const clauses = sentence
      .split(/(?<=[,;—–:\-])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      if (clause.length <= maxChars) {
        atomicUnits.push(clause);
        continue;
      }

      // Hard word-level wrap if a single clause without punctuation exceeds maxChars
      const words = clause.split(/\s+/).filter(Boolean);
      let wordBuf = '';
      for (const word of words) {
        if (word.length > maxChars) {
          if (wordBuf) {
            atomicUnits.push(wordBuf);
            wordBuf = '';
          }
          for (let pos = 0; pos < word.length; pos += maxChars) {
            atomicUnits.push(word.slice(pos, pos + maxChars));
          }
          continue;
        }
        const candidate = wordBuf ? `${wordBuf} ${word}` : word;
        if (candidate.length > maxChars) {
          if (wordBuf) atomicUnits.push(wordBuf);
          wordBuf = word;
        } else {
          wordBuf = candidate;
        }
      }
      if (wordBuf) atomicUnits.push(wordBuf);
    }
  }

  // 2. Pack atomic sentences/clauses into balanced ~4,300-5,200 char (~7-8 min) parts (never exceeding maxChars)
  const parts: string[] = [];
  let current = '';
  const sweetSpotMin = Math.floor(targetChars * 0.85);

  for (let i = 0; i < atomicUnits.length; i++) {
    const unit = atomicUnits[i];
    if (!current) {
      current = unit;
      continue;
    }

    const combined = `${current} ${unit}`;
    if (combined.length <= maxChars) {
      if (current.length >= sweetSpotMin && combined.length > targetChars) {
        parts.push(current);
        current = unit;
      } else {
        current = combined;
      }
    } else {
      parts.push(current);
      current = unit;
    }
  }
  if (current) parts.push(current);

  // Final safety pass: balance an ultra-tiny tail (<450 chars) with previous part if combined <= maxChars
  const tinyTailLimit = Math.min(450, Math.floor(maxChars * 0.15));
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const prev = parts[parts.length - 2];
    if (last.length < tinyTailLimit && prev.length + 1 + last.length <= maxChars) {
      parts[parts.length - 2] = `${prev} ${last}`;
      parts.pop();
    }
  }

  return parts;
}

/**
 * Extracts raw paragraph blocks:
 * - Each `[ ... ]` block separately if third brackets are present (for BGM interlude boundaries)
 * - Otherwise collects double-newline paragraphs so plain scripts can be packed into ~7-8 min chunks
 */
function extractScriptBlocks(rawScript: string): { blocks: string[]; hasExplicitBrackets: boolean } {
  const cleanBlock = (s: string) =>
    s
      .replace(/[*#_~]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const bracketBlocks: string[] = [];
  const regex = /\[([\s\S]*?)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawScript)) !== null) {
    const cleaned = cleanBlock(match[1]);
    if (cleaned) bracketBlocks.push(cleaned);
  }

  if (bracketBlocks.length > 0) {
    return { blocks: bracketBlocks, hasExplicitBrackets: true };
  }

  const plainParas = rawScript
    .split(/\n\s*\n/)
    .map((p) => cleanBlock(p.replace(/[\[\]]/g, '')))
    .filter(Boolean);

  return { blocks: plainParas, hasExplicitBrackets: false };
}

/**
 * Smart Long Audio Script Analyzer & Splitter:
 * - Under 8 minutes & <= maxCharsPerPart: Keeps script unsplit as 1 single pass (Part 01)
 * - >= 8 minutes or > maxCharsPerPart:
 *   - Explicit `[ ... ]` scripts preserve bracket breaks and split oversized blocks at sentence boundaries (~7-8 min / <=5,200 chars)
 *   - Plain unbracketed scripts pack adjacent paragraphs cleanly into ~7-8 min (~4,800-5,200 char) Parts to minimize API quota usage
 */
export function analyzeAndSplitLongScript(params: {
  rawScript: string;
  channelSlot?: number;
  speechSpeed?: number;
  interludeDuration?: number;
  audioMixMode?: 'clean_voice' | 'voice_with_bgm' | 'pure_voice';
  maxCharsPerPart?: number;
  forceSplit?: boolean;
}): SmartScriptAnalysisResult {
  const raw = params.rawScript || '';
  if (!raw.trim()) {
    return {
      isSplitMode: false,
      estimatedSpeechSeconds: 0,
      estimatedTotalSeconds: 0,
      totalChars: 0,
      totalWords: 0,
      bracketCount: 0,
      parts: [],
    };
  }

  const maxChars = Math.min(6000, Math.max(800, params.maxCharsPerPart || DEFAULT_LONG_TTS_MAX_CHARS));
  const targetChars = Math.min(maxChars - 200, Math.round(maxChars * 0.92));
  const { blocks, hasExplicitBrackets } = extractScriptBlocks(raw);
  const fullJoinedText = blocks.join('\n\n').trim();
  const totalWords = fullJoinedText ? fullJoinedText.split(/\s+/).filter(Boolean).length : 0;
  const totalChars = blocks.reduce((acc, b) => acc + b.length, 0);

  const profile = getChannelVoiceProfile(params.channelSlot || 1);
  const speed = Math.max(0.5, params.speechSpeed || 1.0);
  const effectiveWpm = profile.wpmBaseline * speed;
  const estimatedSpeechSeconds = totalWords > 0 ? (totalWords / effectiveWpm) * 60 : 0;
  const numInterludes = Math.max(0, blocks.length - 1);
  const perInterlude =
    params.audioMixMode === 'pure_voice' ? 0.45 : (params.interludeDuration ?? 5.0);
  const estimatedTotalSeconds =
    totalWords > 0 ? estimatedSpeechSeconds + numInterludes * perInterlude + 1.5 : 0;

  const preserveBracketBoundaries = hasExplicitBrackets && params.audioMixMode !== 'pure_voice';

  // Keep < 8 minutes (480s) AND <= maxChars as 1 single pass (except explicit multi-bracket scripts with active BGM breaks)
  const needsSplitByDuration = estimatedSpeechSeconds >= SINGLE_PASS_MAX_SPEECH_SEC || totalChars > maxChars;
  const shouldSplit = Boolean(params.forceSplit) || needsSplitByDuration;

  if (!shouldSplit && (!preserveBracketBoundaries || blocks.length <= 1)) {
    return {
      isSplitMode: false,
      estimatedSpeechSeconds,
      estimatedTotalSeconds,
      totalChars,
      totalWords,
      bracketCount: blocks.length,
      parts: fullJoinedText
        ? [
            {
              index: 1,
              partLabel: 'Part 01',
              bracketIndex: 1,
              isEndOfBracket: true,
              cleanText: fullJoinedText,
              charCount: fullJoinedText.length,
              wordCount: totalWords,
            },
          ]
        : [],
    };
  }

  const parts: SafeScriptChunk[] = [];
  let globalIdx = 1;

  if (preserveBracketBoundaries) {
    // Preserve explicit [ ... ] bracket boundaries (for BGM interludes), splitting large brackets at <= maxChars (~7-8 min)
    blocks.forEach((blockText, bIdx) => {
      const subParts = splitBlockByCharLimit(blockText, maxChars, targetChars);
      subParts.forEach((txt, sIdx) => {
        const partNum = String(globalIdx).padStart(2, '0');
        parts.push({
          index: globalIdx++,
          partLabel: `Part ${partNum}`,
          bracketIndex: bIdx + 1,
          isEndOfBracket: sIdx === subParts.length - 1,
          cleanText: txt,
          charCount: txt.length,
          wordCount: txt.split(/\s+/).filter(Boolean).length,
        });
      });
    });
  } else {
    // Plain text: pack adjacent paragraphs together up to maxChars (~7-8 min per Part) to save API quota!
    const packedTexts: string[] = [];
    let buffer = '';
    for (const para of blocks) {
      if (para.length > maxChars) {
        if (buffer) {
          packedTexts.push(buffer);
          buffer = '';
        }
        packedTexts.push(...splitBlockByCharLimit(para, maxChars, targetChars));
        continue;
      }
      const candidate = buffer ? `${buffer}\n\n${para}` : para;
      if (candidate.length <= maxChars) {
        buffer = candidate;
      } else {
        if (buffer) packedTexts.push(buffer);
        buffer = para;
      }
    }
    if (buffer) packedTexts.push(buffer);

    // Balance tiny trailing piece into previous part if it fits cleanly
    if (packedTexts.length >= 2) {
      const last = packedTexts[packedTexts.length - 1];
      const prev = packedTexts[packedTexts.length - 2];
      if (last.length < 450 && prev.length + 2 + last.length <= maxChars) {
        packedTexts[packedTexts.length - 2] = `${prev}\n\n${last}`;
        packedTexts.pop();
      }
    }

    packedTexts.forEach((txt, idx) => {
      const partNum = String(globalIdx).padStart(2, '0');
      parts.push({
        index: globalIdx++,
        partLabel: `Part ${partNum}`,
        bracketIndex: idx + 1,
        isEndOfBracket: idx === packedTexts.length - 1,
        cleanText: txt,
        charCount: txt.length,
        wordCount: txt.split(/\s+/).filter(Boolean).length,
      });
    });
  }

  return {
    isSplitMode: parts.length > 1,
    estimatedSpeechSeconds,
    estimatedTotalSeconds,
    totalChars,
    totalWords,
    bracketCount: blocks.length,
    parts,
  };
}

/**
 * Legacy-compatible wrapper around analyzeAndSplitLongScript.
 * Ensures every chunk obeys the ~8m single-pass rule and ~7-8 min (<=5200-char) cap when split.
 */
export function splitScriptIntoSafeChunks(
  rawScript: string,
  _legacyMaxWords = 300,
  options: ChunkSplitOptions = {}
): SafeScriptChunk[] {
  const analysis = analyzeAndSplitLongScript({
    rawScript,
    channelSlot: options.channelSlot,
    speechSpeed: options.speechSpeed,
    maxCharsPerPart: options.maxCharsPerPart || DEFAULT_LONG_TTS_MAX_CHARS,
    forceSplit: options.forceSplitUnderSixMinutes,
  });
  return analysis.parts;
}

/**
 * Estimates expected voice + interlude duration in seconds BEFORE generation.
 */
export function estimateScriptDurationSeconds(params: {
  scriptText: string;
  channelSlot: number;
  speechSpeed: number;
  interludeDuration: number;
  audioMixMode: 'clean_voice' | 'voice_with_bgm' | 'pure_voice';
}): {
  wordCount: number;
  charCount: number;
  bracketCount: number;
  partCount: number;
  isSplitMode: boolean;
  estimatedSpeechSeconds: number;
  estimatedInterludeSeconds: number;
  estimatedTotalSeconds: number;
} {
  const analysis = analyzeAndSplitLongScript({
    rawScript: params.scriptText,
    channelSlot: params.channelSlot,
    speechSpeed: params.speechSpeed,
    interludeDuration: params.interludeDuration,
    audioMixMode: params.audioMixMode,
    maxCharsPerPart: DEFAULT_LONG_TTS_MAX_CHARS,
  });

  const numInterludes = Math.max(0, analysis.bracketCount - 1);
  const perInterlude = params.audioMixMode === 'pure_voice' ? 0.45 : params.interludeDuration;
  const estimatedInterludeSeconds =
    analysis.totalWords > 0 ? numInterludes * perInterlude + 1.5 : 0;

  return {
    wordCount: analysis.totalWords,
    charCount: analysis.totalChars,
    bracketCount: analysis.bracketCount,
    partCount: analysis.parts.length,
    isSplitMode: analysis.isSplitMode,
    estimatedSpeechSeconds: analysis.estimatedSpeechSeconds,
    estimatedInterludeSeconds,
    estimatedTotalSeconds: analysis.estimatedSpeechSeconds + estimatedInterludeSeconds,
  };
}
