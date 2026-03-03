
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

const GRID_SIZE = 3;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

class ChatBotBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#5A5A5A] border border-[#9A9A9A] rounded-xl">
          <i className="fa-solid fa-robot text-3xl text-[#D7D7D7]/30 mb-3"></i>
          <p className="text-[10px] text-[#D7D7D7]/50 uppercase tracking-wider font-bold">Chat unavailable</p>
          <p className="text-[9px] text-[#D7D7D7]/30 mt-1">Set an API key to enable the assistant</p>
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

const LOGO_SOURCES = ['/logo.png', '/assets/logo.png'];
const LogoSvg = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path d="M0 40 L50 10 L100 40 L100 55 L50 25 L0 55 Z" />
    <path d="M0 60 L33 60 L33 90 L0 90 Z" />
    <path d="M40 45 L60 45 L60 85 L50 95 L40 85 Z" />
    <path d="M67 60 L100 60 L100 90 L67 90 Z" />
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
  onCreateProject: (name: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, activeProject, onCreateProject }) => {
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewProject && inputRef.current) inputRef.current.focus();
  }, [showNewProject]);

  const handleCreate = () => {
    const name = projectName.trim();
    if (!name) return;
    onCreateProject(name);
    setProjectName('');
    setShowNewProject(false);
  };

  const pipelineSteps = [
    { id: 'concept', label: 'Copy', icon: 'fa-pen-nib', description: 'Brief, Ideas & Finetuning' },
    { id: 'images', label: 'Images', icon: 'fa-image', description: 'Characters & Key Visuals' },
    { id: 'scenes', label: 'Frames', icon: 'fa-clapperboard', description: 'Frame Composition' },
    { id: 'video', label: 'Video', icon: 'fa-video', description: 'Video Generation' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#5A5A5A] p-6 overflow-y-auto">
      <div className="mb-10 text-center animate-fade-in">
        <div className="w-24 h-24 mx-auto mb-6 text-[#E6C01F]/80">
          <LogoIcon className="w-full h-full" />
        </div>
        <h1 className="text-5xl font-black tracking-[0.4em] uppercase text-white mb-2">
          Tensor<span className="text-[#E6C01F]">ax</span> Studio
        </h1>
        <div className="h-1 w-20 bg-[#E6C01F] mx-auto mb-4"></div>
        <p className="text-[#D7D7D7] uppercase tracking-[0.3em] text-[10px] font-black">Creative Design Suite</p>
      </div>

      {/* Active project banner or create new */}
      <div className="w-full max-w-2xl mb-8">
        {activeProject ? (
          <div className="bg-[#484848] border border-[#E6C01F]/30 rounded-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <div>
                <p className="text-[10px] text-[#D7D7D7]/60 uppercase tracking-wider font-bold">Active Project</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">{activeProject.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('projects')}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-[#5A5A5A] text-[#D7D7D7] border border-[#6A6A6A] hover:bg-[#585858] hover:text-white transition-colors"
              >
                <i className="fa-solid fa-folder-open mr-1.5"></i>All Projects
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {showNewProject ? (
              <div className="flex-1 flex items-center gap-2 bg-[#484848] border border-[#E6C01F]/30 rounded-xl px-4 py-2.5 animate-fade-in">
                <i className="fa-solid fa-folder-plus text-[#E6C01F] text-sm"></i>
                <input
                  ref={inputRef}
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewProject(false); }}
                  placeholder="Enter project name..."
                  className="flex-1 bg-transparent text-white text-sm font-bold placeholder:text-[#D7D7D7]/40 outline-none uppercase tracking-wide"
                />
                <button
                  onClick={handleCreate}
                  disabled={!projectName.trim()}
                  className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase bg-[#E6C01F] text-black hover:bg-[#E6C01F]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="px-2 py-1.5 text-[#D7D7D7]/60 hover:text-white transition-colors"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="flex-1 h-14 rounded-xl border-2 border-dashed border-[#6A6A6A] hover:border-[#E6C01F]/50 bg-[#484848]/50 hover:bg-[#484848] text-[#D7D7D7] hover:text-[#E6C01F] transition-all flex items-center justify-center gap-3 group"
                >
                  <i className="fa-solid fa-plus text-lg group-hover:scale-110 transition-transform"></i>
                  <span className="font-black uppercase tracking-wider text-xs">New Project</span>
                </button>
                <button
                  onClick={() => onNavigate('projects')}
                  className="h-14 px-5 rounded-xl border border-[#6A6A6A] bg-[#484848]/50 hover:bg-[#484848] text-[#D7D7D7] hover:text-white transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-folder-open text-sm"></i>
                  <span className="font-black uppercase tracking-wider text-[10px]">Projects</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pipeline steps */}
      <div className="grid grid-cols-4 gap-4 w-full max-w-2xl">
        {pipelineSteps.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as any)}
            className="group relative h-40 rounded-[1.5rem] border transition-all duration-300 flex flex-col items-center justify-center gap-3 bg-[#B0B0B0] border-gray-600 hover:border-[#E6C01F]/50 hover:bg-[#5a5a5a] shadow-xl"
          >
            <div className="absolute top-3 left-4 text-[10px] font-black text-[#0d0d0d]/30 uppercase">{idx + 1}</div>
            <div className="text-3xl transition-transform duration-300 group-hover:scale-110 text-[#E6C01F]">
              <i className={`fa-solid ${item.icon}`}></i>
            </div>
            <span className="font-black uppercase tracking-[0.2em] text-xs text-[#D7D7D7] group-hover:text-[#E6C01F] transition-colors">
              {item.label}
            </span>
            <span className="text-[8px] text-[#D7D7D7]/60 uppercase tracking-wider font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              {item.description}
            </span>
            {idx < pipelineSteps.length - 1 && (
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-[#6A6A6A] z-10 hidden sm:block">
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </div>
            )}
            <div className="absolute top-3 right-3 w-2 h-2 bg-[#E6C01F] rounded-full animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"></div>
          </button>
        ))}
      </div>

      <div className="mt-16 text-[#D7D7D7] text-[10px] font-black uppercase tracking-widest flex items-center gap-4">
        <span>© 2024 TensorAx Studio</span>
        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
        <span>Version 4.0.0</span>
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
    <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-3">
      <div className="bg-[#B0B0B0] rounded-t-lg py-1">
        <label className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
          <i className={`fa-solid ${icon} text-[#E6C01F]`}></i>
          {title}
        </label>
        {description && (
          <p className="text-[#0d0d0d] text-[11px] leading-relaxed mt-1.5">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative aspect-square">
            <input type="file" id={`upload-${type}-${i}`} className="hidden" accept="image/*" onChange={(e) => onFileUpload(e, type, i)} />
            <label htmlFor={`upload-${type}-${i}`} className="flex flex-col items-center justify-center w-full h-full bg-[#B0B0B0] border-2 border-dashed border-[#6A6A6A] rounded-lg cursor-pointer hover:border-[#E6C01F]/40 transition-all overflow-hidden group">
              {slots[i] ? (
                <img src={slots[i]} className="w-full h-full object-cover" alt="" />
              ) : (
                <i className="fa-solid fa-plus text-[#0d0d0d] text-xl group-hover:text-[#E6C01F]/70 transition-colors"></i>
              )}
            </label>
            {slots[i] && (
              <button
                type="button"
                onClick={() => onRemoveImage(type, i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/90 rounded flex items-center justify-center text-white text-[10px] hover:bg-red-500"
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

  useEffect(() => {
    const saved = localStorage.getItem('tensorax_active_project');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveProject(parsed);
      } catch { /* ignore */ }
    }
  }, []);

  const persistProject = (p: Project | null) => {
    setActiveProject(p);
    if (p) localStorage.setItem('tensorax_active_project', JSON.stringify(p));
    else localStorage.removeItem('tensorax_active_project');
  };

  const handleCreateProject = async (name: string) => {
    try {
      const project = await DB.createProject({ name, status: 'active', brandId: activeBrandId, description: '', characterIds: [], sceneryIds: [], clothingIds: [], conceptIds: [], imageIds: [], videoIds: [], notes: '' });
      persistProject(project);
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
      <div className="flex flex-col h-screen bg-[#5A5A5A]">
        <header className="h-14 bg-[#B0B0B0] border-b border-gray-600 flex items-center justify-between px-6 z-20 shadow-lg">
          <div className="flex items-center gap-3">
            <LogoIcon className="w-5 h-5 text-[#E6C01F]/80" />
            <h1 className="text-lg font-heading font-black tracking-tighter uppercase text-white flex items-center gap-0">
              Tensor<span className="text-[#E6C01F]">ax</span>
            </h1>
          </div>
          <BrandSelector brands={brands} activeBrandId={activeBrandId} onSelectBrand={handleSelectBrand} onAddBrand={handleAddBrand} onDeleteBrand={handleDeleteBrand} />
        </header>
        <ProjectsScreen onSelectProject={handleSelectProject} onBack={() => setCurrentScreen('landing')} />
      </div>
    );
  }

  if (currentScreen === 'landing') {
    return (
      <div className="flex flex-col h-screen bg-[#5A5A5A]">
         <header className="h-14 bg-[#B0B0B0] border-b border-gray-600 flex items-center justify-between px-6 z-20 shadow-lg">
            <div className="flex items-center gap-3">
              <LogoIcon className="w-5 h-5 text-[#E6C01F]/80" />
              <h1 className="text-lg font-heading font-black tracking-tighter uppercase text-white flex items-center gap-0">
                Tensor<span className="text-[#E6C01F]">ax</span>
              </h1>
            </div>
            <BrandSelector brands={brands} activeBrandId={activeBrandId} onSelectBrand={handleSelectBrand} onAddBrand={handleAddBrand} onDeleteBrand={handleDeleteBrand} />
          </header>
          <LandingPage
            onNavigate={(screen) => setCurrentScreen(screen as any)}
            activeProject={activeProject}
            onCreateProject={handleCreateProject}
          />
      </div>
    );
  }

  if (currentScreen === 'concept') {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-[#5A5A5A]">
        <header className="h-12 flex-shrink-0 bg-[#5A5A5A] border-b border-gray-600/60 flex items-center justify-between px-5 z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentScreen('landing')}
              className="text-[#E6C01F]/80 hover:text-[#E6C01F] transition-colors p-1"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <LogoIcon className="w-5 h-5 text-[#E6C01F]/80" />
            <h1 className="text-base font-heading font-black tracking-tight uppercase text-white flex items-center gap-0">
              Tensor<span className="text-[#E6C01F]">ax</span>
              <span className="text-base font-light text-white ml-1.5">Studio</span>
            </h1>
            {activeProject && (
              <span className="ml-3 text-[10px] font-bold uppercase tracking-wider text-[#E6C01F]/70 bg-[#E6C01F]/10 px-2 py-0.5 rounded">
                {activeProject.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BrandSelector brands={brands} activeBrandId={activeBrandId} onSelectBrand={handleSelectBrand} onAddBrand={handleAddBrand} onDeleteBrand={handleDeleteBrand} />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#D7D7D7]/60">Copy</span>
          </div>
        </header>
        <ConceptScreen onBack={() => setCurrentScreen('landing')} onOpenApiKeyModal={openApiKeyModal} brands={brands} activeBrandId={activeBrandId} activeProject={activeProject} />

        {apiKeyModalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeApiKeyModal}>
            <div className="bg-[#5A5A5A] border border-[#8A8A8A] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide mb-3">
                {apiKeyModalType.charAt(0).toUpperCase() + apiKeyModalType.slice(1)} API Key
              </h3>
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1.5">Model</label>
                <input
                  type="text"
                  value={apiKeyModalModel}
                  onChange={(e) => setApiKeyModalModel(e.target.value)}
                  placeholder="e.g. claude-opus-4-6, claude-sonnet-4-6, gemini-2.0-flash"
                  className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] text-[#0d0d0d] placeholder:text-[#0d0d0d]/70 focus:ring-1 focus:ring-[#E6C01F]/50 outline-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1.5">API Key</label>
                <p className="text-[9px] text-[#0d0d0d]/70 mb-1">Claude → Anthropic key. Gemini → Google AI key.</p>
                <input
                  type="password"
                  value={apiKeyModalValue}
                  onChange={(e) => setApiKeyModalValue(e.target.value)}
                  placeholder="Enter your API key..."
                  className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] text-[#0d0d0d] placeholder:text-[#0d0d0d]/70 focus:ring-1 focus:ring-[#E6C01F]/50 outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={closeApiKeyModal} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#B0B0B0] text-white border border-[#8A8A8A] hover:bg-[#9A9A9A] transition-colors">
                  Cancel
                </button>
                <button onClick={saveApiKeyFromModal} disabled={!apiKeyModalValue.trim()} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#5A5A5A] text-white border border-[#6A6A6A] hover:bg-[#585858] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
    <div className="flex flex-col h-screen overflow-hidden bg-[#5A5A5A]">
      <header className="h-12 flex-shrink-0 bg-[#5A5A5A] border-b border-gray-600/60 flex items-center justify-between px-5 z-20">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentScreen('landing')}
            className="text-[#E6C01F]/80 hover:text-[#E6C01F] transition-colors p-1"
          >
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <LogoIcon className="w-5 h-5 text-[#E6C01F]/80" />
          <h1 className="text-base font-heading font-black tracking-tight uppercase text-white flex items-center gap-0">
            Tensor<span className="text-[#E6C01F]">ax</span>
            <span className="text-base font-light text-white ml-1.5">Studio</span>
          </h1>
          {activeProject && (
            <span className="ml-3 text-[10px] font-bold uppercase tracking-wider text-[#E6C01F]/70 bg-[#E6C01F]/10 px-2 py-0.5 rounded">
              {activeProject.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <BrandSelector brands={brands} activeBrandId={activeBrandId} onSelectBrand={handleSelectBrand} onAddBrand={handleAddBrand} onDeleteBrand={handleDeleteBrand} />
          {currentScreen === 'scenes' && images.some(img => img.url) && !isGenerating && (
            <button
              onClick={downloadAllImages}
              disabled={isZipping}
              className="flex items-center gap-2 bg-[#B0B0B0]/60 hover:bg-[#B0B0B0] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[#8A8A8A] transition-all active:scale-95 disabled:opacity-50"
            >
              <i className={`fa-solid ${isZipping ? 'fa-spinner fa-spin' : 'fa-file-zipper'}`}></i>
              {isZipping ? 'Zipping...' : 'Download Zip'}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {currentScreen === 'scenes' ? (
          <>
            <aside className="w-[25%] min-w-[280px] max-w-[360px] h-full min-h-0 max-h-full bg-[#5A5A5A] border border-[#9A9A9A] rounded-xl flex flex-col overflow-hidden flex-shrink-0 mx-2 mt-0 mb-2">
              <div className="p-4 border-b border-[#8A8A8A] flex-shrink-0 flex items-center justify-between">
                <h2 className="text-lg font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-[#E6C01F]"></i>
                  SCENE CONFIGURATION
                </h2>
                <button
                  type="button"
                  onClick={loadTestData}
                  className="text-[9px] font-black uppercase text-[#E6C01F] hover:text-[#E6C01F]/80 border border-[#8A8A8A] hover:border-[#E6C01F]/50 rounded px-2 py-1 transition-colors"
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

                <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
                      <i className="fa-solid fa-film text-[#E6C01F]"></i>
                      PROMPT
                    </label>
                  </div>
                  <textarea
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    rows={3}
                    className="w-full min-h-[4.5rem] resize-y bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#E6C01F]/50 outline-none text-[#0d0d0d] placeholder:text-[#0d0d0d]/70"
                    placeholder="Enter your prompt..."
                  />
                  <button
                    type="button"
                    onClick={autoGeneratePrompts}
                    disabled={isAutoGeneratingPrompts}
                    className="w-full bg-[#5A5A5A] hover:bg-[#585858] text-white font-black uppercase text-[10px] tracking-wider py-2.5 rounded-lg border border-[#6A6A6A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAutoGeneratingPrompts ? (
                      <span><i className="fa-solid fa-spinner fa-spin mr-2"></i>Generating...</span>
                    ) : (
                      'Auto Generate'
                    )}
                  </button>
                </div>

                <div className="bg-[#B0B0B0] border border-gray-600/80 p-4 rounded-xl space-y-3">
                  <label className="block text-sm font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <i className="fa-solid fa-gear text-[#E6C01F]"></i>
                    SETTINGS
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-heading font-bold text-[#0d0d0d] uppercase tracking-wide mb-1">Style</label>
                      <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#E6C01F]/50 outline-none text-[#0d0d0d]"
                      >
                        {Object.entries(GridTheme).map(([key, val]) => (
                          <option key={key} value={val}>{key.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-heading font-bold text-[#0d0d0d] uppercase tracking-wide mb-2">API Keys</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('analysis')}
                          title="Analysis API Key"
                          className="flex-1 py-2 px-2 rounded-lg bg-[#5A5A5A] text-white border border-[#6A6A6A] hover:bg-[#585858] transition-colors flex items-center justify-center"
                        >
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('copy')}
                          title="Copy API Key"
                          className="flex-1 py-2 px-2 rounded-lg bg-[#5A5A5A] text-white border border-[#6A6A6A] hover:bg-[#585858] transition-colors flex items-center justify-center"
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('image')}
                          title="Image API Key (Imagen / Vertex)"
                          className="flex-1 py-2 px-2 rounded-lg bg-[#5A5A5A] text-white border border-[#6A6A6A] hover:bg-[#585858] transition-colors flex items-center justify-center"
                        >
                          <i className="fa-solid fa-image"></i>
                        </button>
                      </div>
                      <p className="mt-1 text-[9px] text-[#0d0d0d]/70">Image button: Imagen (Vertex) API key for generation.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-heading font-bold text-[#0d0d0d] uppercase tracking-wide mb-1">Resolution</label>
                        <select
                          value={imageSize}
                          onChange={(e) => setImageSize(e.target.value as ImageSize)}
                          className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] outline-none text-[#0d0d0d] focus:ring-1 focus:ring-[#E6C01F]/50"
                        >
                          <option value="1K">1K</option>
                          <option value="2K">2K</option>
                          <option value="4K">4K</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-heading font-bold text-[#0d0d0d] uppercase tracking-wide mb-1">Aspect</label>
                        <select
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                          className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] outline-none text-[#0d0d0d] focus:ring-1 focus:ring-[#E6C01F]/50"
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
              <div className="p-4 border-t border-gray-600/60 bg-[#5A5A5A]">
                <p className="text-[10px] text-[#0d0d0d] text-center mb-2">Generate each image in the grid below (one at a time).</p>
              </div>
            </aside>
            <main className="flex-1 flex flex-col min-h-0 bg-[#5A5A5A] pt-0 pb-2 px-2 min-w-0 overflow-hidden">
               <div className="flex-1 min-h-0 flex flex-col overflow-hidden mx-auto max-w-4xl w-full bg-[#5A5A5A] border border-[#9A9A9A] rounded-xl">
                 <div className="flex-shrink-0 p-2 sm:p-4 border-b border-[#8A8A8A]">
                   <h2 className="text-sm sm:text-base md:text-lg font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
                     <i className="fa-solid fa-th-large text-[#E6C01F]"></i>
                     Frames
                   </h2>
                 </div>
                 <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5 sm:p-3">
                 <div className="grid grid-cols-3 gap-1 sm:gap-2">
                 {images.map((img, idx) => (
                   <div key={img.id} className="aspect-[9/16] bg-[#B0B0B0] relative rounded-lg overflow-hidden group flex flex-col border border-[#6A6A6A]">
                     {img.loading ? (
                       <div className="absolute inset-0 flex flex-col items-center justify-center animate-pulse text-[#E6C01F]/30 gap-2 z-10 bg-[#B0B0B0]">
                         <i className="fa-solid fa-spinner fa-spin text-xl sm:text-2xl md:text-3xl text-[#E6C01F]"></i>
                         <span className="text-[9px] sm:text-[10px] md:text-xs uppercase text-[#0d0d0d]">Generating {idx + 1}</span>
                       </div>
                     ) : img.error ? (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500/60 gap-2 p-2 z-10 bg-[#B0B0B0]">
                         <i className="fa-solid fa-triangle-exclamation text-base sm:text-lg md:text-xl"></i>
                         <span className="text-[9px] sm:text-[10px] md:text-[11px] uppercase tracking-wider text-center text-[#0d0d0d]">{img.error}</span>
                         <button
                           type="button"
                           onClick={() => generateSingleImage(idx)}
                           disabled={isGenerating}
                           className="mt-1 text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase text-[#E6C01F] hover:text-[#E6C01F]/80 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 disabled:opacity-50"
                          >
                            Generate again
                         </button>
                       </div>
                     ) : img.url ? (
                       <>
                         <div className="flex-1 min-h-0 relative rounded-lg m-1.5 overflow-hidden bg-[#B0B0B0]">
                           <img src={img.url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="" />
                           {/* Use as video keyframe overlay */}
                           <div className="absolute bottom-0 left-0 right-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-1 p-1">
                             {(['start','mid','end'] as const).map(slot => (
                               <button
                                 key={slot}
                                 type="button"
                                 onClick={() => useImageAsVideoFrame(img.url!, slot)}
                                 className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[#E6C01F] text-[#0d0d0d] hover:bg-white transition-colors"
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
className="w-full min-h-[2rem] sm:min-h-[2.5rem] resize-y bg-[#B0B0B0] border-2 border-dashed border-[#6A6A6A] rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-[9px] sm:text-[10px] md:text-[11px] outline-none text-[#0d0d0d] placeholder:text-[#0d0d0d]/70 hover:border-[#E6C01F]/40 focus:border-[#E6C01F] transition-all"
                             placeholder={`Prompt for shot ${idx + 1}...`}
                           />
                           </div>
                           <button type="button" onClick={() => generateSingleImage(idx)} disabled={isGenerating} className="flex-shrink-0 py-1 sm:py-1.5 px-2 sm:px-3 rounded text-[9px] sm:text-[10px] md:text-sm font-black uppercase text-[#E6C01F] hover:text-[#E6C01F]/80 disabled:opacity-50">Regenerate</button>
                         </div>
                       </>
                     ) : (
                       <>
                         <div className="text-[9px] sm:text-[10px] md:text-xs font-bold text-[#0d0d0d] uppercase flex-shrink-0 px-1.5 sm:px-2 pt-1 sm:pt-1.5 min-h-[2em] sm:min-h-[2.5em] leading-tight w-full">{SHOT_SPECS[idx].label}</div>
                         <div className="flex-1 min-h-0 rounded-lg mx-1 sm:mx-2 flex flex-col p-1.5 sm:p-2 gap-1.5 sm:gap-2 bg-[#B0B0B0] overflow-hidden">
                           <div className="relative flex-1 min-h-0 flex flex-col">
                             <textarea
                               value={shotPrompts[idx] ?? ''}
                               onChange={(e) => setShotPrompts(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                               onKeyDown={(e) => e.stopPropagation()}
                               rows={3}
                               className="w-full min-h-0 flex-1 resize-y bg-[#B0B0B0] border-2 border-dashed border-[#6A6A6A] rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[9px] sm:text-[10px] md:text-[11px] outline-none text-[#0d0d0d] placeholder:text-[#0d0d0d]/70 hover:border-[#E6C01F]/40 focus:border-[#E6C01F] transition-all"
                               placeholder={`Prompt for shot ${idx + 1}...`}
                             />
                           </div>
                           <button
                             type="button"
                             onClick={() => generateSingleImage(idx)}
                             disabled={isGenerating}
className="flex-shrink-0 py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-[10px] sm:text-xs md:text-base font-black uppercase tracking-wider bg-[#5A5A5A] text-white border border-[#6A6A6A] hover:bg-[#585858] hover:border-[#8A8A8A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <aside className="w-80 bg-[#5A5A5A] border-r border-gray-600 flex flex-col overflow-hidden flex-shrink-0">
              <div className="p-4 border-b border-gray-600 bg-[#B0B0B0]/50">
                <h2 className="text-lg font-heading font-bold text-white uppercase tracking-wide">Video Configuration</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Video Provider Toggle */}
                <div className="bg-[#B0B0B0]/80 border border-[#8A8A8A] p-4 rounded-2xl space-y-3">
                  <label className="text-sm font-heading font-bold text-white uppercase tracking-wide">Video Engine</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#8A8A8A]">
                    {(['veo', 'kling'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setVideoProvider(p)}
                        className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
                          videoProvider === p
                            ? 'bg-[#E6C01F] text-[#0d0d0d]'
                            : 'bg-[#5A5A5A] text-white/60 hover:text-white'
                        }`}
                      >
                        {p === 'veo' ? 'Veo 3.1' : 'Kling v2'}
                      </button>
                    ))}
                  </div>
                  {videoProvider === 'kling' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#0d0d0d] uppercase tracking-wide mb-1">fal.ai API Key</label>
                        <input
                          type="password"
                          value={klingApiKey}
                          onChange={(e) => {
                            setKlingApiKey(e.target.value);
                            localStorage.setItem('tensorax_kling_key', e.target.value);
                          }}
                          placeholder="Get key at fal.ai/dashboard/keys"
                          className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2 text-[10px] text-[#0d0d0d] placeholder:text-[#0d0d0d]/60 outline-none focus:ring-1 focus:ring-[#E6C01F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#0d0d0d] uppercase tracking-wide mb-1">Motion Reference Video <span className="font-normal normal-case text-[#0d0d0d]/60">(optional)</span></label>
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
                          <label htmlFor="kling-motion-video" className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer text-[10px] transition-colors ${(videoState as any).motionVideo ? 'border-[#E6C01F] bg-[#E6C01F]/10 text-[#0d0d0d]' : 'border-[#8A8A8A] bg-[#B0B0B0] text-[#0d0d0d]/60 hover:border-[#E6C01F]/50'}`}>
                            <i className={`fa-solid ${(videoState as any).motionVideo ? 'fa-video text-[#E6C01F]' : 'fa-film'}`}></i>
                            {(videoState as any).motionVideo ? 'Motion video set ✓' : 'Upload motion reference video'}
                          </label>
                          {(videoState as any).motionVideo && (
                            <button type="button" onClick={() => setVideoState(v => { const n = { ...v }; delete (n as any).motionVideo; return n; })} className="text-[10px] text-red-500 hover:text-red-400 px-1">✕</button>
                          )}
                        </div>
                        <p className="text-[9px] text-[#0d0d0d]/60 mt-1">When set → Kling motion control mode: your Start frame as character style, video as motion guide.</p>
                      </div>
                    </div>
                  )}
                  {videoProvider === 'veo' && (
                    <p className="text-[9px] text-[#0d0d0d]/60">Veo 3.1 via Gemini API. Supports Start, Mid and End frames.</p>
                  )}
                </div>

                {/* Generation Prompt */}
                <div className="bg-[#B0B0B0]/80 border border-[#8A8A8A] p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-heading font-bold text-white uppercase tracking-wide">Generation Prompt</label>
                    <button 
                      onClick={enhancePrompt}
                      disabled={isEnhancing || !videoState.prompt}
                      title="Enhance Prompt"
                      className={`text-sm transition-all p-1.5 rounded-lg border ${isEnhancing ? 'bg-[#B0B0B0] border-[#8A8A8A] text-[#0d0d0d]' : 'bg-[#B0B0B0] border-[#8A8A8A] text-[#E6C01F]/70 hover:text-[#E6C01F] hover:border-[#E6C01F]/30 active:scale-95'}`}
                    >
                      <i className={`fa-solid ${isEnhancing ? 'fa-wand-magic-sparkles fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                    </button>
                  </div>
                  <textarea 
                    value={videoState.prompt} 
                    onChange={(e) => setVideoState(v => ({ ...v, prompt: e.target.value }))} 
                    placeholder="Describe the cinematic scene..."
                    className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-xl p-3 text-[11px] focus:ring-1 focus:ring-[#E6C01F] outline-none h-24 resize-none text-[#0d0d0d] placeholder:text-[#0d0d0d]/70"
                  />
                </div>

                {/* Key Frame Sequence */}
                <div className="bg-[#B0B0B0]/80 border border-[#8A8A8A] p-4 rounded-2xl space-y-4">
                  <label className="text-sm font-heading font-bold text-white uppercase tracking-wide">Key Frame Sequence</label>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-[#0d0d0d] tracking-wider">Upload key frame images</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'start', label: 'Start' },
                        { id: 'mid', label: 'Mid' },
                        { id: 'end', label: 'End' }
                      ].map(slot => (
                        <div key={slot.id} className="relative aspect-square">
                          <input type="file" id={`upload-${slot.id}`} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, slot.id as any)} />
                          <label htmlFor={`upload-${slot.id}`} className="flex flex-col items-center justify-center w-full h-full bg-[#B0B0B0] border border-[#8A8A8A] border-dashed rounded-lg cursor-pointer hover:border-[#E6C01F]/30 transition-all overflow-hidden group">
                            { (videoState as any)[`${slot.id}Image`] ? (
                              <img src={(videoState as any)[`${slot.id}Image`]} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <i className="fa-solid fa-cloud-arrow-up text-white text-lg group-hover:text-[#E6C01F]/50 transition-colors"></i>
                                <span className="text-xs font-black uppercase text-[#0d0d0d]">{slot.label}</span>
                              </div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Movement Path */}
                <div className="bg-[#B0B0B0]/80 border border-[#8A8A8A] p-4 rounded-2xl space-y-4">
                  <label className="text-sm font-heading font-bold text-white uppercase tracking-wide">Movement Path</label>
                  <textarea 
                    value={videoState.movementDescription} 
                    onChange={(e) => setVideoState(v => ({ ...v, movementDescription: e.target.value }))} 
                    placeholder="Describe specific movements (e.g. camera zooms in)..."
                    className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-xl p-3 text-[11px] focus:ring-1 focus:ring-[#E6C01F] outline-none h-20 resize-none text-[#0d0d0d] placeholder:text-[#0d0d0d]/70" 
                  />
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-[#0d0d0d] tracking-wider">Upload movement video</p>
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
                        className={`flex items-center gap-3 w-full p-3 rounded-xl border border-dashed transition-all cursor-pointer ${videoState.movementVideo ? 'border-[#E6C01F]/50 bg-[#E6C01F]/5' : 'border-[#8A8A8A] bg-[#B0B0B0] hover:border-[#E6C01F]/30'}`}
                      >
                        <i className={`fa-solid ${videoState.movementVideo ? 'fa-video text-[#E6C01F]' : 'fa-film text-white text-lg'}`}></i>
                        <span className={`text-xs font-black uppercase ${videoState.movementVideo ? 'text-[#0d0d0d]' : 'text-[#0d0d0d]'}`}>
                          {videoState.movementVideo ? 'Video Attached' : 'Select Reference Video'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Select Duration */}
                <div className="bg-[#B0B0B0]/80 border border-[#8A8A8A] p-4 rounded-2xl space-y-3">
                  <label className="text-sm font-heading font-bold text-white uppercase tracking-wide">Select Duration</label>
                  <select 
                    value={videoState.duration}
                    onChange={(e) => setVideoState(v => ({ ...v, duration: e.target.value as '5s' | '10s' }))}
                    className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-xl p-3 text-[11px] outline-none text-[#0d0d0d] focus:ring-1 focus:ring-[#E6C01F] appearance-none cursor-pointer"
                  >
                    <option value="5s">5 Seconds Clip</option>
                    <option value="10s">10 Seconds Clip</option>
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-[#8A8A8A] bg-[#B0B0B0]">
                <button 
                  onClick={startVideoGeneration} 
                  disabled={videoState.isGenerating} 
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 ${
                    videoState.isGenerating 
                      ? 'bg-[#B0B0B0] text-[#0d0d0d] cursor-not-allowed' 
                      : 'bg-[#E6C01F] hover:bg-[#E6C01F]/90 text-black'
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
            <main className="flex-1 bg-[#5A5A5A] p-6 flex flex-col items-center justify-center relative">
               {!videoState.resultUrl && !videoState.isGenerating && (
                 <div className="text-center space-y-6 opacity-20">
                    <i className="fa-solid fa-clapperboard text-[120px] text-[#D7D7D7]"></i>
                    <p className="font-black uppercase tracking-[0.3em] text-[#D7D7D7]">Video Studio Idle</p>
                 </div>
               )}

               {videoState.isGenerating && (
                 <div className="w-full max-w-lg text-center space-y-8 animate-pulse">
                    <div className="w-32 h-32 mx-auto relative">
                       <LogoIcon className="w-full h-full text-[#E6C01F] animate-spin-slow opacity-20" />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <i className="fa-solid fa-gear fa-spin text-3xl text-[#E6C01F]"></i>
                       </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-lg font-black uppercase tracking-widest text-[#D7D7D7]">{videoState.progressMessage}</p>
                      <p className="text-[10px] text-[#D7D7D7] uppercase tracking-[0.4em] font-bold">This typically takes 2-4 minutes</p>
                    </div>
                 </div>
               )}

               {videoState.resultUrl && !videoState.isGenerating && (
                 <div className="w-full max-w-4xl animate-fade-in space-y-6">
                    <div className="relative rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[#8A8A8A] bg-black">
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
                           className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-xl"
                         >
                           <i className="fa-solid fa-download"></i>
                         </a>
                       </div>
                    </div>
                    <div className="flex justify-between items-center px-4">
                       <div className="flex gap-4 items-center">
                          <div className="w-10 h-10 bg-[#B0B0B0] border border-[#8A8A8A] rounded-xl flex items-center justify-center">
                             <LogoIcon className="w-5 h-5 text-[#D7D7D7]" />
                          </div>
                          <div>
                            <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide">Veo Cinematic Generation</h3>
                            <p className="text-[10px] text-[#D7D7D7] uppercase font-bold">Processed at 720p • Motion Consistent</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setVideoState(v => ({ ...v, resultUrl: undefined }))}
                         className="text-[10px] font-black text-[#D7D7D7] uppercase hover:text-red-500 transition-colors"
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
          <div className="bg-[#5A5A5A] border border-[#8A8A8A] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-heading font-bold text-white uppercase tracking-wide mb-3">
              {apiKeyModalType.charAt(0).toUpperCase() + apiKeyModalType.slice(1)} API Key
            </h3>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1.5">Model</label>
              <input
                type="text"
                value={apiKeyModalModel}
                onChange={(e) => setApiKeyModalModel(e.target.value)}
                placeholder="e.g. claude-opus-4-6, claude-sonnet-4-6, gemini-2.0-flash"
                className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] text-[#0d0d0d] placeholder:text-[#0d0d0d]/70 focus:ring-1 focus:ring-[#E6C01F]/50 outline-none"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1.5">API Key</label>
              <p className="text-[9px] text-[#0d0d0d]/70 mb-1">Claude → Anthropic key. Gemini → Google AI key. Auto Generate: set model in Copy (or Analysis) so the same model sees your ref images.</p>
              <input
                type="password"
                value={apiKeyModalValue}
                onChange={(e) => setApiKeyModalValue(e.target.value)}
                placeholder="Enter your API key..."
                className="w-full bg-[#B0B0B0] border border-[#8A8A8A] rounded-lg px-3 py-2.5 text-[11px] text-[#0d0d0d] placeholder:text-[#0d0d0d]/70 focus:ring-1 focus:ring-[#E6C01F]/50 outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={closeApiKeyModal} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#B0B0B0] text-white border border-[#8A8A8A] hover:bg-[#9A9A9A] transition-colors">
                Cancel
              </button>
              <button onClick={saveApiKeyFromModal} disabled={!apiKeyModalValue.trim()} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#5A5A5A] text-white border border-[#6A6A6A] hover:bg-[#585858] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
