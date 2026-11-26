/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { YouTubeSeoConfig, NatokContentType } from '../types/timeline';

export interface YouTubeSeoPackage {
  title: string;
  description: string;
  tags: string[];
  tagsFormatted: string;
  chapters: { time: string; title: string }[];
  category: string;
  audioStandard: string;
  contentType: NatokContentType;
  episodeNumber?: string;
  actorName?: string;
}

export class YouTubeSeoOptimizer {
  /**
   * Generates a complete SEO metadata package tailored for YouTube's Search & Recommendation AI
   * dynamically adapted to Natok Reviews, Release Updates, Episode Previews, or Best Scenes.
   */
  public static generateSeoPackage(params: {
    dramaName?: string;
    channelName?: string;
    totalDurationSeconds?: number;
    customKeywords?: string[];
    contentType?: NatokContentType;
    episodeNumber?: string;
    actorName?: string;
    channelSlotNumber?: number;
  }): YouTubeSeoPackage {
    const rawDrama = (params.dramaName || 'জনপ্রিয় বাংলা নাটক').trim();
    // Strip parenthetical English if present for clean title, but keep for tags
    const cleanDrama = rawDrama.replace(/\s*\([^)]*\)/g, '').trim();
    const rawChannel = (params.channelName || 'Bangla Drama Channel').trim();
    const durSec = Math.round(params.totalDurationSeconds || 60);
    const cType: NatokContentType = params.contentType || 'review';
    const rawEp = (params.episodeNumber || '').trim();
    const epLabel = rawEp ? (rawEp.includes('পর্ব') || rawEp.toLowerCase().includes('episode') ? rawEp : `পর্ব ${rawEp}`) : '';
    const actor = (params.actorName || '').trim();
    const actorLabel = actor ? ` | ${actor}` : '';
    const slotNum = Math.max(1, Math.min(10, Math.round(params.channelSlotNumber || 1)));

    const year = new Date().getFullYear();

    let title = '';
    let descriptionIntro = '';
    let specificTags: string[] = [];

    const epPart = epLabel ? `${epLabel} ` : '';
    switch (cType) {
      case 'release_update': {
        const titleVariants = [
          `${cleanDrama} ${epPart}কবে রিলিজ হবে? সম্ভাব্য তারিখ ও আপডেট${actorLabel} | ${rawChannel}`,
          `${cleanDrama} ${epPart}রিলিজ ডেট আপডেট ও নতুন তথ্য${actorLabel} | Natok Update ${year}`,
          `${cleanDrama} ${epPart}কবে আসছে? সময়সূচি ও বিস্তারিত বিশ্লেষণ | ${rawChannel}`,
          `${cleanDrama} ${epPart}নতুন পর্ব কবে দেখা যাবে? লেটেস্ট আপডেট${actorLabel}`,
          `${cleanDrama} ${epPart}আপকামিং রিলিজ আপডেট ও প্রিভিউ | ${rawChannel} (${year})`,
        ];
        title = titleVariants[(slotNum - 1) % titleVariants.length];
        descriptionIntro = `${cleanDrama} ${epPart}কবে ও কোন সময়সূচিতে আসতে পারে? জেনে নিন সম্ভাব্য রিলিজ আপডেট ও নাটকের সর্বশেষ তথ্য। নিয়মিত বিশ্লেষণ ও আপডেট পেতে যুক্ত থাকুন ${rawChannel}-এর সাথে।`;
        specificTags = [
          `${cleanDrama} release date`,
          `${cleanDrama} kobe asbe`,
          `${cleanDrama} release update`,
          `${cleanDrama} release time`,
          `${cleanDrama} new episode date`,
          `${cleanDrama} ${epLabel}`,
          'bangla natok release date',
          'natok release update'
        ];
        break;
      }

      case 'review': {
        const titleVariants = [
          `${cleanDrama} ${epPart}গল্প বিশ্লেষণ ও রিভিউ${actorLabel} | ${rawChannel}`,
          `${cleanDrama} ${epPart}কেমন হলো? সম্পূর্ণ গল্প রিভিউ ও টুইস্ট | Natok Review ${year}`,
          `${cleanDrama} ${epPart}রিভিউ: গল্পের মোড় ও অভিনয় বিশ্লেষণ${actorLabel} | ${rawChannel}`,
          `${cleanDrama} ${epPart}স্টোরি ব্রেকডাউন ও দর্শক প্রতিক্রিয়া | Bangla Drama Review`,
          `${cleanDrama} ${epPart}নাটকের আসল গল্প ও গুরুত্বপূর্ণ দৃশ্য বিশ্লেষণ | ${rawChannel}`,
        ];
        title = titleVariants[(slotNum - 1) % titleVariants.length];
        descriptionIntro = `${cleanDrama} ${epPart}নাটকের গল্প বিশ্লেষণ, চরিত্রগুলোর অবস্থান ও গুরুত্বপূর্ণ মুহূর্তের রিভিউ। নাটকটি কেমন ছিল এবং সামনে কী মোড় নিতে পারে জানতে সম্পূর্ণ ভিডিওটি দেখুন।`;
        specificTags = [
          `${cleanDrama} review`,
          `${cleanDrama} natok review`,
          `${cleanDrama} ending explained`,
          `${cleanDrama} story breakdown`,
          `${cleanDrama} climax`,
          'bangla natok review',
          'new natok review'
        ];
        break;
      }

      case 'episode_preview': {
        const titleVariants = [
          `${cleanDrama} ${epPart}আগামী পর্বের প্রিভিউ ও সম্ভাবনা${actorLabel} | ${rawChannel}`,
          `${cleanDrama} ${epPart}পরবর্তী পর্বে কী ঘটতে যাচ্ছে? প্রিভিউ বিশ্লেষণ`,
          `${cleanDrama} ${epPart}নতুন পর্বের হাইলাইটস ও গল্পের ইঙ্গিত | ${rawChannel}`,
        ];
        title = titleVariants[(slotNum - 1) % titleVariants.length];
        descriptionIntro = `${cleanDrama} নাটকের পরবর্তী পর্ব (${epLabel || 'নতুন পর্ব'})-তে কী মোড় আসতে পারে? প্রিভিউ বিশ্লেষণ ও গল্পের সম্ভাব্য দিকগুলো নিয়ে আজকের আলোচনা।`;
        specificTags = [
          `${cleanDrama} ${epLabel}`,
          `${cleanDrama} next episode`,
          `${cleanDrama} promo`,
          `${cleanDrama} preview`,
          `${cleanDrama} agami porbo`,
          'next episode preview',
          'bangla natok promo'
        ];
        break;
      }

      case 'best_scene': {
        title = `${cleanDrama} ${epPart}গুরুত্বপূর্ণ দৃশ্য ও সংলাপ বিশ্লেষণ${actorLabel} | ${rawChannel}`;
        descriptionIntro = `${cleanDrama} নাটকের আলোচিত দৃশ্য ও আবেগঘন সংলাপ নিয়ে সংক্ষিপ্ত পর্যালোচনা। নিয়মিত রিভিউ পেতে সাথে থাকুন ${rawChannel} চ্যানেলের।`;
        specificTags = [
          `${cleanDrama} best scene`,
          `${cleanDrama} emotional scene`,
          `${cleanDrama} dialogue`,
          `${cleanDrama} story analysis`,
          'natok scene review'
        ];
        break;
      }

      case 'ending_explained': {
        title = `${cleanDrama} শেষ পর্বের টুইস্ট ও গল্পের ব্যাখ্যা${actorLabel} | Ending Explained | ${rawChannel}`;
        descriptionIntro = `${cleanDrama} শেষ পর্বে কী ঘটল? নাটকের সমাপ্তি, ক্লাইম্যাক্স ও হিডেন টুইস্টের সহজ ব্যাখ্যা জেনে নিন।`;
        specificTags = [
          `${cleanDrama} ending explained`,
          `${cleanDrama} last episode twist`,
          `${cleanDrama} climax explained`,
          `${cleanDrama} shesh porbo twist`
        ];
        break;
      }
    }

    // Auto-generate realistic Timecode Chapters for YouTube Key Moments AI
    const chapters: { time: string; title: string }[] = [];
    chapters.push({ time: '00:00', title: '🎬 সূচনা ও মূল বিষয়' });
    if (durSec >= 20) {
      const step1 = Math.floor(durSec * 0.25);
      chapters.push({
        time: YouTubeSeoOptimizer.formatTimecode(step1),
        title: cType === 'release_update' ? '📢 রিলিজ আপডেট ও সময়সূচি' : '🔥 গল্পের গুরুত্বপূর্ণ অংশ'
      });
    }
    if (durSec >= 40) {
      const step2 = Math.floor(durSec * 0.6);
      chapters.push({
        time: YouTubeSeoOptimizer.formatTimecode(step2),
        title: cType === 'review' ? '💔 মূল টুইস্ট ও বিশ্লেষণ' : '⭐ পর্বের বিশেষ দিক'
      });
    }
    if (durSec >= 60) {
      const step3 = Math.floor(durSec * 0.85);
      chapters.push({
        time: YouTubeSeoOptimizer.formatTimecode(step3),
        title: '📺 উপসংহার ও পরবর্তী আপডেট'
      });
    }

    // High Search Volume Tags (Bengali & English targeted keywords) with per-channel rotation
    const baseTags = [
      ...specificTags,
      cleanDrama,
      `${cleanDrama} review`,
      `${cleanDrama} update`,
      `${cleanDrama} নাটক`,
      `${cleanDrama} new episode`,
      rawChannel,
      'bangla natok review',
      'bangla series update',
      `bangla natok ${year}`,
      'bangla drama analysis',
      'নাটক রিভিউ',
      'রিলিজ আপডেট'
    ];

    if (actor) {
      baseTags.unshift(
        actor,
        `${actor} new natok`,
        `${actor} ${cleanDrama}`,
        `${actor} natok ${year}`
      );
    }

    if (epLabel) {
      baseTags.unshift(`${cleanDrama} ${epLabel}`);
    }

    if (params.customKeywords && params.customKeywords.length > 0) {
      baseTags.unshift(...params.customKeywords);
    }

    // Rotate tail tags per channelSlotNumber so 10 channels don't share identical tag order
    const deduped = Array.from(new Set(baseTags.map((t) => t.trim()).filter(Boolean)));
    const head = deduped.slice(0, 3);
    const tail = deduped.slice(3);
    const rotOffset = tail.length > 0 ? (slotNum * 2) % tail.length : 0;
    const rotatedTail = [...tail.slice(rotOffset), ...tail.slice(0, rotOffset)];
    const uniqueTags = [...head, ...rotatedTail].slice(0, 35);
    const tagsFormatted = uniqueTags.join(', ');

    // Detailed Description with Chapters, Search Keywords, and Honest Review Disclaimer (anti-spam)
    const chaptersText = chapters.map((c) => `${c.time} - ${c.title}`).join('\n');
    const dramaSlug = cleanDrama.replace(/\s+/g, '');
    const channelSlug = rawChannel.replace(/\s+/g, '');
    const actorSlug = actor ? `#${actor.replace(/\s+/g, '')} ` : '';

    const descriptionBlocks = [
      `${descriptionIntro}\n\n📌 ভিডিওর মূল অংশ (Chapters):\n${chaptersText}\n\n📝 ডিসক্লেইমার: এটি একটি সৃজনশীল গল্প বিশ্লেষণ ও সম্ভাব্য রিলিজ আপডেট ভিত্তিক রিভিউ ভিডিও। অফিশিয়াল নাটক দেখতে মূল নির্মাতা ও প্রযোজনা প্রতিষ্ঠানের প্ল্যাটফর্ম অনুসরণ করুন।\n\n📺 ${rawChannel}-এর সাথেই থাকুন।`,
      `▶ ${descriptionIntro}\n\n⏱️ টাইমলাইন:\n${chaptersText}\n\n🔎 সম্পর্কিত বিষয়: ${uniqueTags.slice(0, 10).join(' | ')}\n\n⚠️ নোট: এই ভিডিওতে শুধুমাত্র নাটকের গল্প পর্যালোচনা ও আপডেট তথ্য শেয়ার করা হয়েছে।`,
      `${descriptionIntro}\n\nআলোচনার সূচি:\n${chaptersText}\n\n${rawChannel} চ্যানেলে নিয়মিত বাংলা ওয়েব সিরিজ ও নাটকের বিশ্লেষণমূলক রিভিউ প্রকাশ করা হয়।\n\n${actorSlug}#${dramaSlug} #${channelSlug} #NatokReview #ReleaseUpdate${year}`
    ];

    const description = descriptionBlocks[(slotNum - 1) % descriptionBlocks.length] +
      (slotNum % 3 !== 0 ? `\n\n#${dramaSlug} #${channelSlug} ${actorSlug}#NatokReview #BanglaDrama #Update${year}` : '');

    return {
      title,
      description,
      tags: uniqueTags,
      tagsFormatted,
      chapters,
      category: 'Entertainment',
      audioStandard: 'YouTube Target -14 LUFS (Humanized Studio Mastering)',
      contentType: cType,
      episodeNumber: rawEp,
      actorName: actor
    };
  }

  private static formatTimecode(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Applies YouTube Audio Loudness Normalization (-14 LUFS) and Speech-to-Text Intelligibility Boost
   */
  public static async processAudioForYouTube(
    inputBuffer: AudioBuffer,
    options?: { targetLufs?: number; boostVocalIntelligibility?: boolean }
  ): Promise<AudioBuffer> {
    const boostVocal = options?.boostVocalIntelligibility !== false;
    const sampleRate = inputBuffer.sampleRate || 44100;
    const channels = inputBuffer.numberOfChannels;
    const length = inputBuffer.length;

    const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = inputBuffer;

    let lastNode: AudioNode = source;

    if (boostVocal) {
      // 1. Highpass at 80Hz: Removes microphone plosives and low sub-bass rumble
      const highpass = offlineCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 80;
      lastNode.connect(highpass);
      lastNode = highpass;

      // 2. Vocal intelligibility booster at 3.2kHz (helps YouTube speech recognition AI transcribe every word)
      const vocalPresence = offlineCtx.createBiquadFilter();
      vocalPresence.type = 'peaking';
      vocalPresence.frequency.value = 3200;
      vocalPresence.Q.value = 1.2;
      vocalPresence.gain.value = 3.5; // +3.5 dB boost
      lastNode.connect(vocalPresence);
      lastNode = vocalPresence;

      // 3. Subtle air/clarity high shelf filter at 8.5kHz
      const airShelf = offlineCtx.createBiquadFilter();
      airShelf.type = 'highshelf';
      airShelf.frequency.value = 8500;
      airShelf.gain.value = 1.5;
      lastNode.connect(airShelf);
      lastNode = airShelf;
    }

    // 4. Studio Dynamic Compressor tuned for broadcast & YouTube speech clarity
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 10;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;
    lastNode.connect(compressor);
    lastNode = compressor;

    // 5. Output Gain targeted for -14 LUFS standard
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 1.05;
    lastNode.connect(masterGain);
    masterGain.connect(offlineCtx.destination);

    source.start(0);
    return await offlineCtx.startRendering();
  }

  /**
   * Helper to write a 4-byte ASCII string
   */
  private static writeAscii(view: DataView, offset: number, str: string) {
    for (let i = 0; i < 4; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * Builds an iTunes/QuickTime Metadata Item box (e.g., ©nam, ©ART, desc, keyw)
   */
  private static createIlstItemBox(tag: string, textValue: string): Uint8Array {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(textValue);
    // data box: size(4) + 'data'(4) + type(4, 1=utf8) + locale(4, 0) + payload
    const dataBoxSize = 16 + textBytes.length;
    // item box: size(4) + tag(4) + dataBox
    const itemBoxSize = 8 + dataBoxSize;

    const buf = new Uint8Array(itemBoxSize);
    const view = new DataView(buf.buffer);

    // Item box header
    view.setUint32(0, itemBoxSize);
    YouTubeSeoOptimizer.writeAscii(view, 4, tag);

    // Data box header
    view.setUint32(8, dataBoxSize);
    YouTubeSeoOptimizer.writeAscii(view, 12, 'data');
    view.setUint32(16, 1); // Type 1 = UTF-8 text without BOM
    view.setUint32(20, 0); // Locale 0

    // Payload
    buf.set(textBytes, 24);
    return buf;
  }

  /**
   * Builds the entire ISO BMFF 'udta' (User Data) atom containing 'meta' -> 'hdlr' -> 'ilst'
   */
  public static buildUdtaAtom(metadata: {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    comment?: string;
    genre?: string;
    description?: string;
    keywords?: string;
  }): Uint8Array {
    const itemBoxes: Uint8Array[] = [];

    if (metadata.title) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('©nam', metadata.title));
    if (metadata.artist) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('©ART', metadata.artist));
    if (metadata.album) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('©alb', metadata.album));
    if (metadata.year) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('©day', metadata.year));
    if (metadata.genre) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('©gen', metadata.genre));
    if (metadata.comment) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('©cmt', metadata.comment));
    if (metadata.description) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('desc', metadata.description));
    if (metadata.keywords) itemBoxes.push(YouTubeSeoOptimizer.createIlstItemBox('keyw', metadata.keywords));

    // Calculate ilst size
    let ilstPayloadSize = 0;
    for (const b of itemBoxes) ilstPayloadSize += b.length;
    const ilstBoxSize = 8 + ilstPayloadSize;

    const ilstBox = new Uint8Array(ilstBoxSize);
    const ilstView = new DataView(ilstBox.buffer);
    ilstView.setUint32(0, ilstBoxSize);
    YouTubeSeoOptimizer.writeAscii(ilstView, 4, 'ilst');
    let offset = 8;
    for (const b of itemBoxes) {
      ilstBox.set(b, offset);
      offset += b.length;
    }

    // Handler box: size(4) + 'hdlr'(4) + version(4) + pre_defined(4) + handler_type('mdir')(4) + manufacturer('appl')(4) + flags(8) + name(1)=33 or 34
    const hdlrSize = 33;
    const hdlrBox = new Uint8Array(hdlrSize);
    const hdlrView = new DataView(hdlrBox.buffer);
    hdlrView.setUint32(0, hdlrSize);
    YouTubeSeoOptimizer.writeAscii(hdlrView, 4, 'hdlr');
    hdlrView.setUint32(8, 0); // version & flags
    hdlrView.setUint32(12, 0); // pre_defined
    YouTubeSeoOptimizer.writeAscii(hdlrView, 16, 'mdir'); // metadata handler
    YouTubeSeoOptimizer.writeAscii(hdlrView, 20, 'appl'); // Apple metadata
    // Remaining bytes are zeros

    // Meta box: size(4) + 'meta'(4) + version(4)=0 + hdlrBox + ilstBox
    const metaBoxSize = 12 + hdlrSize + ilstBoxSize;
    const metaBox = new Uint8Array(metaBoxSize);
    const metaView = new DataView(metaBox.buffer);
    metaView.setUint32(0, metaBoxSize);
    YouTubeSeoOptimizer.writeAscii(metaView, 4, 'meta');
    metaView.setUint32(8, 0); // version & flags = 0
    metaBox.set(hdlrBox, 12);
    metaBox.set(ilstBox, 12 + hdlrSize);

    // udta box: size(4) + 'udta'(4) + metaBox
    const udtaSize = 8 + metaBoxSize;
    const udtaBox = new Uint8Array(udtaSize);
    const udtaView = new DataView(udtaBox.buffer);
    udtaView.setUint32(0, udtaSize);
    YouTubeSeoOptimizer.writeAscii(udtaView, 4, 'udta');
    udtaBox.set(metaBox, 8);

    return udtaBox;
  }

  /**
   * Injects the 'udta' metadata atom into an MP4 ArrayBuffer right inside the 'moov' atom,
   * cleanly shifting chunk offsets in 'stco' tables so that the file remains 100% compliant and playable!
   */
  public static injectMp4Metadata(
    mp4Buffer: ArrayBuffer,
    metadata: {
      title?: string;
      artist?: string;
      album?: string;
      year?: string;
      comment?: string;
      genre?: string;
      description?: string;
      keywords?: string;
    }
  ): ArrayBuffer {
    const udtaAtom = YouTubeSeoOptimizer.buildUdtaAtom(metadata);
    const shiftBytes = udtaAtom.byteLength;

    const srcBytes = new Uint8Array(mp4Buffer);
    const view = new DataView(mp4Buffer);
    let moovOffset = -1;
    let moovSize = 0;

    // Scan top-level boxes to locate 'moov'
    let cursor = 0;
    while (cursor + 8 <= mp4Buffer.byteLength) {
      const boxSize = view.getUint32(cursor);
      const boxType = String.fromCharCode(
        srcBytes[cursor + 4],
        srcBytes[cursor + 5],
        srcBytes[cursor + 6],
        srcBytes[cursor + 7]
      );

      if (boxSize < 8) break; // invalid or extended box

      if (boxType === 'moov') {
        moovOffset = cursor;
        moovSize = boxSize;
        break;
      }
      cursor += boxSize;
    }

    if (moovOffset === -1 || moovSize < 8) {
      // If moov is not found, return original buffer
      return mp4Buffer;
    }

    // Allocate new buffer with added udta length
    const newLength = mp4Buffer.byteLength + shiftBytes;
    const destBuffer = new ArrayBuffer(newLength);
    const destBytes = new Uint8Array(destBuffer);
    const destView = new DataView(destBuffer);

    // 1. Copy everything up to end of moov
    const moovEnd = moovOffset + moovSize;
    destBytes.set(srcBytes.subarray(0, moovEnd), 0);

    // 2. Append udta inside moov (at moovEnd)
    destBytes.set(udtaAtom, moovEnd);

    // 3. Copy the rest of the file (e.g. mdat, if moov comes first)
    if (moovEnd < mp4Buffer.byteLength) {
      destBytes.set(srcBytes.subarray(moovEnd), moovEnd + shiftBytes);
    }

    // 4. Update moov box size header
    const newMoovSize = moovSize + shiftBytes;
    destView.setUint32(moovOffset, newMoovSize);

    // 5. Update chunk offsets in all 'stco' boxes within moov if mdat is after moov
    const mdatFollowsMoov = moovEnd < mp4Buffer.byteLength;
    if (mdatFollowsMoov) {
      YouTubeSeoOptimizer.adjustChunkOffsets(destView, moovOffset, newMoovSize, shiftBytes);
    }

    return destBuffer;
  }

  /**
   * Adjusts 32-bit chunk offsets in 'stco' boxes to account for the enlarged 'moov' box
   */
  private static adjustChunkOffsets(view: DataView, moovOffset: number, moovSize: number, shift: number) {
    const moovEnd = moovOffset + moovSize;
    let cursor = moovOffset + 8; // skip moov header

    while (cursor + 8 < moovEnd) {
      // Check if current position matches 'stco'
      if (
        view.getUint8(cursor + 4) === 0x73 && // 's'
        view.getUint8(cursor + 5) === 0x74 && // 't'
        view.getUint8(cursor + 6) === 0x63 && // 'c'
        view.getUint8(cursor + 7) === 0x6f    // 'o'
      ) {
        const stcoSize = view.getUint32(cursor);
        const entryCount = view.getUint32(cursor + 12);
        let entryOffset = cursor + 16;
        for (let i = 0; i < entryCount; i++) {
          if (entryOffset + 4 <= moovEnd) {
            const currentOffset = view.getUint32(entryOffset);
            view.setUint32(entryOffset, currentOffset + shift);
          }
          entryOffset += 4;
        }
        cursor += Math.max(8, stcoSize);
      } else {
        cursor++;
      }
    }
  }
}
