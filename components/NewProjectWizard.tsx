import React, { useState, useRef, useEffect } from 'react';
import { BrandProfile } from '../types';

export type ProjectScope = string;

export interface NewProjectData {
  name: string;
  brandId: string;
  scope: ProjectScope;
  brief: string;
}

interface NewProjectWizardProps {
  brands: BrandProfile[];
  onComplete: (data: NewProjectData) => void;
  onCancel: () => void;
}

const SCOPE_OPTIONS: { id: string; label: string; icon: string; description: string }[] = [
  { id: 'explainer-video', label: 'Explainer Video', icon: 'fa-video', description: 'Educational or product explanation video' },
  { id: 'video-advert', label: 'Video Advert', icon: 'fa-clapperboard', description: 'Promotional video for TV, web, or social' },
  { id: 'social-video', label: 'Social Media Video', icon: 'fa-mobile-screen', description: 'Short-form video for Instagram, TikTok, etc.' },
  { id: 'image-advert', label: 'Image Advert', icon: 'fa-rectangle-ad', description: 'Static visual ad for print or digital' },
  { id: 'presentation', label: 'Presentation', icon: 'fa-display', description: 'Slide deck or pitch presentation' },
  { id: 'infographic', label: 'Infographic', icon: 'fa-chart-pie', description: 'Data visualisation or informational graphic' },
  { id: 'blog', label: 'Blog / Article', icon: 'fa-newspaper', description: 'Written content with supporting visuals' },
  { id: 'image-portfolio', label: 'Image Portfolio', icon: 'fa-images', description: 'Collection of branded images or lookbook' },
  { id: 'brand-campaign', label: 'Brand Campaign', icon: 'fa-bullhorn', description: 'Multi-format brand campaign' },
  { id: 'other', label: 'Other', icon: 'fa-wand-magic-sparkles', description: 'Something else — describe in the brief' },
];

type WizardStep = 'brief' | 'name' | 'brand' | 'scope';
const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'brief', label: 'Brief' },
  { id: 'name', label: 'Name' },
  { id: 'brand', label: 'Brand' },
  { id: 'scope', label: 'Type' },
];

export const NewProjectWizard: React.FC<NewProjectWizardProps> = ({ brands, onComplete, onCancel }) => {
  const [step, setStep] = useState<WizardStep>('brief');
  const [brief, setBrief] = useState('');
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const [scope, setScope] = useState<ProjectScope | null>(null);
  const scopeRef = useRef<ProjectScope | null>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const selectScope = (s: ProjectScope) => {
    setScope(s);
    scopeRef.current = s;
  };

  useEffect(() => {
    if (step === 'brief' && briefRef.current) briefRef.current.focus();
    if (step === 'name' && nameRef.current) nameRef.current.focus();
  }, [step]);

  const handleFinish = () => {
    const s = scopeRef.current || scope;
    if (!name.trim() || !s) return;
    onComplete({ name: name.trim(), brandId, scope: s, brief: brief.trim() });
  };

  const stepIdx = STEPS.findIndex(s => s.id === step);

  return (
    <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && <div className={`w-8 h-px ${i <= stepIdx ? 'bg-[#91569c]' : 'bg-[#ceadd4]'}`}></div>}
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                  i < stepIdx ? 'bg-[#91569c] text-white' :
                  i === stepIdx ? 'bg-[#91569c] text-white' :
                  'bg-[#e0d6e3] text-[#888]'
                }`}>
                  {i < stepIdx ? <i className="fa-solid fa-check text-[8px]"></i> : i + 1}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${i <= stepIdx ? 'text-[#5c3a62]' : 'text-[#ceadd4]'}`}>
                  {s.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Brief — tell me about the project */}
        {step === 'brief' && (
          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">Tell me about your project</h3>
              <p className="text-xs text-[#888] mt-1">Describe what you want to create — the more detail the better</p>
            </div>
            <textarea
              ref={briefRef}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && !brief.trim()) {
                  e.preventDefault();
                  setBrief('We need a Gift Card promotion video for NEXT. The campaign targets parents of young children, featuring a grandmother character giving a gift card. We want warm, emotional visuals following the NEXT brand guidelines.');
                }
                e.stopPropagation();
              }}
              rows={6}
              placeholder="We need a Gift Card promotion video for NEXT. The campaign targets parents of young children, featuring a grandmother character giving a gift card. We want warm, emotional visuals following the NEXT brand guidelines...  [Tab to use this example]"
              className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-3 text-[12px] text-[#3a3a3a] placeholder:text-[#ceadd4] outline-none focus:ring-2 focus:ring-[#91569c]/30 resize-none leading-relaxed"
            />
            <div className="flex justify-between">
              <button onClick={onCancel} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => setStep('name')}
                disabled={!brief.trim()}
                className="px-6 py-2.5 rounded-lg text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <i className="fa-solid fa-arrow-right ml-1.5"></i>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Name */}
        {step === 'name' && (
          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">Project Name</h3>
              <p className="text-xs text-[#888] mt-1">Give your project a descriptive name</p>
            </div>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && !name.trim()) { e.preventDefault(); setName('NEXT Gift Card Campaign'); }
                if (e.key === 'Enter' && name.trim()) setStep('brand');
              }}
              placeholder="NEXT Gift Card Campaign  [Tab to use]"
              className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-3 text-sm text-[#5c3a62] font-bold placeholder:text-[#ceadd4] outline-none focus:ring-2 focus:ring-[#91569c]/30"
            />
            <div className="flex justify-between">
              <button onClick={() => setStep('brief')} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
              </button>
              <button
                onClick={() => setStep('brand')}
                disabled={!name.trim()}
                className="px-6 py-2.5 rounded-lg text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <i className="fa-solid fa-arrow-right ml-1.5"></i>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Brand */}
        {step === 'brand' && (
          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">Brand Identity</h3>
              <p className="text-xs text-[#888] mt-1">Which brand is this project for?</p>
            </div>
            <div className="space-y-2">
              {brands.map(b => (
                <button
                  key={b.id}
                  onClick={() => setBrandId(b.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                    brandId === b.id
                      ? 'bg-[#f6f0f8] border-[#91569c] shadow-sm'
                      : 'bg-white border-[#e0d6e3] hover:border-[#ceadd4] hover:bg-[#f6f0f8]/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                    brandId === b.id ? 'bg-[#91569c] text-white' : 'bg-[#eadcef] text-[#91569c]'
                  }`}>
                    {b.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-sm text-[#5c3a62]">{b.name}</span>
                    {b.isDefault && <span className="ml-2 text-[9px] text-[#888] uppercase">Default</span>}
                  </div>
                  {brandId === b.id && <i className="fa-solid fa-check text-[#91569c]"></i>}
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep('name')} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
              </button>
              <button
                onClick={() => setStep('scope')}
                className="px-6 py-2.5 rounded-lg text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors"
              >
                Next <i className="fa-solid fa-arrow-right ml-1.5"></i>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Output Type */}
        {step === 'scope' && (
          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">What are you creating?</h3>
              <p className="text-xs text-[#888] mt-1">Select the type of output</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => selectScope(opt.id)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left ${
                    scope === opt.id
                      ? 'bg-[#f6f0f8] border-[#91569c] shadow-sm'
                      : 'bg-white border-[#e0d6e3] hover:border-[#ceadd4] hover:bg-[#f6f0f8]/50'
                  }`}
                >
                  <i className={`fa-solid ${opt.icon} text-lg flex-shrink-0 ${scope === opt.id ? 'text-[#91569c]' : 'text-[#ceadd4]'}`}></i>
                  <div className="min-w-0">
                    <span className={`font-bold text-[11px] uppercase tracking-wide block ${scope === opt.id ? 'text-[#5c3a62]' : 'text-[#888]'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[9px] text-[#888] leading-tight block">{opt.description}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep('brand')} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!scope}
                className="px-6 py-2.5 rounded-lg text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-rocket mr-1.5"></i> Create Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function getScopeRoute(_scope: ProjectScope): 'concept' | 'project-settings' {
  return 'project-settings';
}
