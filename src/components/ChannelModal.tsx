import React, { useState, useEffect } from 'react';
import { X, Plus, Tv } from 'lucide-react';

interface ChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChannel: (name: string) => Promise<void>;
  channelCount: number;
}

export const ChannelModal: React.FC<ChannelModalProps> = ({
  isOpen,
  onClose,
  onAddChannel,
  channelCount
}) => {
  const [name, setName] = useState(`Channel ${channelCount + 1}`);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(`Channel ${channelCount + 1}`);
    }
  }, [isOpen, channelCount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onAddChannel(name.trim() || `Channel ${channelCount + 1}`);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      data-testid="add-channel-modal"
    >
      <div className="clay-card w-full max-w-md p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 clay-inset flex items-center justify-center text-blue-600">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Add New Channel ({channelCount}/10)
              </h3>
              <p className="text-xs text-slate-500">
                Scale up to 10 independent 24/7 loop channels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="clay-btn w-9 h-9 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Channel Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Channel 2"
              data-testid="new-channel-name-input"
              className="clay-inset w-full px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="clay-inset p-3.5 text-xs text-slate-600 leading-relaxed">
            Each channel has its own independent{' '}
            <strong className="text-slate-800">YouTube Stream Key</strong>,{' '}
            <strong className="text-slate-800">Video Library</strong>,{' '}
            <strong className="text-slate-800">Playlist Queue</strong>, and{' '}
            <strong className="text-slate-800">Timer</strong>.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="clay-btn px-4 py-2.5 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="confirm-add-channel-btn"
              className="clay-btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
