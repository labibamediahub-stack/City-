/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Calendar,
  Plus,
  Check,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Tv,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { SeriesItem, WeekdayKey, NatokContentType } from '../types/timeline';
import {
  WEEKDAYS_BN,
  getTodayWeekdayKey,
  formatUploadDaysBn,
  getSeriesScheduledForDay
} from '../services/seriesScheduleManager';

interface SeriesScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  seriesList: SeriesItem[];
  activeSeriesId: string | null;
  onSaveSeriesList: (items: SeriesItem[]) => void;
  onSelectSeries: (series: SeriesItem) => void;
  dismissedTodayIds?: string[];
  onDismissTodaySeries?: (id: string) => void;
  onClearAllTodaySeries?: () => void;
  onRestoreTodaySeries?: () => void;
}

const CONTENT_TYPE_LABELS: Record<NatokContentType, string> = {
  review: 'Review',
  release_update: 'Release Update',
  episode_preview: 'Episode Preview',
  best_scene: 'Best Scene',
  ending_explained: 'Ending Explained'
};

export const SeriesScheduleModal: React.FC<SeriesScheduleModalProps> = ({
  isOpen,
  onClose,
  seriesList,
  activeSeriesId,
  onSaveSeriesList,
  onSelectSeries,
  dismissedTodayIds = [],
  onDismissTodaySeries,
  onClearAllTodaySeries,
  onRestoreTodaySeries
}) => {
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState<string>('');
  const [uploadDays, setUploadDays] = useState<WeekdayKey[]>(['sat']);
  const [currentEpisode, setCurrentEpisode] = useState<string>('Ep 5');
  const [actorNames, setActorNames] = useState<string>('');
  const [defaultContentType, setDefaultContentType] = useState<NatokContentType>('review');
  const [releaseTimeLabel, setReleaseTimeLabel] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const todayKey = getTodayWeekdayKey();
  const todayInfo = WEEKDAYS_BN.find((d) => d.key === todayKey);
  const allTodaysDramas = getSeriesScheduledForDay(seriesList, todayKey);
  const todaysDramas = allTodaysDramas.filter((item) => !dismissedTodayIds.includes(item.id));
  const dismissedTodayCount = allTodaysDramas.length - todaysDramas.length;

  const activeItems = seriesList.filter((s) => s.status === 'active');
  const archivedItems = seriesList.filter((s) => s.status === 'archived');
  const displayedItems = viewMode === 'active' ? activeItems : archivedItems;

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setUploadDays(['sat']);
    setCurrentEpisode('Ep 5');
    setActorNames('');
    setDefaultContentType('review');
    setReleaseTimeLabel('');
    setNotes('');
    setShowForm(false);
  };

  const handleStartAdd = () => {
    resetForm();
    setUploadDays([]);
    setShowForm(true);
  };

  const handleStartEdit = (item: SeriesItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setUploadDays(item.uploadDays || []);
    setCurrentEpisode(item.currentEpisode || 'New Ep');
    setActorNames(item.actorNames || '');
    setDefaultContentType(item.defaultContentType || 'review');
    setReleaseTimeLabel(item.releaseTimeLabel || '');
    setNotes(item.notes || '');
    setShowForm(true);
  };

  const toggleDay = (day: WeekdayKey) => {
    setUploadDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const validDays: WeekdayKey[] = uploadDays;
    const autoScheduleLabel =
      releaseTimeLabel.trim() || (validDays.length > 0 ? formatUploadDaysBn(validDays) : '');

    if (editingId) {
      const updated = seriesList.map((item) =>
        item.id === editingId
          ? {
              ...item,
              title: cleanTitle,
              uploadDays: validDays,
              currentEpisode: currentEpisode.trim() || 'New Ep',
              actorNames: actorNames.trim(),
              defaultContentType,
              releaseTimeLabel: autoScheduleLabel,
              notes: notes.trim()
            }
          : item
      );
      onSaveSeriesList(updated);
      if (editingId === activeSeriesId) {
        const updatedItem = updated.find((i) => i.id === editingId);
        if (updatedItem) onSelectSeries(updatedItem);
      }
    } else {
      const newItem: SeriesItem = {
        id: `series_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        uploadDays: validDays,
        releaseTimeLabel: autoScheduleLabel,
        currentEpisode: currentEpisode.trim() || 'New Ep',
        actorNames: actorNames.trim(),
        defaultContentType,
        status: 'active',
        notes: notes.trim(),
        createdAt: Date.now()
      };
      onSaveSeriesList([newItem, ...seriesList]);
      onSelectSeries(newItem);
    }
    resetForm();
  };

  const handleToggleArchive = (id: string) => {
    const updated = seriesList.map((item) =>
      item.id === id
        ? { ...item, status: item.status === 'active' ? ('archived' as const) : ('active' as const) }
        : item
    );
    onSaveSeriesList(updated);
  };

  const handleDelete = (id: string) => {
    const updated = seriesList.filter((item) => item.id !== id);
    onSaveSeriesList(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white border border-slate-300 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Compact Professional Header */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#0f172a] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              Schedule Manager
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Schedule Manager"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-50 flex-1">
          {/* Today's Scheduled Dramas (Compact) */}
          <div className="bg-white border border-indigo-200/80 rounded-lg p-2.5 sm:p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-slate-900 truncate">
                  Today ({todayInfo?.fullBn || 'Today'})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-semibold text-indigo-700">
                  {todaysDramas.length > 0
                    ? `${todaysDramas.length} Scheduled`
                    : dismissedTodayCount > 0
                      ? 'Cleared Today'
                      : 'None Today'}
                </span>
                {todaysDramas.length > 0 && onClearAllTodaySeries && (
                  <button
                    type="button"
                    onClick={onClearAllTodaySeries}
                    title="Clear all today notifications"
                    className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
                {dismissedTodayCount > 0 && onRestoreTodaySeries && (
                  <button
                    type="button"
                    onClick={onRestoreTodaySeries}
                    title="Restore cleared today notifications"
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore ({dismissedTodayCount})</span>
                  </button>
                )}
              </div>
            </div>

            {todaysDramas.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {todaysDramas.map((item) => {
                  const isActive = item.id === activeSeriesId;
                  return (
                    <div
                      key={item.id}
                      className={`px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 transition ${
                        isActive
                          ? 'bg-indigo-50 border-indigo-500'
                          : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">{item.title}</div>
                        <div className="text-[11px] text-slate-600 truncate">
                          {item.currentEpisode || 'New Ep'} · {CONTENT_TYPE_LABELS[item.defaultContentType]}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSeries(item);
                            onClose();
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                            isActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {isActive ? 'Selected' : 'Start'}
                        </button>
                        {onDismissTodaySeries && (
                          <button
                            type="button"
                            onClick={() => onDismissTodaySeries(item.id)}
                            title="Delete / Clear this notification for today"
                            aria-label="Delete today notification"
                            className="p-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Controls Bar: Active / Archived Tabs + Add New Series */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setViewMode('active')}
                className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                  viewMode === 'active'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active ({activeItems.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('archived')}
                className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                  viewMode === 'archived'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived ({archivedItems.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleStartAdd}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Series</span>
            </button>
          </div>

          {/* Add / Edit Series Form */}
          {showForm && (
            <form
              onSubmit={handleSubmitForm}
              className="bg-white border border-indigo-300 rounded-lg p-3 sm:p-3.5 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{editingId ? 'Edit Series' : 'Add Series'}</span>
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Drama Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="যেমন: ফিরে আসার গল্প"
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Episode
                  </label>
                  <input
                    type="text"
                    value={currentEpisode}
                    onChange={(e) => setCurrentEpisode(e.target.value)}
                    placeholder="Ep 12"
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Weekday multi-select chips (Bengali Day Names) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Upload Days
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {WEEKDAYS_BN.map((d) => {
                    const selected = uploadDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => toggleDay(d.key)}
                        className={`px-2 py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer text-center ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {d.fullBn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Content Type
                  </label>
                  <select
                    value={defaultContentType}
                    onChange={(e) => setDefaultContentType(e.target.value as NatokContentType)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="review">Review</option>
                    <option value="release_update">Release Update</option>
                    <option value="episode_preview">Episode Preview</option>
                    <option value="best_scene">Best Scene</option>
                    <option value="ending_explained">Ending Explained</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Cast (Optional)
                  </label>
                  <input
                    type="text"
                    value={actorNames}
                    onChange={(e) => setActorNames(e.target.value)}
                    placeholder="Cast names"
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Time / Schedule Label
                  </label>
                  <input
                    type="text"
                    value={releaseTimeLabel}
                    onChange={(e) => setReleaseTimeLabel(e.target.value)}
                    placeholder="যেমন: রাত ৮টা"
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note"
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Update' : 'Save'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Series List */}
          {displayedItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
              {viewMode === 'active'
                ? 'No active series yet. Click "Add Series" to create one.'
                : 'No archived series.'}
            </div>
          ) : (
            <div className="space-y-2">
              {displayedItems.map((item) => {
                const isSelected = item.id === activeSeriesId;
                const isToday = item.status === 'active' && item.uploadDays.includes(todayKey);
                const daysBn = formatUploadDaysBn(item.uploadDays);
                const showTimeLabel =
                  item.releaseTimeLabel &&
                  item.releaseTimeLabel.trim() !== daysBn &&
                  !daysBn.includes(item.releaseTimeLabel.trim());

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-lg px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500/25'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {item.title}
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Today
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] sm:text-xs text-slate-600 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="font-semibold text-indigo-700">{daysBn}</span>
                        {showTimeLabel && (
                          <>
                            <span>·</span>
                            <span className="text-slate-700 font-medium">{item.releaseTimeLabel}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{item.currentEpisode || 'New Ep'}</span>
                        <span>·</span>
                        <span>{CONTENT_TYPE_LABELS[item.defaultContentType]}</span>
                        {item.actorNames && (
                          <>
                            <span>·</span>
                            <span className="text-slate-500">{item.actorNames}</span>
                          </>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-slate-500 truncate">{item.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSeries(item);
                            onClose();
                          }}
                          className={`px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-bold cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer transition"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(item.id)}
                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md cursor-pointer transition"
                        title={item.status === 'active' ? 'Archive' : 'Restore'}
                      >
                        {item.status === 'active' ? (
                          <Archive className="w-3.5 h-3.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md cursor-pointer transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] sm:text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            {activeItems.length} Active · {archivedItems.length} Archived
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md font-bold cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
