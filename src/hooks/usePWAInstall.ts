import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__deferredPWAInstallPrompt) {
      return window.__deferredPWAInstallPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    const checkStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith('android-app://');

    setIsInstalled(checkStandalone());

    const ua = window.navigator.userAgent || '';
    const lowerUa = ua.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(lowerUa));
    setIsAndroid(/android/.test(lowerUa));
    setIsInAppBrowser(
      /fban|fbav|instagram|line\/|micromessenger|wv\b|telegram|snapchat/i.test(ua)
    );

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__deferredPWAInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      window.__deferredPWAInstallPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const mql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => setIsInstalled(checkStandalone());

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (mql.addEventListener) {
      mql.addEventListener('change', handleDisplayChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handleDisplayChange);
      }
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvt =
      deferredPrompt ||
      (typeof window !== 'undefined'
        ? (window.__deferredPWAInstallPrompt as BeforeInstallPromptEvent | null)
        : null);
    if (!promptEvt) return false;
    await promptEvt.prompt();
    const { outcome } = await promptEvt.userChoice;
    if (outcome === 'accepted') {
      window.__deferredPWAInstallPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isInAppBrowser,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
