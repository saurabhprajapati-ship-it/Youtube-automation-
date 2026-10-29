import React, { useState } from 'react';
import { Copy, Check, Terminal, Gift, Sparkles, CreditCard } from 'lucide-react';

type HostingOptionId = 'huggingface' | 'codespaces' | 'aistudio' | 'upi_vps';

export function CloudDeployGuide() {
  const [selectedOption, setSelectedOption] = useState<HostingOptionId>('huggingface');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const hfDockerCmd = `FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && mkdir -p /app/data/videos /app/data/concat && chmod -R 777 /app/data
ENV NODE_ENV=production PORT=7860
EXPOSE 7860
CMD ["npx", "tsx", "server.ts"]`;

  const codespacesCmd = `sudo apt update && sudo apt install -y ffmpeg && npm install && npm run dev`;

  const vpsCommands = [
    {
      step: '01. Install Node.js 22, FFmpeg & PM2 on Ubuntu Server',
      description: 'Works on GitHub Codespaces, Oracle Free Tier, or any Indian UPI VPS (Hostinger / LightNode):',
      cmd: `sudo apt update && sudo apt install -y ffmpeg curl git && curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs && sudo npm install -g pm2 tsx`
    },
    {
      step: '02. Start 24/7 LoopStream Studio in Background',
      description: 'Runs continuously even after you close your phone or computer browser:',
      cmd: `npm install && npm run build && NODE_ENV=production pm2 start server.ts --interpreter tsx --name loopstream-studio && pm2 save`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="clay-card p-6">
        <h2 className="text-xl font-bold text-slate-900">
          Free Hosting Guide (बिना क्रेडिट कार्ड 24/7 चलाने के विकल्प)
        </h2>
        <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-3xl">
          अगर Google Cloud का $300 फ्री ट्रायल कार्ड की वजह से एक्टिवेट नहीं हुआ, तो नीचे दिए गए 4 तरीकों से आप अपनी स्ट्रीम चला सकते हैं:
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setSelectedOption('huggingface')}
            className={`min-h-[52px] text-left p-3.5 ${
              selectedOption === 'huggingface' ? 'clay-btn-primary' : 'clay-btn'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <Gift className="h-4 w-4 shrink-0" />
              <span className="truncate">1. Hugging Face (Free)</span>
            </div>
            <div className="mt-1 text-[11px] font-mono opacity-85 tabular-nums">
              0₹ · No Card · 16GB RAM
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOption('codespaces')}
            className={`min-h-[52px] text-left p-3.5 ${
              selectedOption === 'codespaces' ? 'clay-btn-primary' : 'clay-btn'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <Terminal className="h-4 w-4 shrink-0" />
              <span className="truncate">2. GitHub Codespaces</span>
            </div>
            <div className="mt-1 text-[11px] font-mono opacity-85 tabular-nums">
              0₹ · No Card · 60 Hrs/Mo
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOption('aistudio')}
            className={`min-h-[52px] text-left p-3.5 ${
              selectedOption === 'aistudio' ? 'clay-btn-primary' : 'clay-btn'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="truncate">3. Test Right Here</span>
            </div>
            <div className="mt-1 text-[11px] font-mono opacity-85 tabular-nums">
              0₹ · Already Running
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOption('upi_vps')}
            className={`min-h-[52px] text-left p-3.5 ${
              selectedOption === 'upi_vps' ? 'clay-btn-primary' : 'clay-btn'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="truncate">4. Indian UPI VPS</span>
            </div>
            <div className="mt-1 text-[11px] font-mono opacity-85 tabular-nums">
              PhonePe/GPay · 5-10 Ch
            </div>
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200/80">
          {selectedOption === 'huggingface' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Option 1: Hugging Face Spaces (Docker) — 100% Free &amp; No Credit Card Needed
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Sign up on <code>huggingface.co</code>, create a <strong>New Space &rarr; Docker (Blank)</strong>, and upload this project (a ready-to-run <code>Dockerfile</code> is included). You get 2 vCPU, 16 GB RAM, and 50 GB Disk free without any card!
              </p>
              <div className="clay-inset p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Dockerfile (Port 7860)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(hfDockerCmd, 101)}
                    className="clay-btn px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    {copiedIndex === 101 ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedIndex === 101 ? 'Copied' : 'Copy Dockerfile'}</span>
                  </button>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-blue-200 font-mono">
                  <code>{hfDockerCmd}</code>
                </pre>
              </div>
            </div>
          )}

          {selectedOption === 'codespaces' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Option 2: GitHub Codespaces — Free 60 Hours/Month (No Card Required)
              </h3>
              <div className="clay-inset p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Run inside Codespace Terminal:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(codespacesCmd, 102)}
                    className="clay-btn px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    {copiedIndex === 102 ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedIndex === 102 ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-blue-200 font-mono">
                  <code>{codespacesCmd}</code>
                </pre>
              </div>
            </div>
          )}

          {selectedOption === 'aistudio' && (
            <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <h3 className="text-base font-bold text-slate-900">
                Option 3: Instant Live Testing Right Here
              </h3>
              <p>
                This server already has <code>/usr/bin/ffmpeg</code> installed. Simply complete the 4 Pre-Flight steps (1. Upload Video in 01. Video Library, 2. Add to 02. Playlist Builder, 3. Enter Stream Key, 4. Set Duration in Minutes/Hours) and click Start!
              </p>
            </div>
          )}

          {selectedOption === 'upi_vps' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Option 4: Indian UPI VPS (Hostinger / LightNode / MilesWeb)
              </h3>
              {vpsCommands.map((item, idx) => (
                <div key={item.step} className="clay-inset p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{item.step}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.cmd, idx)}
                      className="clay-btn px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-blue-200 font-mono">
                    <code>{item.cmd}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
