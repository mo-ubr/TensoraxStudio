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
    },
    {
      order: 3,
      name: 'Generate Images',
      teamId: 'image-production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate keyframe images for each transformation stage',
    },
    {
      order: 4,
      name: 'Generate Videos',
      teamId: 'video-production',
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
    },
    {
      order: 3,
      name: 'Compose',
      teamId: 'video-assembly',
      agents: ['text-overlay', 'music-direction', 'caption', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add overlays, music, captions, and render via Shotstack',
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
    },
    {
      order: 2,
      name: 'Script & Concept',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter'],
      requiresReview: true,
      description: 'AI generates training script, narration, and visual concept from the brief',
    },
    {
      order: 3,
      name: 'Images',
      teamId: 'image-production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate keyframe images illustrating each training step',
    },
    {
      order: 4,
      name: 'Video Segments',
      teamId: 'video-production',
      agents: ['video-producer', 'video-from-keyframes'],
      requiresReview: true,
      description: 'Generate video segments from keyframe images',
    },
    {
      order: 5,
      name: 'Quality Check',
      teamId: 'copy-production',
      agents: ['qa-consistency'],
      requiresReview: true,
      description: 'QA agent checks all assets against brand guidelines and training accuracy',
    },
    {
      order: 6,
      name: 'Assembly & Localise',
      teamId: 'video-assembly',
      agents: ['voiceover', 'translator', 'cultural-reviewer', 'subtitles-hooks', 'text-overlay', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add voiceover, translate for target markets, cultural review, add subtitles, compose via Shotstack',
    },
    {
      order: 7,
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
    },
    {
      order: 2,
      name: 'Concept & Copy',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'copywriter', 'tagline', 'social-copy'],
      requiresReview: true,
      description: 'Creative concept, screenplay, taglines, and platform-specific copy',
    },
    {
      order: 3,
      name: 'Characters & Images',
      teamId: 'image-production',
      agents: ['image-producer', 'character-builder', 'character-frames'],
      requiresReview: true,
      description: 'Character design, keyframes, product shots, and lifestyle imagery',
    },
    {
      order: 4,
      name: 'Video Production',
      teamId: 'video-production',
      agents: ['video-producer', 'video-from-keyframes', 'video-stitching', 'music-generation'],
      requiresReview: true,
      description: 'Generate video segments from keyframes, produce background music',
    },
    {
      order: 5,
      name: 'Quality Gate',
      teamId: 'copy-production',
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
    },
    {
      order: 2,
      name: 'Script',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'copywriter'],
      requiresReview: true,
      description: 'Generate shopping script and presenter dialogue',
    },
    {
      order: 3,
      name: 'Virtual Presenter',
      teamId: 'video-production',
      agents: ['video-producer'],
      requiresReview: true,
      description: 'Generate virtual presenter video with lip sync',
    },
    {
      order: 4,
      name: 'Assembly',
      teamId: 'video-assembly',
      agents: ['subtitles-hooks', 'sound-sync', 'composition', 'shotstack-render'],
      requiresReview: true,
      description: 'Add product overlays, hooks, compose via Shotstack',
    },
    {
      order: 5,
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
    },
    {
      order: 3,
      name: 'Trend & Competitor Research',
      teamId: 'research',
      agents: ['social-media-trend-research', 'competitive-trend-research', 'audience-research'],
      requiresReview: true,
      description: 'Research current social media trends, competitor strategies, and audience behaviour across platforms',
      parallel: true,
    },
    {
      order: 4,
      name: 'Content Calendar',
      teamId: 'research',
      agents: ['content-calendar'],
      requiresReview: true,
      description: 'Generate a structured content calendar with topics, formats, platforms, and dates based on all research',
    },
    {
      order: 5,
      name: 'Script & Copy Generation',
      teamId: 'copy-production',
      agents: ['creative-director', 'concept-creation', 'screenplay', 'social-copy'],
      requiresReview: true,
      description: 'Write scripts, captions, and platform-specific copy for each content piece in the calendar',
    },
    {
      order: 6,
      name: 'Thumbnail & Visual Assets',
      teamId: 'image-production',
      agents: ['image-producer'],
      requiresReview: true,
      description: 'Generate thumbnail concepts and visual assets for each piece of content',
    },
    {
      order: 7,
      name: 'Posting Packages',
      teamId: 'distribution',
      agents: ['posting'],
      requiresReview: true,
      description: 'Prepare platform-specific posting packages with optimised copy, hashtags, SEO metadata, and specs',
    },
    {
      order: 8,
      name: 'Publishing Schedule',
      teamId: 'distribution',
      agents: ['scheduling'],
      requiresReview: true,
      description: 'Generate optimal publishing schedule across platforms, accounting for time zones and algorithm behaviour',
    },
    {
      order: 9,
      name: 'Performance Report',
      teamId: 'research',
      agents: ['performance-report'],
      requiresReview: false,
      description: 'After content is published, analyse performance and generate recommendations for the next cycle',
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

// ─── Registry of all built-in templates ──────────────────────────────────────

export const BUILT_IN_TEMPLATES: TemplateConfig[] = [
  whatIfTransformation,
  videoFromKeyframes,
  staffTrainingVideo,
  productMarketingCampaign,
  liveShoppingChannel,
  nineCameraAngleFrames,
  legalExpert,
  socialMediaContentAutomation,
  invoiceReconciliation,
];
