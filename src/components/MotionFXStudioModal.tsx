/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, X, Plus, Trash2, CheckCircle2, AlertCircle, Code, Play, Film, ShieldCheck, Search, Layers, Box, Zap, RotateCcw } from 'lucide-react';
import { CustomMotionFxItem, MotionFxStudioService } from '../services/motionFxStudioService';

interface MotionFXStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEffectsUpdated: () => void;
}

export const MotionFXStudioModal: React.FC<MotionFXStudioModalProps> = ({
  isOpen,
  onClose,
  onEffectsUpdated
}) => {
  const [effects, setEffects] = useState<CustomMotionFxItem[]>(() => MotionFxStudioService.getSavedEffects());
  const [effectName, setEffectName] = useState<string>('');
  const [effectType, setEffectType] = useState<'animation' | 'transition' | '3d_motion' | 'cinematic'>('animation');
  const [effectVariant, setEffectVariant] = useState<'original' | 'normal' | 'reverse'>('original');
  const [effectCode, setEffectCode] = useState<string>('');
  const [cleanBgMode, setCleanBgMode] = useState<boolean>(() => MotionFxStudioService.isCleanBackgroundEnabled());
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  
  // Categorization & Search state
  const [activeTab, setActiveTab] = useState<'all' | 'animation' | 'transition' | '3d_motion' | 'cinematic'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setEffects(MotionFxStudioService.getSavedEffects());
      setCleanBgMode(MotionFxStudioService.isCleanBackgroundEnabled());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddEffect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectName.trim() || !effectCode.trim()) {
      alert('দয়া করে ইফেকটের নাম এবং কোড প্রদান করুন।');
      return;
    }

    try {
      const updated = MotionFxStudioService.addEffect({
        name: effectName.trim(),
        type: effectType,
        variant: effectVariant,
        code: effectCode.trim()
      });

      setEffects(updated);
      setEffectName('');
      setEffectCode('');
      setTestResult({ status: 'success', message: 'ইফেক্ট কোড (Original, Normal ও Reverse সহ) সফলভাবে সংরক্ষিত হয়েছে!' });
      onEffectsUpdated();
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message || 'কোড যাচাইকরণে ত্রুটি হয়েছে।' });
    }
  };

  const handleDelete = (id: string) => {
    const updated = MotionFxStudioService.deleteEffect(id);
    setEffects(updated);
    onEffectsUpdated();
  };

  const handleToggleCleanBg = (val: boolean) => {
    setCleanBgMode(val);
    MotionFxStudioService.setCleanBackgroundEnabled(val);
    onEffectsUpdated();
  };

  const handleTestCode = () => {
    if (!effectCode.trim()) {
      setTestResult({ status: 'error', message: 'পরীক্ষার জন্য কোড দিন।' });
      return;
    }
    try {
      const fn = new Function(`return ${effectCode.trim()}`)();
      if (typeof fn === 'function') {
        setTestResult({ status: 'success', message: '✅ কোড সিনট্যাক্স সফলভাবে পরীক্ষিত ও কার্যকর!' });
      } else {
        throw new Error('কোডটি কার্যকর ফাংশন রিটার্ন করেনি।');
      }
    } catch (err: any) {
      setTestResult({ status: 'error', message: `❌ সিনট্যাক্স ত্রুটি: ${err.message}` });
    }
  };

  // Filtered effects by category and search query
  const filteredEffects = effects.filter((fx) => {
    const matchesTab = activeTab === 'all' || fx.type === activeTab;
    const matchesSearch = searchQuery.trim() === '' || 
      fx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fx.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fx.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const countByType = (type: string) => effects.filter(e => e.type === type).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border-2 border-indigo-500 flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">Motion FX Studio — Animation, Transition & 3D Motion Catalog</h2>
              <p className="text-xs text-indigo-100">র্যান্ডম ইফেক্ট সিলেকশন এবং ক্যাটাগরি অনুযায়ী সংগৃহীত কোড তালিকা</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-5">
          {/* Clean Background Toggle Bar */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="w-5 h-5 text-violet-600 shrink-0" />
              <div>
                <span className="font-bold text-xs text-violet-950 block">ফুল-স্ক্রিন ক্লিন পিকচার মোড (Full-Screen Clean Mode)</span>
                <span className="text-[11px] text-violet-700">চালু থাকলে ব্যাকগ্রাউন্ডে কোনো রঙ বা বাড়তি ইফেক্ট থাকবে না — শুধু নিখাদ ছবি পুরো স্ক্রিন জুড়ে প্রদর্শিত হবে।</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={cleanBgMode}
                onChange={(e) => handleToggleCleanBg(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {/* Add New Code Form */}
          <form onSubmit={handleAddEffect} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                <Code className="w-4 h-4 text-indigo-600" />
                <span>নতুন ইফেক্ট কোড যুক্ত করুন (Original, Normal বা Reverse)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">ইফেকটের নাম</label>
                <input
                  type="text"
                  value={effectName}
                  onChange={(e) => setEffectName(e.target.value)}
                  placeholder="যেমন: Slide Left / Zoom In"
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">ইফেক্ট ক্যাটাগরি</label>
                <select
                  value={effectType}
                  onChange={(e) => setEffectType(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="animation">Animation (দৃশ্য অ্যানিমেশন)</option>
                  <option value="transition">Transition (ট্রানজিশন)</option>
                  <option value="3d_motion">3D Motion (৩D মোশন)</option>
                  <option value="cinematic">Cinematic Effect (সিনেমাটিক)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">স্টাইল ভার্সন</label>
                <select
                  value={effectVariant}
                  onChange={(e) => setEffectVariant(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="original">Original (মৌলিক)</option>
                  <option value="normal">Normal (সাধারণ)</option>
                  <option value="reverse">Reverse (বিপরীতমুখী)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-700">ইফেক্ট কোড (JavaScript / Canvas Render Code)</label>
              <textarea
                value={effectCode}
                onChange={(e) => setEffectCode(e.target.value)}
                placeholder="(ctx, img, progress, elapsed, duration, w, h, context) => { ... }"
                rows={3}
                className="bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {testResult.status !== 'idle' && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                testResult.status === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {testResult.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span className="font-medium">{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestCode}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-3 py-2 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-indigo-600" />
                <span>কোড পরীক্ষা করুন</span>
              </button>

              <button
                type="submit"
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ইফেক্ট যুক্ত করুন (Original + Reverse)</span>
              </button>
            </div>
          </form>

          {/* Dynamically Categorized Effects Catalog & List Display */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <h3 className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                <Film className="w-4 h-4 text-indigo-600" />
                <span>সংরক্ষিত ও আমদানিকৃত ইফেক্ট ক্যাটালগ ({filteredEffects.length}/{effects.length}টি)</span>
              </h3>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ইফেক্ট বা কোড খুঁজুন..."
                  className="bg-slate-100 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 w-full focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                সব ক্যাটাগরি ({effects.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('animation')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 flex items-center space-x-1 ${
                  activeTab === 'animation' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Animations ({countByType('animation')})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('transition')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 flex items-center space-x-1 ${
                  activeTab === 'transition' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Transitions ({countByType('transition')})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('3d_motion')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 flex items-center space-x-1 ${
                  activeTab === '3d_motion' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Motions ({countByType('3d_motion')})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cinematic')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 flex items-center space-x-1 ${
                  activeTab === 'cinematic' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cinematic ({countByType('cinematic')})</span>
              </button>
            </div>

            {/* List Display Grid - Expanded so all items are easily viewed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] sm:max-h-[520px] overflow-y-auto p-1 pr-2 scrollbar-thin">
              {filteredEffects.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2">
                  <Film className="w-8 h-8 text-slate-400" />
                  <span>কোনো ইফেক্ট পাওয়া যায়নি। ফিল্টার পরিবর্তন করুন অথবা নিচের ক্যাটালগ সিঙ্ক বাটনে চাপুন।</span>
                  <button
                    type="button"
                    onClick={() => {
                      const refreshed = MotionFxStudioService.resetToDefaultCatalog();
                      setEffects(refreshed);
                      onEffectsUpdated();
                    }}
                    className="mt-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-xs hover:bg-indigo-700 cursor-pointer"
                  >
                    ডিফল্ট ইফেক্টসমূহ রিলোড করুন
                  </button>
                </div>
              ) : (
                filteredEffects.map((fx, idx) => (
                  <div key={fx.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs hover:border-indigo-400 hover:shadow-xs transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                          <span className="font-extrabold text-xs text-slate-900 truncate block" title={fx.name}>{fx.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] text-indigo-700 font-mono uppercase bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-semibold">
                            {fx.type}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                            fx.variant === 'original'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : fx.variant === 'reverse'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {fx.variant}
                          </span>
                          <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-mono">
                            ✓ Verified
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(fx.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded cursor-pointer transition-colors shrink-0"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-slate-950 text-emerald-400 font-mono text-[10px] p-2.5 rounded-lg max-h-24 overflow-y-auto leading-relaxed border border-slate-800 select-all">
                      {fx.code}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-600 hidden sm:inline">
              ✨ সমস্ত কোড এবং Original, Normal ও Reverse ভার্সনগুলো র্যান্ডমভাবে ভিডিও তৈরিতে প্রয়োগ করা হচ্ছে।
            </span>
            <button
              type="button"
              onClick={() => {
                const refreshed = MotionFxStudioService.resetToDefaultCatalog();
                setEffects(refreshed);
                onEffectsUpdated();
                setTestResult({ status: 'success', message: 'ক্যাটালগ সফলভাবে রিফ্রেশ ও কোনো ডুপ্লিকেট ছাড়া সিঙ্ক করা হয়েছে!' });
              }}
              className="text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              title="ডিফল্ট ক্যাটালগ রিলোড ও সিঙ্ক করুন"
            >
              🔄 ক্যাটালগ সিঙ্ক করুন
            </button>
          </div>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            সম্পন্ন (Done)
          </button>
        </div>
      </div>
    </div>
  );
};
