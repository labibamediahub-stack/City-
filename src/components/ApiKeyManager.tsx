/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Edit2,
  Save,
  Check,
  X,
  Eye,
  EyeOff,
  Clipboard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Sparkles
} from 'lucide-react';

export const USER_GEMINI_API_KEY_STORAGE = 'user_gemini_api_key';
export const USER_GEMINI_API_KEYS_LIST_STORAGE = 'gemini_api_keys_list';

// Default seed key provided by user
export const SEED_GEMINI_API_KEY = 'AQ.Ab8RN6KFZN-6-FSYzhGltlD_XCIu8YmyRr8JtYStTGxnQLNYYw';

export interface ApiKeyItem {
  id: string;
  key: string;
  status: 'active' | 'standby' | 'exhausted' | 'untested' | 'quota_exhausted' | 'rate_limited' | 'invalid';
  message?: string;
  addedAt?: number;
  usageCount?: number;
  successCount?: number;
  errorCount?: number;
  lastError?: string;
}

export interface ApiKeyManagerProps {
  onKeysChanged?: (keys: string[]) => void;
  compact?: boolean;
}

export function ApiKeyManager({ onKeysChanged, compact = false }: ApiKeyManagerProps) {
  const [keysList, setKeysList] = useState<ApiKeyItem[]>([]);
  const [newKeyInput, setNewKeyInput] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ existingIndex: number; keyPreview: string } | null>(null);
  const [isValidatingOnAdd, setIsValidatingOnAdd] = useState<boolean>(false);
  const [isTestingAll, setIsTestingAll] = useState<boolean>(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number>(0);
  const [unverifiedKeyPending, setUnverifiedKeyPending] = useState<string | null>(null);

  // Initialize and load keys from localStorage AND server
  useEffect(() => {
    loadAllKeys();
  }, []);

  const loadAllKeys = async () => {
    try {
      // 1. Check localStorage first
      const storedLocalRaw = localStorage.getItem(USER_GEMINI_API_KEY_STORAGE) || '';
      let initialKeys: string[] = storedLocalRaw
        .split(/[,\n]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 5);

      // 2. Fetch from server (including per-key live telemetry)
      let telemetryByIndex: Record<number, any> = {};
      try {
        const res = await fetch('/api/keys');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.keys) && data.keys.length > 0) {
            initialKeys = Array.from(new Set([...initialKeys, ...data.keys]));
          }
          if (typeof data.activeKeyIndex === 'number') {
            setActiveKeyIndex(data.activeKeyIndex);
          }
          if (Array.isArray(data.telemetry)) {
            data.telemetry.forEach((t: any) => {
              telemetryByIndex[t.index] = t;
            });
          }
        }
      } catch (_) {}

      // If still empty, seed with user's provided key
      if (initialKeys.length === 0) {
        initialKeys = [SEED_GEMINI_API_KEY];
      }

      const items: ApiKeyItem[] = initialKeys.map((k, idx) => {
        const tel = telemetryByIndex[idx];
        return {
          id: `key_${idx}_${k.slice(-6)}`,
          key: k,
          status: tel?.status || (idx === 0 ? 'active' : 'standby'),
          usageCount: tel?.usageCount ?? 0,
          successCount: tel?.successCount ?? 0,
          errorCount: tel?.errorCount ?? 0,
          lastError: tel?.lastError || '',
        };
      });

      setKeysList(items);
      saveKeysPersistently(items, false);
    } catch (e) {
      console.warn('Error loading keys:', e);
    }
  };

  const saveKeysPersistently = async (items: ApiKeyItem[], notifyParent = true) => {
    const rawKeys = items.map((i) => i.key.trim()).filter((k) => k.length > 5);
    const joined = rawKeys.join('\n');

    // 1. Save to localStorage
    if (rawKeys.length > 0) {
      localStorage.setItem(USER_GEMINI_API_KEY_STORAGE, joined);
      localStorage.setItem(USER_GEMINI_API_KEYS_LIST_STORAGE, JSON.stringify(items));
    } else {
      localStorage.removeItem(USER_GEMINI_API_KEY_STORAGE);
      localStorage.removeItem(USER_GEMINI_API_KEYS_LIST_STORAGE);
    }

    // 2. Save to server for cross-device / remix persistence
    try {
      await fetch('/api/keys/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: rawKeys }),
      });
    } catch (_) {}

    if (notifyParent) {
      onKeysChanged?.(rawKeys);
    }
  };

  /**
   * Professional Validation & Duplicate Checking Before Adding
   */
  const handleAddKey = async () => {
    const rawInput = newKeyInput.trim();
    setDuplicateWarning(null);

    // 1. Basic format & emptiness check
    if (!rawInput) {
      setStatusMessage({
        type: 'error',
        text: 'Enter a Gemini API Key.'
      });
      return;
    }

    const cleanedKey = rawInput.replace(/["'`\s]/g, '');

    if (cleanedKey.length < 15) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid API Key length.'
      });
      return;
    }

    if (!/^[A-Za-z0-9_\-\.]+$/.test(cleanedKey)) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid characters in API Key.'
      });
      return;
    }

    const existingIndex = keysList.findIndex(
      (item) => item.key.trim().toLowerCase() === cleanedKey.toLowerCase()
    );

    if (existingIndex !== -1) {
      const serialNum = existingIndex + 1;
      setDuplicateWarning({
        existingIndex: serialNum,
        keyPreview: `${cleanedKey.slice(0, 8)}...${cleanedKey.slice(-6)}`,
      });
      setStatusMessage({
        type: 'warning',
        text: `Duplicate key already saved at #${serialNum}.`
      });
      return;
    }

    setIsValidatingOnAdd(true);
    setStatusMessage({
      type: 'info',
      text: 'Verifying key...'
    });

    let finalStatus: 'active' | 'standby' | 'exhausted' = keysList.length === 0 ? 'active' : 'standby';
    let finalNote = 'Saved';
    let resultMessage = `API Key saved at #${keysList.length + 1}.`;

    try {
      const fetchPromise = fetch('/api/key/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanedKey }),
      });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3500));
      const res = (await Promise.race([fetchPromise, timeoutPromise])) as Response;

      const data = await res.json().catch(() => null);

      if (data?.status === 'invalid' && !data?.success) {
        setUnverifiedKeyPending(cleanedKey);
        setStatusMessage({
          type: 'warning',
          text: `Verification failed (${data?.error || '401 Unauthorized'}).`
        });
        setIsValidatingOnAdd(false);
        return;
      }

      if (data?.status === 'exhausted') {
        finalStatus = 'exhausted';
        finalNote = 'Quota Exhausted';
        resultMessage = `Saved at #${keysList.length + 1} (Quota Exhausted).`;
      } else if (data?.status === 'active') {
        finalStatus = keysList.length === 0 ? 'active' : 'standby';
        finalNote = 'Verified';
        resultMessage = `Verified & saved at #${keysList.length + 1}.`;
      } else {
        finalStatus = keysList.length === 0 ? 'active' : 'standby';
        finalNote = 'Standby';
      }
    } catch (err: any) {
      console.warn('Probe note:', err);
      finalStatus = keysList.length === 0 ? 'active' : 'standby';
      finalNote = 'Standby';
    } finally {
      setIsValidatingOnAdd(false);
    }

    const newItem: ApiKeyItem = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      key: cleanedKey,
      status: finalStatus,
      message: finalNote,
      addedAt: Date.now(),
    };

    const updated = [...keysList, newItem];
    setKeysList(updated);
    setNewKeyInput('');
    setDuplicateWarning(null);
    saveKeysPersistently(updated, true);

    setStatusMessage({
      type: finalStatus === 'exhausted' ? 'warning' : 'success',
      text: resultMessage,
    });
  };

  const handleForceAddKey = (keyToForce: string) => {
    const cleaned = keyToForce.trim().replace(/["'`\s]/g, '');
    if (!cleaned) return;

    const newItem: ApiKeyItem = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      key: cleaned,
      status: 'standby',
      message: 'Standby',
      addedAt: Date.now(),
    };

    const updated = [...keysList, newItem];
    setKeysList(updated);
    setNewKeyInput('');
    setUnverifiedKeyPending(null);
    setDuplicateWarning(null);
    saveKeysPersistently(updated, true);

    setStatusMessage({
      type: 'success',
      text: `API Key saved at #${updated.length}.`,
    });
  };

  const handleDeleteKey = (id: string, index: number) => {
    const keyToDelete = keysList.find((k) => k.id === id);
    if (!keyToDelete) return;

    const updated = keysList.filter((item) => item.id !== id);
    setKeysList(updated);
    setDuplicateWarning(null);
    saveKeysPersistently(updated, true);
    setStatusMessage({
      type: 'info',
      text: `Removed key #${index + 1}.`,
    });
  };

  const handleStartEdit = (item: ApiKeyItem) => {
    setEditingId(item.id);
    setEditingValue(item.key);
    setDuplicateWarning(null);
  };

  const handleSaveEdit = async (id: string, index: number) => {
    const rawVal = editingValue.trim().replace(/["'`\s]/g, '');
    if (!rawVal || rawVal.length < 15) {
      setStatusMessage({ type: 'error', text: 'API Key must be at least 15 characters.' });
      return;
    }

    const duplicateIndex = keysList.findIndex(
      (item) => item.id !== id && item.key.trim().toLowerCase() === rawVal.toLowerCase()
    );

    if (duplicateIndex !== -1) {
      const serialNum = duplicateIndex + 1;
      setDuplicateWarning({
        existingIndex: serialNum,
        keyPreview: `${rawVal.slice(0, 8)}...${rawVal.slice(-6)}`,
      });
      setStatusMessage({
        type: 'warning',
        text: `Duplicate key already saved at #${serialNum}.`
      });
      return;
    }

    const updated = keysList.map((item) => (item.id === id ? { ...item, key: rawVal, message: 'Updated' } : item));
    setKeysList(updated);
    setEditingId(null);
    setDuplicateWarning(null);
    saveKeysPersistently(updated, true);
    setStatusMessage({ type: 'success', text: `Updated key #${index + 1}.` });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
    setDuplicateWarning(null);
  };

  const handleTestSingleKey = async (item: ApiKeyItem, index: number) => {
    setTestingKeyId(item.id);
    setStatusMessage(null);
    try {
      const fetchPromise = fetch('/api/key/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: item.key }),
      });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3500));
      const res = (await Promise.race([fetchPromise, timeoutPromise])) as Response;

      const data = await res.json().catch(() => null);

      if (data?.status === 'exhausted') {
        setKeysList((prev) =>
          prev.map((k) => (k.id === item.id ? { ...k, status: 'exhausted', message: 'Quota Exhausted' } : k))
        );
        setStatusMessage({
          type: 'warning',
          text: `Key #${index + 1}: Quota exhausted (429).`,
        });
      } else if (data?.success) {
        setKeysList((prev) =>
          prev.map((k) => (k.id === item.id ? { ...k, status: 'active', message: 'Active' } : k))
        );
        setStatusMessage({
          type: 'success',
          text: `Key #${index + 1}: Active.`,
        });
      } else {
        setKeysList((prev) =>
          prev.map((k) => (k.id === item.id ? { ...k, status: 'exhausted', message: data?.error || 'Error' } : k))
        );
        setStatusMessage({
          type: 'error',
          text: `Key #${index + 1}: ${data?.error || 'Invalid / Limit reached'}`,
        });
      }
    } catch (err: any) {
      setKeysList((prev) =>
        prev.map((k) => (k.id === item.id ? { ...k, status: 'standby', message: 'Standby' } : k))
      );
      setStatusMessage({
        type: 'info',
        text: `Key #${index + 1}: Standby.`,
      });
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleTestAllKeys = async () => {
    if (keysList.length === 0) return;
    setIsTestingAll(true);
    setStatusMessage({ type: 'info', text: 'Testing all keys...' });

    let activeCount = 0;
    const updated = [...keysList];

    for (let i = 0; i < updated.length; i++) {
      try {
        const res = await fetch('/api/key/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: updated[i].key }),
        });
        const data = await res.json();
        if (data?.success) {
          updated[i] = { ...updated[i], status: 'active', message: 'Active' };
          activeCount++;
        } else {
          updated[i] = { ...updated[i], status: 'exhausted', message: data?.error || 'Failed' };
        }
      } catch (_) {
        updated[i] = { ...updated[i], status: 'exhausted', message: 'Server Error' };
      }
    }

    setKeysList(updated);
    setIsTestingAll(false);
    setStatusMessage({
      type: 'success',
      text: `${activeCount}/${updated.length} keys active.`,
    });
  };

  const handlePasteClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setNewKeyInput(clipText.trim());
        setStatusMessage({ type: 'info', text: 'Pasted from clipboard.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Clipboard permission denied.' });
    }
  };

  const toggleShowKey = (id: string) => {
    setShowKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-[#0f172a] text-slate-100 flex flex-col divide-y divide-slate-800 rounded-none">
      {/* Header */}
      <div className="px-3.5 py-3 pr-12 bg-[#0b1120] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Key className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="text-sm font-bold text-white truncate">Gemini API Keys</h3>
          <span className="text-xs font-mono tabular-nums text-cyan-300 shrink-0">
            ({keysList.length})
          </span>
        </div>

        {keysList.length > 0 && (
          <button
            type="button"
            onClick={handleTestAllKeys}
            disabled={isTestingAll}
            className="h-8 px-3 rounded-none bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingAll ? 'animate-spin' : ''}`} />
            <span>Test All</span>
          </button>
        )}
      </div>

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <div className="px-3.5 py-2.5 bg-amber-950/70 text-amber-200 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate font-semibold">
              Duplicate key ({duplicateWarning.keyPreview}) at #{duplicateWarning.existingIndex}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDuplicateWarning(null)}
            className="p-1 text-amber-300 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add New Key Row */}
      <div className="p-3 sm:p-3.5 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newKeyInput}
            onChange={(e) => {
              setNewKeyInput(e.target.value);
              if (duplicateWarning) setDuplicateWarning(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isValidatingOnAdd) handleAddKey();
            }}
            disabled={isValidatingOnAdd}
            placeholder="AIzaSy... / AQ..."
            className="flex-1 h-9 bg-slate-950 border border-slate-700 focus:border-indigo-400 text-white placeholder-slate-500 text-xs font-mono px-3 rounded-none focus:outline-none disabled:opacity-50"
          />
          <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 rounded-none transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Paste</span>
            </button>
            <button
              type="button"
              onClick={handleAddKey}
              disabled={isValidatingOnAdd}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold border border-indigo-500 rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isValidatingOnAdd ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Key</span>
                </>
              )}
            </button>
          </div>
        </div>

        {unverifiedKeyPending && (
          <div className="bg-amber-950/70 border border-amber-700 rounded-none p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Unauthorized (401). Save anyway?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleForceAddKey(unverifiedKeyPending)}
                className="h-8 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-none text-xs cursor-pointer"
              >
                Save Standby
              </button>
              <button
                type="button"
                onClick={() => setUnverifiedKeyPending(null)}
                className="h-8 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-none text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keys Table List */}
      <div className="p-3 sm:p-3.5 flex flex-col gap-2">
        {keysList.length === 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-none p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
            <Key className="w-5 h-5 text-slate-600" />
            <span>No API keys saved</span>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-800 border border-slate-800 max-h-72 overflow-y-auto bg-slate-950">
            {keysList.map((item, index) => {
              const isEditing = editingId === item.id;
              const isTesting = testingKeyId === item.id;
              const isCurrentlyActive = index === activeKeyIndex;

              return (
                <div
                  key={item.id}
                  className={`p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isCurrentlyActive ? 'bg-slate-900/90' : 'bg-slate-950'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-none font-mono font-bold tabular-nums flex items-center justify-center text-xs shrink-0 border ${
                        isCurrentlyActive
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {index + 1}
                    </div>

                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1 h-8 bg-slate-900 border border-indigo-400 text-white font-mono text-xs px-2.5 rounded-none focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id, index)}
                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none text-xs font-bold cursor-pointer"
                          title="Save"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-none text-xs cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-100 truncate">
                            {showKeyMap[item.id]
                              ? item.key
                              : `${item.key.slice(0, 10)}...${item.key.slice(-8)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleShowKey(item.id)}
                            className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
                            title={showKeyMap[item.id] ? 'Hide' : 'Show'}
                          >
                            {showKeyMap[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                          <span
                            className={`font-bold ${
                              isCurrentlyActive && item.status !== 'quota_exhausted' && item.status !== 'invalid'
                                ? 'text-emerald-400'
                                : item.status === 'exhausted' || item.status === 'quota_exhausted' || item.status === 'invalid'
                                ? 'text-rose-400'
                                : item.status === 'rate_limited'
                                ? 'text-amber-300'
                                : 'text-cyan-300'
                            }`}
                          >
                            {isCurrentlyActive && item.status !== 'quota_exhausted' && item.status !== 'invalid'
                              ? 'Active'
                              : item.status === 'exhausted' || item.status === 'quota_exhausted'
                              ? 'Exhausted'
                              : item.status === 'rate_limited'
                              ? 'Rate Limited'
                              : item.status === 'invalid'
                              ? 'Invalid'
                              : 'Standby'}
                          </span>
                          <span>·</span>
                          <span>Use: {item.usageCount ?? 0}</span>
                          <span>·</span>
                          <span>OK: {item.successCount ?? 0}</span>
                          {(item.errorCount ?? 0) > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-rose-400">Err: {item.errorCount}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTestSingleKey(item, index)}
                        disabled={isTesting}
                        className="h-8 px-2.5 rounded-none bg-emerald-950/70 border border-emerald-700 hover:bg-emerald-900 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        <span>Test</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="h-8 px-2.5 rounded-none bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(item.id, index)}
                        className="h-8 px-2.5 rounded-none bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`px-3.5 py-2.5 text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/70 text-emerald-300'
              : statusMessage.type === 'warning'
              ? 'bg-amber-950/70 text-amber-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/70 text-rose-300'
              : 'bg-slate-900 text-cyan-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : statusMessage.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          )}
          <span className="font-medium truncate">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
