import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  ShieldCheck,
  X,
  CheckCircle2,
  Copy,
  Check,
  WifiOff,
  ExternalLink
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInAppBrowser: boolean;
  onTriggerNativeInstall: () => Promise<boolean>;
}

const AndroidInstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isIOS,
  isAndroid,
  isInAppBrowser,
  onTriggerNativeInstall,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard fallback not needed
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Install Android App"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-indigo-100 p-5 shadow-2xl text-slate-900 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="CineCraft Studio"
              className="w-12 h-12 rounded-2xl shadow-sm border border-indigo-100 shrink-0"
            />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                CineCraft Studio Android App
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ডাইরেক্ট Android WebAPK ইনস্টলার
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google Play Protect & Android Privacy Verification */}
        <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 p-3.5 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <p className="font-bold">Play Protect & Android Privacy Verified</p>
            <p className="text-emerald-800 mt-0.5">
              কোনো অজানা APK বা রিস্ক ছাড়াই Chrome অফিসিয়াল WebAPK হিসেবে ইনস্টল হয় — ফোনের প্রাইভেসি স্ক্যান ও Play Protect সম্পূর্ণভাবে পাস করবে।
            </p>
          </div>
        </div>

        {isInstallable ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনার ডিভাইস ডাইরেক্ট ইনস্টলেশনের জন্য প্রস্তুত। নিচের বাটনে ট্যাপ করলেই মোবাইলের হোম স্ক্রিন ও অ্যাপ ড্রয়ারে CineCraft Studio অ্যাপটি ইনস্টল হয়ে যাবে।
            </p>
            <button
              type="button"
              onClick={async () => {
                const ok = await onTriggerNativeInstall();
                if (ok) onClose();
              }}
              className="w-full min-h-[46px] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>এখনই Android অ্যাপ ইনস্টল করুন</span>
            </button>
          </div>
        ) : isInAppBrowser ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
              আপনি এখন একটি ইন-অ্যাপ ব্রাউজার (যেমন Messenger / Telegram / Facebook) দিয়ে ওপেন করেছেন। সরাসরি Android অ্যাপ ইনস্টল করতে লিংকটি <strong>Google Chrome</strong>-এ ওপেন করুন।
            </div>
            <div className="text-xs text-slate-700 space-y-1.5 pl-1">
              <p>১. উপরের ডানদিকের <strong>⋮</strong> বা শেয়ার মেনু থেকে <strong>&ldquo;Open in Chrome&rdquo;</strong> চাপুন।</p>
              <p>২. Chrome ওপেন হলে <strong>Install App</strong> বাটনে ট্যাপ করুন।</p>
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="w-full min-h-[44px] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedUrl ? 'লিংক কপি হয়েছে — Chrome-এ পেস্ট করুন' : 'App লিংক কপি করুন (Chrome-এ ওপেন করতে)'}</span>
            </button>
          </div>
        ) : isIOS ? (
          <div className="mt-4 space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <p className="font-bold text-slate-900">iPhone / iPad-এ ইনস্টল করার নিয়ম:</p>
            <p>১. Safari ব্রাউজারের নিচে বা উপরে <strong>Share (↑)</strong> বাটনে ট্যাপ করুন।</p>
            <p>২. নিচে স্ক্রল করে <strong>&ldquo;Add to Home Screen&rdquo;</strong> সিলেক্ট করে <strong>Add</strong> চাপুন।</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3.5 text-xs text-slate-700 space-y-2 leading-relaxed">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>{isAndroid ? 'Android Chrome দিয়ে ইনস্টল করার ২ ধাপ:' : 'Chrome / Android-এ সরাসরি ইনস্টল করার নিয়ম:'}</span>
              </p>
              <p>১. ব্রাউজারের উপরের ডানদিকের <strong>⋮ (৩ ডট মেনু)</strong> ট্যাপ করুন।</p>
              <p>২. <strong>&ldquo;Install app&rdquo;</strong> অথবা <strong>&ldquo;Add to Home screen&rdquo;</strong> → <strong>Install</strong> সিলেক্ট করুন।</p>
              <p className="text-[11px] text-slate-500 pt-1">
                ইনস্টল হওয়ার পর এটি সাধারণ Android অ্যাপের মতো ফুল-স্ক্রিনে চলবে ও অফলাইন ক্যাশ সাপোর্ট করবে।
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="w-full min-h-[42px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ExternalLink className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'App লিংক কপি সম্পন্ন!' : 'Android Chrome-এ খুলতে লিংক কপি করুন'}</span>
            </button>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Standalone Fullscreen
          </span>
          <span>Offline Ready</span>
        </div>
      </div>
    </div>
  );
};

export const PWAHeaderInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInAppBrowser, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="hidden sm:flex h-9 sm:h-10 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-xs font-bold items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shrink-0"
        title="Install CineCraft Android App"
        aria-label="Install Android App"
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span className="hidden lg:inline whitespace-nowrap">Install App</span>
      </button>

      <AndroidInstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        isInstallable={isInstallable}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isInAppBrowser={isInAppBrowser}
        onTriggerNativeInstall={install}
      />
    </>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInAppBrowser, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Never show install prompt once installed as standalone Android WebAPK / iOS PWA
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setShowGuide(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <>
      <div className="w-full rounded-2xl bg-white border border-blue-200/90 px-3 py-2.5 shadow-[0_4px_16px_rgba(37,99,235,0.08)] flex items-center justify-between gap-2.5 sm:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/pwa-192x192.png"
            alt="CineCraft App"
            className="w-10 h-10 rounded-xl shadow-xs border border-indigo-100 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-900 truncate">
              CineCraft Android App
            </p>
            <p className="text-[10px] font-medium text-emerald-700 flex items-center gap-1 truncate">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              <span>Play Protect Safe · Direct Install</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="min-h-[38px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            aria-label="Dismiss Install Prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AndroidInstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        isInstallable={isInstallable}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isInAppBrowser={isInAppBrowser}
        onTriggerNativeInstall={install}
      />
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[70px] md:bottom-4 left-3 z-50 flex items-center gap-2 rounded-2xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg border border-amber-400"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — ক্যাশড অ্যাপ সক্রিয় আছে</span>
    </div>
  );
};
