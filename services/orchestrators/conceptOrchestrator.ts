/**
 * ConceptOrchestrator — creative strategy pipeline.
 *
 * Pipeline: Brief → Concept Generation → Screenplay → Taglines → Social Copy
 *
 * The concept can be generated from:
 * - A brief (conceptFromBriefAgent)
 * - A text prompt (conceptFromPromptAgent)
 * - A sample image (conceptFromSampleImageAgent)
 * - A sample video (conceptFromSampleVideoAgent)
 *
 * After concept selection, it chains into screenplay, taglines, and social copy.
 */

import { runAgent } from '../agentRunner';
import type {
  Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext,
  ConceptOutput, ScreenplayOutput, TaglineOutput, SocialCopyOutput,
} from './types';

import { conceptFromBriefAgentPrompt } from '../../prompts/concept/conceptFromBriefAgent';
import { conceptFromPromptAgentPrompt } from '../../prompts/concept/conceptFromPromptAgent';
import { conceptFromSampleImageAgentPrompt } from '../../prompts/concept/conceptFromSampleImageAgent';
import { conceptFromSampleVideoAgentPrompt } from '../../prompts/concept/conceptFromSampleVideoAgent';
import { screenplayAgentPrompt } from '../../prompts/concept/screenplayAgent';
import { taglineAgentPrompt } from '../../prompts/concept/taglineAgent';
import { socialCopyAgentPrompt } from '../../prompts/concept/socialCopyAgent';

// ─── Concept source detection ───────────────────────────────────────────────

type ConceptSource = 'brief' | 'prompt' | 'sampleImage' | 'sampleVideo';

function detectConceptSource(ctx: ProjectContext): ConceptSource {
  if (ctx.brief?.sampleVideoUrl || ctx.brief?.sampleVideoFile) return 'sampleVideo';
  if (ctx.direction?.styleVideos?.length) return 'sampleVideo';
  // If there are reference images but no brief text, use image-based
  // Default to brief-based generation
  return 'brief';
}

function getConceptPrompt(source: ConceptSource): string {
  switch (source) {
    case 'brief': return conceptFromBriefAgentPrompt;
    case 'prompt': return conceptFromPromptAgentPrompt;
    case 'sampleImage': return conceptFromSampleImageAgentPrompt;
    case 'sampleVideo': return conceptFromSampleVideoAgentPrompt;
  }
}

// ─── Input builders ─────────────────────────────────────────────────────────

function buildConceptInput(ctx: ProjectContext): string {
  const input: Record<string, unknown> = {};

  if (ctx.brief) {
    input.brief = ctx.brief;
  }
  if (ctx.direction) {
    input.direction = {
      aim: ctx.direction.aim,
      videoType: ctx.direction.videoType,
      format: ctx.direction.format,
      duration: ctx.direction.duration,
      tone: ctx.direction.tone,
      cta: ctx.direction.cta,
      targetAudience: ctx.direction.targetAudience,
      additionalNotes: ctx.direction.additionalNotes,
    };
  }
  if (ctx.brand) {
    input.brand = {
      name: ctx.brand.name,
      typography: ctx.brand.typography,
      colour: ctx.brand.colour,
      ctas: ctx.brand.ctas,
    };
  }
  if (ctx.research) {
    input.research = ctx.research;
  }

  return JSON.stringify(input);
}

function buildScreenplayInput(ctx: ProjectContext): string {
  return JSON.stringify({
    approvedConcept: ctx.concept?.selectedConcept,
    brand: ctx.brand ? { name: ctx.brand.name, colour: ctx.brand.colour } : undefined,
    format: ctx.direction?.format ?? ctx.brief?.format,
    duration: ctx.direction?.duration ?? ctx.brief?.duration,
    tone: ctx.direction?.tone ?? ctx.brief?.tone,
  });
}

function buildTaglineInput(ctx: ProjectContext): string {
  return JSON.stringify({
    concept: ctx.concept?.selectedConcept,
    brand: ctx.brand ? { name: ctx.brand.name } : undefined,
    targetAudience: ctx.direction?.targetAudience ?? ctx.brief?.targetAudience,
  });
}

function buildSocialCopyInput(ctx: ProjectContext): string {
  return JSON.stringify({
    concept: ctx.concept?.selectedConcept,
    screenplay: ctx.concept?.screenplay,
    brand: ctx.brand ? { name: ctx.brand.name } : undefined,
    targetAudience: ctx.direction?.targetAudience ?? ctx.brief?.targetAudience,
    platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter_x', 'linkedin'],
  });
}

// ─── Pipeline steps ─────────────────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'generate-concepts', name: 'Generate Concepts', agent: 'conceptFromBrief', status: 'pending', requiresReview: true },
    { id: 'screenplay',        name: 'Write Screenplay',  agent: 'screenplay',        status: 'pending', requiresReview: true },
    { id: 'taglines',          name: 'Generate Taglines',  agent: 'tagline',           status: 'pending' },
    { id: 'social-copy',       name: 'Generate Social Copy', agent: 'socialCopy',      status: 'pending' },
  ];
}

// ─── Step executors ─────────────────────────────────────────────────────────

async function executeStep(
  step: PipelineStep,
  ctx: ProjectContext,
  config?: OrchestratorConfig,
): Promise<ProjectContext> {
  step.status = 'running';
  config?.onProgress?.(`Running: ${step.name}...`, step);

  try {
    switch (step.id) {
      case 'generate-concepts': {
        const source = detectConceptSource(ctx);
        const result = await runAgent<ConceptOutput>({
          agentPrompt: getConceptPrompt(source),
          userMessage: buildConceptInput(ctx),
          provider: config?.provider,
          model: config?.model,
          apiKey: config?.apiKey,
          temperature: config?.temperature,
        });
        ctx.concept = {
          ...ctx.concept,
          concepts: result.data,
          // Auto-select the recommended concept
          selectedConcept: result.data.concepts[result.data.recommendedConcept] ?? result.data.concepts[0],
        };
        step.output = result.data;
        break;
      }

      case 'screenplay': {
        const result = await runAgent<ScreenplayOutput>({
          agentPrompt: screenplayAgentPrompt,
          userMessage: buildScreenplayInput(ctx),
          provider: config?.provider,
          model: config?.model,
          apiKey: config?.apiKey,
        });
        ctx.concept = { ...ctx.concept, screenplay: result.data };
        step.output = result.data;
        break;
      }

      case 'taglines': {
        const result = await runAgent<TaglineOutput>({
          agentPrompt: taglineAgentPrompt,
          userMessage: buildTaglineInput(ctx),
          provider: config?.provider,
          model: config?.model,
          apiKey: config?.apiKey,
        });
        ctx.concept = { ...ctx.concept, taglines: result.data };
        step.output = result.data;
        break;
      }

      case 'social-copy': {
        const result = await runAgent<SocialCopyOutput>({
          agentPrompt: socialCopyAgentPrompt,
          userMessage: buildSocialCopyInput(ctx),
          provider: config?.provider,
          model: config?.model,
          apiKey: config?.apiKey,
        });
        ctx.concept = { ...ctx.concept, socialCopy: result.data };
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

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function createConceptOrchestrator(): Orchestrator {
  const steps = createSteps();

  return {
    name: 'Concept Orchestrator',
    steps,

    async run(context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      let ctx = { ...context };

      for (const step of steps) {
        ctx = await executeStep(step, ctx, config);

        // Pause for review if needed
        if (step.requiresReview && step.status === 'completed' && config?.onReviewNeeded) {
          const approved = await config.onReviewNeeded(step, ctx);
          if (!approved) {
            // Mark remaining steps as skipped
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
