import React, { useState } from 'react';
import { Calendar, Clock, Activity, CheckCircle2 } from 'lucide-react';
import {
  formatSecondsToClock,
  type ChannelConfig,
  type UptimeSessionRecord,
  type DaySchedule
} from '../utils/streamLogic';

interface SchedulerAnalyticsViewProps {
  channel: ChannelConfig;
  uptimeHistory: UptimeSessionRecord[];
  onUpdateChannel: (updates: Partial<ChannelConfig>) => Promise<void>;
}

export const SchedulerAnalyticsView: React.FC<SchedulerAnalyticsViewProps> = ({
  channel,
  uptimeHistory,
  onUpdateChannel
}) => {
  const [scheduledDateTime, setScheduledDateTime] = useState(
    channel.scheduledStartTime || ''
  );
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveScheduledStart = async () => {
    await onUpdateChannel({
      scheduledStartTime: scheduledDateTime || null
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const toggleDaySchedule = async (index: number) => {
    const copy: DaySchedule[] = [...(channel.daySchedules || [])];
    if (!copy[index]) return;
    copy[index] = { ...copy[index], enabled: !copy[index].enabled };
    await onUpdateChannel({ daySchedules: copy });
  };

  const updateDayTime = async (index: number, startTime: string) => {
    const copy: DaySchedule[] = [...(channel.daySchedules || [])];
    if (!copy[index]) return;
    copy[index] = { ...copy[index], startTime };
    await onUpdateChannel({ daySchedules: copy });
  };

  const updateDayDuration = async (index: number, durationValue: number) => {
    const copy: DaySchedule[] = [...(channel.daySchedules || [])];
    if (!copy[index]) return;
    copy[index] = {
      ...copy[index],
      durationValue: Math.max(1, Math.min(24, durationValue))
    };
    await onUpdateChannel({ daySchedules: copy });
  };

  const totalUptimeSeconds = uptimeHistory.reduce(
    (acc, item) => acc + item.durationSeconds,
    channel.elapsedSeconds || 0
  );

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden" data-testid="scheduler-analytics-view">
      {/* Scheduled Start & Weekly Timetable */}
      <div className="clay-card p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 clay-inset flex items-center justify-center text-blue-600 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {channel.name} — Schedule & Analytics
            </h2>
            <p className="text-xs text-slate-500">
              Auto-Start Timer, Weekly Timetable, and Stream Uptime History
            </p>
          </div>
        </div>

        {/* One-Time Scheduled Start */}
        <div className="clay-inset p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Auto-Start Stream at Specific Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full sm:w-72 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveScheduledStart}
              className="clay-btn-primary px-4 py-2.5 text-xs font-bold cursor-pointer"
            >
              {savedNotice ? 'Schedule Saved ✓' : 'Save Auto-Start'}
            </button>
            {channel.scheduledStartTime && (
              <button
                type="button"
                onClick={() => {
                  setScheduledDateTime('');
                  void onUpdateChannel({ scheduledStartTime: null });
                }}
                className="clay-btn px-3 py-2.5 text-xs font-bold text-rose-600 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Day-Wise Weekly Schedule */}
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">
            Weekly Day-by-Day Stream Schedule
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(channel.daySchedules || []).map((d, idx) => (
              <div
                key={d.day}
                className={`clay-inset p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                  !d.enabled ? 'opacity-65' : ''
                }`}
              >
                <label className="flex items-center gap-2.5 text-xs font-extrabold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={() => toggleDaySchedule(idx)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>{d.day}</span>
                </label>

                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <input
                    type="time"
                    value={d.startTime}
                    onChange={(e) => updateDayTime(idx, e.target.value)}
                    className="bg-white px-2 py-1 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200"
                  />
                  <span className="text-[11px] font-bold text-slate-500">for</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={d.durationValue}
                    onChange={(e) => updateDayDuration(idx, Number(e.target.value))}
                    className="w-12 bg-white px-2 py-1 rounded-lg text-xs font-mono font-bold text-center text-slate-800 border border-slate-200"
                  />
                  <span className="text-[11px] font-bold text-slate-600">hrs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics & Uptime History */}
      <div className="clay-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              Stream Uptime & Session History
            </h3>
          </div>
          <div className="clay-inset px-4 py-2 text-xs font-mono font-bold text-emerald-700">
            Total Recorded Uptime: {formatSecondsToClock(totalUptimeSeconds)}
          </div>
        </div>

        {uptimeHistory.length === 0 ? (
          <div className="clay-inset p-6 text-center text-xs text-slate-600">
            No completed stream sessions yet. Start and stop a test or live stream to record uptime logs here.
          </div>
        ) : (
          <div className="space-y-2.5">
            {uptimeHistory.map((item) => (
              <div
                key={item.id}
                className="clay-inset p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-900">{item.channelName}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px]">
                    {item.mode === 'youtube_rtmp' ? 'YouTube Live' : 'Test Mode'}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Quality: {item.quality}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-slate-700">
                  <span>Duration: {formatSecondsToClock(item.durationSeconds)}</span>
                  <span className="text-slate-400">•</span>
                  <span>{new Date(item.endedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
