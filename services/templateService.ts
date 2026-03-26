/**
 * TemplateService — CRUD for template configurations.
 *
 * Built-in templates ship with the app and can't be deleted (but can be
 * duplicated and customised). Custom templates are stored in localStorage
 * and can be created, edited, duplicated, and deleted.
 *
 * This is the single source of truth for "what templates exist".
 */

import type { TemplateConfig, TeamId, AgentId } from '../templates/templateConfig';
import { BUILT_IN_TEMPLATES } from '../templates/builtInTemplates';

const STORAGE_KEY = 'tensorax_custom_templates';

// ─── Agent metadata (for the UI) ────────────────────────────────────────────

export interface AgentMeta {
  id: AgentId;
  name: string;
  team: TeamId;
  description: string;
  icon: string;
}

export interface TeamMeta {
  id: TeamId;
  name: string;
  description: string;
  icon: string;
  agents: AgentMeta[];
}

/** Full catalogue of every team and agent in the system */
export const TEAM_CATALOGUE: TeamMeta[] = [
  {
    id: 'research',
    name: 'Research Team',
    description: 'Gathers intelligence before creative work begins',
    icon: 'fa-microscope',
    agents: [
      { id: 'audience-research', name: 'Audience Research', team: 'research', description: 'Analyses target demographics, buyer personas, and audience behaviour', icon: 'fa-users' },
      { id: 'brand-voice-research', name: 'Brand Voice Research', team: 'research', description: 'Establishes and validates brand tone, language, and personality', icon: 'fa-comment-dots' },
      { id: 'competitive-trend-research', name: 'Competitive Trends', team: 'research', description: 'Monitors competitor activity, market positioning, and emerging trends', icon: 'fa-chart-line' },
      { id: 'social-media-trend-research', name: 'Social Media Trends', team: 'research', description: 'Tracks platform-specific trends, hashtags, viral formats', icon: 'fa-hashtag' },
      { id: 'deep-research', name: 'Deep Research', team: 'research', description: 'Open-ended, multi-source web research beyond structured queries', icon: 'fa-magnifying-glass-plus' },
      { id: 'general-analysis', name: 'General Analysis', team: 'research', description: 'Document analysis, brief analysis, cross-domain pattern spotting', icon: 'fa-brain' },
    ],
  },
  {
    id: 'copy-production',
    name: 'Copy Production Team',
    description: 'Concepts, scripts, copy, taglines — all written creative output',
    icon: 'fa-pen-nib',
    agents: [
      { id: 'creative-director', name: 'Creative Director', team: 'copy-production', description: 'Oversees all 3 production sub-teams — receives research and brief, orchestrates creative work', icon: 'fa-wand-magic-sparkles' },
      { id: 'concept-creation', name: 'Concept Creation', team: 'copy-production', description: 'Generates creative concepts, campaign angles, content strategies', icon: 'fa-lightbulb' },
      { id: 'screenplay', name: 'Screenplay', team: 'copy-production', description: 'Writes structured screenplays with scene breakdowns', icon: 'fa-scroll' },
      { id: 'copywriter', name: 'Copywriter', team: 'copy-production', description: 'Blog posts, ad copy, social captions, product descriptions, scripts', icon: 'fa-pen-fancy' },
      { id: 'tagline', name: 'Tagline Generator', team: 'copy-production', description: 'Creates brand taglines and slogans', icon: 'fa-quote-right' },
      { id: 'social-copy', name: 'Social Copy', team: 'copy-production', description: 'Platform-specific social media copy with hashtags and CTAs', icon: 'fa-share-nodes' },
      { id: 'qa-consistency', name: 'QA / Consistency', team: 'copy-production', description: 'Reviews all assets against brand guidelines and creative brief', icon: 'fa-clipboard-check' },
      { id: 'verification', name: 'Verification Controller', team: 'copy-production', description: 'Automatic QA gate that checks agent output against the original task. Catches rewritten text, missing content, and task non-compliance. Retries with corrections if verification fails.', icon: 'fa-shield-check' },
    ],
  },
  {
    id: 'image-production',
    name: 'Image Production Team',
    description: 'Characters, keyframes, product shots — all visual asset generation',
    icon: 'fa-image',
    agents: [
      { id: 'image-producer', name: 'Image Producer', team: 'image-production', description: 'Keyframes, product shots, lifestyle imagery, thumbnails', icon: 'fa-image' },
      { id: 'character-builder', name: 'Character Builder', team: 'image-production', description: 'Visual SVG-based character trait composer', icon: 'fa-person' },
      { id: 'character-frames', name: 'Character Frames', team: 'image-production', description: 'Character scene frames and poses', icon: 'fa-people-group' },
      { id: 'character-variations', name: 'Character Variations', team: 'image-production', description: 'Wardrobe, aging, expression variations', icon: 'fa-shirt' },
      { id: 'faithful-formatter', name: 'Faithful Formatter', team: 'image-production', description: 'Exact copy-paste and layout agent. Takes provided text and a reference format, reproduces it faithfully without creative interpretation. For bills, receipts, forms, certificates, badges, labels.', icon: 'fa-copy' },
      { id: 'faithful-image-reproduction', name: 'Faithful Image Reproduction', team: 'image-production', description: 'Reproduces a reference image with only specified text replaced. No camera angles, no storyboard, no reinterpretation. Routes to image edit model (Flux Kontext) when available, or generates a precise reproduction prompt.', icon: 'fa-clone' },
    ],
  },
  {
    id: 'video-production',
    name: 'Video Production Team',
    description: 'Video generation from keyframes, prompts, images, and motion references',
    icon: 'fa-film',
    agents: [
      { id: 'video-producer', name: 'Video Producer', team: 'video-production', description: 'Video clips from keyframes, lip sync, multi-person scenes', icon: 'fa-video' },
      { id: 'video-from-keyframes', name: 'Video from Keyframes', team: 'video-production', description: 'Generate video segments between consecutive keyframe images', icon: 'fa-clapperboard' },
      { id: 'video-from-prompt', name: 'Video from Prompt', team: 'video-production', description: 'Generate video from text prompt only', icon: 'fa-spell-check' },
      { id: 'video-from-start-image', name: 'Video from Start Image', team: 'video-production', description: 'Generate video starting from a single image', icon: 'fa-play' },
      { id: 'video-from-motion-reference', name: 'Video from Motion Reference', team: 'video-production', description: 'Generate video using a motion reference', icon: 'fa-person-running' },
      { id: 'video-stitching', name: 'Video Stitching', team: 'video-production', description: 'Concatenate multiple video segments into one', icon: 'fa-link' },
      { id: 'music-generation', name: 'Music Generation', team: 'video-production', description: 'Background music, jingles, sound effects', icon: 'fa-music' },
    ],
  },
  {
    id: 'image-assembly',
    name: 'Image Assembly Team',
    description: 'Post-production for static image deliverables: social posts, display ads, carousels',
    icon: 'fa-palette',
    agents: [
      { id: 'image-frame-adjustments', name: 'Frame Adjustments', team: 'image-assembly', description: 'Crops, resizes, formats images for target platforms', icon: 'fa-expand' },
      { id: 'image-copy-research', name: 'Copy Research', team: 'image-assembly', description: 'Platform-specific copy to accompany images: captions, hashtags, CTAs', icon: 'fa-pen-to-square' },
      { id: 'image-assembly', name: 'Image Assembly', team: 'image-assembly', description: 'Composites final images: text overlays, brand elements, carousels', icon: 'fa-object-group' },
      { id: 'image-assembly-reviewer', name: 'Image Reviewer', team: 'image-assembly', description: 'Checks brand consistency, platform specs, copy accuracy', icon: 'fa-magnifying-glass' },
    ],
  },
  {
    id: 'video-assembly',
    name: 'Video Assembly Team',
    description: 'Post-production: editing, localisation, subtitling, composition via Shotstack',
    icon: 'fa-scissors',
    agents: [
      { id: 'text-overlay', name: 'Text Overlay', team: 'video-assembly', description: 'Decides what text appears on screen and when', icon: 'fa-font' },
      { id: 'music-direction', name: 'Music Direction', team: 'video-assembly', description: 'Selects and adapts music to the final edit', icon: 'fa-sliders' },
      { id: 'caption', name: 'Captions', team: 'video-assembly', description: 'Generates subtitles from voiceover transcript or descriptive', icon: 'fa-closed-captioning' },
      { id: 'composition', name: 'Composition (Shotstack)', team: 'video-assembly', description: 'Builds the Shotstack Edit JSON from all assembly inputs', icon: 'fa-layer-group' },
      { id: 'shotstack-render', name: 'Shotstack Render', team: 'video-assembly', description: 'Sends composition to Shotstack API for final video render', icon: 'fa-server' },
      { id: 'video-editing', name: 'Video Editing', team: 'video-assembly', description: 'Analyses and edits concatenated video (pacing, colour, continuity)', icon: 'fa-cut' },
      { id: 'voiceover', name: 'Voiceover', team: 'video-assembly', description: 'ElevenLabs voice generation for narration', icon: 'fa-microphone' },
      { id: 'sound-sync', name: 'Sound Sync', team: 'video-assembly', description: 'Syncs beats to scene transitions, adjusts audio levels', icon: 'fa-volume-high' },
      { id: 'translator', name: 'Translator', team: 'video-assembly', description: 'Script and copy localisation across target markets', icon: 'fa-language' },
      { id: 'cultural-reviewer', name: 'Cultural Reviewer', team: 'video-assembly', description: 'Cultural accuracy, tone, and brand alignment check', icon: 'fa-globe' },
      { id: 'subtitles-hooks', name: 'Subtitles & Hooks', team: 'video-assembly', description: 'Generates subtitles and attention hooks (text overlays, CTAs)', icon: 'fa-text-height' },
      { id: 'thumbnail', name: 'Thumbnail Generator', team: 'video-assembly', description: 'Generates thumbnail options from the final video', icon: 'fa-crop' },
      { id: 'video-assembly-reviewer', name: 'Assembly Reviewer', team: 'video-assembly', description: 'Final quality gate for the assembled video', icon: 'fa-check-double' },
    ],
  },
  {
    id: 'distribution',
    name: 'Distribution Team',
    description: 'Scheduling, posting, and channel management for finished deliverables',
    icon: 'fa-paper-plane',
    agents: [
      { id: 'posting', name: 'Posting Agent', team: 'distribution', description: 'Handles publishing content to target platforms', icon: 'fa-upload' },
      { id: 'scheduling', name: 'Scheduling Agent', team: 'distribution', description: 'Manages posting schedules, optimal timing, cross-platform coordination', icon: 'fa-calendar-check' },
    ],
  },
];

// ─── Helper: flat list of all agents ─────────────────────────────────────────

export const ALL_AGENTS: AgentMeta[] = TEAM_CATALOGUE.flatMap(t => t.agents);

export function getAgentMeta(agentId: AgentId): AgentMeta | undefined {
  return ALL_AGENTS.find(a => a.id === agentId);
}

export function getTeamMeta(teamId: TeamId): TeamMeta | undefined {
  return TEAM_CATALOGUE.find(t => t.id === teamId);
}

// ─── Custom template persistence (localStorage) ─────────────────────────────

function loadCustomTemplates(): TemplateConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: TemplateConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get all templates (built-in + custom) */
export function getAllTemplates(): TemplateConfig[] {
  return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates()];
}

/** Get a single template by ID */
export function getTemplate(id: string): TemplateConfig | undefined {
  return getAllTemplates().find(t => t.id === id);
}

/** Get only built-in templates */
export function getBuiltInTemplates(): TemplateConfig[] {
  return [...BUILT_IN_TEMPLATES];
}

/** Get only custom (user-created) templates */
export function getCustomTemplates(): TemplateConfig[] {
  return loadCustomTemplates();
}

/** Save a new custom template */
export function createTemplate(template: TemplateConfig): void {
  const existing = loadCustomTemplates();
  if (existing.some(t => t.id === template.id) || BUILT_IN_TEMPLATES.some(t => t.id === template.id)) {
    throw new Error(`Template with ID "${template.id}" already exists`);
  }
  template.builtIn = false;
  template.lastModified = new Date().toISOString();
  saveCustomTemplates([...existing, template]);
}

/** Update an existing custom template */
export function updateTemplate(id: string, updates: Partial<TemplateConfig>): void {
  const existing = loadCustomTemplates();
  const idx = existing.findIndex(t => t.id === id);
  if (idx === -1) {
    throw new Error(`Custom template "${id}" not found. Built-in templates cannot be edited directly — duplicate first.`);
  }
  existing[idx] = { ...existing[idx], ...updates, lastModified: new Date().toISOString() };
  saveCustomTemplates(existing);
}

/** Delete a custom template */
export function deleteTemplate(id: string): void {
  const existing = loadCustomTemplates();
  if (BUILT_IN_TEMPLATES.some(t => t.id === id)) {
    throw new Error('Cannot delete a built-in template');
  }
  saveCustomTemplates(existing.filter(t => t.id !== id));
}

/** Duplicate a template (built-in or custom) into a new custom template */
export function duplicateTemplate(sourceId: string, newId: string, newName: string): TemplateConfig {
  const source = getTemplate(sourceId);
  if (!source) throw new Error(`Template "${sourceId}" not found`);

  const duplicate: TemplateConfig = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    name: newName,
    builtIn: false,
    version: '1.0.0',
    lastModified: new Date().toISOString(),
    author: 'Custom',
  };

  createTemplate(duplicate);
  return duplicate;
}

/** Export a template as JSON string (for sharing) */
export function exportTemplate(id: string): string {
  const template = getTemplate(id);
  if (!template) throw new Error(`Template "${id}" not found`);
  return JSON.stringify(template, null, 2);
}

/** Import a template from JSON string */
export function importTemplate(json: string): TemplateConfig {
  const template: TemplateConfig = JSON.parse(json);
  if (!template.id || !template.name) {
    throw new Error('Invalid template JSON — missing id or name');
  }
  template.builtIn = false;
  template.lastModified = new Date().toISOString();
  createTemplate(template);
  return template;
}

/** Create a blank template scaffold for the UI */
export function createBlankTemplate(): TemplateConfig {
  return {
    id: '',
    name: '',
    description: '',
    icon: 'fa-file',
    category: 'custom',
    version: '1.0.0',
    builtIn: false,
    lastModified: new Date().toISOString(),
    teams: [],
    steps: [],
    defaults: {
      provider: 'gemini',
      aspectRatio: '16:9',
      segmentDuration: 5,
      transition: 'fade',
    },
    inputs: {},
    outputs: {
      primary: 'video',
      usesShotstack: false,
    },
    tags: [],
  };
}
