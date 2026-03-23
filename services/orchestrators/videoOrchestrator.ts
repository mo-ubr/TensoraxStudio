/**
 * VideoOrchestrator — video generation pipeline.
 *
 * Takes storyboard frames and routes to the correct video generation agent
 * based on available inputs:
 * - Prompt only → videoFromPromptAgent
 * - Start image → videoFromStartImageAgent
 * - Keyframes → videoFromKeyframesAgent
 * - Motion reference → videoFromMotionReferenceAgent
 * - Combinations of the above
 *
 * Then stitches segments together via videoStitchingAgent.
 */

import { runAgent } from '../agentRunner';
import type { Orchestrator, OrchestratorConfig, PipelineStep, ProjectContext } from './types';

import { videoFromPromptAgentPrompt } from '../../prompts/Video/videoFromPromptAgent';
import { videoFromStartImageAgentPrompt } from '../../prompts/Video/videoFromStartImageAgent';
import { videoFromKeyframesAgentPrompt } from '../../prompts/Video/videoFromKeyframesAgent';
import { videoFromMotionReferenceAgentPrompt } from '../../prompts/Video/videoFromMotionReferenceAgent';
import { videoFromMotionReferenceWithKeyframesAgentPrompt } from '../../prompts/Video/videoFromMotionReferenceWithKeyframesAgent';
import { videoFromMotionReferenceWithStartAgentPrompt } from '../../prompts/Video/videoFromMotionReferenceWithStartAgent';
import { videoFromPromptAndKeyframesAgentPrompt } from '../../prompts/Video/videoFromPromptAndKeyframesAgent';
import { videoFromPromptAndMotionAgentPrompt } from '../../prompts/Video/videoFromPromptAndMotionAgent';
import { videoStitchingAgentPrompt } from '../../prompts/Video/videoStitchingAgent';

// ─── Video input detection ──────────────────────────────────────────────────

export interface VideoInputs {
  /** Scene/shot prompts from the storyboard */
  shotPrompts: string[];
  /** Start frame images (one per shot) */
  startImages?: string[];
  /** End frame / keyframe images */
  keyframes?: string[];
  /** Motion reference video URL */
  motionReferenceUrl?: string;
  /** Duration per segment */
  duration?: '5s' | '10s';
}

function selectVideoAgent(inputs: VideoInputs): string {
  const hasStart = inputs.startImages && inputs.startImages.length > 0;
  const hasKeyframes = inputs.keyframes && inputs.keyframes.length > 0;
  const hasMotion = !!inputs.motionReferenceUrl;

  if (hasMotion && hasKeyframes) return videoFromMotionReferenceWithKeyframesAgentPrompt;
  if (hasMotion && hasStart) return videoFromMotionReferenceWithStartAgentPrompt;
  if (hasMotion) return videoFromMotionReferenceAgentPrompt;
  if (hasStart && hasKeyframes) return videoFromPromptAndKeyframesAgentPrompt;
  if (hasKeyframes) return videoFromKeyframesAgentPrompt;
  if (hasStart) return videoFromStartImageAgentPrompt;
  return videoFromPromptAgentPrompt;
}

// ─── Pipeline steps ─────────────────────────────────────────────────────────

function createSteps(shotCount: number): PipelineStep[] {
  const steps: PipelineStep[] = [];

  for (let i = 0; i < shotCount; i++) {
    steps.push({
      id: `video-segment-${i}`,
      name: `Generate Video Segment ${i + 1}`,
      agent: 'videoGeneration',
      status: 'pending',
    });
  }

  steps.push({
    id: 'stitch',
    name: 'Stitch Video Segments',
    agent: 'videoStitching',
    status: 'pending',
    requiresReview: true,
  });

  return steps;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function createVideoOrchestrator(inputs: VideoInputs): Orchestrator {
  const steps = createSteps(inputs.shotPrompts.length);

  async function executeStep(
    step: PipelineStep,
    ctx: ProjectContext,
    config?: OrchestratorConfig,
  ): Promise<ProjectContext> {
    step.status = 'running';
    config?.onProgress?.(`Running: ${step.name}...`, step);

    try {
      if (step.id === 'stitch') {
        // Stitch all generated segments
        const result = await runAgent({
          agentPrompt: videoStitchingAgentPrompt,
          userMessage: JSON.stringify({
            segments: ctx.video?.segments ?? [],
            totalShots: inputs.shotPrompts.length,
          }),
          provider: config?.provider,
          model: config?.model,
          apiKey: config?.apiKey,
        });
        ctx.video = { ...ctx.video, stitchedUrl: (result.data as any).finalVideoUrl };
        step.output = result.data;
      } else {
        // Generate individual segment
        const segIndex = parseInt(step.id.replace('video-segment-', ''));
        const agentPrompt = selectVideoAgent(inputs);

        const segInput: Record<string, unknown> = {
          shotPrompt: inputs.shotPrompts[segIndex],
          shotIndex: segIndex,
          duration: inputs.duration ?? '5s',
        };
        if (inputs.startImages?.[segIndex]) segInput.startImage = inputs.startImages[segIndex];
        if (inputs.keyframes?.[segIndex]) segInput.keyframe = inputs.keyframes[segIndex];
        if (inputs.motionReferenceUrl) segInput.motionReference = inputs.motionReferenceUrl;

        const images: string[] = [];
        if (inputs.startImages?.[segIndex]) images.push(inputs.startImages[segIndex]);
        if (inputs.keyframes?.[segIndex]) images.push(inputs.keyframes[segIndex]);

        const result = await runAgent({
          agentPrompt,
          userMessage: JSON.stringify(segInput),
          images: images.length > 0 ? images : undefined,
          provider: config?.provider,
          model: config?.model,
          apiKey: config?.apiKey,
        });

        if (!ctx.video) ctx.video = { segments: [] };
        if (!ctx.video.segments) ctx.video.segments = [];
        ctx.video.segments[segIndex] = result.data;
        step.output = result.data;
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
    name: 'Video Orchestrator',
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
