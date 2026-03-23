/**
 * DistributionOrchestrator — publishing pipeline.
 *
 * Pipeline: Final Video → Posting Packages → Scheduling
 *
 * Generates platform-specific posting packages (copy, hashtags, SEO, thumbnails)
 * then creates an optimal publishing schedule across all platforms.
 */

import { runAgent } from '../agentRunner';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext, PostingOutput, SchedulingOutput } from './types';

import { postingAgentPrompt } from '../../prompts/distribution/postingAgent';
import { schedulingAgentPrompt } from '../../prompts/distribution/schedulingAgent';

// ─── Input builders ─────────────────────────────────────────────────────────

function buildPostingInput(ctx: ProjectContext): string {
  return JSON.stringify({
    videoAsset: {
      url: ctx.video?.stitchedUrl,
      segments: ctx.video?.segments,
    },
    campaignBrief: ctx.concept?.selectedConcept,
    socialCopy: ctx.concept?.socialCopy,
    brand: ctx.brand ? {
      name: ctx.brand.name,
      colour: ctx.brand.colour,
      ctas: ctx.brand.ctas,
    } : undefined,
    targetPlatforms: ['instagram_reels', 'tiktok', 'youtube', 'linkedin', 'facebook', 'twitter_x'],
    screenplay: ctx.concept?.screenplay,
  });
}

function buildSchedulingInput(ctx: ProjectContext): string {
  return JSON.stringify({
    postingPackages: ctx.distribution?.postingPackages,
    targetAudience: ctx.direction?.targetAudience ?? ctx.brief?.targetAudience,
    brand: ctx.brand ? { name: ctx.brand.name } : undefined,
    postingFrequency: 'burst_campaign',
    timeZones: ['Europe/London', 'Europe/Athens'],
  });
}

// ─── Pipeline steps ─────────────────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'posting-packages', name: 'Generate Posting Packages', agent: 'posting',    status: 'pending', requiresReview: true },
    { id: 'scheduling',       name: 'Create Publishing Schedule', agent: 'scheduling', status: 'pending', requiresReview: true },
  ];
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function createDistributionOrchestrator(): Orchestrator {
  const steps = createSteps();

  async function executeStep(
    step: PipelineStep,
    ctx: ProjectContext,
    config?: OrchestratorConfig,
  ): Promise<ProjectContext> {
    step.status = 'running';
    config?.onProgress?.(`Running: ${step.name}...`, step);

    try {
      switch (step.id) {
        case 'posting-packages': {
          const result = await runAgent<PostingOutput>({
            agentPrompt: postingAgentPrompt,
            userMessage: buildPostingInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
          });
          if (!ctx.distribution) ctx.distribution = {};
          ctx.distribution.postingPackages = result.data;
          step.output = result.data;
          break;
        }

        case 'scheduling': {
          const result = await runAgent<SchedulingOutput>({
            agentPrompt: schedulingAgentPrompt,
            userMessage: buildSchedulingInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
          });
          if (!ctx.distribution) ctx.distribution = {};
          ctx.distribution.schedule = result.data;
          step.output = result.data;
          break;
        }
      }

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
    name: 'Distribution Orchestrator',
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
