import React, { useRef, useState } from 'react';
import {
  Upload,
  Film,
  Trash2,
  HardDrive,
  Plus,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Tv
} from 'lucide-react';
import {
  formatBytes,
  formatSecondsToClock,
  getVideosForChannel,
  type VideoAsset,
  type StorageStats,
  type ChannelConfig
} from '../utils/streamLogic';

interface VideoLibraryPanelProps {
  videos: VideoAsset[];
  storageStats: StorageStats;
  channels: ChannelConfig[];
  activeChannel: ChannelConfig;
  onSelectChannel: (channelId: string) => void;
  onOpenAddChannel: () => void;
  onUploadFiles: (files: FileList, customTitle: string) => Promise<void>;
  onReplaceVideo: (videoId: string, file: File | null) => Promise<void>;
  onGenerateSample: () => Promise<void>;
  onDeleteVideo: (videoId: string) => Promise<void>;
  onAddVideoToPlaylist: (videoId: string) => void;
  onGoToPlaylist: () => void;
}

export const VideoLibraryPanel: React.FC<VideoLibraryPanelProps> = ({
  videos,
  storageStats,
  channels,
  activeChannel,
  onSelectChannel,
  onOpenAddChannel,
  onUploadFiles,
  onReplaceVideo,
  onGenerateSample,
  onDeleteVideo,
  onAddVideoToPlaylist,
  onGoToPlaylist
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const channelVideos = getVideosForChannel(videos, activeChannel.id);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(25);
    const timer = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 180);

    try {
      await onUploadFiles(files, customTitle);
      setUploadProgress(100);
      setCustomTitle('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      clearInterval(timer);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 350);
    }
  };

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file || !replacingId) return;
    const targetId = replacingId;
    setReplacingId(null);
    await onReplaceVideo(targetId, file);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
    }
  };

  const handleSampleClick = async () => {
    setGenerating(true);
    try {
      await onGenerateSample();
    } finally {
      setGenerating(false);
    }
  };

  const playlistIds = new Set(activeChannel.playlist.map((p) => p.videoId));

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden" data-testid="video-library-view">
      {/* Per-Channel Selector Bar inside Video Library */}
      <div className="clay-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Select Channel Video Library ({channels.length}/10)
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenAddChannel}
            disabled={channels.length >= 10}
            className="clay-btn px-3 py-1.5 text-xs font-bold text-blue-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Channel
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {channels.map((ch) => {
            const isSelected = ch.id === activeChannel.id;
            const chVideoCount = getVideosForChannel(videos, ch.id).length;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChannel(ch.id)}
                data-testid={`video-lib-channel-${ch.id}`}
                className={`${
                  isSelected ? 'clay-btn-primary' : 'clay-btn'
                } px-3.5 py-2 text-xs font-bold shrink-0 flex items-center gap-2 cursor-pointer`}
              >
                <span className="truncate max-w-[140px]">{ch.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {chVideoCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header & Storage Summary */}
      <div className="clay-card p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 clay-inset flex items-center justify-center text-blue-600 shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate">
                {activeChannel.name} — Videos ({channelVideos.length})
              </h2>
              <p className="text-xs text-slate-500">
                Videos uploaded here belong exclusively to {activeChannel.name}
              </p>
            </div>
          </div>

          <div className="clay-inset px-4 py-3 flex items-center gap-3 shrink-0">
            <HardDrive className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">
                Disk Storage
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                {storageStats.usedFormatted} / {storageStats.recommendedDiskGb} GB
              </div>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Custom Video Title (Optional)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={`e.g. ${activeChannel.name} Loop Part 1`}
              disabled={uploading}
              data-testid="video-title-input"
              className="clay-inset w-full px-4 py-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/mp4,video/x-matroska,video/quicktime,video/webm"
              onChange={handleFileChange}
              className="hidden"
              data-testid="video-file-input"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-video-btn"
              className="clay-btn-primary w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>{uploading ? `Uploading ${uploadProgress}%...` : 'Upload MP4 Video'}</span>
            </button>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              disabled={generating || uploading}
              onClick={handleSampleClick}
              data-testid="generate-sample-video-btn"
              className="clay-btn w-full py-3 px-4 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{generating ? 'Creating...' : 'Create Test MP4'}</span>
            </button>
          </div>
        </div>

        {/* Hidden file input for Replace Video */}
        <input
          ref={replaceInputRef}
          type="file"
          accept="video/mp4,video/x-matroska,video/quicktime,video/webm"
          onChange={handleReplaceFileChange}
          className="hidden"
        />

        {uploading && (
          <div className="mt-4 clay-inset p-3.5" data-testid="upload-progress-bar">
            <div className="flex items-center justify-between text-xs font-bold text-blue-700 mb-1.5">
              <span>Uploading & probing video with FFprobe...</span>
              <span className="font-mono">{uploadProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-300/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Video Cards Grid */}
      <div className="clay-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-extrabold text-slate-900">
            {activeChannel.name} Video Files ({channelVideos.length})
          </h3>
          {channelVideos.length > 0 && (
            <button
              type="button"
              onClick={onGoToPlaylist}
              data-testid="go-to-playlist-btn"
              className="clay-btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
            >
              Open Playlist →
            </button>
          )}
        </div>

        {channelVideos.length === 0 ? (
          <div
            className="clay-inset p-8 text-center space-y-3"
            data-testid="empty-video-library"
          >
            <Film className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-700">
              No videos uploaded for {activeChannel.name} yet
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click <strong>Upload MP4 Video</strong> above to upload from your phone or PC, or click{' '}
              <strong>Create Test MP4</strong> to generate a test video for {activeChannel.name}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channelVideos.map((video, index) => {
              const inPlaylist = playlistIds.has(video.id);
              return (
                <div
                  key={video.id}
                  data-testid={`video-item-${video.id}`}
                  className="clay-inset p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Video Thumbnail Preview */}
                    <div className="w-24 h-16 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 relative overflow-hidden shadow-inner">
                      <Film className="w-5 h-5 text-blue-400 mb-0.5" />
                      <span className="text-[10px] font-mono font-bold text-slate-200">
                        {video.resolution}
                      </span>
                      <span className="absolute bottom-1 right-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[9px] font-mono text-emerald-300">
                        {formatSecondsToClock(video.durationSec)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-blue-600">
                          #{index + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {video.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] font-mono text-slate-600">
                        <span>Size: {formatBytes(video.sizeBytes)}</span>
                        <span>•</span>
                        <span>{video.fps} FPS</span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready
                        </span>
                        {(video.replacedCount || 0) > 0 && (
                          <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                            Replaced {video.replacedCount}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Reuse in Playlist, Replace File, Delete */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-300/60">
                    <button
                      type="button"
                      onClick={() => onAddVideoToPlaylist(video.id)}
                      data-testid={`add-to-playlist-${video.id}`}
                      className={`${
                        inPlaylist ? 'clay-btn text-emerald-700' : 'clay-btn-primary'
                      } px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {inPlaylist ? 'In Playlist (+ Add Again)' : 'Add to Playlist'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplacingId(video.id);
                          replaceInputRef.current?.click();
                        }}
                        title="Replace video file while keeping playlist position"
                        className="clay-btn px-2.5 py-1.5 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                        Replace
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteVideo(video.id)}
                        data-testid={`delete-video-${video.id}`}
                        className="clay-btn px-2.5 py-1.5 text-xs font-bold text-rose-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
