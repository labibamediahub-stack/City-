/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X } from 'lucide-react';
import { ApiKeyManager } from './ApiKeyManager';

export const USER_GEMINI_API_KEY_STORAGE = 'user_gemini_api_key';

export interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysUpdated?: (activeKey: string) => void;
}

export function GeminiApiKeyModal({ isOpen, onClose, onKeysUpdated }: GeminiApiKeyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0f172a] border border-slate-700 rounded-none shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 z-10 p-1.5 rounded-none bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <ApiKeyManager
          onKeysChanged={(keys) => {
            onKeysUpdated?.(keys.join('\n'));
          }}
        />
      </div>
    </div>
  );
}
