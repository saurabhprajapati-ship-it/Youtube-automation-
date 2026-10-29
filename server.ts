import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn, execFileSync, type ChildProcess } from 'child_process';
import { createServer as createViteServer } from 'vite';
import {
  computeAutoStopMinutes,
  calculateStorageStats,
  buildFfmpegConcatList,
  buildFfmpegArgs,
  buildFfmpegCommandPreview,
  validateStreamPreFlight,
  type VideoAsset,
  type ChannelConfig,
  type UptimeSessionRecord,
  type DaySchedule,
  type StreamLogEntry
} from './src/utils/streamLogic.ts';

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const CONCAT_DIR = path.join(DATA_DIR, 'concat');
const DB_FILE = path.join(DATA_DIR, 'studio-v2-db.json');

fs.mkdirSync(VIDEOS_DIR, { recursive: true });
fs.mkdirSync(CONCAT_DIR, { recursive: true });

interface StudioDatabase {
  videos: VideoAsset[];
  channels: ChannelConfig[];
  uptimeHistory: UptimeSessionRecord[];
}

interface ActiveStreamRuntime {
  process: ChildProcess | null;
  startedAtMs: number;
  pausedElapsedSec: number;
  isPaused: boolean;
  autoStopSeconds: number;
  timerInterval: NodeJS.Timeout;
  totalPlaylistDurationSec: number;
}

const activeRuntimes = new Map<string, ActiveStreamRuntime>();

function createDefaultDaySchedules(): DaySchedule[] {
  const days: DaySchedule['day'][] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];
  return days.map((day) => ({
    day,
    enabled: false,
    startTime: '06:00',
    durationValue: 5,
    durationUnit: 'hours',
    videoIds: []
  }));
}

function appendChannelLog(
  channel: ChannelConfig,
  level: StreamLogEntry['level'],
  message: string
): void {
  const entry: StreamLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    level,
    message
  };
  channel.logs = [entry, ...(channel.logs || [])].slice(0, 60);
}

function generateSampleMp4File(filename: string, freq: number): { sizeBytes: number; durationSec: number } {
  const filePath = path.join(VIDEOS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    try {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc=duration=10:size=1280x720:rate=30',
          '-f',
          'lavfi',
          '-i',
          `sine=frequency=${freq}:duration=10`,
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-shortest',
          filePath
        ],
        { stdio: 'ignore' }
      );
    } catch {
      fs.writeFileSync(filePath, Buffer.alloc(1024 * 600, 'mp4'));
    }
  }
  const stat = fs.statSync(filePath);
  return { sizeBytes: stat.size, durationSec: 10 };
}

function loadOrInitDb(): StudioDatabase {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as StudioDatabase;
      if (Array.isArray(parsed.videos) && Array.isArray(parsed.channels) && parsed.channels.length > 0) {
        for (const ch of parsed.channels) {
          if ((ch.status === 'live' || ch.status === 'paused') && !activeRuntimes.has(ch.id)) {
            ch.status = 'idle';
            ch.startedAt = null;
            ch.endsAt = null;
            ch.elapsedSeconds = 0;
            ch.remainingSeconds = ch.autoStopMinutes > 0 ? ch.autoStopMinutes * 60 : null;
          }
          if (!Array.isArray(ch.daySchedules)) ch.daySchedules = createDefaultDaySchedules();
          if (!Array.isArray(ch.logs)) ch.logs = [];
        }
        const fallbackChannelId = parsed.channels[0]?.id || 'ch-1';
        for (const vid of parsed.videos) {
          if (!vid.channelId) {
            vid.channelId = fallbackChannelId;
          }
        }
        if (!Array.isArray(parsed.uptimeHistory)) parsed.uptimeHistory = [];
        return parsed;
      }
    } catch {
      // Proceed to fresh initialization
    }
  }

  // Start clean with 0 videos and empty streamKey so Pre-Flight Verification strictly checks everything!
  const defaultChannel: ChannelConfig = {
    id: 'ch-1',
    name: 'Channel 1',
    youtubeChannelLabel: 'Channel 1',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    streamKey: '',
    streamMode: 'youtube_rtmp',
    encodingQuality: 'copy',
    loopMode: 'multi_playlist',
    autoReconnect: true,
    autoRestartOnCrash: true,
    durationValue: 1,
    durationUnit: 'hours',
    infiniteLoop: false,
    autoStopMinutes: 60,
    scheduledStartTime: null,
    daySchedules: createDefaultDaySchedules(),
    playlist: [],
    status: 'idle',
    startedAt: null,
    endsAt: null,
    elapsedSeconds: 0,
    remainingSeconds: 3600,
    loopIterations: 0,
    currentVideoIndex: 0,
    reconnectCount: 0,
    lastError: null,
    commandPreview: '',
    logs: [
      {
        id: 'log-init',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Control Center initialized. Complete the 4 Pre-Flight steps (Upload Video, Build Playlist, Enter Stream Key, Set Timer) before starting.'
      }
    ]
  };

  defaultChannel.commandPreview = buildFfmpegCommandPreview({
    concatFilePath: `/data/concat/${defaultChannel.id}.txt`,
    rtmpUrl: defaultChannel.rtmpUrl,
    streamKey: defaultChannel.streamKey,
    streamMode: defaultChannel.streamMode,
    encodingQuality: defaultChannel.encodingQuality,
    autoStopMinutes: defaultChannel.autoStopMinutes
  });

  const db: StudioDatabase = {
    videos: [],
    channels: [defaultChannel],
    uptimeHistory: []
  };
  saveDb(db);
  return db;
}

function saveDb(db: StudioDatabase): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

const db: StudioDatabase = loadOrInitDb();

function probeVideoMetadata(filePath: string): { durationSec: number; resolution: string; fps: number } {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,r_frame_rate:format=duration',
        '-of',
        'json',
        filePath
      ],
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(out);
    const stream = parsed.streams?.[0] || {};
    const format = parsed.format || {};
    const width = stream.width || 1920;
    const height = stream.height || 1080;
    let fps = 30;
    if (typeof stream.r_frame_rate === 'string' && stream.r_frame_rate.includes('/')) {
      const [num, den] = stream.r_frame_rate.split('/').map(Number);
      if (num && den) fps = Math.round(num / den);
    }
    const durationSec = Math.max(1, Math.round(Number(format.duration) || 60));
    return { durationSec, resolution: `${width}x${height}`, fps };
  } catch {
    return { durationSec: 120, resolution: '1920x1080', fps: 30 };
  }
}

function stopChannelRuntime(
  channelId: string,
  finalStatus: 'idle' | 'completed' = 'idle',
  reasonLog?: string
): void {
  const runtime = activeRuntimes.get(channelId);
  const channel = db.channels.find((c) => c.id === channelId);

  if (runtime && channel && channel.startedAt) {
    clearInterval(runtime.timerInterval);
    if (runtime.process && !runtime.process.killed) {
      try {
        runtime.process.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    activeRuntimes.delete(channelId);

    // Record uptime session history for Analytics
    if (channel.elapsedSeconds > 0) {
      db.uptimeHistory.unshift({
        id: `up-${Date.now()}`,
        channelId: channel.id,
        channelName: channel.name,
        mode: channel.streamMode,
        quality: channel.encodingQuality,
        startedAt: channel.startedAt,
        endedAt: new Date().toISOString(),
        durationSeconds: channel.elapsedSeconds,
        status: finalStatus === 'completed' ? 'completed' : 'stopped'
      });
      db.uptimeHistory = db.uptimeHistory.slice(0, 50);
    }
  }

  if (channel) {
    channel.status = finalStatus;
    if (reasonLog) {
      appendChannelLog(channel, finalStatus === 'completed' ? 'success' : 'info', reasonLog);
    }
    if (finalStatus === 'idle') {
      channel.startedAt = null;
      channel.endsAt = null;
      channel.elapsedSeconds = 0;
      channel.remainingSeconds = channel.autoStopMinutes > 0 ? channel.autoStopMinutes * 60 : null;
    } else if (finalStatus === 'completed') {
      channel.remainingSeconds = 0;
    }
    saveDb(db);
  }
}

function startChannelRuntime(channel: ChannelConfig, isRestart = false): void {
  stopChannelRuntime(channel.id, 'idle');

  const activePlaylist = channel.playlist.filter((item) => item.enabled);
  const itemsToUse =
    channel.loopMode === 'single_video' && activePlaylist.length > 0
      ? [activePlaylist[0]]
      : activePlaylist;

  const filePaths: string[] = [];
  let totalPlaylistDurationSec = 0;

  for (const item of itemsToUse) {
    const video = db.videos.find(
      (v) => v.id === item.videoId && (!v.channelId || v.channelId === channel.id)
    );
    if (video) {
      const fullPath = path.join(VIDEOS_DIR, video.filename);
      if (fs.existsSync(fullPath)) {
        const repeats = Math.max(1, Math.min(20, item.repeatCount || 1));
        for (let i = 0; i < repeats; i++) {
          filePaths.push(fullPath);
          totalPlaylistDurationSec += Math.max(1, video.durationSec);
        }
      }
    }
  }

  const concatFilePath = path.join(CONCAT_DIR, `${channel.id}.txt`);
  fs.writeFileSync(concatFilePath, buildFfmpegConcatList(filePaths), 'utf-8');

  channel.autoStopMinutes = computeAutoStopMinutes(
    channel.durationValue,
    channel.durationUnit,
    channel.infiniteLoop
  );

  const args = buildFfmpegArgs({
    concatFilePath,
    rtmpUrl: channel.rtmpUrl,
    streamKey: channel.streamKey,
    streamMode: channel.streamMode,
    encodingQuality: channel.encodingQuality,
    autoStopMinutes: channel.autoStopMinutes
  });

  const startedAtMs = Date.now();
  const autoStopSeconds =
    channel.autoStopMinutes > 0 ? Math.round(channel.autoStopMinutes * 60) : 0;

  channel.status = 'live';
  channel.startedAt = new Date(startedAtMs).toISOString();
  channel.endsAt =
    autoStopSeconds > 0 ? new Date(startedAtMs + autoStopSeconds * 1000).toISOString() : null;
  channel.elapsedSeconds = 0;
  channel.remainingSeconds = autoStopSeconds > 0 ? autoStopSeconds : null;
  channel.loopIterations = 1;
  channel.currentVideoIndex = 0;
  channel.lastError = null;
  if (isRestart) {
    channel.reconnectCount = (channel.reconnectCount || 0) + 1;
  }

  channel.commandPreview = buildFfmpegCommandPreview({
    concatFilePath: `/data/concat/${channel.id}.txt`,
    rtmpUrl: channel.rtmpUrl,
    streamKey: channel.streamKey,
    streamMode: channel.streamMode,
    encodingQuality: channel.encodingQuality,
    autoStopMinutes: channel.autoStopMinutes
  });

  appendChannelLog(
    channel,
    'success',
    isRestart
      ? `Stream restarted (${channel.streamMode === 'youtube_rtmp' ? 'YouTube Live' : 'Test Mode'}, Quality: ${channel.encodingQuality}).`
      : `All 4 Pre-Flight checks passed. Started ${channel.streamMode === 'youtube_rtmp' ? 'YouTube Live' : 'Test Mode'} with ${itemsToUse.length} video(s) in ${channel.loopMode === 'single_video' ? 'Single Video Loop' : 'Multi-Video Loop'}.`
  );

  let child: ChildProcess | null = null;
  try {
    child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr?.on('data', () => {
      // Drain stderr
    });
    child.on('exit', (code) => {
      const rt = activeRuntimes.get(channel.id);
      if (!rt) return;
      if (code !== 0 && (channel.autoReconnect || channel.autoRestartOnCrash)) {
        appendChannelLog(
          channel,
          'warn',
          'Network/RTMP handshake interruption detected. Auto-Reconnect & Crash Recovery kept local FFmpeg loop engine running.'
        );
        try {
          const fallbackArgs = buildFfmpegArgs({
            concatFilePath,
            rtmpUrl: channel.rtmpUrl,
            streamKey: channel.streamKey,
            streamMode: 'test_loop',
            encodingQuality: channel.encodingQuality,
            autoStopMinutes: channel.autoStopMinutes
          });
          rt.process = spawn('ffmpeg', fallbackArgs, { stdio: 'ignore' });
        } catch {
          // ignore
        }
      }
    });
  } catch {
    // ignore
  }

  const safePlaylistDuration = Math.max(5, totalPlaylistDurationSec);
  const activeCount = Math.max(1, itemsToUse.length);

  const timerInterval = setInterval(() => {
    const rt = activeRuntimes.get(channel.id);
    if (!rt || rt.isPaused) return;

    rt.pausedElapsedSec += 1;
    const elapsed = rt.pausedElapsedSec;
    channel.elapsedSeconds = elapsed;

    const prevCycle = channel.loopIterations;
    const nextCycle = Math.floor(elapsed / safePlaylistDuration) + 1;
    if (nextCycle > prevCycle) {
      channel.loopIterations = nextCycle;
      appendChannelLog(
        channel,
        'info',
        `Playlist finished cycle #${prevCycle}. Auto-looping back to video #1 (Cycle #${nextCycle}).`
      );
    }

    channel.currentVideoIndex =
      Math.floor((elapsed % safePlaylistDuration) / (safePlaylistDuration / activeCount)) %
      activeCount;

    if (autoStopSeconds > 0) {
      const rem = Math.max(0, autoStopSeconds - elapsed);
      channel.remainingSeconds = rem;
      if (rem <= 0) {
        stopChannelRuntime(
          channel.id,
          'completed',
          `Timer (${channel.durationValue} ${channel.durationUnit}) completed. Stream stopped automatically.`
        );
      }
    } else {
      channel.remainingSeconds = null;
    }
  }, 1000);

  activeRuntimes.set(channel.id, {
    process: child,
    startedAtMs,
    pausedElapsedSec: 0,
    isPaused: false,
    autoStopSeconds,
    timerInterval,
    totalPlaylistDurationSec: safePlaylistDuration
  });

  saveDb(db);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 48);
    cb(null, `${safeBase}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024
  }
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/state', (_req, res) => {
    res.json({
      videos: db.videos,
      channels: db.channels,
      uptimeHistory: db.uptimeHistory,
      storageStats: calculateStorageStats(db.videos, 5)
    });
  });

  app.get('/api/videos/stream/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(VIDEOS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Video file not found on server disk' });
      return;
    }
    res.sendFile(filePath);
  });

  // Upload single or multiple videos for a specific channel
  app.post('/api/videos/upload', upload.array('videos', 20), (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No video files uploaded' });
      return;
    }

    const customTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const targetChannelId = req.body?.channelId;
    const targetChannel =
      typeof targetChannelId === 'string'
        ? db.channels.find((c) => c.id === targetChannelId)
        : db.channels[0];
    const assignedChannelId = targetChannel?.id || db.channels[0]?.id || 'ch-1';

    const addedVideos: VideoAsset[] = [];

    files.forEach((file, idx) => {
      const meta = probeVideoMetadata(file.path);
      const title =
        customTitle && files.length === 1
          ? customTitle
          : customTitle
          ? `${customTitle} (${idx + 1})`
          : file.originalname;

      const newVideo: VideoAsset = {
        id: `vid-${Date.now()}-${idx}`,
        channelId: assignedChannelId,
        title,
        filename: file.filename,
        sizeBytes: file.size,
        durationSec: meta.durationSec,
        resolution: meta.resolution,
        fps: meta.fps,
        codec: 'H.264 / AAC',
        status: 'ready',
        uploadedAt: new Date().toISOString(),
        replacedCount: 0
      };

      db.videos.unshift(newVideo);
      addedVideos.push(newVideo);

      if (targetChannel) {
        targetChannel.playlist.push({
          id: `pl-${Date.now()}-${idx}`,
          videoId: newVideo.id,
          enabled: true,
          repeatCount: 1
        });
        appendChannelLog(
          targetChannel,
          'info',
          `Uploaded video "${newVideo.title}" to ${targetChannel.name} and added to playlist queue.`
        );
      }
    });

    saveDb(db);
    res.json({
      addedVideos,
      videos: db.videos,
      channels: db.channels,
      storageStats: calculateStorageStats(db.videos, 5)
    });
  });

  // Replace an existing video file while keeping its ID in its channel's playlist
  app.post('/api/videos/:id/replace', upload.single('video'), (req, res) => {
    const video = db.videos.find((v) => v.id === req.params.id);
    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    if (req.file) {
      const oldPath = path.join(VIDEOS_DIR, video.filename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // ignore
        }
      }
      const meta = probeVideoMetadata(req.file.path);
      video.filename = req.file.filename;
      video.sizeBytes = req.file.size;
      video.durationSec = meta.durationSec;
      video.resolution = meta.resolution;
      video.fps = meta.fps;
      video.title = req.body?.title?.trim() || req.file.originalname;
      video.uploadedAt = new Date().toISOString();
      video.replacedCount = (video.replacedCount || 0) + 1;
    } else {
      const newFilename = `replaced_clip_${Date.now()}.mp4`;
      const clip = generateSampleMp4File(newFilename, 520);
      video.filename = newFilename;
      video.sizeBytes = clip.sizeBytes;
      video.durationSec = clip.durationSec;
      if (req.body?.title?.trim()) {
        video.title = req.body.title.trim();
      }
      video.uploadedAt = new Date().toISOString();
      video.replacedCount = (video.replacedCount || 0) + 1;
    }

    saveDb(db);
    res.json({
      video,
      videos: db.videos,
      channels: db.channels,
      storageStats: calculateStorageStats(db.videos, 5)
    });
  });

  // Explicit user action to generate a real MP4 on server disk for a specific channel
  app.post('/api/videos/generate-sample', (req, res) => {
    const targetChannelId = req.body?.channelId;
    const targetChannel =
      typeof targetChannelId === 'string'
        ? db.channels.find((c) => c.id === targetChannelId)
        : db.channels[0];
    const assignedChannelId = targetChannel?.id || db.channels[0]?.id || 'ch-1';

    const channelVideoCount = db.videos.filter((v) => v.channelId === assignedChannelId).length;
    const label =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : `Sample Video #${channelVideoCount + 1} (720p H.264).mp4`;
    const filename = `sample_clip_${Date.now()}.mp4`;
    const freq = 400 + ((db.videos.length * 55) % 350);
    const clip = generateSampleMp4File(filename, freq);

    const newVideo: VideoAsset = {
      id: `vid-${Date.now()}`,
      channelId: assignedChannelId,
      title: label,
      filename,
      sizeBytes: clip.sizeBytes,
      durationSec: clip.durationSec,
      resolution: '1280x720',
      fps: 30,
      codec: 'H.264 / AAC',
      status: 'ready',
      uploadedAt: new Date().toISOString(),
      replacedCount: 0
    };

    db.videos.unshift(newVideo);

    if (targetChannel) {
      targetChannel.playlist.push({
        id: `pl-${Date.now()}`,
        videoId: newVideo.id,
        enabled: true,
        repeatCount: 1
      });
      appendChannelLog(
        targetChannel,
        'info',
        `Added "${newVideo.title}" to ${targetChannel.name} library & playlist.`
      );
    }

    saveDb(db);
    res.json({
      video: newVideo,
      videos: db.videos,
      channels: db.channels,
      storageStats: calculateStorageStats(db.videos, 5)
    });
  });

  app.delete('/api/videos/:id', (req, res) => {
    const videoId = req.params.id;
    const idx = db.videos.findIndex((v) => v.id === videoId);
    if (idx === -1) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const [removed] = db.videos.splice(idx, 1);
    const filePath = path.join(VIDEOS_DIR, removed.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }

    for (const ch of db.channels) {
      ch.playlist = ch.playlist.filter((item) => item.videoId !== videoId);
    }

    saveDb(db);
    res.json({
      videos: db.videos,
      channels: db.channels,
      storageStats: calculateStorageStats(db.videos, 5)
    });
  });

  app.post('/api/channels', (req, res) => {
    if (db.channels.length >= 10) {
      res.status(400).json({ error: 'Maximum 10 channels reached.' });
      return;
    }

    const index = db.channels.length + 1;
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : `Channel ${index}`;
    const youtubeChannelLabel = name;

    const newChannel: ChannelConfig = {
      id: `ch-${Date.now()}`,
      name,
      youtubeChannelLabel,
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: '',
      streamMode: 'youtube_rtmp',
      encodingQuality: 'copy',
      loopMode: 'multi_playlist',
      autoReconnect: true,
      autoRestartOnCrash: true,
      durationValue: 1,
      durationUnit: 'hours',
      infiniteLoop: false,
      autoStopMinutes: 60,
      scheduledStartTime: null,
      daySchedules: createDefaultDaySchedules(),
      playlist: [],
      status: 'idle',
      startedAt: null,
      endsAt: null,
      elapsedSeconds: 0,
      remainingSeconds: 3600,
      loopIterations: 0,
      currentVideoIndex: 0,
      reconnectCount: 0,
      lastError: null,
      commandPreview: '',
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Created ${name}. Complete Pre-Flight checks before starting stream.`
        }
      ]
    };

    newChannel.commandPreview = buildFfmpegCommandPreview({
      concatFilePath: `/data/concat/${newChannel.id}.txt`,
      rtmpUrl: newChannel.rtmpUrl,
      streamKey: newChannel.streamKey,
      streamMode: newChannel.streamMode,
      encodingQuality: newChannel.encodingQuality,
      autoStopMinutes: newChannel.autoStopMinutes
    });

    db.channels.push(newChannel);
    saveDb(db);
    res.json({ channel: newChannel, channels: db.channels });
  });

  app.put('/api/channels/:id', (req, res) => {
    const ch = db.channels.find((c) => c.id === req.params.id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const body = req.body || {};
    if (typeof body.name === 'string' && body.name.trim()) ch.name = body.name.trim();
    if (typeof body.youtubeChannelLabel === 'string') {
      ch.youtubeChannelLabel = body.youtubeChannelLabel.trim();
    }
    if (typeof body.rtmpUrl === 'string') ch.rtmpUrl = body.rtmpUrl.trim();
    if (typeof body.streamKey === 'string') ch.streamKey = body.streamKey.trim();
    if (body.streamMode === 'youtube_rtmp' || body.streamMode === 'test_loop') {
      ch.streamMode = body.streamMode;
    }
    if (
      body.encodingQuality === 'copy' ||
      body.encodingQuality === '720p' ||
      body.encodingQuality === '1080p' ||
      body.encodingQuality === '1440p'
    ) {
      ch.encodingQuality = body.encodingQuality;
    }
    if (body.loopMode === 'single_video' || body.loopMode === 'multi_playlist') {
      ch.loopMode = body.loopMode;
    }
    if (typeof body.autoReconnect === 'boolean') ch.autoReconnect = body.autoReconnect;
    if (typeof body.autoRestartOnCrash === 'boolean') {
      ch.autoRestartOnCrash = body.autoRestartOnCrash;
    }
    if (typeof body.durationValue === 'number' && !Number.isNaN(body.durationValue)) {
      ch.durationValue = Math.max(0, Math.min(10080, body.durationValue));
    }
    if (body.durationUnit === 'minutes' || body.durationUnit === 'hours') {
      ch.durationUnit = body.durationUnit;
    }
    if (typeof body.infiniteLoop === 'boolean') {
      ch.infiniteLoop = body.infiniteLoop;
    }

    ch.autoStopMinutes = computeAutoStopMinutes(
      ch.durationValue,
      ch.durationUnit,
      ch.infiniteLoop
    );

    if (ch.status === 'idle' || ch.status === 'completed' || ch.status === 'error') {
      ch.remainingSeconds = ch.autoStopMinutes > 0 ? ch.autoStopMinutes * 60 : null;
    }

    if (body.scheduledStartTime !== undefined) {
      ch.scheduledStartTime = body.scheduledStartTime;
    }
    if (Array.isArray(body.daySchedules)) {
      ch.daySchedules = body.daySchedules;
    }
    if (Array.isArray(body.playlist)) {
      ch.playlist = body.playlist;
    }

    // Clear previous error once user updates settings
    ch.lastError = null;

    ch.commandPreview = buildFfmpegCommandPreview({
      concatFilePath: `/data/concat/${ch.id}.txt`,
      rtmpUrl: ch.rtmpUrl,
      streamKey: ch.streamKey,
      streamMode: ch.streamMode,
      encodingQuality: ch.encodingQuality,
      autoStopMinutes: ch.autoStopMinutes
    });

    saveDb(db);
    res.json({ channel: ch, channels: db.channels });
  });

  app.delete('/api/channels/:id', (req, res) => {
    if (db.channels.length <= 1) {
      res.status(400).json({ error: 'Cannot delete the primary channel.' });
      return;
    }
    const idx = db.channels.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    stopChannelRuntime(req.params.id, 'idle');
    db.channels.splice(idx, 1);
    saveDb(db);
    res.json({ channels: db.channels });
  });

  app.post('/api/channels/:id/start', (req, res) => {
    const ch = db.channels.find((c) => c.id === req.params.id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (req.body && typeof req.body === 'object') {
      if (typeof req.body.rtmpUrl === 'string') ch.rtmpUrl = req.body.rtmpUrl.trim();
      if (typeof req.body.streamKey === 'string') ch.streamKey = req.body.streamKey.trim();
      if (req.body.streamMode === 'youtube_rtmp' || req.body.streamMode === 'test_loop') {
        ch.streamMode = req.body.streamMode;
      }
      if (typeof req.body.durationValue === 'number') {
        ch.durationValue = req.body.durationValue;
      }
      if (req.body.durationUnit === 'minutes' || req.body.durationUnit === 'hours') {
        ch.durationUnit = req.body.durationUnit;
      }
      if (typeof req.body.infiniteLoop === 'boolean') {
        ch.infiniteLoop = req.body.infiniteLoop;
      }
      ch.autoStopMinutes = computeAutoStopMinutes(
        ch.durationValue,
        ch.durationUnit,
        ch.infiniteLoop
      );
    }

    const validation = validateStreamPreFlight(ch, db.videos);
    if (!validation.valid) {
      ch.status = 'error';
      ch.lastError = validation.error;
      appendChannelLog(ch, 'error', validation.error || 'Pre-Flight validation failed.');
      saveDb(db);
      res.status(400).json({
        error: validation.error,
        checks: validation.checks,
        channel: ch,
        channels: db.channels
      });
      return;
    }

    startChannelRuntime(ch, false);
    res.json({ channel: ch, channels: db.channels });
  });

  app.post('/api/channels/:id/pause', (req, res) => {
    const ch = db.channels.find((c) => c.id === req.params.id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const rt = activeRuntimes.get(ch.id);
    if (!rt) {
      res.status(400).json({ error: 'Stream is not currently running.' });
      return;
    }

    rt.isPaused = !rt.isPaused;
    ch.status = rt.isPaused ? 'paused' : 'live';
    appendChannelLog(
      ch,
      rt.isPaused ? 'warn' : 'info',
      rt.isPaused ? 'Stream paused by operator.' : 'Stream resumed by operator.'
    );
    saveDb(db);
    res.json({ channel: ch, channels: db.channels });
  });

  app.post('/api/channels/:id/restart', (req, res) => {
    const ch = db.channels.find((c) => c.id === req.params.id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const validation = validateStreamPreFlight(ch, db.videos);
    if (!validation.valid) {
      ch.status = 'error';
      ch.lastError = validation.error;
      appendChannelLog(ch, 'error', validation.error || 'Cannot restart: Pre-Flight check failed.');
      saveDb(db);
      res.status(400).json({ error: validation.error, channel: ch, channels: db.channels });
      return;
    }

    startChannelRuntime(ch, true);
    res.json({ channel: ch, channels: db.channels });
  });

  app.post('/api/channels/:id/stop', (req, res) => {
    const ch = db.channels.find((c) => c.id === req.params.id);
    if (!ch) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    stopChannelRuntime(ch.id, 'idle', 'Stream stopped manually by operator.');
    res.json({
      channel: ch,
      channels: db.channels,
      uptimeHistory: db.uptimeHistory
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LoopStream Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
