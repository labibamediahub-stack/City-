/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Film,
  Trash2,
  Edit2,
  Check,
  Plus,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  CustomFrameItem,
  BUILTIN_VIDEO_FRAMES,
  BUILTIN_PHOTO_FRAMES,
  loadCustomFrames,
  addCustomFrame,
  deleteCustomFrame,
  updateCustomFrameName
} from '../services/frameManager';

interface FrameManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideoFrame: (frame: CustomFrameItem) => void;
  onSelectPhotoFrame: (frame: CustomFrameItem) => void;
  activeVideoFrameId?: string;
  activePhotoFrameId?: string;
}

export const FrameManagerModal: React.FC<FrameManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectVideoFrame,
  onSelectPhotoFrame,
  activeVideoFrameId,
  activePhotoFrameId
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'photo'>('video');
  const [customFrames, setCustomFrames] = useState<CustomFrameItem[]>(() => loadCustomFrames());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [newFrameName, setNewFrameName] = useState<string>('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentBuiltin = activeTab === 'video' ? BUILTIN_VIDEO_FRAMES : BUILTIN_PHOTO_FRAMES;
  const currentCustom = customFrames.filter((f) => f.type === activeTab);
  const allFrames = [...currentBuiltin, ...currentCustom];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png') && !file.type.includes('image')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setUploadPreview(result);
      if (!newFrameName) {
        setNewFrameName(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUpload = () => {
    if (!uploadPreview) return;
    const item = addCustomFrame(newFrameName, activeTab, uploadPreview);
    setCustomFrames(loadCustomFrames());
    setUploadPreview(null);
    setNewFrameName('');
    setIsUploading(false);

    if (activeTab === 'video') {
      onSelectVideoFrame(item);
    } else {
      onSelectPhotoFrame(item);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomFrame(id);
    setCustomFrames(loadCustomFrames());
  };

  const handleStartEdit = (frame: CustomFrameItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(frame.id);
    setEditingName(frame.name);
  };

  const handleSaveEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingName.trim()) {
      updateCustomFrameName(id, editingName.trim());
      setCustomFrames(loadCustomFrames());
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="bg-[#0f172a] border border-slate-700 rounded-none w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0b1120] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Frame Manager</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-none hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher + Upload Trigger */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="grid grid-cols-2 border border-slate-800 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => {
                setActiveTab('video');
                setIsUploading(false);
              }}
              className={`h-8 px-3 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-r border-slate-800 ${
                activeTab === 'video' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Video ({customFrames.filter((f) => f.type === 'video').length + BUILTIN_VIDEO_FRAMES.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('photo');
                setIsUploading(false);
              }}
              className={`h-8 px-3 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'photo' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photo ({customFrames.filter((f) => f.type === 'photo').length + BUILTIN_PHOTO_FRAMES.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsUploading(!isUploading)}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-none flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Frame</span>
          </button>
        </div>

        {/* Upload Drawer */}
        {isUploading && (
          <div className="m-3 p-3 bg-slate-950 border border-emerald-700 rounded-none flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/webp,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 rounded-none font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select PNG</span>
              </button>

              <input
                type="text"
                placeholder="Frame name"
                value={newFrameName}
                onChange={(e) => setNewFrameName(e.target.value)}
                className="flex-1 min-w-[140px] h-9 bg-slate-900 border border-slate-700 rounded-none px-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
              />

              <button
                type="button"
                disabled={!uploadPreview}
                onClick={handleSaveUpload}
                className="h-9 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-4 rounded-none font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>

            {uploadPreview && (
              <div className="flex items-center gap-3 pt-1 border-t border-slate-800">
                <div className="w-16 h-10 border border-slate-700 bg-black flex items-center justify-center overflow-hidden">
                  <img src={uploadPreview} alt="Preview" className="max-w-full max-h-full object-contain" />
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">Loaded</span>
              </div>
            )}
          </div>
        )}

        {/* Frames Grid */}
        <div className="p-3.5 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {allFrames.map((frame) => {
            const isSelected =
              activeTab === 'video'
                ? activeVideoFrameId === frame.id || activeVideoFrameId === frame.name
                : activePhotoFrameId === frame.id || activePhotoFrameId === frame.name;

            return (
              <div
                key={frame.id}
                onClick={() => {
                  if (activeTab === 'video') {
                    onSelectVideoFrame(frame);
                  } else {
                    onSelectPhotoFrame(frame);
                  }
                }}
                className={`relative p-2 rounded-none border flex flex-col gap-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-950/30'
                    : 'border-slate-800 hover:border-slate-600 bg-slate-950'
                }`}
              >
                <div className="w-full h-20 bg-black border border-slate-800 relative flex items-center justify-center overflow-hidden">
                  {frame.dataUrl ? (
                    <img src={frame.dataUrl} alt={frame.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="text-center p-2 flex flex-col items-center gap-1">
                      {activeTab === 'video' ? (
                        <Film className="w-4 h-4 text-purple-400" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">Built-in</span>
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-emerald-500 text-slate-950 p-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  {editingId === frame.id ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="bg-slate-900 border border-indigo-400 rounded-none px-1.5 py-0.5 text-xs text-white w-full"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveEdit(frame.id, e)}
                        className="p-1 text-emerald-400 hover:text-white"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-200 truncate text-[11px]" title={frame.name}>
                        {frame.name}
                      </span>
                      {frame.isCustom && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={(e) => handleStartEdit(frame, e)}
                            className="text-slate-400 hover:text-indigo-400 p-0.5 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(frame.id, e)}
                            className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#0b1120] border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 rounded-none font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
