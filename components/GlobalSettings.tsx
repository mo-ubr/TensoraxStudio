import React, { useState, useEffect } from 'react';
import { loadBrands, getActiveBrandId, setActiveBrandId as persistBrandId } from '../services/brandData';
import { getApiKeyForType, getModelForType } from '../services/geminiService';
import type { BrandProfile } from '../types';

// ─── localStorage keys ──────────────────────────────────────────────────────

const LS = {
  defaultProvider:    'tensorax_default_provider',
  defaultAspectRatio: 'tensorax_default_aspect_ratio',
  defaultOutputType:  'tensorax_default_output_type',
  defaultAssetDir:    'tensorax_default_asset_dir',
} as const;

// ─── API key slot definitions ───────────────────────────────────────────────

interface ApiSlot {
  id: string;
  label: string;
  icon: string;
  baseKey: string;
  modelKey: string;
  models: { group: string; models: string[] }[];
}

const API_SLOTS: ApiSlot[] = [
  {
    id: 'analysis', label: 'Image Analysis & Prompts', icon: 'fa-magnifying-glass-chart',
    baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model',
    models: [
      { group: 'Gemini (Recommended)', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'] },
      { group: 'Claude', models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'] },
    ],
  },
  {
    id: 'video-analysis', label: 'Video Analysis', icon: 'fa-film',
    baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model',
    models: [
      { group: 'Gemini (Recommended)', models: ['gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'] },
    ],
  },
  {
    id: 'copy', label: 'Creative Ideas & Script', icon: 'fa-pen-nib',
    baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model',
    models: [
      { group: 'Claude (Recommended)', models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'] },
      { group: 'Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
    ],
  },
  {
    id: 'image', label: 'Image Generation', icon: 'fa-image',
    baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model',
    models: [
      { group: 'Gemini (Recommended)', models: ['gemini-2.5-flash-image', 'imagen-3.0-capability'] },
      { group: 'OpenAI', models: ['dall-e-3'] },
    ],
  },
  {
    id: 'video', label: 'Video Generation', icon: 'fa-video',
    baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model',
    models: [
      { group: 'Google Veo', models: ['veo-3.1-generate-preview', 'veo-2.0-generate-001'] },
      { group: 'fal.ai Seedance', models: ['seedance-2.0-pro', 'seedance-1.5-pro'] },
      { group: 'fal.ai Kling', models: ['kling-v3-pro', 'kling-v3-standard', 'kling-o3-pro'] },
    ],
  },
];

// ─── Section Card ───────────────────────────────────────────────────────────

const SectionCard: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <i className={`fa-solid ${icon} text-lg text-[#91569c]`} />
      <h3 className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide">{title}</h3>
    </div>
    {children}
  </div>
);

// ─── API Key Slot ───────────────────────────────────────────────────────────

const ApiKeySlot: React.FC<{ slot: ApiSlot }> = ({ slot }) => {
  const [expanded, setExpanded] = useState(false);
  const [model, setModel] = useState(() => localStorage.getItem(slot.modelKey) ?? '');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  // Load key for selected model
  useEffect(() => {
    if (!model) { setApiKey(''); return; }
    const perModel = localStorage.getItem(`${slot.baseKey}__${model}`);
    const base = localStorage.getItem(slot.baseKey);
    setApiKey(perModel || base || '');
  }, [model, slot.baseKey]);

  const hasKey = (() => {
    const m = localStorage.getItem(slot.modelKey);
    if (!m) return false;
    return !!(localStorage.getItem(`${slot.baseKey}__${m}`) || localStorage.getItem(slot.baseKey));
  })();

  const saveKey = () => {
    if (model) localStorage.setItem(slot.modelKey, model);
    if (apiKey.trim()) {
      localStorage.setItem(slot.baseKey, apiKey.trim());
      if (model) localStorage.setItem(`${slot.baseKey}__${model}`, apiKey.trim());
      // Also set fal key if it's a fal model
      if (model.startsWith('seedance') || model.startsWith('kling')) {
        localStorage.setItem('tensorax_fal_key', apiKey.trim());
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="border border-[#e0d6e3] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[#f6f0f8]/30 hover:bg-[#f6f0f8] transition-colors text-left"
      >
        <i className={`fa-solid ${slot.icon} text-sm text-[#91569c]`} />
        <span className="flex-1 font-bold text-xs text-[#5c3a62] uppercase tracking-wide">{slot.label}</span>
        <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-green-400' : 'bg-red-400'}`} />
        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-[10px] text-[#ceadd4]`} />
      </button>
      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t border-[#e0d6e3]">
          <div>
            <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] outline-none focus:ring-1 focus:ring-[#91569c]/50 cursor-pointer"
            >
              <option value="">Select model...</option>
              {slot.models.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.models.map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key..."
              className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] placeholder:text-[#888] outline-none focus:ring-1 focus:ring-[#91569c]/50"
            />
          </div>
          <button
            onClick={saveKey}
            disabled={!model || !apiKey.trim()}
            className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? <><i className="fa-solid fa-check mr-1" /> Saved</> : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const GlobalSettings: React.FC = () => {
  const [brands] = useState<BrandProfile[]>(() => loadBrands());
  const [activeBrand, setActiveBrand] = useState(() => getActiveBrandId());
  const [defaultProvider, setDefaultProvider] = useState(() => localStorage.getItem(LS.defaultProvider) ?? 'gemini');
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem(LS.defaultAspectRatio) ?? '9:16');
  const [outputType, setOutputType] = useState(() => localStorage.getItem(LS.defaultOutputType) ?? 'video');
  const [assetDir, setAssetDir] = useState(() => localStorage.getItem(LS.defaultAssetDir) ?? '');

  // Persist on change
  useEffect(() => { localStorage.setItem(LS.defaultProvider, defaultProvider); }, [defaultProvider]);
  useEffect(() => { localStorage.setItem(LS.defaultAspectRatio, aspectRatio); }, [aspectRatio]);
  useEffect(() => { localStorage.setItem(LS.defaultOutputType, outputType); }, [outputType]);
  useEffect(() => { if (assetDir) localStorage.setItem(LS.defaultAssetDir, assetDir); }, [assetDir]);
  useEffect(() => { persistBrandId(activeBrand); }, [activeBrand]);

  const browseDirectory = async () => {
    try {
      const res = await fetch('/api/db/projects/pick-directory', { method: 'POST' });
      const data = await res.json();
      if (data.path) setAssetDir(data.path);
    } catch { /* ignore — browse dialog cancelled or server unavailable */ }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#5c3a62] uppercase tracking-wide">Settings</h2>
          <p className="text-sm text-[#888] mt-1">App-wide defaults used across all new projects</p>
        </div>

        {/* ── API Keys & Models ── */}
        <SectionCard icon="fa-key" title="API Keys & Default Models">
          <div className="space-y-2">
            {API_SLOTS.map(slot => <ApiKeySlot key={slot.id} slot={slot} />)}
          </div>
          <div className="mt-4 border-t border-[#e0d6e3] pt-4">
            <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1">fal.ai Shared Key</label>
            <p className="text-[9px] text-[#888] mb-2">Used for all fal.ai models (Seedance, Kling). Set here or per-slot above.</p>
            <input
              type="password"
              defaultValue={localStorage.getItem('tensorax_fal_key') ?? ''}
              onBlur={(e) => { if (e.target.value.trim()) localStorage.setItem('tensorax_fal_key', e.target.value.trim()); }}
              placeholder="fal.ai API key..."
              className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] placeholder:text-[#888] outline-none focus:ring-1 focus:ring-[#91569c]/50"
            />
          </div>
        </SectionCard>

        {/* ── Default AI Provider ── */}
        <SectionCard icon="fa-robot" title="Default AI Provider">
          <div className="flex gap-2">
            {(['gemini', 'claude'] as const).map(p => (
              <button
                key={p}
                onClick={() => setDefaultProvider(p)}
                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wide border transition-all
                  ${defaultProvider === p
                    ? 'bg-[#91569c] text-white border-[#91569c]'
                    : 'bg-[#f6f0f8] text-[#5c3a62] border-[#ceadd4] hover:border-[#91569c]/50'
                  }`}
              >
                <i className={`fa-solid ${p === 'gemini' ? 'fa-gem' : 'fa-brain'} mr-2`} />
                {p === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-[#888] mt-2">Used when no per-project provider is set. Can be overridden in each project.</p>
        </SectionCard>

        {/* ── Default Brand ── */}
        <SectionCard icon="fa-palette" title="Default Brand">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-sm text-[#3a3a3a] outline-none focus:ring-1 focus:ring-[#91569c]/50 cursor-pointer"
          >
            <option value="">No brand (unbranded)</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (Default)' : ''}</option>
            ))}
          </select>
          <p className="text-[9px] text-[#888] mt-2">New projects will use this brand unless you choose differently.</p>
        </SectionCard>

        {/* ── Default Format ── */}
        <SectionCard icon="fa-crop-simple" title="Default Format">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">Aspect Ratio</label>
              <div className="flex gap-2">
                {(['9:16', '16:9', '1:1'] as const).map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase border transition-all
                      ${aspectRatio === ar
                        ? 'bg-[#91569c] text-white border-[#91569c]'
                        : 'bg-[#f6f0f8] text-[#5c3a62] border-[#ceadd4] hover:border-[#91569c]/50'
                      }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">Output Type</label>
              <select
                value={outputType}
                onChange={(e) => setOutputType(e.target.value)}
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] outline-none focus:ring-1 focus:ring-[#91569c]/50 cursor-pointer"
              >
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>
          <p className="text-[9px] text-[#888] mt-2">Applied to new projects by default. Change per-project in Project Settings.</p>
        </SectionCard>

        {/* ── Asset Directory ── */}
        <SectionCard icon="fa-folder-open" title="Default Asset Directory">
          <div className="flex gap-2">
            <input
              type="text"
              value={assetDir}
              onChange={(e) => setAssetDir(e.target.value)}
              placeholder="Choose where to save project files..."
              className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] placeholder:text-[#888] outline-none focus:ring-1 focus:ring-[#91569c]/50"
            />
            <button
              onClick={browseDirectory}
              className="px-4 py-2.5 rounded-lg text-[10px] font-black uppercase bg-[#f6f0f8] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#eadcef] transition-colors"
            >
              <i className="fa-solid fa-folder-open mr-1.5" />Browse
            </button>
          </div>
          <p className="text-[9px] text-[#888] mt-2">Interim and final assets will be saved here. Each project gets its own subfolder.</p>
        </SectionCard>

        <div className="h-6" />
      </div>
    </div>
  );
};
