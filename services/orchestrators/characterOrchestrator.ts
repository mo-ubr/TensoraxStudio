/**
 * CharacterOrchestrator — visual character pipeline.
 *
 * Pipeline: Screenplay → Character Analysis → Frame Generation → Variations
 *
 * Agents:
 * - characterFrameAgent: analyses reference images, produces 9-shot storyboard
 * - imageAgent: generates character designs and key visuals
 * - characterVariationAgent: pose/expression/wardrobe variations
 * - characterAgingAgent: age progression variants
 * - characterExpressionAgent: expression sheet
 * - characterWardrobeAgent: outfit changes
 * - clothingModificationAgent: edit specific clothing details
 */

import { runAgent } from '../agentRunner';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext, CharacterFrameOutput } from './types';

import { characterFrameAgentPrompt } from '../../prompts/character/characterFrameAgent';
import { imageAgentPrompt } from '../../prompts/character/imageAgent';
import { characterVariationAgentPrompt } from '../../prompts/character/characterVariationAgent';
import { characterExpressionAgentPrompt } from '../../prompts/character/characterExpressionAgent';
import { characterWardrobeAgentPrompt } from '../../prompts/character/characterWardrobeAgent';

// ─── Input builders ─────────────────────────────────────────────────────────

function buildFrameInput(ctx: ProjectContext, images?: string[]): string {
  return JSON.stringify({
    screenplay: ctx.concept?.screenplay,
    brand: ctx.brand ? { name: ctx.brand.name, colour: ctx.brand.colour } : undefined,
    characterDescriptions: ctx.concept?.selectedConcept,
    referenceImageCount: images?.length ?? 0,
  });
}

function buildVariationInput(ctx: ProjectContext): string {
  return JSON.stringify({
    characterAnalysis: ctx.characters?.analysis,
    frames: ctx.characters?.frames,
    brand: ctx.brand ? { name: ctx.brand.name } : undefined,
  });
}

// ─── Pipeline steps ─────────────────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'analyse-frames',   name: 'Analyse & Generate 9-Shot Frames', agent: 'characterFrame',     status: 'pending', requiresReview: true },
    { id: 'key-visuals',      name: 'Generate Key Visuals',              agent: 'image',              status: 'pending', requiresReview: true },
    { id: 'variations',       name: 'Character Variations',              agent: 'characterVariation', status: 'pending' },
    { id: 'expressions',      name: 'Expression Sheet',                  agent: 'characterExpression', status: 'pending' },
    { id: 'wardrobe',         name: 'Wardrobe Variants',                 agent: 'characterWardrobe',  status: 'pending' },
  ];
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export interface CharacterOrchestratorOptions {
  /** Reference images: GROUP A (character), GROUP B (clothing), GROUP C (background) */
  characterImages?: string[];
  clothingImages?: string[];
  backgroundImages?: string[];
}

export function createCharacterOrchestrator(options?: CharacterOrchestratorOptions): Orchestrator {
  const steps = createSteps();

  async function executeStep(
    step: PipelineStep,
    ctx: ProjectContext,
    config?: OrchestratorConfig,
  ): Promise<ProjectContext> {
    step.status = 'running';
    config?.onProgress?.(`Running: ${step.name}...`, step);

    try {
      const allImages = [
        ...(options?.characterImages ?? []),
        ...(options?.clothingImages ?? []),
        ...(options?.backgroundImages ?? []),
      ];

      switch (step.id) {
        case 'analyse-frames': {
          const result = await runAgent<CharacterFrameOutput>({
            agentPrompt: characterFrameAgentPrompt,
            userMessage: buildFrameInput(ctx, allImages),
            images: allImages.length > 0 ? allImages : undefined,
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
          });
          ctx.characters = {
            ...ctx.characters,
            analysis: result.data,
            frames: result.data.shots,
          };
          step.output = result.data;
          break;
        }

        case 'key-visuals': {
          const result = await runAgent({
            agentPrompt: imageAgentPrompt,
            userMessage: JSON.stringify({
              characterAnalysis: ctx.characters?.analysis,
              brand: ctx.brand ? { name: ctx.brand.name, colour: ctx.brand.colour } : undefined,
            }),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
          });
          step.output = result.data;
          break;
        }

        case 'variations': {
          const result = await runAgent({
            agentPrompt: characterVariationAgentPrompt,
            userMessage: buildVariationInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
          });
          ctx.characters = { ...ctx.characters, variations: { ...(ctx.characters?.variations ?? {}), poses: result.data } };
          step.output = result.data;
          break;
        }

        case 'expressions': {
          const result = await runAgent({
            agentPrompt: characterExpressionAgentPrompt,
            userMessage: buildVariationInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
          });
          ctx.characters = { ...ctx.characters, variations: { ...(ctx.characters?.variations ?? {}), expressions: result.data } };
          step.output = result.data;
          break;
        }

        case 'wardrobe': {
          const result = await runAgent({
            agentPrompt: characterWardrobeAgentPrompt,
            userMessage: buildVariationInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
          });
          ctx.characters = { ...ctx.characters, variations: { ...(ctx.characters?.variations ?? {}), wardrobe: result.data } };
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
    name: 'Character Orchestrator',
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
