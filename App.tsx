
import React, { useState, useEffect, useRef } from 'react';
import { GeminiService, getApiKeyForType, getModelForType, hasStoredKeyForType } from './services/geminiService';
import { generateImageWithCurrentProvider } from './services/imageProvider';
import { ChatBot } from './components/ChatBot';
import { ConceptScreen } from './components/ConceptScreen';
import { ImagesScreen } from './components/ImagesScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { ProjectSettings } from './components/ProjectSettings';
import { GridImage, ImageSize, AspectRatio, GridTheme, ReferenceInput, VideoState, BrandProfile, VideoMode, PROJECT_TEMPLATES, type TemplateId } from './types';
import { VideoScreen } from './components/VideoScreen';
import { BrandSelector } from './components/BrandSelector';
import { loadBrands, saveBrands, getActiveBrandId, setActiveBrandId } from './services/brandData';
import { DB, type Project } from './services/projectDB';
import { NewProjectWizard, getScopeRoute, type NewProjectData } from './components/NewProjectWizard';
import { PipelineWizard, type PipelineResult } from './components/PipelineWizard';
import { TemplateWizard } from './components/TemplateWizard';
import { KeyframesWizard } from './components/KeyframesWizard';
import { Sidebar } from './components/Sidebar';
import { GlobalSettings } from './components/GlobalSettings';
import { TemplateConfigFacility } from './components/TemplateConfigFacility';
import { TemplateLibrary } from './components/TemplateLibrary';
import { TemplateRunner } from './components/TemplateRunner';
import { StudioLayout } from './components/StudioLayout';
import { AgentCataloguePanel } from './components/AgentCataloguePanel';

const GRID_SIZE = 3;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

/** Compact pipeline nav bar — shown in every inner screen header */
const PIPELINE_STEPS = [
  { id: 'concept', label: 'Copy', icon: 'fa-pen-nib' },
  { id: 'images', label: 'Images', icon: 'fa-image' },
  { id: 'scenes', label: 'Frames', icon: 'fa-clapperboard' },
  { id: 'video', label: 'Video', icon: 'fa-video' },
] as const;

const PipelineNav: React.FC<{ current: string; onNavigate: (screen: string) => void }> = ({ current, onNavigate }) => (
  <div className="flex items-center gap-1">
    {PIPELINE_STEPS.map((step, i) => (
      <React.Fragment key={step.id}>
        {i > 0 && <i className="fa-solid fa-chevron-right text-[7px] text-[#ceadd4] mx-0.5" />}
        <button
          onClick={() => onNavigate(step.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
            current === step.id
              ? 'bg-[#91569c] text-white shadow-sm'
              : 'text-[#888] hover:text-[#5c3a62] hover:bg-[#f6f0f8]'
          }`}
        >
          <i className={`fa-solid ${step.icon} text-[8px]`} />
          {step.label}
        </button>
      </React.Fragment>
    ))}
  </div>
);

const API_MODELS = [
  { group: 'Gemini (Analysis / Copy)', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'] },
  { group: 'Gemini (Image Generation)', models: ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'] },
  { group: 'Claude (Analysis / Copy)', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-3-5'] },
  { group: 'Imagen (Image Generation)', models: ['imagen-4.0-ultra-generate-001', 'imagen-4.0-standard-generate-001', 'imagen-4.0-fast-generate-001', 'imagen-3.0-capability'] },
  { group: 'OpenAI (Image Generation)', models: ['gpt-image-1', 'dall-e-3'] },
  { group: 'Video', models: ['seedance-2.0', 'kling-v2.1', 'veo-3.1-generate-preview', 'veo-2.0-generate-001'] },
];

const hasKeyForSlot = (baseKey: string, modelKey: string): boolean => {
  try {
    const model = localStorage.getItem(modelKey)?.trim();
    if (model && localStorage.getItem(`${baseKey}__${model}`)?.trim()) return true;
    return !!(localStorage.getItem(baseKey)?.trim());
  } catch { return false; }
};

const ApiKeyButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const hasKeys = (() => {
    try {
      return hasKeyForSlot('tensorax_analysis_key', 'tensorax_analysis_model')
          && hasKeyForSlot('tensorax_copy_key', 'tensorax_copy_model')
          && hasKeyForSlot('tensorax_image_key', 'tensorax_image_model');
    } catch { return false; }
  })();

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors border ${
        hasKeys
          ? 'bg-[#f6f0f8] border-[#ceadd4] text-[#91569c] hover:bg-[#eadcef]'
          : 'bg-[#91569c] border-[#91569c] text-white hover:bg-[#5c3a62] animate-pulse'
      }`}
      title="Configure AI models & API keys"
    >
      <i className="fa-solid fa-key text-[8px]"></i>
      {hasKeys ? 'API' : 'Set Keys'}
    </button>
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
  assistantContext?: string;
  onAssistantAction?: (action: import('./components/ChatBot').AssistantAction) => void;
  chatHistoryRef?: React.MutableRefObject<string>;
  brands: BrandProfile[];
  activeBrandId: string;
  onCreateProject: (data: NewProjectData) => void;
  onSelectProject: (p: Project) => void;
  onNewProject: () => void;
  onUpdateProject: (updated: Project) => void;
  onBrandChange?: (brandId: string) => void;
  onStartPipeline: (projectName: string, navigateTo: 'concept' | 'images' | 'scenes', sourceDocContent?: Record<string, string>) => void;
  pipelineActive: boolean;
  pipelineStep: number;
  pipelineName: string;
  onStartTemplate: (templateId: TemplateId) => void;
  activeTemplateId: TemplateId | null;
  /** If set, LandingPage opens directly to this sub-view */
  initialView?: 'home' | 'projects' | 'templates';
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, activeProject, allProjects, brands, activeBrandId, onCreateProject, onSelectProject, onNewProject, onUpdateProject, onBrandChange, assistantContext, onAssistantAction, chatHistoryRef, onStartPipeline, pipelineActive, pipelineStep, pipelineName, onStartTemplate, activeTemplateId, initialView }) => {
  const [dashboardView, setDashboardView] = useState<'home' | 'projects' | 'templates'>(initialView ?? 'home');

  // Sync with initialView prop when it changes
  useEffect(() => {
    setDashboardView(initialView ?? 'home');
  }, [initialView]);
  const [activeSection, setActiveSection] = useState<'none' | 'project'>('project');

  const pipelineSteps = [
    { id: 'concept', label: 'Copy', icon: 'fa-pen-nib', description: 'Brief, Ideas & Finetuning' },
    { id: 'images', label: 'Images', icon: 'fa-image', description: 'Characters & Key Visuals' },
    { id: 'scenes', label: 'Frames', icon: 'fa-clapperboard', description: 'Frame Composition' },
    { id: 'video', label: 'Video', icon: 'fa-video', description: 'Video Generation' },
  ];

  /** Format a date string for display */
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  if (!activeProject) {
    /* ── Projects list view ── */
    if (dashboardView === 'projects') {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
          <div className="w-full max-w-lg space-y-5 animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-[#5c3a62] uppercase tracking-wide">Your Projects</h2>
              <p className="text-sm text-[#888] mt-1">{allProjects.length} project{allProjects.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {allProjects.map(p => {
                const tpl = p.description?.match(/Template:\s*([\w-]+)/i)?.[1] ?? '';
                const tplLabel = tpl ? PROJECT_TEMPLATES.find(t => t.id === tpl)?.name ?? tpl : '';
                const statusColour = p.status === 'completed' ? 'bg-blue-400' : p.status === 'archived' ? 'bg-gray-400' : 'bg-green-400';

                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p)}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/50 hover:bg-[#f6f0f8] transition-all shadow-sm text-left group"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColour} flex-shrink-0`} title={p.status} />
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-sm text-[#5c3a62] group-hover:text-[#91569c] transition-colors block truncate">{p.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[#888]">{formatDate(p.createdAt)}</span>
                        {tplLabel && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-[#91569c] bg-[#f6f0f8] px-2 py-0.5 rounded-full">{tplLabel}</span>
                        )}
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[#ceadd4] group-hover:text-[#91569c] transition-colors"></i>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setDashboardView('home')}
              className="w-full text-center px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
            </button>
          </div>
        </div>
      );
    }

    /* ── Template selection view ── */
    if (dashboardView === 'templates') {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
          <div className="w-full max-w-lg space-y-5 animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-[#5c3a62] uppercase tracking-wide">Choose a Template</h2>
              <p className="text-sm text-[#888] mt-1">Select a template to start your new project</p>
            </div>

            <div className="space-y-3">
              {PROJECT_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => onStartTemplate(t.id)}
                  className="w-full flex items-center gap-4 px-5 py-5 rounded-xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/50 hover:bg-[#f6f0f8] transition-all shadow-sm text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
                    <i className={`fa-solid ${t.icon} text-xl text-[#91569c]`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide group-hover:text-[#91569c] transition-colors">{t.name}</span>
                    <p className="text-[10px] text-[#888] mt-1 leading-relaxed">{t.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.steps.map(s => (
                        <span key={s} className="text-[8px] font-bold uppercase tracking-wide text-[#91569c]/70 bg-[#f6f0f8] px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[#ceadd4] group-hover:text-[#91569c] transition-colors"></i>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDashboardView('home')}
                className="flex-1 text-center px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors"
              >
                <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
              </button>
              <button
                onClick={() => setShowTemplateConfig(true)}
                className="px-4 py-2 rounded-lg border border-[#e0d6e3] text-xs font-bold uppercase text-[#888] hover:text-[#91569c] hover:border-[#91569c]/40 transition-colors"
              >
                <i className="fa-solid fa-gear mr-1.5"></i> Configure Templates
              </button>
            </div>
          </div>
        </div>
      );
    }

    /* ── Home: two-card dashboard ── */
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
        <div className="w-full max-w-lg space-y-6 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-[#5c3a62] uppercase tracking-wide">Welcome</h2>
            <p className="text-sm text-[#888] mt-1">What would you like to do?</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Open Existing Project */}
            <button
              onClick={() => setDashboardView('projects')}
              disabled={allProjects.length === 0}
              className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/50 hover:bg-[#f6f0f8] transition-all shadow-sm group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#e0d6e3]"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center transition-colors group-disabled:group-hover:bg-[#f6f0f8]">
                <i className="fa-solid fa-folder-open text-2xl text-[#91569c]"></i>
              </div>
              <span className="font-black text-sm text-[#5c3a62] uppercase tracking-wide group-hover:text-[#91569c] transition-colors">Open Project</span>
              <span className="text-[10px] text-[#888]">
                {allProjects.length > 0
                  ? `${allProjects.length} project${allProjects.length !== 1 ? 's' : ''}`
                  : 'No projects yet'}
              </span>
            </button>

            {/* Create New Project */}
            <button
              onClick={() => setDashboardView('templates')}
              className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/50 hover:bg-[#f6f0f8] transition-all shadow-sm group"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center transition-colors">
                <i className="fa-solid fa-plus text-2xl text-[#91569c]"></i>
              </div>
              <span className="font-black text-sm text-[#5c3a62] uppercase tracking-wide group-hover:text-[#91569c] transition-colors">New Project</span>
              <span className="text-[10px] text-[#888]">{PROJECT_TEMPLATES.length} template{PROJECT_TEMPLATES.length !== 1 ? 's' : ''} available</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sectionContext = activeSection === 'project' ? `The user is viewing Project Settings for "${activeProject.name}". They can configure source material, character references, brand, aspect ratio, and API keys. Help them set up their project.` : '';
  const combinedContext = [assistantContext, sectionContext].filter(Boolean).join('\n');

  // For template projects, show a dedicated "Continue Template" UI
  const activeTemplate = activeTemplateId ? PROJECT_TEMPLATES.find(t => t.id === activeTemplateId) : null;

  if (activeTemplate) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
        <div className="w-full max-w-lg space-y-6 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#f6f0f8] flex items-center justify-center mx-auto mb-4">
              <i className={`fa-solid ${activeTemplate.icon} text-3xl text-[#91569c]`}></i>
            </div>
            <h2 className="text-xl font-bold text-[#5c3a62] uppercase tracking-wide">{activeProject.name}</h2>
            <p className="text-sm text-[#888] mt-1">Template: {activeTemplate.name}</p>
          </div>

          {/* Template steps overview */}
          <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <i className="fa-solid fa-list-check text-[#91569c]"></i>
              <span className="font-bold text-xs text-[#5c3a62] uppercase tracking-wide">Template Steps</span>
            </div>
            <div className="space-y-2">
              {activeTemplate.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f6f0f8]/50">
                  <span className="w-6 h-6 rounded-full bg-[#91569c]/10 flex items-center justify-center text-[10px] font-bold text-[#91569c]">{i + 1}</span>
                  <span className="text-xs font-medium text-[#5c3a62]">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onNavigate('project-settings')}
              className="flex-1 py-3 rounded-xl border border-[#e0d6e3] bg-white hover:bg-[#f6f0f8] text-[#5c3a62] font-bold text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-sliders text-[10px]"></i>
              Project Settings
            </button>
            <button
              onClick={() => onNavigate('concept')}
              className="flex-[2] py-3 rounded-xl bg-[#91569c] hover:bg-[#7a4685] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <i className={`fa-solid ${activeTemplate.icon} text-sm`}></i>
              Continue Template
            </button>
          </div>

          <button
            onClick={onNewProject}
            className="w-full text-center px-4 py-2 text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors"
          >
            <i className="fa-solid fa-arrow-left mr-1.5"></i> Switch Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-[#edecec] overflow-hidden">
      {/* Left nav */}
      <div className="flex flex-col gap-3 w-56 flex-shrink-0 p-4 overflow-y-auto">
        <button
          onClick={() => setActiveSection('project')}
          className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 shadow-sm text-left ${
            activeSection === 'project'
              ? 'bg-[#f6f0f8] border-[#91569c] ring-1 ring-[#91569c]/30'
              : 'bg-white border-[#e0d6e3] hover:border-[#91569c]/50 hover:bg-[#f6f0f8]'
          }`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
            activeSection === 'project' ? 'bg-[#91569c]' : 'bg-[#f6f0f8] group-hover:bg-[#eadcef]'
          }`}>
            <i className={`fa-solid fa-sliders ${activeSection === 'project' ? 'text-white' : 'text-[#91569c]'}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <span className={`font-bold uppercase tracking-wider text-xs transition-colors ${
              activeSection === 'project' ? 'text-[#91569c]' : 'text-[#5c3a62] group-hover:text-[#91569c]'
            }`}>Project</span>
            <p className="text-[9px] text-[#888] mt-0.5">Settings & Pipeline</p>
          </div>
        </button>

        <div className="h-px bg-[#e0d6e3]"></div>

        {pipelineSteps.map((item) => (
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

      {/* Middle — content area */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {activeSection === 'project' ? (
          <ProjectSettings
            project={activeProject}
            brands={brands}
            activeBrandId={activeBrandId}
            activeTemplateId={activeTemplateId}
            onBack={() => setActiveSection('none')}
            onSwitchProject={onNewProject}
            onUpdateProject={onUpdateProject}
            onNavigate={(screen) => onNavigate(screen as any)}
            onBrandChange={onBrandChange}
          />
        ) : (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center opacity-30">
              <i className="fa-solid fa-wand-magic-sparkles text-4xl text-[#ceadd4] mb-3 block"></i>
              <p className="text-[#888] text-xs font-bold uppercase tracking-wider">Ready to create</p>
              <p className="text-[#ceadd4] text-[10px] mt-1">Pick a step from the left or chat with the assistant</p>
            </div>
          </div>
        )}
      </div>

      {/* Right — Assistant */}
      <div className="w-80 flex-shrink-0 p-4 pl-0">
        <ChatBotBoundary><ChatBot projectContext={combinedContext} onAction={onAssistantAction} chatHistoryRef={chatHistoryRef} /></ChatBotBoundary>
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
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'concept' | 'images' | 'scenes' | 'video' | 'projects' | 'project-settings' | 'settings' | 'template-library' | 'template-runner' | 'studio'>('studio');
  const [activeTemplateId, setActiveTemplateId] = useState<TemplateId | null>(null);
  const [landingInitialView, setLandingInitialView] = useState<'home' | 'projects' | 'templates' | undefined>(undefined);
  const [selectedRunnerTemplateId, setSelectedRunnerTemplateId] = useState<string | null>(null);
  const [runnerInitialContext, setRunnerInitialContext] = useState<string | undefined>(undefined);
  const [showTemplateConfig, setShowTemplateConfig] = useState(false);

  /** Sidebar navigation handler */
  const handleSidebarNav = (screen: string) => {
    if (screen === 'studio') {
      setCurrentScreen('studio');
    } else if (screen === 'projects') {
      setLandingInitialView('projects');
      setCurrentScreen('landing');
    } else if (screen === 'templates') {
      setCurrentScreen('template-library');
    } else if (screen === 'agents') {
      setCurrentScreen('agents' as any);
    } else if (screen === 'assets') {
      // Placeholder — future asset library screen
      setCurrentScreen('landing');
    } else if (screen === 'settings') {
      // Map sidebar "Settings" to project-settings when a project is active
      setLandingInitialView(undefined);
      setCurrentScreen(activeProject ? 'project-settings' : 'landing');
    } else {
      setLandingInitialView(undefined);
      setCurrentScreen(screen as any);
    }
  };

  /** Get the sidebar's active screen based on current state */
  const sidebarActiveScreen = currentScreen === 'settings' ? 'settings'
    : currentScreen === 'project-settings' ? 'settings'
    : currentScreen === 'studio' ? 'studio'
    : (currentScreen as string) === 'agents' ? 'agents'
    : currentScreen === 'scenes' ? 'scenes'
    : currentScreen === 'template-library' || currentScreen === 'template-runner' ? 'templates'
    : currentScreen === 'landing' ? (landingInitialView === 'templates' ? 'templates' : landingInitialView === 'projects' ? 'projects' : 'landing')
    : currentScreen;
  const [conceptIntent, setConceptIntent] = useState<'screenplay' | null>(null);
  const [assistantContext, setAssistantContext] = useState('');
  const conceptActionRef = useRef<((action: import('./components/ChatBot').AssistantAction) => void) | null>(null);
  const chatHistoryRef = useRef('');
  const handleAssistantAction = (action: import('./components/ChatBot').AssistantAction) => {
    conceptActionRef.current?.(action);
  };
  // isEnhancing, isReviewingVideo, videoReview moved to VideoScreen component
  const [limitCooldownRemaining, setLimitCooldownRemaining] = useState(0);
  const [projectScreenplay, setProjectScreenplay] = useState('');

  // ─── Project state ───────────────────────────────────────────────────────
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  // Pipeline wizard state — persists across screen navigations
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0); // index into pipeline wizard steps
  const [pipelineName, setPipelineName] = useState('');

  useEffect(() => {
    // Always start on the project selection screen — don't auto-restore last project
    localStorage.removeItem('tensorax_active_project');
    DB.listProjects().then(setAllProjects).catch(() => {});
  }, []);

  // Load screenplay from project metadata when project changes or navigating to video
  useEffect(() => {
    if (!activeProject) { setProjectScreenplay(''); return; }
    DB.getMetadata(activeProject.id).then(meta => {
      if (meta.screenplay && typeof meta.screenplay === 'string') setProjectScreenplay(meta.screenplay);
      else setProjectScreenplay('');
    }).catch(() => setProjectScreenplay(''));
  }, [activeProject?.id]);

  const persistProject = (p: Project | null) => {
    setActiveProject(p);
    try {
      if (p) {
        // Strip metadata from localStorage — it can be huge (MB of base64 images)
        // Only store essential project fields needed for state restoration
        const { metadata, ...lightweight } = p as Project & { metadata?: unknown };
        localStorage.setItem('tensorax_active_project', JSON.stringify(lightweight));
      } else {
        localStorage.removeItem('tensorax_active_project');
      }
    } catch (e) {
      console.warn('[App] localStorage write failed:', e);
    }
  };

  const handleCreateProject = async (data: NewProjectData | string) => {
    try {
      const isWizard = typeof data !== 'string';
      const name = isWizard ? data.name : data;
      const brandId = isWizard ? (data.brandId || activeBrandId) : activeBrandId;
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
    // Auto-detect template projects and restore activeTemplateId
    // Primary: check description field (legacy/current approach)
    const templateMatch = p.description?.match(/Template:\s*([\w-]+)/i);
    if (templateMatch) {
      const detectedTemplate = templateMatch[1] as TemplateId;
      if (PROJECT_TEMPLATES.find(t => t.id === detectedTemplate)) {
        console.log('[App] Detected template project (from description):', detectedTemplate);
        setActiveTemplateId(detectedTemplate);
        setCurrentScreen('template-wizard');
        return;
      }
    }
    // Fallback: check project metadata for templateId
    if (p.id) {
      DB.getMetadata(p.id).then(meta => {
        if (meta.templateId && typeof meta.templateId === 'string') {
          const metaTemplateId = meta.templateId as TemplateId;
          if (PROJECT_TEMPLATES.find(t => t.id === metaTemplateId)) {
            console.log('[App] Detected template project (from metadata):', metaTemplateId);
            setActiveTemplateId(metaTemplateId);
            setCurrentScreen('template-wizard');
            return;
          }
        }
      }).catch(() => {});
    }
    setActiveTemplateId(null);
    setCurrentScreen('landing');
  };

  const handleStartPipeline = async (projectName: string, navigateTo: 'concept' | 'images' | 'scenes', sourceDocContent?: Record<string, string>) => {
    // Create the project if not already created
    let projectId = activeProject?.id;
    if (!activeProject) {
      try {
        const project = await DB.createProject({ name: projectName, status: 'active', brandId: activeBrandId, description: '', characterIds: [], sceneryIds: [], clothingIds: [], conceptIds: [], imageIds: [], videoIds: [], notes: 'Pipeline: video' });
        persistProject(project);
        setAllProjects(prev => [...prev, project]);
        projectId = project.id;
      } catch (e) {
        console.error('[App] Create project for pipeline failed:', e);
        alert('Failed to create project. Is the backend running?');
        return;
      }
    }
    // Save source document content to project metadata if provided
    if (sourceDocContent && projectId) {
      const sourceFiles = Object.keys(sourceDocContent);
      DB.saveMetadata(projectId, { sourceFiles, sourceContents: sourceDocContent }).catch(e => console.warn('[App] Failed to save source content:', e));
    }
    // Track which pipeline step comes next after this creation screen
    const stepMap: Record<string, number> = { concept: 1, images: 2, scenes: 3 }; // next step after creation
    setPipelineActive(true);
    setPipelineStep(stepMap[navigateTo] ?? 0);
    setPipelineName(projectName);
    setCurrentScreen(navigateTo);
  };

  // Template project creation — prompts for a custom name before creating
  const [pendingTemplateId, setPendingTemplateId] = useState<TemplateId | null>(null);
  const [templateProjectName, setTemplateProjectName] = useState('');

  const handleStartTemplate = (templateId: TemplateId) => {
    setPendingTemplateId(templateId);
    setTemplateProjectName('');
  };

  const confirmTemplateProject = async () => {
    if (!pendingTemplateId || !templateProjectName.trim()) return;
    try {
      const name = templateProjectName.trim();
      let projectId = activeProject?.id;
      if (!activeProject) {
        const project = await DB.createProject({ name, status: 'active', brandId: activeBrandId, description: `Template: ${pendingTemplateId}`, characterIds: [], sceneryIds: [], clothingIds: [], conceptIds: [], imageIds: [], videoIds: [], notes: '' });
        persistProject(project);
        setAllProjects(prev => [...prev, project]);
        projectId = project.id;
      }
      // Also store templateId in project metadata for robust detection on reopen
      if (projectId) {
        DB.saveMetadata(projectId, { templateId: pendingTemplateId }).catch(e => console.warn('[App] Failed to save templateId metadata:', e));
      }
      setActiveTemplateId(pendingTemplateId);
      setPendingTemplateId(null);
      setTemplateProjectName('');
      setCurrentScreen('project-settings');
    } catch (e) {
      console.error('[App] Create project for template failed:', e);
      alert('Failed to create project. Is the backend running?');
    }
  };

  const handlePipelineReturn = () => {
    // Called when user finishes a creation step and returns to landing
    setCurrentScreen('landing');
    // pipelineActive + pipelineStep will cause the LandingPage to show the pipeline wizard at the right step
  };

  const getVideoModel = (): string => {
    try { return localStorage.getItem('tensorax_video_model')?.trim() || 'seedance-2.0'; } catch { return 'seedance-2.0'; }
  };
  const getVideoProvider = (): 'seedance' | 'veo' | 'kling' => {
    const m = getVideoModel();
    if (m.startsWith('seedance')) return 'seedance';
    if (m.startsWith('kling')) return 'kling';
    return 'veo';
  };
  const getVideoApiKey = (): string => {
    const model = getVideoModel();
    try {
      return localStorage.getItem(`tensorax_video_key__${model}`)?.trim()
          || (model.startsWith('kling-') || model.startsWith('seedance') ? localStorage.getItem('tensorax_fal_key')?.trim() : '')
          || localStorage.getItem('tensorax_video_key')?.trim()
          || '';
    } catch { return ''; }
  };

  // Video State
  const [videoState, setVideoState] = useState<VideoState>({
    mode: 'prompt-only' as VideoMode,
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
    if (activeBrandId === id) handleSelectBrand('');
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

      // 1. Reference images (existing behaviour)
      setCharacter(p => ({ ...p, images: [charUrl, p.images[1], p.images[2]] }));
      setClothing(p => ({ ...p, images: [clothingUrl, p.images[1], p.images[2]] }));
      setBackground(p => ({ ...p, images: [sceneryUrl, p.images[1], p.images[2]] }));

      // 2. Pre-fill 9 shot prompts so you can skip prompt generation
      const testPrompts = [
        'ELS – Extreme Long Shot. A stylish woman stands small within a vast sunlit Mediterranean plaza, terracotta buildings stretching into the distance. She wears a tailored navy blazer over a white blouse, slim-fit trousers, block-heel sandals. Warm golden-hour light, deep shadows, cinematic colour grade.',
        'LS – Long Shot. Full-body view of the same woman walking confidently towards camera along a tree-lined boulevard. Navy blazer, white blouse, slim trousers, tan leather bag slung over one shoulder. Dappled sunlight through plane trees, shallow depth of field on background.',
        'MLS – Medium Long Shot. Framed from knees up, the woman pauses at a café terrace, one hand on the back of a wrought-iron chair. Same outfit. Espresso cup on the marble table. Soft bokeh of passing pedestrians behind her.',
        'MS – Medium Shot. Waist up, the woman smiles while examining a colourful display of artisan ceramics at a street market stall. Navy blazer sleeves pushed up slightly. Warm ambient light, shallow focus on her hands and the pottery.',
        'MCU – Medium Close-Up. Chest up, she turns towards camera with a relaxed, knowing smile. Wind catches her hair slightly. The white blouse collar visible above the blazer lapel. Soft rim light from behind, creamy bokeh.',
        'CU – Close-Up. Tight on her face, eyes bright with confidence, lips in a subtle smile. Fine skin texture visible, natural makeup. Warm side-light, one catchlight in each eye, blurred golden tones behind.',
        'ECU – Extreme Close-Up. Macro detail of her hand adjusting a delicate gold bracelet on her wrist. The blazer cuff and white blouse sleeve edge visible. Shallow depth of field, every texture crisp.',
        'Low Angle – Worm\'s Eye. Looking up at the woman from ground level as she strides past, silhouetted against a dramatic blue sky with wispy clouds. The blazer flares slightly with movement. Heroic, imposing composition.',
        'High Angle – Bird\'s Eye. Looking down from above as she sits at a round café table, an espresso and open book in front of her. The navy blazer contrasts with the pale stone floor. Geometric pattern of surrounding tables and chairs.',
      ];
      setShotPrompts(testPrompts);

      // 3. Use the character image as a mock grid image for all 9 slots
      //    so the Frames grid appears fully populated
      setImages(prev => prev.map((img, i) => ({
        ...img,
        url: charUrl,
        loading: false,
        error: undefined,
        promptSuffix: img.promptSuffix,
      })));

      // 4. Pre-load video state with start/end frames and a prompt ready to generate
      setVideoState(v => ({
        ...v,
        startImage: charUrl,
        endImage: sceneryUrl,
        prompt: testPrompts[0],
        mode: 'prompt-images' as VideoMode,
      }));

      // 5. Set scene prompt text
      setScenePrompt('Test scene: A confident woman explores a Mediterranean town, discovering local artisan culture. Golden-hour cinematic lighting throughout.');

      console.log('[TensorAx] Test data loaded — prompts, grid images, and video state all pre-filled.');
    } catch (e) {
      console.error('[TensorAx] Load test data failed', e);
      alert('Could not load test images. Ensure /test-refs/ exists in public.');
    }
  };

  const saveApiKeyFromModal = () => {
    const key = apiKeyModalValue.trim();
    if (key) {
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
      // Check if any Google-provider key is available (for assistant/chat)
      if (GeminiService.hydrateApiKeyFromStorage()) {
        setApiKeySelected(true);
        return;
      }

      // Use the analysis key for the assistant if available (read-only, no cross-write)
      const analysisKey = hasStoredKeyForType('analysis') ? getApiKeyForType('analysis') : null;
      if (analysisKey) {
        GeminiService.setApiKey(analysisKey);
        setApiKeySelected(true);
        return;
      }

      // Fallback to env-defined key
      const envKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
      const isEnvPlaceholder = /placeholder_api_key|your[_-]?api[_-]?key/i.test(envKey);
      if (envKey && !isEnvPlaceholder) {
        GeminiService.setApiKey(envKey);
        setApiKeySelected(true);
        return;
      }

      // Check if at least one slot has a key
      const hasAnyKey = ['tensorax_analysis_key', 'tensorax_copy_key', 'tensorax_image_key', 'tensorax_video_key'].some(k => {
        try { return !!(localStorage.getItem(k)?.trim()); } catch { return false; }
      });
      if (hasAnyKey) {
        setApiKeySelected(true);
        return;
      }

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

  // enhancePrompt moved to VideoScreen component

  const autoGeneratePrompts = async () => {
    if (isAutoGeneratingPrompts) return;

    const analysisKey = getApiKeyForType('analysis');
    const copyKey = getApiKeyForType('copy');
    const copyModel = getModelForType('copy') || null;
    const analysisModel = getModelForType('analysis') || null;
    const isClaude = copyModel?.startsWith('claude') || (!copyModel && analysisModel?.startsWith('claude'));
    const keyToUse = isClaude ? (copyKey || analysisKey) : (analysisKey || copyKey);
    if (!keyToUse) {
      alert("Please set your API keys in Project Settings.");
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
          analysisModel,
          copyModel,
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

  // startVideoGeneration and reviewGeneratedVideo moved to VideoScreen component

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

  // ─── Shared top header ─────────────────────────────────────────────────────
  const TopHeader = (
    <header className="h-14 flex-shrink-0 bg-white border-b border-[#e0d6e3] flex items-center px-6 z-20 shadow-sm">
      <img src="/logo-main.png" alt="TensorAx Studio" className="h-8 cursor-pointer" onClick={() => { persistProject(null); setCurrentScreen('landing'); }} />
      {activeProject && (
        <div className="mx-auto flex items-center gap-3">
          <span className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">{activeProject.name}</span>
          {(() => { const b = brands.find(x => x.id === activeBrandId); return b ? (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#91569c] bg-[#f6f0f8] border border-[#ceadd4] px-2 py-0.5 rounded">{b.name}</span>
          ) : null; })()}
        </div>
      )}
    </header>
  );

  // Template wizard — renders after project is created and user clicks "Launch Template"
  if (activeProject && activeTemplateId && currentScreen !== 'project-settings') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <div className="flex flex-col flex-1 min-w-0">
        {activeTemplateId === 'video-from-keyframes' ? (
          <KeyframesWizard
            templateId={activeTemplateId}
            projectId={activeProject.id}
            onComplete={(result) => {
              console.log('[KeyframesWizard] completed:', result.templateId, result.finalVideoUrl ? 'with video' : 'no video');
              setActiveTemplateId(null);
              setCurrentScreen('landing');
            }}
            onCancel={() => { setActiveTemplateId(null); setCurrentScreen('landing'); }}
          />
        ) : (
          <TemplateWizard
            templateId={activeTemplateId}
            projectId={activeProject.id}
            onComplete={(result) => {
              console.log('[TemplateWizard] completed:', result.templateId, result.videoUrl ? 'with video' : 'no video');
              setActiveTemplateId(null);
              setCurrentScreen('landing');
            }}
            onCancel={() => { setActiveTemplateId(null); setCurrentScreen('landing'); }}
          />
        )}
      </div></div></div>
    );
  }

  if (currentScreen === 'project-settings' && activeProject) {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <div className="flex flex-col flex-1 min-w-0">
        {activeTemplateId && (() => {
          const tpl = PROJECT_TEMPLATES.find(t => t.id === activeTemplateId);
          return (
            <div className="bg-gradient-to-r from-[#f6f0f8] to-[#eadcef] border-b border-[#ceadd4] px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className={`fa-solid ${tpl?.icon || 'fa-shapes'} text-[#91569c]`}></i>
                <div>
                  <span className="font-bold text-xs text-[#5c3a62] uppercase tracking-wide">{tpl?.name || 'Template'}</span>
                  <p className="text-[9px] text-[#888] mt-0.5">Configure your API keys below, then return to the template</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentScreen('landing')}
                className="px-5 py-2 rounded-lg bg-[#91569c] hover:bg-[#7a4685] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2"
              >
                <i className="fa-solid fa-arrow-left text-[10px]"></i>
                Back to Template
              </button>
            </div>
          );
        })()}
        <ProjectSettings
          project={activeProject}
          brands={brands}
          activeBrandId={activeBrandId}
          activeTemplateId={activeTemplateId}
          onBack={() => { setCurrentScreen('landing'); }}
          onSwitchProject={() => { persistProject(null); setActiveTemplateId(null); setCurrentScreen('landing'); }}
          onUpdateProject={(updated) => {
            persistProject(updated);
            setAllProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
          }}
          onNavigate={(screen) => setCurrentScreen(screen as any)}
          onBrandChange={(brandId) => { setActiveBrandIdState(brandId); setActiveBrandId(brandId); }}
        />
      </div></div></div>
    );
  }

  if (currentScreen === 'projects') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <ProjectsScreen onSelectProject={handleSelectProject} onBack={() => setCurrentScreen('landing')} />
        </div>
      </div>
    );
  }

  if (currentScreen === 'studio') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <StudioLayout
            projectContext={null}
            brand={null}
            activeProject={activeProject}
            onAction={() => {}}
            onStartTemplate={(templateId, initialContext) => {
              if (templateId === '9-camera-angle-frames') {
                setCurrentScreen('scenes');
                return;
              }
              setSelectedRunnerTemplateId(templateId);
              setRunnerInitialContext(initialContext);
              setCurrentScreen('template-runner');
            }}
            onNavigate={(screen) => setCurrentScreen(screen as any)}
          />
        </div>
      </div>
    );
  }

  if (currentScreen === 'template-library') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <TemplateLibrary
            onSelectTemplate={(id) => {
              if (id === '9-camera-angle-frames') {
                setCurrentScreen('scenes');
                return;
              }
              setSelectedRunnerTemplateId(id);
              setCurrentScreen('template-runner');
            }}
            onConfigureTemplates={() => {
              setLandingInitialView('templates');
              setCurrentScreen('landing');
            }}
            onBack={() => {
              setCurrentScreen('landing');
              setLandingInitialView(undefined);
            }}
          />
        </div>
      </div>
    );
  }

  if (currentScreen === 'template-runner' && selectedRunnerTemplateId) {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <TemplateRunner
            templateId={selectedRunnerTemplateId}
            projectId={activeProject?.id}
            initialContext={runnerInitialContext}
            onComplete={(results) => {
              console.log('[TemplateRunner] Pipeline completed:', results);
              setSelectedRunnerTemplateId(null);
              setCurrentScreen('template-library');
            }}
            onCancel={() => {
              setSelectedRunnerTemplateId(null);
              setCurrentScreen('template-library');
            }}
          />
        </div>
      </div>
    );
  }

  if (currentScreen === 'landing') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <div className="flex flex-col flex-1 min-w-0">
          <LandingPage
            onNavigate={(screen) => {
              if (screen === 'concept:screenplay') {
                setConceptIntent('screenplay');
                setCurrentScreen('concept');
              } else {
                setConceptIntent(null);
                setCurrentScreen(screen as any);
              }
            }}
            activeProject={activeProject}
            allProjects={allProjects}
            brands={brands}
            activeBrandId={activeBrandId}
            onCreateProject={handleCreateProject}
            onSelectProject={handleSelectProject}
            onNewProject={() => persistProject(null)}
            onUpdateProject={(updated) => {
              persistProject(updated);
              setAllProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            }}
            onBrandChange={(brandId) => { setActiveBrandIdState(brandId); setActiveBrandId(brandId); }}
            assistantContext={assistantContext}
            onAssistantAction={handleAssistantAction}
            chatHistoryRef={chatHistoryRef}
            onStartPipeline={handleStartPipeline}
            pipelineActive={pipelineActive}
            pipelineStep={pipelineStep}
            pipelineName={pipelineName}
            onStartTemplate={handleStartTemplate}
            activeTemplateId={activeTemplateId}
            initialView={landingInitialView}
          />

          {/* Template project name dialog */}
          {pendingTemplateId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setPendingTemplateId(null)}>
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[#f6f0f8] flex items-center justify-center mx-auto mb-3">
                    <i className="fa-solid fa-wand-magic-sparkles text-xl text-[#91569c]"></i>
                  </div>
                  <h3 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide">
                    Name Your Project
                  </h3>
                  <p className="text-[10px] text-[#888] mt-1">
                    Using template: {PROJECT_TEMPLATES.find(t => t.id === pendingTemplateId)?.name}
                  </p>
                </div>
                <input
                  type="text"
                  value={templateProjectName}
                  onChange={(e) => setTemplateProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && templateProjectName.trim()) confirmTemplateProject(); }}
                  placeholder="e.g. Summer Campaign Transformation"
                  autoFocus
                  className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-3 text-sm text-[#3a3a3a] placeholder:text-[#888] outline-none focus:ring-2 focus:ring-[#91569c]/30 mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setPendingTemplateId(null)}
                    className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#eadcef] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmTemplateProject}
                    disabled={!templateProjectName.trim()}
                    className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#91569c] text-white border border-[#91569c] hover:bg-[#5c3a62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Project
                  </button>
                </div>
              </div>
            </div>
          )}
      </div></div></div>
    );
  }

  if ((currentScreen as string) === 'agents') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <div className="flex-1 min-w-0 overflow-y-auto">
            <AgentCataloguePanel
              inline
              onClose={() => handleSidebarNav('studio')}
              onSelectAgent={(agentId) => {
                handleSidebarNav('studio');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'settings') {
    return (
      <div className="flex flex-col h-screen bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <GlobalSettings />
        </div>
      </div>
    );
  }

  if (currentScreen === 'concept') {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <div className="flex flex-col flex-1 min-w-0">
        <header className="h-10 flex-shrink-0 bg-white border-b border-[#e0d6e3] flex items-center px-5 z-20 shadow-sm">
          <div className="mx-auto">
            <PipelineNav current="concept" onNavigate={(s) => setCurrentScreen(s as any)} />
          </div>
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ConceptScreen onBack={() => { if (pipelineActive) handlePipelineReturn(); else setCurrentScreen('landing'); }} onOpenApiKeyModal={openApiKeyModal} brands={brands} activeBrandId={activeBrandId} activeProject={activeProject} onNavigateToImages={() => { if (pipelineActive) handlePipelineReturn(); else setCurrentScreen('images'); }} onContextChange={setAssistantContext} actionRef={conceptActionRef} chatHistoryRef={chatHistoryRef} initialIntent={conceptIntent} onIntentConsumed={() => setConceptIntent(null)} onSendToVideo={(prompt) => { setVideoState(v => ({ ...v, prompt })); setCurrentScreen('video'); }} />
          <div className="w-72 flex-shrink-0 p-3 pl-0">
            <ChatBotBoundary><ChatBot projectContext={assistantContext} onAction={handleAssistantAction} chatHistoryRef={chatHistoryRef} /></ChatBotBoundary>
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
      </div></div></div>
    );
  }

  if (currentScreen === 'images') {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-[#edecec]">
        {TopHeader}
        <div className="flex flex-1 min-h-0">
          <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
          <div className="flex flex-col flex-1 min-w-0">
        <header className="h-10 flex-shrink-0 bg-white border-b border-[#e0d6e3] flex items-center px-5 z-20 shadow-sm">
          <div className="mx-auto">
            <PipelineNav current="images" onNavigate={(s) => setCurrentScreen(s as any)} />
          </div>
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0">
            <ImagesScreen onBack={() => { if (pipelineActive) handlePipelineReturn(); else setCurrentScreen('landing'); }} brands={brands} activeBrandId={activeBrandId} activeProject={activeProject} />
          </div>
          <aside className="w-72 flex-shrink-0 p-2 pl-0">
            <ChatBotBoundary><ChatBot projectContext={assistantContext} onAction={handleAssistantAction} chatHistoryRef={chatHistoryRef} /></ChatBotBoundary>
          </aside>
        </div>
      </div></div></div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#edecec]">
      {TopHeader}
      <div className="flex flex-1 min-h-0">
        <Sidebar currentScreen={sidebarActiveScreen} onNavigate={handleSidebarNav} onTemplates={() => handleSidebarNav('templates')} />
        <div className="flex flex-col flex-1 min-w-0">
      <header className="h-10 flex-shrink-0 bg-white border-b border-[#e0d6e3] flex items-center px-5 z-20 shadow-sm">
        <div className="mx-auto">
          <PipelineNav current={currentScreen} onNavigate={(s) => setCurrentScreen(s as any)} />
        </div>
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
                  className="text-[9px] font-black uppercase text-[#91569c] hover:text-white hover:bg-[#91569c] border border-[#ceadd4] hover:border-[#91569c] rounded px-2.5 py-1 transition-colors flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-flask text-[8px]"></i>
                  Load test set
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
                      <label className="block text-[11px] font-heading font-bold text-[#3a3a3a] uppercase tracking-wide mb-1">Image Provider</label>
                      <select
                        value={(() => { try { return localStorage.getItem('tensorax_image_provider') || 'gemini'; } catch { return 'gemini'; } })()}
                        onChange={(e) => { localStorage.setItem('tensorax_image_provider', e.target.value); }}
                        className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#91569c]/50 outline-none text-[#3a3a3a]"
                      >
                        <option value="gemini">Gemini (Imagen)</option>
                        <option value="openai">OpenAI (DALL-E / GPT Image)</option>
                        <option value="fal-edit">fal.ai (Flux Kontext)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-heading font-bold text-[#3a3a3a] uppercase tracking-wide mb-2">API Keys</label>
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('analysis')}
                          className="w-full py-2 px-3 rounded-lg bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] hover:text-white transition-colors flex items-center gap-2 text-[10px] font-bold uppercase"
                        >
                          <i className="fa-solid fa-eye w-4"></i> Analysis Key
                        </button>
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('copy')}
                          className="w-full py-2 px-3 rounded-lg bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] hover:text-white transition-colors flex items-center gap-2 text-[10px] font-bold uppercase"
                        >
                          <i className="fa-solid fa-pen w-4"></i> Copy / Prompt Key
                        </button>
                        <button
                          type="button"
                          onClick={() => openApiKeyModal('image')}
                          className="w-full py-2 px-3 rounded-lg bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] hover:text-white transition-colors flex items-center gap-2 text-[10px] font-bold uppercase"
                        >
                          <i className="fa-solid fa-image w-4"></i> Image Generation Key
                        </button>
                      </div>
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
          <VideoScreen
            videoState={videoState}
            setVideoState={setVideoState}
            screenplay={projectScreenplay}
            getVideoModel={getVideoModel}
            getVideoProvider={getVideoProvider}
            getVideoApiKey={getVideoApiKey}
            aspectRatio={aspectRatio}
            projectId={activeProject?.id}
            onNavigateSettings={() => setCurrentScreen('project-settings')}
          />
        )}
        <aside className={`flex-shrink-0 mt-0 mb-2 mx-2 ${currentScreen === 'scenes' ? 'w-[18%] min-w-[240px] max-w-[320px] block' : 'hidden 2xl:block w-80'}`}>
          <ChatBotBoundary><ChatBot projectContext={assistantContext} onAction={handleAssistantAction} chatHistoryRef={chatHistoryRef} /></ChatBotBoundary>
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

      {/* Template Configuration Facility overlay */}
      {showTemplateConfig && (
        <TemplateConfigFacility
          onClose={() => setShowTemplateConfig(false)}
          onUseTemplate={(id) => {
            setShowTemplateConfig(false);
            // TODO: wire to template launch when template configs drive wizards
          }}
        />
      )}

      <style>{`
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div></div></div>
  );
};

export default App;
