import React, { useState } from 'react';
import { Server, Copy, Check, Terminal, Globe, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const NoCardCloudGuide: React.FC = () => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyText = (text: string, idx: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const oneLineSetupCommand = `sudo apt-get update && sudo apt-get install -y ffmpeg && npm install && npm run dev`;

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden" data-testid="no-card-cloud-view">
      {/* Header Card */}
      <div className="clay-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 clay-inset flex items-center justify-center text-blue-600 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              GitHub Codespaces — Step-by-Step Setup
            </h2>
            <p className="text-xs text-slate-500">
              100% Free (120 Core-Hours/Month + 15 GB Storage) • No Credit Card Required
            </p>
          </div>
        </div>

        {/* Step-by-Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-xs uppercase">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Step 1: Save Project to GitHub</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Export or download this project to your GitHub account as a new repository (e.g., <code className="font-mono font-bold">loopstream-studio</code>). This project already includes a <code className="font-mono font-bold">.devcontainer/devcontainer.json</code> file.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-xs uppercase">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Step 2: Create 2-Core Codespace</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Open your GitHub repository → Click the green <strong>&lt;&gt; Code</strong> button → Select the <strong>Codespaces</strong> tab → Click <strong>Create codespace on main</strong> (choose <strong>2-core</strong> machine to get the full 60 hours/month free runtime).
            </p>
          </div>

          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-xs uppercase">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Step 3: Run One-Line Terminal Command</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Codespaces automatically installs FFmpeg via <code className="font-mono">.devcontainer</code>. Or paste the 1-line command below into the Codespaces Terminal to install FFmpeg and start the server on <strong>Port 3000</strong>.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-xs uppercase">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Step 4: Open Port 3000 & Set Timeout to 240 Min</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Click the <strong>PORTS</strong> tab in Codespaces and open the <strong>Port 3000</strong> link. In <code className="font-mono">github.com/settings/codespaces</code>, change <strong>Default idle timeout</strong> from 30 minutes to <strong>240 minutes (4 hours)</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* One-Line Command Copy Box */}
      <div className="clay-card p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-sm font-extrabold text-slate-900">
              GitHub Codespaces One-Line Start Command
            </h3>
          </div>
          <button
            type="button"
            onClick={() => copyText(oneLineSetupCommand, 1)}
            className="clay-btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {copiedIdx === 1 ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedIdx === 1 ? 'Copied!' : 'Copy Command'}
          </button>
        </div>

        <pre className="clay-inset p-4 text-xs font-mono text-slate-800 overflow-x-auto leading-relaxed">
          {oneLineSetupCommand}
        </pre>
      </div>

      {/* Alternative for Scaling 5–10 Channels */}
      <div className="clay-card p-5 sm:p-6 flex items-start gap-3">
        <div className="w-10 h-10 clay-inset flex items-center justify-center text-amber-600 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-slate-900">
            Future Scaling to 5–10 Channels (Indian UPI Linux VPS)
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Once your testing on GitHub Codespaces is complete, you can deploy the exact same repository to a Linux VPS using <strong>PhonePe / Google Pay UPI</strong> (Hostinger India or MilesWeb) to run 5–10 channels 24/7 with no hourly limits.
          </p>
        </div>
      </div>
    </div>
  );
};
