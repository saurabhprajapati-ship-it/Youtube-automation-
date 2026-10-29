import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Menu,
  X,
  Plus,
  Film,
  ListVideo,
  Radio,
  Calendar,
  Server,
  Trash2,
  Tv,
  BookOpen
} from 'lucide-react';
import {
  type VideoAsset,
  type ChannelConfig,
  type UptimeSessionRecord,
  type StorageStats
} from './utils/streamLogic';
import { VideoLibraryPanel } from './components/VideoLibraryPanel';
import { PlaylistBuilderView } from './components/PlaylistBuilderView';
import { StreamStudioView } from './components/StreamStudioView';
import { SchedulerAnalyticsView } from './components/SchedulerAnalyticsView';
import { NoCardCloudGuide } from './components/NoCardCloudGuide';
import { UserGuideView } from './components/UserGuideView';
import { ChannelModal } from './components/ChannelModal';

export type ActiveSection =
  | 'videos'
  | 'playlist'
  | 'control'
  | 'schedule'
  | 'guide'
  | 'hosting';

export default function App() {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [uptimeHistory, setUptimeHistory] = useState<UptimeSessionRecord[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalBytes: 0,
    usedGb: 0,
    maxQuotaGb: 5,
    remainingGb: 5,
    usagePercent: 0,
    videoCount: 0,
    isNearLimit: false,
    isOverLimit: false,
    usedFormatted: '0 MB',
    recommendedDiskGb: 5
  });
  const [activeChannelId, setActiveChannelId] = useState<string>('ch-1');
  const [activeSection, setActiveSection] = useState<ActiveSection>('control');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addChannelModalOpen, setAddChannelModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Guard polling from overwriting optimistic user edits in-flight
  const lastMutationTimeRef = useRef<number>(0);

  const fetchState = useCallback(async (force = false) => {
    if (!force && Date.now() - lastMutationTimeRef.current < 2500) {
      return;
    }
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data = await res.json();
      if (!force && Date.now() - lastMutationTimeRef.current < 2500) {
        return;
      }
      setVideos(data.videos || []);
      setChannels(data.channels || []);
      setUptimeHistory(data.uptimeHistory || []);
      if (data.storageStats) {
        setStorageStats(data.storageStats);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchState(true);
    const interval = setInterval(() => {
      void fetchState(false);
    }, 1500);
    return () => clearInterval(interval);
  }, [fetchState]);

  const activeChannel =
    channels.find((c) => c.id === activeChannelId) || channels[0];

  const handleUploadFiles = async (files: FileList, customTitle: string) => {
    lastMutationTimeRef.current = Date.now();
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('videos', file);
    });
    if (customTitle) formData.append('title', customTitle);
    if (activeChannel) formData.append('channelId', activeChannel.id);

    const res = await fetch('/api/videos/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
      setChannels(data.channels);
      setStorageStats(data.storageStats);
    }
  };

  const handleReplaceVideo = async (videoId: string, file: File | null) => {
    lastMutationTimeRef.current = Date.now();
    const formData = new FormData();
    if (file) formData.append('video', file);
    const res = await fetch(`/api/videos/${videoId}/replace`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
      setChannels(data.channels);
      setStorageStats(data.storageStats);
    }
  };

  const handleGenerateSample = async () => {
    lastMutationTimeRef.current = Date.now();
    const res = await fetch('/api/videos/generate-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: activeChannel?.id
      })
    });
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
      setChannels(data.channels);
      setStorageStats(data.storageStats);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    lastMutationTimeRef.current = Date.now();
    const res = await fetch(`/api/videos/${videoId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
      setChannels(data.channels);
      setStorageStats(data.storageStats);
    }
  };

  const handleUpdateChannel = async (updates: Partial<ChannelConfig>) => {
    if (!activeChannel) return;
    lastMutationTimeRef.current = Date.now();

    // Immediate optimistic state update so toggles feel instant with zero lag
    setChannels((prev) =>
      prev.map((ch) => (ch.id === activeChannel.id ? { ...ch, ...updates } : ch))
    );

    const res = await fetch(`/api/channels/${activeChannel.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
    }
  };

  const handleAddVideoToPlaylist = (videoId: string) => {
    if (!activeChannel) return;
    const nextPlaylist = [
      ...activeChannel.playlist,
      {
        id: `pl-${Date.now()}`,
        videoId,
        enabled: true,
        repeatCount: 1
      }
    ];
    void handleUpdateChannel({ playlist: nextPlaylist });
  };

  const handleStartStream = async (overrides?: Partial<ChannelConfig>) => {
    if (!activeChannel) return;
    lastMutationTimeRef.current = Date.now();
    const res = await fetch(`/api/channels/${activeChannel.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {})
    });
    const data = await res.json();
    if (data.channels) {
      setChannels(data.channels);
    }
  };

  const handlePauseStream = async () => {
    if (!activeChannel) return;
    lastMutationTimeRef.current = Date.now();
    const res = await fetch(`/api/channels/${activeChannel.id}/pause`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
    }
  };

  const handleRestartStream = async () => {
    if (!activeChannel) return;
    lastMutationTimeRef.current = Date.now();
    const res = await fetch(`/api/channels/${activeChannel.id}/restart`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.channels) {
      setChannels(data.channels);
    }
  };

  const handleStopStream = async () => {
    if (!activeChannel) return;
    lastMutationTimeRef.current = Date.now();
    const res = await fetch(`/api/channels/${activeChannel.id}/stop`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
      if (data.uptimeHistory) setUptimeHistory(data.uptimeHistory);
    }
  };

  const handleAddChannel = async (name: string) => {
    lastMutationTimeRef.current = Date.now();
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
      if (data.channel) {
        setActiveChannelId(data.channel.id);
      }
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (channels.length <= 1) return;
    lastMutationTimeRef.current = Date.now();
    const res = await fetch(`/api/channels/${channelId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels);
      if (activeChannelId === channelId && data.channels[0]) {
        setActiveChannelId(data.channels[0].id);
      }
    }
  };

  // Bottom bar & desktop primary tabs (strictly English, no numbers)
  const bottomNavItems: {
    id: 'videos' | 'playlist' | 'control' | 'schedule';
    label: string;
    icon: typeof Film;
  }[] = [
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'playlist', label: 'Playlist', icon: ListVideo },
    { id: 'control', label: 'Control', icon: Radio },
    { id: 'schedule', label: 'Schedule', icon: Calendar }
  ];

  const liveChannelsCount = channels.filter((c) => c.status === 'live').length;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col pb-20 lg:pb-8">
      {/* Top Bar with 3-Line Hamburger Menu Button */}
      <header className="sticky top-0 z-30 bg-[#EAF0F9]/95 backdrop-blur-md border-b border-white/80 px-3 sm:px-6 py-3 w-full max-w-full">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              data-testid="hamburger-menu-btn"
              aria-label="Open Navigation Menu"
              className="clay-btn w-10 h-10 flex items-center justify-center text-slate-800 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                  LoopStream Studio
                </h1>
                <span className="hidden md:inline-block text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {activeChannel?.name || 'Channel 1'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate">
                24/7 YouTube Loop Stream Controller • Active Channel: {activeChannel?.name}
              </p>
            </div>
          </div>

          {/* Desktop Category Tabs */}
          <nav className="hidden lg:flex items-center gap-2">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  data-testid={`top-tab-${item.id}`}
                  className={`${
                    isActive ? 'clay-btn-primary' : 'clay-btn'
                  } px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Quick Status & Add Channel */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex clay-inset px-3 py-1.5 items-center gap-2 text-xs font-mono font-bold text-slate-800">
              <span
                className={`w-2 h-2 rounded-full ${
                  liveChannelsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span>
                {liveChannelsCount}/{channels.length} Live
              </span>
            </div>

            <button
              type="button"
              onClick={() => setAddChannelModalOpen(true)}
              disabled={channels.length >= 10}
              data-testid="open-add-channel-btn"
              className="clay-btn-primary px-3 sm:px-3.5 py-2 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add Channel</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3-Line Hamburger Slide-Over Menu Drawer (Only Non-Bottom-Bar Options!) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-slate-900/45 backdrop-blur-xs"
          data-testid="hamburger-drawer"
        >
          <div className="clay-card rounded-none rounded-r-3xl w-80 max-w-[86vw] h-full p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    Studio Menu
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Channels, User Guide & Free Hosting
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  data-testid="close-drawer-btn"
                  className="clay-btn w-9 h-9 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Multi-Channel Manager (1 to 10 Channels) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Channels ({channels.length}/10)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      setAddChannelModalOpen(true);
                    }}
                    disabled={channels.length >= 10}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer disabled:opacity-40"
                  >
                    + Add New
                  </button>
                </div>

                <div className="space-y-2">
                  {channels.map((ch) => {
                    const isSelected = activeChannel?.id === ch.id;
                    return (
                      <div
                        key={ch.id}
                        className={`clay-inset p-2.5 flex items-center justify-between gap-2 ${
                          isSelected ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChannelId(ch.id);
                            setDrawerOpen(false);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <Tv className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {ch.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 uppercase">
                              {ch.status}
                            </div>
                          </div>
                        </button>

                        {channels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteChannel(ch.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer"
                            title="Delete Channel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guides & Cloud Setup (Items NOT on the Bottom Bar) */}
              <div className="space-y-2 pt-2 border-t border-slate-200/80">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 px-1">
                  Help & Cloud Setup
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('guide');
                    setDrawerOpen(false);
                  }}
                  data-testid="drawer-nav-guide"
                  className={`${
                    activeSection === 'guide' ? 'clay-btn-primary' : 'clay-btn'
                  } w-full p-3 text-left flex items-center gap-3 cursor-pointer`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold">User Guide</div>
                    <div
                      className={`text-[10px] ${
                        activeSection === 'guide' ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      How Videos, Test Mode & Timers work
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('hosting');
                    setDrawerOpen(false);
                  }}
                  data-testid="drawer-nav-hosting"
                  className={`${
                    activeSection === 'hosting' ? 'clay-btn-primary' : 'clay-btn'
                  } w-full p-3 text-left flex items-center gap-3 cursor-pointer`}
                >
                  <Server className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold">Free Hosting Setup</div>
                    <div
                      className={`text-[10px] ${
                        activeSection === 'hosting' ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      Run 24/7 without Google $300 card
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/80 text-[11px] font-mono text-slate-500">
              Disk Used: {storageStats.usedFormatted} / {storageStats.recommendedDiskGb} GB
            </div>
          </div>

          <div className="flex-1" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-3 sm:px-6 pt-4">
        {loading || !activeChannel ? (
          <div className="clay-card p-8 text-center text-sm font-bold text-slate-600">
            Loading LoopStream Studio...
          </div>
        ) : (
          <>
            {activeSection === 'videos' && (
              <VideoLibraryPanel
                videos={videos}
                storageStats={storageStats}
                channels={channels}
                activeChannel={activeChannel}
                onSelectChannel={(id) => setActiveChannelId(id)}
                onOpenAddChannel={() => setAddChannelModalOpen(true)}
                onUploadFiles={handleUploadFiles}
                onReplaceVideo={handleReplaceVideo}
                onGenerateSample={handleGenerateSample}
                onDeleteVideo={handleDeleteVideo}
                onAddVideoToPlaylist={handleAddVideoToPlaylist}
                onGoToPlaylist={() => setActiveSection('playlist')}
              />
            )}

            {activeSection === 'playlist' && (
              <PlaylistBuilderView
                channel={activeChannel}
                videos={videos}
                onUpdateChannel={handleUpdateChannel}
                onGoToControl={() => setActiveSection('control')}
                onGoToVideos={() => setActiveSection('videos')}
              />
            )}

            {activeSection === 'control' && (
              <StreamStudioView
                channel={activeChannel}
                videos={videos}
                onUpdateChannel={handleUpdateChannel}
                onStartStream={handleStartStream}
                onPauseStream={handlePauseStream}
                onRestartStream={handleRestartStream}
                onStopStream={handleStopStream}
                onNavigateTab={(tab) => setActiveSection(tab)}
              />
            )}

            {activeSection === 'schedule' && (
              <SchedulerAnalyticsView
                channel={activeChannel}
                uptimeHistory={uptimeHistory}
                onUpdateChannel={handleUpdateChannel}
              />
            )}

            {activeSection === 'guide' && (
              <UserGuideView onBackToApp={() => setActiveSection('control')} />
            )}

            {activeSection === 'hosting' && <NoCardCloudGuide />}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (4 Clean English Tabs) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#EAF0F9]/95 backdrop-blur-md border-t border-white px-2 py-2"
        data-testid="mobile-bottom-nav"
      >
        <div className="grid grid-cols-4 gap-1.5 max-w-md mx-auto">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                data-testid={`bottom-nav-${item.id}`}
                className={`${
                  isActive ? 'clay-btn-primary' : 'clay-btn'
                } py-2 px-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-bold truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <ChannelModal
        isOpen={addChannelModalOpen}
        onClose={() => setAddChannelModalOpen(false)}
        onAddChannel={handleAddChannel}
        channelCount={channels.length}
      />
    </div>
  );
}
