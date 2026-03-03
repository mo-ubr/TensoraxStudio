import React, { useState, useRef, useEffect } from 'react';
import { BrandProfile } from '../types';

export type ProjectScope = 'copy' | 'images' | 'video' | 'full';

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

const SCOPE_OPTIONS: { id: ProjectScope; label: string; icon: string; description: string; route: string }[] = [
  { id: 'copy', label: 'Copy & Screenplay', icon: 'fa-pen-nib', description: 'Write concepts, ideas, and screenplays', route: 'concept' },
  { id: 'images', label: 'Images & Characters', icon: 'fa-image', description: 'Create characters, key visuals, backgrounds', route: 'images' },
  { id: 'video', label: 'Full Video Production', icon: 'fa-video', description: 'End-to-end: copy, images, frames, and video', route: 'concept' },
  { id: 'full', label: 'Custom / Other', icon: 'fa-wand-magic-sparkles', description: 'Describe what you need and I\'ll guide you', route: 'concept' },
];

type WizardStep = 'name' | 'brand' | 'scope';

export const NewProjectWizard: React.FC<NewProjectWizardProps> = ({ brands, onComplete, onCancel }) => {
  const [step, setStep] = useState<WizardStep>('name');
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const [scope, setScope] = useState<ProjectScope | null>(null);
  const [brief, setBrief] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === 'name' && nameRef.current) nameRef.current.focus();
    if (step === 'scope' && briefRef.current) setTimeout(() => briefRef.current?.focus(), 100);
  }, [step]);

  const handleFinish = () => {
    if (!name.trim() || !scope) return;
    onComplete({ name: name.trim(), brandId, scope, brief: brief.trim() });
  };

  const stepNum = step === 'name' ? 1 : step === 'brand' ? 2 : 3;

  return (
    <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {['Name', 'Brand', 'Scope'].map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className={`w-8 h-px ${i < stepNum ? 'bg-[#91569c]' : 'bg-[#ceadd4]'}`}></div>}
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                  i + 1 < stepNum ? 'bg-[#91569c] text-white' :
                  i + 1 === stepNum ? 'bg-[#91569c] text-white' :
                  'bg-[#e0d6e3] text-[#888]'
                }`}>
                  {i + 1 < stepNum ? <i className="fa-solid fa-check text-[8px]"></i> : i + 1}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${i + 1 <= stepNum ? 'text-[#5c3a62]' : 'text-[#ceadd4]'}`}>
                  {label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Name */}
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
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep('brand'); }}
              placeholder="e.g. NEXT Gift Card Campaign"
              className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-3 text-sm text-[#5c3a62] font-bold placeholder:text-[#ceadd4] outline-none focus:ring-2 focus:ring-[#91569c]/30"
            />
            <div className="flex justify-between">
              <button onClick={onCancel} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                Cancel
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

        {/* Step 2: Brand */}
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

        {/* Step 3: Scope & Brief */}
        {step === 'scope' && (
          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">What do you want to create?</h3>
              <p className="text-xs text-[#888] mt-1">Select the type and describe your project</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setScope(opt.id)}
                  className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all text-center ${
                    scope === opt.id
                      ? 'bg-[#f6f0f8] border-[#91569c] shadow-sm'
                      : 'bg-white border-[#e0d6e3] hover:border-[#ceadd4] hover:bg-[#f6f0f8]/50'
                  }`}
                >
                  <i className={`fa-solid ${opt.icon} text-xl ${scope === opt.id ? 'text-[#91569c]' : 'text-[#ceadd4]'}`}></i>
                  <span className={`font-bold text-[11px] uppercase tracking-wide ${scope === opt.id ? 'text-[#5c3a62]' : 'text-[#888]'}`}>
                    {opt.label}
                  </span>
                  <span className="text-[9px] text-[#888] leading-tight">{opt.description}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wider block mb-1.5">
                Tell me about the project
              </label>
              <textarea
                ref={briefRef}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                rows={4}
                placeholder="e.g. We need a Gift Card promotion video for NEXT. The campaign targets parents of young children, featuring a grandmother character giving a gift card. We want warm, emotional visuals with the NEXT brand guidelines..."
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-3 text-[12px] text-[#3a3a3a] placeholder:text-[#ceadd4] outline-none focus:ring-2 focus:ring-[#91569c]/30 resize-none leading-relaxed"
              />
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

export function getScopeRoute(scope: ProjectScope): 'concept' | 'images' | 'scenes' | 'video' {
  switch (scope) {
    case 'copy': return 'concept';
    case 'images': return 'images';
    case 'video': return 'concept';
    case 'full': return 'concept';
  }
}
