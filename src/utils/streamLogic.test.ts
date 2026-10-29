import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAutoStopMinutes,
  calculateStorageStats,
  formatBytes,
  formatDuration,
  buildFfmpegConcatList,
  buildFfmpegArgs,
  validateStreamPreFlight,
  getCurrentAndNextVideo,
  getVideosForChannel,
  type VideoAsset
} from './streamLogic';

const sampleVideos: VideoAsset[] = [
  {
    id: 'vid-1',
    channelId: 'ch-1',
    title: 'Lofi Study Loop Part 1.mp4',
    filename: 'sample_loop_1.mp4',
    sizeBytes: 524288000,
    durationSec: 1800,
    resolution: '1920x1080',
    fps: 30,
    codec: 'H.264 / AAC',
    status: 'ready',
    uploadedAt: '2026-10-28T10:00:00Z'
  },
  {
    id: 'vid-2',
    channelId: 'ch-1',
    title: 'Ambient Rain Loop Part 2.mp4',
    filename: 'sample_loop_2.mp4',
    sizeBytes: 1073741824,
    durationSec: 3600,
    resolution: '1920x1080',
    fps: 30,
    codec: 'H.264 / AAC',
    status: 'ready',
    uploadedAt: '2026-10-28T11:00:00Z'
  },
  {
    id: 'vid-ch2',
    channelId: 'ch-2',
    title: 'Channel 2 Exclusive Video.mp4',
    filename: 'sample_ch2.mp4',
    sizeBytes: 204800000,
    durationSec: 900,
    resolution: '1280x720',
    fps: 30,
    codec: 'H.264 / AAC',
    status: 'ready',
    uploadedAt: '2026-10-28T12:00:00Z'
  }
];

test('computeAutoStopMinutes converts 1 minute to 1 and 1 hour to 60 accurately', () => {
  assert.equal(computeAutoStopMinutes(1, 'minutes', false), 1);
  assert.equal(computeAutoStopMinutes(5, 'minutes', false), 5);
  assert.equal(computeAutoStopMinutes(1, 'hours', false), 60);
  assert.equal(computeAutoStopMinutes(12, 'hours', false), 720);
  assert.equal(computeAutoStopMinutes(5, 'hours', true), 0);
});

test('getVideosForChannel strictly isolates videos per channelId', () => {
  const ch1Vids = getVideosForChannel(sampleVideos, 'ch-1');
  const ch2Vids = getVideosForChannel(sampleVideos, 'ch-2');
  assert.equal(ch1Vids.length, 2);
  assert.equal(ch2Vids.length, 1);
  assert.equal(ch2Vids[0].id, 'vid-ch2');
});

test('validateStreamPreFlight blocks both test_loop and youtube_rtmp if video, playlist, stream key, or timer is missing, and enforces channel video ownership', () => {
  // Channel 3 has 0 videos even though ch-1 and ch-2 have videos
  const wrongChannelCheck = validateStreamPreFlight(
    {
      id: 'ch-3',
      streamMode: 'test_loop',
      streamKey: 'abcd-1234-efgh',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      playlist: [{ id: 'p1', videoId: 'vid-1', enabled: true, repeatCount: 1 }],
      durationValue: 5,
      durationUnit: 'minutes',
      infiniteLoop: false
    },
    sampleVideos
  );
  assert.equal(wrongChannelCheck.valid, false);
  assert.equal(wrongChannelCheck.checks[0].passed, false);

  // Missing stream key in test_loop mode
  const missingKeyInTestMode = validateStreamPreFlight(
    {
      id: 'ch-1',
      streamMode: 'test_loop',
      streamKey: '',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      playlist: [{ id: 'p1', videoId: 'vid-1', enabled: true, repeatCount: 1 }],
      durationValue: 5,
      durationUnit: 'minutes',
      infiniteLoop: false
    },
    sampleVideos
  );
  assert.equal(missingKeyInTestMode.valid, false);
  assert.equal(missingKeyInTestMode.checks[2].passed, false);

  // All 4 checks pass for ch-1
  const allValidCheck = validateStreamPreFlight(
    {
      id: 'ch-1',
      streamMode: 'youtube_rtmp',
      streamKey: 'abcd-1234-efgh',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      playlist: [{ id: 'p1', videoId: 'vid-1', enabled: true, repeatCount: 1 }],
      durationValue: 1,
      durationUnit: 'hours',
      infiniteLoop: false
    },
    sampleVideos
  );
  assert.equal(allValidCheck.valid, true);
  assert.equal(allValidCheck.checks.every((c) => c.passed), true);
});

test('getCurrentAndNextVideo returns current and next video based on loopMode and channelId', () => {
  const multi = getCurrentAndNextVideo(
    {
      id: 'ch-1',
      playlist: [
        { id: 'p1', videoId: 'vid-1', enabled: true, repeatCount: 1 },
        { id: 'p2', videoId: 'vid-2', enabled: true, repeatCount: 1 }
      ],
      currentVideoIndex: 0,
      loopMode: 'multi_playlist'
    },
    sampleVideos
  );
  assert.equal(multi.currentVideo?.id, 'vid-1');
  assert.equal(multi.nextVideo?.id, 'vid-2');

  const single = getCurrentAndNextVideo(
    {
      id: 'ch-1',
      playlist: [
        { id: 'p1', videoId: 'vid-1', enabled: true, repeatCount: 1 },
        { id: 'p2', videoId: 'vid-2', enabled: true, repeatCount: 1 }
      ],
      currentVideoIndex: 0,
      loopMode: 'single_video'
    },
    sampleVideos
  );
  assert.equal(single.currentVideo?.id, 'vid-1');
  assert.equal(single.nextVideo?.id, 'vid-1');
});

test('calculateStorageStats, formatDuration, and buildFfmpegArgs work accurately', () => {
  const stats = calculateStorageStats(sampleVideos, 5);
  assert.equal(stats.videoCount, 3);
  assert.equal(formatDuration(3600), '01:00:00');
  assert.equal(formatBytes(10485760), '10.0 MB');
  assert.equal(
    buildFfmpegConcatList(['/data/v1.mp4']),
    "ffconcat version 1.0\nfile '/data/v1.mp4'\n"
  );

  const args = buildFfmpegArgs({
    concatFilePath: '/tmp/ch1.txt',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    streamKey: 'live-key-9999',
    streamMode: 'youtube_rtmp',
    encodingQuality: '1080p',
    autoStopMinutes: 60
  });
  assert.equal(args.includes('-t'), true);
  assert.equal(args.includes('3600'), true);
  assert.equal(args.includes('1920x1080'), true);
});
