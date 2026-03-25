import React, { useState, useCallback, useMemo } from 'react';
import type { TemplateConfig, TemplateStep } from '../templates/templateConfig';
import {
  getTemplate,
  getTeamMeta,
  getAgentMeta,
} from '../services/templateService';
import { GeminiService, hasStoredKeyForType } from '../services/geminiService';
import { TensorAxIcon } from './TensorAxIcon';

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

  // ── Helpers ──

  const updateStepState = useCallback((index: number, updates: Partial<StepState>) => {
    setStepStates(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }, []);

  const currentStep = template?.steps[activeStepIndex];
  const currentState = stepStates[activeStepIndex];
  const completedCount = stepStates.filter(s => s.status === 'completed').length;
  const totalSteps = template?.steps.length || 0;

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

      {/* ── Body: sidebar + main content ── */}
      <div className="flex flex-1 min-h-0">
        {/* Step sidebar */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-[#e0d6e3] overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-2 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#aaa]">
              Pipeline Steps
            </span>
          </div>
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

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-8">
          {currentStep && currentState && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Step header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#aaa]">
                    Step {currentStep.order}
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_CONFIG[currentState.status].bgColour} ${STATUS_CONFIG[currentState.status].colour}`}>
                    {STATUS_CONFIG[currentState.status].label}
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#5c3a62] uppercase tracking-wide">
                  {currentStep.name}
                </h3>
                <p className="text-[12px] text-[#888] mt-2 leading-relaxed">
                  {currentStep.description}
                </p>
              </div>

              {/* Team badge */}
              {teamMeta && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#e0d6e3]">
                  <div className="w-9 h-9 rounded-lg bg-[#f6f0f8] flex items-center justify-center">
                    <i className={`fa-solid ${teamMeta.icon} text-sm text-[#91569c]`} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#5c3a62]">
                      {teamMeta.name}
                    </span>
                    <p className="text-[9px] text-[#999]">{teamMeta.description}</p>
                  </div>
                </div>
              )}

              {/* Active agents */}
              {currentStep.agents.length > 0 && (
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#aaa] mb-2 block">
                    Active Agents
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentStep.agents.map(agentId => (
                      <AgentChip key={agentId} agentId={agentId} />
                    ))}
                  </div>
                </div>
              )}

              {/* Running animation with spinning TensorAx icon */}
              {currentState.status === 'running' && (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl bg-white border border-[#e0d6e3]">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f6f0f8] to-[#eadcef] flex items-center justify-center mb-4">
                    <TensorAxIcon className="w-8 h-8 text-[#91569c]" spinning />
                  </div>
                  <span className="text-sm font-black text-[#5c3a62] uppercase tracking-wide">
                    Agents working...
                  </span>
                  <p className="text-[10px] text-[#999] mt-2">
                    {currentStep.agents.length} agent{currentStep.agents.length !== 1 ? 's' : ''} processing this step
                  </p>
                  {/* Progress dots */}
                  <div className="mt-4 flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className="h-1.5 rounded-full bg-[#91569c] animate-pulse"
                        style={{ width: `${12 + i * 3}px`, animationDelay: `${i * 200}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Output display (when completed or in review) */}
              {(currentState.outputText || currentState.output) && (currentState.status === 'completed' || currentState.status === 'review') && (
                <OutputDisplay output={currentState.output || {}} outputText={currentState.outputText} />
              )}

              {/* Failed step — show error */}
              {currentState.status === 'failed' && currentState.outputText && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-circle-xmark text-red-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-700">Step Failed</span>
                  </div>
                  <p className="text-[11px] text-red-800">{currentState.outputText}</p>
                  <button
                    onClick={handleReject}
                    className="mt-3 px-4 py-2 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <i className="fa-solid fa-rotate-left mr-1.5 text-[9px]" />Retry Step
                  </button>
                </div>
              )}

              {/* Review actions */}
              {currentState.status === 'review' && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-eye text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                      Review Required
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 mb-4">
                    This step requires your approval before proceeding to the next step.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleApprove}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                    >
                      <i className="fa-solid fa-check text-[9px]" />
                      Approve & Continue
                    </button>
                    <button
                      onClick={handleReject}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      <i className="fa-solid fa-rotate-left text-[9px]" />
                      Reject & Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Run button (only when pending) */}
              {currentState.status === 'pending' && (
                <button
                  onClick={handleRunStep}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#91569c] hover:bg-[#7a4685] text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                >
                  <i className="fa-solid fa-play text-[10px]" />
                  Run Step
                </button>
              )}

              {/* Completed step — show "Next" if not auto-advanced */}
              {currentState.status === 'completed' && activeStepIndex < totalSteps - 1 && (
                <button
                  onClick={() => setActiveStepIndex(activeStepIndex + 1)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#e0d6e3] bg-white hover:bg-[#f6f0f8] text-[#91569c] text-xs font-black uppercase tracking-wider transition-all"
                >
                  <i className="fa-solid fa-arrow-right text-[10px]" />
                  Next Step
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
