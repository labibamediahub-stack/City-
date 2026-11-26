/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Tv,
  Check,
  Trash2,
  Edit2,
  Plus,
  Repeat,
  Eye,
  EyeOff,
  Film,
  Sparkles,
  Layers,
  ListPlus
} from 'lucide-react';
import { ChannelSettings, ChannelStyleId, CHANNEL_STYLES } from '../types/timeline';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChannelSettings;
  onSaveSettings: (newSettings: ChannelSettings) => void;
  savedChannels: string[];
  onUpdateSavedChannels: (channels: string[]) => void;
  savedDramas: string[];
  onUpdateSavedDramas: (dramas: string[]) => void;
  activeDramaName: string;
  onSelectDrama: (dramaName: string) => void;
  initialTab?: 'channels' | 'dramas';
  onQuickAddDrama?: (title: string, episode?: string) => void;
  onOpenSeriesScheduleModal?: () => void;
  todaysSeriesCount?: number;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  savedChannels,
  onUpdateSavedChannels,
  savedDramas,
  onUpdateSavedDramas,
  activeDramaName,
  onSelectDrama,
  initialTab = 'channels',
  onQuickAddDrama,
  onOpenSeriesScheduleModal,
  todaysSeriesCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'dramas'>(initialTab);

  // Channel input & edit states
  const [newChannelInput, setNewChannelInput] = useState<string>('');
  const [editingChannelIndex, setEditingChannelIndex] = useState<number | null>(null);
  const [editingChannelValue, setEditingChannelValue] = useState<string>('');

  // Quick Add Series & Drama states
  const [isQuickAddSeriesOpen, setIsQuickAddSeriesOpen] = useState<boolean>(false);
  const [quickSeriesTitle, setQuickSeriesTitle] = useState<string>('');
  const [quickSeriesEpisode, setQuickSeriesEpisode] = useState<string>('1');

  // Drama input & edit states
  const [newDramaInput, setNewDramaInput] = useState<string>('');
  const [editingDramaIndex, setEditingDramaIndex] = useState<number | null>(null);
  const [editingDramaValue, setEditingDramaValue] = useState<string>('');

  // Style & Watermark states
  const [selectedStyle, setSelectedStyle] = useState<ChannelStyleId>(settings.styleId || 'cinematic_gold');
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(settings.watermarkEnabled ?? true);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(
    settings.watermarkOpacity !== undefined ? Math.round(settings.watermarkOpacity * 100) : 40
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    setSelectedStyle(settings.styleId || 'cinematic_gold');
    setWatermarkEnabled(settings.watermarkEnabled ?? true);
    setWatermarkOpacity(
      settings.watermarkOpacity !== undefined ? Math.round(settings.watermarkOpacity * 100) : 40
    );
  }, [settings.styleId, settings.watermarkEnabled, settings.watermarkOpacity]);

  if (!isOpen) return null;

  // Add one or multiple channels (comma or newline separated)
  const handleAddChannels = () => {
    if (!newChannelInput.trim()) return;
    const parts = newChannelInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (parts.length === 0) return;

    // Filter duplicates preserving order
    const nextList = [...savedChannels];
    let firstAdded = '';
    for (const p of parts) {
      if (!nextList.includes(p)) {
        nextList.push(p);
        if (!firstAdded) firstAdded = p;
      }
    }

    onUpdateSavedChannels(nextList);
    // If no active channel was set, make the newly added one active
    if (!settings.name && firstAdded) {
      onSaveSettings({ ...settings, name: firstAdded });
    }
    setNewChannelInput('');
  };

  // Edit existing channel
  const handleStartEditChannel = (index: number, currentVal: string) => {
    setEditingChannelIndex(index);
    setEditingChannelValue(currentVal);
  };

  const handleSaveEditChannel = (index: number) => {
    const trimmed = editingChannelValue.trim();
    if (!trimmed) return;
    const oldName = savedChannels[index];
    const nextList = [...savedChannels];
    nextList[index] = trimmed;
    onUpdateSavedChannels(nextList);

    // If active channel was renamed, sync with settings
    if (settings.name === oldName) {
      onSaveSettings({ ...settings, name: trimmed });
    }
    setEditingChannelIndex(null);
    setEditingChannelValue('');
  };

  // Delete channel
  const handleDeleteChannel = (index: number) => {
    const targetName = savedChannels[index];
    const nextList = savedChannels.filter((_, i) => i !== index);
    onUpdateSavedChannels(nextList);

    if (settings.name === targetName) {
      const nextActive = nextList.length > 0 ? nextList[0] : '';
      onSaveSettings({ ...settings, name: nextActive });
    }
    if (editingChannelIndex === index) {
      setEditingChannelIndex(null);
    }
  };

  // Select active channel
  const handleSelectActiveChannel = (channelName: string) => {
    onSaveSettings({
      ...settings,
      name: channelName,
      styleId: selectedStyle,
      watermarkEnabled,
      watermarkOpacity: watermarkOpacity / 100
    });
  };

  // Add one or multiple dramas (comma or newline separated)
  const handleAddDramas = () => {
    if (!newDramaInput.trim()) return;
    const parts = newDramaInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (parts.length === 0) return;

    const nextList = [...savedDramas];
    let firstAdded = '';
    for (const p of parts) {
      if (!nextList.includes(p)) {
        nextList.push(p);
        if (!firstAdded) firstAdded = p;
      }
    }

    onUpdateSavedDramas(nextList);
    if (!activeDramaName && firstAdded) {
      onSelectDrama(firstAdded);
    }
    setNewDramaInput('');
  };

  // Edit existing drama
  const handleStartEditDrama = (index: number, currentVal: string) => {
    setEditingDramaIndex(index);
    setEditingDramaValue(currentVal);
  };

  const handleSaveEditDrama = (index: number) => {
    const trimmed = editingDramaValue.trim();
    if (!trimmed) return;
    const oldTitle = savedDramas[index];
    const nextList = [...savedDramas];
    nextList[index] = trimmed;
    onUpdateSavedDramas(nextList);

    if (activeDramaName === oldTitle) {
      onSelectDrama(trimmed);
    }
    setEditingDramaIndex(null);
    setEditingDramaValue('');
  };

  // Delete drama
  const handleDeleteDrama = (index: number) => {
    const targetTitle = savedDramas[index];
    const nextList = savedDramas.filter((_, i) => i !== index);
    onUpdateSavedDramas(nextList);

    if (activeDramaName === targetTitle) {
      const nextActive = nextList.length > 0 ? nextList[0] : '';
      onSelectDrama(nextActive);
    }
    if (editingDramaIndex === index) {
      setEditingDramaIndex(null);
    }
  };

  // Style change
  const handleStyleChange = (styleId: ChannelStyleId) => {
    setSelectedStyle(styleId);
    onSaveSettings({
      ...settings,
      styleId,
      watermarkEnabled,
      watermarkOpacity: watermarkOpacity / 100
    });
  };

  // Watermark toggle
  const handleWatermarkToggle = (enabled: boolean) => {
    setWatermarkEnabled(enabled);
    onSaveSettings({
      ...settings,
      styleId: selectedStyle,
      watermarkEnabled: enabled,
      watermarkOpacity: watermarkOpacity / 100
    });
  };

  // Opacity change
  const handleOpacityChange = (val: number) => {
    setWatermarkOpacity(val);
    onSaveSettings({
      ...settings,
      styleId: selectedStyle,
      watermarkEnabled,
      watermarkOpacity: val / 100
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#0f172a] border border-slate-700 rounded-none shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="bg-[#0b1120] px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
            <h3 className="font-bold text-sm text-white">Settings</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-none hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`h-10 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-r border-slate-800 rounded-none ${
              activeTab === 'channels'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Channels ({savedChannels.filter((c) => c && c.trim().length > 0).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dramas')}
            className={`h-10 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer rounded-none ${
              activeTab === 'dramas'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Dramas ({savedDramas.length})</span>
          </button>
        </div>

        {/* Quick Drama & Schedule Actions */}
        {(onQuickAddDrama || onOpenSeriesScheduleModal) && (
          <div className="bg-slate-900/70 px-3.5 py-2.5 border-b border-slate-800 flex flex-col gap-2 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              {onQuickAddDrama && (
                <button
                  type="button"
                  onClick={() => setIsQuickAddSeriesOpen((v) => !v)}
                  className="h-9 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-none flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Drama</span>
                </button>
              )}
              {onOpenSeriesScheduleModal && (
                <button
                  type="button"
                  onClick={onOpenSeriesScheduleModal}
                  className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold rounded-none flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Schedule{todaysSeriesCount > 0 ? ` (${todaysSeriesCount})` : ''}</span>
                </button>
              )}
            </div>

            {isQuickAddSeriesOpen && onQuickAddDrama && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-none p-2">
                <input
                  type="text"
                  value={quickSeriesTitle}
                  onChange={(e) => setQuickSeriesTitle(e.target.value)}
                  placeholder="Drama title"
                  className="flex-1 min-w-[140px] h-8 px-2.5 text-xs bg-slate-900 border border-slate-700 rounded-none focus:outline-none focus:border-indigo-500 text-white"
                />
                <input
                  type="text"
                  value={quickSeriesEpisode}
                  onChange={(e) => setQuickSeriesEpisode(e.target.value)}
                  placeholder="Ep"
                  className="w-20 h-8 px-2 text-xs bg-slate-900 border border-slate-700 rounded-none focus:outline-none focus:border-indigo-500 text-white"
                />
                <button
                  type="button"
                  disabled={!quickSeriesTitle.trim()}
                  onClick={() => {
                    if (!quickSeriesTitle.trim()) return;
                    onQuickAddDrama(quickSeriesTitle, quickSeriesEpisode);
                    setQuickSeriesTitle('');
                    setQuickSeriesEpisode('1');
                    setIsQuickAddSeriesOpen(false);
                  }}
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-none cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickAddSeriesOpen(false)}
                  className="h-8 px-2 bg-slate-800 text-slate-300 hover:text-white rounded-none cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-800">
          {activeTab === 'channels' && (
            <>
              {/* Add Channel */}
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4 text-indigo-400" />
                    <span>Channel Name</span>
                  </span>
                  {settings.name ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-400 truncate max-w-[160px]">
                        {settings.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectActiveChannel('')}
                        className="text-[11px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">None</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newChannelInput}
                    onChange={(e) => setNewChannelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChannels();
                      }
                    }}
                    placeholder="Channel name..."
                    className="flex-1 h-9 px-3 text-xs rounded-none border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddChannels}
                    disabled={!newChannelInput.trim()}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-none flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Saved Channels */}
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex flex-col divide-y divide-slate-800 border border-slate-800 max-h-48 overflow-y-auto bg-slate-950">
                  <div
                    className={`flex items-center justify-between px-3 py-2 ${
                      !settings.name ? 'bg-indigo-950/60' : 'hover:bg-slate-900'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectActiveChannel('')}
                      className="flex items-center gap-2 flex-1 text-left cursor-pointer"
                    >
                      <span
                        className={`w-4 h-4 rounded-none border flex items-center justify-center shrink-0 ${
                          !settings.name
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {!settings.name && <Check className="w-3 h-3" />}
                      </span>
                      <span className="text-xs font-semibold text-slate-300">None (No Watermark)</span>
                    </button>
                  </div>

                  {savedChannels.map((ch, idx) => {
                    if (!ch || !ch.trim()) return null;
                    const isActive = settings.name === ch;
                    const isEditingThis = editingChannelIndex === idx;

                    return (
                      <div
                        key={`ch-${idx}`}
                        className={`flex items-center justify-between px-3 py-2 gap-2 ${
                          isActive ? 'bg-indigo-950/60' : 'hover:bg-slate-900'
                        }`}
                      >
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editingChannelValue}
                              onChange={(e) => setEditingChannelValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditChannel(idx);
                                if (e.key === 'Escape') setEditingChannelIndex(null);
                              }}
                              autoFocus
                              className="flex-1 h-8 px-2 text-xs border border-indigo-500 rounded-none bg-slate-900 text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditChannel(idx)}
                              className="h-8 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChannelIndex(null)}
                              className="h-8 px-2 bg-slate-800 text-slate-300 rounded-none cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSelectActiveChannel(ch)}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                            >
                              <span
                                className={`w-4 h-4 rounded-none border flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'border-slate-600'
                                }`}
                              >
                                {isActive && <Check className="w-3 h-3" />}
                              </span>
                              <span className={`text-xs truncate ${isActive ? 'text-white font-bold' : 'text-slate-300'}`}>
                                {ch}
                              </span>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditChannel(idx, ch)}
                                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-none cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChannel(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-none cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Watermark Styles */}
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Watermark Style</span>
                  </span>
                  <span className="text-[11px] text-indigo-300 font-mono">
                    {CHANNEL_STYLES.find((s) => s.id === selectedStyle)?.name || selectedStyle}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                  {CHANNEL_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleStyleChange(st.id)}
                      className={`px-2.5 py-2 rounded-none text-left border text-xs transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                        selectedStyle === st.id
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="font-bold text-[11px] truncate">{st.name}</span>
                      {selectedStyle === st.id && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Floating Watermark Toggle & Opacity */}
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Floating Watermark</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleWatermarkToggle(!watermarkEnabled)}
                    className={`h-8 px-3 rounded-none border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      watermarkEnabled
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {watermarkEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{watermarkEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                <div className={`flex items-center gap-3 ${watermarkEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <span className="text-xs font-semibold text-slate-400 shrink-0">Opacity:</span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={watermarkOpacity}
                    disabled={!watermarkEnabled}
                    onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10))}
                    className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-none cursor-pointer"
                  />
                  <span className="font-mono tabular-nums font-bold text-indigo-300 text-xs w-10 text-right">
                    {watermarkOpacity}%
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'dramas' && (
            <>
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-indigo-400" />
                    <span>Drama Title</span>
                  </span>
                  {activeDramaName && (
                    <span className="text-[11px] font-bold text-indigo-300 truncate max-w-[180px]">
                      {activeDramaName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDramaInput}
                    onChange={(e) => setNewDramaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDramas();
                      }
                    }}
                    placeholder="Drama title..."
                    className="flex-1 h-9 px-3 text-xs rounded-none border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddDramas}
                    disabled={!newDramaInput.trim()}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-none flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5">
                {savedDramas.length === 0 ? (
                  <div className="p-4 text-center border border-slate-800 rounded-none text-xs text-slate-400 bg-slate-950">
                    No dramas added
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-slate-800 border border-slate-800 max-h-72 overflow-y-auto bg-slate-950">
                    {savedDramas.map((dr, idx) => {
                      const isActive = activeDramaName === dr;
                      const isEditingThis = editingDramaIndex === idx;

                      return (
                        <div
                          key={`dr-${idx}`}
                          className={`flex items-center justify-between px-3 py-2 gap-2 ${
                            isActive ? 'bg-indigo-950/60' : 'hover:bg-slate-900'
                          }`}
                        >
                          {isEditingThis ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingDramaValue}
                                onChange={(e) => setEditingDramaValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditDrama(idx);
                                  if (e.key === 'Escape') setEditingDramaIndex(null);
                                }}
                                autoFocus
                                className="flex-1 h-8 px-2 text-xs border border-indigo-500 rounded-none bg-slate-900 text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditDrama(idx)}
                                className="h-8 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDramaIndex(null)}
                                className="h-8 px-2 bg-slate-800 text-slate-300 rounded-none cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onSelectDrama(dr)}
                                className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                              >
                                <span
                                  className={`w-4 h-4 rounded-none border flex items-center justify-center shrink-0 ${
                                    isActive
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'border-slate-600'
                                  }`}
                                >
                                  {isActive && <Check className="w-3 h-3" />}
                                </span>
                                <span className={`text-xs truncate ${isActive ? 'text-white font-bold' : 'text-slate-300'}`}>
                                  {dr}
                                </span>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDrama(idx, dr)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-none cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDrama(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-none cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0b1120] px-4 py-2.5 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-none transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
