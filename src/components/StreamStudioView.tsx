import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Pause,
  Radio,
  ShieldCheck,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
  Activity,
  Terminal,
  Film,
  ArrowRight
} from 'lucide-react';
import {
  formatSecondsToClock,
  validateStreamPreFlight,
  getCurrentAndNextVideo,
  type ChannelConfig,
  type VideoAsset,
  type DurationUnit,
  type EncodingQuality
} from '../utils/streamLogic';

interface StreamStudioViewProps {
  channel: ChannelConfig;
  videos: VideoAsset[];
  onUpdateChannel: (updates: Partial<ChannelConfig>) => Promise<void>;
  onStartStream: (overrides?: Partial<ChannelConfig>) => Promise<void>;
  onPauseStream: () => Promise<void>;
  onRestartStream: () => Promise<void>;
  onStopStream: () => Promise<void>;
  onNavigateTab: (tab: 'videos' | 'playlist' | 'control' | 'schedule') => void;
}

export const StreamStudioView: React.FC<StreamStudioViewProps> = ({
  channel,
  videos,
  onUpdateChannel,
  onStartStream,
  onPauseStream,
  onRestartStream,
  onStopStream,
  onNavigateTab
}) => {
  const [rtmpUrl, setRtmpUrl] = useState(channel.rtmpUrl);
  const [streamKey, setStreamKey] = useState(channel.streamKey);
  const [durationInput, setDurationInput] = useState(String(channel.durationValue || 1));
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(channel.durationUnit || 'hours');
  const [infiniteLoop, setInfiniteLoop] = useState<boolean>(channel.infiniteLoop);
  const [showKey, setShowKey] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [saveBanner, setSaveBanner] = useState(false);

  // Sync only when switching to a different channel ID
  useEffect(() => {
    setRtmpUrl(channel.rtmpUrl);
    setStreamKey(channel.streamKey);
    setDurationInput(String(channel.durationValue || 1));
    setDurationUnit(channel.durationUnit || 'hours');
    setInfiniteLoop(channel.infiniteLoop);
  }, [channel.id]);

  const numericDuration = Number(durationInput);
  const liveChannelSnapshot: ChannelConfig = {
    ...channel,
    rtmpUrl,
    streamKey,
    durationValue: Number.isNaN(numericDuration) ? 0 : numericDuration,
    durationUnit,
    infiniteLoop
  };

  const preFlight = validateStreamPreFlight(liveChannelSnapshot, videos);
  const { currentVideo, nextVideo, activeCount } = getCurrentAndNextVideo(channel, videos);
  const isRunning = channel.status === 'live' || channel.status === 'paused';

  const handleSaveSettings = async () => {
    const val = Math.max(0, Number(durationInput) || 0);
    await onUpdateChannel({
      rtmpUrl,
      streamKey,
      durationValue: val,
      durationUnit,
      infiniteLoop
    });
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 1800);
  };

  const handleUnitChange = (unit: DurationUnit) => {
    setDurationUnit(unit);
    const val = Math.max(0, Number(durationInput) || 0);
    void onUpdateChannel({
      rtmpUrl,
      streamKey,
      durationValue: val,
      durationUnit: unit,
      infiniteLoop
    });
  };

  const handleInfiniteToggle = (checked: boolean) => {
    setInfiniteLoop(checked);
    const val = Math.max(0, Number(durationInput) || 0);
    void onUpdateChannel({
      rtmpUrl,
      streamKey,
      durationValue: val,
      durationUnit,
      infiniteLoop: checked
    });
  };

  const handleStartClick = async () => {
    setActionBusy(true);
    try {
      const val = Math.max(0, Number(durationInput) || 0);
      await onStartStream({
        rtmpUrl,
        streamKey,
        durationValue: val,
        durationUnit,
        infiniteLoop
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleStopClick = async () => {
    setActionBusy(true);
    try {
      await onStopStream();
    } finally {
      setActionBusy(false);
    }
  };

  const handlePauseClick = async () => {
    setActionBusy(true);
    try {
      await onPauseStream();
    } finally {
      setActionBusy(false);
    }
  };

  const handleRestartClick = async () => {
    setActionBusy(true);
    try {
      await onRestartStream();
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden" data-testid="stream-control-view">
      {/* Pre-Flight Readiness Bar */}
      <div className="clay-card p-4 sm:p-5" data-testid="preflight-checklist-card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-5 h-5 shrink-0 ${
                preFlight.valid ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            <h3 className="text-sm font-extrabold text-slate-900">
              Pre-Flight Verification ({channel.name})
            </h3>
          </div>
          <span
            data-testid="preflight-badge"
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              preFlight.valid
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {preFlight.valid ? 'Ready to Stream' : 'Setup Incomplete'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {preFlight.checks.map((chk) => (
            <div
              key={chk.id}
              data-testid={`preflight-check-${chk.id}`}
              className="clay-inset p-3 flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2 min-w-0">
                {chk.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {chk.label}
                  </div>
                  <div
                    className={`text-[11px] leading-snug mt-0.5 break-words ${
                      chk.passed ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-medium'
                    }`}
                  >
                    {chk.detail}
                  </div>
                </div>
              </div>

              {!chk.passed && (chk.id === 'video_uploaded' || chk.id === 'playlist_ready') && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTab(chk.id === 'video_uploaded' ? 'videos' : 'playlist')
                  }
                  className="clay-btn px-2 py-1 text-[10px] font-bold text-blue-700 shrink-0 cursor-pointer"
                >
                  Fix
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Live Monitor & Transport Controls */}
        <div className="lg:col-span-7 space-y-5 min-w-0">
          <div className="clay-card p-4 sm:p-6 space-y-4">
            {/* Channel Header & Mode Switcher (Mobile-Safe 2-Column Grid) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      channel.status === 'live'
                        ? 'bg-emerald-500 animate-pulse'
                        : channel.status === 'paused'
                        ? 'bg-amber-500'
                        : channel.status === 'error'
                        ? 'bg-rose-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  <h2
                    className="text-base sm:text-lg font-extrabold text-slate-900 truncate"
                    data-testid="active-channel-heading"
                  >
                    {channel.name}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Status: <strong className="uppercase text-slate-800">{channel.status}</strong> •{' '}
                  {channel.loopMode === 'single_video'
                    ? 'Single Video Loop'
                    : 'Multi-Video Loop'}
                </p>
              </div>

              {/* Concise Mode Switcher that never overflows on 390px screens */}
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => onUpdateChannel({ streamMode: 'youtube_rtmp' })}
                  data-testid="mode-youtube-btn"
                  className={`${
                    channel.streamMode === 'youtube_rtmp' ? 'clay-btn-primary' : 'clay-btn'
                  } px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50 text-center truncate`}
                >
                  YouTube Live
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => onUpdateChannel({ streamMode: 'test_loop' })}
                  data-testid="mode-test-btn"
                  className={`${
                    channel.streamMode === 'test_loop' ? 'clay-btn-primary' : 'clay-btn'
                  } px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50 text-center truncate`}
                >
                  Test Mode
                </button>
              </div>
            </div>

            {/* Video Preview Screen */}
            {currentVideo ? (
              <div className="rounded-2xl overflow-hidden bg-slate-950 border-2 border-white shadow-inner relative aspect-video">
                <video
                  key={currentVideo.filename}
                  src={`/api/videos/stream/${encodeURIComponent(currentVideo.filename)}`}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                />
                <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 pointer-events-none">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow ${
                      channel.status === 'live'
                        ? 'bg-rose-600 text-white'
                        : channel.status === 'paused'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-900/85 text-slate-100'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {channel.status === 'live'
                      ? channel.streamMode === 'youtube_rtmp'
                        ? 'LIVE ON YOUTUBE'
                        : 'TEST MODE RUNNING'
                      : channel.status === 'paused'
                      ? 'STREAM PAUSED'
                      : 'PREVIEW READY'}
                  </span>
                  <span className="bg-slate-900/80 text-white px-2.5 py-1 rounded-full text-[11px] font-mono">
                    Cycle #{channel.loopIterations || 1}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="clay-inset aspect-video flex flex-col items-center justify-center p-5 text-center"
                data-testid="no-video-monitor"
              >
                <Film className="w-10 h-10 text-blue-600 mb-2" />
                <div className="text-sm font-extrabold text-slate-800">
                  No Video in {channel.name} Playlist
                </div>
                <p className="text-xs text-slate-600 max-w-sm mt-1">
                  Upload a video in the Videos tab and add it to the Playlist first.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('videos')}
                  className="mt-3 clay-btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  Go to Videos →
                </button>
              </div>
            )}

            {/* Current Video & Next Video Up Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="clay-inset p-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Current Video ({activeCount} in Loop)
                  </div>
                  <div
                    className="text-xs font-bold text-slate-900 truncate"
                    data-testid="current-video-title"
                  >
                    {currentVideo ? currentVideo.title : 'None selected'}
                  </div>
                </div>
              </div>

              <div className="clay-inset p-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Next Video in Loop
                  </div>
                  <div
                    className="text-xs font-bold text-slate-900 truncate"
                    data-testid="next-video-title"
                  >
                    {nextVideo ? nextVideo.title : 'None'}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Counters: Duration, Remaining Timer, Loop Cycles */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="clay-inset p-3 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Elapsed
                </div>
                <div
                  className="text-sm sm:text-lg font-mono font-extrabold text-slate-900 tabular-nums mt-0.5"
                  data-testid="elapsed-clock"
                >
                  {formatSecondsToClock(channel.elapsedSeconds)}
                </div>
              </div>

              <div className="clay-inset p-3 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Auto-Stop Left
                </div>
                <div
                  className="text-sm sm:text-lg font-mono font-extrabold text-blue-700 tabular-nums mt-0.5"
                  data-testid="remaining-clock"
                >
                  {channel.remainingSeconds !== null
                    ? formatSecondsToClock(channel.remainingSeconds)
                    : '24/7 ∞'}
                </div>
              </div>

              <div className="clay-inset p-3 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Loop Cycles
                </div>
                <div className="text-sm sm:text-lg font-mono font-extrabold text-emerald-700 tabular-nums mt-0.5">
                  #{channel.loopIterations || 0}
                </div>
              </div>
            </div>

            {/* Error Banner if User Clicked Start Without Completing Pre-Flight */}
            {channel.lastError && (
              <div
                data-testid="stream-error-banner"
                className="p-3.5 rounded-2xl bg-rose-100 border border-rose-300 text-rose-900 flex items-start gap-2.5 text-xs font-bold"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="break-words">{channel.lastError}</div>
              </div>
            )}

            {/* 4 Transport Controls: Start, Pause/Resume, Restart, Stop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <button
                type="button"
                disabled={actionBusy || isRunning}
                onClick={handleStartClick}
                data-testid="start-stream-btn"
                className={`${
                  preFlight.valid ? 'clay-btn-emerald' : 'clay-btn-primary'
                } py-3 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45`}
              >
                <Play className="w-4 h-4 shrink-0" />
                <span>
                  {channel.streamMode === 'test_loop' ? 'Start Test' : 'Start Live'}
                </span>
              </button>

              <button
                type="button"
                disabled={actionBusy || !isRunning}
                onClick={handlePauseClick}
                data-testid="pause-stream-btn"
                className="clay-btn-amber py-3 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <Pause className="w-4 h-4 shrink-0" />
                <span>{channel.status === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                type="button"
                disabled={actionBusy || !isRunning}
                onClick={handleRestartClick}
                data-testid="restart-stream-btn"
                className="clay-btn py-3 px-3 text-xs font-extrabold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Restart</span>
              </button>

              <button
                type="button"
                disabled={actionBusy || !isRunning}
                onClick={handleStopClick}
                data-testid="stop-stream-btn"
                className="clay-btn-danger py-3 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <Square className="w-4 h-4 shrink-0" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Stream Key, Custom Number + Unit Timer, Quality & Stability */}
        <div className="lg:col-span-5 space-y-5 min-w-0">
          {/* Stream URL, Stream Key & Custom Timer Card */}
          <div className="clay-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
              <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-sm font-extrabold text-slate-900">
                YouTube Stream URL & Stream Key
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                YouTube RTMP Stream URL
              </label>
              <input
                type="text"
                value={rtmpUrl}
                onChange={(e) => setRtmpUrl(e.target.value)}
                disabled={isRunning}
                data-testid="rtmp-url-input"
                className="clay-inset w-full px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                YouTube Stream Key {channel.streamMode === 'youtube_rtmp' && '(Required)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={streamKey}
                  onChange={(e) => setStreamKey(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  disabled={isRunning}
                  data-testid="stream-key-input"
                  className="clay-inset flex-1 min-w-0 px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="clay-btn p-2.5 text-slate-700 cursor-pointer shrink-0"
                  title="Show/Hide Stream Key"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Custom Duration Timer: Number Input + Minutes / Hours Selector */}
            <div className="pt-2 border-t border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-extrabold text-slate-900">
                    Stream Duration Timer
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-blue-700 shrink-0">
                  {infiniteLoop
                    ? '24/7 Non-Stop'
                    : `${durationInput || 0} ${
                        durationUnit === 'hours' ? 'Hour(s)' : 'Minute(s)'
                      }`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Time Value
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    disabled={infiniteLoop || isRunning}
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    data-testid="duration-number-input"
                    placeholder="e.g. 1, 5, 12"
                    className="clay-inset w-full px-3.5 py-2.5 text-sm font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>

                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Select Unit
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={infiniteLoop || isRunning}
                      onClick={() => handleUnitChange('minutes')}
                      data-testid="unit-minutes-btn"
                      className={`${
                        durationUnit === 'minutes' && !infiniteLoop
                          ? 'clay-btn-primary'
                          : 'clay-btn'
                      } py-2.5 px-3 text-xs font-bold cursor-pointer disabled:opacity-50`}
                    >
                      Minutes
                    </button>
                    <button
                      type="button"
                      disabled={infiniteLoop || isRunning}
                      onClick={() => handleUnitChange('hours')}
                      data-testid="unit-hours-btn"
                      className={`${
                        durationUnit === 'hours' && !infiniteLoop
                          ? 'clay-btn-primary'
                          : 'clay-btn'
                      } py-2.5 px-3 text-xs font-bold cursor-pointer disabled:opacity-50`}
                    >
                      Hours
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={infiniteLoop}
                    disabled={isRunning}
                    onChange={(e) => handleInfiniteToggle(e.target.checked)}
                    data-testid="infinite-loop-checkbox"
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                  <span>Run 24/7 Non-Stop Loop</span>
                </label>

                <button
                  type="button"
                  disabled={isRunning}
                  onClick={handleSaveSettings}
                  data-testid="save-channel-settings-btn"
                  className="clay-btn-primary px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {saveBanner ? 'Saved ✓' : 'Save Key & Time'}
                </button>
              </div>
            </div>
          </div>

          {/* Stream Quality & Stability Controls */}
          <div className="clay-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
              <Sliders className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Stream Quality & Stability
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Encoding Quality & Bitrate
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'copy', label: 'Stream Copy (Zero CPU)' },
                    { id: '720p', label: '720p HD (2500k)' },
                    { id: '1080p', label: '1080p FHD (4500k)' },
                    { id: '1440p', label: '1440p 2K (9000k)' }
                  ] as { id: EncodingQuality; label: string }[]
                ).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    disabled={isRunning}
                    onClick={() => onUpdateChannel({ encodingQuality: q.id })}
                    className={`${
                      channel.encodingQuality === q.id ? 'clay-btn-primary' : 'clay-btn'
                    } p-2.5 text-left text-xs font-bold cursor-pointer disabled:opacity-50 truncate`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="clay-inset p-3 flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer">
                <span>Auto-Reconnect</span>
                <input
                  type="checkbox"
                  checked={channel.autoReconnect}
                  onChange={(e) =>
                    onUpdateChannel({ autoReconnect: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>

              <label className="clay-inset p-3 flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer">
                <span>Crash Auto-Restart</span>
                <input
                  type="checkbox"
                  checked={channel.autoRestartOnCrash}
                  onChange={(e) =>
                    onUpdateChannel({ autoRestartOnCrash: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: FFmpeg Command Preview & Error/Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 clay-card p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Terminal className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Active FFmpeg Loop Command
            </h3>
          </div>
          <div className="clay-inset p-3.5 text-xs font-mono text-slate-800 break-all leading-relaxed">
            {channel.commandPreview}
          </div>
        </div>

        <div className="lg:col-span-6 clay-card p-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Channel Activity Log
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Reconnects: {channel.reconnectCount || 0}
            </span>
          </div>
          <div className="clay-inset p-3 max-h-36 overflow-y-auto space-y-1.5 text-xs font-mono">
            {(channel.logs || []).map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-slate-400 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={
                    log.level === 'error'
                      ? 'text-rose-700 font-bold'
                      : log.level === 'warn'
                      ? 'text-amber-700 font-bold'
                      : log.level === 'success'
                      ? 'text-emerald-700 font-bold'
                      : 'text-slate-700'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
