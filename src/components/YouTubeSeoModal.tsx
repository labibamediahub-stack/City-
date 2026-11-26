/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Check,
  Copy,
  Zap,
  Volume2,
  FileCode,
  Tag,
  Clock,
  Layers,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Tv,
  Film,
  Calendar,
  UserCheck,
  ListOrdered
} from 'lucide-react';
import { YouTubeSeoConfig, NatokContentType } from '../types/timeline';
import { YouTubeSeoOptimizer, YouTubeSeoPackage } from '../services/youtubeSeoOptimizer';

interface YouTubeSeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  seoConfig: YouTubeSeoConfig;
  onUpdateSeoConfig: (config: Partial<YouTubeSeoConfig>) => void;
  dramaName: string;
  channelName: string;
  durationSeconds: number;
  savedDramas?: string[];
  activeChannelSlot?: number;
}

const CONTENT_TYPES: { id: NatokContentType; label: string; icon: string; desc: string }[] = [
  {
    id: 'release_update',
    label: '📢 রিলিজ আপডেট',
    icon: 'Calendar',
    desc: 'নাটক কবে আসবে, সঠিক রিলিজ ডেট ও টেলিকাস্ট সময়ের দর্শক টার্গেট'
  },
  {
    id: 'review',
    label: '🎬 নাটক রিভিউ',
    icon: 'Film',
    desc: 'নাটকের গল্প বিশ্লেষণ, ক্লাইম্যাক্স ও কেমন ছিল তা জানার দর্শক'
  },
  {
    id: 'episode_preview',
    label: '📺 নতুন পর্ব প্রিভিউ',
    icon: 'Tv',
    desc: 'পরবর্তী পর্বে কী ঘটতে যাচ্ছে তার হাইলাইটস ও প্রোমো টার্গেট'
  },
  {
    id: 'best_scene',
    label: '🔥 সেরা দৃশ্য',
    icon: 'Sparkles',
    desc: 'সেরা ডায়ালগ, রোমান্টিক বা আবেগঘন মুহূর্ত দেখতে চাওয়া দর্শক'
  },
  {
    id: 'ending_explained',
    label: '🎭 শেষ পর্বের ব্যাখ্যা',
    icon: 'Layers',
    desc: 'সমাপ্তির রহস্য, ক্লাইম্যাক্স ও টুইস্ট বুঝতে চাওয়া দর্শক'
  }
];

const POPULAR_ACTORS = [
  'জিয়াউল ফারুক অপূর্ব',
  'মোশাররফ করিম',
  'তৌসিফ মাহবুব',
  'মেহজাবীন চৌধুরী',
  'তানজিন তিশা',
  'মুশফিক আর ফারহান',
  'নিলয় আলমগীর',
  'সাবিলা নূর',
  'সাফা কবির'
];

const QUICK_EPISODES = [
  'নতুন পর্ব',
  'পর্ব ০১',
  'পর্ব ০৫',
  'পর্ব ১০',
  'পর্ব ১৫',
  'পর্ব ২০',
  'শেষ পর্ব'
];

export const YouTubeSeoModal: React.FC<YouTubeSeoModalProps> = ({
  isOpen,
  onClose,
  seoConfig,
  onUpdateSeoConfig,
  dramaName,
  channelName,
  durationSeconds,
  savedDramas = [],
  activeChannelSlot = 1
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'copy_package' | 'external_optimizer'>('settings');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [contentType, setContentType] = useState<NatokContentType>(seoConfig.contentType || 'release_update');
  const [currentDrama, setCurrentDrama] = useState(seoConfig.dramaTitle || dramaName || '');
  const [currentEpisode, setCurrentEpisode] = useState(seoConfig.episodeNumber || 'নতুন পর্ব');
  const [currentActor, setCurrentActor] = useState(seoConfig.actorName || '');
  const [currentChannel, setCurrentChannel] = useState(seoConfig.channelName || channelName || '');
  const [customKeywords, setCustomKeywords] = useState(seoConfig.customKeywords || '');

  // External File Optimizer State
  const [externalFile, setExternalFile] = useState<File | null>(null);
  const [isProcessingExternal, setIsProcessingExternal] = useState<boolean>(false);
  const [externalSuccess, setExternalSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (seoConfig.contentType) setContentType(seoConfig.contentType);
    if (seoConfig.dramaTitle) setCurrentDrama(seoConfig.dramaTitle);
    else if (dramaName) setCurrentDrama(dramaName);

    if (seoConfig.episodeNumber) setCurrentEpisode(seoConfig.episodeNumber);
    if (seoConfig.actorName) setCurrentActor(seoConfig.actorName);

    if (seoConfig.channelName) setCurrentChannel(seoConfig.channelName);
    else if (channelName) setCurrentChannel(channelName);
  }, [seoConfig, dramaName, channelName]);

  if (!isOpen) return null;

  // Real-time generated SEO package
  const seoPackage: YouTubeSeoPackage = YouTubeSeoOptimizer.generateSeoPackage({
    dramaName: currentDrama || dramaName,
    channelName: currentChannel || channelName,
    totalDurationSeconds: durationSeconds,
    contentType,
    episodeNumber: currentEpisode,
    actorName: currentActor,
    customKeywords: customKeywords ? customKeywords.split(',').map((k) => k.trim()) : undefined,
    channelSlotNumber: activeChannelSlot
  });

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCopyAll = () => {
    const fullText = `=== YOUTUBE VIDEO TITLE ===
${seoPackage.title}

=== YOUTUBE DESCRIPTION ===
${seoPackage.description}

=== YOUTUBE TAGS ===
${seoPackage.tagsFormatted}
`;
    handleCopy(fullText, 'all');
  };

  const handleSaveSettings = () => {
    onUpdateSeoConfig({
      enabled: seoConfig.enabled,
      contentType,
      dramaTitle: currentDrama,
      episodeNumber: currentEpisode,
      actorName: currentActor,
      channelName: currentChannel,
      customKeywords: customKeywords,
      enableAudioOptimization: seoConfig.enableAudioOptimization !== false,
      enableInFileMetadata: seoConfig.enableInFileMetadata !== false,
      channelSlotNumber: activeChannelSlot
    });
    onClose();
  };

  // Process and inject metadata into existing external file
  const handleProcessExternalFile = async () => {
    if (!externalFile) return;
    setIsProcessingExternal(true);
    setExternalSuccess(false);

    try {
      const arrayBuffer = await externalFile.arrayBuffer();
      const optimizedBuffer = YouTubeSeoOptimizer.injectMp4Metadata(arrayBuffer, {
        title: seoPackage.title,
        artist: currentChannel || 'Bangla Drama Channel',
        album: currentDrama || 'Bangla Natok',
        year: new Date().getFullYear().toString(),
        genre: 'Entertainment / Drama',
        comment: `YouTube SEO (${contentType}); Tags: ${seoPackage.tagsFormatted}`,
        description: seoPackage.description,
        keywords: seoPackage.tagsFormatted
      });

      const blob = new Blob([optimizedBuffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const cleanName = (currentDrama || 'Video').replace(/[^a-zA-Z0-9\u0980-\u09FF_-]/g, '_').slice(0, 30);
      const downloadName = `${cleanName}_${contentType}_YouTube_SEO_${Date.now()}.mp4`;

      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);

      setExternalSuccess(true);
    } catch (err) {
      console.error('External file optimization error:', err);
      alert('ফাইলটিতে মেটাডাটা ইনজেক্ট করতে সমস্যা হয়েছে। দয়া করে নিশ্চিত করুন ফাইলটি একটি বৈধ MP4 ভিডিও।');
    } finally {
      setIsProcessingExternal(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950/70 via-slate-900 to-red-900/40 border-b border-red-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/30 text-white shrink-0">
              <Zap className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  ইউটিউব এআই ও সার্চ এলগরিদম বুস্টার
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">
                  মাল্টি-কনটেন্ট v2.7
                </span>
              </div>
              <p className="text-xs text-slate-300">
                নাটক রিভিউ, রিলিজ আপডেট, নতুন পর্ব ও সেরা দৃশ্যের জন্য আলাদা আলাদা টার্গেটেড কোডিং
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-red-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>নাটক ও ভিডিও ক্যাটাগরি সেটআপ</span>
          </button>
          <button
            onClick={() => setActiveTab('copy_package')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'copy_package'
                ? 'border-red-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>ইউটিউব প্যাকেজ প্রিভিউ ও কপি</span>
          </button>
          <button
            onClick={() => setActiveTab('external_optimizer')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'external_optimizer'
                ? 'border-red-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>আলাদা ভিডিও ফাইল ইনজেক্টর</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: DYNAMIC SETUP */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* STEP 1: Content Type Selector */}
              <div className="space-y-2">
                <label className="text-slate-200 font-extrabold text-xs flex items-center justify-between">
                  <span>১. ভিডিওর মূল বিষয় বা ক্যাটাগরি বেছে নিন:</span>
                  <span className="text-[11px] text-red-400 font-normal">
                    (ইউটিউবের এআই এই বিষয়ের দর্শকদের টার্গেট করবে)
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CONTENT_TYPES.map((type) => {
                    const isSelected = contentType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setContentType(type.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                          isSelected
                            ? 'bg-gradient-to-r from-red-600/30 to-rose-600/20 border-red-500 ring-2 ring-red-500/40 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="font-bold text-xs flex items-center justify-between">
                          <span>{type.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        </span>
                        <span className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                          {type.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: Drama Name & Episode & Actor */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                <div className="font-bold text-slate-200 text-xs flex items-center space-x-1.5 border-b border-slate-800 pb-2">
                  <Tv className="w-4 h-4 text-red-400" />
                  <span>২. নাটকের নির্দিষ্ট তথ্য (যে কোনো নাটক বা পর্ব দিন):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Drama Name */}
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold flex items-center justify-between">
                      <span>নাটকের নাম</span>
                      {savedDramas.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-normal">ড্রপডাউন থেকে সিলেক্ট করা যাবে</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={currentDrama}
                      onChange={(e) => setCurrentDrama(e.target.value)}
                      placeholder="যেমন: মনের মানুষ (Moner Manush)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                    {savedDramas.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {savedDramas.slice(0, 4).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setCurrentDrama(d)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded cursor-pointer transition border border-slate-700"
                          >
                            {d.split('(')[0].trim()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Episode Number */}
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold flex items-center justify-between">
                      <span className="flex items-center space-x-1">
                        <ListOrdered className="w-3.5 h-3.5 text-red-400" />
                        <span>পর্ব বা এপিসোড</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">যেমন: পর্ব ১০, শেষ পর্ব</span>
                    </label>
                    <input
                      type="text"
                      value={currentEpisode}
                      onChange={(e) => setCurrentEpisode(e.target.value)}
                      placeholder="যেমন: পর্ব ০৫ / শেষ পর্ব"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {QUICK_EPISODES.map((ep) => (
                        <button
                          key={ep}
                          type="button"
                          onClick={() => setCurrentEpisode(ep)}
                          className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition border ${
                            currentEpisode === ep
                              ? 'bg-red-600 text-white border-red-500 font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {ep}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actor / Cast Name */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-slate-300 font-bold flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <UserCheck className="w-3.5 h-3.5 text-red-400" />
                      <span>প্রধান অভিনেতা / অভিনেত্রী (Actor / Cast)</span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-normal">
                      (অভিনেতার অডিয়েন্সের হোমপেজে দ্রুত পাঠাবে)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={currentActor}
                    onChange={(e) => setCurrentActor(e.target.value)}
                    placeholder="যেমন: জিয়াউল ফারুক অপূর্ব, মেহজাবীন চৌধুরী"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {POPULAR_ACTORS.map((act) => (
                      <button
                        key={act}
                        type="button"
                        onClick={() => setCurrentActor(act)}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition border ${
                          currentActor === act
                            ? 'bg-red-600 text-white border-red-500 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Channel Name */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-slate-300 font-bold">আপনার চ্যানেলের নাম</label>
                  <input
                    type="text"
                    value={currentChannel}
                    onChange={(e) => setCurrentChannel(e.target.value)}
                    placeholder="যেমন: NTV Natok / Rtv Drama / আপনার চ্যানেল"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Real-time Generated Title Preview Card */}
              <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl space-y-1">
                <span className="text-[10px] text-red-400 uppercase font-extrabold tracking-wider block">
                  লাইভ জেনারেটেড হাই-সিটিআর টাইটেল (Live Generated Title):
                </span>
                <p className="text-white font-mono text-xs font-bold leading-relaxed select-all">
                  {seoPackage.title}
                </p>
              </div>

              {/* Master Switch & Codes Active Box */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-xs block">
                    ভিডিও এক্সপোর্টের সময় ফাইলে অটোমেটিক মেটাডাটা ও অডিও কোড ইনজেকশন
                  </span>
                  <span className="text-[11px] text-slate-400">
                    -14 LUFS সাউন্ড টিউনিং এবং ৩.২ kHz বাংলা স্পিচ ক্ল্যারিটি ডিএসপি সক্রিয় থাকবে
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSeoConfig({ enabled: !seoConfig.enabled })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    seoConfig.enabled ? 'bg-red-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      seoConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COPY PACKAGE FOR YOUTUBE STUDIO */}
          {activeTab === 'copy_package' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-red-950/30 border border-red-500/20 p-2.5 rounded-lg">
                <span className="text-slate-300 text-xs">
                  ইউটিউব স্টুডিওতে ভিডিও আপলোডের সময় নিচের লেখাগুলো সরাসরি পেস্ট করুন:
                </span>
                <button
                  onClick={handleCopyAll}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1 cursor-pointer transition shadow-md"
                >
                  {copiedField === 'all' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>সব কপি হয়েছে!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>সব একসাথে কপি</span>
                    </>
                  )}
                </button>
              </div>

              {/* Title Section */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center space-x-1">
                    <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">১</span>
                    <span>ভিডিওর টাইটেল (High CTR Title):</span>
                  </span>
                  <button
                    onClick={() => handleCopy(seoPackage.title, 'title')}
                    className="text-red-400 hover:text-red-300 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedField === 'title' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'title' ? 'কপি হয়েছে' : 'টাইটেল কপি'}</span>
                  </button>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-white select-all text-xs font-semibold">
                  {seoPackage.title}
                </div>
              </div>

              {/* Description Section */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center space-x-1">
                    <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">২</span>
                    <span>ভিডিওর ডেসক্রিপশন ও কী-মোমেন্টস টাইমকোড:</span>
                  </span>
                  <button
                    onClick={() => handleCopy(seoPackage.description, 'description')}
                    className="text-red-400 hover:text-red-300 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedField === 'description' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'description' ? 'কপি হয়েছে' : 'ডেসক্রিপশন কপি'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={6}
                  value={seoPackage.description}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-sans text-slate-300 text-xs focus:outline-none select-all"
                />
              </div>

              {/* Tags Section */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center space-x-1">
                    <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">৩</span>
                    <span>ইউটিউব সার্চ ট্যাগস ({seoPackage.tags.length} টি ট্যাগ):</span>
                  </span>
                  <button
                    onClick={() => handleCopy(seoPackage.tagsFormatted, 'tags')}
                    className="text-red-400 hover:text-red-300 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedField === 'tags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'tags' ? 'কপি হয়েছে' : 'ট্যাগস কপি'}</span>
                  </button>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-300 text-xs max-h-24 overflow-y-auto select-all leading-relaxed">
                  {seoPackage.tagsFormatted}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXTERNAL VIDEO OPTIMIZER */}
          {activeTab === 'external_optimizer' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    আগের তৈরি যেকোনো MP4 ভিডিওতে নির্দিষ্ট মেটাডাটা ইনজেক্ট করুন
                  </h4>
                  <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
                    আপনার সিলেক্ট করা নাটক <strong>({currentDrama || 'নাটক'})</strong> ও ক্যাটাগরি <strong>({contentType})</strong> অনুযায়ী ভিডিও ফাইলটিতে মেটাডাটা ও ফাস্ট-স্টার্ট ইনজেক্ট করে নতুন ফাইল ডাউনলোড হবে।
                  </p>
                </div>

                <div className="pt-2">
                  <input
                    type="file"
                    id="external-video-input"
                    accept="video/mp4"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setExternalFile(e.target.files[0]);
                        setExternalSuccess(false);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="external-video-input"
                    className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-md"
                  >
                    <Upload className="w-4 h-4 text-red-400" />
                    <span>{externalFile ? externalFile.name : 'ভিডিও ফাইল সিলেক্ট করুন (.mp4)'}</span>
                  </label>
                </div>

                {externalFile && (
                  <div className="pt-2">
                    <button
                      onClick={handleProcessExternalFile}
                      disabled={isProcessingExternal}
                      className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg text-xs flex items-center space-x-2 mx-auto cursor-pointer transition shadow-lg disabled:opacity-50"
                    >
                      {isProcessingExternal ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>মেটাডাটা ইনজেক্ট হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-current" />
                          <span>মেটাডাটা ইনজেক্ট ও অপ্টিমাইজড ফাইল ডাউনলোড</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {externalSuccess && (
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>অভিনন্দন! আপনার ভিডিওটিতে সফলভাবে ইউটিউব এআই কোড ইনজেক্ট হয়েছে এবং ডাউনলোড সম্পন্ন হয়েছে।</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>১০০% ডায়নামিক ইউটিউব অ্যালগরিদম টার্গেটিং</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-xs transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1 shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>সেভ ও প্রয়োগ করুন</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
