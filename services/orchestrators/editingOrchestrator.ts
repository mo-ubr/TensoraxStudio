/**
 * EditingOrchestrator — post-production pipeline.
 *
 * Pipeline: Video → Voiceover → Music → On-Screen Text → Sound Sync → Final Edit
 *
 * Each agent generates specifications (not actual audio/video) that are then
 * fed to their respective APIs (ElevenLabs for VO, etc.).
 */

import { runAgent } from '../agentRunner';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext, VoiceoverOutput } from './types';

import { voiceoverAgentPrompt } from '../../prompts/editing/voiceoverAgent';
import { musicAgentPrompt } from '../../prompts/editing/musicAgent';
import { onScreenTextAgentPrompt } from '../../prompts/editing/onScreenTextAgent';
import { soundSyncAgentPrompt } from '../../prompts/editing/soundSyncAgent';
import { videoEditingAgentPrompt } from '../../prompts/editing/videoEditingAgent';

// ─── Input builders ─────────────────────────────────────────────────────────

function buildVoiceoverInput(ctx: ProjectContext): string {
  return JSON.stringify({
    screenplay: ctx.concept?.screenplay,
    brand: ctx.brand ? { name: ctx.brand.name } : undefined,
    videoSegments: ctx.video?.segments,
    language: 'English',
  });
}

function buildMusicInput(ctx: ProjectContext): string {
  return JSON.stringify({
    screenplay: ctx.concept?.screenplay,
    voiceover: ctx.editing?.voiceover,
    brand: ctx.brand ? { name: ctx.brand.name } : undefined,
    totalDuration: (ctx.concept?.screenplay as any)?.totalDuration,
    tone: ctx.direction?.tone ?? ctx.brief?.tone,
  });
}

function buildOnScreenTextInput(ctx: ProjectContext): string {
  return JSON.stringify({
    screenplay: ctx.concept?.screenplay,
    taglines: ctx.concept?.taglines,
    brand: ctx.brand ? {
      name: ctx.brand.name,
      typography: ctx.brand.typography,
      colour: ctx.brand.colour,
    } : undefined,
    videoSegments: ctx.video?.segments,
  });
}

function buildSoundSyncInput(ctx: ProjectContext): string {
  return JSON.stringify({
    voiceover: ctx.editing?.voiceover,
    music: ctx.editing?.music,
    onScreenText: ctx.editing?.onScreenText,
    videoSegments: ctx.video?.segments,
    totalDuration: (ctx.concept?.screenplay as any)?.totalDuration,
  });
}

function buildFinalEditInput(ctx: ProjectContext): string {
  return JSON.stringify({
    screenplay: ctx.concept?.screenplay,
    videoSegments: ctx.video?.segments,
    stitchedVideoUrl: ctx.video?.stitchedUrl,
    voiceover: ctx.editing?.voiceover,
    music: ctx.editing?.music,
    onScreenText: ctx.editing?.onScreenText,
    soundSync: ctx.editing?.finalCut, // sound sync output informs final edit
    brand: ctx.brand ? { name: ctx.brand.name, colour: ctx.brand.colour } : undefined,
  });
}

// ─── Pipeline steps ─────────────────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'voiceover',      name: 'Generate Voiceover Spec',  agent: 'voiceover',     status: 'pending', requiresReview: true },
    { id: 'music',          name: 'Generate Music Direction',  agent: 'music',         status: 'pending' },
    { id: 'on-screen-text', name: 'Generate On-Screen Text',   agent: 'onScreenText',  status: 'pending' },
    { id: 'sound-sync',     name: 'Sound Sync Analysis',       agent: 'soundSync',     status: 'pending' },
    { id: 'final-edit',     name: 'Final Edit Assembly',       agent: 'videoEditing',  status: 'pending', requiresReview: true },
  ];
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function createEditingOrchestrator(): Orchestrator {
  const steps = createSteps();

  async function executeStep(
    step: PipelineStep,
    ctx: ProjectContext,
    config?: OrchestratorConfig,
  ): Promise<ProjectContext> {
    step.status = 'running';
    config?.onProgress?.(`Running: ${step.name}...`, step);

    try {
      const stepMap: Record<string, { prompt: string; input: string; key: keyof NonNullable<ProjectContext['editing']> }> = {
        'voiceover':      { prompt: voiceoverAgentPrompt,     input: buildVoiceoverInput(ctx),    key: 'voiceover' },
        'music':          { prompt: musicAgentPrompt,          input: buildMusicInput(ctx),         key: 'music' },
        'on-screen-text': { prompt: onScreenTextAgentPrompt,   input: buildOnScreenTextInput(ctx),  key: 'onScreenText' },
        'sound-sync':     { prompt: soundSyncAgentPrompt,      input: buildSoundSyncInput(ctx),     key: 'finalCut' },
        'final-edit':     { prompt: videoEditingAgentPrompt,   input: buildFinalEditInput(ctx),     key: 'finalCut' },
      };

      const spec = stepMap[step.id];
      if (!spec) throw new Error(`Unknown editing step: ${step.id}`);

      const result = await runAgent({
        agentPrompt: spec.prompt,
        userMessage: spec.input,
        provider: config?.provider,
        model: config?.model,
        apiKey: config?.apiKey,
      });

      if (!ctx.editing) ctx.editing = {};
      (ctx.editing as any)[spec.key] = result.data;
      step.output = result.data;
      step.status = 'completed';
      config?.onStepComplete?.(step, ctx);
    } catch (err: any) {
      step.status = 'failed';
      step.error = err.message ?? String(err);
      throw err;
    }

    return ctx;
  }

  return {
    name: 'Editing Orchestrator',
    steps,

    async run(context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      let ctx = { ...context };

      for (const step of steps) {
        ctx = await executeStep(step, ctx, config);

        if (step.requiresReview && step.status === 'completed' && config?.onReviewNeeded) {
          const approved = await config.onReviewNeeded(step, ctx);
          if (!approved) {
            for (const s of steps) {
              if (s.status === 'pending') s.status = 'skipped';
            }
            break;
          }
        }
      }

      return ctx;
    },

    async runStep(stepId: string, context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      const step = steps.find(s => s.id === stepId);
      if (!step) throw new Error(`Unknown step: ${stepId}`);
      return executeStep(step, context, config);
    },
  };
}
