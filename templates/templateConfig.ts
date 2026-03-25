/**
 * Template Configuration System
 *
 * Templates are "job specs" — blueprints that select and sequence
 * teams (persistent agent resources) for a specific content type.
 *
 * The construction site model:
 * - Teams are resources (electricians, carpenters, bricklayers)
 * - Templates are project briefs that pull from the shared pool
 * - Specialists are scheduled, not duplicated
 */

// ─── Team identifiers ────────────────────────────────────────────────────────

export type TeamId =
  | 'research'
  | 'production'
  | 'video-assembly'
  | 'image-assembly'
  | 'distribution';

// ─── Agent identifiers (every agent in the system) ───────────────────────────

export type AgentId =
  // Research Team
  | 'audience-research'
  | 'brand-voice-research'
  | 'competitive-trend-research'
  | 'social-media-trend-research'
  | 'deep-research'
  | 'general-analysis'
  // Production Team — Creative Director
  | 'creative-director'
  | 'concept-creation'
  | 'screenplay'
  // Production Team — Asset Producers
  | 'copywriter'
  | 'tagline'
  | 'social-copy'
  | 'image-producer'
  | 'character-builder'
  | 'character-frames'
  | 'character-variations'
  | 'video-producer'
  | 'video-from-keyframes'
  | 'video-from-prompt'
  | 'video-from-start-image'
  | 'video-from-motion-reference'
  | 'video-stitching'
  | 'music-generation'
  // Production Team — QA
  | 'qa-consistency'
  // Video Assembly Team
  | 'text-overlay'
  | 'music-direction'
  | 'caption'
  | 'composition'          // Shotstack Edit JSON builder
  | 'shotstack-render'     // Shotstack rendering service
  | 'video-editing'
  | 'voiceover'
  | 'sound-sync'
  | 'translator'
  | 'cultural-reviewer'
  | 'subtitles-hooks'
  | 'thumbnail'
  | 'video-assembly-reviewer'
  // Image Assembly Team
  | 'image-frame-adjustments'
  | 'image-copy-research'
  | 'image-assembly'
  | 'image-assembly-reviewer'
  // Distribution Team
  | 'posting'
  | 'scheduling';

// ─── Team activation config ──────────────────────────────────────────────────

export interface TeamActivation {
  teamId: TeamId;
  /** Which agents within this team to activate. Empty array = skip team entirely. */
  agents: AgentId[];
  /** Execution order within the team (agents run in this sequence) */
  sequence?: AgentId[];
  /** Agents that can run in parallel (within the same team) */
  parallel?: AgentId[][];
  /** Team-specific parameters */
  params?: Record<string, unknown>;
  /** Notes explaining why certain agents are included/excluded */
  notes?: string;
}

// ─── Pipeline step definition ────────────────────────────────────────────────

export interface TemplateStep {
  /** Step number (display order) */
  order: number;
  /** Human-readable step name */
  name: string;
  /** Which team handles this step */
  teamId: TeamId;
  /** Which agents within the team are activated for this step */
  agents: AgentId[];
  /** Whether user must review output before proceeding */
  requiresReview: boolean;
  /** Description of what happens in this step */
  description: string;
  /** Step-specific parameters passed to the orchestrator */
  params?: Record<string, unknown>;
}

// ─── Full template configuration ─────────────────────────────────────────────

export interface TemplateConfig {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this template produces */
  description: string;
  /** Font Awesome icon class */
  icon: string;
  /** Category for grouping in the UI */
  category: 'marketing' | 'training' | 'social' | 'live' | 'custom';
  /** Version for tracking config changes */
  version: string;
  /** Author/creator */
  author?: string;
  /** Date last modified */
  lastModified?: string;

  /** Which teams this template activates, in pipeline order */
  teams: TeamActivation[];

  /** Ordered pipeline steps (the wizard flow the user sees) */
  steps: TemplateStep[];

  /** Default parameters for the entire template */
  defaults?: {
    /** Default AI provider */
    provider?: 'gemini' | 'claude';
    /** Default model */
    model?: string;
    /** Default aspect ratio */
    aspectRatio?: '16:9' | '9:16' | '1:1';
    /** Default video duration per segment (seconds) */
    segmentDuration?: number;
    /** Default transition type */
    transition?: string;
  };

  /** Input requirements — what the user must provide */
  inputs: {
    /** Does the user upload source images? */
    requiresSourceImages?: boolean;
    /** Minimum number of source images */
    minImages?: number;
    /** Does the user upload a reference video? */
    requiresReferenceVideo?: boolean;
    /** Does the user provide a text brief? */
    requiresBrief?: boolean;
    /** Does the user select a brand? */
    requiresBrand?: boolean;
    /** Custom input fields */
    customFields?: Array<{
      id: string;
      label: string;
      type: 'text' | 'textarea' | 'select' | 'number' | 'toggle';
      options?: string[];
      defaultValue?: string | number | boolean;
      required?: boolean;
    }>;
  };

  /** Output configuration */
  outputs: {
    /** Primary output type */
    primary: 'video' | 'image' | 'mixed';
    /** Expected deliverable formats */
    formats?: string[];
    /** Whether Shotstack composition is used for final assembly */
    usesShotstack?: boolean;
  };

  /** Tags for search/filtering */
  tags?: string[];
  /** Whether this is a built-in template (vs user-created) */
  builtIn?: boolean;
}

// ─── Template registry ───────────────────────────────────────────────────────

export type TemplateRegistry = Record<string, TemplateConfig>;
