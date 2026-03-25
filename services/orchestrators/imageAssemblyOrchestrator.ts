/**
 * ImageAssemblyOrchestrator — post-production for static image deliverables.
 *
 * Takes raw image assets from the Production Team and produces platform-ready
 * deliverables: social posts, display ads, carousels, print materials.
 *
 * Pipeline:
 *   imageFrameAdjustments → imageCopyResearch → imageAssembly → imageAssemblyReviewer
 */

import { runAgent } from '../agentRunner';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext } from './types';

import { imageFrameAdjustmentsAgentPrompt } from '../../prompts/imageAssembly/imageFrameAdjustmentsAgent';
import { imageCopyResearchAgentPrompt } from '../../prompts/imageAssembly/imageCopyResearchAgent';
import { imageAssemblyAgentPrompt } from '../../prompts/imageAssembly/imageAssemblyAgent';
import { imageAssemblyReviewerAgentPrompt } from '../../prompts/imageAssembly/imageAssemblyReviewerAgent';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface ImageAssemblyInputs {
  /** Source image references from the Production Team */
  sourceImages: Array<{
    imageId: string;
    description: string;
    width: number;
    height: number;
    url?: string;
  }>;
  /** Target platforms for deliverables */
  targetPlatforms: string[];
  /** Carousel groupings (optional) */
  carousels?: Array<{
    name: string;
    imageIds: string[];
  }>;
  /** Existing copy from the Copywriter (optional, used as starting point) */
  existingCopy?: Record<string, string>;
}

// ─── Pipeline steps ──────────────────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'frame-adjustments', name: 'Frame Adjustments', agent: 'imageFrameAdjustmentsAgent', status: 'pending' },
    { id: 'copy-research', name: 'Copy Research', agent: 'imageCopyResearchAgent', status: 'pending' },
    { id: 'assembly', name: 'Image Assembly', agent: 'imageAssemblyAgent', status: 'pending', requiresReview: true },
    { id: 'review', name: 'Image Review', agent: 'imageAssemblyReviewerAgent', status: 'pending', requiresReview: true },
  ];
}

function getAgentPrompt(agent: string): string {
  switch (agent) {
    case 'imageFrameAdjustmentsAgent': return imageFrameAdjustmentsAgentPrompt;
    case 'imageCopyResearchAgent': return imageCopyResearchAgentPrompt;
    case 'imageAssemblyAgent': return imageAssemblyAgentPrompt;
    case 'imageAssemblyReviewerAgent': return imageAssemblyReviewerAgentPrompt;
    default: throw new Error(`Unknown image assembly agent: ${agent}`);
  }
}

// ─── Input builders ──────────────────────────────────────────────────────────

function buildFrameAdjustmentsInput(inputs: ImageAssemblyInputs, ctx: ProjectContext): string {
  return JSON.stringify({
    sourceImages: inputs.sourceImages,
    targetPlatforms: inputs.targetPlatforms,
    brand: ctx.brand ? { name: ctx.brand.name } : undefined,
  });
}

function buildCopyResearchInput(inputs: ImageAssemblyInputs, ctx: ProjectContext, frameAdjustments: unknown): string {
  return JSON.stringify({
    imageDescriptions: inputs.sourceImages.map(img => ({
      imageId: img.imageId,
      description: img.description,
    })),
    campaignBrief: ctx.brief,
    existingCopy: inputs.existingCopy,
    brand: ctx.brand,
    targetPlatforms: inputs.targetPlatforms,
    frameAdjustments,
  });
}

function buildAssemblyInput(inputs: ImageAssemblyInputs, ctx: ProjectContext, frameAdjustments: unknown, copyResearch: unknown): string {
  return JSON.stringify({
    croppedImages: frameAdjustments,
    copy: copyResearch,
    brand: ctx.brand,
    carousels: inputs.carousels,
    targetPlatforms: inputs.targetPlatforms,
  });
}

function buildReviewInput(ctx: ProjectContext, compositions: unknown, copyResearch: unknown): string {
  return JSON.stringify({
    composedDeliverables: compositions,
    brand: ctx.brand,
    brief: ctx.brief,
    copy: copyResearch,
    targetPlatforms: ['instagram-feed', 'instagram-story', 'facebook-post', 'youtube-thumbnail'],
  });
}

// ─── Orchestrator factory ────────────────────────────────────────────────────

export function createImageAssemblyOrchestrator(inputs: ImageAssemblyInputs): Orchestrator {
  const steps = createSteps();

  let frameAdjustmentsOutput: unknown = null;
  let copyResearchOutput: unknown = null;
  let assemblyOutput: unknown = null;

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
        case 'frame-adjustments':
          userMessage = buildFrameAdjustmentsInput(inputs, ctx);
          break;
        case 'copy-research':
          userMessage = buildCopyResearchInput(inputs, ctx, frameAdjustmentsOutput);
          break;
        case 'assembly':
          userMessage = buildAssemblyInput(inputs, ctx, frameAdjustmentsOutput, copyResearchOutput);
          break;
        case 'review':
          userMessage = buildReviewInput(ctx, assemblyOutput, copyResearchOutput);
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

      switch (step.id) {
        case 'frame-adjustments': frameAdjustmentsOutput = result.data; break;
        case 'copy-research': copyResearchOutput = result.data; break;
        case 'assembly': assemblyOutput = result.data; break;
        case 'review':
          // Store in context
          if (!ctx.editing) ctx.editing = {};
          (ctx.editing as any).imageAssembly = {
            frameAdjustments: frameAdjustmentsOutput,
            copyResearch: copyResearchOutput,
            compositions: assemblyOutput,
            review: result.data,
          };
          break;
      }

      config?.onStepComplete?.(step, ctx);

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
    name: 'Image Assembly',
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
