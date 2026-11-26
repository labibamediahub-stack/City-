/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TimedSubtitleCue {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Strips emotion/bracket stage directions like [আবেগী], {pause}, (slow) and splits
 * Bengali/English narration script into clean readable 1-2 line subtitle cues
 * proportionally timed across totalDurationSeconds.
 */
export function buildTimedSubtitlesFromScript(
  rawScript: string,
  totalDurationSeconds: number,
  startOffsetSeconds: number = 0
): TimedSubtitleCue[] {
  const safeOffset = Math.max(0, Math.min(totalDurationSeconds - 1, startOffsetSeconds));
  const activeWindowDur = totalDurationSeconds - safeOffset;
  if (!rawScript || !rawScript.trim() || activeWindowDur <= 1) {
    return [];
  }

  // Strip bracket delimiters [ ] (while keeping bracketed paragraph narration), {cues}, and markdown formatting
  const cleaned = rawScript
    .replace(/[\[\]]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[*_#`~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split by Bengali dari (।), ?, !, newline, or comma/semicolon for long clauses
  const rawSentences = cleaned
    .split(/(?<=[।?!.])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  // Break overly long sentences into readable ~45-62 char chunks so captions stay clean on 720p canvas
  const phrases: string[] = [];
  for (const sentence of rawSentences) {
    if (sentence.length <= 64) {
      phrases.push(sentence);
      continue;
    }
    const words = sentence.split(/\s+/);
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > 56 && current.length > 0) {
        phrases.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
    if (current.trim().length > 0) {
      phrases.push(current.trim());
    }
  }

  if (phrases.length === 0) return [];

  // Proportional character-weight timing across [safeOffset + margin .. totalDuration - margin]
  const introOffset = Math.min(0.8, activeWindowDur * 0.04);
  const outroMargin = Math.min(0.6, activeWindowDur * 0.03);
  const usableSpan = Math.max(1.0, activeWindowDur - introOffset - outroMargin);

  const weights = phrases.map((p) => Math.max(8, p.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const cues: TimedSubtitleCue[] = [];
  let cursor = safeOffset + introOffset;

  for (let i = 0; i < phrases.length; i++) {
    const slice = (weights[i] / totalWeight) * usableSpan;
    const startTime = Math.round(cursor * 100) / 100;
    const endTime = Math.round(Math.min(totalDurationSeconds - 0.2, cursor + slice) * 100) / 100;
    cues.push({
      index: i,
      text: phrases[i],
      startTime,
      endTime: Math.max(startTime + 0.4, endTime),
    });
    cursor += slice;
  }

  return cues;
}

export function getActiveSubtitleAtTime(
  cues: TimedSubtitleCue[],
  time: number
): TimedSubtitleCue | null {
  if (!cues || cues.length === 0) return null;
  for (let i = 0; i < cues.length; i++) {
    if (time >= cues[i].startTime && time <= cues[i].endTime) {
      return cues[i];
    }
  }
  return null;
}
