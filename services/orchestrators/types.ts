/**
 * Shared types for the orchestrator layer.
 *
 * Every orchestrator follows the same pattern:
 * 1. Receives a context object (project state, brand, user inputs)
 * 2. Runs one or more agents via AgentRunner
 * 3. Returns structured output + updates project state
 * 4. Can be paused between steps for user review
 */

import type { AIProvider } from '../agentRunner';
import type { BrandProfile, ProjectBrief, GeneralDirection } from '../../types';

// ─── Pipeline step status ───────────────────────────────────────────────────

export type StepStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';

export interface PipelineStep {
  id: string;
  name: string;
  agent: string;           // which agent prompt to use
  status: StepStatus;
  /** Output data from this step (JSON from agent) */
  output?: unknown;
  /** Error message if failed */
  error?: string;
  /** Whether to pause after this step for user review */
  requiresReview?: boolean;
}

// ─── Project context — the shared state bus ─────────────────────────────────

export interface ProjectContext {
  projectId: string;
  projectName: string;
  projectSlug: string;
  brief?: ProjectBrief;
  direction?: GeneralDirection;
  brand?: BrandProfile;

  /** Research outputs (from ResearchOrchestrator) */
  research?: {
    audience?: unknown;
    brandVoice?: unknown;
    competitiveTrends?: unknown;
    socialTrends?: unknown;
  };

  /** Concept outputs (from ConceptOrchestrator) */
  concept?: {
    concepts?: unknown;
    selectedConcept?: unknown;
    screenplay?: unknown;
    taglines?: unknown;
    socialCopy?: unknown;
  };

  /** Character outputs (from CharacterOrchestrator) */
  characters?: {
    analysis?: unknown;
    frames?: unknown;
    variations?: Record<string, unknown>;
  };

  /** Video outputs (from VideoOrchestrator) */
  video?: {
    segments?: unknown[];
    stitchedUrl?: string;
  };

  /** Editing outputs (from EditingOrchestrator) */
  editing?: {
    voiceover?: unknown;
    music?: unknown;
    onScreenText?: unknown;
    finalCut?: unknown;
  };

  /** Distribution outputs (from DistributionOrchestrator) */
  distribution?: {
    postingPackages?: unknown;
    schedule?: unknown;
  };
}

// ─── Orchestrator configuration ─────────────────────────────────────────────

export interface OrchestratorConfig {
  /** Default AI provider for all agents in this orchestrator */
  provider?: AIProvider;
  /** Default model override */
  model?: string;
  /** API key override */
  apiKey?: string;
  /** Temperature override */
  temperature?: number;
  /** Callback fired when a step completes */
  onStepComplete?: (step: PipelineStep, context: ProjectContext) => void;
  /** Callback fired when a step needs user review (step.requiresReview = true) */
  onReviewNeeded?: (step: PipelineStep, context: ProjectContext) => Promise<boolean>;
  /** Callback for progress updates */
  onProgress?: (message: string, step: PipelineStep) => void;
}

// ─── Base orchestrator interface ────────────────────────────────────────────

export interface Orchestrator {
  /** Human-readable name */
  name: string;
  /** The pipeline steps this orchestrator will execute */
  steps: PipelineStep[];
  /** Run the full pipeline */
  run(context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext>;
  /** Run a single step by ID (for resuming after pause) */
  runStep(stepId: string, context: ProjectContext, config?: OrchestratorConfig): Promise<ProjectContext>;
}

// ─── Agent output types (matching JSON schemas in prompts/) ─────────────────

/** Output from conceptFromBriefAgent / conceptFromPromptAgent */
export interface ConceptOutput {
  concepts: Array<{
    title: string;
    narrativeArc: string;
    emotionalHook: string;
    visualDirection: string;
    trendLeveraged?: string;
    targetEmotion?: string;
    predictedEngagement?: string;
    platformFit?: string[];
  }>;
  recommendedConcept: number;
  reasoning: string;
}

/** Output from screenplayAgent */
export interface ScreenplayOutput {
  title: string;
  totalDuration: string;
  scenes: Array<{
    sceneNumber: number;
    description: string;
    shotType: string;
    cameraMovement: string;
    subjectAction: string;
    dialogue: string;
    voiceover: string;
    duration: string;
    mood: string;
    transitionToNext: string;
  }>;
  voiceoverScript: string;
  musicDirection: string;
  brandComplianceNotes: string;
}

/** Output from taglineAgent */
export interface TaglineOutput {
  taglines: Array<{
    text: string;
    tone: string;
    platformFit: string[];
  }>;
  recommended: number;
}

/** Output from socialCopyAgent */
export interface SocialCopyOutput {
  platforms: Array<{
    platform: string;
    copy: string;
    hashtags: string[];
    characterCount: number;
  }>;
}

/** Output from characterFrameAgent */
export interface CharacterFrameOutput {
  scene: string;
  shots: string[];
}

/** Output from audienceResearchAgent */
export interface AudienceResearchOutput {
  demographics: {
    ageRange: string;
    gender: string;
    location: string;
    income: string;
  };
  psychographics: {
    interests: string[];
    values: string[];
    lifestyle: string;
    aspirations: string[];
    painPoints: string[];
  };
  mediaHabits: {
    preferredPlatforms: string[];
    peakActivityTimes: string[];
    contentPreferences: string[];
    averageSessionLength: string;
  };
  purchaseTriggers: string[];
  decisionJourney: string;
  emotionalDrivers: string[];
  communicationPreferences: string;
  recommendedApproach: string;
}

/** Output from voiceoverAgent */
export interface VoiceoverOutput {
  voiceProfile: {
    voiceId: string | null;
    model: string;
    stability: number;
    similarityBoost: number;
    style: number;
    language: string;
  };
  voiceoverBlocks: Array<{
    blockId: string;
    sequenceRef: string | null;
    text: string;
    ssmlText: string;
    deliveryDirection: {
      pace: string;
      toneDescriptor: string;
      emphasisWords: string[];
      pauseMarkers: unknown[];
      wordsPerMinute: number;
    };
    estimatedDuration: string;
    videoTimecodeStart: string | null;
    videoTimecodeEnd: string | null;
  }>;
  silenceGaps: Array<{
    afterBlock: string;
    duration: string;
    purpose: string;
  }>;
  totalEstimatedDuration: string;
  pronunciationGuide: Record<string, string>;
}

/** Output from postingAgent */
export interface PostingOutput {
  campaignId: string;
  videoAssetRef: string;
  platforms: Array<{
    platform: string;
    postType: string;
    copy: {
      primaryText: string;
      hashtags: string[];
      mentions: string[];
      altText: string;
    };
    seo: {
      title: string | null;
      description: string | null;
      tags: string[] | null;
      keywords: string[];
    };
    media: {
      aspectRatio: string;
      coverFrameTimecode: string;
      thumbnailSpec: string | null;
    };
    settings: {
      commentsSetting: string;
      sharingPermission: string;
      schedulingNote: string | null;
    };
    compliance: {
      disclosures: string[];
      attributions: string[];
      regionFlags: string[];
    };
    utmParams: Record<string, string> | null;
  }>;
  crossPlatformNotes: string;
}

/** Output from schedulingAgent */
export interface SchedulingOutput {
  campaignId: string;
  scheduleWindow: {
    startDate: string;
    endDate: string;
    primaryTimeZone: string;
  };
  schedule: Array<{
    scheduleId: string;
    platform: string;
    postType: string;
    publishDateTime: string;
    timeZone: string;
    postingPackageRef: string;
    contentType: 'primary' | 'teaser' | 'reminder' | 'reshare' | 'ugc_prompt';
    rationale: string;
    audienceReachEstimate: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>;
  conflicts: Array<{
    scheduleId: string;
    conflictType: string;
    description: string;
    resolution: string;
  }>;
  cadencePattern: string;
  repostSchedule: Array<{
    originalScheduleId: string;
    repostDateTime: string;
    platform: string;
    copyVariation: string;
  }>;
  analyticsCheckpoints: Array<{
    datetime: string;
    checkType: string;
    actionIfUnderperforming: string;
  }>;
  schedulingNotes: string;
}
