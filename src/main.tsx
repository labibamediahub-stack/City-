import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __deferredPWAInstallPrompt?: Event | null;
  }
}

// Service Worker registration for offline support & native browser/Play Store TWA installability

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.warn('Service worker registration notice:', error);
    },
  });
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('vss_active_session_cache_v2');
    } catch (_) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-white">অ্যাপটি পুনরায় লোড করুন</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। ব্রাউজার রিফ্রেশ করুন অথবা সেশন ডাটা রিসেট করে শুরু করুন।
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                রিফ্রেশ করুন (Reload)
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                সেশন রিসেট করুন (Reset Session)
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

