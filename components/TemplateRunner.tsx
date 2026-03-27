import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { TemplateConfig, TemplateStep } from '../templates/templateConfig';
import {
  getTemplate,
  getTeamMeta,
  getAgentMeta,
} from '../services/templateService';
import { GeminiService, hasStoredKeyForType } from '../services/geminiService';
import { TensorAxIcon } from './TensorAxIcon';
import { MoGuidedChat } from './MoGuidedChat';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TemplateRunnerProps {
  templateId: string;
  projectId?: string;
  /** Initial context from the MO conversation — file contents, user instructions, etc. */
  initialContext?: string;
  onComplete: (results: Record<string, unknown>) => void;
  onCancel: () => void;
}

// ─── Step status ────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'review';

interface StepState {
  status: StepStatus;
  output: Record<string, unknown> | null;
  /** Readable text output from the agent */
  outputText: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

// ─── Status badge config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StepStatus, { icon: string; label: string; colour: string; bgColour: string }> = {
  pending:   { icon: 'fa-circle',       label: 'Pending',    colour: 'text-[#ccc]',      bgColour: 'bg-gray-100' },
  running:   { icon: 'fa-spinner',      label: 'Running',    colour: 'text-[#91569c]',   bgColour: 'bg-[#f6f0f8]' },
  completed: { icon: 'fa-circle-check', label: 'Completed',  colour: 'text-green-500',   bgColour: 'bg-green-50' },
  failed:    { icon: 'fa-circle-xmark', label: 'Failed',     colour: 'text-red-500',     bgColour: 'bg-red-50' },
  skipped:   { icon: 'fa-forward',      label: 'Skipped',    colour: 'text-gray-400',    bgColour: 'bg-gray-50' },
  review:    { icon: 'fa-eye',          label: 'In Review',  colour: 'text-amber-500',   bgColour: 'bg-amber-50' },
};

// ─── Mock output generator ──────────────────────────────────────────────────

function generateMockOutput(step: TemplateStep): Record<string, unknown> {
  return {
    stepName: step.name,
    teamId: step.teamId,
    agents: step.agents,
    timestamp: new Date().toISOString(),
    status: 'success',
    summary: `Step "${step.name}" completed successfully by ${step.agents.length} agent(s).`,
    artifacts: step.agents.map(a => ({
      agentId: a,
      type: 'output',
      preview: `[Output from ${a}]`,
    })),
  };
}

// ─── Step Sidebar Item ──────────────────────────────────────────────────────

interface StepSidebarItemProps {
  step: TemplateStep;
  index: number;
  state: StepState;
  isActive: boolean;
  onClick: () => void;
}

const StepSidebarItem: React.FC<StepSidebarItemProps> = ({ step, index, state, isActive, onClick }) => {
  const cfg = STATUS_CONFIG[state.status];

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
        isActive
          ? 'bg-[#f6f0f8] border border-[#91569c]/30'
          : 'hover:bg-[#f9f7fa] border border-transparent'
      }`}
    >
      {/* Step number circle */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black transition-all ${
        state.status === 'completed'
          ? 'bg-green-500 text-white'
          : state.status === 'running'
          ? 'bg-[#91569c] text-white animate-pulse'
          : state.status === 'review'
          ? 'bg-amber-400 text-white'
          : state.status === 'failed'
          ? 'bg-red-500 text-white'
          : isActive
          ? 'bg-[#91569c]/20 text-[#91569c]'
          : 'bg-[#f0eaf2] text-[#999]'
      }`}>
        {state.status === 'completed' ? (
          <i className="fa-solid fa-check text-[9px]" />
        ) : state.status === 'running' ? (
          <i className="fa-solid fa-spinner fa-spin text-[9px]" />
        ) : state.status === 'review' ? (
          <i className="fa-solid fa-eye text-[9px]" />
        ) : state.status === 'failed' ? (
          <i className="fa-solid fa-xmark text-[9px]" />
        ) : (
          index + 1
        )}
      </div>

      {/* Step info */}
      <div className="flex-1 min-w-0">
        <span className={`block text-[10px] font-black uppercase tracking-wider leading-tight truncate ${
          isActive ? 'text-[#91569c]' : state.status === 'completed' ? 'text-green-600' : 'text-[#5c3a62]'
        }`}>
          {step.name}
        </span>
        <span className={`block text-[8px] uppercase tracking-wide mt-0.5 ${cfg.colour}`}>
          {cfg.label}
        </span>
      </div>
    </button>
  );
};

// ─── Agent Chip ─────────────────────────────────────────────────────────────

const AgentChip: React.FC<{ agentId: string }> = ({ agentId }) => {
  const meta = getAgentMeta(agentId as any);
  if (!meta) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#91569c] text-white text-[9px] font-bold uppercase tracking-wide">
      <i className={`fa-solid ${meta.icon} text-[8px]`} />
      {meta.name}
    </span>
  );
};

// ─── Output Display ─────────────────────────────────────────────────────────

const OutputDisplay: React.FC<{ output: Record<string, unknown>; outputText?: string | null }> = ({ output, outputText }) => {
  const [showRaw, setShowRaw] = useState(false);
  const displayText = outputText || (output as any)?.text || '';

  return (
    <div className="rounded-xl border border-[#e0d6e3] bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-[#f0eff0] flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#5c3a62] flex items-center gap-2">
          <i className="fa-solid fa-file-lines text-[#91569c] text-[9px]" />
          Step Output
        </span>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-[8px] font-bold uppercase tracking-wider text-[#bbb] hover:text-[#91569c] transition-colors"
        >
          {showRaw ? 'Formatted' : 'Raw JSON'}
        </button>
      </div>
      <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
        {showRaw ? (
          <pre className="bg-[#f8f6f9] rounded-lg p-3 text-[10px] text-[#5c3a62] overflow-x-auto font-mono leading-relaxed">
            {JSON.stringify(output, null, 2)}
          </pre>
        ) : (
          <div className="text-[12px] text-[#333] leading-relaxed whitespace-pre-wrap">
            {displayText || 'No output available.'}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const TemplateRunner: React.FC<TemplateRunnerProps> = ({
  templateId,
  projectId,
  initialContext,
  onComplete,
  onCancel,
}) => {
  const template = useMemo(() => getTemplate(templateId), [templateId]);

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [stepStates, setStepStates] = useState<StepState[]>(() =>
    (template?.steps || []).map(() => ({
      status: 'pending' as StepStatus,
      output: null,
      outputText: null,
      startedAt: null,
      completedAt: null,
    }))
  );
  const [pipelineComplete, setPipelineComplete] = useState(false);

  // ── Mo coaching state ──
  const [moStatus, setMoStatus] = useState<MoStatus>('instructing');
  const [moValidation, setMoValidation] = useState<MoValidationResult | null>(null);
  /** Per-step uploaded files: stepIndex → inputId → File[] */
  const [stepUploads, setStepUploads] = useState<Record<number, Record<string, File[]>>>({});
  /** Per-step toggle values: stepIndex → inputId → boolean */
  const [stepToggles, setStepToggles] = useState<Record<number, Record<string, boolean>>>({});
  /** Per-step text values: stepIndex → inputId → string */
  const [stepTexts, setStepTexts] = useState<Record<number, Record<string, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──

  const updateStepState = useCallback((index: number, updates: Partial<StepState>) => {
    setStepStates(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }, []);

  const currentStep = template?.steps[activeStepIndex];
  const currentState = stepStates[activeStepIndex];
  const completedCount = stepStates.filter(s => s.status === 'completed').length;
  const totalSteps = template?.steps.length || 0;
  const hasGuidance = !!currentStep?.moGuidance;
  const hasStepInputs = !!(currentStep?.stepInputs && currentStep.stepInputs.length > 0);

  // ── Reset Mo state when step changes ──
  const prevStepRef = useRef(activeStepIndex);
  if (prevStepRef.current !== activeStepIndex) {
    prevStepRef.current = activeStepIndex;
    setMoStatus('instructing');
    setMoValidation(null);
  }

  // ── File upload handler ──
  const handleFileUpload = useCallback((inputId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setStepUploads(prev => {
      const stepFiles = prev[activeStepIndex] || {};
      const existing = stepFiles[inputId] || [];
      return {
        ...prev,
        [activeStepIndex]: {
          ...stepFiles,
          [inputId]: [...existing, ...Array.from(files)],
        },
      };
    });
  }, [activeStepIndex]);

  const handleRemoveFile = useCallback((inputId: string, fileIndex: number) => {
    setStepUploads(prev => {
      const stepFiles = prev[activeStepIndex] || {};
      const existing = stepFiles[inputId] || [];
      return {
        ...prev,
        [activeStepIndex]: {
          ...stepFiles,
          [inputId]: existing.filter((_, i) => i !== fileIndex),
        },
      };
    });
  }, [activeStepIndex]);

  const handleToggle = useCallback((inputId: string) => {
    setStepToggles(prev => {
      const stepVals = prev[activeStepIndex] || {};
      return {
        ...prev,
        [activeStepIndex]: { ...stepVals, [inputId]: !stepVals[inputId] },
      };
    });
  }, [activeStepIndex]);

  const handleTextChange = useCallback((inputId: string, value: string) => {
    setStepTexts(prev => {
      const stepVals = prev[activeStepIndex] || {};
      return {
        ...prev,
        [activeStepIndex]: { ...stepVals, [inputId]: value },
      };
    });
  }, [activeStepIndex]);

  // ── Check if upload step has enough inputs to validate ──
  const canValidateStep = useMemo(() => {
    if (!currentStep?.stepInputs) return true;
    const uploads = stepUploads[activeStepIndex] || {};
    return currentStep.stepInputs
      .filter(inp => inp.required && inp.type === 'upload-images')
      .every(inp => (uploads[inp.id]?.length || 0) >= (inp.min || 1));
  }, [currentStep, activeStepIndex, stepUploads]);

  // ── Mo validation handler (calls AI to check work) ──
  const handleMoValidation = useCallback(async () => {
    if (!currentStep?.moGuidance?.validationPrompt) return;

    setMoStatus('checking');

    try {
      if (!hasStoredKeyForType('analysis')) {
        setMoValidation({
          status: 'needs-fixes',
          feedback: 'No API key set. Please configure a Gemini key in Settings to enable Mo\'s validation.',
          issues: ['Missing API key'],
        });
        setMoStatus('needs-fixes');
        return;
      }

      // Build context about what the user has uploaded/entered
      const uploads = stepUploads[activeStepIndex] || {};
      const toggles = stepToggles[activeStepIndex] || {};
      const texts = stepTexts[activeStepIndex] || {};

      const uploadSummary = Object.entries(uploads)
        .map(([id, files]) => `${id}: ${files.length} file(s) — ${files.map(f => f.name).join(', ')}`)
        .join('\n');
      const toggleSummary = Object.entries(toggles)
        .map(([id, val]) => `${id}: ${val ? 'ON' : 'OFF'}`)
        .join('\n');
      const textSummary = Object.entries(texts)
        .filter(([, val]) => val)
        .map(([id, val]) => `${id}: ${val}`)
        .join('\n');

      const prompt = `${currentStep.moGuidance.validationPrompt}

USER INPUT FOR THIS STEP:
${uploadSummary || '(no files uploaded)'}
${toggleSummary || ''}
${textSummary || ''}

Respond in this exact JSON format:
{
  "status": "approved" or "needs-fixes",
  "feedback": "Brief summary of your assessment",
  "issues": ["specific issue 1", "specific issue 2"],
  "score": 7
}

Score 1-10 where 7+ = approved. Only return the JSON, nothing else.`;

      const chat = GeminiService.createChat('gemini-2.5-flash');
      const response = await Promise.race([
        chat.sendMessage({ message: prompt }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Validation timed out')), 30000)
        ),
      ]);

      const text = (response as any)?.text || '';

      // Try to parse JSON response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]) as MoValidationResult;
          setMoValidation(result);
          setMoStatus(result.status === 'approved' ? 'approved' : 'needs-fixes');
        } else {
          // Fallback: treat as approved with the text as feedback
          setMoValidation({ status: 'approved', feedback: text, score: 8 });
          setMoStatus('approved');
        }
      } catch {
        setMoValidation({ status: 'approved', feedback: text, score: 7 });
        setMoStatus('approved');
      }
    } catch (err: any) {
      setMoValidation({
        status: 'needs-fixes',
        feedback: `Validation error: ${err?.message || 'Unknown error'}`,
        issues: [err?.message || 'Unknown error'],
      });
      setMoStatus('needs-fixes');
    }
  }, [currentStep, activeStepIndex, stepUploads, stepToggles, stepTexts]);

  const handleMoSkipValidation = useCallback(() => {
    setMoStatus('approved');
    setMoValidation({
      status: 'approved',
      feedback: 'Skipped validation — proceeding with current work.',
    });
  }, []);

  // ── Build context from prior steps ──

  const buildPriorContext = useCallback(() => {
    const prior: string[] = [];
    (template?.steps || []).forEach((step, i) => {
      const st = stepStates[i];
      if (st.status === 'completed' && st.outputText) {
        prior.push(`--- Step ${i + 1}: ${step.name} ---\n${st.outputText}`);
      }
    });
    return prior.length > 0 ? '\n\nPrior step results:\n' + prior.join('\n\n') : '';
  }, [template, stepStates]);

  // ── Run step (real Gemini call) ──

  const handleRunStep = useCallback(async () => {
    if (!currentStep) return;

    // Check API key
    if (!hasStoredKeyForType('analysis')) {
      updateStepState(activeStepIndex, {
        status: 'failed',
        outputText: 'No Gemini API key found. Please set one in Settings.',
        completedAt: Date.now(),
      });
      return;
    }

    updateStepState(activeStepIndex, { status: 'running', startedAt: Date.now() });

    try {
      // Build agent prompt with context
      const agentMetas = currentStep.agents.map(id => getAgentMeta(id as any)).filter(Boolean);
      const agentNames = agentMetas.map(a => a!.name).join(', ');
      const agentDescs = agentMetas.map(a => `${a!.name}: ${a!.description}`).join('\n');
      const priorContext = buildPriorContext();

      const initialCtx = initialContext || '';

      const prompt = `═══ ORIGINAL USER BRIEF ═══
${initialCtx || '(No brief provided)'}
═══ END BRIEF ═══

You are executing step ${currentStep.order} of ${totalSteps} in the "${template?.name || 'Pipeline'}" pipeline.

CRITICAL: Follow the user's original brief above exactly. Do NOT invent extra steps, camera angles, storyboard frames, or production techniques that the user did not ask for. Stick precisely to what was requested.

CURRENT STEP: ${currentStep.name}
Description: ${currentStep.description}
Active agents: ${agentNames}
${priorContext ? `\n${priorContext}` : ''}

Execute ONLY this step. Deliver the specific output described above, using the user's content and instructions from the brief. Be thorough but stay on-brief.`;

      const chat = GeminiService.createChat('gemini-2.5-flash');
      const responsePromise = chat.sendMessage({ message: prompt });
      const response = await Promise.race([
        responsePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Step timed out after 60 seconds')), 60000)
        ),
      ]);

      const outputText = (response as any)?.text || 'Step completed but no output was returned.';

      if (currentStep.requiresReview) {
        updateStepState(activeStepIndex, {
          status: 'review',
          output: { text: outputText, agents: currentStep.agents, timestamp: new Date().toISOString() },
          outputText,
          completedAt: Date.now(),
        });
      } else {
        updateStepState(activeStepIndex, {
          status: 'completed',
          output: { text: outputText, agents: currentStep.agents, timestamp: new Date().toISOString() },
          outputText,
          completedAt: Date.now(),
        });
        if (activeStepIndex < totalSteps - 1) {
          setActiveStepIndex(activeStepIndex + 1);
        } else {
          setPipelineComplete(true);
        }
      }
    } catch (err: any) {
      updateStepState(activeStepIndex, {
        status: 'failed',
        outputText: `Error: ${err?.message || 'Failed to execute step'}`,
        completedAt: Date.now(),
      });
    }
  }, [currentStep, activeStepIndex, totalSteps, updateStepState, buildPriorContext, template]);

  // ── Review actions ──

  const handleApprove = useCallback(() => {
    updateStepState(activeStepIndex, { status: 'completed' });

    if (activeStepIndex < totalSteps - 1) {
      setActiveStepIndex(activeStepIndex + 1);
    } else {
      setPipelineComplete(true);
    }
  }, [activeStepIndex, totalSteps, updateStepState]);

  const handleReject = useCallback(() => {
    updateStepState(activeStepIndex, {
      status: 'pending',
      output: null,
      startedAt: null,
      completedAt: null,
    });
  }, [activeStepIndex, updateStepState]);

  // ── Pipeline complete handler ──

  const handleFinish = useCallback(() => {
    const results: Record<string, unknown> = {};
    (template?.steps || []).forEach((step, i) => {
      results[step.name] = stepStates[i].output;
    });
    onComplete(results);
  }, [template, stepStates, onComplete]);

  // ── Guard: template not found ──

  if (!template) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec]">
        <div className="text-center">
          <i className="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-3" />
          <p className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">Template not found</p>
          <p className="text-[11px] text-[#888] mt-1">The template "{templateId}" does not exist</p>
          <button
            onClick={onCancel}
            className="mt-4 px-5 py-2 rounded-lg bg-[#91569c] hover:bg-[#7a4685] text-white text-[10px] font-black uppercase tracking-wider transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // ── Pipeline complete screen ──

  if (pipelineComplete) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#edecec]">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
            <i className="fa-solid fa-circle-check text-4xl text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#5c3a62] uppercase tracking-wide">
              Pipeline Complete!
            </h2>
            <p className="text-[11px] text-[#888] mt-2">
              All {totalSteps} steps have been completed successfully
            </p>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-[#e0d6e3] p-5 text-left space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#5c3a62] flex items-center gap-2 mb-3">
              <i className="fa-solid fa-clipboard-list text-[#91569c]" />
              Summary
            </span>
            {template.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f9f7fa]">
                <i className="fa-solid fa-circle-check text-green-500 text-[9px]" />
                <span className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide flex-1">{step.name}</span>
                <span className="text-[9px] text-[#aaa]">{step.agents.length} agent{step.agents.length !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleFinish}
            className="px-8 py-3 rounded-xl bg-[#91569c] hover:bg-[#7a4685] text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
          >
            <i className="fa-solid fa-check mr-2" />
            Finish
          </button>
        </div>
      </div>
    );
  }

  // ── Main runner layout ──

  const teamMeta = currentStep ? getTeamMeta(currentStep.teamId) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#edecec]">
      {/* ── Top bar ── */}
      <div className="px-6 py-3 bg-white border-b border-[#e0d6e3] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#f6f0f8] flex items-center justify-center">
            <i className={`fa-solid ${template.icon || 'fa-shapes'} text-base text-[#91569c]`} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#5c3a62] uppercase tracking-wide">
              {template.name}
            </h2>
            <p className="text-[9px] text-[#888] uppercase tracking-wide">
              Step {activeStepIndex + 1} of {totalSteps}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="w-40 h-1.5 rounded-full bg-[#e0d6e3] overflow-hidden">
            <div
              className="h-full bg-[#91569c] rounded-full transition-all duration-500"
              style={{ width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[9px] font-bold text-[#888]">
            {completedCount}/{totalSteps}
          </span>
        </div>

        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e0d6e3] hover:border-red-300 hover:bg-red-50 text-[#888] hover:text-red-500 text-[10px] font-black uppercase tracking-wider transition-all"
        >
          <i className="fa-solid fa-xmark text-[9px]" />
          Cancel
        </button>
      </div>

      {/* ── Body: sidebar + guided chat ── */}
      <div className="flex flex-1 min-h-0">
        {/* Step sidebar */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-[#e0d6e3] overflow-y-auto p-3 flex flex-col">
          <div className="px-3 py-2 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#aaa]">
              Pipeline Steps
            </span>
          </div>
          <div className="space-y-1 flex-1">
            {template.steps.map((step, i) => (
              <StepSidebarItem
                key={i}
                step={step}
                index={i}
                state={stepStates[i]}
                isActive={i === activeStepIndex}
                onClick={() => setActiveStepIndex(i)}
              />
            ))}
          </div>

          {/* ── Toggles (project-level options) ── */}
          {template.inputs?.customFields?.some(f => f.type === 'toggle') && (
            <div className="mt-3 pt-3 border-t border-[#f0eff0] space-y-2">
              <span className="text-[8px] font-black uppercase tracking-wider text-[#aaa] px-3 block">
                Options
              </span>
              {template.inputs.customFields.filter(f => f.type === 'toggle').map(field => (
                <div key={field.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#f9f7fa]">
                  <span className="text-[9px] font-bold text-[#5c3a62] leading-tight flex-1 mr-2">
                    {field.id === 'outfitStandalone' ? '🏷️ Outfit Standalone' :
                     field.id === 'filmMode' ? '🎬 Film Mode' :
                     field.label}
                  </span>
                  <button
                    onClick={() => handleToggle(field.id)}
                    className={`w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 ${
                      (stepToggles[0]?.[field.id] || false) ? 'bg-[#91569c] justify-end' : 'bg-[#d4d4d4] justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow mx-0.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Guided chat (centre) ── */}
        <MoGuidedChat
          steps={template.steps}
          activeStepIndex={activeStepIndex}
          stepFiles={stepUploads}
          toggleValues={stepToggles[0] || {}}
          onFilesAdded={(inputId, files) => {
            setStepUploads(prev => {
              const stepFiles = prev[activeStepIndex] || {};
              const existing = stepFiles[inputId] || [];
              return {
                ...prev,
                [activeStepIndex]: { ...stepFiles, [inputId]: [...existing, ...files] },
              };
            });
          }}
          onStepApproved={() => {
            updateStepState(activeStepIndex, { status: 'completed', completedAt: Date.now() });
            if (activeStepIndex < totalSteps - 1) {
              setActiveStepIndex(activeStepIndex + 1);
            } else {
              setPipelineComplete(true);
            }
          }}
          onStepSkipped={() => {
            updateStepState(activeStepIndex, { status: 'completed', completedAt: Date.now() });
            if (activeStepIndex < totalSteps - 1) {
              setActiveStepIndex(activeStepIndex + 1);
            } else {
              setPipelineComplete(true);
            }
          }}
          onRunAgentStep={handleRunStep}
          agentRunning={currentState?.status === 'running'}
          agentOutput={currentState?.outputText}
          agentInReview={currentState?.status === 'review'}
        />
      </div>
    </div>
  );
};
