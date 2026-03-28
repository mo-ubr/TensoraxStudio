/**
 * Pipeline Engine — stateful execution of multi-step agent pipelines.
 *
 * A pipeline is a sequence of steps. Each step:
 *   1. Receives input data from previous steps (or user input)
 *   2. Runs one or more agents (sequentially or in parallel)
 *   3. Produces output data that feeds into subsequent steps
 *   4. Optionally pauses for user review before continuing
 *
 * The engine tracks execution state, handles failures with retries,
 * and persists progress so pipelines can resume after interruption.
 *
 * This is the runtime counterpart to TemplateConfig (the blueprint).
 * TemplateConfig defines WHAT to run; PipelineEngine executes it.
 */

import { runAgent, runAgentsParallel, type AgentRunOptions, type AgentRunResult } from './agentRunner';
import type { TemplateConfig, TemplateStep, AgentId, TeamId, ToolId } from '../templates/templateConfig';
import { checkTools, type ToolAvailability } from './toolRegistry';
import { TEAM_CATALOGUE, type AgentMeta } from './templateService';

// ─── Pipeline State Types ───────────────────────────────────────────────────

export type StepStatus = 'pending' | 'running' | 'awaiting_review' | 'completed' | 'failed' | 'skipped';

export interface StepOutput {
  /** Raw agent result(s) for this step */
  agentResults: AgentRunResult[];
  /** Structured data extracted from agent results — passed to next steps */
  data: Record<string, unknown>;
  /** Human-readable summary of what this step produced */
  summary: string;
  /** Timestamp when step completed */
  completedAt: string;
}

export interface PipelineStepState {
  /** Step definition from the template */
  step: TemplateStep;
  /** Current status */
  status: StepStatus;
  /** Input data received from previous steps + user input */
  input: Record<string, unknown>;
  /** Output produced by this step's agents */
  output?: StepOutput;
  /** Error message if step failed */
  error?: string;
  /** Number of retry attempts */
  retries: number;
  /** Timestamp when step started running */
  startedAt?: string;
}

export interface PipelineState {
  /** Unique pipeline execution ID */
  id: string;
  /** Template this pipeline was created from */
  templateId: string;
  templateName: string;
  /** Current step index (0-based) */
  currentStep: number;
  /** All step states */
  steps: PipelineStepState[];
  /** Global pipeline input (user-provided data, uploaded files, etc.) */
  globalInput: Record<string, unknown>;
  /** Pipeline-level status */
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  /** When the pipeline was created */
  createdAt: string;
  /** When the pipeline was last updated */
  updatedAt: string;
  /** Final output (aggregated from all steps) */
  finalOutput?: Record<string, unknown>;
}

// ─── Pipeline Events (for UI updates) ───────────────────────────────────────

export type PipelineEventType =
  | 'pipeline_started'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_awaiting_review'
  | 'step_skipped'
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'pipeline_paused';

export interface PipelineEvent {
  type: PipelineEventType;
  pipelineId: string;
  stepIndex?: number;
  stepName?: string;
  data?: unknown;
  timestamp: string;
}

export type PipelineEventHandler = (event: PipelineEvent) => void;

// ─── Agent Prompt Resolver ──────────────────────────────────────────────────

/**
 * Maps an AgentId to its system prompt.
 * Templates can provide custom prompt overrides; otherwise we use
 * the default prompt from the prompts/ directory.
 *
 * This is a pluggable function — set it via setPipelinePromptResolver()
 * to customize how agent prompts are resolved.
 */
export type PromptResolver = (agentId: AgentId, stepContext: Record<string, unknown>) => string;

let promptResolver: PromptResolver = defaultPromptResolver;

function defaultPromptResolver(agentId: AgentId, _context: Record<string, unknown>): string {
  // Default: return a generic prompt that describes the agent's role
  const agent = findAgentMeta(agentId);
  if (!agent) return `You are an AI agent. Complete the task described below.`;

  return `You are ${agent.name} — ${agent.description}

Your role: ${agent.description}

Analyse the input carefully and produce structured JSON output.
Be thorough, accurate, and concise.`;
}

export function setPipelinePromptResolver(resolver: PromptResolver): void {
  promptResolver = resolver;
}

// ─── Helper: find agent metadata ────────────────────────────────────────────

function findAgentMeta(agentId: AgentId): AgentMeta | undefined {
  for (const team of TEAM_CATALOGUE) {
    const agent = team.agents.find(a => a.id === agentId);
    if (agent) return agent;
  }
  return undefined;
}

// ─── Pipeline Factory ───────────────────────────────────────────────────────

/**
 * Create a new pipeline from a template configuration.
 */
export function createPipeline(
  template: TemplateConfig,
  globalInput: Record<string, unknown> = {},
): PipelineState {
  const id = `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const steps: PipelineStepState[] = template.steps.map(step => ({
    step,
    status: 'pending',
    input: {},
    retries: 0,
  }));

  return {
    id,
    templateId: template.id,
    templateName: template.name,
    currentStep: 0,
    steps,
    globalInput,
    status: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Tool Availability Check ────────────────────────────────────────────────

/**
 * Check if all required tools for a template are available.
 * Returns missing tools so the UI can prompt the user.
 */
export function checkPipelineTools(template: TemplateConfig): {
  ready: boolean;
  missing: ToolAvailability[];
} {
  if (!template.requiredTools?.length) return { ready: true, missing: [] };

  const results = checkTools(template.requiredTools);
  const missing = results.filter(r => r.status !== 'available');
  return { ready: missing.length === 0, missing };
}

// ─── Pipeline Execution ─────────────────────────────────────────────────────

/**
 * Execute the next step in a pipeline.
 *
 * Returns the updated pipeline state. If the step requires review,
 * the pipeline pauses (status = 'paused') and waits for
 * approveStep() or skipStep() to be called.
 */
export async function executeNextStep(
  pipeline: PipelineState,
  onEvent?: PipelineEventHandler,
): Promise<PipelineState> {
  const stepIndex = pipeline.currentStep;
  const stepState = pipeline.steps[stepIndex];

  if (!stepState) {
    // All steps done
    pipeline.status = 'completed';
    pipeline.updatedAt = new Date().toISOString();
    pipeline.finalOutput = aggregateOutputs(pipeline);
    onEvent?.({ type: 'pipeline_completed', pipelineId: pipeline.id, timestamp: new Date().toISOString() });
    return pipeline;
  }

  // Mark pipeline and step as running
  pipeline.status = 'running';
  stepState.status = 'running';
  stepState.startedAt = new Date().toISOString();
  pipeline.updatedAt = new Date().toISOString();

  onEvent?.({
    type: 'step_started',
    pipelineId: pipeline.id,
    stepIndex,
    stepName: stepState.step.name,
    timestamp: new Date().toISOString(),
  });

  // Build step input from global input + previous step outputs
  stepState.input = buildStepInput(pipeline, stepIndex);

  try {
    // Run all agents for this step
    const agentResults = await runStepAgents(stepState.step, stepState.input);

    // Build step output
    stepState.output = {
      agentResults,
      data: extractStepData(agentResults),
      summary: buildStepSummary(stepState.step, agentResults),
      completedAt: new Date().toISOString(),
    };

    // Check if review is required
    if (stepState.step.requiresReview) {
      stepState.status = 'awaiting_review';
      pipeline.status = 'paused';
      pipeline.updatedAt = new Date().toISOString();

      onEvent?.({
        type: 'step_awaiting_review',
        pipelineId: pipeline.id,
        stepIndex,
        stepName: stepState.step.name,
        data: stepState.output,
        timestamp: new Date().toISOString(),
      });

      return pipeline;
    }

    // No review needed — mark complete and advance
    stepState.status = 'completed';
    pipeline.currentStep++;
    pipeline.updatedAt = new Date().toISOString();

    onEvent?.({
      type: 'step_completed',
      pipelineId: pipeline.id,
      stepIndex,
      stepName: stepState.step.name,
      data: stepState.output,
      timestamp: new Date().toISOString(),
    });

    // Check if pipeline is done
    if (pipeline.currentStep >= pipeline.steps.length) {
      pipeline.status = 'completed';
      pipeline.finalOutput = aggregateOutputs(pipeline);
      onEvent?.({ type: 'pipeline_completed', pipelineId: pipeline.id, timestamp: new Date().toISOString() });
    }

    return pipeline;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    stepState.status = 'failed';
    stepState.error = errorMsg;
    stepState.retries++;
    pipeline.status = 'failed';
    pipeline.updatedAt = new Date().toISOString();

    onEvent?.({
      type: 'step_failed',
      pipelineId: pipeline.id,
      stepIndex,
      stepName: stepState.step.name,
      data: { error: errorMsg },
      timestamp: new Date().toISOString(),
    });

    return pipeline;
  }
}

/**
 * Approve a step that's awaiting review and advance to the next step.
 */
export function approveStep(pipeline: PipelineState): PipelineState {
  const stepState = pipeline.steps[pipeline.currentStep];
  if (stepState?.status !== 'awaiting_review') return pipeline;

  stepState.status = 'completed';
  pipeline.currentStep++;
  pipeline.updatedAt = new Date().toISOString();

  if (pipeline.currentStep >= pipeline.steps.length) {
    pipeline.status = 'completed';
    pipeline.finalOutput = aggregateOutputs(pipeline);
  } else {
    pipeline.status = 'running';
  }

  return pipeline;
}

/**
 * Skip a step that's awaiting review or pending.
 */
export function skipStep(pipeline: PipelineState): PipelineState {
  const stepState = pipeline.steps[pipeline.currentStep];
  if (!stepState) return pipeline;

  stepState.status = 'skipped';
  pipeline.currentStep++;
  pipeline.updatedAt = new Date().toISOString();

  if (pipeline.currentStep >= pipeline.steps.length) {
    pipeline.status = 'completed';
    pipeline.finalOutput = aggregateOutputs(pipeline);
  }

  return pipeline;
}

/**
 * Retry a failed step.
 */
export async function retryStep(
  pipeline: PipelineState,
  onEvent?: PipelineEventHandler,
): Promise<PipelineState> {
  const stepState = pipeline.steps[pipeline.currentStep];
  if (stepState?.status !== 'failed') return pipeline;

  stepState.status = 'pending';
  stepState.error = undefined;
  return executeNextStep(pipeline, onEvent);
}

/**
 * Run ALL remaining steps in a pipeline until completion or pause.
 * Automatically advances through non-review steps.
 */
export async function runPipeline(
  pipeline: PipelineState,
  onEvent?: PipelineEventHandler,
): Promise<PipelineState> {
  if (pipeline.status === 'completed' || pipeline.status === 'failed') return pipeline;

  onEvent?.({ type: 'pipeline_started', pipelineId: pipeline.id, timestamp: new Date().toISOString() });

  while (pipeline.currentStep < pipeline.steps.length) {
    pipeline = await executeNextStep(pipeline, onEvent);

    // Stop if paused (awaiting review), failed, or completed
    if (pipeline.status !== 'running') break;
  }

  return pipeline;
}

// ─── Internal: Step Agent Execution ─────────────────────────────────────────

async function runStepAgents(
  step: TemplateStep,
  input: Record<string, unknown>,
): Promise<AgentRunResult[]> {
  const agents = step.agents;
  if (!agents.length) return []; // Input-only step (e.g. upload)

  const userMessage = JSON.stringify(input, null, 2);

  // Check if this step has parallel agent groups defined in the team activation
  // For now, run agents sequentially (parallel support via TeamActivation.parallel)
  const results: AgentRunResult[] = [];

  for (const agentId of agents) {
    const agentPrompt = promptResolver(agentId as AgentId, input);

    const opts: AgentRunOptions = {
      agentPrompt,
      userMessage,
      provider: undefined, // auto-detect
      model: undefined,    // use default
    };

    // If previous agents in this step produced output, include it
    if (results.length > 0) {
      const prevData = results.map(r => r.data);
      opts.userMessage = JSON.stringify({ ...input, previousAgentOutputs: prevData }, null, 2);
    }

    const result = await runAgent(opts);
    results.push(result);
  }

  return results;
}

// ─── Internal: Data Flow ────────────────────────────────────────────────────

/**
 * Build input for a step by combining:
 * 1. Global pipeline input (user-provided data)
 * 2. Outputs from all completed previous steps
 * 3. Step-specific parameters from the template
 */
function buildStepInput(pipeline: PipelineState, stepIndex: number): Record<string, unknown> {
  const input: Record<string, unknown> = {
    ...pipeline.globalInput,
    _pipelineName: pipeline.templateName,
    _stepIndex: stepIndex,
    _stepName: pipeline.steps[stepIndex].step.name,
  };

  // Add outputs from all completed previous steps
  for (let i = 0; i < stepIndex; i++) {
    const prevStep = pipeline.steps[i];
    if (prevStep.output?.data) {
      input[`step_${i}_${prevStep.step.name.toLowerCase().replace(/\s+/g, '_')}`] = prevStep.output.data;
    }
  }

  // Add step-specific params from template
  if (pipeline.steps[stepIndex].step.params) {
    Object.assign(input, pipeline.steps[stepIndex].step.params);
  }

  return input;
}

/**
 * Extract structured data from agent results.
 * Merges all agent outputs into a single data object.
 */
function extractStepData(results: AgentRunResult[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (typeof result.data === 'object' && result.data !== null) {
      Object.assign(data, result.data);
    } else {
      data[`agent_${i}_output`] = result.data;
    }
    // Always include raw text as fallback
    data[`agent_${i}_rawText`] = result.rawText;
  }

  return data;
}

/**
 * Build a human-readable summary of what a step produced.
 */
function buildStepSummary(step: TemplateStep, results: AgentRunResult[]): string {
  if (results.length === 0) return `${step.name}: No agents ran (input-only step)`;

  const agentSummaries = results.map((r, i) => {
    const agentId = step.agents[i] || `agent_${i}`;
    const dataKeys = typeof r.data === 'object' && r.data !== null ? Object.keys(r.data as object) : [];
    return `${agentId}: produced ${dataKeys.length} fields via ${r.provider}/${r.model}`;
  });

  return `${step.name}: ${results.length} agent(s) completed\n${agentSummaries.join('\n')}`;
}

/**
 * Aggregate outputs from all completed steps into final pipeline output.
 */
function aggregateOutputs(pipeline: PipelineState): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const stepState of pipeline.steps) {
    if (stepState.output?.data) {
      const stepKey = stepState.step.name.toLowerCase().replace(/\s+/g, '_');
      output[stepKey] = stepState.output.data;
    }
  }

  return output;
}

// ─── Pipeline Persistence (localStorage) ────────────────────────────────────

const PIPELINE_STORAGE_KEY = 'tensorax_active_pipelines';

export function savePipeline(pipeline: PipelineState): void {
  const pipelines = loadAllPipelines();
  const idx = pipelines.findIndex(p => p.id === pipeline.id);
  if (idx >= 0) {
    pipelines[idx] = pipeline;
  } else {
    pipelines.push(pipeline);
  }
  localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(pipelines));
}

export function loadPipeline(id: string): PipelineState | undefined {
  return loadAllPipelines().find(p => p.id === id);
}

export function loadAllPipelines(): PipelineState[] {
  try {
    const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deletePipeline(id: string): void {
  const pipelines = loadAllPipelines().filter(p => p.id !== id);
  localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(pipelines));
}
