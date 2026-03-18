import React, { useState, useRef } from 'react';
import DropZone from './DropZone';

export type PipelineStepId = 'screenplay' | 'characters' | 'scenes' | 'video';
export type StepChoice = 'pending' | 'upload' | 'create' | 'skip';

export interface PipelineStepState {
  choice: StepChoice;
  files: File[];
}

export interface PipelineResult {
  projectName: string;
  screenplay: PipelineStepState;
  referenceDoc: PipelineStepState;
  characters: PipelineStepState;
  scenes: PipelineStepState;
}

interface PipelineWizardProps {
  projectName: string;
  initialStep?: number;
  onComplete: (result: PipelineResult) => void;
  onCancel: () => void;
  onNavigateToCreate: (step: PipelineStepId, sourceDocContent?: Record<string, string>) => void;
}

const STEPS: { id: PipelineStepId; label: string; icon: string; question: string; uploadLabel: string; createLabel: string; skipLabel?: string; acceptTypes: string }[] = [
  {
    id: 'screenplay',
    label: 'Screenplay',
    icon: 'fa-file-lines',
    question: 'Do you have a screenplay?',
    uploadLabel: 'Yes, I have a screenplay',
    createLabel: 'No, I want to create one',
    acceptTypes: '.docx,.doc,.md,.txt,.pdf',
  },
  {
    id: 'characters',
    label: 'Characters',
    icon: 'fa-users',
    question: 'Do you have character images?',
    uploadLabel: 'Yes, I have character images',
    createLabel: 'No, I want to create them',
    skipLabel: "I don't need characters",
    acceptTypes: 'image/*',
  },
  {
    id: 'scenes',
    label: 'Scenes',
    icon: 'fa-clapperboard',
    question: 'Do you have scene images?',
    uploadLabel: 'Yes, I have scene images',
    createLabel: 'No, I want to create them',
    acceptTypes: 'image/*',
  },
  {
    id: 'video',
    label: 'Video',
    icon: 'fa-video',
    question: '',
    uploadLabel: '',
    createLabel: '',
    acceptTypes: '',
  },
];

export const PipelineWizard: React.FC<PipelineWizardProps> = ({ projectName, initialStep = 0, onComplete, onCancel, onNavigateToCreate }) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [stepStates, setStepStates] = useState<Record<string, PipelineStepState>>({
    screenplay: { choice: 'pending', files: [] },
    characters: { choice: 'pending', files: [] },
    scenes: { choice: 'pending', files: [] },
  });
  const [showReferenceUpload, setShowReferenceUpload] = useState(false);
  const [referenceDoc, setReferenceDoc] = useState<PipelineStepState>({ choice: 'pending', files: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  const step = STEPS[currentStep];
  const stepIdx = currentStep;

  const updateStep = (stepId: string, update: Partial<PipelineStepState>) => {
    setStepStates(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...update },
    }));
  };

  const handleChooseUpload = () => {
    updateStep(step.id, { choice: 'upload' });
  };

  const handleChooseCreate = () => {
    updateStep(step.id, { choice: 'create' });
    if (step.id === 'screenplay') {
      setShowReferenceUpload(true);
    } else {
      onNavigateToCreate(step.id);
    }
  };

  const handleSkip = () => {
    updateStep(step.id, { choice: 'skip' });
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      updateStep(step.id, {
        files: [...stepStates[step.id].files, ...newFiles],
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    updateStep(step.id, {
      files: stepStates[step.id].files.filter((_, i) => i !== index),
    });
  };

  const handleUploadConfirm = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (stepStates[step.id]?.choice === 'upload') {
      // Go back to the choice view for this step
      updateStep(step.id, { choice: 'pending', files: [] });
    } else if (currentStep > 0) {
      // Reset current step and go back
      updateStep(step.id, { choice: 'pending', files: [] });
      setCurrentStep(currentStep - 1);
      // Also reset previous step to pending so user can re-choose
      const prevStep = STEPS[currentStep - 1];
      updateStep(prevStep.id, { choice: 'pending', files: [] });
    } else {
      onCancel();
    }
  };

  // Final step — video: just proceed
  const handleFinish = () => {
    onComplete({
      projectName,
      screenplay: stepStates.screenplay,
      referenceDoc,
      characters: stepStates.characters,
      scenes: stepStates.scenes,
    });
  };

  // Reference document sub-step (shown after user chooses to create a screenplay)
  if (showReferenceUpload) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
        <div className="w-full max-w-lg animate-fade-in">
          <StepProgress steps={STEPS} currentIdx={0} />

          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-[#f6f0f8] flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-file-import text-2xl text-[#91569c]"></i>
              </div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">Do you have a source document?</h3>
              <p className="text-xs text-[#888] mt-1">Upload a brief, article, or any document you'd like the screenplay to be based on</p>
            </div>

            {/* Uploaded files */}
            {referenceDoc.files.length > 0 && (
              <div className="space-y-2">
                {referenceDoc.files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-[#f6f0f8] rounded-lg border border-[#e0d6e3]">
                    <i className="fa-solid fa-file-lines text-[#91569c] text-sm"></i>
                    <span className="text-xs text-[#5c3a62] font-bold flex-1 truncate">{f.name}</span>
                    <span className="text-[9px] text-[#888]">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setReferenceDoc(prev => ({ ...prev, files: prev.files.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600 text-xs transition-colors">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {/* Upload option */}
              <input
                ref={refFileInputRef}
                type="file"
                className="hidden"
                accept=".docx,.doc,.md,.txt,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const newFiles = Array.from(e.target.files);
                    setReferenceDoc(prev => ({ choice: 'upload', files: [...prev.files, ...newFiles] }));
                  }
                  if (refFileInputRef.current) refFileInputRef.current.value = '';
                }}
              />
              <DropZone
                accept=".docx,.doc,.md,.txt,.pdf"
                multiple
                onFiles={(files) => {
                  setReferenceDoc(prev => ({ choice: 'upload', files: [...prev.files, ...files] }));
                }}
              >
                <button
                  onClick={() => refFileInputRef.current?.click()}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/50 hover:bg-[#f6f0f8] transition-all shadow-sm text-left group"
                >
                  <div className="w-11 h-11 rounded-lg bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
                    <i className="fa-solid fa-upload text-lg text-[#91569c]"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide">
                      {referenceDoc.files.length > 0 ? 'Drop or upload another document' : 'Drop or upload a document'}
                    </span>
                    <p className="text-[10px] text-[#888] mt-0.5">Brief, article, creative direction, or other source material</p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[#ceadd4] group-hover:text-[#91569c] transition-colors"></i>
                </button>
              </DropZone>
            </div>

            <div className="flex justify-between">
              <button onClick={() => { setShowReferenceUpload(false); updateStep('screenplay', { choice: 'pending', files: [] }); }} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
              </button>
              <button
                onClick={async () => {
                  let extractedContents: Record<string, string> | undefined;
                  // Extract text content from uploaded reference docs
                  if (referenceDoc.files.length > 0) {
                    extractedContents = {};
                    for (const file of referenceDoc.files) {
                      try {
                        if (file.name.endsWith('.docx')) {
                          const mammoth = await import('mammoth');
                          const arrayBuffer = await file.arrayBuffer();
                          const result = await mammoth.extractRawText({ arrayBuffer });
                          extractedContents[file.name] = result.value;
                        } else if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
                          extractedContents[file.name] = await file.text();
                        } else if (file.name.endsWith('.doc')) {
                          extractedContents[file.name] = await file.text();
                        }
                      } catch (err) {
                        console.warn(`[PipelineWizard] Failed to extract text from ${file.name}:`, err);
                      }
                    }
                  } else {
                    setReferenceDoc({ choice: 'skip', files: [] });
                  }
                  setShowReferenceUpload(false);
                  onNavigateToCreate('screenplay', extractedContents);
                }}
                className="px-6 py-2.5 rounded-lg text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors"
              >
                {referenceDoc.files.length > 0 ? 'Continue' : 'No, start from scratch'} <i className="fa-solid fa-arrow-right ml-1.5"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Video step — summary + proceed
  if (step.id === 'video') {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
        <div className="w-full max-w-lg animate-fade-in">
          {/* Progress */}
          <StepProgress steps={STEPS} currentIdx={stepIdx} />

          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">Ready to Generate Video</h3>
              <p className="text-xs text-[#888] mt-1">Here's a summary of your pipeline</p>
            </div>

            <div className="space-y-2">
              {STEPS.slice(0, 3).map(s => {
                const state = stepStates[s.id];
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-[#f6f0f8] rounded-lg border border-[#e0d6e3]">
                    <i className={`fa-solid ${s.icon} text-[#91569c]`}></i>
                    <span className="font-bold text-xs text-[#5c3a62] uppercase tracking-wide flex-1">{s.label}</span>
                    {state.choice === 'upload' ? (
                      <span className="text-[10px] text-[#91569c] font-bold uppercase">
                        <i className="fa-solid fa-upload mr-1"></i>
                        {state.files.length} file{state.files.length !== 1 ? 's' : ''} uploaded
                      </span>
                    ) : state.choice === 'skip' ? (
                      <span className="text-[10px] text-[#ceadd4] font-bold uppercase">
                        <i className="fa-solid fa-forward mr-1"></i>
                        Skipped
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#888] font-bold uppercase">
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                        Will be created
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <button onClick={handleBack} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
              </button>
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-lg text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors"
              >
                <i className="fa-solid fa-rocket mr-1.5"></i> Start Project
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentState = stepStates[step.id];

  // Upload view — user chose to upload files
  if (currentState.choice === 'upload') {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
        <div className="w-full max-w-lg animate-fade-in">
          <StepProgress steps={STEPS} currentIdx={stepIdx} />

          <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">Upload {step.label}</h3>
              <p className="text-xs text-[#888] mt-1">Add your {step.label.toLowerCase()} files below</p>
            </div>

            {/* File list */}
            {currentState.files.length > 0 && (
              <div className="space-y-2">
                {currentState.files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-[#f6f0f8] rounded-lg border border-[#e0d6e3]">
                    <i className={`fa-solid ${step.id === 'screenplay' ? 'fa-file-lines' : 'fa-image'} text-[#91569c] text-sm`}></i>
                    <span className="text-xs text-[#5c3a62] font-bold flex-1 truncate">{f.name}</span>
                    <span className="text-[9px] text-[#888]">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => handleRemoveFile(i)} className="text-red-400 hover:text-red-600 text-xs transition-colors">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={step.acceptTypes}
              multiple={step.id !== 'screenplay'}
              onChange={handleFileChange}
            />
            <DropZone
              accept={step.acceptTypes}
              multiple={step.id !== 'screenplay'}
              onFiles={(files) => {
                updateStep(step.id, { files: [...stepStates[step.id].files, ...files] });
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 rounded-xl border-2 border-dashed border-[#ceadd4] hover:border-[#91569c] bg-white/50 hover:bg-[#f6f0f8] text-[#888] hover:text-[#91569c] transition-all flex items-center justify-center gap-3 group"
              >
                <i className="fa-solid fa-cloud-arrow-up group-hover:scale-110 transition-transform"></i>
                <span className="font-bold uppercase tracking-wider text-xs">
                  {currentState.files.length > 0 ? 'Drop files or click to add more' : 'Drop files or click to choose'}
                </span>
              </button>
            </DropZone>

            <div className="flex justify-between">
              <button onClick={handleBack} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
                <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
              </button>
              <button
                onClick={handleUploadConfirm}
                disabled={currentState.files.length === 0}
                className="px-6 py-2.5 rounded-lg text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <i className="fa-solid fa-arrow-right ml-1.5"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Choice view — ask "do you have X?"
  return (
    <div className="flex-1 flex items-center justify-center bg-[#edecec] p-6">
      <div className="w-full max-w-lg animate-fade-in">
        <StepProgress steps={STEPS} currentIdx={stepIdx} />

        <div className="bg-white border border-[#e0d6e3] rounded-xl p-6 shadow-sm space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-[#f6f0f8] flex items-center justify-center mx-auto mb-4">
              <i className={`fa-solid ${step.icon} text-2xl text-[#91569c]`}></i>
            </div>
            <h3 className="text-lg font-bold text-[#5c3a62] uppercase tracking-wide">{step.question}</h3>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleChooseUpload}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/50 hover:bg-[#f6f0f8] transition-all shadow-sm text-left group"
            >
              <div className="w-11 h-11 rounded-lg bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
                <i className="fa-solid fa-upload text-lg text-[#91569c]"></i>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide">{step.uploadLabel}</span>
                <p className="text-[10px] text-[#888] mt-0.5">Upload your existing files</p>
              </div>
              <i className="fa-solid fa-chevron-right text-[#ceadd4] group-hover:text-[#91569c] transition-colors"></i>
            </button>

            <button
              onClick={handleChooseCreate}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/50 hover:bg-[#f6f0f8] transition-all shadow-sm text-left group"
            >
              <div className="w-11 h-11 rounded-lg bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
                <i className="fa-solid fa-wand-magic-sparkles text-lg text-[#91569c]"></i>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide">{step.createLabel}</span>
                <p className="text-[10px] text-[#888] mt-0.5">We'll help you create it step by step</p>
              </div>
              <i className="fa-solid fa-chevron-right text-[#ceadd4] group-hover:text-[#91569c] transition-colors"></i>
            </button>

            {step.skipLabel && (
              <button
                onClick={handleSkip}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-[#e0d6e3] bg-white hover:border-[#ceadd4] hover:bg-[#f9f7fa] transition-all shadow-sm text-left group"
              >
                <div className="w-11 h-11 rounded-lg bg-[#f0eded] group-hover:bg-[#e8e4e4] flex items-center justify-center flex-shrink-0 transition-colors">
                  <i className="fa-solid fa-forward text-lg text-[#888]"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-[#888] uppercase tracking-wide">{step.skipLabel}</span>
                  <p className="text-[10px] text-[#ceadd4] mt-0.5">Skip this step</p>
                </div>
                <i className="fa-solid fa-chevron-right text-[#ceadd4] transition-colors"></i>
              </button>
            )}
          </div>

          <div className="flex justify-start">
            <button onClick={handleBack} className="px-4 py-2 text-xs font-bold uppercase text-[#888] hover:text-[#5c3a62] transition-colors">
              <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepProgress: React.FC<{ steps: { id: string; label: string }[]; currentIdx: number }> = ({ steps, currentIdx }) => (
  <div className="flex items-center gap-2 mb-8 justify-center">
    {steps.map((s, i) => (
      <React.Fragment key={s.id}>
        {i > 0 && <div className={`w-8 h-px ${i <= currentIdx ? 'bg-[#91569c]' : 'bg-[#ceadd4]'}`}></div>}
        <div className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
            i < currentIdx ? 'bg-[#91569c] text-white' :
            i === currentIdx ? 'bg-[#91569c] text-white' :
            'bg-[#e0d6e3] text-[#888]'
          }`}>
            {i < currentIdx ? <i className="fa-solid fa-check text-[8px]"></i> : i + 1}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${i <= currentIdx ? 'text-[#5c3a62]' : 'text-[#ceadd4]'}`}>
            {s.label}
          </span>
        </div>
      </React.Fragment>
    ))}
  </div>
);
