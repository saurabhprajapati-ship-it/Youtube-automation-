export interface VideoAsset {
  id: string;
  channelId: string;
  title: string;
  filename: string;
  sizeBytes: number;
  durationSec: number;
  resolution: string;
  fps: number;
  codec: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadedAt: string;
  replacedCount?: number;
}

export interface PlaylistItem {
  id: string;
  videoId: string;
  enabled: boolean;
  repeatCount: number;
}

export type StreamMode = 'youtube_rtmp' | 'test_loop';
export type EncodingQuality = 'copy' | '720p' | '1080p' | '1440p';
export type LoopMode = 'single_video' | 'multi_playlist';
export type DurationUnit = 'minutes' | 'hours';
export type StreamStatus = 'idle' | 'live' | 'paused' | 'completed' | 'error';

export interface StreamLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface UptimeSessionRecord {
  id: string;
  channelId: string;
  channelName: string;
  mode: StreamMode;
  quality: EncodingQuality;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  status: 'completed' | 'stopped' | 'restarted' | 'failed';
}

export interface DaySchedule {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  enabled: boolean;
  startTime: string;
  durationValue: number;
  durationUnit: DurationUnit;
  videoIds: string[];
}

export interface ChannelConfig {
  id: string;
  name: string;
  youtubeChannelLabel: string;
  rtmpUrl: string;
  streamKey: string;
  streamMode: StreamMode;
  encodingQuality: EncodingQuality;
  loopMode: LoopMode;
  autoReconnect: boolean;
  autoRestartOnCrash: boolean;
  durationValue: number;
  durationUnit: DurationUnit;
  infiniteLoop: boolean;
  autoStopMinutes: number;
  scheduledStartTime: string | null;
  daySchedules: DaySchedule[];
  playlist: PlaylistItem[];
  status: StreamStatus;
  startedAt: string | null;
  endsAt: string | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  loopIterations: number;
  currentVideoIndex: number;
  reconnectCount: number;
  lastError: string | null;
  commandPreview: string;
  logs: StreamLogEntry[];
}

export interface StorageStats {
  totalBytes: number;
  usedGb: number;
  maxQuotaGb: number;
  remainingGb: number;
  usagePercent: number;
  videoCount: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  usedFormatted: string;
  recommendedDiskGb: number;
}

export function getVideosForChannel(videos: VideoAsset[], channelId: string): VideoAsset[] {
  return videos.filter((v) => !v.channelId || v.channelId === channelId);
}

export function computeAutoStopMinutes(
  durationValue: number,
  durationUnit: DurationUnit,
  infiniteLoop: boolean
): number {
  if (infiniteLoop) return 0;
  const safeVal = Math.max(0, Number(durationValue) || 0);
  if (safeVal <= 0) return 0;
  return durationUnit === 'hours' ? Math.round(safeVal * 60) : Math.round(safeVal);
}

export function calculateStorageStats(
  videos: VideoAsset[],
  maxQuotaGb: number = 5
): StorageStats {
  const totalBytes = videos.reduce((acc, v) => acc + Math.max(0, v.sizeBytes), 0);
  const bytesPerGb = 1024 * 1024 * 1024;
  const usedGb = Number((totalBytes / bytesPerGb).toFixed(3));
  const remainingGb = Number(Math.max(0, maxQuotaGb - usedGb).toFixed(3));
  const usagePercent = Math.min(100, Number(((usedGb / maxQuotaGb) * 100).toFixed(1)));

  return {
    totalBytes,
    usedGb,
    maxQuotaGb,
    remainingGb,
    usagePercent,
    videoCount: videos.length,
    isNearLimit: usagePercent >= 80 && usagePercent < 100,
    isOverLimit: totalBytes > maxQuotaGb * bytesPerGb,
    usedFormatted: formatBytes(totalBytes),
    recommendedDiskGb: maxQuotaGb
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export const formatSecondsToClock = formatDuration;

export function buildFfmpegConcatList(filePaths: string[]): string {
  const lines = ['ffconcat version 1.0'];
  for (const filePath of filePaths) {
    const escaped = filePath.replace(/'/g, "'\\''");
    lines.push(`file '${escaped}'`);
  }
  return lines.join('\n') + '\n';
}

export interface FfmpegBuildInput {
  concatFilePath: string;
  rtmpUrl: string;
  streamKey: string;
  streamMode: StreamMode;
  encodingQuality: EncodingQuality;
  autoStopMinutes: number;
}

export function buildFfmpegArgs(input: FfmpegBuildInput): string[] {
  const args: string[] = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-re',
    '-stream_loop',
    '-1',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    input.concatFilePath
  ];

  if (input.autoStopMinutes > 0) {
    const stopSeconds = Math.round(input.autoStopMinutes * 60);
    args.push('-t', String(stopSeconds));
  }

  if (input.encodingQuality === 'copy') {
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
  } else if (input.encodingQuality === '1440p') {
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-s',
      '2560x1440',
      '-b:v',
      '9000k',
      '-maxrate',
      '9000k',
      '-bufsize',
      '18000k',
      '-pix_fmt',
      'yuv420p',
      '-g',
      '60',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-ar',
      '44100'
    );
  } else if (input.encodingQuality === '1080p') {
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-s',
      '1920x1080',
      '-b:v',
      '4500k',
      '-maxrate',
      '4500k',
      '-bufsize',
      '9000k',
      '-pix_fmt',
      'yuv420p',
      '-g',
      '60',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100'
    );
  } else {
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-s',
      '1280x720',
      '-b:v',
      '2500k',
      '-maxrate',
      '2500k',
      '-bufsize',
      '5000k',
      '-pix_fmt',
      'yuv420p',
      '-g',
      '60',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100'
    );
  }

  if (input.streamMode === 'test_loop') {
    args.push('-f', 'null', '-');
  } else {
    const baseUrl = input.rtmpUrl.replace(/\/+$/, '');
    const cleanKey = input.streamKey.trim();
    args.push('-flvflags', 'no_duration_filesize', '-f', 'flv', `${baseUrl}/${cleanKey}`);
  }

  return args;
}

export function buildFfmpegCommandPreview(input: FfmpegBuildInput): string {
  const maskedInput: FfmpegBuildInput = {
    ...input,
    streamKey: input.streamKey
      ? input.streamKey.length > 6
        ? `${input.streamKey.slice(0, 4)}-xxxx-xxxx`
        : 'xxxx-xxxx'
      : 'YOUR_STREAM_KEY'
  };
  const args = buildFfmpegArgs(maskedInput);
  return `ffmpeg ${args.join(' ')}`;
}

export interface PreFlightCheckItem {
  id: 'video_uploaded' | 'playlist_ready' | 'stream_key_ready' | 'timer_ready';
  label: string;
  passed: boolean;
  detail: string;
}

export interface StreamValidationResult {
  valid: boolean;
  error: string | null;
  checks: PreFlightCheckItem[];
}

export function validateStreamPreFlight(
  channel: Pick<
    ChannelConfig,
    | 'id'
    | 'streamMode'
    | 'streamKey'
    | 'rtmpUrl'
    | 'playlist'
    | 'durationValue'
    | 'durationUnit'
    | 'infiniteLoop'
  >,
  availableVideos: VideoAsset[]
): StreamValidationResult {
  const channelVideos = getVideosForChannel(availableVideos, channel.id).filter(
    (v) => v.status === 'ready'
  );
  const hasUploadedVideo = channelVideos.length > 0;

  const videoIds = new Set(channelVideos.map((v) => v.id));
  const enabledPlaylist = channel.playlist.filter(
    (item) => item.enabled && videoIds.has(item.videoId)
  );
  const hasPlaylistReady = hasUploadedVideo && enabledPlaylist.length > 0;

  const cleanUrl = (channel.rtmpUrl || '').trim();
  const cleanKey = (channel.streamKey || '').trim();
  const validUrl = cleanUrl.startsWith('rtmp://') || cleanUrl.startsWith('rtmps://');
  const validKey = cleanKey.length >= 6;
  const hasStreamKeyReady = validUrl && validKey;

  const computedMinutes = computeAutoStopMinutes(
    channel.durationValue,
    channel.durationUnit,
    channel.infiniteLoop
  );
  const hasTimerReady =
    channel.infiniteLoop ||
    (channel.durationValue > 0 && computedMinutes > 0 && computedMinutes <= 10080);

  const checks: PreFlightCheckItem[] = [
    {
      id: 'video_uploaded',
      label: 'Video Library',
      passed: hasUploadedVideo,
      detail: hasUploadedVideo
        ? `${channelVideos.length} video(s) ready for this channel`
        : 'Upload at least 1 video for this channel'
    },
    {
      id: 'playlist_ready',
      label: 'Playlist Queue',
      passed: hasPlaylistReady,
      detail: hasPlaylistReady
        ? `${enabledPlaylist.length} video(s) active in queue`
        : 'Add at least 1 video to the playlist'
    },
    {
      id: 'stream_key_ready',
      label: 'Stream URL & Key',
      passed: hasStreamKeyReady,
      detail: hasStreamKeyReady
        ? `Verified (${cleanKey.slice(0, 3)}***)`
        : 'Enter RTMP URL and Stream Key'
    },
    {
      id: 'timer_ready',
      label: 'Stream Timer',
      passed: hasTimerReady,
      detail: hasTimerReady
        ? channel.infiniteLoop
          ? '24/7 Non-Stop Loop'
          : `${channel.durationValue} ${channel.durationUnit} (${computedMinutes} min)`
        : 'Set duration in Minutes or Hours'
    }
  ];

  if (!hasUploadedVideo) {
    return {
      valid: false,
      error: 'No videos found for this channel. Please upload a video in the Videos tab first.',
      checks
    };
  }

  if (!hasPlaylistReady) {
    return {
      valid: false,
      error: 'Playlist queue is empty. Please add a video in the Playlist tab first.',
      checks
    };
  }

  if (!validUrl) {
    return {
      valid: false,
      error: 'Invalid RTMP Stream URL. Must start with rtmp:// or rtmps://.',
      checks
    };
  }

  if (!validKey) {
    return {
      valid: false,
      error: 'Stream Key is required (minimum 6 characters) before starting Live or Test Mode.',
      checks
    };
  }

  if (!hasTimerReady) {
    return {
      valid: false,
      error: 'Please enter a valid duration greater than 0 in Minutes or Hours.',
      checks
    };
  }

  return {
    valid: true,
    error: null,
    checks
  };
}

export function getCurrentAndNextVideo(
  channel: Pick<ChannelConfig, 'id' | 'playlist' | 'currentVideoIndex' | 'loopMode'>,
  videos: VideoAsset[]
): { currentVideo: VideoAsset | null; nextVideo: VideoAsset | null; activeCount: number } {
  const channelVideos = getVideosForChannel(videos, channel.id);
  const activeVideos = channel.playlist
    .filter((item) => item.enabled)
    .map((item) => channelVideos.find((v) => v.id === item.videoId))
    .filter((v): v is VideoAsset => Boolean(v));

  if (activeVideos.length === 0) {
    return { currentVideo: null, nextVideo: null, activeCount: 0 };
  }

  const safeIdx = Math.max(0, channel.currentVideoIndex) % activeVideos.length;
  const currentVideo = activeVideos[safeIdx];

  if (channel.loopMode === 'single_video' || activeVideos.length === 1) {
    return { currentVideo, nextVideo: currentVideo, activeCount: activeVideos.length };
  }

  const nextIdx = (safeIdx + 1) % activeVideos.length;
  return { currentVideo, nextVideo: activeVideos[nextIdx], activeCount: activeVideos.length };
}
