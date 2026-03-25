/**
 * DevOrchestrator — 3-agent pipeline for building custom templates.
 *
 * Chains: Backend Dev → Frontend Dev → QA Gate
 * If QA fails, loops back to Backend Dev with feedback (max 3 retries).
 *
 * All communication between agents goes through ProjectContext.dev.
 * Agents are stateless — each invocation starts fresh with only the
 * input provided by buildInput().
 */

import { runAgent } from '../agentRunner';
import type {
  Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext,
  DevBackendOutput, DevFrontendOutput, DevQAOutput,
} from './types';

import { backendDevAgentPrompt } from '../../prompts/dev/backendDevAgent';
import { frontendDevAgentPrompt } from '../../prompts/dev/frontendDevAgent';
import { qaDevAgentPrompt } from '../../prompts/dev/qaDevAgent';

const MAX_REVISIONS = 3;

// ─── Input builders (each agent gets only what it needs) ────────────────────

function buildBackendInput(ctx: ProjectContext): string {
  return JSON.stringify({
    USER_BRIEF: ctx.dev?.userBrief || '',
    BRAND: ctx.brand ? { name: ctx.brand.name, description: ctx.brand.description } : null,
    REVISION_FEEDBACK: ctx.dev?.qaReport?.revisionFeedback || null,
    REVISION_COUNT: ctx.dev?.revisionCount || 0,
  });
}

function buildFrontendInput(ctx: ProjectContext): string {
  return JSON.stringify({
    USER_BRIEF: ctx.dev?.userBrief || '',
    BACKEND_LOGIC: ctx.dev?.backendLogic?.templateConfig || null,
  });
}

function buildQAInput(ctx: ProjectContext): string {
  return JSON.stringify({
    USER_BRIEF: ctx.dev?.userBrief || '',
    BACKEND_LOGIC: ctx.dev?.backendLogic?.templateConfig || null,
    FRONTEND_UI: {
      customFields: ctx.dev?.frontendUI?.customFields || [],
      inputs: ctx.dev?.frontendUI?.inputs || {},
    },
    REVISION_COUNT: ctx.dev?.revisionCount || 0,
  });
}

// ─── Pipeline steps ─────────────────────────────────────────────────────────

function createSteps(): PipelineStep[] {
  return [
    { id: 'backend-dev',  name: 'Backend Dev — Generate Template Logic', agent: 'backendDev',  status: 'pending', requiresReview: true },
    { id: 'frontend-dev', name: 'Frontend Dev — Generate UI Config',     agent: 'frontendDev', status: 'pending', requiresReview: true },
    { id: 'qa-dev',       name: 'QA — Validate Template',               agent: 'qaDev',       status: 'pending', requiresReview: true },
  ];
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function createDevOrchestrator(): Orchestrator {
  const steps = createSteps();

  return {
    name: 'Dev Orchestrator',
    steps,

    async run(context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      const ctx = { ...context };
      if (!ctx.dev) ctx.dev = {};

      let revisionCount = 0;

      while (revisionCount <= MAX_REVISIONS) {
        ctx.dev.revisionCount = revisionCount;

        // ── Step 1: Backend Dev ──
        const backendStep = steps[0];
        backendStep.status = 'running';
        config?.onProgress?.(`[Dev] Backend Dev generating template logic (attempt ${revisionCount + 1})...`, backendStep);

        try {
          const backendResult = await runAgent<DevBackendOutput>({
            agentPrompt: backendDevAgentPrompt,
            userMessage: buildBackendInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
            temperature: config?.temperature ?? 0.7,
          });

          ctx.dev.backendLogic = backendResult.data;
          backendStep.output = backendResult.data;
          backendStep.status = 'completed';
          config?.onStepComplete?.(backendStep, ctx);
        } catch (err: any) {
          backendStep.status = 'failed';
          backendStep.error = err?.message || 'Backend Dev agent failed';
          config?.onStepComplete?.(backendStep, ctx);
          return ctx;
        }

        // Review gate
        if (backendStep.requiresReview && config?.onReviewNeeded) {
          const proceed = await config.onReviewNeeded(backendStep, ctx);
          if (!proceed) {
            backendStep.status = 'paused';
            return ctx;
          }
        }

        // ── Step 2: Frontend Dev ──
        const frontendStep = steps[1];
        frontendStep.status = 'running';
        config?.onProgress?.('[Dev] Frontend Dev generating UI configuration...', frontendStep);

        try {
          const frontendResult = await runAgent<DevFrontendOutput>({
            agentPrompt: frontendDevAgentPrompt,
            userMessage: buildFrontendInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
            temperature: config?.temperature ?? 0.5,
          });

          ctx.dev.frontendUI = frontendResult.data;
          frontendStep.output = frontendResult.data;
          frontendStep.status = 'completed';
          config?.onStepComplete?.(frontendStep, ctx);
        } catch (err: any) {
          frontendStep.status = 'failed';
          frontendStep.error = err?.message || 'Frontend Dev agent failed';
          config?.onStepComplete?.(frontendStep, ctx);
          return ctx;
        }

        // Review gate
        if (frontendStep.requiresReview && config?.onReviewNeeded) {
          const proceed = await config.onReviewNeeded(frontendStep, ctx);
          if (!proceed) {
            frontendStep.status = 'paused';
            return ctx;
          }
        }

        // ── Step 3: QA Gate ──
        const qaStep = steps[2];
        qaStep.status = 'running';
        config?.onProgress?.('[Dev] QA validating template...', qaStep);

        try {
          const qaResult = await runAgent<DevQAOutput>({
            agentPrompt: qaDevAgentPrompt,
            userMessage: buildQAInput(ctx),
            provider: config?.provider,
            model: config?.model,
            apiKey: config?.apiKey,
            temperature: config?.temperature ?? 0.3,
          });

          ctx.dev.qaReport = qaResult.data;
          qaStep.output = qaResult.data;
          qaStep.status = 'completed';
          config?.onStepComplete?.(qaStep, ctx);
        } catch (err: any) {
          qaStep.status = 'failed';
          qaStep.error = err?.message || 'QA Dev agent failed';
          config?.onStepComplete?.(qaStep, ctx);
          return ctx;
        }

        // Review gate
        if (qaStep.requiresReview && config?.onReviewNeeded) {
          const proceed = await config.onReviewNeeded(qaStep, ctx);
          if (!proceed) {
            qaStep.status = 'paused';
            return ctx;
          }
        }

        // ── Check QA verdict ──
        if (ctx.dev.qaReport?.verdict === 'pass' || ctx.dev.qaReport?.verdict === 'pass_with_warnings') {
          config?.onProgress?.(`[Dev] Template validated — ${ctx.dev.qaReport.verdict}`, qaStep);
          break;
        }

        // QA failed — loop back to Backend Dev with feedback
        revisionCount++;
        if (revisionCount > MAX_REVISIONS) {
          config?.onProgress?.(`[Dev] Max revisions (${MAX_REVISIONS}) reached. Proceeding with warnings.`, qaStep);
          break;
        }

        config?.onProgress?.(`[Dev] QA rejected — revision ${revisionCount}/${MAX_REVISIONS}. Sending feedback to Backend Dev.`, qaStep);

        // Reset step statuses for retry
        steps[0].status = 'pending';
        steps[0].output = undefined;
        steps[1].status = 'pending';
        steps[1].output = undefined;
        steps[2].status = 'pending';
        steps[2].output = undefined;
      }

      return ctx;
    },

    async runStep(stepId: string, context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext> {
      // For the dev orchestrator, individual step re-runs aren't useful —
      // the whole pipeline should be re-run since steps depend on each other.
      // Delegate to full run.
      return this.run(context, config);
    },
  };
}
