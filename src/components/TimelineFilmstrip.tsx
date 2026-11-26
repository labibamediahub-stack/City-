/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Film,
  Sparkles,
  Layers,
  ArrowRight,
  Clock,
  Repeat,
  RefreshCw,
  X,
  Check,
  ChevronRight,
  Sliders,
  Image as ImageIcon
} from 'lucide-react';
import { TimelineSlot, TransitionType } from '../types/timeline';
import { ANIMATION_LIBRARY, TRANSITION_TYPES, getAnimationById, PHOTO_FRAME_STYLES } from '../services/animationLibrary';
import { GalleryItemInput } from '../services/smartTimelineEngine';

interface TimelineFilmstripProps {
  slots: TimelineSlot[];
  currentTime: number;
  gallery: GalleryItemInput[];
  onSelectTime: (time: number) => void;
  onUpdateSlotAnimation: (slotIndex: number, animId: string) => void;
  onUpdateSlotTransition: (slotIndex: number, transType: TransitionType) => void;
  onReplaceSlotImage: (slotIndex: number, newImage: GalleryItemInput) => void;
  onRemoveSlot: (slotIndex: number) => void;
  formatTime: (secs: number) => string;
}

export const TimelineFilmstrip: React.FC<TimelineFilmstripProps> = ({
  slots,
  currentTime,
  gallery,
  onSelectTime,
  onUpdateSlotAnimation,
  onUpdateSlotTransition,
  onReplaceSlotImage,
  onRemoveSlot,
  formatTime
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [replacingSlotIndex, setReplacingSlotIndex] = useState<number | null>(null);
  const [editingAnimSlotIndex, setEditingAnimSlotIndex] = useState<number | null>(null);
  const [editingTransSlotIndex, setEditingTransSlotIndex] = useState<number | null>(null);

  const ITEM_WIDTH = 74;
  const ITEM_GAP = 6;
  const ITEM_STEP = ITEM_WIDTH + ITEM_GAP;

  const [visibleWindow, setVisibleWindow] = useState<{ start: number; end: number }>({
    start: 0,
    end: 24,
  });
  const [replaceVisibleLimit, setReplaceVisibleLimit] = useState<number>(36);

  const itemsToRender = slots.length > 0 ? slots : gallery;

  const updateVisibleWindow = useCallback(() => {
    const container = containerRef.current;
    const total = itemsToRender.length;
    if (total === 0) {
      setVisibleWindow({ start: 0, end: 0 });
      return;
    }
    const scrollLeft = container?.scrollLeft ?? 0;
    const clientWidth = container?.clientWidth ?? 900;
    const firstVisible = Math.max(0, Math.floor(scrollLeft / ITEM_STEP) - 6);
    const visibleCount = Math.max(12, Math.ceil(clientWidth / ITEM_STEP) + 12);
    const lastVisible = Math.min(total, firstVisible + visibleCount);
    setVisibleWindow((prev) =>
      prev.start === firstVisible && prev.end === lastVisible
        ? prev
        : { start: firstVisible, end: lastVisible }
    );
  }, [itemsToRender.length, ITEM_STEP]);

  useEffect(() => {
    updateVisibleWindow();
    window.addEventListener('resize', updateVisibleWindow);
    return () => window.removeEventListener('resize', updateVisibleWindow);
  }, [updateVisibleWindow]);

  useEffect(() => {
    if (slots.length === 0) return;
    for (let i = 0; i < slots.length; i++) {
      if (currentTime >= slots[i].startTime && currentTime <= slots[i].endTime) {
        setActiveSlotIndex(i);
        break;
      }
    }
  }, [currentTime, slots]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || slots.length === 0) return;

    const elLeft = activeSlotIndex * ITEM_STEP;
    const containerWidth = container.clientWidth;
    const targetScrollLeft = Math.max(0, elLeft - containerWidth / 2 + ITEM_WIDTH / 2);

    container.scrollTo({
      left: targetScrollLeft,
      behavior: 'auto'
    });
    updateVisibleWindow();
  }, [activeSlotIndex, slots.length, ITEM_STEP, ITEM_WIDTH, updateVisibleWindow]);

  const safeStart = Math.max(0, Math.min(visibleWindow.start, itemsToRender.length));
  const safeEnd = Math.max(safeStart, Math.min(visibleWindow.end, itemsToRender.length));
  const leftSpacerWidth = safeStart * ITEM_STEP;
  const rightSpacerWidth = Math.max(0, (itemsToRender.length - safeEnd) * ITEM_STEP);
  const slicedItems = itemsToRender.slice(safeStart, safeEnd);

  return (
    <div className="bg-slate-950 border-t border-slate-800 px-2 py-1.5 flex items-center w-full overflow-hidden select-none">
      <div
        ref={containerRef}
        onScroll={updateVisibleWindow}
        className="w-full overflow-x-auto flex items-center scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950 py-0.5"
      >
        {leftSpacerWidth > 0 && (
          <div style={{ width: `${leftSpacerWidth}px` }} className="shrink-0 h-[42px]" aria-hidden="true" />
        )}
        {slicedItems.map((item, localIdx) => {
          const idx = safeStart + localIdx;
          const dataUrl = 'dataUrl' in item ? item.dataUrl : '';
          const startTime = 'startTime' in item ? item.startTime : 0;
          const isActive = slots.length > 0 ? idx === activeSlotIndex : false;

          return (
            <div
              key={'slotId' in item ? item.slotId : item.id || idx}
              onClick={() => {
                if ('startTime' in item) onSelectTime(startTime);
              }}
              className={`relative flex-shrink-0 cursor-pointer overflow-hidden transition-all bg-slate-900 border mr-[6px] ${
                isActive
                  ? 'ring-2 ring-violet-400 border-violet-400 opacity-100 z-10 scale-[1.03]'
                  : 'border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600'
              }`}
              style={{ height: '42px', width: `${ITEM_WIDTH}px` }}
            >
              <img
                src={dataUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover block pointer-events-none"
              />
              {'isIntroVideo' in item && Boolean(item.isIntroVideo) && (
                <>
                  <span className="absolute top-0.5 left-0.5 bg-purple-600 text-white font-black text-[8px] px-1.5 py-0.5 rounded shadow z-10">
                    🎬 INTRO
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSlot(idx);
                    }}
                    className="absolute top-0.5 right-0.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-none z-20 cursor-pointer transition-colors"
                    title="Delete Intro Video"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          );
        })}
        {rightSpacerWidth > 0 && (
          <div style={{ width: `${rightSpacerWidth}px` }} className="shrink-0 h-[42px]" aria-hidden="true" />
        )}
      </div>

      {replacingSlotIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setReplacingSlotIndex(null)}
        >
          <div
            className="bg-[#0f172a] rounded-none max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#0b1120] border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Replace Image #{replacingSlotIndex + 1}</h3>
              <button
                type="button"
                onClick={() => setReplacingSlotIndex(null)}
                className="p-1.5 rounded-none text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 overflow-y-auto flex-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-[65vh]">
              {gallery.slice(0, replaceVisibleLimit).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onReplaceSlotImage(replacingSlotIndex, item);
                    setReplacingSlotIndex(null);
                  }}
                  className="group relative aspect-video bg-slate-950 rounded-none overflow-hidden border border-slate-800 hover:border-indigo-400 cursor-pointer"
                >
                  <img src={item.dataUrl} alt="Gallery" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  <span className="absolute top-1 left-1 bg-black/80 text-white font-mono text-[9px] px-1">
                    #{item.index}
                  </span>
                  {item.formattedTime && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-emerald-400 font-mono text-[9px] px-1">
                      {item.formattedTime}
                    </span>
                  )}
                </div>
              ))}
              {gallery.length > replaceVisibleLimit && (
                <div className="col-span-full flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setReplaceVisibleLimit((n) => n + 36)}
                    className="h-8 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                  >
                    আরো ছবি দেখুন ({gallery.length - replaceVisibleLimit} বাকি)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingAnimSlotIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setEditingAnimSlotIndex(null)}
        >
          <div
            className="bg-[#0f172a] rounded-none max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#0b1120] border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Animation #{editingAnimSlotIndex + 1}</h3>
              <button
                type="button"
                onClick={() => setEditingAnimSlotIndex(null)}
                className="p-1.5 rounded-none text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[65vh]">
              {ANIMATION_LIBRARY.map((a) => {
                const isSelected = slots[editingAnimSlotIndex]?.animationId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onUpdateSlotAnimation(editingAnimSlotIndex, a.id);
                      setEditingAnimSlotIndex(null);
                    }}
                    className={`p-2.5 rounded-none border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-200 border-slate-800'
                    }`}
                  >
                    <span className="font-bold truncate">{a.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editingTransSlotIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setEditingTransSlotIndex(null)}
        >
          <div
            className="bg-[#0f172a] rounded-none max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#0b1120] border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Transition #{editingTransSlotIndex + 1}</h3>
              <button
                type="button"
                onClick={() => setEditingTransSlotIndex(null)}
                className="p-1.5 rounded-none text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 overflow-y-auto flex-1 flex flex-col gap-2 max-h-[65vh]">
              {TRANSITION_TYPES.map((t) => {
                const isSelected = slots[editingTransSlotIndex]?.transitionType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onUpdateSlotTransition(editingTransSlotIndex, t.id);
                      setEditingTransSlotIndex(null);
                    }}
                    className={`p-2.5 rounded-none border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-200 border-slate-800'
                    }`}
                  >
                    <span className="font-bold">{t.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
