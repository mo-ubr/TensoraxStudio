import React, { useState, useEffect } from 'react';
import { DB, type Project } from '../services/projectDB';
import { BrandProfile } from '../types';

interface ApiSlot {
  id: string;
  label: string;
  icon: string;
  description: string;
  provider: 'google' | 'anthropic' | 'fal';
  keyStorageKey: string;
  modelStorageKey: string;
  defaultModel: string;
  models: { group: string; items: string[] }[];
}

const API_SLOTS: ApiSlot[] = [
  {
    id: 'image-analysis',
    label: 'Image Analysis & Prompts',
    icon: 'fa-eye',
    description: 'Analyses reference images, writes prompts for camera shots and frames',
    provider: 'google',
    keyStorageKey: 'tensorax_analysis_key',
    modelStorageKey: 'tensorax_analysis_model',
    defaultModel: 'gemini-3.1-pro-preview',
    models: [
      { group: 'Recommended', items: ['gemini-3.1-pro-preview'] },
      { group: 'Faster / Cheaper', items: ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'] },
    ],
  },
  {
    id: 'video-analysis',
    label: 'Video Analysis',
    icon: 'fa-film',
    description: 'Analyses reference videos natively (uploads to Gemini File API)',
    provider: 'google',
    keyStorageKey: 'tensorax_video_analysis_key',
    modelStorageKey: 'tensorax_video_analysis_model',
    defaultModel: 'gemini-3.1-pro-preview',
    models: [
      { group: 'Recommended', items: ['gemini-3.1-pro-preview'] },
      { group: 'Faster / Cheaper', items: ['gemini-3-flash-preview'] },
    ],
  },
  {
    id: 'creative',
    label: 'Creative Ideas & Script',
    icon: 'fa-pen-nib',
    description: 'Generates video concepts, writes the screenplay, creative direction',
    provider: 'anthropic',
    keyStorageKey: 'tensorax_copy_key',
    modelStorageKey: 'tensorax_copy_model',
    defaultModel: 'claude-opus-4-6',
    models: [
      { group: 'Recommended', items: ['claude-opus-4-6'] },
      { group: 'Faster / Cheaper', items: ['claude-sonnet-4-6'] },
    ],
  },
  {
    id: 'image-gen',
    label: 'Image Generation',
    icon: 'fa-image',
    description: 'Generates character portraits, backgrounds, key visuals',
    provider: 'google',
    keyStorageKey: 'tensorax_image_key',
    modelStorageKey: 'tensorax_image_model',
    defaultModel: 'gemini-3.1-flash-image-preview',
    models: [
      { group: 'Nano Banana 2 (Best)', items: ['gemini-3.1-flash-image-preview'] },
      { group: 'Other', items: ['gemini-3-pro-image-preview', 'gemini-2.0-flash-exp'] },
    ],
  },
  {
    id: 'video-gen',
    label: 'Video Generation',
    icon: 'fa-video',
    description: 'Generates video clips from frames and prompts',
    provider: 'fal',
    keyStorageKey: 'tensorax_video_key',
    modelStorageKey: 'tensorax_video_model',
    defaultModel: 'seedance-2.0',
    models: [
      { group: 'Seedance (fal.ai)', items: ['seedance-2.0'] },
      { group: 'Google Veo', items: ['veo-3.1-generate-preview', 'veo-2.0-generate-001'] },
      { group: 'Kling V3 (fal.ai)', items: ['kling-v3-standard', 'kling-v3-pro'] },
      { group: 'Kling O3 Omni (fal.ai)', items: ['kling-o3-standard', 'kling-o3-pro'] },
    ],
  },
];

function getStoredKey(storageKey: string): string {
  try { return localStorage.getItem(storageKey)?.trim() || ''; } catch { return ''; }
}

// Check if a model is fal.ai-based (Kling, Seedance)
function isFalModel(model: string): boolean {
  return model.startsWith('kling-') || model.startsWith('seedance');
}

function getStoredKeyForModel(baseKey: string, model: string): string {
  try {
    // Per-model key first
    const perModel = localStorage.getItem(`${baseKey}__${model}`)?.trim();
    if (perModel) return perModel;
    // Shared fal.ai key for all fal-based models
    if (isFalModel(model)) {
      const falKey = localStorage.getItem('tensorax_fal_key')?.trim();
      if (falKey) return falKey;
    }
    // Base key fallback
    return localStorage.getItem(baseKey)?.trim() || '';
  } catch { return ''; }
}

function setStoredKeyForModel(baseKey: string, model: string, value: string) {
  try {
    localStorage.setItem(`${baseKey}__${model}`, value);
    // Also save as shared fal key so it works across all fal models
    if (isFalModel(model)) {
      localStorage.setItem('tensorax_fal_key', value);
    }
  } catch { /* ignore */ }
}

function getStoredModel(storageKey: string, defaultModel: string): string {
  try { return localStorage.getItem(storageKey)?.trim() || defaultModel; } catch { return defaultModel; }
}

function setStoredValue(storageKey: string, value: string) {
  try { localStorage.setItem(storageKey, value); } catch { /* ignore */ }
}

interface ProjectSettingsProps {
  project: Project;
  brands: BrandProfile[];
  activeBrandId: string;
  onBack: () => void;
  onSwitchProject: () => void;
  onUpdateProject: (updated: Project) => void;
  onNavigate: (screen: string) => void;
  onBrandChange?: (brandId: string) => void;
}

const ProjectDirectory: React.FC<{ project: Project; onUpdateProject: (p: Project) => void }> = ({ project, onUpdateProject }) => {
  const [dirPath, setDirPath] = useState('');
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    fetch(`/api/db/projects/${project.id}/directory`)
      .then(r => r.json())
      .then(d => { setDirPath(d.path); })
      .catch(() => {});
  }, [project.id, project.slug]);

  const openFolder = async () => {
    await fetch(`/api/db/projects/${project.id}/open-folder`, { method: 'POST' });
  };

  const browseFolder = async () => {
    setIsPicking(true);
    try {
      const r = await fetch(`/api/db/projects/${project.id}/pick-directory`, { method: 'POST' });
      const d = await r.json();
      if (!d.cancelled && d.path) {
        setDirPath(d.path);
      }
    } catch { /* ignore */ }
    setIsPicking(false);
  };

  const setDirectoryFromInput = async (path: string) => {
    if (!path.trim()) return;
    try {
      const r = await fetch(`/api/db/projects/${project.id}/set-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.trim() }),
      });
      const d = await r.json();
      if (d.path) setDirPath(d.path);
    } catch { /* ignore */ }
  };

  const resetToDefault = async () => {
    try {
      const r = await fetch(`/api/db/projects/${project.id}/set-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '' }),
      });
      const d = await r.json();
      // Reload to get default path
      const r2 = await fetch(`/api/db/projects/${project.id}/directory`);
      const d2 = await r2.json();
      setDirPath(d2.path);
    } catch { /* ignore */ }
  };

  return (
    <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2 mb-4">
        <i className="fa-solid fa-folder-open text-[#91569c]"></i>
        Project Directory
      </h3>
      <div className="space-y-3">
        <div className="bg-[#f6f0f8] rounded-lg p-3">
          <span className="text-[8px] font-black text-[#888] uppercase tracking-wider block mb-1.5">Save Location</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={dirPath}
              onChange={(e) => setDirPath(e.target.value)}
              onBlur={(e) => setDirectoryFromInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setDirectoryFromInput(dirPath); }}
              className="flex-1 bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[10px] text-[#3a3a3a] font-mono outline-none focus:ring-2 focus:ring-[#91569c]/30"
              title={dirPath}
              placeholder="Select a folder for project files..."
            />
            <button
              onClick={browseFolder}
              disabled={isPicking}
              className="px-3 py-2 rounded-lg bg-[#91569c] text-white text-[9px] font-bold uppercase tracking-wider hover:bg-[#5c3a62] transition-colors disabled:opacity-50"
              title="Browse for folder"
            >
              {isPicking ? (
                <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
              ) : (
                <>
                  <i className="fa-solid fa-folder-open text-[10px] mr-1"></i>
                  Browse
                </>
              )}
            </button>
            <button
              onClick={openFolder}
              className="px-2.5 py-2 rounded-lg border border-[#ceadd4] text-[#91569c] hover:bg-[#f6f0f8] transition-colors"
              title="Open folder in Explorer"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </button>
          </div>
          <p className="text-[9px] text-[#888] mt-1.5">
            All generated files (concepts, images, frames, videos) are saved here. Click Browse to choose any folder on your machine.
          </p>
        </div>
      </div>
    </div>
  );
};

interface CheckItem {
  label: string;
  done: boolean;
  detail: string;
  action?: { label: string; screen: string };
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  project, brands, activeBrandId, onBack, onSwitchProject, onUpdateProject, onNavigate, onBrandChange,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);
  const [hasStyleAnalysis, setHasStyleAnalysis] = useState(false);
  const [hasScreenplay, setHasScreenplay] = useState(false);
  const [hasIdeas, setHasIdeas] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const activeBrand = brands.find(b => b.id === activeBrandId);
  const scope = project.notes?.replace('Scope: ', '') || 'full';
  const [currentScope, setCurrentScope] = useState(scope);
  const [currentBrandId, setCurrentBrandId] = useState(activeBrandId);

  useEffect(() => {
    DB.getMetadata(project.id).then(meta => {
      const gd = meta.generalDirection as any;
      setHasStyleAnalysis(!!(gd?.additionalNotes?.includes('STYLE ANALYSIS')));
      setHasScreenplay(!!(meta.screenplay && typeof meta.screenplay === 'string' && (meta.screenplay as string).length > 50));
      const cs = meta.conceptState as any;
      setHasIdeas(!!(cs?.ideas?.length > 0));
      setMetaLoaded(true);
    }).catch(() => setMetaLoaded(true));
  }, [project.id]);

  const saveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === project.name) {
      setEditingName(false);
      return;
    }
    try {
      const updated = await DB.updateProject(project.id, { name: nameInput.trim() });
      onUpdateProject(updated);
    } catch { /* ignore */ }
    setEditingName(false);
  };

  const saveScope = async (newScope: string) => {
    setCurrentScope(newScope);
    try {
      const updated = await DB.updateProject(project.id, { notes: `Scope: ${newScope}` });
      onUpdateProject(updated);
    } catch { /* ignore */ }
  };

  const saveBrand = async (newBrandId: string) => {
    setCurrentBrandId(newBrandId);
    try {
      const updated = await DB.updateProject(project.id, { brandId: newBrandId });
      onUpdateProject(updated);
      onBrandChange?.(newBrandId);
    } catch { /* ignore */ }
  };

  const outputTypes: { value: string; label: string; icon: string }[] = [
    { value: 'explainer-video', label: 'Explainer Video', icon: 'fa-video' },
    { value: 'video-advert', label: 'Video Advert', icon: 'fa-clapperboard' },
    { value: 'social-video', label: 'Social Media Video', icon: 'fa-mobile-screen' },
    { value: 'image-advert', label: 'Image Advert', icon: 'fa-rectangle-ad' },
    { value: 'presentation', label: 'Presentation', icon: 'fa-display' },
    { value: 'infographic', label: 'Infographic', icon: 'fa-chart-pie' },
    { value: 'blog', label: 'Blog / Article', icon: 'fa-newspaper' },
    { value: 'image-portfolio', label: 'Image Portfolio', icon: 'fa-images' },
    { value: 'brand-campaign', label: 'Brand Campaign', icon: 'fa-bullhorn' },
    { value: 'other', label: 'Other', icon: 'fa-wand-magic-sparkles' },
  ];

  const currentTypeInfo = outputTypes.find(t => t.value === currentScope) || outputTypes[outputTypes.length - 1];

  const [apiState, setApiState] = useState(() =>
    Object.fromEntries(API_SLOTS.map(s => {
      const model = getStoredModel(s.modelStorageKey, s.defaultModel);
      return [s.id, {
        key: getStoredKeyForModel(s.keyStorageKey, model),
        model,
        showKey: false,
      }];
    }))
  );
  const [expandedApi, setExpandedApi] = useState<string | null>(null);

  const saveApiField = (slotId: string, field: 'key' | 'model', value: string) => {
    const slot = API_SLOTS.find(s => s.id === slotId)!;
    if (field === 'model') {
      setStoredValue(slot.modelStorageKey, value);
      const keyForNewModel = getStoredKeyForModel(slot.keyStorageKey, value);
      setApiState(prev => ({ ...prev, [slotId]: { ...prev[slotId], model: value, key: keyForNewModel } }));
    } else {
      const currentModel = apiState[slotId].model;
      setStoredKeyForModel(slot.keyStorageKey, currentModel, value);
      setApiState(prev => ({ ...prev, [slotId]: { ...prev[slotId], key: value } }));
    }
  };

  const pipeline: CheckItem[] = [
    {
      label: 'General Direction',
      done: true,
      detail: 'Project brief and creative direction',
      action: { label: 'Edit Direction', screen: 'concept' },
    },
    {
      label: 'Style Analysis',
      done: hasStyleAnalysis,
      detail: hasStyleAnalysis ? 'Reference video/images analysed' : 'No reference analysed yet — required for best results',
      action: { label: hasStyleAnalysis ? 'View Analysis' : 'Analyse Reference', screen: 'concept' },
    },
    {
      label: 'Idea Generation',
      done: hasIdeas,
      detail: hasIdeas ? 'Concept ideas generated' : 'Generate ideas from brief + style analysis',
      action: { label: hasIdeas ? 'View Ideas' : 'Generate Ideas', screen: 'concept' },
    },
    {
      label: 'Screenplay',
      done: hasScreenplay,
      detail: hasScreenplay ? 'Screenplay created' : 'Accept an idea to create the screenplay',
      action: { label: hasScreenplay ? 'View Screenplay' : 'Create Screenplay', screen: 'concept' },
    },
    {
      label: 'Characters & Images',
      done: false,
      detail: 'Build characters from screenplay, generate images',
      action: { label: 'Open Characters', screen: 'images' },
    },
    {
      label: 'Frame Composition',
      done: false,
      detail: 'Compose 9-frame storyboard shots',
      action: { label: 'Open Frames', screen: 'scenes' },
    },
    {
      label: 'Video Generation',
      done: false,
      detail: 'Generate final video from frames',
      action: { label: 'Open Video', screen: 'video' },
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#edecec]">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Project Identity */}
        <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                    onBlur={saveName}
                    autoFocus
                    className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#91569c]/30 flex-1"
                  />
                </div>
              ) : (
                <button onClick={() => setEditingName(true)} className="group text-left">
                  <h2 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                    {project.name}
                    <i className="fa-solid fa-pencil text-[10px] text-[#ceadd4] group-hover:text-[#91569c] transition-colors"></i>
                  </h2>
                </button>
              )}
              <p className="text-[10px] text-[#888] mt-1">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
              project.status === 'active' ? 'bg-green-50 text-green-600 border border-green-200' :
              project.status === 'completed' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
              'bg-gray-50 text-gray-500 border border-gray-200'
            }`}>
              {project.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#f6f0f8] rounded-lg p-3">
              <span className="text-[8px] font-black text-[#888] uppercase tracking-wider block mb-2">Output Type</span>
              <select
                value={currentScope}
                onChange={(e) => saveScope(e.target.value)}
                className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] font-bold text-[#5c3a62] outline-none focus:ring-2 focus:ring-[#91569c]/30 cursor-pointer"
              >
                {outputTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="bg-[#f6f0f8] rounded-lg p-3">
              <span className="text-[8px] font-black text-[#888] uppercase tracking-wider block mb-2">Brand</span>
              <select
                value={currentBrandId}
                onChange={(e) => saveBrand(e.target.value)}
                className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] font-bold text-[#5c3a62] outline-none focus:ring-2 focus:ring-[#91569c]/30 cursor-pointer"
              >
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {project.description && (
            <div className="mt-4 bg-[#f6f0f8] rounded-lg p-3">
              <span className="text-[8px] font-black text-[#888] uppercase tracking-wider block mb-1">Brief</span>
              <p className="text-[11px] text-[#3a3a3a] leading-relaxed">{project.description}</p>
            </div>
          )}
        </div>

        {/* Project Directory */}
        <ProjectDirectory project={project} onUpdateProject={onUpdateProject} />

        {/* API Configuration */}
        <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2 mb-4">
            <i className="fa-solid fa-key text-[#91569c]"></i>
            AI Models & API Keys
          </h3>
          <p className="text-[10px] text-[#888] mb-4 leading-relaxed">
            Each step uses a different AI model optimised for that task. Click to expand and configure.
          </p>
          <div className="space-y-2">
            {API_SLOTS.map(slot => {
              const state = apiState[slot.id];
              const effectiveProvider = slot.id === 'video-gen'
                ? (state.model.startsWith('veo') ? 'google' : 'fal') as 'google' | 'fal'
                : slot.provider;
              const hasKey = !!state.key;
              const isExpanded = expandedApi === slot.id;
              return (
                <div key={slot.id} className={`rounded-xl border overflow-hidden transition-colors ${
                  hasKey ? 'border-green-200' : 'border-red-200'
                }`}>
                  <button
                    onClick={() => setExpandedApi(isExpanded ? null : slot.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      hasKey ? 'bg-green-50/50 hover:bg-green-50' : 'bg-red-50/30 hover:bg-red-50/50'
                    }`}
                  >
                    <i className={`fa-solid ${slot.icon} text-sm flex-shrink-0 ${hasKey ? 'text-green-500' : 'text-red-400'}`}></i>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold text-[#5c3a62] block">{slot.label}</span>
                      <p className="text-[9px] text-[#888]">{slot.description}</p>
                    </div>
                    <span className="text-[9px] font-bold text-[#91569c] bg-[#f6f0f8] px-2 py-0.5 rounded flex-shrink-0">
                      {state.model}
                    </span>
                    <i className={`fa-solid ${hasKey ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-red-400'} text-xs flex-shrink-0`}></i>
                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[8px] text-[#ceadd4] flex-shrink-0`}></i>
                  </button>

                  {isExpanded && (
                    <div className="px-4 py-3 bg-[#f6f0f8]/50 border-t border-[#e0d6e3] space-y-3">
                      <div>
                        <label className="block text-[9px] font-black text-[#888] uppercase tracking-wider mb-1">Model</label>
                        <select
                          value={state.model}
                          onChange={(e) => saveApiField(slot.id, 'model', e.target.value)}
                          className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] font-bold text-[#5c3a62] outline-none focus:ring-2 focus:ring-[#91569c]/30 cursor-pointer"
                        >
                          {slot.models.map(g => (
                            <optgroup key={g.group} label={g.group}>
                              {g.items.map(m => <option key={m} value={m}>{m}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-[#888] uppercase tracking-wider mb-1">
                          API Key
                          {effectiveProvider === 'anthropic' && <span className="font-normal text-[#ceadd4] ml-1">(Anthropic)</span>}
                          {effectiveProvider === 'google' && <span className="font-normal text-[#ceadd4] ml-1">(Google AI)</span>}
                          {effectiveProvider === 'fal' && <span className="font-normal text-[#ceadd4] ml-1">(fal.ai)</span>}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type={state.showKey ? 'text' : 'password'}
                            value={state.key}
                            onChange={(e) => saveApiField(slot.id, 'key', e.target.value)}
                            placeholder={`Paste your ${effectiveProvider === 'anthropic' ? 'Anthropic' : effectiveProvider === 'fal' ? 'fal.ai' : 'Google AI'} key...`}
                            className="flex-1 bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] placeholder:text-[#ceadd4] outline-none focus:ring-2 focus:ring-[#91569c]/30"
                          />
                          <button
                            onClick={() => setApiState(prev => ({ ...prev, [slot.id]: { ...prev[slot.id], showKey: !prev[slot.id].showKey } }))}
                            className="px-2 rounded-lg border border-[#ceadd4] text-[#888] hover:text-[#5c3a62] transition-colors"
                            title={state.showKey ? 'Hide key' : 'Show key'}
                          >
                            <i className={`fa-solid ${state.showKey ? 'fa-eye-slash' : 'fa-eye'} text-[10px]`}></i>
                          </button>
                        </div>
                        {hasKey && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <i className="fa-solid fa-circle-check text-green-500 text-[8px]"></i>
                            <span className="text-[9px] text-green-600">Key saved</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline Progress */}
        <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2 mb-4">
            <i className="fa-solid fa-list-check text-[#91569c]"></i>
            Production Pipeline
          </h3>
          {!metaLoaded ? (
            <div className="flex items-center justify-center py-8">
              <i className="fa-solid fa-spinner fa-spin text-[#91569c] text-xl"></i>
            </div>
          ) : (
            <div className="space-y-1">
              {pipeline.map((item, i) => {
                const isBlocked = i > 0 && !pipeline[i - 1].done && i <= 3;
                return (
                  <div key={item.label} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    item.done ? 'bg-green-50/50' : isBlocked ? 'bg-[#f6f0f8]/50 opacity-50' : 'bg-[#f6f0f8]'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${
                      item.done ? 'bg-green-500 text-white' : 'bg-[#e0d6e3] text-[#888]'
                    }`}>
                      {item.done ? <i className="fa-solid fa-check text-[8px]"></i> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] font-bold ${item.done ? 'text-green-700' : 'text-[#5c3a62]'}`}>
                        {item.label}
                      </span>
                      <p className="text-[9px] text-[#888] mt-0.5">{item.detail}</p>
                    </div>
                    {item.action && !isBlocked && (
                      <button
                        onClick={() => onNavigate(item.action!.screen)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors flex-shrink-0 ${
                          item.done
                            ? 'bg-[#f6f0f8] text-[#91569c] border border-[#ceadd4] hover:bg-[#eadcef]'
                            : 'bg-[#91569c] text-white hover:bg-[#5c3a62]'
                        }`}
                      >
                        {item.action.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Switch / Close Project */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <button
            onClick={onSwitchProject}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[#888] hover:text-[#5c3a62] bg-white border border-[#e0d6e3] hover:border-[#ceadd4] transition-colors"
          >
            <i className="fa-solid fa-arrow-right-arrow-left text-[9px]"></i>
            Switch Project
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[#888] hover:text-[#5c3a62] transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-[9px]"></i>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
