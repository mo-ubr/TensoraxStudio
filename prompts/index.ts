/**
 * Prompts — master index for all agent prompts.
 *
 * Each agent prompt is a pure string that defines:
 * - What the agent does
 * - What inputs it expects
 * - What JSON structure it must output
 *
 * Agent prompts are model-agnostic — the AgentRunner handles provider formatting.
 */

// Shared constants
export { CONTINUITY_RULES } from './shared/continuityRules';
export { SHOT_SPECS } from './shared/shotSpecs';

// Standalone agents
export { copyAgentPrompt } from './copyAgent';
export { transformationFrameAgentPrompt } from './transformationFrameAgent';

// Research agents
export { audienceResearchAgentPrompt } from './research/audienceResearchAgent';
export { brandVoiceResearchAgentPrompt } from './research/brandVoiceResearchAgent';
export { competitiveTrendResearchAgentPrompt } from './research/competitiveTrendResearchAgent';
export { socialMediaTrendResearchAgentPrompt } from './research/socialMediaTrendResearchAgent';

// Concept agents
export { conceptFromBriefAgentPrompt } from './concept/conceptFromBriefAgent';
export { conceptFromPromptAgentPrompt } from './concept/conceptFromPromptAgent';
export { conceptFromSampleImageAgentPrompt } from './concept/conceptFromSampleImageAgent';
export { conceptFromSampleVideoAgentPrompt } from './concept/conceptFromSampleVideoAgent';
export { screenplayAgentPrompt } from './concept/screenplayAgent';
export { socialCopyAgentPrompt } from './concept/socialCopyAgent';
export { taglineAgentPrompt } from './concept/taglineAgent';

// Character agents
export { characterFrameAgentPrompt } from './character/characterFrameAgent';
export { imageAgentPrompt } from './character/imageAgent';
export { characterAgingAgentPrompt } from './character/characterAgingAgent';
export { characterExpressionAgentPrompt } from './character/characterExpressionAgent';
export { characterVariationAgentPrompt } from './character/characterVariationAgent';
export { characterWardrobeAgentPrompt } from './character/characterWardrobeAgent';
export { clothingModificationAgentPrompt } from './character/clothingModificationAgent';

// Video agents
export { videoAgentPrompt } from './Video/videoAgent';
export { videoFromPromptAgentPrompt } from './Video/videoFromPromptAgent';
export { videoFromStartImageAgentPrompt } from './Video/videoFromStartImageAgent';
export { videoFromKeyframesAgentPrompt } from './Video/videoFromKeyframesAgent';
export { videoFromMotionReferenceAgentPrompt } from './Video/videoFromMotionReferenceAgent';
export { videoFromMotionReferenceWithKeyframesAgentPrompt } from './Video/videoFromMotionReferenceWithKeyframesAgent';
export { videoFromMotionReferenceWithStartAgentPrompt } from './Video/videoFromMotionReferenceWithStartAgent';
export { videoFromPromptAndKeyframesAgentPrompt } from './Video/videoFromPromptAndKeyframesAgent';
export { videoFromPromptAndMotionAgentPrompt } from './Video/videoFromPromptAndMotionAgent';
export { videoStitchingAgentPrompt } from './Video/videoStitchingAgent';

// Editing agents
export { videoEditingAgentPrompt } from './editing/videoEditingAgent';
export { voiceoverAgentPrompt } from './editing/voiceoverAgent';
export { musicAgentPrompt } from './editing/musicAgent';
export { soundSyncAgentPrompt } from './editing/soundSyncAgent';
export { onScreenTextAgentPrompt } from './editing/onScreenTextAgent';

// Production — Faithful reproduction
export { faithfulImageReproductionAgentPrompt } from './production/faithfulImageReproductionAgent';

// Distribution agents
export { postingAgentPrompt } from './distribution/postingAgent';
export { schedulingAgentPrompt } from './distribution/schedulingAgent';
