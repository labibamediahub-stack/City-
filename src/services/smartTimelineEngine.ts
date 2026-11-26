import {
  TimelineSlot,
  TimelineConfig,
  TimelineSummary,
  TransitionType
} from '../types/timeline';
import {
  ANIMATION_LIBRARY,
  getRandomAnimation,
  getRandomUploadedVideoAnimation,
  getRandomAnimistaAnimation,
  getRandomTransition,
  getRandomFrameConfig,
  getCohesiveFrameConfig
} from './animationLibrary';

export interface GalleryItemInput {
  id: string;
  dataUrl: string;
  index: number;
  timestamp?: number;
  formattedTime?: string;
  width?: number;
  height?: number;
  qualityStatus?: string;
  sceneSignature?: number[];
}

export const DURATION_PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
  { label: '20m', seconds: 1200 },
  { label: '30m', seconds: 1800 }
];

/**
 * Generate randomized duration with weighted distribution centered around midpoint
 */
const generateWeightedDuration = (min: number, max: number): number => {
  // Use sum of two random numbers for a bell-like / triangular distribution centered in [min, max]
  const r1 = Math.random();
  const r2 = Math.random();
  const triangular = (r1 + r2) / 2;
  const raw = min + triangular * (max - min);
  // Round to 1 decimal place (e.g. 5.8, 6.2, 5.4)
  return Math.round(raw * 10) / 10;
};

/**
 * Smart Timeline Generation Engine
 */
export class SmartTimelineEngine {
  /**
   * Calculates the optimal number of slots and their exact durations
   * such that sum(duration_i) - sum(transitions) == targetDurationSeconds
   */
  public static calculateTimelineSlots(
    gallery: GalleryItemInput[],
    config: TimelineConfig
  ): { slots: TimelineSlot[]; summary: TimelineSummary } {
    if (!gallery || gallery.length === 0) {
      return {
        slots: [],
        summary: {
          requestedDuration: config.targetDurationSeconds,
          actualDuration: 0,
          availableGalleryImages: 0,
          uniqueImagesUsed: 0,
          totalSlots: 0,
          repeatedSlots: 0,
          averageImageDuration: 0,
          transitionCount: 0,
          estimatedRenderSeconds: 0
        }
      };
    }

    const targetSec = Math.max(1, config.targetDurationSeconds);
    const minDur = Math.max(3.0, config.minImageDuration);
    const maxDur = Math.max(minDur + 0.5, config.maxImageDuration);
    const avgDur = (minDur + maxDur) / 2;
    const transDur = Math.max(0.2, config.defaultTransitionDuration);

    // Timeline model:
    // Slot 0 starts at 0, ends at D_0.
    // Slot 1 starts at D_0 - transDur, ends at D_0 - transDur + D_1.
    // Total duration for N slots = sum(D_i) - (N - 1) * transDur.
    // If N = 1, Total = D_0.
    // For N >= 2: Total = N * D_avg - (N - 1) * transDur = N * (D_avg - transDur) + transDur.
    // Therefore: N ≈ (Target - transDur) / (D_avg - transDur).
    const effectiveStep = Math.max(1.0, avgDur - transDur);
    let estimatedSlots = Math.round((targetSec - transDur) / effectiveStep);
    if (estimatedSlots < 1) estimatedSlots = 1;

    // Check bounds: With N slots, min possible total is N * minDur - (N - 1) * transDur
    // max possible total is N * maxDur - (N - 1) * transDur
    const minPossible = (n: number) => n * minDur - Math.max(0, n - 1) * transDur;
    const maxPossible = (n: number) => n * maxDur - Math.max(0, n - 1) * transDur;

    // Adjust N if outside boundary
    while (estimatedSlots > 1 && minPossible(estimatedSlots) > targetSec) {
      estimatedSlots--;
    }
    while (maxPossible(estimatedSlots) < targetSec) {
      estimatedSlots++;
    }

    const slotCount = Math.max(1, estimatedSlots);

    // Generate initial randomized durations for each slot
    const rawDurations: number[] = [];
    for (let i = 0; i < slotCount; i++) {
      rawDurations.push(generateWeightedDuration(minDur, maxDur));
    }

    // Solve exact duration matching
    // We want: sum(D_i) = targetSec + (slotCount - 1) * transDur
    const targetSum = targetSec + Math.max(0, slotCount - 1) * transDur;
    let currentSum = rawDurations.reduce((a, b) => a + b, 0);
    let diff = targetSum - currentSum;

    // Distribute diff smoothly across slots without violating [minDur, maxDur]
    let iterations = 0;
    while (Math.abs(diff) > 0.05 && iterations < 50) {
      iterations++;
      const step = diff / slotCount;
      for (let i = 0; i < slotCount; i++) {
        const adjusted = Math.min(maxDur, Math.max(minDur, rawDurations[i] + step));
        rawDurations[i] = Math.round(adjusted * 100) / 100;
      }
      currentSum = rawDurations.reduce((a, b) => a + b, 0);
      diff = targetSum - currentSum;
    }

    // Last fine tweak on middle/last slots if tiny difference remains
    if (Math.abs(diff) > 0.001) {
      for (let i = slotCount - 1; i >= 0 && Math.abs(diff) > 0.001; i--) {
        const canAdd = Math.min(diff, maxDur - rawDurations[i]);
        const canSub = Math.max(diff, minDur - rawDurations[i]);
        const apply = diff > 0 ? canAdd : canSub;
        rawDurations[i] += apply;
        diff -= apply;
      }
    }

    // Select images from gallery according to mode, channelSlotNumber, & repetition rules
    const channelSeededGallery =
      config.channelSlotNumber && gallery.length > 3
        ? this.buildChannelUniqueGalleryOrder(
            gallery,
            config.channelSlotNumber,
            config.antiSpamVariationSeed || 0
          )
        : gallery;
    const selectedImages = this.selectGalleryImagesForSlots(
      channelSeededGallery,
      slotCount,
      config.channelSlotNumber ? 'original' : config.selectionMode
    );

    // Build timeline slots with animations, transitions, and timing
    const slots: TimelineSlot[] = [];
    let currentTime = 0;
    const usageTracker: Record<string, number> = {};
    let lastAnimId = '';
    let lastTransitionType: TransitionType = 'crossfade';

    for (let i = 0; i < slotCount; i++) {
      const imgItem = selectedImages[i];
      const duration = Math.round(rawDurations[i] * 100) / 100;
      const startTime = Math.round(currentTime * 1000) / 1000;
      const endTime = Math.round((startTime + duration) * 1000) / 1000;

      usageTracker[imgItem.id] = (usageTracker[imgItem.id] || 0) + 1;
      const usageCount = usageTracker[imgItem.id];

      // Assign non-repeating animation based on selected style set
      let anim;
      if (config.effectCategoryPreference === 'animista') {
        anim = getRandomAnimistaAnimation(lastAnimId);
      } else if (config.effectCategoryPreference === 'all') {
        anim = getRandomAnimation(lastAnimId);
      } else {
        anim = getRandomUploadedVideoAnimation(lastAnimId);
      }
      lastAnimId = anim.id;

      // Assign transition (last slot has no subsequent transition)
      let transType: TransitionType = config.defaultTransition;
      if (config.randomizeTransitions || config.defaultTransition === 'random') {
        transType = getRandomTransition(lastTransitionType);
        lastTransitionType = transType;
      }

      const frameConfig = getRandomFrameConfig(i, config.frameThemeId || 'all_dynamic');

      slots.push({
        slotId: `slot_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        screenshotId: imgItem.id,
        dataUrl: imgItem.dataUrl,
        originalIndex: imgItem.index,
        originalTimestamp: imgItem.timestamp,
        formattedOriginalTime: imgItem.formattedTime,
        usageCount,
        startTime,
        duration,
        endTime,
        animationId: anim.id,
        transitionType: i === slotCount - 1 ? 'crossfade' : transType,
        transitionDuration: transDur,
        aspectRatio: (imgItem.width && imgItem.height) ? imgItem.width / imgItem.height : 16 / 9,
        frameStyle: frameConfig.frameStyle,
        frameColor: frameConfig.frameColor,
        frameAccentColor: frameConfig.frameAccentColor
      });

      // Next slot starts after (duration - transDur)
      if (i < slotCount - 1) {
        currentTime = Math.max(0, endTime - transDur);
      } else {
        currentTime = endTime;
      }
    }

    const actualDuration = Math.round(currentTime * 100) / 100;
    const uniqueImagesCount = Object.keys(usageTracker).length;
    const repeatedCount = slotCount - uniqueImagesCount;
    const avgImageDur = Math.round((rawDurations.reduce((a, b) => a + b, 0) / slotCount) * 10) / 10;
    // Estimated rendering workload: approx 1 sec render per 1.5s video at 30fps
    const estimatedRenderSeconds = Math.round(actualDuration * 0.7);

    const summary: TimelineSummary = {
      requestedDuration: targetSec,
      actualDuration,
      availableGalleryImages: gallery.length,
      uniqueImagesUsed: uniqueImagesCount,
      totalSlots: slotCount,
      repeatedSlots: Math.max(0, repeatedCount),
      averageImageDuration: avgImageDur,
      transitionCount: Math.max(0, slotCount - 1),
      estimatedRenderSeconds
    };

    return { slots, summary };
  }

  /**
   * Builds a channel-unique visual cut sequence ("আলাদা ভিডিও কাটাকাটি") from the same gallery:
   * - Picks a unique opening Hook image per channel (CH 1..10 never start with the same image)
   * - Drops 10-20% of images in a channel-specific pattern when >= 15 images exist so subsets differ
   * - Applies a distinct ordering strategy (climax-first, reverse-wave, interleaved, center-outward, etc.)
   *   while keeping consecutive scenes visually distinct.
   */
  public static buildChannelUniqueGalleryOrder<T extends GalleryItemInput>(
    gallery: T[],
    channelSlotNumber: number,
    variationSeed = 0
  ): T[] {
    if (!gallery || gallery.length <= 2) return [...gallery];

    const slot = Math.max(1, Math.min(10, Math.round(channelSlotNumber || 1)));
    // Sort chronologically first so every channel computes from a deterministic baseline
    const sorted = [...gallery].sort((a, b) => (a.timestamp ?? a.index) - (b.timestamp ?? b.index));
    const n = sorted.length;

    // Seeded PRNG (Mulberry32)
    let seed = (slot * 2654435761 + (variationSeed + 1) * 1597334677) >>> 0;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // 1. Subsetting when gallery is large enough (>= 14 images) so 10 channels don't share identical photo sets
    let workingPool = [...sorted];
    if (n >= 14) {
      const keepCount = Math.max(12, Math.round(n * (0.78 + (slot % 4) * 0.04)));
      const dropPhase = (slot * 3 + variationSeed) % 5;
      const subset: T[] = [];
      for (let i = 0; i < n; i++) {
        // Skip different indices per channel
        if ((i + dropPhase) % 6 === 0 && workingPool.length - (i - subset.length) > keepCount) {
          continue;
        }
        subset.push(sorted[i]);
      }
      workingPool = subset.slice(0, Math.max(12, subset.length));
    }

    const m = workingPool.length;
    let reordered: T[] = [];

    // 2. Apply distinct channel-specific ordering architecture
    switch (slot) {
      case 1: {
        // Hook from ~25% climax preview, then forward arc
        const pivot = Math.floor(m * 0.25);
        reordered = [...workingPool.slice(pivot), ...workingPool.slice(0, pivot)];
        break;
      }
      case 2: {
        // Reverse wave: ending climax first -> alternate back & forth
        const rev = [...workingPool].reverse();
        for (let i = 0; i < Math.ceil(rev.length / 2); i++) {
          reordered.push(rev[i]);
          if (rev.length - 1 - i > i) reordered.push(rev[rev.length - 1 - i]);
        }
        break;
      }
      case 3: {
        // Interleaved pairs: evens forward, odds reverse
        const evens = workingPool.filter((_, idx) => idx % 2 === 0);
        const odds = workingPool.filter((_, idx) => idx % 2 === 1).reverse();
        reordered = [...evens, ...odds];
        break;
      }
      case 4: {
        // Quarter-rotated chunks (Q3 -> Q1 -> Q4 -> Q2)
        const q = Math.max(1, Math.floor(m / 4));
        const q1 = workingPool.slice(0, q);
        const q2 = workingPool.slice(q, q * 2);
        const q3 = workingPool.slice(q * 2, q * 3);
        const q4 = workingPool.slice(q * 3);
        reordered = [...q3, ...q1, ...q4, ...q2];
        break;
      }
      case 5: {
        // Center-outward spiral
        const mid = Math.floor(m / 2);
        reordered.push(workingPool[mid]);
        for (let offset = 1; offset <= mid; offset++) {
          if (mid + offset < m) reordered.push(workingPool[mid + offset]);
          if (mid - offset >= 0) reordered.push(workingPool[mid - offset]);
        }
        break;
      }
      case 6: {
        // Seeded Fisher-Yates shuffle + anti-same-scene pass
        reordered = [...workingPool];
        for (let i = reordered.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
        }
        break;
      }
      case 7: {
        // Golden stride stepping through gallery
        const stride = m > 5 ? 3 : 2;
        const used = new Set<number>();
        let idx = (slot + variationSeed) % m;
        while (reordered.length < m) {
          while (used.has(idx)) idx = (idx + 1) % m;
          used.add(idx);
          reordered.push(workingPool[idx]);
          idx = (idx + stride) % m;
        }
        break;
      }
      case 8: {
        // Mirror alternate: second half interleaved with first half reversed
        const half = Math.floor(m / 2);
        const firstHalf = workingPool.slice(0, half).reverse();
        const secondHalf = workingPool.slice(half);
        const maxLen = Math.max(firstHalf.length, secondHalf.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < secondHalf.length) reordered.push(secondHalf[i]);
          if (i < firstHalf.length) reordered.push(firstHalf[i]);
        }
        break;
      }
      case 9: {
        // Suspense ladder: peak-climax (75% mark) -> start -> middle
        const p75 = Math.floor(m * 0.75);
        const p40 = Math.floor(m * 0.4);
        reordered = [
          ...workingPool.slice(p75),
          ...workingPool.slice(0, p40),
          ...workingPool.slice(p40, p75).reverse(),
        ];
        break;
      }
      default: {
        // CH 10: Seeded reverse-block remix
        const blockSize = 3;
        const blocks: T[][] = [];
        for (let i = 0; i < m; i += blockSize) {
          blocks.push(workingPool.slice(i, i + blockSize));
        }
        for (let i = blocks.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        }
        reordered = blocks.flat();
        break;
      }
    }

    // Rotate starting hook slightly by variationSeed so re-clicking Unique DNA also changes opening shot
    if (variationSeed > 0 && reordered.length > 3) {
      const rot = (variationSeed * 2 + slot) % reordered.length;
      reordered = [...reordered.slice(rot), ...reordered.slice(0, rot)];
    }

    // Final anti-consecutive-same-scene polish
    return this.shuffleAntiSameScene(reordered.length > 0 ? reordered : workingPool);
  }

  /**
   * Intelligent Gallery Image Selection
   * Handles:
   * 1. Smart Selection (distributes across time, prioritizes quality)
   * 2. Original Order
   * 3. Random Order
   * 4. Multi-pass repetition for long videos without consecutive duplicates and with cooldown
   */
  private static selectGalleryImagesForSlots(
    gallery: GalleryItemInput[],
    neededSlots: number,
    mode: 'smart' | 'original' | 'random'
  ): GalleryItemInput[] {
    let basePool = [...gallery];

    if (mode === 'original') {
      basePool = [...gallery];
    } else if (mode === 'random') {
      basePool = this.shuffleAntiSameScene([...gallery]);
    } else {
      // Smart Selection: Spreads timestamps evenly across the drama timeline
      basePool.sort((a, b) => {
        const timeA = a.timestamp ?? a.index;
        const timeB = b.timestamp ?? b.index;
        return timeA - timeB;
      });
    }

    const result: GalleryItemInput[] = [];

    // Case 1: Gallery has more than or equal to needed slots
    if (gallery.length >= neededSlots) {
      if (mode === 'smart') {
        const step = (gallery.length - 1) / (neededSlots - 1 || 1);
        for (let i = 0; i < neededSlots; i++) {
          const idx = Math.min(gallery.length - 1, Math.round(i * step));
          result.push(basePool[idx]);
        }
      } else {
        for (let i = 0; i < neededSlots; i++) {
          result.push(basePool[i]);
        }
      }
      return result;
    }

    // Case 2: Gallery is smaller than needed slots -> multi-pass repetition
    // Pass 1: Use all unique gallery items in scene-diverse order
    const pass1 = mode === 'random' ? this.shuffleAntiSameScene([...basePool]) : [...basePool];
    for (const item of pass1) {
      if (result.length < neededSlots) {
        result.push(item);
      }
    }

    // Subsequent passes with cooldown, anti-consecutive duplicate, and anti-same-scene time gap
    const times = gallery.map((g) => g.timestamp ?? g.index * 8);
    const totalSpan = Math.max(1, Math.max(...times) - Math.min(...times));
    const minPassTimeGap = Math.min(60, Math.max(18, totalSpan * 0.12));

    const cooldownDistance = Math.min(5, Math.max(1, gallery.length - 1));
    const usageCounts: Record<string, number> = {};
    for (const item of gallery) {
      usageCounts[item.id] = result.filter((r) => r.id === item.id).length;
    }

    while (result.length < neededSlots) {
      const prevSlot = result[result.length - 1];
      const prevTime = prevSlot.timestamp ?? prevSlot.index * 8;
      const recentIds = result.slice(-cooldownDistance).map((r) => r.id);

      // Candidates: Prefer images not in recent cooldown AND from a different scene timestamp
      let candidates = gallery.filter(
        (item) =>
          item.id !== prevSlot.id &&
          !recentIds.includes(item.id) &&
          Math.abs((item.timestamp ?? item.index * 8) - prevTime) >= minPassTimeGap
      );
      if (candidates.length === 0) {
        candidates = gallery.filter((item) => item.id !== prevSlot.id && !recentIds.includes(item.id));
      }
      if (candidates.length === 0) {
        candidates = gallery.filter((item) => item.id !== prevSlot.id);
      }
      if (candidates.length === 0) {
        candidates = [...gallery];
      }

      // Sort by lowest usage first, preferring strong timestamp & visual difference with random tie-break
      candidates.sort((a, b) => {
        const diff = (usageCounts[a.id] || 0) - (usageCounts[b.id] || 0);
        if (diff !== 0) return diff;
        const distA = this.computeSignatureDistance(a.sceneSignature, prevSlot.sceneSignature);
        const distB = this.computeSignatureDistance(b.sceneSignature, prevSlot.sceneSignature);
        const scoreA = distA + Math.random() * 0.6;
        const scoreB = distB + Math.random() * 0.6;
        return scoreB - scoreA;
      });

      const pickWindow = Math.min(3, candidates.length);
      const chosen = candidates[Math.floor(Math.random() * pickWindow)];
      result.push(chosen);
      usageCounts[chosen.id] = (usageCounts[chosen.id] || 0) + 1;
    }

    return result;
  }

  private static computeSignatureDistance(sigA?: number[], sigB?: number[]): number {
    if (!sigA || !sigB || sigA.length === 0 || sigA.length !== sigB.length) {
      return 0.5;
    }
    let sum = 0;
    for (let i = 0; i < sigA.length; i++) {
      sum += Math.abs(sigA[i] - sigB[i]);
    }
    return sum / sigA.length;
  }

  /**
   * Scene-Diverse Anti-Same-Scene Shuffler:
   * Guarantees consecutive images NEVER come from adjacent timestamps or visually similar scenes.
   * Splits screenshots into scene zones across the drama timeline, enforces zone cooldown & minimum time gap,
   * and maximizes visual palette contrast between consecutive frames while staying randomized every run.
   */
  public static shuffleAntiSameScene<
    T extends { id: string; index: number; timestamp?: number; sceneSignature?: number[] }
  >(items: T[]): T[] {
    if (!items || items.length <= 1) return [...items];
    if (items.length === 2) {
      return Math.random() < 0.5 ? [items[1], items[0]] : [items[0], items[1]];
    }

    const getTime = (item: T): number =>
      typeof item.timestamp === 'number' && !isNaN(item.timestamp) ? item.timestamp : item.index * 8;

    // Determine chronological ranking & scene zones
    const sorted = [...items].sort((a, b) => getTime(a) - getTime(b));
    const minT = getTime(sorted[0]);
    const maxT = getTime(sorted[sorted.length - 1]);
    const totalSpan = Math.max(1, maxT - minT);

    const numZones = Math.min(12, Math.max(4, Math.ceil(items.length / 5)));
    const zoneById = new Map<string, number>();
    sorted.forEach((item, rank) => {
      const zone = Math.min(numZones - 1, Math.floor((rank / sorted.length) * numZones));
      zoneById.set(item.id, zone);
    });

    // Dynamic minimum timestamp separation between adjacent frames (~45-95s on typical drama)
    const minSceneGap = Math.min(95, Math.max(24, totalSpan / Math.max(3, numZones * 0.9)));

    const remaining = this.shuffleArray([...items]);
    const result: T[] = [];

    // Start from a random item in any zone
    const firstIdx = Math.floor(Math.random() * remaining.length);
    result.push(remaining.splice(firstIdx, 1)[0]);

    while (remaining.length > 0) {
      const prev = result[result.length - 1];
      const prev2 = result.length >= 2 ? result[result.length - 2] : undefined;
      const prevT = getTime(prev);
      const prev2T = prev2 ? getTime(prev2) : prevT;
      const prevZone = zoneById.get(prev.id) ?? 0;
      const prev2Zone = prev2 ? (zoneById.get(prev2.id) ?? -1) : -1;

      const recentItems = result.slice(-4);
      const recentZones = new Set(recentItems.map((r) => zoneById.get(r.id) ?? -1));

      // Tier 1: Completely fresh zone (not in last 4) + full timestamp gap from prev & prev2
      let candidates = remaining.filter((c) => {
        const cZone = zoneById.get(c.id) ?? -2;
        const cT = getTime(c);
        return (
          !recentZones.has(cZone) &&
          Math.abs(cT - prevT) >= minSceneGap &&
          (!prev2 || Math.abs(cT - prev2T) >= minSceneGap * 0.55)
        );
      });

      // Tier 2: Different zone from last 2 + moderate time gap
      if (candidates.length === 0) {
        candidates = remaining.filter((c) => {
          const cZone = zoneById.get(c.id) ?? -2;
          const cT = getTime(c);
          return (
            cZone !== prevZone &&
            cZone !== prev2Zone &&
            Math.abs(cT - prevT) >= minSceneGap * 0.65
          );
        });
      }

      // Tier 3: At least different zone from immediate prev + minimum scene gap
      if (candidates.length === 0) {
        candidates = remaining.filter((c) => {
          const cZone = zoneById.get(c.id) ?? -2;
          const cT = getTime(c);
          return cZone !== prevZone && Math.abs(cT - prevT) >= minSceneGap * 0.35;
        });
      }

      // Tier 4: Fallback (e.g., final 1-2 items) -> avoid immediate zone/close time if possible
      if (candidates.length === 0) {
        const diffZone = remaining.filter((c) => (zoneById.get(c.id) ?? -2) !== prevZone);
        candidates = diffZone.length > 0 ? diffZone : remaining;
      }

      // Score candidates by temporal separation + visual scene contrast + fresh zone + randomness
      const scored = candidates.map((c) => {
        const cT = getTime(c);
        const minRecentTimeDist = Math.min(
          ...result.slice(-3).map((r) => Math.abs(cT - getTime(r)))
        );
        const timeScore = Math.min(1, minRecentTimeDist / Math.max(1, minSceneGap));
        const visualDiff1 = this.computeSignatureDistance(c.sceneSignature, prev.sceneSignature);
        const visualDiff2 = prev2
          ? this.computeSignatureDistance(c.sceneSignature, prev2.sceneSignature)
          : 0.5;
        const visualScore = visualDiff1 * 0.75 + visualDiff2 * 0.25;
        const cZone = zoneById.get(c.id) ?? -2;
        const zoneBonus = !recentZones.has(cZone) ? 0.35 : cZone !== prevZone ? 0.15 : 0;
        const randomJitter = Math.random() * 0.45;
        return {
          item: c,
          score: timeScore * 1.35 + visualScore * 1.15 + zoneBonus + randomJitter
        };
      });

      scored.sort((a, b) => b.score - a.score);
      const topK = Math.min(4, scored.length);
      const chosenItem = scored[Math.floor(Math.random() * topK)].item;

      result.push(chosenItem);
      const rmIdx = remaining.findIndex((x) => x.id === chosenItem.id);
      if (rmIdx !== -1) {
        remaining.splice(rmIdx, 1);
      }
    }

    return result;
  }

  private static shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Replace a single slot's image with an image from the gallery
   */
  public static replaceSlotImage(
    slots: TimelineSlot[],
    slotIndex: number,
    newImage: GalleryItemInput
  ): TimelineSlot[] {
    if (slotIndex < 0 || slotIndex >= slots.length) return slots;

    const updated = [...slots];
    const target = updated[slotIndex];

    // Recalculate usage count for the new image up to this slot
    let usageCount = 1;
    for (let i = 0; i < slotIndex; i++) {
      if (updated[i].screenshotId === newImage.id) usageCount++;
    }

    updated[slotIndex] = {
      ...target,
      screenshotId: newImage.id,
      dataUrl: newImage.dataUrl,
      originalIndex: newImage.index,
      originalTimestamp: newImage.timestamp,
      formattedOriginalTime: newImage.formattedTime,
      usageCount,
      aspectRatio: (newImage.width && newImage.height) ? newImage.width / newImage.height : 16 / 9
    };

    // Recalculate usage counts for subsequent slots
    const tracker: Record<string, number> = {};
    for (let i = 0; i < updated.length; i++) {
      tracker[updated[i].screenshotId] = (tracker[updated[i].screenshotId] || 0) + 1;
      updated[i].usageCount = tracker[updated[i].screenshotId];
    }

    return updated;
  }

  /**
   * Harmonize modern frame styles and colors across all slots using diverse non-repeating styles & palettes
   */
  public static randomizeSlotFrames(slots: TimelineSlot[], themeId = 'all_dynamic'): TimelineSlot[] {
    const shuffleOffset = Math.floor(Math.random() * 6) * 2;
    return slots.map((s, idx) => {
      const cfg = getRandomFrameConfig(idx + shuffleOffset, themeId);
      return {
        ...s,
        frameStyle: cfg.frameStyle,
        frameColor: cfg.frameColor,
        frameAccentColor: cfg.frameAccentColor
      };
    });
  }

  /**
   * Apply a unified cohesive frame color theme across all timeline slots
   */
  public static applyFrameTheme(slots: TimelineSlot[], themeId: string): TimelineSlot[] {
    return slots.map((s, idx) => {
      const cfg = getRandomFrameConfig(idx, themeId);
      return {
        ...s,
        frameStyle: cfg.frameStyle,
        frameColor: cfg.frameColor,
        frameAccentColor: cfg.frameAccentColor
      };
    });
  }
}
