import React, { useState } from 'react';
import {
  ListVideo,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Repeat,
  Repeat1,
  Plus,
  Trash2,
  Film
} from 'lucide-react';
import {
  formatSecondsToClock,
  getVideosForChannel,
  type ChannelConfig,
  type VideoAsset,
  type PlaylistItem,
  type LoopMode
} from '../utils/streamLogic';

interface PlaylistBuilderViewProps {
  channel: ChannelConfig;
  videos: VideoAsset[];
  onUpdateChannel: (updates: Partial<ChannelConfig>) => Promise<void>;
  onGoToControl: () => void;
  onGoToVideos: () => void;
}

export const PlaylistBuilderView: React.FC<PlaylistBuilderViewProps> = ({
  channel,
  videos,
  onUpdateChannel,
  onGoToControl,
  onGoToVideos
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const channelVideos = getVideosForChannel(videos, channel.id);

  const handleLoopModeChange = (loopMode: LoopMode) => {
    if (channel.loopMode === loopMode) return;
    void onUpdateChannel({ loopMode });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= channel.playlist.length) return;
    const copy = [...channel.playlist];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    void onUpdateChannel({ playlist: copy });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const copy = [...channel.playlist];
    const [moved] = copy.splice(draggedIndex, 1);
    copy.splice(index, 0, moved);
    setDraggedIndex(index);
    void onUpdateChannel({ playlist: copy });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const toggleItemEnabled = (itemId: string) => {
    const next = channel.playlist.map((item) =>
      item.id === itemId ? { ...item, enabled: !item.enabled } : item
    );
    void onUpdateChannel({ playlist: next });
  };

  const updateRepeatCount = (itemId: string, repeatCount: number) => {
    const safeCount = Math.max(1, Math.min(20, repeatCount));
    const next = channel.playlist.map((item) =>
      item.id === itemId ? { ...item, repeatCount: safeCount } : item
    );
    void onUpdateChannel({ playlist: next });
  };

  const removeFromPlaylist = (itemId: string) => {
    const next = channel.playlist.filter((item) => item.id !== itemId);
    void onUpdateChannel({ playlist: next });
  };

  const appendVideoToPlaylist = (videoId: string) => {
    const newItem: PlaylistItem = {
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      videoId,
      enabled: true,
      repeatCount: 1
    };
    void onUpdateChannel({ playlist: [...channel.playlist, newItem] });
  };

  const validPlaylistItems = channel.playlist.filter((item) =>
    channelVideos.some((v) => v.id === item.videoId)
  );

  const totalCycleSeconds = validPlaylistItems
    .filter((i) => i.enabled)
    .reduce((acc, item) => {
      const v = channelVideos.find((vid) => vid.id === item.videoId);
      return acc + (v ? v.durationSec * (item.repeatCount || 1) : 0);
    }, 0);

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden" data-testid="playlist-builder-view">
      {/* Header & Loop Mode Selection */}
      <div className="clay-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 clay-inset flex items-center justify-center text-blue-600 shrink-0">
              <ListVideo className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate">
                {channel.name} — Playlist
              </h2>
              <p className="text-xs text-slate-500">
                Loop Mode & Playback Sequence
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToControl}
            data-testid="go-to-control-btn"
            className="clay-btn-primary px-4 py-2.5 text-xs font-bold cursor-pointer shrink-0"
          >
            Open Control →
          </button>
        </div>

        {/* Clean 2-Button Loop Mode Selector */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleLoopModeChange('multi_playlist')}
            data-testid="loop-mode-multi"
            className={`${
              channel.loopMode === 'multi_playlist' ? 'clay-btn-primary' : 'clay-btn'
            } p-3.5 text-left flex items-center gap-2.5 cursor-pointer`}
          >
            <Repeat className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold leading-tight">
              Multi-Video Loop
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleLoopModeChange('single_video')}
            data-testid="loop-mode-single"
            className={`${
              channel.loopMode === 'single_video' ? 'clay-btn-primary' : 'clay-btn'
            } p-3.5 text-left flex items-center gap-2.5 cursor-pointer`}
          >
            <Repeat1 className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold leading-tight">
              Single Video Loop
            </span>
          </button>
        </div>
      </div>

      {/* Playlist Queue + Available Channel Videos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 clay-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
            <h3 className="text-base font-extrabold text-slate-900">
              Active Loop Queue ({validPlaylistItems.filter((i) => i.enabled).length} Videos)
            </h3>
            <div className="clay-inset px-3 py-1.5 text-xs font-mono font-bold text-blue-700">
              1 Cycle = {formatSecondsToClock(totalCycleSeconds)}
            </div>
          </div>

          {validPlaylistItems.length === 0 ? (
            <div
              className="mt-4 clay-inset p-8 text-center space-y-3"
              data-testid="empty-playlist-queue"
            >
              <ListVideo className="w-9 h-9 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-700">
                Playlist Queue is empty for {channel.name}
              </div>
              <button
                type="button"
                onClick={onGoToVideos}
                className="clay-btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Go to Videos
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3" data-testid="playlist-queue-list">
              {channel.playlist.map((item, idx) => {
                const video = channelVideos.find((v) => v.id === item.videoId);
                if (!video) return null;
                const isSingleLockedOut =
                  channel.loopMode === 'single_video' && idx > 0;

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    data-testid={`playlist-item-${idx}`}
                    className={`clay-inset p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-opacity ${
                      !item.enabled || isSingleLockedOut ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="cursor-grab text-slate-400 hover:text-slate-700 shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => toggleItemEnabled(item.id)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                      />
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {video.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {formatSecondsToClock(video.durationSec)} • {video.resolution}
                          {isSingleLockedOut && ' • Paused in Single Video Mode'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white/70 px-2 py-1 rounded-xl border border-white">
                        <span className="text-[10px] font-bold text-slate-500">Repeat:</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={item.repeatCount || 1}
                          onChange={(e) =>
                            updateRepeatCount(item.id, Number(e.target.value))
                          }
                          className="w-10 text-xs font-mono font-bold text-center text-slate-800 focus:outline-none"
                        />
                        <span className="text-[10px] font-mono text-slate-500">x</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => moveItem(idx, -1)}
                        disabled={idx === 0}
                        className="clay-btn p-1.5 text-slate-700 disabled:opacity-40 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, 1)}
                        disabled={idx === channel.playlist.length - 1}
                        className="clay-btn p-1.5 text-slate-700 disabled:opacity-40 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromPlaylist(item.id)}
                        className="clay-btn p-1.5 text-rose-600 cursor-pointer"
                        title="Remove from Queue"
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

        {/* Quick Add from Channel Video Library */}
        <div className="lg:col-span-4 clay-card p-5 sm:p-6">
          <h3 className="text-base font-extrabold text-slate-900 pb-3 border-b border-slate-200/80">
            Add from {channel.name} Library
          </h3>
          {channelVideos.length === 0 ? (
            <div className="mt-4 clay-inset p-5 text-center space-y-2">
              <Film className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600">No videos in {channel.name} library.</p>
              <button
                type="button"
                onClick={onGoToVideos}
                className="clay-btn px-3 py-1.5 text-xs font-bold text-blue-600 cursor-pointer"
              >
                Upload Videos
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {channelVideos.map((v) => (
                <div
                  key={v.id}
                  className="clay-inset p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {v.title}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {formatSecondsToClock(v.durationSec)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => appendVideoToPlaylist(v.id)}
                    className="clay-btn-primary px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
