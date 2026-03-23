/**
 * CampaignOrchestrator — the master pipeline.
 *
 * Chains all domain orchestrators end-to-end:
 * Research → Concept → Character → Video → Editing → Distribution
 *
 * Each phase pauses for user review before proceeding to the next.
 * Can also run individual phases independently.
 */

import { createResearchOrchestrator } from './researchOrchestrator';
import { createConceptOrchestrator } from './conceptOrchestrator';
import { createCharacterOrchestrator, type CharacterOrchestratorOptions } from './characterOrchestrator';
import { createVideoOrchestrator, type VideoInputs } from './videoOrchestrator';
import { createEditingOrchestrator } from './editingOrchestrator';
import { createDistributionOrchestrator } from './distributionOrchestrator';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext } from './types';

// ─── Campaign phases ────────────────────────────────────────────────────────

export type CampaignPhase = 'research' | 'concept' | 'character' | 'video' | 'editing' | 'distribution';

export interface CampaignConfig extends OrchestratorConfig {
  /** Which phases to run. Default: all phases in order */
  phases?: CampaignPhase[];
  /** Options for the character phase (reference images) */
  characterOptions?: CharacterOrchestratorOptions;
  /** Options for the video phase (shot prompts, start images, etc.) */
  videoInputs?: VideoInputs;
  /** Callback fired between phases for user review */
  onPhaseComplete?: (phase: CampaignPhase, context: ProjectContext) => Promise<boolean>;
}

const DEFAULT_PHASES: CampaignPhase[] = ['research', 'concept', 'character', 'video', 'editing', 'distribution'];

// ─── Phase runner ───────────────────────────────────────────────────────────

async function runPhase(
  phase: CampaignPhase,
  ctx: ProjectContext,
  campaignConfig: CampaignConfig,
): Promise<ProjectContext> {
  const baseConfig: OrchestratorConfig = {
    provider: campaignConfig.provider,
    model: campaignConfig.model,
    apiKey: campaignConfig.apiKey,
    temperature: campaignConfig.temperature,
    onStepComplete: campaignConfig.onStepComplete,
    onReviewNeeded: campaignConfig.onReviewNeeded,
    onProgress: campaignConfig.onProgress,
  };

  switch (phase) {
    case 'research': {
      const orch = createResearchOrchestrator();
      return orch.run(ctx, baseConfig);
    }
    case 'concept': {
      const orch = createConceptOrchestrator();
      return orch.run(ctx, baseConfig);
    }
    case 'character': {
      const orch = createCharacterOrchestrator(campaignConfig.characterOptions);
      return orch.run(ctx, baseConfig);
    }
    case 'video': {
      // Video needs shot prompts — extract from character frames or screenplay
      const inputs = campaignConfig.videoInputs ?? extractVideoInputs(ctx);
      const orch = createVideoOrchestrator(inputs);
      return orch.run(ctx, baseConfig);
    }
    case 'editing': {
      const orch = createEditingOrchestrator();
      return orch.run(ctx, baseConfig);
    }
    case 'distribution': {
      const orch = createDistributionOrchestrator();
      return orch.run(ctx, baseConfig);
    }
  }
}

/** Extract video inputs from project context (character frames → shot prompts) */
function extractVideoInputs(ctx: ProjectContext): VideoInputs {
  const frames = ctx.characters?.frames;
  if (Array.isArray(frames) && frames.length > 0) {
    return { shotPrompts: frames as string[] };
  }

  // Fallback: extract from screenplay scenes
  const screenplay = ctx.concept?.screenplay as any;
  if (screenplay?.scenes?.length) {
    return {
      shotPrompts: screenplay.scenes.map((s: any) => s.description ?? s.subjectAction ?? ''),
    };
  }

  return { shotPrompts: ['Generate a cinematic video sequence'] };
}

// ─── Master orchestrator ────────────────────────────────────────────────────

function createCampaignSteps(phases: CampaignPhase[]): PipelineStep[] {
  return phases.map(phase => ({
    id: `phase-${phase}`,
    name: `${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`,
    agent: phase,
    status: 'pending' as const,
    requiresReview: true,
  }));
}

export function createCampaignOrchestrator(campaignConfig?: CampaignConfig): Orchestrator {
  const phases = campaignConfig?.phases ?? DEFAULT_PHASES;
  const steps = createCampaignSteps(phases);

  return {
    name: 'Campaign Orchestrator',
    steps,

    async run(context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      let ctx = { ...context };
      const mergedConfig: CampaignConfig = { ...campaignConfig, ...config };

      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const step = steps[i];

        step.status = 'running';
        mergedConfig.onProgress?.(`Starting ${phase} phase...`, step);

        try {
          ctx = await runPhase(phase, ctx, mergedConfig);
          step.status = 'completed';
          step.output = ctx[phase as keyof ProjectContext] ?? true;
          mergedConfig.onStepComplete?.(step, ctx);

          // Pause between phases for user review
          if (mergedConfig.onPhaseComplete) {
            const proceed = await mergedConfig.onPhaseComplete(phase, ctx);
            if (!proceed) {
              for (const s of steps) {
                if (s.status === 'pending') s.status = 'skipped';
              }
              break;
            }
          }
        } catch (err: any) {
          step.status = 'failed';
          step.error = err.message ?? String(err);
          throw err;
        }
      }

      return ctx;
    },

    async runStep(stepId: string, context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      const phase = stepId.replace('phase-', '') as CampaignPhase;
      if (!phases.includes(phase)) throw new Error(`Unknown phase: ${phase}`);
      const mergedConfig: CampaignConfig = { ...campaignConfig, ...config };
      return runPhase(phase, context, mergedConfig);
    },
  };
}
