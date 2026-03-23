/**
 * ResearchOrchestrator — upstream intelligence gathering.
 *
 * Runs all 4 research agents in parallel:
 * - Audience Research
 * - Brand Voice Research
 * - Competitive Trend Research
 * - Social Media Trend Research
 *
 * Outputs feed into the ConceptOrchestrator as context.
 */

import { runAgentsParallel } from '../agentRunner';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext } from './types';

import { audienceResearchAgentPrompt } from '../../prompts/research/audienceResearchAgent';
import { brandVoiceResearchAgentPrompt } from '../../prompts/research/brandVoiceResearchAgent';
import { competitiveTrendResearchAgentPrompt } from '../../prompts/research/competitiveTrendResearchAgent';
import { socialMediaTrendResearchAgentPrompt } from '../../prompts/research/socialMediaTrendResearchAgent';

// ─── Input builder ──────────────────────────────────────────────────────────

function buildResearchInput(ctx: ProjectContext): string {
  return JSON.stringify({
    projectName: ctx.projectName,
    brief: ctx.brief,
    direction: ctx.direction ? {
      aim: ctx.direction.aim,
      targetAudience: ctx.direction.targetAudience,
      videoType: ctx.direction.videoType,
      tone: ctx.direction.tone,
    } : undefined,
    brand: ctx.brand ? {
      name: ctx.brand.name,
      typography: ctx.brand.typography,
      colour: ctx.brand.colour,
    } : undefined,
  });
}

// ─── Pipeline steps ─────────────────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'audience',    name: 'Audience Research',           agent: 'audienceResearch',           status: 'pending' },
    { id: 'brand-voice', name: 'Brand Voice Research',        agent: 'brandVoiceResearch',         status: 'pending' },
    { id: 'competitive', name: 'Competitive Trend Research',  agent: 'competitiveTrendResearch',   status: 'pending' },
    { id: 'social',      name: 'Social Media Trend Research', agent: 'socialMediaTrendResearch',   status: 'pending' },
  ];
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function createResearchOrchestrator(): Orchestrator {
  const steps = createSteps();

  return {
    name: 'Research Orchestrator',
    steps,

    async run(context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      const ctx = { ...context };
      const input = buildResearchInput(ctx);

      // Mark all as running
      for (const step of steps) {
        step.status = 'running';
      }
      config?.onProgress?.('Running all research agents in parallel...', steps[0]);

      const agents = [
        { prompt: audienceResearchAgentPrompt,           stepId: 'audience' },
        { prompt: brandVoiceResearchAgentPrompt,         stepId: 'brand-voice' },
        { prompt: competitiveTrendResearchAgentPrompt,   stepId: 'competitive' },
        { prompt: socialMediaTrendResearchAgentPrompt,   stepId: 'social' },
      ];

      try {
        const results = await runAgentsParallel(
          agents.map(a => ({
            agentPrompt: a.prompt,
            userMessage: input,
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
            temperature: config?.temperature,
          }))
        );

        // Map results back to steps and context
        ctx.research = {
          audience: results[0].data,
          brandVoice: results[1].data,
          competitiveTrends: results[2].data,
          socialTrends: results[3].data,
        };

        for (let i = 0; i < agents.length; i++) {
          const step = steps.find(s => s.id === agents[i].stepId)!;
          step.output = results[i].data;
          step.status = 'completed';
          config?.onStepComplete?.(step, ctx);
        }
      } catch (err: any) {
        // Mark failed steps
        for (const step of steps) {
          if (step.status === 'running') {
            step.status = 'failed';
            step.error = err.message ?? String(err);
          }
        }
        throw err;
      }

      return ctx;
    },

    async runStep(stepId: string, context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      const step = steps.find(s => s.id === stepId);
      if (!step) throw new Error(`Unknown step: ${stepId}`);

      const ctx = { ...context };
      const input = buildResearchInput(ctx);

      const promptMap: Record<string, string> = {
        'audience': audienceResearchAgentPrompt,
        'brand-voice': brandVoiceResearchAgentPrompt,
        'competitive': competitiveTrendResearchAgentPrompt,
        'social': socialMediaTrendResearchAgentPrompt,
      };

      step.status = 'running';
      config?.onProgress?.(`Running: ${step.name}...`, step);

      try {
        const result = await runAgent({
          agentPrompt: promptMap[stepId],
          userMessage: input,
          provider: config?.provider,
          model: config?.model,
          apiKey: config?.apiKey,
        });

        step.output = result.data;
        step.status = 'completed';

        // Update the right research slot
        if (!ctx.research) ctx.research = {};
        const keyMap: Record<string, keyof NonNullable<ProjectContext['research']>> = {
          'audience': 'audience',
          'brand-voice': 'brandVoice',
          'competitive': 'competitiveTrends',
          'social': 'socialTrends',
        };
        (ctx.research as any)[keyMap[stepId]] = result.data;
        config?.onStepComplete?.(step, ctx);
      } catch (err: any) {
        step.status = 'failed';
        step.error = err.message ?? String(err);
        throw err;
      }

      return ctx;
    },
  };
}
