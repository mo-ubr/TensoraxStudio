/**
 * CompositionOrchestrator — post-production composition pipeline.
 *
 * Takes generated video segments and composes a finished video with
 * text overlays, music, captions, and branding via Shotstack.
 *
 * Pipeline:
 *   textOverlayAgent → musicDirectionAgent → captionAgent → compositionAgent → Shotstack render
 */

import { runAgent } from '../agentRunner';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext } from './types';

import { textOverlayAgentPrompt } from '../../prompts/Composition/textOverlayAgent';
import { musicDirectionAgentPrompt } from '../../prompts/Composition/musicDirectionAgent';
import { captionAgentPrompt } from '../../prompts/Composition/captionAgent';
import { compositionAgentPrompt } from '../../prompts/Composition/compositionAgent';

// ─── Input types for the composition pipeline ────────────────────────────────

export interface CompositionInputs {
  /** Video segment URLs in order */
  videoSegments: Array<{ url: string; duration: number; description?: string }>;
  /** Total video duration in seconds */
  totalDuration: number;
  /** Aspect ratio: '16:9', '9:16', or '1:1' */
  aspectRatio: string;
  /** User's text overlay instructions (optional) */
  textInstructions?: string;
  /** Title text for the video (optional) */
  title?: string;
  /** Background music URL (optional) */
  musicUrl?: string;
  /** Voiceover transcript (optional) */
  voiceoverTranscript?: string;
  /** Voiceover audio URL (optional) */
  voiceoverUrl?: string;
  /** Branding overlay image URL (optional — watermark/logo) */
  brandingOverlayUrl?: string;
  /** Brand colour hex (optional) */
  brandColour?: string;
  /** Transition between segments: fade, wipeLeft, slideLeft, etc. */
  transition?: string;
}

// ─── Step map ────────────────────────────────────────────────────────────────

const STEP_MAP: Record<string, string> = {
  'text-overlays': 'textOverlayAgent',
  'music-direction': 'musicDirectionAgent',
  'captions': 'captionAgent',
  'composition': 'compositionAgent',
};

// ─── Pipeline step definitions ───────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'text-overlays', name: 'Text Overlays', agent: 'textOverlayAgent', status: 'pending' },
    { id: 'music-direction', name: 'Music Direction', agent: 'musicDirectionAgent', status: 'pending' },
    { id: 'captions', name: 'Captions', agent: 'captionAgent', status: 'pending' },
    { id: 'composition', name: 'Final Composition', agent: 'compositionAgent', status: 'pending', requiresReview: true },
  ];
}

// ─── Agent prompt selection ──────────────────────────────────────────────────

function getAgentPrompt(agent: string): string {
  switch (agent) {
    case 'textOverlayAgent': return textOverlayAgentPrompt;
    case 'musicDirectionAgent': return musicDirectionAgentPrompt;
    case 'captionAgent': return captionAgentPrompt;
    case 'compositionAgent': return compositionAgentPrompt;
    default: throw new Error(`Unknown composition agent: ${agent}`);
  }
}

// ─── Input builders ──────────────────────────────────────────────────────────

function buildTextOverlayInput(inputs: CompositionInputs, ctx: ProjectContext): string {
  return JSON.stringify({
    videoTimeline: {
      segments: inputs.videoSegments,
      totalDuration: inputs.totalDuration,
      aspectRatio: inputs.aspectRatio,
    },
    textInstructions: inputs.textInstructions || 'Generate appropriate title and end card',
    title: inputs.title,
    brand: ctx.brand ? { name: ctx.brand.name, colour: inputs.brandColour } : undefined,
  });
}

function buildMusicInput(inputs: CompositionInputs, ctx: ProjectContext): string {
  return JSON.stringify({
    videoTimeline: {
      segments: inputs.videoSegments,
      totalDuration: inputs.totalDuration,
    },
    musicUrl: inputs.musicUrl || null,
    hasVoiceover: !!inputs.voiceoverUrl,
    brand: ctx.brand ? { name: ctx.brand.name, tone: 'professional' } : undefined,
  });
}

function buildCaptionInput(inputs: CompositionInputs): string {
  return JSON.stringify({
    videoTimeline: {
      segments: inputs.videoSegments,
      totalDuration: inputs.totalDuration,
    },
    voiceoverTranscript: inputs.voiceoverTranscript || null,
    mode: inputs.voiceoverTranscript ? 'TRANSCRIPT' : 'DESCRIPTIVE',
  });
}

function buildCompositionInput(
  inputs: CompositionInputs,
  textOverlays: unknown,
  musicDirection: unknown,
  captions: unknown,
): string {
  return JSON.stringify({
    videoSegments: inputs.videoSegments,
    totalDuration: inputs.totalDuration,
    aspectRatio: inputs.aspectRatio,
    transition: inputs.transition || 'fade',
    textOverlays,
    musicDirection,
    musicUrl: inputs.musicUrl || null,
    captions,
    voiceoverUrl: inputs.voiceoverUrl || null,
    brandingOverlayUrl: inputs.brandingOverlayUrl || null,
    outputFormat: {
      format: 'mp4',
      resolution: '1080',
      aspectRatio: inputs.aspectRatio,
      fps: 25,
      quality: 'high',
    },
  });
}

// ─── Orchestrator factory ────────────────────────────────────────────────────

export function createCompositionOrchestrator(inputs: CompositionInputs): Orchestrator {
  const steps = createSteps();

  // Accumulated outputs from each agent
  let textOverlaysOutput: unknown = null;
  let musicDirectionOutput: unknown = null;
  let captionsOutput: unknown = null;

  async function executeStep(
    step: PipelineStep,
    ctx: ProjectContext,
    config?: OrchestratorConfig,
  ): Promise<void> {
    step.status = 'running';
    config?.onProgress?.(`Running ${step.name}...`, step);

    try {
      let userMessage: string;

      switch (step.id) {
        case 'text-overlays':
          userMessage = buildTextOverlayInput(inputs, ctx);
          break;
        case 'music-direction':
          userMessage = buildMusicInput(inputs, ctx);
          break;
        case 'captions':
          userMessage = buildCaptionInput(inputs);
          break;
        case 'composition':
          userMessage = buildCompositionInput(inputs, textOverlaysOutput, musicDirectionOutput, captionsOutput);
          break;
        default:
          throw new Error(`Unknown step: ${step.id}`);
      }

      const result = await runAgent({
        agentPrompt: getAgentPrompt(step.agent),
        userMessage,
        provider: config?.provider,
        model: config?.model,
        apiKey: config?.apiKey,
        temperature: config?.temperature ?? 0.7,
      });

      step.output = result.data;
      step.status = 'completed';

      // Store outputs for downstream agents
      switch (step.id) {
        case 'text-overlays': textOverlaysOutput = result.data; break;
        case 'music-direction': musicDirectionOutput = result.data; break;
        case 'captions': captionsOutput = result.data; break;
        case 'composition':
          // Store the final Shotstack Edit JSON in context
          if (!ctx.editing) ctx.editing = {};
          (ctx.editing as any).composition = result.data;
          break;
      }

      config?.onStepComplete?.(step, ctx);

      // Review gate
      if (step.requiresReview && config?.onReviewNeeded) {
        const approved = await config.onReviewNeeded(step, ctx);
        if (!approved) {
          step.status = 'paused';
          return;
        }
      }
    } catch (err: any) {
      step.status = 'failed';
      step.error = err.message;
      throw err;
    }
  }

  return {
    name: 'Composition',
    steps,

    async run(ctx: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      for (const step of steps) {
        if (step.status === 'completed' || step.status === 'skipped') continue;
        await executeStep(step, ctx, config);
        if (step.status === 'paused') break;
      }
      return ctx;
    },

    async runStep(stepId: string, ctx: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      const step = steps.find(s => s.id === stepId);
      if (!step) throw new Error(`Step not found: ${stepId}`);
      await executeStep(step, ctx, config);
      return ctx;
    },
  };
}
