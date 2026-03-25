/**
 * Orchestrators — the pipeline layer for TensoraxStudio.
 *
 * Each orchestrator manages a sequence of agent calls for one domain.
 * The CampaignOrchestrator chains them all together end-to-end.
 *
 * Usage:
 * ```ts
 * import { createConceptOrchestrator } from './orchestrators';
 *
 * const orchestrator = createConceptOrchestrator();
 * const result = await orchestrator.run(projectContext, {
 *   provider: 'gemini',
 *   onProgress: (msg) => console.log(msg),
 *   onReviewNeeded: async (step) => {
 *     // show step.output to user, return true to proceed
 *     return true;
 *   },
 * });
 * ```
 */

// Types
export type {
  Orchestrator,
  OrchestratorConfig,
  PipelineStep,
  ProjectContext,
  StepStatus,
  ConceptOutput,
  ScreenplayOutput,
  TaglineOutput,
  SocialCopyOutput,
  CharacterFrameOutput,
  AudienceResearchOutput,
  VoiceoverOutput,
  PostingOutput,
  SchedulingOutput,
} from './types';

// Orchestrators
export { createResearchOrchestrator } from './researchOrchestrator';
export { createConceptOrchestrator } from './conceptOrchestrator';
export { createCharacterOrchestrator } from './characterOrchestrator';
export type { CharacterOrchestratorOptions } from './characterOrchestrator';
export { createVideoOrchestrator } from './videoOrchestrator';
export type { VideoInputs } from './videoOrchestrator';
export { createEditingOrchestrator } from './editingOrchestrator';
export { createDistributionOrchestrator } from './distributionOrchestrator';
export { createCampaignOrchestrator } from './campaignOrchestrator';
export type { CampaignPhase, CampaignConfig } from './campaignOrchestrator';
export { createCompositionOrchestrator } from './compositionOrchestrator';
export type { CompositionInputs } from './compositionOrchestrator';

// Agent runner (re-export for convenience)
export { runAgent, runAgentsParallel, runAgentChain } from '../agentRunner';
export type { AIProvider, AgentRunOptions, AgentRunResult } from '../agentRunner';
