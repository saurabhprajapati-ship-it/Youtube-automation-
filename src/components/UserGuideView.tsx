import React from 'react';
import { BookOpen, Film, ListVideo, Radio, CheckCircle2, ArrowLeft } from 'lucide-react';

interface UserGuideViewProps {
  onBackToApp: () => void;
}

export const UserGuideView: React.FC<UserGuideViewProps> = ({ onBackToApp }) => {
  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden" data-testid="user-guide-view">
      <div className="clay-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 clay-inset flex items-center justify-center text-blue-600 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                LoopStream Studio — User Guide
              </h2>
              <p className="text-xs text-slate-500">
                Complete step-by-step guide on how every section works
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToApp}
            className="clay-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Control
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-sm">
              <Film className="w-4 h-4" />
              <span>1. Per-Channel Video Library (Videos Tab)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Each channel (Channel 1 to Channel 10) has its own isolated Video Library. Select the channel at the top of the <strong>Videos</strong> tab, then click <strong>Upload MP4 Video</strong> or <strong>Create Test MP4</strong>. Videos uploaded to Channel 1 stay only in Channel 1 and will never mix with Channel 2.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-sm">
              <ListVideo className="w-4 h-4" />
              <span>2. Playlist Queue & Loop Mode (Playlist Tab)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              In the <strong>Playlist</strong> tab, choose between <strong>Multi-Video Loop</strong> (plays all queued videos in order and restarts from Video #1) or <strong>Single Video Loop</strong> (repeats Video #1 continuously). Use Up/Down buttons or drag-and-drop to reorder.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-sm">
              <Radio className="w-4 h-4" />
              <span>3. How Test Mode Works vs YouTube Live Mode</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>Test Mode:</strong> Runs the real server-side FFmpeg loop engine (<code className="font-mono">-f null -</code>), live countdown timer, and video cycle transitions without needing a YouTube Stream Key. Still requires a video uploaded and added to the channel playlist.<br />
              <strong>YouTube Live:</strong> Streams directly to <code className="font-mono">rtmp://a.rtmp.youtube.com/live2</code> using your YouTube Studio Stream Key.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>4. Stream Duration Timer (Minutes / Hours / 24x7)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Enter any number (e.g., <code className="font-mono">5</code> or <code className="font-mono">12</code>) and select <strong>Minutes</strong> or <strong>Hours</strong>. When the countdown reaches <code className="font-mono">00:00:00</code>, the server automatically stops the FFmpeg stream. Or enable <strong>Run 24/7 Non-Stop Loop</strong> for continuous streaming.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
