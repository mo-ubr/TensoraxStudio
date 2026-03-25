/**
 * Built-in Template Configurations
 *
 * These are the factory-shipped templates. Users can duplicate and
 * customise them, or create entirely new ones via the Template
 * Configuration Facility.
 */

import type { TemplateConfig } from './templateConfig';

// ─── 1. What If? Transformation ──────────────────────────────────────────────

export const whatIfTransformation: TemplateConfig = {
  id: 'what-if-transformation',
  name: 'What If? Transformation',
  description: 'Upload a reference video and starting image. AI extracts transformation stages, generates keyframe images for each stage, then creates video segments between them.',
  icon: 'fa-wand-magic-sparkles',
  category: 'marketing',
  version: '1.0.0',
  builtIn: true,
  tags: ['transformation', 'before-after', 'visual-effects'],

  teams: [
    {
      teamId: 'production',
      agents: ['image-producer', 'video-producer', 'video-from-keyframes', 'video-stitching'],
      notes: 'No research or creative director needed — user provides the creative direction via reference video',
    },
    {
      teamId: 'video-assembly',
      agents: ['composition', 'shotstack-render'],
      notes: 'Minimal assembly — stitch segments with optional Shotstack composition',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Settings',
      teamId: 'production',
      agents: [],
      requiresReview: false,
      description: 'Upload source image, reference video, select brand and format',
    },
    {
      order: 2,
      name: 'Analyse',
      teamId: 'production',
      agents: ['general-analysis'],
      requiresReview: true,
      description: 'AI analyses the reference video and extracts transformation stages',
    },
    {
      order: 3,
      name: 'Generate Images',
      teamId: 'production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate keyframe images for each transformation stage',
    },
    {
      order: 4,
      name: 'Generate Videos',
      teamId: 'production',
      agents: ['video-from-keyframes', 'video-stitching'],
      requiresReview: true,
      description: 'Generate video segments between keyframes, then stitch into one video',
    },
    {
      order: 5,
      name: 'Compose',
      teamId: 'video-assembly',
      agents: ['composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Final composition with overlays, music, and branding via Shotstack',
    },
  ],

  defaults: {
    aspectRatio: '9:16',
    segmentDuration: 5,
    transition: 'fade',
  },

  inputs: {
    requiresSourceImages: true,
    minImages: 1,
    requiresReferenceVideo: true,
    requiresBrand: true,
  },

  outputs: {
    primary: 'video',
    formats: ['mp4'],
    usesShotstack: true,
  },
};

// ─── 2. Video from Key Frames ────────────────────────────────────────────────

export const videoFromKeyframes: TemplateConfig = {
  id: 'video-from-keyframes',
  name: 'Video from Key Frames',
  description: 'Upload keyframe images in sequence. AI generates video segments between each pair, then stitches them into one final video.',
  icon: 'fa-images',
  category: 'marketing',
  version: '1.0.0',
  builtIn: true,
  tags: ['keyframes', 'slideshow', 'video-generation'],

  teams: [
    {
      teamId: 'production',
      agents: ['video-from-keyframes', 'video-stitching'],
      notes: 'Minimal production — user provides keyframes, we just generate video between them',
    },
    {
      teamId: 'video-assembly',
      agents: ['text-overlay', 'music-direction', 'caption', 'composition', 'shotstack-render'],
      notes: 'Full Shotstack composition pipeline for polished output',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Frames',
      teamId: 'production',
      agents: [],
      requiresReview: false,
      description: 'Upload keyframe images in the order they should appear, select format',
    },
    {
      order: 2,
      name: 'Generate Videos',
      teamId: 'production',
      agents: ['video-from-keyframes'],
      requiresReview: true,
      description: 'Generate a video segment between each consecutive pair of keyframes',
    },
    {
      order: 3,
      name: 'Stitch & Compose',
      teamId: 'video-assembly',
      agents: ['text-overlay', 'music-direction', 'caption', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Stitch segments, add overlays/music/captions, render via Shotstack',
    },
  ],

  defaults: {
    aspectRatio: '16:9',
    segmentDuration: 5,
    transition: 'fade',
  },

  inputs: {
    requiresSourceImages: true,
    minImages: 2,
    requiresBrand: false,
  },

  outputs: {
    primary: 'video',
    formats: ['mp4'],
    usesShotstack: true,
  },
};

// ─── 3. Staff Training Video ─────────────────────────────────────────────────

export const staffTrainingVideo: TemplateConfig = {
  id: 'staff-training-video',
  name: 'Staff Training Video',
  description: 'Generate training videos from POS documentation, manuals, or briefs. AI writes the script, generates visuals, adds voiceover and subtitles for multi-language subfranchise delivery.',
  icon: 'fa-graduation-cap',
  category: 'training',
  version: '1.0.0',
  builtIn: true,
  tags: ['training', 'internal', 'staff', 'onboarding', 'POS'],

  teams: [
    {
      teamId: 'research',
      agents: ['audience-research'],
      notes: 'Internal staff profile only — no competitive or social trend research needed',
    },
    {
      teamId: 'production',
      agents: [
        'creative-director', 'concept-creation', 'screenplay',
        'copywriter', 'image-producer', 'video-producer',
        'video-from-keyframes', 'video-stitching', 'qa-consistency',
      ],
      notes: 'Full creative pipeline. RAG bot can feed POS docs to Copywriter. Music optional.',
    },
    {
      teamId: 'video-assembly',
      agents: [
        'voiceover', 'translator', 'cultural-reviewer',
        'subtitles-hooks', 'text-overlay', 'composition',
        'shotstack-render', 'video-assembly-reviewer',
      ],
      notes: 'Multi-language localisation for subfranchise markets. No thumbnail needed.',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Brief & Research',
      teamId: 'research',
      agents: ['audience-research'],
      requiresReview: true,
      description: 'Define training topic, upload reference docs, research internal audience profile',
    },
    {
      order: 2,
      name: 'Script & Concept',
      teamId: 'production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter'],
      requiresReview: true,
      description: 'AI generates training script, narration, and visual concept from the brief',
    },
    {
      order: 3,
      name: 'Visuals',
      teamId: 'production',
      agents: ['image-producer', 'video-producer', 'video-from-keyframes'],
      requiresReview: true,
      description: 'Generate keyframe images and video segments illustrating each training step',
    },
    {
      order: 4,
      name: 'Quality Check',
      teamId: 'production',
      agents: ['qa-consistency'],
      requiresReview: true,
      description: 'QA agent checks all assets against brand guidelines and training accuracy',
    },
    {
      order: 5,
      name: 'Assembly & Localise',
      teamId: 'video-assembly',
      agents: ['voiceover', 'translator', 'subtitles-hooks', 'text-overlay', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add voiceover, translate for target markets, add subtitles, compose via Shotstack',
    },
    {
      order: 6,
      name: 'Final Review',
      teamId: 'video-assembly',
      agents: ['video-assembly-reviewer'],
      requiresReview: true,
      description: 'Final quality gate — review complete assembled video',
    },
  ],

  defaults: {
    provider: 'gemini',
    aspectRatio: '16:9',
    segmentDuration: 8,
    transition: 'fade',
  },

  inputs: {
    requiresBrief: true,
    requiresBrand: true,
    customFields: [
      {
        id: 'trainingTopic',
        label: 'Training Topic',
        type: 'text',
        required: true,
      },
      {
        id: 'targetLanguages',
        label: 'Target Languages',
        type: 'textarea',
        defaultValue: 'English',
        required: false,
      },
      {
        id: 'referenceDocuments',
        label: 'Reference Documents (POS manuals, SOPs)',
        type: 'textarea',
        required: false,
      },
    ],
  },

  outputs: {
    primary: 'video',
    formats: ['mp4'],
    usesShotstack: true,
  },
};

// ─── 4. Product Marketing Campaign ───────────────────────────────────────────

export const productMarketingCampaign: TemplateConfig = {
  id: 'product-marketing-campaign',
  name: 'Product Marketing Campaign',
  description: 'Full-suite campaign production: research, concept, copy, images, video, localisation, and multi-platform distribution. The complete pipeline.',
  icon: 'fa-bullhorn',
  category: 'marketing',
  version: '1.0.0',
  builtIn: true,
  tags: ['campaign', 'product', 'full-suite', 'multi-platform'],

  teams: [
    {
      teamId: 'research',
      agents: ['audience-research', 'brand-voice-research', 'competitive-trend-research', 'social-media-trend-research'],
      notes: 'Full research intelligence suite',
    },
    {
      teamId: 'production',
      agents: [
        'creative-director', 'concept-creation', 'screenplay',
        'copywriter', 'tagline', 'social-copy',
        'image-producer', 'character-builder', 'character-frames',
        'video-producer', 'video-from-keyframes', 'video-stitching',
        'music-generation', 'qa-consistency',
      ],
      notes: 'Full creative suite — all producers active',
    },
    {
      teamId: 'video-assembly',
      agents: [
        'voiceover', 'translator', 'cultural-reviewer',
        'video-editing', 'subtitles-hooks', 'thumbnail',
        'text-overlay', 'music-direction', 'caption',
        'sound-sync', 'composition', 'shotstack-render',
        'video-assembly-reviewer',
      ],
      notes: 'Full post-production pipeline',
    },
    {
      teamId: 'image-assembly',
      agents: ['image-frame-adjustments', 'image-copy-research', 'image-assembly', 'image-assembly-reviewer'],
      notes: 'Social, display, print deliverables',
    },
    {
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      notes: 'Multi-platform automated distribution',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Research',
      teamId: 'research',
      agents: ['audience-research', 'brand-voice-research', 'competitive-trend-research', 'social-media-trend-research'],
      requiresReview: true,
      description: 'Full competitive + audience intelligence gathering',
    },
    {
      order: 2,
      name: 'Concept & Copy',
      teamId: 'production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter', 'tagline', 'social-copy'],
      requiresReview: true,
      description: 'Creative concept, screenplay, taglines, and platform-specific copy',
    },
    {
      order: 3,
      name: 'Characters & Images',
      teamId: 'production',
      agents: ['image-producer', 'character-builder', 'character-frames'],
      requiresReview: true,
      description: 'Character design, keyframes, product shots, and lifestyle imagery',
    },
    {
      order: 4,
      name: 'Video Production',
      teamId: 'production',
      agents: ['video-producer', 'video-from-keyframes', 'video-stitching', 'music-generation'],
      requiresReview: true,
      description: 'Generate video segments from keyframes, produce background music',
    },
    {
      order: 5,
      name: 'Quality Gate',
      teamId: 'production',
      agents: ['qa-consistency'],
      requiresReview: true,
      description: 'QA checks all assets against brand guidelines and creative brief',
    },
    {
      order: 6,
      name: 'Video Assembly',
      teamId: 'video-assembly',
      agents: ['voiceover', 'video-editing', 'subtitles-hooks', 'text-overlay', 'music-direction', 'caption', 'sound-sync', 'composition', 'shotstack-render', 'thumbnail'],
      requiresReview: true,
      description: 'Post-production: edit, localise, subtitle, compose via Shotstack',
    },
    {
      order: 7,
      name: 'Image Assembly',
      teamId: 'image-assembly',
      agents: ['image-frame-adjustments', 'image-copy-research', 'image-assembly', 'image-assembly-reviewer'],
      requiresReview: true,
      description: 'Platform-ready images, carousels, social graphics, display ads',
    },
    {
      order: 8,
      name: 'Distribution',
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      requiresReview: true,
      description: 'Schedule and publish across all target platforms',
    },
  ],

  defaults: {
    aspectRatio: '16:9',
    segmentDuration: 5,
    transition: 'fade',
  },

  inputs: {
    requiresBrief: true,
    requiresBrand: true,
    customFields: [
      {
        id: 'productName',
        label: 'Product Name',
        type: 'text',
        required: true,
      },
      {
        id: 'campaignGoal',
        label: 'Campaign Goal',
        type: 'select',
        options: ['Brand Awareness', 'Product Launch', 'Seasonal Promotion', 'Lead Generation', 'Engagement'],
        required: true,
      },
      {
        id: 'targetPlatforms',
        label: 'Target Platforms',
        type: 'textarea',
        defaultValue: 'Instagram, TikTok, YouTube',
        required: true,
      },
    ],
  },

  outputs: {
    primary: 'mixed',
    formats: ['mp4', 'jpg', 'png'],
    usesShotstack: true,
  },
};

// ─── 5. Live Shopping Channel ────────────────────────────────────────────────

export const liveShoppingChannel: TemplateConfig = {
  id: 'live-shopping-channel',
  name: 'Live Shopping Channel',
  description: 'Virtual presenter with lip sync for live commerce streams. Real-time trend awareness, product showcase, and audience interaction.',
  icon: 'fa-tv',
  category: 'live',
  version: '1.0.0',
  builtIn: true,
  tags: ['live', 'shopping', 'virtual-presenter', 'lip-sync', 'commerce'],

  teams: [
    {
      teamId: 'research',
      agents: ['audience-research', 'social-media-trend-research'],
      notes: 'Real-time trend awareness. Brand voice pre-set, competitive not needed.',
    },
    {
      teamId: 'production',
      agents: [
        'creative-director', 'concept-creation',
        'copywriter', 'video-producer', 'qa-consistency',
      ],
      notes: 'Virtual presenter with lip sync is core. Image producer minimal.',
    },
    {
      teamId: 'video-assembly',
      agents: ['subtitles-hooks', 'sound-sync', 'composition', 'shotstack-render', 'video-assembly-reviewer'],
      notes: 'Real-time assembly. Single market so no localisation. No thumbnail.',
    },
    {
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      notes: 'Platform-specific stream setup',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Setup',
      teamId: 'research',
      agents: ['audience-research', 'social-media-trend-research'],
      requiresReview: true,
      description: 'Define products, research audience and current trends for the stream',
    },
    {
      order: 2,
      name: 'Script & Presenter',
      teamId: 'production',
      agents: ['creative-director', 'concept-creation', 'copywriter', 'video-producer'],
      requiresReview: true,
      description: 'Generate shopping script, virtual presenter video with lip sync',
    },
    {
      order: 3,
      name: 'Assembly',
      teamId: 'video-assembly',
      agents: ['subtitles-hooks', 'sound-sync', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add product overlays, hooks, compose via Shotstack',
    },
    {
      order: 4,
      name: 'Go Live',
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      requiresReview: true,
      description: 'Set up stream on target platform and schedule go-live',
    },
  ],

  defaults: {
    aspectRatio: '9:16',
    segmentDuration: 10,
    transition: 'fade',
  },

  inputs: {
    requiresBrief: true,
    requiresBrand: true,
    customFields: [
      {
        id: 'products',
        label: 'Products to Showcase',
        type: 'textarea',
        required: true,
      },
      {
        id: 'streamPlatform',
        label: 'Stream Platform',
        type: 'select',
        options: ['TikTok Shop', 'Instagram Live', 'YouTube Live', 'Facebook Live'],
        required: true,
      },
      {
        id: 'streamDuration',
        label: 'Target Duration (minutes)',
        type: 'number',
        defaultValue: 30,
        required: true,
      },
    ],
  },

  outputs: {
    primary: 'video',
    formats: ['mp4', 'stream'],
    usesShotstack: true,
  },
};

// ─── Registry of all built-in templates ──────────────────────────────────────

export const BUILT_IN_TEMPLATES: TemplateConfig[] = [
  whatIfTransformation,
  videoFromKeyframes,
  staffTrainingVideo,
  productMarketingCampaign,
  liveShoppingChannel,
];
