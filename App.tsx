
import React, { useState, useEffect, useRef } from 'react';
import { GeminiService, getApiKeyForType, getModelForType, hasStoredKeyForType } from './services/geminiService';
import { generateImageWithCurrentProvider } from './services/imageProvider';
import { ChatBot } from './components/ChatBot';
import { ConceptScreen } from './components/ConceptScreen';
import { ImagesScreen } from './components/ImagesScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { GridImage, ImageSize, AspectRatio, GridTheme, ReferenceInput, VideoState, BrandProfile } from './types';
import { BrandSelector } from './components/BrandSelector';
import { loadBrands, saveBrands, getActiveBrandId, setActiveBrandId } from './services/brandData';
import { DB, type Project } from './services/projectDB';
import { NewProjectWizard, getScopeRoute, type NewProjectData } from './components/NewProjectWizard';

const GRID_SIZE = 3;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

const API_MODELS = [
  { group: 'Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-3-flash-preview', 'gemini-3-pro-image-preview'] },
  { group: 'Claude', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-3-5'] },
  { group: 'Imagen', models: ['imagen-3.0-capability', 'imagen-4.0-generate-preview'] },
  { group: 'Video', models: ['veo-3.1-generate-preview', 'veo-2.0-generate-001'] },
];

const ApiKeyButton: React.FC = () => {
  const [hasKey, setHasKey] = useState(() => GeminiService.hasApiKey());
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem('tensorax_active_model') || 'gemini-2.5-flash'; } catch { return 'gemini-2.5-flash'; }
  });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => { if (modalRef.current && !modalRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSave = () => {
    if (key.trim()) {
      GeminiService.setApiKey(key.trim());
      setHasKey(true);
    }
    try { localStorage.setItem('tensorax_active_model', selectedModel); } catch { /* ignore */ }
    setOpen(false);
    setKey('');
    if (key.trim()) window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors border ${
          hasKey
            ? 'bg-[#f6f0f8] border-[#ceadd4] text-[#91569c] hover:bg-[#eadcef]'
            : 'bg-[#91569c] border-[#91569c] text-white hover:bg-[#5c3a62] animate-pulse'
        }`}
        title={hasKey ? 'API settings — click to change' : 'Set API key'}
      >
        <i className="fa-solid fa-key text-[8px]"></i>
        {hasKey ? 'API' : 'Set Key'}
      </button>

      {open && (
        <div ref={modalRef} className="absolute top-full right-0 mt-2 w-80 bg-white border border-[#e0d6e3] rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b border-[#e0d6e3]">
            <h3 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide">API Settings</h3>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-[9px] font-bold text-[#5c3a62] uppercase tracking-wider mb-1">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#5c3a62] font-bold outline-none focus:ring-1 focus:ring-[#91569c]/30 cursor-pointer"
              >
                {API_MODELS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                ))}
              </select>
              <p className="text-[8px] text-[#888] mt-1">Active: <span className="font-bold text-[#91569c]">{selectedModel}</span></p>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#5c3a62] uppercase tracking-wider mb-1">API Key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={hasKey ? '••••••• (already set, enter new to change)' : 'Paste your API key...'}
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] placeholder:text-[#ceadd4] outline-none focus:ring-1 focus:ring-[#91569c]/30"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
              <p className="text-[8px] text-[#888] mt-1">Gemini → Google AI key. Claude → Anthropic key.</p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => { setOpen(false); setKey(''); }} className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

class ChatBotBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#edecec] border border-[#e0d6e3] rounded-xl">
          <i className="fa-solid fa-robot text-3xl text-[#888]/30 mb-3"></i>
          <p className="text-[10px] text-[#888]/50 uppercase tracking-wider font-bold">Chat unavailable</p>
          <p className="text-[9px] text-[#888]/30 mt-1">Set an API key to enable the assistant</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** 9 cinematic shot types for the 3×3 contact sheet (row-major order). */
const SHOT_SPECS: { label: string; instruction: string }[] = [
  { label: '1. ELS – Extreme Long Shot', instruction: 'Subject(s) small within the vast environment.' },
  { label: '2. LS – Long Shot', instruction: 'Complete subject(s) or group visible head to toe / wheels to roof.' },
  { label: '3. MLS – Medium Long (3/4)', instruction: 'Framed from knees up (people) or 3/4 view (objects).' },
  { label: '4. MS – Medium Shot', instruction: 'Waist up (or central core of object). Focus on interaction/action.' },
  { label: '5. MCU – Medium Close-Up', instruction: 'Chest up. Intimate framing of main subject(s).' },
  { label: '6. CU – Close-Up', instruction: 'Tight on face(s) or the "front" of the object.' },
  { label: '7. ECU – Extreme Close-Up', instruction: 'Macro detail on a key feature (eyes, hands, logo, texture).' },
  { label: '8. Low Angle (Worm\'s Eye)', instruction: 'Looking up at subject(s) from the ground, imposing/heroic.' },
  { label: '9. High Angle (Bird\'s Eye)', instruction: 'Looking down on subject(s) from above.' },
];

const LOGO_SOURCES = ['/logo-secondary.png', '/logo-main.png', '/logo.png'];
const LogoSvg = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 110" className={className}>
    {/* TensorAx icon: chevron roof + pillars */}
    <path d="M50 5 L95 35 L85 40 L50 17 L15 40 L5 35 Z" fill="#5a5a5a" />
    <path d="M50 15 L90 42 L80 47 L50 27 L20 47 L10 42 Z" fill="#666" />
    <path d="M22 50 L38 50 L38 95 L22 95 Z" fill="#666" />
    <path d="M42 42 L58 42 L58 90 L50 100 L42 90 Z" fill="#666" />
    <path d="M62 50 L78 50 L78 95 L62 95 Z" fill="#666" />
  </svg>
);
const LogoIcon = ({ className = "w-6 h-6" }: { className?: string }) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) return <LogoSvg className={className} />;
  const tryNext = () => {
    if (srcIndex + 1 < LOGO_SOURCES.length) setSrcIndex((i) => i + 1);
    else setImgFailed(true);
  };
  return (
    <img
      src={LOGO_SOURCES[srcIndex]}
      alt="Tensorax"
      className={className}
      onError={tryNext}
    />
  );
};

interface LandingPageProps {
  onNavigate: (screen: 'concept' | 'images' | 'scenes' | 'video' | 'projects') => void;
  activeProject: Project | null;
  allProjects: Project[];
  brands: BrandProfile[];
  onCreateProject: (data: NewProjectData) => void;
  onSelectProject: (p: Project) => void;
  onNewProject: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, activeProject, allProjects, brands, onCreateProject, onSelectProject, onNewProject }) => {
  const [showWizard, setShowWizard] = useState(false);

  const pipelineSteps = [
    { id: 'concept', label: 'Copy', icon: 'fa-pen-nib', description: 'Brief, Ideas & Finetuning' },
    { id: 'images', label: 'Images', icon: 'fa-image', description: 'Characters & Key Visuals' },
    { id: 'scenes', label: 'Frames', icon: 'fa-clapperboard', description: 'Frame Composition' },
    { id: 'video', label: 'Video', icon: 'fa-video', description: 'Video Generation' },
  ];

  if (!activeProject) {
    if (showWizard) {
      return <NewProjectWizard brands={brands} onComplete={onCreateProject} onCancel={() => setShowWizard(false)} />;
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-[#5c3a62] uppercase tracking-wide">Welcome</h2>
            <p className="text-sm text-[#888] mt-1">Open an existing project or start a new one</p>
          </div>

          {/* Open existing project */}
          <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm space-y-3">
            <button
              onClick={() => onNavigate('projects')}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-lg bg-[#f6f0f8] border border-[#ceadd4] hover:bg-[#eadcef] hover:border-[#91569c] transition-all text-left group"
            >
              <i className="fa-solid fa-folder-open text-2xl text-[#91569c]"></i>
              <div className="flex-1">
                <span className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide group-hover:text-[#91569c] transition-colors">Open Project</span>
                <p className="text-[10px] text-[#888] mt-0.5">
                  {allProjects.length > 0 ? `${allProjects.length} project${allProjects.length !== 1 ? 's' : ''} available` : 'Browse all projects'}
                </p>
              </div>
              <i className="fa-solid fa-chevron-right text-[#ceadd4] group-hover:text-[#91569c] transition-colors"></i>
            </button>

            {allProjects.length > 0 && (
              <select
                onChange={(e) => {
                  const p = allProjects.find(x => x.id === e.target.value);
                  if (p) onSelectProject(p);
                }}
                defaultValue=""
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-3 text-sm text-[#5c3a62] font-bold outline-none focus:ring-2 focus:ring-[#91569c]/30 cursor-pointer"
              >
                <option value="" disabled>Quick select...</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="text-center text-[10px] text-[#ceadd4] uppercase tracking-widest font-bold">or</div>

          {/* Start new project — opens wizard */}
          <button
            onClick={() => setShowWizard(true)}
            className="w-full py-4 rounded-xl border-2 border-dashed border-[#ceadd4] hover:border-[#91569c] bg-white/50 hover:bg-white text-[#888] hover:text-[#91569c] transition-all flex items-center justify-center gap-3 group shadow-sm"
          >
            <i className="fa-solid fa-plus group-hover:scale-110 transition-transform"></i>
            <span className="font-black uppercase tracking-wider text-xs">Start New Project</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-[#edecec] overflow-hidden">
      {/* Left nav */}
      <div className="flex flex-col gap-3 w-64 flex-shrink-0 p-4 overflow-y-auto">
        <button
          onClick={() => onNavigate('projects')}
          className="group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 bg-white border-[#e0d6e3] hover:border-[#91569c]/50 hover:bg-[#f6f0f8] shadow-sm text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
            <i className="fa-solid fa-sliders text-[#91569c]"></i>
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold uppercase tracking-wider text-xs text-[#5c3a62] group-hover:text-[#91569c] transition-colors">Project</span>
            <p className="text-[9px] text-[#888] mt-0.5">Settings & Assets</p>
          </div>
        </button>

        <div className="h-px bg-[#e0d6e3]"></div>

        {pipelineSteps.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as any)}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 bg-white border-[#e0d6e3] hover:border-[#91569c]/50 hover:bg-[#f6f0f8] shadow-sm text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
              <i className={`fa-solid ${item.icon} text-[#91569c]`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold uppercase tracking-wider text-xs text-[#5c3a62] group-hover:text-[#91569c] transition-colors">{item.label}</span>
              <p className="text-[9px] text-[#888] mt-0.5">{item.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Middle — free area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center opacity-30">
          <i className="fa-solid fa-wand-magic-sparkles text-4xl text-[#ceadd4] mb-3 block"></i>
          <p className="text-[#888] text-xs font-bold uppercase tracking-wider">Ready to create</p>
          <p className="text-[#ceadd4] text-[10px] mt-1">Pick a step from the left or chat with the assistant</p>
        </div>
      </div>

      {/* Right — Assistant */}
      <div className="w-80 flex-shrink-0 p-4 pl-0">
        <ChatBotBoundary><ChatBot /></ChatBotBoundary>
      </div>
    </div>
  );
};

interface ReferenceInputSectionProps {
  title: string;
  description?: string;
  value: ReferenceInput;
  type: 'character' | 'clothing' | 'background';
  icon: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'character' | 'clothing' | 'background', slotIndex: number) => void;
  onRemoveImage: (type: 'character' | 'clothing' | 'background', index: number) => void;
}

const ReferenceInputSection: React.FC<ReferenceInputSectionProps> = ({
  title,
  description,
  value,
  type,
  icon,
  onFileUpload,
  onRemoveImage,
}) => {
  const slots = [value.images[0], value.images[1], value.images[2]];
  return (
    <div className="bg-white border border-[#e0d6e3]/80 p-4 rounded-xl space-y-3">
      <div className="bg-white rounded-t-lg py-1">
        <label className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
          <i className={`fa-solid ${icon} text-[#91569c]`}></i>
          {title}
        </label>
        {description && (
          <p className="text-[#3a3a3a] text-[11px] leading-relaxed mt-1.5">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative aspect-square">
            <input type="file" id={`upload-${type}-${i}`} className="hidden" accept="image/*" onChange={(e) => onFileUpload(e, type, i)} />
            <label htmlFor={`upload-${type}-${i}`} className="flex flex-col items-center justify-center w-full h-full bg-white border-2 border-dashed border-[#ceadd4] rounded-lg cursor-pointer hover:border-[#91569c]/40 transition-all overflow-hidden group">
              {slots[i] ? (
                <img src={slots[i]} className="w-full h-full object-cover" alt="" />
              ) : (
                <i className="fa-solid fa-plus text-[#3a3a3a] text-xl group-hover:text-[#91569c]/70 transition-colors"></i>
              )}
            </label>
            {slots[i] && (
              <button
                type="button"
                onClick={() => onRemoveImage(type, i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/90 rounded flex items-center justify-center text-[#5c3a62] text-[10px] hover:bg-red-500"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [theme, setTheme] = useState<string>(GridTheme.CINEMATIC);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [images, setImages] = useState<GridImage[]>(() =>
    Array.from({ length: TOTAL_CELLS }).map((_, i) => ({
      id: `img-${i}`,
      loading: false,
      promptSuffix: SHOT_SPECS[i].label,
    }))
  );
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'concept' | 'images' | 'scenes' | 'video' | 'projects'>('landing');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [limitCooldownRemaining, setLimitCooldownRemaining] = useState(0);

  // ─── Project state ───────────────────────────────────────────────────────
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('tensorax_active_project');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveProject(parsed);
      } catch { /* ignore */ }
    }
    DB.listProjects().then(setAllProjects).catch(() => {});
  }, []);

  const persistProject = (p: Project | null) => {
    setActiveProject(p);
    if (p) localStorage.setItem('tensorax_active_project', JSON.stringify(p));
    else localStorage.removeItem('tensorax_active_project');
  };

  const handleCreateProject = async (data: NewProjectData | string) => {
    try {
      const isWizard = typeof data !== 'string';
      const name = isWizard ? data.name : data;
      const brandId = isWizard ? data.brandId : activeBrandId;
      const description = isWizard ? data.brief : '';
      const notes = isWizard && data.scope ? `Scope: ${data.scope}` : '';

      const project = await DB.createProject({ name, status: 'active', brandId, description, characterIds: [], sceneryIds: [], clothingIds: [], conceptIds: [], imageIds: [], videoIds: [], notes });
      persistProject(project);
      setAllProjects(prev => [...prev, project]);

      if (isWizard) {
        setActiveBrandIdState(data.brandId);
        setActiveBrandId(data.brandId);
        const route = getScopeRoute(data.scope);
        setCurrentScreen(route);
      }
    } catch (e) {
      console.error('[App] Create project failed:', e);
      alert('Failed to create project. Is the backend running?');
    }
  };

  const handleSelectProject = (p: Project) => {
    persistProject(p);
    setCurrentScreen('landing');
  };

  // Video provider: 'veo' | 'kling'
  const [videoProvider, setVideoProvider] = useState<'veo' | 'kling'>('veo');
  const [klingApiKey, setKlingApiKey] = useState(() => {
    try { return localStorage.getItem('tensorax_kling_key') || ''; } catch { /* ignore */ }
    return process.env.TENSORAX_KLING_KEY || '';
  });

  // Video State
  const [videoState, setVideoState] = useState<VideoState & { movementVideo?: string }>({
    prompt: '',
    movementDescription: '',
    duration: '5s',
    isGenerating: false,
    progressMessage: ''
  });

  // Brand Identity
  const [brands, setBrands] = useState<BrandProfile[]>(() => loadBrands());
  const [activeBrandId, setActiveBrandIdState] = useState(() => getActiveBrandId());

  const handleSelectBrand = (id: string) => {
    setActiveBrandIdState(id);
    setActiveBrandId(id);
  };
  const handleAddBrand = (brand: BrandProfile) => {
    const updated = [...brands, brand];
    setBrands(updated);
    saveBrands(updated);
  };
  const handleDeleteBrand = (id: string) => {
    const updated = brands.filter(b => b.id !== id);
    setBrands(updated);
    saveBrands(updated);
    if (activeBrandId === id) handleSelectBrand('next-default');
  };

  // Scene Inputs
  const [character, setCharacter] = useState<ReferenceInput>({ text: '', images: [] });
  const [clothing, setClothing] = useState<ReferenceInput>({ text: '', images: [] });
  const [background, setBackground] = useState<ReferenceInput>({ text: '', images: [] });
  const [scenePrompt, setScenePrompt] = useState('');
  const [isAutoGeneratingPrompts, setIsAutoGeneratingPrompts] = useState(false);
  const [shotPrompts, setShotPrompts] = useState<string[]>(() => Array(TOTAL_CELLS).fill(''));
  const [apiKeyModalType, setApiKeyModalType] = useState<'analysis' | 'copy' | 'image' | null>(null);
  const [apiKeyModalValue, setApiKeyModalValue] = useState('');
  const [apiKeyModalModel, setApiKeyModalModel] = useState('');

  const openApiKeyModal = (type: 'analysis' | 'copy' | 'image') => {
    setApiKeyModalType(type);
    setApiKeyModalValue('');
    try {
      const stored = localStorage.getItem(`tensorax_${type}_model`);
      setApiKeyModalModel(stored || '');
    } catch {
      setApiKeyModalModel('');
    }
  };

  const closeApiKeyModal = () => {
    setApiKeyModalType(null);
    setApiKeyModalValue('');
    setApiKeyModalModel('');
  };

  const loadTestData = async () => {
    const urls = ['/test-refs/character.jpeg', '/test-refs/clothing.png', '/test-refs/scenery.png'];
    const toDataUrl = async (url: string) => {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    };
    try {
      const [charUrl, clothingUrl, sceneryUrl] = await Promise.all(urls.map(toDataUrl));
      setCharacter(p => ({ ...p, images: [charUrl, p.images[1], p.images[2]] }));
      setClothing(p => ({ ...p, images: [clothingUrl, p.images[1], p.images[2]] }));
      setBackground(p => ({ ...p, images: [sceneryUrl, p.images[1], p.images[2]] }));
    } catch (e) {
      console.error('[TensorAx] Load test data failed', e);
      alert('Could not load test images. Ensure /test-refs/ exists in public.');
    }
  };

  const saveApiKeyFromModal = () => {
    const key = apiKeyModalValue.trim();
    if (key) {
      GeminiService.setApiKey(key);
      if (apiKeyModalType) {
        try {
          localStorage.setItem(`tensorax_${apiKeyModalType}_key`, key);
          localStorage.setItem(`tensorax_${apiKeyModalType}_model`, apiKeyModalModel.trim());
        } catch {
          // ignore
        }
      }
      setApiKeySelected(true);
      closeApiKeyModal();
    }
  };

  useEffect(() => {
    const checkKey = async () => {
      // 1) Rehydrate main key from localStorage/cookie
      if (GeminiService.hydrateApiKeyFromStorage()) {
        setApiKeySelected(true);
        return;
      }

      // 2) Rehydrate from Analysis or Copy keys if user saved them via modal
      const analysisKey = hasStoredKeyForType('analysis') ? getApiKeyForType('analysis') : null;
      const copyKey = hasStoredKeyForType('copy') ? getApiKeyForType('copy') : null;
      const keyToUse = analysisKey || copyKey;
      if (keyToUse) {
        GeminiService.setApiKey(keyToUse);
        setApiKeySelected(true);
        return;
      }

      // 3) Fallback to env-defined key
      const envKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
      const isEnvPlaceholder = /placeholder_api_key|your[_-]?api[_-]?key/i.test(envKey);
      if (envKey && !isEnvPlaceholder) {
        GeminiService.setApiKey(envKey);
        setApiKeySelected(true);
        return;
      }

      // 4) Fallback to IDX/AI Studio environment
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    console.log("Key button clicked");
    // Force prompt for localhost
    if (typeof window !== "undefined" && (!window.aistudio || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      const key = prompt("Enter your Gemini API Key:");
      if (key?.trim()) {
        GeminiService.setApiKey(key);
        setApiKeySelected(true);
        alert("API Key saved!");
      }
      return;
    }

    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  };

  const enhancePrompt = async () => {
    if (!videoState.prompt || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await GeminiService.enhancePrompt(
        videoState.prompt,
        "You are Gemini 3 creative prompt optimizer. Rewrite this video generation prompt to be cinematic, technical, and concise (under 80 words), preserving intent."
      );
      setVideoState(v => ({ ...v, prompt: enhanced }));
    } catch (e) {
      console.error("Enhance prompt failed", e);
      alert("Prompt enhancement failed. Check API key or model access.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const autoGeneratePrompts = async () => {
    if (isAutoGeneratingPrompts) return;

    const analysisKey = getApiKeyForType('analysis');
    const copyKey = getApiKeyForType('copy') || analysisKey;
    const keyToUse = copyKey || analysisKey;
    if (!keyToUse) {
      alert("Please enter an API key via the Analysis or Copy button (Settings → API Keys).");
      return;
    }

    setIsAutoGeneratingPrompts(true);
    try {
      const refImages = {
        character: character.images,
        clothing: clothing.images,
        background: background.images,
      };

      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: keyToUse,
          analysisModel: getModelForType('analysis') || null,
          copyModel: getModelForType('copy') || null,
          refImages,
          userNote: scenePrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      const { scenePrompt: genScene, shotPrompts: genShots } = await res.json();
      if (genScene) setScenePrompt(genScene);
      if (genShots?.length) setShotPrompts(genShots);
    } catch (e) {
      console.error("[TensorAx] Auto-generate prompts failed.", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        full: e,
      });
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Auto-generate failed:\n\n${msg}\n\nCheck the backend terminal for details (Step 1 / Step 2 logs).`);
    } finally {
      setIsAutoGeneratingPrompts(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'character' | 'clothing' | 'background' | 'start' | 'mid' | 'end' | 'movementVideo', slotIndex?: number) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === 'string') {
          if (type === 'character' && slotIndex !== undefined) {
            setCharacter(p => {
              const next = [...p.images];
              next[slotIndex] = result;
              return { ...p, images: next };
            });
          }
          if (type === 'clothing' && slotIndex !== undefined) {
            setClothing(p => {
              const next = [...p.images];
              next[slotIndex] = result;
              return { ...p, images: next };
            });
          }
          if (type === 'background' && slotIndex !== undefined) {
            setBackground(p => {
              const next = [...p.images];
              next[slotIndex] = result;
              return { ...p, images: next };
            });
          }
          if (type === 'start') setVideoState(v => ({ ...v, startImage: result }));
          if (type === 'mid') setVideoState(v => ({ ...v, midImage: result }));
          if (type === 'end') setVideoState(v => ({ ...v, endImage: result }));
          if (type === 'movementVideo') setVideoState(v => ({ ...v, movementVideo: result }));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeReferenceImage = (type: 'character' | 'clothing' | 'background', index: number) => {
    if (type === 'character') setCharacter(p => ({ ...p, images: p.images.filter((_, i) => i !== index) }));
    if (type === 'clothing') setClothing(p => ({ ...p, images: p.images.filter((_, i) => i !== index) }));
    if (type === 'background') setBackground(p => ({ ...p, images: p.images.filter((_, i) => i !== index) }));
  };

  const useImageAsVideoFrame = (url: string, slot: 'start' | 'mid' | 'end') => {
    setVideoState(v => ({
      ...v,
      ...(slot === 'start' ? { startImage: url } : {}),
      ...(slot === 'mid'   ? { midImage:   url } : {}),
      ...(slot === 'end'   ? { endImage:   url } : {}),
    }));
    setCurrentScreen('video');
  };

  const startVideoGeneration = async () => {
    if (videoState.isGenerating || !videoState.prompt) return;
    setVideoState(v => ({ ...v, isGenerating: true, progressMessage: "Initializing..." }));
    try {
      let url: string | undefined;

      if (videoProvider === 'kling') {
        if (!klingApiKey.trim()) {
          alert("Please enter your fal.ai API key for Kling generation.");
          setVideoState(v => ({ ...v, isGenerating: false, progressMessage: '' }));
          return;
        }
        if (!videoState.startImage) {
          alert("Kling requires a Start frame. Hover over a generated image and click Start.");
          setVideoState(v => ({ ...v, isGenerating: false, progressMessage: '' }));
          return;
        }
        const durationSecs = videoState.duration === '10s' ? '10' : '5';
        const res = await fetch('/api/generate-video-kling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: klingApiKey.trim(),
            startImageUrl: videoState.startImage,
            endImageUrl: videoState.endImage || null,
            motionVideoUrl: (videoState as any).motionVideo || null,
            prompt: videoState.prompt,
            duration: durationSecs,
            aspectRatio,
            generateAudio: false,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Kling request failed: ${res.status}`);
        }
        const data = await res.json();
        url = data.videoUrl;
      } else {
        url = await GeminiService.generateVideo({
          prompt: videoState.prompt,
          startImage: videoState.startImage,
          midImage: videoState.midImage,
          endImage: videoState.endImage,
          movementDescription: videoState.movementDescription,
          duration: videoState.duration,
          onProgress: (msg) => setVideoState(v => ({ ...v, progressMessage: msg }))
        });
      }

      if (url) {
        setVideoState(v => ({ ...v, resultUrl: url, isGenerating: false, progressMessage: '' }));
      }
    } catch (e: any) {
      console.error("Video generation failed:", e);
      setVideoState(v => ({ ...v, isGenerating: false, progressMessage: "Error encountered." }));
      alert(`Video generation failed: ${e?.message || 'Unknown error'}`);
    }
  };

  const downloadAllImages = async () => {
    const successfulImages = images.filter(img => !img.loading && img.url);
    if (successfulImages.length === 0) return;
    setIsZipping(true);
    try {
      // Save each frame to the active project folder
      if (activeProject) {
        for (const img of successfulImages) {
          if (img.url) {
            const filename = `frame-${img.id.split('-')[1]}.png`;
            await DB.saveProjectFile(activeProject.id, filename, img.url, 'frames').catch(e => console.warn('[Frames] Save failed:', e));
          }
        }
      }

      const JSZipModule = await import('jszip');
      const JSZip = (JSZipModule as any).default || JSZipModule;
      const zip = new JSZip();
      successfulImages.forEach((img) => {
        if (img.url) {
          const base64Data = img.url.split(',')[1];
          zip.file(`frame-${img.id.split('-')[1]}.png`, base64Data, { base64: true });
        }
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = activeProject ? `${activeProject.slug}-frames.zip` : `tensorax-export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Zipping failed", err);
      alert("Failed to create zip file.");
    } finally {
      setIsZipping(false);
    }
  };

  const getPromptForCell = (i: number) => {
    const baseScene = scenePrompt.trim() || "Cohesive cinematic scene from reference images.";
    if (shotPrompts[i]?.trim()) return shotPrompts[i].trim();
    const spec = SHOT_SPECS[i];
    return `${baseScene} ${spec.instruction}`;
  };

  const generateSingleImage = async (cellIndex: number) => {
    const hasRefImages = character.images.length + clothing.images.length + background.images.length > 0;
    const hasPrompt = scenePrompt.trim().length > 0;
    const hasShotPrompts = shotPrompts.some(p => p.trim().length > 0);
    if (!hasRefImages && !hasPrompt && !hasShotPrompts) {
      alert("Please add reference images, add a prompt, or auto-fill shot prompts first.");
      return;
    }
    const allRefImages = [...character.images, ...clothing.images, ...background.images].filter(Boolean) as string[];

    // Build structured prompt matching the backup approach: explicit labeled sections
    // so gemini-3-pro-image-preview knows exactly which reference images map to which section
    const shotPromptText = getPromptForCell(cellIndex);
    const parts: string[] = [];

    // Shot-specific prompt (AI-generated, fully self-contained) goes first
    if (shotPromptText.trim()) parts.push(shotPromptText.trim());

    // Add explicit labeled sections from user text inputs (if filled in)
    // These reinforce the reference images with clear labels the model can match
    if ((character as any).text?.trim()) parts.push(`Subject character: ${(character as any).text.trim()}`);
    if ((clothing as any).text?.trim()) parts.push(`Outfit: ${(clothing as any).text.trim()}`);
    if ((background as any).text?.trim()) parts.push(`Environment: ${(background as any).text.trim()}`);

    // Scene description as final context anchor
    if (scenePrompt.trim()) parts.push(`Scene context: ${scenePrompt.trim()}`);

    const fullPrompt = `Consistent high-fidelity render. Use image references for subject, clothing, and environment consistency. ${parts.join('. ')}.`;

    setImages(prev => {
      const updated = [...prev];
      if (!updated[cellIndex]) return updated;
      updated[cellIndex] = { ...updated[cellIndex], loading: true, error: undefined };
      return updated;
    });
    setIsGenerating(true);

    try {
      const url = await generateImageWithCurrentProvider({
        prompt: fullPrompt,
        size: imageSize,
        aspectRatio,
        referenceImages: allRefImages,
      });
      setImages(prev => {
        const updated = [...prev];
        if (!updated[cellIndex]) return updated;
        updated[cellIndex] = { ...updated[cellIndex], loading: false, url, error: undefined };
        return updated;
      });
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes("Requested entity was not found")) {
        setApiKeySelected(false);
      }
      const msg = e?.message ?? String(e);
      const isLimitError = /quota|rate limit|resource exhausted|429|exceeded|daily|limit/i.test(msg);
      const errorLabel = isLimitError ? "Limit exceeded" : (msg.length > 60 ? msg.slice(0, 57) + "…" : msg);
      setImages(prev => {
        const updated = [...prev];
        if (!updated[cellIndex]) return updated;
        updated[cellIndex] = { ...updated[cellIndex], loading: false, error: errorLabel };
        return updated;
      });
      if (isLimitError) {
        setLimitCooldownRemaining(65);
        alert("Rate limit exceeded. Wait about 1 minute — the Generate buttons will show when you can try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (currentScreen === 'projects') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        <header className="h-14 bg-white border-b border-[#e0d6e3] flex items-center px-6 z-20 shadow-sm">
          <img src="/logo-main.png" alt="TensorAx Studio" className="h-8 cursor-pointer" onClick={() => { persistProject(null); setCurrentScreen('landing'); }} />
          {activeProject && (
            <div className="mx-auto flex items-center gap-3">
              <span className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">{activeProject.name}</span>
              {(() => { const b = brands.find(x => x.id === activeBrandId); return b ? (
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#91569c] bg-[#f6f0f8] border border-[#ceadd4] px-2 py-0.5 rounded">{b.name}</span>
              ) : null; })()}
            </div>
          )}
          <ApiKeyButton />
        </header>
        <ProjectsScreen onSelectProject={handleSelectProject} onBack={() => setCurrentScreen('landing')} />
      </div>
    );
  }

  if (currentScreen === 'landing') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
         <header className="h-14 bg-white border-b border-[#e0d6e3] flex items-center px-6 z-20 shadow-sm">
            <img src="/logo-main.png" alt="TensorAx Studio" className="h-8 cursor-pointer" onClick={() => { persistProject(null); setCurrentScreen('landing'); }} />
            {activeProject && (
              <div className="mx-auto flex items-center gap-3">
              <span className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">{activeProject.name}</span>
              {(() => { const b = brands.find(x => x.id === activeBrandId); return b ? (
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#91569c] bg-[#f6f0f8] border border-[#ceadd4] px-2 py-0.5 rounded">{b.name}</span>
              ) : null; })()}
            </div>
            )}
            <ApiKeyButton />
          </header>
          <LandingPage
            onNavigate={(screen) => setCurrentScreen(screen as any)}
            activeProject={activeProject}
            allProjects={allProjects}
            brands={brands}
            onCreateProject={handleCreateProject}
            onSelectProject={handleSelectProject}
            onNewProject={() => persistProject(null)}
          />
      </div>
    );
  }

  if (currentScreen === 'concept') {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-[#edecec]">
        <header className="h-12 flex-shrink-0 bg-white border-b border-[#e0d6e3] flex items-center px-5 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentScreen('landing')}
              className="text-[#91569c]/80 hover:text-[#91569c] transition-colors p-1"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <img src="/logo-main.png" alt="TensorAx Studio" className="h-6 cursor-pointer" onClick={() => { persistProject(null); setCurrentScreen('landing'); }} />
          </div>
          {activeProject && (
            <div className="mx-auto flex items-center gap-3">
              <span className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">{activeProject.name}</span>
              {(() => { const b = brands.find(x => x.id === activeBrandId); return b ? (
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#91569c] bg-[#f6f0f8] border border-[#ceadd4] px-2 py-0.5 rounded">{b.name}</span>
              ) : null; })()}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Copy</span>
            <ApiKeyButton />
          </div>
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ConceptScreen onBack={() => setCurrentScreen('landing')} onOpenApiKeyModal={openApiKeyModal} brands={brands} activeBrandId={activeBrandId} activeProject={activeProject} />
          <div className="w-72 flex-shrink-0 p-3 pl-0">
            <ChatBotBoundary><ChatBot /></ChatBotBoundary>
          </div>
        </div>

        {apiKeyModalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={closeApiKeyModal}>
            <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide mb-3">
                {apiKeyModalType.charAt(0).toUpperCase() + apiKeyModalType.slice(1)} API Key
              </h3>
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">Model</label>
                <select
                  value={apiKeyModalModel}
                  onChange={(e) => setApiKeyModalModel(e.target.value)}
                  className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] focus:ring-1 focus:ring-[#91569c]/50 outline-none cursor-pointer"
                >
                  <option value="">Select model...</option>
                  {API_MODELS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.models.map(m => <option key={m} value={m}>{m}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">API Key</label>
                <p className="text-[9px] text-[#888] mb-1">Claude → Anthropic key. Gemini → Google AI key.</p>
                <input
                  type="password"
                  value={apiKeyModalValue}
                  onChange={(e) => setApiKeyModalValue(e.target.value)}
                  placeholder="Enter your API key..."
                  className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] placeholder:text-[#888] focus:ring-1 focus:ring-[#91569c]/50 outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={closeApiKeyModal} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#eadcef] transition-colors">
                  Cancel
                </button>
                <button onClick={saveApiKeyFromModal} disabled={!apiKeyModalValue.trim()} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#91569c] text-[#5c3a62] border border-[#91569c] hover:bg-[#5c3a62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentScreen === 'images') {
    return <ImagesScreen onBack={() => setCurrentScreen('landing')} brands={brands} activeBrandId={activeBrandId} activeProject={activeProject} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#edecec]">
      <header className="h-12 flex-shrink-0 bg-white border-b border-[#e0d6e3] flex items-center px-5 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentScreen('landing')}
            className="text-[#91569c]/80 hover:text-[#91569c] transition-colors p-1"
          >
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <img src="/logo-main.png" alt="TensorAx Studio" className="h-6 cursor-pointer" onClick={() => { persistProject(null); setCurrentScreen('landing'); }} />
        </div>
        {activeProject && (
            <div className="mx-auto flex items-center gap-3">
              <span className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">{activeProject.name}</span>
              {(() => { const b = brands.find(x => x.id === activeBrandId); return b ? (
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#91569c] bg-[#f6f0f8] border border-[#ceadd4] px-2 py-0.5 rounded">{b.name}</span>
              ) : null; })()}
            </div>
        )}
        <div className="flex items-center gap-2">
          {currentScreen === 'scenes' && images.some(img => img.url) && !isGenerating && (
            <button
              onClick={downloadAllImages}
              disabled={isZipping}
              className="flex items-center gap-2 bg-[#f6f0f8] hover:bg-[#eadcef] text-[#5c3a62] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[#ceadd4] transition-all active:scale-95 disabled:opacity-50"
            >
              <i className={`fa-solid ${isZipping ? 'fa-spinner fa-spin' : 'fa-file-zipper'}`}></i>
              {isZipping ? 'Zipping...' : 'Download Zip'}
            </button>
          )}
          <ApiKeyButton />
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {currentScreen === 'scenes' ? (
          <>
            <aside className="w-[25%] min-w-[280px] max-w-[360px] h-full min-h-0 max-h-full bg-[#edecec] border border-[#e0d6e3] rounded-xl flex flex-col overflow-hidden flex-shrink-0 mx-2 mt-0 mb-2">
              <div className="p-4 border-b border-[#ceadd4] flex-shrink-0 flex items-center justify-between">
                <h2 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-[#91569c]"></i>
                  SCENE CONFIGURATION
                </h2>
                <button
                  type="button"
                  onClick={loadTestData}
                  className="text-[9px] font-black uppercase text-[#91569c] hover:text-[#91569c]/80 border border-[#ceadd4] hover:border-[#91569c]/50 rounded px-2 py-1 transition-colors"
                >
                  Load test
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                <ReferenceInputSection
                  title="CHARACTER"
                  description="Upload up to 3 reference images for character appearance (e.g. face, pose, build)."
                  value={character}
                  type="character"
                  icon="fa-user"
                  onFileUpload={handleFileUpload}
                  onRemoveImage={removeReferenceImage}
                />
                <ReferenceInputSection
                  title="CLOTHING"
                  description="Upload up to 3 reference images for wardrobe or outfit style."
                  value={clothing}
                  type="clothing"
                  icon="fa-shirt"
                  onFileUpload={handleFileUpload}
                  onRemoveImage={removeReferenceImage}
                />
                <ReferenceInputSection
                  title="SCENERY"
                  description="Upload up to 3 reference images for location, setting, or background style."
                  value={background}
                  type="background"
                  icon="fa-mountain-sun"
                  onFileUpload={handleFileUpload}
                  onRemoveImage={removeReferenceImage}
                />

                <div className="bg-white border border-[#e0d6e3]/80 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                      <i className="fa-solid fa-film text-[#91569c]"></i>
                      PROMPT
                    </label>
                  </div>
                  <textarea
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    rows={3}
                    className="w-full min-h-[4.5rem] resize-y bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#91569c]/50 outline-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/70"
                    placeholder="Enter your prompt..."
                  />
                  <button
                    type="button"
                    onClick={autoGeneratePrompts}
                    disabled={isAutoGeneratingPrompts}
                    className="w-full bg-[#edecec] hover:bg-[#585858] text-[#5c3a62] font-black uppercase text-[10px] tracking-wider py-2.5 rounded-lg border border-[#ceadd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAutoGeneratingPrompts ? (
                      <span><i className="fa-solid fa-spinner fa-spin mr-2"></i>Generating...</span>
                    ) : (
                      'Auto Generate'
                    )}
                  </button>
                </div>

                <div className="bg-white border border-[#e0d6e3]/80 p-4 rounded-xl space-y-3">
                  <label className="block text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                    <i className="fa-solid fa-gear text-[#91569c]"></i>
                    SETTINGS
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-heading font-bold text-[#3a3a3a] uppercase tracking-wide mb-1">Style</label>
                      <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#91569c]/50 outline-none text-[#3a3a3a]"
                      >
                        {Object.entries(GridTheme).map(([key, val]) => (
                          <option key={key} value={val}>{key.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-heading font-bold text-[#3a3a3a] uppercase tracking-wide mb-2">API Keys</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('analysis')}
                          title="Analysis API Key"
                          className="flex-1 py-2 px-2 rounded-lg bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] transition-colors flex items-center justify-center"
                        >
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('copy')}
                          title="Copy API Key"
                          className="flex-1 py-2 px-2 rounded-lg bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] transition-colors flex items-center justify-center"
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('image')}
                          title="Image API Key (Imagen / Vertex)"
                          className="flex-1 py-2 px-2 rounded-lg bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] transition-colors flex items-center justify-center"
                        >
                          <i className="fa-solid fa-image"></i>
                        </button>
                      </div>
                      <p className="mt-1 text-[9px] text-[#3a3a3a]/70">Image button: Imagen (Vertex) API key for generation.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-heading font-bold text-[#3a3a3a] uppercase tracking-wide mb-1">Resolution</label>
                        <select
                          value={imageSize}
                          onChange={(e) => setImageSize(e.target.value as ImageSize)}
                          className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] outline-none text-[#3a3a3a] focus:ring-1 focus:ring-[#91569c]/50"
                        >
                          <option value="1K">1K</option>
                          <option value="2K">2K</option>
                          <option value="4K">4K</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-heading font-bold text-[#3a3a3a] uppercase tracking-wide mb-1">Aspect</label>
                        <select
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                          className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] outline-none text-[#3a3a3a] focus:ring-1 focus:ring-[#91569c]/50"
                        >
                          <option value="9:16">9:16</option>
                          <option value="1:1">1:1</option>
                          <option value="16:9">16:9</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[#e0d6e3]/60 bg-[#edecec]">
                <p className="text-[10px] text-[#3a3a3a] text-center mb-2">Generate each image in the grid below (one at a time).</p>
              </div>
            </aside>
            <main className="flex-1 flex flex-col min-h-0 bg-[#edecec] pt-0 pb-2 px-2 min-w-0 overflow-hidden">
               <div className="flex-1 min-h-0 flex flex-col overflow-hidden mx-auto max-w-4xl w-full bg-[#edecec] border border-[#e0d6e3] rounded-xl">
                 <div className="flex-shrink-0 p-2 sm:p-4 border-b border-[#ceadd4]">
                   <h2 className="text-sm sm:text-base md:text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                     <i className="fa-solid fa-th-large text-[#91569c]"></i>
                     Frames
                   </h2>
                 </div>
                 <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5 sm:p-3">
                 <div className="grid grid-cols-3 gap-1 sm:gap-2">
                 {images.map((img, idx) => (
                   <div key={img.id} className="aspect-[9/16] bg-white relative rounded-lg overflow-hidden group flex flex-col border border-[#ceadd4]">
                     {img.loading ? (
                       <div className="absolute inset-0 flex flex-col items-center justify-center animate-pulse text-[#91569c]/30 gap-2 z-10 bg-white">
                         <i className="fa-solid fa-spinner fa-spin text-xl sm:text-2xl md:text-3xl text-[#91569c]"></i>
                         <span className="text-[9px] sm:text-[10px] md:text-xs uppercase text-[#3a3a3a]">Generating {idx + 1}</span>
                       </div>
                     ) : img.error ? (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500/60 gap-2 p-2 z-10 bg-white">
                         <i className="fa-solid fa-triangle-exclamation text-base sm:text-lg md:text-xl"></i>
                         <span className="text-[9px] sm:text-[10px] md:text-[11px] uppercase tracking-wider text-center text-[#3a3a3a]">{img.error}</span>
                         <button
                           type="button"
                           onClick={() => generateSingleImage(idx)}
                           disabled={isGenerating}
                           className="mt-1 text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase text-[#91569c] hover:text-[#91569c]/80 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 disabled:opacity-50"
                          >
                            Generate again
                         </button>
                       </div>
                     ) : img.url ? (
                       <>
                         <div className="flex-1 min-h-0 relative rounded-lg m-1.5 overflow-hidden bg-white">
                           <img src={img.url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="" />
                           {/* Use as video keyframe overlay */}
                           <div className="absolute bottom-0 left-0 right-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-1 p-1">
                             {(['start','mid','end'] as const).map(slot => (
                               <button
                                 key={slot}
                                 type="button"
                                 onClick={() => useImageAsVideoFrame(img.url!, slot)}
                                 className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[#91569c] text-[#3a3a3a] hover:bg-white transition-colors"
                               >
                                 {slot}
                               </button>
                             ))}
                           </div>
                         </div>
                         <div className="flex-shrink-0 p-1 sm:p-1.5 flex items-center gap-1 sm:gap-2">
                           <div className="relative flex-1 min-w-0">
                             <textarea
                               value={shotPrompts[idx] ?? ''}
                               onChange={(e) => setShotPrompts(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                               onKeyDown={(e) => e.stopPropagation()}
                               rows={2}
className="w-full min-h-[2rem] sm:min-h-[2.5rem] resize-y bg-white border-2 border-dashed border-[#ceadd4] rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-[9px] sm:text-[10px] md:text-[11px] outline-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/70 hover:border-[#91569c]/40 focus:border-[#91569c] transition-all"
                             placeholder={`Prompt for shot ${idx + 1}...`}
                           />
                           </div>
                           <button type="button" onClick={() => generateSingleImage(idx)} disabled={isGenerating} className="flex-shrink-0 py-1 sm:py-1.5 px-2 sm:px-3 rounded text-[9px] sm:text-[10px] md:text-sm font-black uppercase text-[#91569c] hover:text-[#91569c]/80 disabled:opacity-50">Regenerate</button>
                         </div>
                       </>
                     ) : (
                       <>
                         <div className="text-[9px] sm:text-[10px] md:text-xs font-bold text-[#3a3a3a] uppercase flex-shrink-0 px-1.5 sm:px-2 pt-1 sm:pt-1.5 min-h-[2em] sm:min-h-[2.5em] leading-tight w-full">{SHOT_SPECS[idx].label}</div>
                         <div className="flex-1 min-h-0 rounded-lg mx-1 sm:mx-2 flex flex-col p-1.5 sm:p-2 gap-1.5 sm:gap-2 bg-white overflow-hidden">
                           <div className="relative flex-1 min-h-0 flex flex-col">
                             <textarea
                               value={shotPrompts[idx] ?? ''}
                               onChange={(e) => setShotPrompts(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                               onKeyDown={(e) => e.stopPropagation()}
                               rows={3}
                               className="w-full min-h-0 flex-1 resize-y bg-white border-2 border-dashed border-[#ceadd4] rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[9px] sm:text-[10px] md:text-[11px] outline-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/70 hover:border-[#91569c]/40 focus:border-[#91569c] transition-all"
                               placeholder={`Prompt for shot ${idx + 1}...`}
                             />
                           </div>
                           <button
                             type="button"
                             onClick={() => generateSingleImage(idx)}
                             disabled={isGenerating}
className="flex-shrink-0 py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-[10px] sm:text-xs md:text-base font-black uppercase tracking-wider bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] hover:border-[#ceadd4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Generate {idx + 1}
                           </button>
                         </div>
                       </>
                     )}
                   </div>
                 ))}
                 </div>
                 </div>
               </div>
            </main>
          </>
        ) : (
          <>
            <aside className="w-80 bg-[#edecec] border-r border-[#e0d6e3] flex flex-col overflow-hidden flex-shrink-0">
              <div className="p-4 border-b border-[#e0d6e3] bg-white/50">
                <h2 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Video Configuration</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Video Provider Toggle */}
                <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-3">
                  <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Video Engine</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#ceadd4]">
                    {(['veo', 'kling'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setVideoProvider(p)}
                        className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
                          videoProvider === p
                            ? 'bg-[#91569c] text-[#3a3a3a]'
                            : 'bg-[#edecec] text-[#5c3a62]/60 hover:text-[#5c3a62]'
                        }`}
                      >
                        {p === 'veo' ? 'Veo 3.1' : 'Kling v2'}
                      </button>
                    ))}
                  </div>
                  {videoProvider === 'kling' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#3a3a3a] uppercase tracking-wide mb-1">fal.ai API Key</label>
                        <input
                          type="password"
                          value={klingApiKey}
                          onChange={(e) => {
                            setKlingApiKey(e.target.value);
                            localStorage.setItem('tensorax_kling_key', e.target.value);
                          }}
                          placeholder="Get key at fal.ai/dashboard/keys"
                          className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[10px] text-[#3a3a3a] placeholder:text-[#3a3a3a]/60 outline-none focus:ring-1 focus:ring-[#91569c]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#3a3a3a] uppercase tracking-wide mb-1">Motion Reference Video <span className="font-normal normal-case text-[#3a3a3a]/60">(optional)</span></label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="video/*"
                            id="kling-motion-video"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (typeof ev.target?.result === 'string') {
                                  setVideoState(v => ({ ...v, motionVideo: ev.target!.result as string } as any));
                                }
                              };
                              reader.readAsDataURL(file);
                              e.target.value = '';
                            }}
                          />
                          <label htmlFor="kling-motion-video" className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer text-[10px] transition-colors ${(videoState as any).motionVideo ? 'border-[#91569c] bg-[#91569c]/10 text-[#3a3a3a]' : 'border-[#ceadd4] bg-white text-[#3a3a3a]/60 hover:border-[#91569c]/50'}`}>
                            <i className={`fa-solid ${(videoState as any).motionVideo ? 'fa-video text-[#91569c]' : 'fa-film'}`}></i>
                            {(videoState as any).motionVideo ? 'Motion video set ✓' : 'Upload motion reference video'}
                          </label>
                          {(videoState as any).motionVideo && (
                            <button type="button" onClick={() => setVideoState(v => { const n = { ...v }; delete (n as any).motionVideo; return n; })} className="text-[10px] text-red-500 hover:text-red-400 px-1">✕</button>
                          )}
                        </div>
                        <p className="text-[9px] text-[#3a3a3a]/60 mt-1">When set → Kling motion control mode: your Start frame as character style, video as motion guide.</p>
                      </div>
                    </div>
                  )}
                  {videoProvider === 'veo' && (
                    <p className="text-[9px] text-[#3a3a3a]/60">Veo 3.1 via Gemini API. Supports Start, Mid and End frames.</p>
                  )}
                </div>

                {/* Generation Prompt */}
                <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Generation Prompt</label>
                    <button 
                      onClick={enhancePrompt}
                      disabled={isEnhancing || !videoState.prompt}
                      title="Enhance Prompt"
                      className={`text-sm transition-all p-1.5 rounded-lg border ${isEnhancing ? 'bg-white border-[#ceadd4] text-[#3a3a3a]' : 'bg-white border-[#ceadd4] text-[#91569c]/70 hover:text-[#91569c] hover:border-[#91569c]/30 active:scale-95'}`}
                    >
                      <i className={`fa-solid ${isEnhancing ? 'fa-wand-magic-sparkles fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                    </button>
                  </div>
                  <textarea 
                    value={videoState.prompt} 
                    onChange={(e) => setVideoState(v => ({ ...v, prompt: e.target.value }))} 
                    placeholder="Describe the cinematic scene..."
                    className="w-full bg-white border border-[#ceadd4] rounded-xl p-3 text-[11px] focus:ring-1 focus:ring-[#91569c] outline-none h-24 resize-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/70"
                  />
                </div>

                {/* Key Frame Sequence */}
                <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-4">
                  <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Key Frame Sequence</label>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-[#3a3a3a] tracking-wider">Upload key frame images</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'start', label: 'Start' },
                        { id: 'mid', label: 'Mid' },
                        { id: 'end', label: 'End' }
                      ].map(slot => (
                        <div key={slot.id} className="relative aspect-square">
                          <input type="file" id={`upload-${slot.id}`} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, slot.id as any)} />
                          <label htmlFor={`upload-${slot.id}`} className="flex flex-col items-center justify-center w-full h-full bg-white border border-[#ceadd4] border-dashed rounded-lg cursor-pointer hover:border-[#91569c]/30 transition-all overflow-hidden group">
                            { (videoState as any)[`${slot.id}Image`] ? (
                              <img src={(videoState as any)[`${slot.id}Image`]} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <i className="fa-solid fa-cloud-arrow-up text-[#5c3a62] text-lg group-hover:text-[#91569c]/50 transition-colors"></i>
                                <span className="text-xs font-black uppercase text-[#3a3a3a]">{slot.label}</span>
                              </div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Movement Path */}
                <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-4">
                  <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Movement Path</label>
                  <textarea 
                    value={videoState.movementDescription} 
                    onChange={(e) => setVideoState(v => ({ ...v, movementDescription: e.target.value }))} 
                    placeholder="Describe specific movements (e.g. camera zooms in)..."
                    className="w-full bg-white border border-[#ceadd4] rounded-xl p-3 text-[11px] focus:ring-1 focus:ring-[#91569c] outline-none h-20 resize-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/70" 
                  />
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-[#3a3a3a] tracking-wider">Upload movement video</p>
                    <div className="relative">
                      <input 
                        type="file" 
                        id="upload-movement-video" 
                        className="hidden" 
                        accept="video/*" 
                        onChange={(e) => handleFileUpload(e, 'movementVideo')} 
                      />
                      <label 
                        htmlFor="upload-movement-video" 
                        className={`flex items-center gap-3 w-full p-3 rounded-xl border border-dashed transition-all cursor-pointer ${videoState.movementVideo ? 'border-[#91569c]/50 bg-[#91569c]/5' : 'border-[#ceadd4] bg-white hover:border-[#91569c]/30'}`}
                      >
                        <i className={`fa-solid ${videoState.movementVideo ? 'fa-video text-[#91569c]' : 'fa-film text-[#5c3a62] text-lg'}`}></i>
                        <span className={`text-xs font-black uppercase ${videoState.movementVideo ? 'text-[#3a3a3a]' : 'text-[#3a3a3a]'}`}>
                          {videoState.movementVideo ? 'Video Attached' : 'Select Reference Video'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Select Duration */}
                <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-3">
                  <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Select Duration</label>
                  <select 
                    value={videoState.duration}
                    onChange={(e) => setVideoState(v => ({ ...v, duration: e.target.value as '5s' | '10s' }))}
                    className="w-full bg-white border border-[#ceadd4] rounded-xl p-3 text-[11px] outline-none text-[#3a3a3a] focus:ring-1 focus:ring-[#91569c] appearance-none cursor-pointer"
                  >
                    <option value="5s">5 Seconds Clip</option>
                    <option value="10s">10 Seconds Clip</option>
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-[#ceadd4] bg-white">
                <button 
                  onClick={startVideoGeneration} 
                  disabled={videoState.isGenerating} 
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 ${
                    videoState.isGenerating 
                      ? 'bg-white text-[#3a3a3a] cursor-not-allowed' 
                      : 'bg-[#91569c] hover:bg-[#91569c]/90 text-black'
                  }`}
                >
                  {videoState.isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fa-solid fa-gear fa-spin"></i> PROCESSING
                    </span>
                  ) : videoProvider === 'kling' ? 'GENERATE KLING CLIP' : 'GENERATE VEO CLIP'}
                </button>
              </div>
            </aside>
            <main className="flex-1 bg-[#edecec] p-6 flex flex-col items-center justify-center relative">
               {!videoState.resultUrl && !videoState.isGenerating && (
                 <div className="text-center space-y-6 opacity-20">
                    <i className="fa-solid fa-clapperboard text-[120px] text-[#888]"></i>
                    <p className="font-black uppercase tracking-[0.3em] text-[#888]">Video Studio Idle</p>
                 </div>
               )}

               {videoState.isGenerating && (
                 <div className="w-full max-w-lg text-center space-y-8 animate-pulse">
                    <div className="w-32 h-32 mx-auto relative">
                       <LogoIcon className="w-full h-full text-[#91569c] animate-spin-slow opacity-20" />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <i className="fa-solid fa-gear fa-spin text-3xl text-[#91569c]"></i>
                       </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-lg font-black uppercase tracking-widest text-[#888]">{videoState.progressMessage}</p>
                      <p className="text-[10px] text-[#888] uppercase tracking-[0.4em] font-bold">This typically takes 2-4 minutes</p>
                    </div>
                 </div>
               )}

               {videoState.resultUrl && !videoState.isGenerating && (
                 <div className="w-full max-w-4xl animate-fade-in space-y-6">
                    <div className="relative rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[#ceadd4] bg-black">
                       <video 
                         src={videoState.resultUrl} 
                         controls 
                         autoPlay 
                         loop 
                         className="w-full aspect-video" 
                       />
                       <div className="absolute top-6 right-6 flex gap-2">
                         <a 
                           href={videoState.resultUrl} 
                           download="tensorax-veo.mp4"
                           className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-[#5c3a62] hover:bg-white/20 transition-all shadow-xl"
                         >
                           <i className="fa-solid fa-download"></i>
                         </a>
                       </div>
                    </div>
                    <div className="flex justify-between items-center px-4">
                       <div className="flex gap-4 items-center">
                          <div className="w-10 h-10 bg-white border border-[#ceadd4] rounded-xl flex items-center justify-center">
                             <LogoIcon className="w-5 h-5 text-[#888]" />
                          </div>
                          <div>
                            <h3 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Veo Cinematic Generation</h3>
                            <p className="text-[10px] text-[#888] uppercase font-bold">Processed at 720p • Motion Consistent</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setVideoState(v => ({ ...v, resultUrl: undefined }))}
                         className="text-[10px] font-black text-[#888] uppercase hover:text-red-500 transition-colors"
                       >
                         Discard Session
                       </button>
                    </div>
                 </div>
               )}
            </main>
          </>
        )}
        <aside className={`flex-shrink-0 mt-0 mb-2 mx-2 ${currentScreen === 'scenes' ? 'w-[18%] min-w-[240px] max-w-[320px] block' : 'hidden 2xl:block w-80'}`}>
          <ChatBotBoundary><ChatBot /></ChatBotBoundary>
        </aside>
      </div>

      {apiKeyModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeApiKeyModal}>
          <div className="bg-[#edecec] border border-[#ceadd4] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide mb-3">
              {apiKeyModalType.charAt(0).toUpperCase() + apiKeyModalType.slice(1)} API Key
            </h3>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">Model</label>
              <input
                type="text"
                value={apiKeyModalModel}
                onChange={(e) => setApiKeyModalModel(e.target.value)}
                placeholder="e.g. claude-opus-4-6, claude-sonnet-4-6, gemini-2.0-flash"
                className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] placeholder:text-[#3a3a3a]/70 focus:ring-1 focus:ring-[#91569c]/50 outline-none"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">API Key</label>
              <p className="text-[9px] text-[#3a3a3a]/70 mb-1">Claude → Anthropic key. Gemini → Google AI key. Auto Generate: set model in Copy (or Analysis) so the same model sees your ref images.</p>
              <input
                type="password"
                value={apiKeyModalValue}
                onChange={(e) => setApiKeyModalValue(e.target.value)}
                placeholder="Enter your API key..."
                className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] placeholder:text-[#3a3a3a]/70 focus:ring-1 focus:ring-[#91569c]/50 outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={closeApiKeyModal} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-[#5c3a62] border border-[#ceadd4] hover:bg-[#6b5873] transition-colors">
                Cancel
              </button>
              <button onClick={saveApiKeyFromModal} disabled={!apiKeyModalValue.trim()} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
