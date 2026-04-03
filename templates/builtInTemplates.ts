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
      teamId: 'research',
      agents: ['general-analysis'],
      notes: 'General analysis agent used to extract transformation stages from reference video',
    },
    {
      teamId: 'image-production',
      agents: ['image-producer'],
      notes: 'No creative director needed — user provides the creative direction via reference video',
    },
    {
      teamId: 'video-production',
      agents: ['video-producer', 'video-from-keyframes', 'video-stitching'],
      notes: 'Generate video segments from keyframes and stitch',
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
      teamId: 'image-production',
      agents: [],
      requiresReview: false,
      description: 'Upload source image, reference video, select brand and format',
    },
    {
      order: 2,
      name: 'Analyse',
      teamId: 'research',
      agents: ['general-analysis'],
      requiresReview: true,
      description: 'AI analyses the reference video and extracts transformation stages',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Generate Images',
      teamId: 'image-production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate keyframe images for each transformation stage',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Generate Videos',
      teamId: 'video-production',
      agents: ['video-from-keyframes', 'video-stitching'],
      requiresReview: true,
      description: 'Generate video segments between keyframes, then stitch into one video',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Compose',
      teamId: 'video-assembly',
      agents: ['composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Final composition with overlays, music, and branding via Shotstack',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
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
      teamId: 'video-production',
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
      teamId: 'video-production',
      agents: [],
      requiresReview: false,
      description: 'Upload keyframe images in the order they should appear, select format',
    },
    {
      order: 2,
      name: 'Generate Videos',
      teamId: 'video-production',
      agents: ['video-from-keyframes', 'video-stitching'],
      requiresReview: true,
      description: 'Generate video segments between keyframes, then stitch into one continuous video',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Compose',
      teamId: 'video-assembly',
      agents: ['text-overlay', 'music-direction', 'caption', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add overlays, music, captions, and render via Shotstack',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
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
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter', 'qa-consistency'],
      notes: 'Creative Director oversees all sub-teams. RAG bot can feed POS docs to Copywriter.',
    },
    {
      teamId: 'image-production',
      agents: ['image-producer'],
      notes: 'Keyframe generation for training visuals',
    },
    {
      teamId: 'video-production',
      agents: ['video-producer', 'video-from-keyframes', 'video-stitching'],
      notes: 'Video segments from keyframes. Music optional.',
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
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 2,
      name: 'Script & Concept',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter'],
      requiresReview: true,
      description: 'AI generates training script, narration, and visual concept from the brief',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Images',
      teamId: 'image-production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate keyframe images illustrating each training step',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Video Segments',
      teamId: 'video-production',
      agents: ['video-producer', 'video-from-keyframes'],
      requiresReview: true,
      description: 'Generate video segments from keyframe images',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Quality Check',
      teamId: 'copy-production',
      agents: ['qa-consistency'],
      requiresReview: true,
      description: 'QA agent checks all assets against brand guidelines and training accuracy',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 6,
      name: 'Assembly & Localise',
      teamId: 'video-assembly',
      agents: ['voiceover', 'translator', 'cultural-reviewer', 'subtitles-hooks', 'text-overlay', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add voiceover, translate for target markets, cultural review, add subtitles, compose via Shotstack',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 7,
      name: 'Final Review',
      teamId: 'video-assembly',
      agents: ['video-assembly-reviewer'],
      requiresReview: true,
      description: 'Final quality gate — review complete assembled video',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
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
      agents: ['audience-research', 'brand-voice-research', 'competitive-trend-research', 'social-media-trend-research', 'deep-research'],
      parallel: [['audience-research', 'brand-voice-research', 'competitive-trend-research', 'social-media-trend-research']],
      sequence: ['audience-research', 'brand-voice-research', 'competitive-trend-research', 'social-media-trend-research', 'deep-research'],
      notes: 'Full research intelligence suite. First 4 agents run in parallel, then deep-research synthesises their outputs.',
    },
    {
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter', 'tagline', 'social-copy', 'qa-consistency'],
      notes: 'Creative Director oversees all sub-teams. Full copy suite.',
    },
    {
      teamId: 'image-production',
      agents: ['image-producer', 'character-builder', 'character-frames'],
      notes: 'Character design, keyframes, product shots',
    },
    {
      teamId: 'video-production',
      agents: ['video-producer', 'video-from-keyframes', 'video-stitching', 'music-generation'],
      notes: 'Video generation and music production',
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
      agents: ['audience-research', 'brand-voice-research', 'competitive-trend-research', 'social-media-trend-research', 'deep-research'],
      requiresReview: true,
      description: 'Full competitive + audience intelligence. 4 agents run in parallel, then deep-research synthesises.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 2,
      name: 'Concept & Copy',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter', 'tagline', 'social-copy'],
      requiresReview: true,
      description: 'Creative concept, screenplay, taglines, and platform-specific copy',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Characters & Images',
      teamId: 'image-production',
      agents: ['image-producer', 'character-builder', 'character-frames'],
      requiresReview: true,
      description: 'Character design, keyframes, product shots, and lifestyle imagery',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Video Production',
      teamId: 'video-production',
      agents: ['video-producer', 'video-from-keyframes', 'video-stitching', 'music-generation'],
      requiresReview: true,
      description: 'Generate video segments from keyframes, produce background music',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Quality Gate',
      teamId: 'copy-production',
      agents: ['qa-consistency'],
      requiresReview: true,
      description: 'QA checks all assets against brand guidelines and creative brief',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 1,
    },
    {
      order: 6,
      name: 'Video Assembly',
      teamId: 'video-assembly',
      agents: ['voiceover', 'video-editing', 'subtitles-hooks', 'text-overlay', 'music-direction', 'caption', 'sound-sync', 'composition', 'shotstack-render', 'thumbnail'],
      requiresReview: true,
      description: 'Post-production: edit, localise, subtitle, compose via Shotstack',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 7,
      name: 'Image Assembly',
      teamId: 'image-assembly',
      agents: ['image-frame-adjustments', 'image-copy-research', 'image-assembly', 'image-assembly-reviewer'],
      requiresReview: true,
      description: 'Platform-ready images, carousels, social graphics, display ads',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 8,
      name: 'Distribution',
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      requiresReview: true,
      description: 'Schedule and publish across all target platforms',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
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
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'copywriter', 'qa-consistency'],
      notes: 'Creative Director oversees. Shopping script and presenter dialogue.',
    },
    {
      teamId: 'video-production',
      agents: ['video-producer'],
      notes: 'Virtual presenter with lip sync is core.',
    },
    {
      teamId: 'video-assembly',
      agents: ['subtitles-hooks', 'sound-sync', 'composition', 'shotstack-render', 'video-assembly-reviewer'],
      notes: 'Real-time assembly. Single market so no localisation. No thumbnail.',
    },
    {
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      notes: 'Platform-specific stream setup. Aspect ratio adapts to platform (9:16 for TikTok, 16:9 for YouTube/Facebook).',
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
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 2,
      name: 'Script',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'copywriter'],
      requiresReview: true,
      description: 'Generate shopping script and presenter dialogue',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Virtual Presenter',
      teamId: 'video-production',
      agents: ['video-producer'],
      requiresReview: true,
      description: 'Generate virtual presenter video with lip sync',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Assembly',
      teamId: 'video-assembly',
      agents: ['subtitles-hooks', 'sound-sync', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add product overlays, hooks, compose via Shotstack',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Go Live',
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      requiresReview: true,
      description: 'Set up stream on target platform and schedule go-live',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
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

// ─── 6. 9 Camera Angle Frames ────────────────────────────────────────────────

export const nineCameraAngleFrames: TemplateConfig = {
  id: '9-camera-angle-frames',
  name: '9 Camera Angle Frames',
  description: 'Upload character, outfit, and background reference images. AI analyses them and generates 9 cinematic camera angle frames (ELS, LS, MLS, MS, MCU, CU, ECU, Low Angle, High Angle). Supports multiple outfits (apparel collection mode) and multiple locations (film mode).',
  icon: 'fa-clapperboard',
  category: 'marketing',
  version: '2.0.0',
  builtIn: true,
  tags: ['9-shot', 'storyboard', 'camera-angles', 'keyframes', 'character', 'apparel', 'lookbook', 'film'],

  teams: [
    {
      teamId: 'research',
      agents: ['general-analysis'],
      notes: 'Analyses reference images (character, clothing, background) into structured descriptions',
    },
    {
      teamId: 'image-production',
      agents: ['image-producer', 'character-builder', 'character-frames', 'character-variations'],
      notes: 'character-builder extracts character profile, character-frames generates 9-angle prompts, character-variations handles outfit-only standalone shots, image-producer renders all frames',
    },
    {
      teamId: 'copy-production',
      agents: ['qa-consistency'],
      notes: 'QA checks visual consistency across all generated frames',
    },
  ],

  steps: [
    // ── Step 1: Upload Character ──
    {
      order: 1,
      name: 'Upload Character',
      teamId: 'image-production',
      agents: [],
      requiresReview: false,
      description: 'Upload reference images of your character — face, body, distinctive features',
      stepInputs: [
        {
          id: 'characterImages',
          label: 'Character Reference Images',
          type: 'upload-images',
          required: true,
          multiple: true,
          min: 1,
          accept: 'image/*',
          placeholder: 'Upload at least one clear photo of your character',
        },
      ],
      moGuidance: {
        instructions: 'Upload clear reference images of your character. I need to see who this person is — their face, body type, and any distinctive features.',
        checklist: [
          'At least one clear full-body shot',
          'Face clearly visible (not obscured or in shadow)',
          'Good lighting — avoid harsh shadows or backlight',
          'Neutral or simple background preferred',
        ],
        validationPrompt: 'Analyse these character reference images. Check: (1) Is a face clearly visible? (2) Is the full body shown in at least one image? (3) Is the lighting adequate to distinguish features? (4) Are there any quality issues (blur, low resolution, heavy filters)? Rate each image and give specific feedback.',
        approvalCriteria: [
          'At least 1 image uploaded',
          'Face clearly visible in at least 1 image',
          'Resolution adequate (≥512px on shortest side)',
        ],
        nextStepTip: 'Great character references! Next we\'ll add the outfits — you can upload multiple if you want to showcase a collection.',
      },
    },

    // ── Step 2: Upload Outfits ──
    {
      order: 2,
      name: 'Upload Outfits',
      teamId: 'image-production',
      agents: [],
      requiresReview: false,
      description: 'Upload outfit/wardrobe reference images. Multiple outfits = apparel collection mode. Toggle "outfit standalone" for garment-only shots.',
      stepInputs: [
        {
          id: 'outfitImages',
          label: 'Outfit / Wardrobe Reference Images',
          type: 'upload-images',
          required: true,
          multiple: true,
          min: 1,
          accept: 'image/*',
          placeholder: 'Upload one or more outfit references — group shots by outfit',
        },
        {
          id: 'outfitStandalone',
          label: 'Generate outfit-only shots (no character)',
          type: 'toggle',
          required: false,
          placeholder: 'Creates additional flat-lay / ghost mannequin / styled product shots for each outfit',
        },
      ],
      moGuidance: {
        instructions: 'Upload reference images for each outfit. If you\'re showcasing a collection, upload multiple outfits — I\'ll generate 9 camera angles for each one.\n\nTip: Turn on "outfit standalone" to also get product-only shots (flat lay, ghost mannequin style) — perfect for lookbooks and e-commerce.',
        checklist: [
          'Each outfit clearly visible (full garment, not cropped)',
          'Colours accurate (no heavy filters that distort colours)',
          'If multiple outfits, try to separate them clearly',
          'Include accessories if they\'re part of the look',
        ],
        validationPrompt: 'Analyse these outfit/wardrobe reference images. Check: (1) How many distinct outfits can you identify? List each one. (2) Is each outfit fully visible (not cropped or obscured)? (3) Are colours accurate or heavily filtered? (4) Any accessories visible? Describe each outfit briefly.',
        approvalCriteria: [
          'At least 1 outfit clearly shown',
          'Garment not heavily cropped or obscured',
        ],
        nextStepTip: 'Outfits locked in! Next: backgrounds and locations. Upload multiple to create a "film journey" through different spaces.',
      },
    },

    // ── Step 3: Upload Locations ──
    {
      order: 3,
      name: 'Upload Locations',
      teamId: 'image-production',
      agents: [],
      requiresReview: false,
      description: 'Upload background/location reference images. Multiple locations = film mode (character moves through different spaces like scenes in a film).',
      stepInputs: [
        {
          id: 'backgroundImages',
          label: 'Background / Location Reference Images',
          type: 'upload-images',
          required: true,
          multiple: true,
          min: 1,
          accept: 'image/*',
          placeholder: 'Upload one or more location/background references',
        },
        {
          id: 'filmMode',
          label: 'Film mode — character in multiple locations',
          type: 'toggle',
          required: false,
          placeholder: 'Generates a full set of 9 camera angles at EACH location, like scenes in a film',
        },
        {
          id: 'sceneDescription',
          label: 'Scene Description (optional)',
          type: 'text',
          required: false,
          placeholder: 'E.g. "Luxury apartment in Athens, warm afternoon light, modern minimalist interior"',
        },
      ],
      moGuidance: {
        instructions: 'Upload background/location images. This sets the stage for your character.\n\n🎬 Film Mode: Upload multiple locations (living room, kitchen, street, studio…) and I\'ll generate all 9 camera angles at each location — like scenes in a film.\n\n📍 Single location: Upload one background and I\'ll keep all frames consistent.',
        checklist: [
          'Background clearly shows the space/environment',
          'Good depth — avoid flat walls with no context',
          'Lighting style matches your creative vision',
          'If multiple locations, each should be distinctly different',
        ],
        validationPrompt: 'Analyse these background/location reference images. Check: (1) How many distinct locations can you identify? Describe each. (2) Is each location suitable as a backdrop for fashion/character photography? (3) Are there lighting or perspective issues? (4) Do the locations have enough depth and visual interest? Rate each location.',
        approvalCriteria: [
          'At least 1 location clearly shown',
          'Location suitable for character photography',
        ],
        nextStepTip: 'All references uploaded! Now I\'ll analyse everything — character, outfits, and locations — to build a detailed description for the frame generator.',
      },
    },

    // ── Step 4: Analyse Everything ──
    {
      order: 4,
      name: 'Analyse References',
      teamId: 'research',
      agents: ['general-analysis'],
      requiresReview: true,
      description: 'AI analyses all uploaded references — character traits, outfit details, location descriptions — into structured profiles',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
      moGuidance: {
        instructions: 'I\'m studying all your reference images now. I\'ll build a detailed profile of:\n\n👤 Character — face shape, skin tone, build, hair, distinctive features\n👗 Each outfit — garment type, colours, fabric, styling details\n🏠 Each location — space type, lighting, mood, key elements\n\nThis takes a moment...',
        validationPrompt: 'Review the AI analysis output. Check: (1) Does the character description match the uploaded images? (2) Are all outfits described accurately? (3) Are all locations described? (4) Are there any obvious errors or missing details? Suggest corrections if needed.',
        approvalCriteria: [
          'Character description matches uploaded images',
          'All outfits identified and described',
          'All locations identified and described',
        ],
        nextStepTip: 'Analysis looks good! Check that I\'ve described everything accurately — edit anything that\'s off before we generate the prompts.',
      },
    },

    // ── Step 5: Generate Prompts ──
    {
      order: 5,
      name: 'Generate Prompts',
      teamId: 'image-production',
      agents: ['character-frames', 'character-variations'],
      requiresReview: true,
      description: 'Generate image prompts: 9 camera angles × outfits × locations, plus optional outfit-only standalone shots',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
      moGuidance: {
        instructions: 'I\'m creating the image generation prompts now. For each combination of outfit + location, I\'ll write 9 camera angle prompts:\n\n📐 ELS → ECU (Extreme Long Shot to Extreme Close-Up)\n📸 Low Angle + High Angle\n\nIf you enabled outfit standalone, I\'ll also create flat-lay and styled product prompts for each outfit.',
        validationPrompt: 'Review the generated prompts. Check: (1) Do all 9 camera angles follow the correct cinematic conventions (ELS, LS, MLS, MS, MCU, CU, ECU, Low Angle, High Angle)? (2) Is the character description consistent across all prompts? (3) Are outfit details accurate per prompt set? (4) Are location details accurate per prompt set? (5) If outfit standalone prompts exist, are they well-suited for product photography?',
        approvalCriteria: [
          'All 9 camera angles present per outfit×location combo',
          'Character description consistent across prompts',
          'Outfit and location details accurate',
        ],
        nextStepTip: 'Prompts ready! Review them — you can edit any prompt text before we generate. Next step fires up the image generator.',
      },
    },

    // ── Step 6: Generate Frames ──
    {
      order: 6,
      name: 'Generate Frames',
      teamId: 'image-production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate all camera angle images from the approved prompts',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
      moGuidance: {
        instructions: 'Generating all frames now. This may take a while depending on how many outfit×location combinations you have.\n\nI\'ll show each frame as it completes so you can spot issues early.',
        validationPrompt: 'Review the generated frames. For each frame check: (1) Does the character match the reference? (2) Is the outfit correct for this set? (3) Is the background/location correct? (4) Is the camera angle correct (ELS, LS, etc.)? (5) Overall image quality — any artifacts, distortions, or inconsistencies? Flag specific frames that need regeneration.',
        approvalCriteria: [
          'Character recognisable across all frames',
          'Correct outfit shown in each frame set',
          'Correct location shown in each frame set',
          'Camera angles correctly represented',
        ],
        nextStepTip: 'Frames generated! Click any frame to regenerate it if needed. Once you\'re happy, the final consistency check will verify everything hangs together.',
      },
    },

    // ── Step 7: Consistency Check ──
    {
      order: 7,
      name: 'Consistency Check',
      teamId: 'copy-production',
      agents: ['qa-consistency'],
      requiresReview: true,
      description: 'QA reviews all frames for character, outfit, and location consistency across the entire set',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 1,
      moGuidance: {
        instructions: 'Running the final quality check. I\'m comparing all frames to ensure:\n\n✅ Same character across every frame\n✅ Correct outfit in each set\n✅ Consistent lighting and colour palette per location\n✅ No jarring inconsistencies between camera angles',
        validationPrompt: 'Perform a comprehensive consistency review across ALL generated frames. Check: (1) Character consistency — does the same person appear in every frame? (2) Outfit consistency — is each outfit set internally consistent? (3) Location consistency — does each location set feel like the same space? (4) Cross-set coherence — do all frames feel like they belong to the same production? Score overall consistency 1-10 and list specific issues.',
        approvalCriteria: [
          'Character consistent across all frames',
          'Each outfit set internally consistent',
          'Each location set internally consistent',
          'Overall consistency score ≥ 7/10',
        ],
        nextStepTip: 'All done! Your frames are ready for video production or direct use in lookbooks, social media, and marketing materials.',
      },
    },
  ],

  defaults: {
    aspectRatio: '9:16',
  },

  inputs: {
    requiresSourceImages: true,
    minImages: 3,
    requiresBrand: false,
    customFields: [
      {
        id: 'outfitStandalone',
        label: 'Apparel Collection Mode — generate outfit-only standalone shots',
        type: 'toggle',
        defaultValue: false,
        required: false,
      },
      {
        id: 'filmMode',
        label: 'Film Mode — generate frames at each location separately',
        type: 'toggle',
        defaultValue: false,
        required: false,
      },
    ],
  },

  outputs: {
    primary: 'image',
    formats: ['jpg', 'png'],
    usesShotstack: false,
  },
};

// ─── 7. Legal Expert — Contract Review & Analysis ───────────────────────────

export const legalExpert: TemplateConfig = {
  id: 'legal-expert',
  name: 'Legal Expert',
  description: 'Upload contracts for clause-by-clause analysis, risk assessment, comparison of old vs new versions, alternative wording suggestions, and translation to EN/BG/GR with bilingual output.',
  icon: 'fa-scale-balanced',
  category: 'legal',
  domain: 'analyse',
  version: '1.0.0',
  builtIn: true,
  tags: ['legal', 'contract', 'lease', 'review', 'risk', 'translation', 'comparison', 'clauses'],

  teams: [
    {
      teamId: 'text-analysis',
      agents: ['document-summariser', 'legal-clause-analyser', 'contract-risk-assessor', 'ocr-extractor'],
      notes: 'Core legal analysis: parse document, extract clauses, assess risk. OCR for scanned contracts.',
    },
    {
      teamId: 'copy-production',
      agents: ['copywriter', 'qa-consistency'],
      notes: 'Alternative wording drafting and quality check on recommendations.',
    },
    {
      teamId: 'video-assembly',
      agents: ['translator'],
      notes: 'Legal translation between EN, BG, GR with bilingual version creation.',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator'],
      notes: 'Final analysis report generation as Word document.',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Documents',
      teamId: 'text-analysis',
      agents: [],
      requiresReview: false,
      description: 'Upload the contract(s) to review. Optionally upload an older version for comparison.',
      stepInputs: [
        {
          id: 'contractDocument',
          label: 'Contract to Review',
          type: 'upload-documents',
          required: true,
          multiple: false,
          accept: '.docx,.pdf,.doc,.txt,.md',
          placeholder: 'Upload the contract you want reviewed',
        },
        {
          id: 'previousVersion',
          label: 'Previous Version (for comparison)',
          type: 'upload-documents',
          required: false,
          multiple: false,
          accept: '.docx,.pdf,.doc,.txt,.md',
          placeholder: 'Optional: upload an older version to compare against',
        },
        {
          id: 'companyRole',
          label: 'Which party are we?',
          type: 'text',
          required: true,
          placeholder: 'e.g. "Tenant / Lessee", "Buyer", "Franchisee", "Service Provider"',
        },
        {
          id: 'targetLanguages',
          label: 'Translation languages (optional)',
          type: 'text',
          required: false,
          placeholder: 'e.g. "EN, BG" or "EN, GR" — always includes English',
        },
      ],
      moGuidance: {
        instructions: 'Upload the contract you want me to review. If you have an older version, upload that too and I\'ll do a clause-by-clause comparison.\n\nTell me which party we represent (e.g. "Tenant", "Buyer", "Franchisee") so I can analyse from our perspective.',
        checklist: [
          'Contract document uploaded (.docx, .pdf, or .doc)',
          'Our role/party identified',
          'Previous version uploaded if comparison needed',
        ],
      },
    },
    {
      order: 2,
      name: 'Parse & Extract',
      teamId: 'text-analysis',
      agents: ['document-summariser', 'legal-clause-analyser'],
      requiresReview: true,
      description: 'AI parses the contract into structured clauses, identifies parties, dates, obligations, and key terms.',
      moGuidance: {
        instructions: 'I\'m reading the contract now and extracting every clause, party, date, and obligation into a structured format.',
        approvalCriteria: [
          'All clauses identified and numbered',
          'Parties correctly identified',
          'Key dates and financial terms extracted',
        ],
      },
    },
    {
      order: 3,
      name: 'Risk Analysis',
      teamId: 'text-analysis',
      agents: ['contract-risk-assessor'],
      requiresReview: true,
      description: 'Each clause rated green/amber/red for risk. Identifies unfavourable terms, missing protections, and business impact.',
      moGuidance: {
        instructions: 'Analysing every clause from our perspective. I\'ll flag anything that\'s risky, unusual, or missing.',
        approvalCriteria: [
          'Every clause has a risk rating',
          'Red flags clearly identified',
          'Missing standard protections listed',
          'Business impact explained in plain English',
        ],
      },
    },
    {
      order: 4,
      name: 'Compare Versions',
      teamId: 'text-analysis',
      agents: ['legal-clause-analyser'],
      requiresReview: true,
      description: 'If a previous version was uploaded, compares old vs new clause-by-clause. Identifies additions, deletions, and hidden changes.',
      params: { skipIfNoPreviousVersion: true },
      moGuidance: {
        instructions: 'Comparing old and new versions clause by clause. I\'ll catch every change — including subtle wording shifts that change legal meaning.',
        approvalCriteria: [
          'All changes identified',
          'Each change classified by significance',
          'Hidden implications flagged',
        ],
      },
    },
    {
      order: 5,
      name: 'Alternative Wording',
      teamId: 'copy-production',
      agents: ['copywriter'],
      requiresReview: true,
      description: 'For each red/amber clause, suggests alternative wording that protects our interests while remaining commercially reasonable.',
      moGuidance: {
        instructions: 'Drafting alternative wording for every problematic clause. Each suggestion includes a fallback position and negotiation advice.',
        approvalCriteria: [
          'Every red/amber clause has a proposed alternative',
          'Alternatives are in the same language as the original',
          'Negotiation strategy included',
        ],
      },
    },
    {
      order: 6,
      name: 'Translation',
      teamId: 'video-assembly',
      agents: ['translator'],
      requiresReview: true,
      description: 'Translate to target languages. Creates bilingual version (always includes English). Legal terminology glossary included.',
      params: { skipIfNoTranslationRequested: true },
      moGuidance: {
        instructions: 'Translating with legal precision. I\'ll flag terms that don\'t have exact equivalents across jurisdictions.',
        approvalCriteria: [
          'Translation complete in target language(s)',
          'Bilingual version aligned clause-by-clause',
          'Terminology glossary provided',
        ],
      },
    },
    {
      order: 7,
      name: 'Final Report',
      teamId: 'document-production',
      agents: ['report-generator'],
      requiresReview: true,
      description: 'Generate a complete analysis report as a Word document with executive summary, clause analysis, red flags, recommendations, and negotiation strategy.',
      moGuidance: {
        instructions: 'Compiling everything into a single Word document you can use immediately — executive summary, full analysis, alternative wording, and negotiation strategy.',
        approvalCriteria: [
          'Word document generated',
          'Executive summary present',
          'All findings included',
          'Negotiation strategy with priorities',
        ],
      },
    },
  ],

  defaults: {
    provider: 'gemini',
  },

  inputs: {
    requiresBrief: false,
    requiresBrand: false,
  },

  outputs: {
    primary: 'document',
    formats: ['docx', 'pdf'],
    destination: 'project',
  },

  requiredTools: ['file-read', 'file-write'],
};

// ─── 8. Social Media Content Automation ──────────────────────────────────────

export const socialMediaContentAutomation: TemplateConfig = {
  id: 'social-media-content-automation',
  name: 'Social Media Content Automation',
  description: 'End-to-end social media content pipeline: analyse your YouTube channel and competitors, research trends, plan a content calendar, generate scripts and thumbnails, prepare platform-specific posting packages, and track performance.',
  icon: 'fa-share-nodes',
  category: 'marketing',
  version: '1.0.0',
  builtIn: true,
  tags: ['social-media', 'youtube', 'content-planning', 'automation', 'scheduling', 'analytics'],

  teams: [
    {
      teamId: 'research',
      agents: [
        'youtube-channel-analyser',
        'social-media-trend-research',
        'competitive-trend-research',
        'audience-research',
        'content-calendar',
        'performance-report',
      ],
      notes: 'Full research stack: channel analysis, trends, competitors, audience, calendar planning, and performance reporting',
    },
    {
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter', 'social-copy', 'tagline'],
      notes: 'Script and copy generation for each content piece in the calendar',
    },
    {
      teamId: 'image-production',
      agents: ['image-producer'],
      notes: 'Thumbnail and visual asset generation',
    },
    {
      teamId: 'video-assembly',
      agents: ['thumbnail'],
      notes: 'Thumbnail specifications for each video',
    },
    {
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      notes: 'Platform-specific posting packages and optimal scheduling',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Channel Setup',
      teamId: 'research',
      agents: [],
      requiresReview: false,
      description: 'Provide your YouTube channel URL, brand guidelines, competitor channels, and target platforms',
    },
    {
      order: 2,
      name: 'Channel Analysis',
      teamId: 'research',
      agents: ['youtube-channel-analyser'],
      requiresReview: true,
      description: 'Deep analysis of your channel — content performance, audience, SEO, what works and what doesn\'t',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Trend & Competitor Research',
      teamId: 'research',
      agents: ['social-media-trend-research', 'competitive-trend-research', 'audience-research'],
      requiresReview: true,
      description: 'Research current social media trends, competitor strategies, and audience behaviour across platforms',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
      parallel: true,
    },
    {
      order: 4,
      name: 'Content Calendar',
      teamId: 'research',
      agents: ['content-calendar'],
      requiresReview: true,
      description: 'Generate a structured content calendar with topics, formats, platforms, and dates based on all research',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Script & Copy Generation',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'social-copy'],
      requiresReview: true,
      description: 'Write scripts, captions, and platform-specific copy for each content piece in the calendar',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 6,
      name: 'Thumbnail & Visual Assets',
      teamId: 'image-production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate thumbnail concepts and visual assets for each piece of content',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 7,
      name: 'Posting Packages',
      teamId: 'distribution',
      agents: ['posting'],
      requiresReview: true,
      description: 'Prepare platform-specific posting packages with optimised copy, hashtags, SEO metadata, and specs',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 8,
      name: 'Publishing Schedule',
      teamId: 'distribution',
      agents: ['scheduling'],
      requiresReview: true,
      description: 'Generate optimal publishing schedule across platforms, accounting for time zones and algorithm behaviour',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
    },
    {
      order: 9,
      name: 'Performance Report',
      teamId: 'research',
      agents: ['performance-report'],
      requiresReview: false,
      description: 'After content is published, analyse performance and generate recommendations for the next cycle',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
    },
  ],

  defaults: {
    calendarWeeks: 4,
    platforms: ['youtube', 'instagram', 'tiktok', 'linkedin'],
    contentMix: { educational: 40, entertaining: 25, community: 20, promotional: 15 },
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresChannelUrl: true,
  },

  outputs: {
    primary: 'document',
    formats: ['json', 'md'],
    includesCalendar: true,
    includesPostingPackages: true,
  },
};

// ─── 9. Invoice Processor + Bank Reconciliation ─────────────────────────────

export const invoiceReconciliation: TemplateConfig = {
  id: 'invoice-reconciliation',
  name: 'Invoice Processor + Bank Reconciliation',
  description: 'Upload invoices and bank statements. AI extracts data from both, matches payments to invoices, flags discrepancies, calculates aging, and produces a reconciliation report with action items.',
  icon: 'fa-scale-balanced',
  category: 'finance',
  version: '1.0.0',
  builtIn: true,
  tags: ['finance', 'invoices', 'bank-reconciliation', 'accounting', 'bookkeeping'],

  teams: [
    {
      teamId: 'document-production',
      agents: ['invoice-processor', 'bank-statement-parser', 'reconciliation-matcher', 'financial-summary-builder'],
      notes: 'Invoice parsing, bank statement parsing, matching, and summary report generation',
    },
    {
      teamId: 'text-analysis',
      agents: ['ocr-extractor'],
      notes: 'OCR for scanned invoices and bank statements',
    },
    {
      teamId: 'data-analysis',
      agents: ['spreadsheet-analyser', 'data-quality-checker'],
      notes: 'Validate extracted data quality and analyse patterns in transaction data',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Documents',
      teamId: 'document-production',
      agents: [],
      requiresReview: false,
      description: 'Upload invoices (PDF, scanned, email) and bank statements (PDF, CSV, Excel). Set company details and currency.',
    },
    {
      order: 2,
      name: 'Parse Invoices',
      teamId: 'document-production',
      agents: ['invoice-processor'],
      requiresReview: true,
      description: 'Extract supplier, amounts, dates, VAT, line items from each invoice. Validate math, check for duplicates.',
    },
    {
      order: 3,
      name: 'Parse Bank Statements',
      teamId: 'document-production',
      agents: ['bank-statement-parser'],
      requiresReview: true,
      description: 'Extract transactions from bank statements. Validate balance continuity, categorise transactions.',
    },
    {
      order: 4,
      name: 'Data Quality Check',
      teamId: 'data-analysis',
      agents: ['data-quality-checker'],
      requiresReview: false,
      description: 'Verify extracted data quality — check for missing fields, format issues, and anomalies in both datasets.',
    },
    {
      order: 5,
      name: 'Reconciliation',
      teamId: 'document-production',
      agents: ['reconciliation-matcher'],
      requiresReview: true,
      description: 'Match invoices to bank transactions using reference, amount, date, and counterparty matching. Flag discrepancies.',
    },
    {
      order: 6,
      name: 'Reconciliation Report',
      teamId: 'document-production',
      agents: ['financial-summary-builder'],
      requiresReview: true,
      description: 'Generate a comprehensive reconciliation report: matched items, outstanding invoices with aging, unexplained transactions, action items.',
    },
  ],

  defaults: {
    currency: 'EUR',
    amountTolerance: 0.01,
    dateTolerance: 5,
    agingBuckets: [30, 60, 90, 120],
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: false,
    requiresInvoices: true,
    requiresBankStatements: true,
  },

  outputs: {
    primary: 'document',
    formats: ['json', 'xlsx', 'md'],
    includesReconciliationReport: true,
    includesAgingAnalysis: true,
  },
};

// ─── 10. Content Localisation Pack ───────────────────────────────────────────

export const contentLocalisationPack: TemplateConfig = {
  id: 'content-localisation-pack',
  name: 'Content Localisation Pack',
  description: 'Translate and culturally adapt content for multiple markets. Upload scripts, copy, subtitles, or social media text — get localised versions with cultural review, brand voice validation, and regulatory compliance checks.',
  icon: 'fa-globe',
  category: 'localisation',
  version: '1.0.0',
  builtIn: true,
  tags: ['localisation', 'translation', 'transcreation', 'multilingual', 'cultural-review'],

  teams: [
    {
      teamId: 'research',
      agents: ['brand-voice-research', 'audience-research'],
      notes: 'Establish brand voice rules and audience profile for each target market',
    },
    {
      teamId: 'video-assembly',
      agents: ['translator', 'cultural-reviewer', 'subtitles-hooks'],
      notes: 'Translation, cultural review, and subtitle generation for video content',
    },
    {
      teamId: 'copy-production',
      agents: ['social-copy', 'copywriter'],
      notes: 'Adapt social copy and marketing text per market',
    },
    {
      teamId: 'qa',
      agents: ['qa-consistency'],
      notes: 'Cross-language consistency check — ensure brand terms and messaging align',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Source Content & Markets',
      teamId: 'video-assembly',
      agents: [],
      requiresReview: false,
      description: 'Upload source content (scripts, copy, subtitles, social posts). Select target languages and markets.',
    },
    {
      order: 2,
      name: 'Brand Voice Analysis',
      teamId: 'research',
      agents: ['brand-voice-research'],
      requiresReview: false,
      description: 'Analyse brand voice and tone rules to guide translation approach for each target market.',
    },
    {
      order: 3,
      name: 'Translation & Transcreation',
      teamId: 'video-assembly',
      agents: ['translator'],
      requiresReview: true,
      description: 'Translate all content with transcreation — adapting idioms, humour, and cultural references while preserving brand voice and timing.',
    },
    {
      order: 4,
      name: 'Cultural Review',
      teamId: 'video-assembly',
      agents: ['cultural-reviewer'],
      requiresReview: true,
      description: 'Review translations for cultural sensitivity, tone, regulatory compliance, and technical localisation (dates, numbers, RTL).',
    },
    {
      order: 5,
      name: 'Localised Social Copy',
      teamId: 'copy-production',
      agents: ['social-copy'],
      requiresReview: true,
      description: 'Generate platform-specific social media copy in each target language with localised hashtags and CTAs.',
    },
    {
      order: 6,
      name: 'Consistency Check',
      teamId: 'qa',
      agents: ['qa-consistency'],
      requiresReview: false,
      description: 'Cross-language QA — verify brand terminology, key messages, and tone are consistent across all localised versions.',
    },
  ],

  defaults: {
    sourceLanguage: 'en',
    targetLanguages: ['bg', 'el', 'de'],
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresSourceContent: true,
  },

  outputs: {
    primary: 'document',
    formats: ['json', 'md', 'srt'],
    includesTranslations: true,
    includesCulturalReview: true,
  },
};

// ─── 11. Campaign Video Producer ─────────────────────────────────────────────

export const campaignVideoProducer: TemplateConfig = {
  id: 'campaign-video-producer',
  name: 'Campaign Video Producer',
  description: 'End-to-end branded video production: from brief and concept through screenplay, character design, keyframe generation, video segments, composition, and final delivery with subtitles and music.',
  icon: 'fa-film',
  category: 'marketing',
  version: '1.0.0',
  builtIn: true,
  tags: ['video', 'campaign', 'production', 'end-to-end', 'branded-content'],

  teams: [
    {
      teamId: 'research',
      agents: ['audience-research', 'competitive-trend-research', 'social-media-trend-research'],
      notes: 'Research audience, competitors, and trends to inform the creative brief',
    },
    {
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter', 'tagline', 'social-copy'],
      notes: 'Full copy pipeline: concept → screenplay → taglines → social copy',
    },
    {
      teamId: 'image-production',
      agents: ['image-producer', 'character-builder', 'character-variations'],
      notes: 'Character design and keyframe image generation',
    },
    {
      teamId: 'video-production',
      agents: ['video-from-keyframes', 'video-stitching'],
      notes: 'Generate video segments from keyframes and stitch into continuous video',
    },
    {
      teamId: 'video-assembly',
      agents: [
        'voiceover', 'music-direction', 'subtitles-hooks', 'text-overlay',
        'caption', 'composition', 'shotstack-render', 'thumbnail',
        'video-assembly-reviewer',
      ],
      notes: 'Full post-production: VO, music, subtitles, overlays, thumbnails, Shotstack render, final QA',
    },
    {
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      notes: 'Platform-specific posting packages and publishing schedule',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Brief & Research',
      teamId: 'research',
      agents: ['audience-research', 'competitive-trend-research', 'social-media-trend-research'],
      requiresReview: true,
      description: 'Input campaign brief. Research audience, competitors, and trends to inform creative direction.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
      parallel: true,
    },
    {
      order: 2,
      name: 'Concept & Screenplay',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay'],
      requiresReview: true,
      description: 'Develop campaign concept, creative direction, and full screenplay with shot descriptions.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Characters & Key Visuals',
      teamId: 'image-production',
      agents: ['character-builder', 'character-variations', 'image-producer'],
      requiresReview: true,
      description: 'Design characters (or use existing references), create wardrobe/expression variations, generate keyframe images for each scene.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Video Generation',
      teamId: 'video-production',
      agents: ['video-from-keyframes', 'video-stitching'],
      requiresReview: true,
      description: 'Generate video segments between keyframes and stitch into one continuous video.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Post-Production',
      teamId: 'video-assembly',
      agents: ['voiceover', 'music-direction', 'subtitles-hooks', 'text-overlay', 'caption', 'composition'],
      requiresReview: true,
      description: 'Add voiceover, music, subtitles, text overlays, and captions. Compose the final edit.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 6,
      name: 'Final Render & Thumbnails',
      teamId: 'video-assembly',
      agents: ['shotstack-render', 'thumbnail', 'video-assembly-reviewer'],
      requiresReview: true,
      description: 'Render final video via Shotstack, generate thumbnails, run QA review on the assembled video.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 7,
      name: 'Copy & Posting Packages',
      teamId: 'copy-production',
      agents: ['tagline', 'social-copy'],
      requiresReview: true,
      description: 'Generate taglines, social media copy, and platform-specific posting packages.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 1,
    },
    {
      order: 8,
      name: 'Publishing Schedule',
      teamId: 'distribution',
      agents: ['posting', 'scheduling'],
      requiresReview: true,
      description: 'Prepare per-platform posting packages and generate optimal publishing schedule.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
  ],

  defaults: {
    aspectRatio: '9:16',
    segmentDuration: 5,
    transition: 'fade',
    platforms: ['instagram', 'tiktok', 'youtube'],
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresBrief: true,
  },

  outputs: {
    primary: 'video',
    formats: ['mp4'],
    usesShotstack: true,
    includesPostingPackages: true,
  },
};

// ─── 12. Character Design Studio ─────────────────────────────────────────────

export const characterDesignStudio: TemplateConfig = {
  id: 'character-design-studio',
  name: 'Character Design Studio',
  description: 'Build a complete virtual character from a reference image or text description. Generates a character sheet with expression variations, wardrobe options, age progressions, and scene poses — all maintaining consistency for use across campaigns.',
  icon: 'fa-person-dress',
  category: 'creative',
  version: '1.0.0',
  builtIn: true,
  tags: ['character', 'virtual-influencer', 'character-sheet', 'consistency', 'design'],

  teams: [
    {
      teamId: 'image-production',
      agents: ['character-builder', 'character-frames', 'character-variations', 'image-producer', 'style-transfer'],
      notes: 'Full character design pipeline: build, variations, frames, and style options',
    },
    {
      teamId: 'copy-production',
      agents: ['creative-director', 'copywriter'],
      notes: 'Character bio, personality profile, and brand voice for the character',
    },
    {
      teamId: 'qa',
      agents: ['qa-consistency'],
      notes: 'Verify visual consistency across all generated character images',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Character Brief',
      teamId: 'image-production',
      agents: [],
      requiresReview: false,
      description: 'Upload reference image(s) or describe the character. Set age, ethnicity, style, personality traits.',
    },
    {
      order: 2,
      name: 'Base Character',
      teamId: 'image-production',
      agents: ['character-builder', 'image-producer'],
      requiresReview: true,
      description: 'Generate the base character in a neutral pose — this becomes the canonical reference for all variations.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Expression Sheet',
      teamId: 'image-production',
      agents: ['character-variations'],
      requiresReview: true,
      description: 'Generate expression variations: happy, serious, surprised, confident, thoughtful, laughing — maintaining character identity.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Wardrobe Options',
      teamId: 'image-production',
      agents: ['character-variations'],
      requiresReview: true,
      description: 'Generate wardrobe variations: casual, professional, formal, seasonal, branded — same character, different outfits.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Scene Poses',
      teamId: 'image-production',
      agents: ['character-frames'],
      requiresReview: true,
      description: 'Generate the character in various scene contexts: office, outdoor, studio, retail, lifestyle — different angles and poses.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 6,
      name: 'Style Variations',
      teamId: 'image-production',
      agents: ['style-transfer'],
      requiresReview: true,
      description: 'Apply different visual styles to the character: photorealistic, illustration, anime, watercolour — for different campaign needs.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 7,
      name: 'Character Profile',
      teamId: 'copy-production',
      agents: ['creative-director', 'copywriter'],
      requiresReview: true,
      description: 'Write the character bio, personality profile, brand voice guidelines, and usage rules for campaign consistency.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 8,
      name: 'Consistency Check',
      teamId: 'qa',
      agents: ['qa-consistency'],
      requiresReview: false,
      description: 'QA review across all generated images — verify facial consistency, proportions, and brand alignment.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
  ],

  defaults: {
    expressionCount: 6,
    wardrobeCount: 4,
    sceneCount: 6,
    styleCount: 3,
  },

  inputs: {
    requiresSourceImages: false,
    minImages: 0,
    requiresBrand: true,
    acceptsReferenceImages: true,
  },

  outputs: {
    primary: 'images',
    formats: ['png', 'jpg'],
    includesCharacterSheet: true,
    includesCharacterProfile: true,
  },
};

// ─── 13. Competitor Intelligence Report ──────────────────────────────────────

export const competitorIntelligenceReport: TemplateConfig = {
  id: 'competitor-intelligence-report',
  name: 'Competitor Intelligence Report',
  description: 'Monitor competitors across web, social media, and news. Produces a structured intelligence digest with positioning analysis, content gaps, pricing signals, and strategic opportunities.',
  icon: 'fa-binoculars',
  category: 'research',
  version: '1.0.0',
  builtIn: true,
  tags: ['competitor', 'intelligence', 'monitoring', 'research', 'strategy'],

  teams: [
    {
      teamId: 'research',
      agents: ['competitor-monitor', 'competitive-trend-research', 'news-monitor', 'social-media-monitor', 'web-scraper', 'deep-research'],
      notes: 'Full competitive intelligence stack: web, social, news, and deep research',
    },
    {
      teamId: 'text-analysis',
      agents: ['sentiment-analyser', 'trend-identifier'],
      notes: 'Sentiment analysis on competitor mentions and trend identification',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator', 'chart-creator'],
      notes: 'Produce the intelligence report with visualisations',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Define Competitors',
      teamId: 'research',
      agents: [],
      requiresReview: false,
      description: 'List competitor names, URLs, social handles, and key topics to monitor.',
    },
    {
      order: 2,
      name: 'Web & Social Scan',
      teamId: 'research',
      agents: ['competitor-monitor', 'social-media-monitor', 'web-scraper'],
      requiresReview: false,
      description: 'Scan competitor websites, social media accounts, and product pages for changes and new content.',
      parallel: true,
    },
    {
      order: 3,
      name: 'News & PR Monitoring',
      teamId: 'research',
      agents: ['news-monitor'],
      requiresReview: false,
      description: 'Search news sources for competitor mentions, press releases, and industry coverage.',
    },
    {
      order: 4,
      name: 'Deep Analysis',
      teamId: 'research',
      agents: ['competitive-trend-research', 'deep-research'],
      requiresReview: true,
      description: 'Analyse competitor positioning, messaging strategy, content approach, and identify market gaps.',
    },
    {
      order: 5,
      name: 'Sentiment & Trends',
      teamId: 'text-analysis',
      agents: ['sentiment-analyser', 'trend-identifier'],
      requiresReview: false,
      description: 'Analyse sentiment around competitor brands and identify emerging trends in the competitive landscape.',
    },
    {
      order: 6,
      name: 'Intelligence Report',
      teamId: 'document-production',
      agents: ['report-generator', 'chart-creator'],
      requiresReview: true,
      description: 'Compile findings into a structured report: competitor profiles, SWOT, positioning map, content gaps, opportunities, and recommended actions.',
    },
  ],

  defaults: {
    monitoringPeriod: '7d',
    maxCompetitors: 5,
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresCompetitorList: true,
  },

  outputs: {
    primary: 'document',
    formats: ['md', 'json'],
    includesCompetitorProfiles: true,
    includesPositioningMap: true,
  },
};

// ─── 14. Email Campaign Builder ──────────────────────────────────────────────

export const emailCampaignBuilder: TemplateConfig = {
  id: 'email-campaign-builder',
  name: 'Email Campaign Builder',
  description: 'Design multi-email sequences from a campaign brief. AI researches the audience, writes subject lines and body copy with A/B variants, builds the drip logic, and prepares scheduling recommendations.',
  icon: 'fa-envelope-open-text',
  category: 'marketing',
  version: '1.0.0',
  builtIn: true,
  tags: ['email', 'campaign', 'sequence', 'drip', 'nurture', 'marketing-automation'],

  teams: [
    {
      teamId: 'research',
      agents: ['audience-research', 'brand-voice-research'],
      notes: 'Audience segmentation and brand voice to guide copy tone',
    },
    {
      teamId: 'copy-production',
      agents: ['creative-director', 'copywriter', 'email-sequence-writer', 'tagline'],
      notes: 'Full email copy pipeline: strategy, subject lines, body copy, CTAs, A/B variants',
    },
    {
      teamId: 'qa',
      agents: ['qa-consistency'],
      notes: 'Check consistency across the sequence — tone, messaging, CTA progression',
    },
    {
      teamId: 'distribution',
      agents: ['scheduling'],
      notes: 'Optimal send time recommendations for each email in the sequence',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Campaign Brief',
      teamId: 'copy-production',
      agents: [],
      requiresReview: false,
      description: 'Define campaign goal (nurture, launch, re-engagement, onboarding), audience segment, and desired sequence length.',
    },
    {
      order: 2,
      name: 'Audience & Voice Research',
      teamId: 'research',
      agents: ['audience-research', 'brand-voice-research'],
      requiresReview: true,
      description: 'Research target audience pain points, motivations, and preferred communication style. Establish brand voice for the sequence.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
      parallel: true,
    },
    {
      order: 3,
      name: 'Sequence Strategy',
      teamId: 'copy-production',
      agents: ['creative-director'],
      requiresReview: true,
      description: 'Design the sequence arc: email count, theme per email, CTA progression, branching logic, and exit conditions.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Email Copy & Variants',
      teamId: 'copy-production',
      agents: ['email-sequence-writer', 'copywriter', 'tagline'],
      requiresReview: true,
      description: 'Write each email: subject line (3 A/B variants), preview text, body copy, CTA buttons. Generate A/B variants for top-of-funnel emails.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Consistency Check',
      teamId: 'qa',
      agents: ['qa-consistency'],
      requiresReview: false,
      description: 'Verify tone, messaging, and CTA progression are coherent across the entire sequence.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 6,
      name: 'Send Schedule',
      teamId: 'distribution',
      agents: ['scheduling'],
      requiresReview: true,
      description: 'Generate optimal send times, day-of-week recommendations, and delay intervals between emails.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
  ],

  defaults: {
    sequenceLength: 5,
    abVariants: 3,
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresBrief: true,
  },

  outputs: {
    primary: 'document',
    formats: ['json', 'md', 'html'],
    includesAbVariants: true,
    includesSendSchedule: true,
  },
};

// ─── 15. Data Quality Audit ──────────────────────────────────────────────────

export const dataQualityAudit: TemplateConfig = {
  id: 'data-quality-audit',
  name: 'Data Quality Audit',
  description: 'Upload a database export, spreadsheet, or CSV. AI profiles every column, detects anomalies, finds duplicates, checks referential integrity, and produces an actionable data quality report with fix recommendations.',
  icon: 'fa-database',
  category: 'data',
  version: '1.0.0',
  builtIn: true,
  tags: ['data-quality', 'audit', 'database', 'spreadsheet', 'cleaning', 'anomaly-detection'],

  teams: [
    {
      teamId: 'data-analysis',
      agents: ['data-profiler', 'data-quality-checker', 'database-auditor', 'spreadsheet-analyser', 'statistical-analyser'],
      notes: 'Full data analysis stack: profiling, quality checks, auditing, statistical analysis',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator', 'chart-creator'],
      notes: 'Generate the quality report with visualisations',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Data',
      teamId: 'data-analysis',
      agents: [],
      requiresReview: false,
      description: 'Upload database export, spreadsheet (Excel/CSV), or connect to a data source. Describe expected schema if available.',
    },
    {
      order: 2,
      name: 'Data Profiling',
      teamId: 'data-analysis',
      agents: ['data-profiler', 'spreadsheet-analyser'],
      requiresReview: true,
      description: 'Profile every column: data types, null rates, unique counts, value distributions, min/max/mean, and pattern detection.',
    },
    {
      order: 3,
      name: 'Quality Checks',
      teamId: 'data-analysis',
      agents: ['data-quality-checker'],
      requiresReview: false,
      description: 'Run quality rules: missing values, format inconsistencies, out-of-range values, orphaned records, referential integrity violations.',
    },
    {
      order: 4,
      name: 'Duplicate Detection',
      teamId: 'data-analysis',
      agents: ['database-auditor'],
      requiresReview: true,
      description: 'Find exact and fuzzy duplicates using name matching, address normalisation, and record similarity scoring.',
    },
    {
      order: 5,
      name: 'Statistical Analysis',
      teamId: 'data-analysis',
      agents: ['statistical-analyser'],
      requiresReview: false,
      description: 'Detect outliers, correlations, and distribution anomalies that may indicate data entry errors or systemic issues.',
    },
    {
      order: 6,
      name: 'Quality Report',
      teamId: 'document-production',
      agents: ['report-generator', 'chart-creator'],
      requiresReview: true,
      description: 'Compile a data quality scorecard: overall health score, column-by-column findings, prioritised fix recommendations, and estimated effort.',
    },
  ],

  defaults: {
    duplicateThreshold: 0.85,
    outlierMethod: 'iqr',
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: false,
    requiresDataFile: true,
  },

  outputs: {
    primary: 'document',
    formats: ['json', 'md', 'xlsx'],
    includesQualityScorecard: true,
    includesFixRecommendations: true,
  },
};

// ─── 16. Brand Audit ─────────────────────────────────────────────────────────

export const brandAudit: TemplateConfig = {
  id: 'brand-audit',
  name: 'Brand Audit',
  description: 'Upload existing marketing content (ads, social posts, emails, website copy). AI analyses it against your brand guidelines and produces a consistency report with specific fixes for off-brand elements.',
  icon: 'fa-trademark',
  category: 'marketing',
  version: '1.0.0',
  builtIn: true,
  tags: ['brand', 'audit', 'consistency', 'brand-voice', 'guidelines', 'quality'],

  teams: [
    {
      teamId: 'research',
      agents: ['brand-voice-research'],
      notes: 'Establish the brand voice baseline to audit against',
    },
    {
      teamId: 'media-analysis',
      agents: ['brand-consistency-checker', 'style-identifier', 'mood-identifier'],
      notes: 'Visual brand consistency — colours, typography, imagery style, mood alignment',
    },
    {
      teamId: 'text-analysis',
      agents: ['sentiment-analyser', 'trend-identifier'],
      notes: 'Tone and messaging analysis across content pieces',
    },
    {
      teamId: 'qa',
      agents: ['qa-consistency'],
      notes: 'Cross-content consistency check',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator'],
      notes: 'Generate the brand audit report',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Content & Guidelines',
      teamId: 'research',
      agents: [],
      requiresReview: false,
      description: 'Upload brand guidelines and the content to audit (images, copy, social posts, emails, ads, website screenshots).',
    },
    {
      order: 2,
      name: 'Brand Baseline',
      teamId: 'research',
      agents: ['brand-voice-research'],
      requiresReview: true,
      description: 'Analyse brand guidelines to establish the voice, tone, colour palette, typography, and messaging pillars to audit against.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 3,
      name: 'Visual Consistency Check',
      teamId: 'media-analysis',
      agents: ['brand-consistency-checker', 'style-identifier', 'mood-identifier'],
      requiresReview: true,
      description: 'Analyse each visual asset: colour usage, typography, logo placement, imagery style, and mood alignment vs brand guidelines.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
    {
      order: 4,
      name: 'Copy & Tone Analysis',
      teamId: 'text-analysis',
      agents: ['sentiment-analyser'],
      requiresReview: true,
      description: 'Analyse written content: tone of voice, vocabulary, messaging alignment, CTA consistency, and sentiment match.',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 5,
      name: 'Cross-Content Consistency',
      teamId: 'qa',
      agents: ['qa-consistency'],
      requiresReview: false,
      description: 'Check for consistency across all content pieces — are they recognisably the same brand?',
      executionMode: 'team-leader',
      qualityThreshold: 7,
      maxTlRetries: 2,
    },
    {
      order: 6,
      name: 'Brand Audit Report',
      teamId: 'document-production',
      agents: ['report-generator'],
      requiresReview: true,
      description: 'Compile findings: overall brand health score, per-asset audit results, specific deviations with before/after fix suggestions, priority actions.',
      executionMode: 'team-leader',
      qualityThreshold: 8,
      maxTlRetries: 2,
    },
  ],

  defaults: {},

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresContentToAudit: true,
  },

  outputs: {
    primary: 'document',
    formats: ['md', 'json'],
    includesBrandScorecard: true,
    includesFixSuggestions: true,
  },
};

// ─── 17. Meeting Notes Processor ─────────────────────────────────────────────

export const meetingNotesProcessor: TemplateConfig = {
  id: 'meeting-notes-processor',
  name: 'Meeting Notes Processor',
  description: 'Upload meeting notes, transcript, or recording summary. AI extracts structured minutes, decisions, action items with owners and deadlines, and drafts follow-up emails.',
  icon: 'fa-clipboard-list',
  category: 'productivity',
  version: '1.0.0',
  builtIn: true,
  tags: ['meeting', 'notes', 'action-items', 'minutes', 'follow-up', 'productivity'],

  teams: [
    {
      teamId: 'text-analysis',
      agents: ['document-summariser', 'sentiment-analyser'],
      notes: 'Summarise meeting content and detect sentiment/tone of discussions',
    },
    {
      teamId: 'calendar-organisation',
      agents: ['meeting-notes-processor', 'meeting-prep-brief'],
      notes: 'Structure meeting notes and prepare follow-up brief',
    },
    {
      teamId: 'email-comms',
      agents: ['reply-drafter'],
      notes: 'Draft follow-up emails with action items for each attendee',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator'],
      notes: 'Format the final meeting minutes document',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Notes',
      teamId: 'text-analysis',
      agents: [],
      requiresReview: false,
      description: 'Upload meeting transcript, notes, or recording summary. Optionally add attendee list and agenda.',
    },
    {
      order: 2,
      name: 'Summarise & Extract',
      teamId: 'text-analysis',
      agents: ['document-summariser'],
      requiresReview: true,
      description: 'Parse the meeting content: identify topics discussed, key points per topic, decisions made, and open questions.',
    },
    {
      order: 3,
      name: 'Action Items',
      teamId: 'calendar-organisation',
      agents: ['meeting-notes-processor'],
      requiresReview: true,
      description: 'Extract action items with: description, owner, deadline, priority, and dependencies. Flag items without clear owners.',
    },
    {
      order: 4,
      name: 'Meeting Minutes',
      teamId: 'document-production',
      agents: ['report-generator'],
      requiresReview: true,
      description: 'Format structured meeting minutes: attendees, agenda, discussion summary, decisions, action items, and next meeting date.',
    },
    {
      order: 5,
      name: 'Follow-Up Emails',
      teamId: 'email-comms',
      agents: ['reply-drafter'],
      requiresReview: true,
      description: 'Draft follow-up emails for each attendee with their specific action items, deadlines, and relevant context from the meeting.',
    },
  ],

  defaults: {},

  inputs: {
    requiresSourceImages: false,
    requiresBrand: false,
    requiresMeetingNotes: true,
  },

  outputs: {
    primary: 'document',
    formats: ['md', 'json'],
    includesMinutes: true,
    includesActionItems: true,
    includesFollowUpEmails: true,
  },
};

// ─── 18. Code Review Assistant ───────────────────────────────────────────────

export const codeReviewAssistant: TemplateConfig = {
  id: 'code-review-assistant',
  name: 'Code Review Assistant',
  description: 'Upload code files or point to a repository. AI runs bug detection, security scanning, architecture review, and test coverage analysis — producing a prioritised review report with fix suggestions.',
  icon: 'fa-code',
  category: 'development',
  version: '1.0.0',
  builtIn: true,
  tags: ['code-review', 'security', 'bugs', 'architecture', 'testing', 'development'],

  teams: [
    {
      teamId: 'code-analysis',
      agents: ['bug-detector', 'security-scanner', 'architecture-reviewer', 'optimisation-advisor', 'missing-coverage-identifier', 'schema-reviewer'],
      notes: 'Full code analysis suite: bugs, security, architecture, performance, test coverage, schema',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator'],
      notes: 'Generate the code review report',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Code',
      teamId: 'code-analysis',
      agents: [],
      requiresReview: false,
      description: 'Upload code files, paste code, or provide a repository URL. Specify language, framework, and areas of concern.',
    },
    {
      order: 2,
      name: 'Bug Detection',
      teamId: 'code-analysis',
      agents: ['bug-detector'],
      requiresReview: false,
      description: 'Scan for logic errors, null reference risks, race conditions, off-by-one errors, and common language-specific pitfalls.',
    },
    {
      order: 3,
      name: 'Security Scan',
      teamId: 'code-analysis',
      agents: ['security-scanner'],
      requiresReview: true,
      description: 'Check for OWASP top 10 vulnerabilities, injection risks, authentication flaws, data exposure, and dependency vulnerabilities.',
    },
    {
      order: 4,
      name: 'Architecture Review',
      teamId: 'code-analysis',
      agents: ['architecture-reviewer', 'optimisation-advisor'],
      requiresReview: true,
      description: 'Evaluate code structure, separation of concerns, dependency management, scalability patterns, and performance optimisation opportunities.',
    },
    {
      order: 5,
      name: 'Test Coverage Analysis',
      teamId: 'code-analysis',
      agents: ['missing-coverage-identifier'],
      requiresReview: false,
      description: 'Identify untested code paths, missing edge case tests, and critical functions without test coverage.',
    },
    {
      order: 6,
      name: 'Review Report',
      teamId: 'document-production',
      agents: ['report-generator'],
      requiresReview: true,
      description: 'Compile a prioritised code review report: critical issues, warnings, suggestions, and specific fix recommendations with code examples.',
    },
  ],

  defaults: {},

  inputs: {
    requiresSourceImages: false,
    requiresBrand: false,
    requiresCodeFiles: true,
  },

  outputs: {
    primary: 'document',
    formats: ['md', 'json'],
    includesReviewReport: true,
    includesFixSuggestions: true,
  },
};

// ─── 19. Email Inbox Organiser ───────────────────────────────────────────────

export const emailInboxOrganiser: TemplateConfig = {
  id: 'email-inbox-organiser',
  name: 'Email Inbox Organiser',
  description: 'Analyse your inbox, classify emails by priority and category, identify what needs replies, set reminders for follow-ups, and suggest auto-forwarding rules to reduce inbox noise.',
  icon: 'fa-inbox',
  category: 'productivity',
  version: '1.0.0',
  builtIn: true,
  tags: ['email', 'inbox', 'organise', 'priority', 'productivity', 'automation'],

  teams: [
    {
      teamId: 'email-organisation',
      agents: ['email-classifier', 'email-organiser', 'email-auto-forwarder', 'email-reminder'],
      notes: 'Full inbox management: classify, organise, set forwarding rules, create reminders',
    },
    {
      teamId: 'text-analysis',
      agents: ['email-analyser', 'sentiment-analyser'],
      notes: 'Analyse email content and detect urgency/sentiment',
    },
    {
      teamId: 'email-comms',
      agents: ['reply-idea-generator', 'correspondence-tracker'],
      notes: 'Suggest reply approaches and track ongoing conversations',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Connect Inbox',
      teamId: 'email-organisation',
      agents: [],
      requiresReview: false,
      description: 'Connect to your email (Gmail). Specify date range and any existing folder/label structure.',
    },
    {
      order: 2,
      name: 'Classify & Prioritise',
      teamId: 'email-organisation',
      agents: ['email-classifier'],
      requiresReview: true,
      description: 'Scan emails and classify by: urgency (P1-P4), category (client, internal, newsletter, billing, personal), and action required (reply, review, FYI, archive).',
    },
    {
      order: 3,
      name: 'Conversation Threads',
      teamId: 'email-comms',
      agents: ['correspondence-tracker'],
      requiresReview: false,
      description: 'Identify ongoing conversation threads, stalled conversations awaiting your reply, and items you\'re waiting on from others.',
    },
    {
      order: 4,
      name: 'Reply Suggestions',
      teamId: 'email-comms',
      agents: ['reply-idea-generator'],
      requiresReview: true,
      description: 'For emails needing replies, generate quick reply suggestions — one-liners for simple responses, structured outlines for complex ones.',
    },
    {
      order: 5,
      name: 'Organise & Rules',
      teamId: 'email-organisation',
      agents: ['email-organiser', 'email-auto-forwarder', 'email-reminder'],
      requiresReview: true,
      description: 'Suggest folder/label reorganisation, auto-forwarding rules for recurring senders, and reminders for time-sensitive items.',
    },
  ],

  defaults: {
    lookbackDays: 7,
    priorityLevels: 4,
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: false,
    requiresEmailAccess: true,
  },

  outputs: {
    primary: 'document',
    formats: ['json', 'md'],
    includesClassification: true,
    includesRules: true,
    includesReminders: true,
  },
};

// ─── 20. File Structure Audit ────────────────────────────────────────────────

export const fileStructureAudit: TemplateConfig = {
  id: 'file-structure-audit',
  name: 'File Structure Audit',
  description: 'Analyse a folder or drive structure. AI maps the hierarchy, identifies disorganisation, missing files, duplicates, and naming inconsistencies — then recommends a clean structure with a migration plan.',
  icon: 'fa-folder-tree',
  category: 'productivity',
  version: '1.0.0',
  builtIn: true,
  tags: ['files', 'folders', 'organisation', 'audit', 'cleanup', 'structure'],

  teams: [
    {
      teamId: 'file-organisation',
      agents: ['file-structure-analyser', 'file-structure-monitor', 'reorganisation-advisor', 'missing-info-detector'],
      notes: 'Full file structure analysis, monitoring, and reorganisation',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator', 'diagram-builder'],
      notes: 'Generate audit report and folder structure diagrams',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Select Location',
      teamId: 'file-organisation',
      agents: [],
      requiresReview: false,
      description: 'Specify the folder path, drive, or cloud storage location to audit. Set any naming conventions or expected structure.',
    },
    {
      order: 2,
      name: 'Structure Analysis',
      teamId: 'file-organisation',
      agents: ['file-structure-analyser'],
      requiresReview: true,
      description: 'Map the full folder hierarchy: depth, file counts per folder, file types, sizes, last modified dates, and naming patterns.',
    },
    {
      order: 3,
      name: 'Gap & Duplicate Detection',
      teamId: 'file-organisation',
      agents: ['missing-info-detector'],
      requiresReview: true,
      description: 'Identify missing expected files (e.g. no README, no index), duplicate files across folders, empty folders, and orphaned files.',
    },
    {
      order: 4,
      name: 'Reorganisation Plan',
      teamId: 'file-organisation',
      agents: ['reorganisation-advisor'],
      requiresReview: true,
      description: 'Propose a clean folder structure with: naming conventions, archive strategy, and a file-by-file migration plan showing current → new location.',
    },
    {
      order: 5,
      name: 'Audit Report',
      teamId: 'document-production',
      agents: ['report-generator', 'diagram-builder'],
      requiresReview: true,
      description: 'Compile the full audit: structure diagram, findings summary, reorganisation plan, and estimated effort.',
    },
  ],

  defaults: {},

  inputs: {
    requiresSourceImages: false,
    requiresBrand: false,
    requiresFolderPath: true,
  },

  outputs: {
    primary: 'document',
    formats: ['md', 'json'],
    includesStructureDiagram: true,
    includesMigrationPlan: true,
  },
};

// ─── 21. Dashboard Builder ───────────────────────────────────────────────────

export const dashboardBuilder: TemplateConfig = {
  id: 'dashboard-builder',
  name: 'Dashboard Builder',
  description: 'Turn raw data into a visual dashboard. Upload spreadsheets or database exports — AI identifies the key metrics, creates charts, and assembles a branded interactive dashboard or presentation.',
  icon: 'fa-chart-column',
  category: 'data',
  version: '1.0.0',
  builtIn: true,
  tags: ['dashboard', 'visualisation', 'charts', 'data', 'reporting', 'presentation'],

  teams: [
    {
      teamId: 'data-analysis',
      agents: ['spreadsheet-analyser', 'data-profiler', 'statistical-analyser'],
      notes: 'Analyse data to identify key metrics and patterns',
    },
    {
      teamId: 'document-production',
      agents: ['chart-creator', 'diagram-builder'],
      notes: 'Create chart specifications and data visualisations',
    },
    {
      teamId: 'presentation-comms',
      agents: ['data-summary-presenter', 'dashboard-creator', 'branded-presentation-builder'],
      notes: 'Assemble charts into a cohesive dashboard or branded presentation',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Data',
      teamId: 'data-analysis',
      agents: [],
      requiresReview: false,
      description: 'Upload data files (Excel, CSV, JSON) or describe the data source. Specify what questions the dashboard should answer.',
    },
    {
      order: 2,
      name: 'Data Analysis',
      teamId: 'data-analysis',
      agents: ['spreadsheet-analyser', 'data-profiler', 'statistical-analyser'],
      requiresReview: true,
      description: 'Profile the data, identify key metrics, trends, outliers, and relationships. Recommend which metrics belong on the dashboard.',
    },
    {
      order: 3,
      name: 'Chart Design',
      teamId: 'document-production',
      agents: ['chart-creator'],
      requiresReview: true,
      description: 'Select optimal chart types for each metric (bar, line, pie, heatmap, KPI card). Generate chart specifications with data mappings.',
    },
    {
      order: 4,
      name: 'Dashboard Assembly',
      teamId: 'presentation-comms',
      agents: ['dashboard-creator', 'data-summary-presenter'],
      requiresReview: true,
      description: 'Lay out charts into a dashboard: KPI cards at top, trend charts in the middle, detailed tables at the bottom. Add filters and drill-down suggestions.',
    },
    {
      order: 5,
      name: 'Branded Presentation',
      teamId: 'presentation-comms',
      agents: ['branded-presentation-builder'],
      requiresReview: true,
      description: 'Optionally convert the dashboard into a branded presentation deck suitable for stakeholder meetings.',
    },
  ],

  defaults: {
    chartCount: 6,
    kpiCount: 4,
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresDataFile: true,
  },

  outputs: {
    primary: 'document',
    formats: ['html', 'json', 'pptx'],
    includesDashboard: true,
    includesPresentation: true,
  },
};

// ─── 22. Support Bot Builder ─────────────────────────────────────────────────

export const supportBotBuilder: TemplateConfig = {
  id: 'support-bot-builder',
  name: 'Support Bot Builder',
  description: 'Build a customer or staff support chatbot from your knowledge base. Upload FAQs, manuals, policies, and product docs — AI structures them into a retrieval-ready knowledge base with conversation flows and escalation rules.',
  icon: 'fa-robot',
  category: 'communication',
  version: '1.0.0',
  builtIn: true,
  tags: ['chatbot', 'support', 'customer-service', 'knowledge-base', 'FAQ', 'automation'],

  teams: [
    {
      teamId: 'text-analysis',
      agents: ['document-summariser', 'ocr-extractor'],
      notes: 'Parse and summarise source documents for the knowledge base',
    },
    {
      teamId: 'research',
      agents: ['audience-research'],
      notes: 'Understand the target users (customers or staff) to design appropriate conversation tone',
    },
    {
      teamId: 'bot-comms',
      agents: ['customer-support-bot', 'staff-support-bot', 'training-repo-builder'],
      notes: 'Design bot persona, conversation flows, and build the training data repository',
    },
    {
      teamId: 'copy-production',
      agents: ['copywriter'],
      notes: 'Write bot responses, greeting messages, and escalation messages',
    },
    {
      teamId: 'qa',
      agents: ['qa-consistency'],
      notes: 'Test conversation flows for consistency and completeness',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Upload Knowledge Base',
      teamId: 'text-analysis',
      agents: [],
      requiresReview: false,
      description: 'Upload source documents: FAQs, product manuals, policy docs, training materials, common support tickets.',
    },
    {
      order: 2,
      name: 'Parse & Structure',
      teamId: 'text-analysis',
      agents: ['document-summariser', 'ocr-extractor'],
      requiresReview: true,
      description: 'Extract and structure knowledge into Q&A pairs, topic categories, and decision trees from all source documents.',
    },
    {
      order: 3,
      name: 'Audience & Tone',
      teamId: 'research',
      agents: ['audience-research'],
      requiresReview: false,
      description: 'Define the bot\'s target users and appropriate conversation tone (formal, friendly, technical).',
    },
    {
      order: 4,
      name: 'Conversation Flows',
      teamId: 'bot-comms',
      agents: ['customer-support-bot', 'staff-support-bot'],
      requiresReview: true,
      description: 'Design conversation flows: greeting, topic detection, multi-turn Q&A, clarification prompts, and escalation to human agent rules.',
    },
    {
      order: 5,
      name: 'Response Writing',
      teamId: 'copy-production',
      agents: ['copywriter'],
      requiresReview: true,
      description: 'Write polished bot responses for each knowledge topic. Include variations for natural conversation and edge case handling.',
    },
    {
      order: 6,
      name: 'Training Repository',
      teamId: 'bot-comms',
      agents: ['training-repo-builder'],
      requiresReview: true,
      description: 'Compile the structured knowledge base, conversation flows, and response templates into a training-ready repository for deployment.',
    },
    {
      order: 7,
      name: 'QA Testing',
      teamId: 'qa',
      agents: ['qa-consistency'],
      requiresReview: false,
      description: 'Test conversation flows for gaps, contradictions, dead ends, and tone consistency across all topics.',
    },
  ],

  defaults: {
    botType: 'customer',
    escalationThreshold: 3,
  },

  inputs: {
    requiresSourceImages: false,
    requiresBrand: true,
    requiresKnowledgeBase: true,
  },

  outputs: {
    primary: 'document',
    formats: ['json', 'md'],
    includesKnowledgeBase: true,
    includesConversationFlows: true,
    includesTrainingRepo: true,
  },
};

// ─── 23. Database Migration Planner ──────────────────────────────────────────

export const databaseMigrationPlanner: TemplateConfig = {
  id: 'database-migration-planner',
  name: 'Database Migration Planner',
  description: 'Plan a database migration: analyse the source schema, normalise structure, detect data quality issues, map to target schema, and produce a step-by-step migration plan with rollback strategy.',
  icon: 'fa-database',
  category: 'development',
  version: '1.0.0',
  builtIn: true,
  tags: ['database', 'migration', 'schema', 'planning', 'data', 'development'],

  teams: [
    {
      teamId: 'data-analysis',
      agents: ['database-auditor', 'data-profiler', 'data-quality-checker', 'spreadsheet-analyser'],
      notes: 'Analyse source database: schema, data quality, relationships',
    },
    {
      teamId: 'code-analysis',
      agents: ['schema-reviewer'],
      notes: 'Review schema design and suggest normalisation improvements',
    },
    {
      teamId: 'data-organisation',
      agents: ['database-normaliser', 'data-deduplicator', 'data-migration-planner'],
      notes: 'Plan normalisation, deduplication, and migration steps',
    },
    {
      teamId: 'document-production',
      agents: ['report-generator', 'diagram-builder'],
      notes: 'Generate migration plan document with schema diagrams',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Source Schema',
      teamId: 'data-analysis',
      agents: [],
      requiresReview: false,
      description: 'Upload source database schema (SQL dump, ERD, or spreadsheet). Describe the target system if known.',
    },
    {
      order: 2,
      name: 'Schema Audit',
      teamId: 'data-analysis',
      agents: ['database-auditor', 'data-profiler'],
      requiresReview: true,
      description: 'Audit the source schema: table structure, relationships, indexes, constraints, data types, and row counts per table.',
    },
    {
      order: 3,
      name: 'Data Quality Assessment',
      teamId: 'data-analysis',
      agents: ['data-quality-checker'],
      requiresReview: true,
      description: 'Check data quality: null rates, orphaned records, referential integrity violations, format inconsistencies, and duplicates.',
    },
    {
      order: 4,
      name: 'Schema Review & Normalisation',
      teamId: 'code-analysis',
      agents: ['schema-reviewer'],
      requiresReview: true,
      description: 'Review schema design: normalisation level, anti-patterns, missing indexes, and suggested improvements for the target schema.',
    },
    {
      order: 5,
      name: 'Migration Plan',
      teamId: 'data-organisation',
      agents: ['data-migration-planner', 'database-normaliser', 'data-deduplicator'],
      requiresReview: true,
      description: 'Generate step-by-step migration plan: table creation order, data transformation scripts, deduplication strategy, and rollback procedures.',
    },
    {
      order: 6,
      name: 'Migration Report',
      teamId: 'document-production',
      agents: ['report-generator', 'diagram-builder'],
      requiresReview: true,
      description: 'Compile the full migration report: source/target schema diagrams, transformation mappings, risk assessment, estimated timeline, and rollback plan.',
    },
  ],

  defaults: {},

  inputs: {
    requiresSourceImages: false,
    requiresBrand: false,
    requiresSchemaFile: true,
  },

  outputs: {
    primary: 'document',
    formats: ['md', 'json', 'sql'],
    includesSchemaDiagrams: true,
    includesMigrationPlan: true,
    includesRollbackPlan: true,
  },
};

// ─── Registry of all built-in templates ──────────────────────────────────────

// ─── Social Media Research Workflow ──────────────────────────────────────────

export const socialMediaResearch: TemplateConfig = {
  id: 'social-media-research',
  name: 'Social Media Research',
  description: 'Deep research workflow for any social media channel: scrape public data, build interactive dashboard with analytics, competitive benchmarks, hashtag/keyword analysis, audience insights, promotion effectiveness, and actionable recommendations with step-by-step implementation guides. Works across TikTok, Instagram, Facebook, YouTube, and LinkedIn.',
  icon: 'fa-microscope',
  category: 'research',
  domain: 'research',
  version: '1.0.0',
  builtIn: true,
  author: 'TensorAx Studio',
  tags: ['social-media', 'research', 'analytics', 'tiktok', 'instagram', 'facebook', 'youtube', 'competitive-analysis', 'audience-insights'],

  teams: [
    {
      teamId: 'research',
      agents: ['social-media-trend-research', 'competitive-trend-research', 'audience-research', 'web-scraper', 'deep-research'],
      notes: 'Scrape channel data, competitor profiles, hashtag/keyword trends, audience demographics',
    },
    {
      teamId: 'data-analysis',
      agents: ['general-analysis'],
      notes: 'Analyse scraped data: engagement rates, growth patterns, content performance, promotion ROI',
    },
    {
      teamId: 'presentation-comms',
      agents: ['report-generator', 'chart-creator'],
      notes: 'Build interactive HTML dashboard, generate Excel/Word reports in multiple languages',
    },
  ],

  steps: [
    {
      order: 1,
      name: 'Configure',
      teamId: 'research',
      agents: [],
      requiresReview: false,
      description: 'Select platform, enter channel handle/URL, define research scope, set language and save location',
    },
    {
      order: 2,
      name: 'Scrape',
      teamId: 'research',
      agents: ['web-scraper', 'social-media-trend-research'],
      requiresReview: false,
      description: 'Scrape public channel data: all posts, engagement metrics, follower counts, hashtags, competitor profiles. Uses platform-specific APIs (Apify for TikTok, native APIs for others)',
    },
    {
      order: 3,
      name: 'Dashboard',
      teamId: 'presentation-comms',
      agents: ['report-generator', 'chart-creator'],
      requiresReview: false,
      description: 'Build interactive HTML dashboard with tabs: Overview, Channel, Competitors, Top Content, All Content, Hashtags/Keywords. Auto-opens in browser.',
    },
    {
      order: 4,
      name: 'Analysis',
      teamId: 'data-analysis',
      agents: ['general-analysis'],
      requiresReview: false,
      description: 'Data-driven analysis: current position vs benchmarks, viral content breakdown, optimal timing/format/duration, content gaps, competitor intelligence, promotion ROI (if data available)',
    },
    {
      order: 5,
      name: 'Recommendations',
      teamId: 'data-analysis',
      agents: ['deep-research', 'general-analysis'],
      requiresReview: false,
      description: 'Platform algorithm deep-dive (current year), target audience strategy, account setup checklist with how-to guides, action plan with step-by-step implementation, content series/playlist strategy, promotion strategy (including anti-ban for political/sensitive content), growth targets',
    },
    {
      order: 6,
      name: 'Export',
      teamId: 'presentation-comms',
      agents: ['report-generator'],
      requiresReview: true,
      description: 'Generate downloadable reports: bilingual Excel (all dashboard tabs + analysis + recommendations with How To column), Word summary, save to project directory. Review dashboard before exporting.',
    },
  ],

  inputs: {
    requiresBrief: true,
    customFields: [
      { id: 'platform', label: 'Platform', type: 'select', options: ['TikTok', 'Instagram', 'Facebook', 'YouTube', 'LinkedIn'], required: true },
      { id: 'channelHandle', label: 'Channel Handle or URL', type: 'text', required: true },
      { id: 'periodDays', label: 'Period (days)', type: 'select', options: ['7', '14', '30', '60', '90', '180', '365'], defaultValue: '7', required: true },
      { id: 'competitors', label: 'Competitor handles (comma-separated)', type: 'textarea', required: false },
      { id: 'hashtags', label: 'Hashtags/keywords to research (comma-separated)', type: 'textarea', required: false },
      { id: 'language', label: 'Report Language', type: 'select', options: ['English', 'Bulgarian', 'Greek', 'Both EN+Local'], defaultValue: 'Both EN+Local', required: true },
      { id: 'geo', label: 'Geographic Focus', type: 'text', defaultValue: 'Bulgaria', required: false },
      { id: 'includePromoAnalysis', label: 'Include promotion/ad analysis', type: 'toggle', defaultValue: true, required: false },
    ],
  },

  outputs: {
    primary: 'report',
    formats: ['html-dashboard', 'xlsx', 'docx'],
    destination: 'project',
  },

  schedule: {
    schedulable: true,
    suggestedInterval: 'weekly',
  },
};

export const BUILT_IN_TEMPLATES: TemplateConfig[] = [
  socialMediaResearch,
  whatIfTransformation,
  videoFromKeyframes,
  staffTrainingVideo,
  productMarketingCampaign,
  liveShoppingChannel,
  nineCameraAngleFrames,
  legalExpert,
  socialMediaContentAutomation,
  invoiceReconciliation,
  contentLocalisationPack,
  campaignVideoProducer,
  characterDesignStudio,
  competitorIntelligenceReport,
  emailCampaignBuilder,
  dataQualityAudit,
  brandAudit,
  meetingNotesProcessor,
  codeReviewAssistant,
  emailInboxOrganiser,
  fileStructureAudit,
  dashboardBuilder,
  supportBotBuilder,
  databaseMigrationPlanner,
];
