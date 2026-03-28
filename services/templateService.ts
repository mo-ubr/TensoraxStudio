/**
 * TemplateService — CRUD for template configurations.
 *
 * Built-in templates ship with the app and can't be deleted (but can be
 * duplicated and customised). Custom templates are stored in localStorage
 * and can be created, edited, duplicated, and deleted.
 *
 * This is the single source of truth for "what templates exist".
 */

import type { TemplateConfig, TeamId, AgentId, DomainId, ToolId, ToolRequirement } from '../templates/templateConfig';
import { BUILT_IN_TEMPLATES } from '../templates/builtInTemplates';

const STORAGE_KEY = 'tensorax_custom_templates';

// ─── Agent metadata (for the UI) ────────────────────────────────────────────

export interface AgentMeta {
  id: AgentId;
  name: string;
  team: TeamId;
  description: string;
  icon: string;
  /** External tools this agent can use */
  tools?: ToolRequirement[];
}

export interface TeamMeta {
  id: TeamId;
  name: string;
  domain: DomainId;
  description: string;
  icon: string;
  agents: AgentMeta[];
}

export interface DomainMeta {
  id: DomainId;
  name: string;
  description: string;
  icon: string;
  colour: string;
}

/** The 5 capability domains */
export const DOMAIN_CATALOGUE: DomainMeta[] = [
  { id: 'research', name: 'Research', description: 'Find, monitor, scrape, and extract information from any source', icon: 'fa-microscope', colour: '#3b82f6' },
  { id: 'analyse', name: 'Analyse', description: 'Understand, summarise, and identify patterns in text, data, images, video, and sound', icon: 'fa-magnifying-glass-chart', colour: '#8b5cf6' },
  { id: 'create', name: 'Create', description: 'Produce copy, images, video, sound, code, documents, and presentations', icon: 'fa-wand-magic-sparkles', colour: '#91569c' },
  { id: 'organise', name: 'Organise', description: 'Structure files, data, calendars, emails, and training repositories', icon: 'fa-folder-tree', colour: '#f59e0b' },
  { id: 'communicate', name: 'Communicate', description: 'Draft, send, present, and interact via any channel', icon: 'fa-paper-plane', colour: '#10b981' },
];

/** Full catalogue of every team and agent in the system — all 5 domains */
export const TEAM_CATALOGUE: TeamMeta[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // RESEARCH DOMAIN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'research',
    name: 'Research Team',
    domain: 'research',
    description: 'Deep web research, social monitoring, data extraction, regulatory tracking',
    icon: 'fa-microscope',
    agents: [
      { id: 'audience-research', name: 'Audience Research', team: 'research', description: 'Analyses target demographics, buyer personas, and audience behaviour', icon: 'fa-users' },
      { id: 'brand-voice-research', name: 'Brand Voice Research', team: 'research', description: 'Establishes and validates brand tone, language, and personality', icon: 'fa-comment-dots' },
      { id: 'competitive-trend-research', name: 'Competitive Trends', team: 'research', description: 'Monitors competitor activity, market positioning, and emerging trends', icon: 'fa-chart-line' },
      { id: 'social-media-trend-research', name: 'Social Media Trends', team: 'research', description: 'Tracks platform-specific trends, hashtags, viral formats', icon: 'fa-hashtag' },
      { id: 'deep-research', name: 'Deep Research', team: 'research', description: 'Open-ended, multi-source web research with source verification and citation', icon: 'fa-magnifying-glass-plus', tools: [{ toolId: 'web-search', required: true, purpose: 'Search the web for information' }, { toolId: 'web-fetch', required: true, purpose: 'Fetch and parse web pages' }] },
      { id: 'general-analysis', name: 'General Analysis', team: 'research', description: 'Document analysis, brief analysis, cross-domain pattern spotting', icon: 'fa-brain' },
      { id: 'web-scraper', name: 'Web Scraper', team: 'research', description: 'Scrape structured data from websites (products, prices, descriptions)', icon: 'fa-spider', tools: [{ toolId: 'web-scrape', required: true, purpose: 'Structured web scraping' }] },
      { id: 'data-extractor', name: 'Data Extractor', team: 'research', description: 'Parse and structure data from semi-structured sources, PDFs, scanned documents', icon: 'fa-database', tools: [{ toolId: 'file-read', required: true, purpose: 'Read source documents' }] },
      { id: 'social-media-monitor', name: 'Social Media Monitor', team: 'research', description: 'Track accounts/topics across FB, IG, YT, TikTok, X at regular intervals', icon: 'fa-tower-broadcast', tools: [{ toolId: 'web-scrape', required: true, purpose: 'Scrape social platforms' }] },
      { id: 'webpage-monitor', name: 'Webpage Monitor', team: 'research', description: 'Watch specific webpages for changes and report new content', icon: 'fa-eye', tools: [{ toolId: 'web-fetch', required: true, purpose: 'Fetch pages to check for changes' }] },
      { id: 'regulatory-monitor', name: 'Regulatory Monitor', team: 'research', description: 'Track legal, tax, and regulatory changes by jurisdiction (BG, GR, UK)', icon: 'fa-gavel' },
      { id: 'news-monitor', name: 'News Monitor', team: 'research', description: 'Monitor news sources for topics/companies defined by user', icon: 'fa-newspaper', tools: [{ toolId: 'web-search', required: true, purpose: 'Search news sources' }] },
      { id: 'competitor-monitor', name: 'Competitor Monitor', team: 'research', description: 'Track competitor activity across web and social channels', icon: 'fa-binoculars', tools: [{ toolId: 'web-scrape', required: true, purpose: 'Scrape competitor sites' }] },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYSE DOMAIN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'text-analysis',
    name: 'Text & Document Analysis',
    domain: 'analyse',
    description: 'Summarise, classify, extract, and analyse text and documents',
    icon: 'fa-file-lines',
    agents: [
      { id: 'document-summariser', name: 'Document Summariser', team: 'text-analysis', description: 'Summarise any text document with key points and action items', icon: 'fa-compress', tools: [{ toolId: 'file-read', required: true, purpose: 'Read documents to summarise' }] },
      { id: 'email-analyser', name: 'Email Analyser', team: 'text-analysis', description: 'Classify, summarise, and extract action items from emails', icon: 'fa-envelope-open-text', tools: [{ toolId: 'gmail-read', required: true, purpose: 'Read email messages' }] },
      { id: 'feed-summariser', name: 'Feed Summariser', team: 'text-analysis', description: 'Summarise monitoring feed outputs into digest reports', icon: 'fa-rss' },
      { id: 'message-analyser', name: 'Message Analyser', team: 'text-analysis', description: 'Analyse messages across channels (WhatsApp, Viber, SMS, Discord)', icon: 'fa-comments' },
      { id: 'ocr-extractor', name: 'OCR & Document Recognition', team: 'text-analysis', description: 'Extract text from images, scanned documents, receipts, invoices', icon: 'fa-file-image' },
      { id: 'trend-identifier', name: 'Trend Identifier', team: 'text-analysis', description: 'Identify patterns and trends across text documents over time', icon: 'fa-arrow-trend-up' },
      { id: 'sentiment-analyser', name: 'Sentiment Analyser', team: 'text-analysis', description: 'Determine sentiment, tone, and emotional content of text', icon: 'fa-face-smile' },
      { id: 'legal-clause-analyser', name: 'Legal Clause Analyser', team: 'text-analysis', description: 'Parse contracts into clauses, identify obligations, rights, termination conditions, liability caps, and unusual terms', icon: 'fa-scale-balanced', tools: [{ toolId: 'file-read', required: true, purpose: 'Read contract documents' }] },
      { id: 'contract-risk-assessor', name: 'Contract Risk Assessor', team: 'text-analysis', description: 'Score contract risk by clause category (liability, IP, termination, exclusivity, jurisdiction). Flags red/amber/green with recommendations.', icon: 'fa-triangle-exclamation' },
    ],
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    domain: 'analyse',
    description: 'Database auditing, data quality, spreadsheet analysis, statistics',
    icon: 'fa-chart-simple',
    agents: [
      { id: 'database-auditor', name: 'Database Auditor', team: 'data-analysis', description: 'Identify structure inconsistencies, duplications, and issues in databases', icon: 'fa-database', tools: [{ toolId: 'sql-query', required: true, purpose: 'Query database' }, { toolId: 'sql-schema', required: true, purpose: 'Read schema' }] },
      { id: 'data-quality-checker', name: 'Data Quality Checker', team: 'data-analysis', description: 'Find missing, duplicated, or anomalous data', icon: 'fa-circle-check', tools: [{ toolId: 'sql-query', required: false, purpose: 'Query database' }] },
      { id: 'relationship-mapper', name: 'Relationship Mapper', team: 'data-analysis', description: 'Identify and document relationships between data entities', icon: 'fa-diagram-project', tools: [{ toolId: 'sql-schema', required: true, purpose: 'Read schema relationships' }] },
      { id: 'spreadsheet-analyser', name: 'Spreadsheet Analyser', team: 'data-analysis', description: 'Analyse Excel/CSV data for patterns, anomalies, and insights', icon: 'fa-table', tools: [{ toolId: 'spreadsheet-read', required: true, purpose: 'Read spreadsheet files' }] },
      { id: 'statistical-analyser', name: 'Statistical Analyser', team: 'data-analysis', description: 'Descriptive stats, distributions, correlations, hypothesis testing', icon: 'fa-chart-bar' },
      { id: 'data-profiler', name: 'Data Profiler', team: 'data-analysis', description: 'Profile a dataset: shape, quality, null rates, distributions', icon: 'fa-id-card' },
      { id: 'sql-query-agent', name: 'SQL Query Agent', team: 'data-analysis', description: 'Write and execute SQL queries against any connected database', icon: 'fa-terminal', tools: [{ toolId: 'sql-query', required: true, purpose: 'Execute SQL queries' }] },
    ],
  },
  {
    id: 'code-analysis',
    name: 'Code Analysis',
    domain: 'analyse',
    description: 'Bug detection, architecture review, security scanning, code quality',
    icon: 'fa-code',
    agents: [
      { id: 'bug-detector', name: 'Bug Detector', team: 'code-analysis', description: 'Identify bugs, potential errors, and edge cases in code', icon: 'fa-bug' },
      { id: 'optimisation-advisor', name: 'Optimisation Advisor', team: 'code-analysis', description: 'Suggest performance improvements and refactoring opportunities', icon: 'fa-gauge-high' },
      { id: 'missing-coverage-identifier', name: 'Missing Coverage', team: 'code-analysis', description: 'Identify missing error handling, tests, documentation, or edge cases', icon: 'fa-puzzle-piece' },
      { id: 'architecture-reviewer', name: 'Architecture Reviewer', team: 'code-analysis', description: 'Review system architecture and identify structural issues', icon: 'fa-sitemap' },
      { id: 'security-scanner', name: 'Security Scanner', team: 'code-analysis', description: 'Identify potential security vulnerabilities in code', icon: 'fa-shield-halved' },
      { id: 'schema-reviewer', name: 'Schema Reviewer', team: 'code-analysis', description: 'Review database schema design, normalisation, indexing, and data types', icon: 'fa-diagram-project', tools: [{ toolId: 'sql-schema', required: true, purpose: 'Read database schema' }] },
    ],
  },
  {
    id: 'media-analysis',
    name: 'Media Analysis',
    domain: 'analyse',
    description: 'Image, video, and sound analysis — encoding, style, mood, content',
    icon: 'fa-photo-film',
    agents: [
      { id: 'image-encoder', name: 'Image Encoder', team: 'media-analysis', description: 'Analyse an image and create embedding (vector) representation', icon: 'fa-barcode' },
      { id: 'image-summariser', name: 'Image Summariser', team: 'media-analysis', description: 'Describe image content in structured text', icon: 'fa-image' },
      { id: 'style-identifier', name: 'Style Identifier', team: 'media-analysis', description: 'Identify visual style, design language, and aesthetic properties', icon: 'fa-palette' },
      { id: 'mood-identifier', name: 'Mood Identifier', team: 'media-analysis', description: 'Determine emotional tone, atmosphere, and mood of imagery', icon: 'fa-masks-theater' },
      { id: 'brand-consistency-checker', name: 'Brand Consistency Checker', team: 'media-analysis', description: 'Compare images against brand guidelines for consistency', icon: 'fa-check-double' },
      { id: 'video-summariser', name: 'Video Summariser', team: 'media-analysis', description: 'Summarise video content with timestamps and key moments', icon: 'fa-film' },
      { id: 'movement-analyser', name: 'Movement Analyser', team: 'media-analysis', description: 'Identify and describe motion, transitions, and camera work', icon: 'fa-person-walking' },
      { id: 'cctv-analyser', name: 'CCTV Analyser', team: 'media-analysis', description: 'Analyse CCTV feeds to identify suspicious movements and events', icon: 'fa-video' },
      { id: 'transcript-extractor', name: 'Transcript Extractor', team: 'media-analysis', description: 'Extract speech transcripts from audio/video with speaker identification', icon: 'fa-closed-captioning' },
      { id: 'voice-parameter-analyser', name: 'Voice Parameter Analyser', team: 'media-analysis', description: 'Analyse voice characteristics: pitch, pace, tone, accent', icon: 'fa-waveform-lines' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE DOMAIN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'copy-production',
    name: 'Copy Production Team',
    domain: 'create',
    description: 'Concepts, scripts, copy, taglines, blog posts, email sequences',
    icon: 'fa-pen-nib',
    agents: [
      { id: 'creative-director', name: 'Creative Director', team: 'copy-production', description: 'Oversees all production sub-teams — receives research and brief, orchestrates creative work', icon: 'fa-wand-magic-sparkles' },
      { id: 'concept-creation', name: 'Concept Creation', team: 'copy-production', description: 'Generates creative concepts, campaign angles, content strategies', icon: 'fa-lightbulb' },
      { id: 'screenplay', name: 'Screenplay', team: 'copy-production', description: 'Writes structured screenplays with scene breakdowns', icon: 'fa-scroll' },
      { id: 'copywriter', name: 'Copywriter', team: 'copy-production', description: 'Blog posts, ad copy, social captions, product descriptions, scripts', icon: 'fa-pen-fancy' },
      { id: 'tagline', name: 'Tagline Generator', team: 'copy-production', description: 'Creates brand taglines and slogans', icon: 'fa-quote-right' },
      { id: 'social-copy', name: 'Social Copy', team: 'copy-production', description: 'Platform-specific social media copy with hashtags and CTAs', icon: 'fa-share-nodes' },
      { id: 'blog-article-writer', name: 'Blog & Article Writer', team: 'copy-production', description: 'Long-form content with SEO, structure, and voice matching', icon: 'fa-newspaper' },
      { id: 'email-sequence-writer', name: 'Email Sequence Writer', team: 'copy-production', description: 'Multi-email campaigns: onboarding, nurture, re-engagement', icon: 'fa-envelopes-bulk' },
      { id: 'prompt-engineer', name: 'Prompt Engineer', team: 'copy-production', description: 'Generate and refine AI prompts for image, video, and text generation', icon: 'fa-robot' },
      { id: 'qa-consistency', name: 'QA / Consistency', team: 'copy-production', description: 'Reviews all assets against brand guidelines and creative brief', icon: 'fa-clipboard-check' },
      { id: 'verification', name: 'Verification Controller', team: 'copy-production', description: 'Automatic QA gate — checks agent output against the original task. Catches rewritten text, missing content, task non-compliance. Retries with corrections.', icon: 'fa-shield-check' },
    ],
  },
  {
    id: 'image-production',
    name: 'Image Production Team',
    domain: 'create',
    description: 'Characters, keyframes, product shots — all visual asset generation',
    icon: 'fa-image',
    agents: [
      { id: 'image-producer', name: 'Image Producer', team: 'image-production', description: 'Keyframes, product shots, lifestyle imagery, thumbnails', icon: 'fa-image', tools: [{ toolId: 'gemini-generate', required: false, purpose: 'Generate images via Gemini' }, { toolId: 'vertex-imagen', required: false, purpose: 'Generate via Vertex AI Imagen 3' }] },
      { id: 'character-builder', name: 'Character Builder', team: 'image-production', description: 'Visual SVG-based character trait composer', icon: 'fa-person' },
      { id: 'character-frames', name: 'Character Frames', team: 'image-production', description: 'Character scene frames and poses', icon: 'fa-people-group' },
      { id: 'character-variations', name: 'Character Variations', team: 'image-production', description: 'Wardrobe, aging, expression variations', icon: 'fa-shirt' },
      { id: 'faithful-formatter', name: 'Faithful Formatter', team: 'image-production', description: 'Exact copy-paste and layout agent for bills, receipts, forms, certificates, badges, labels', icon: 'fa-copy' },
      { id: 'faithful-image-reproduction', name: 'Faithful Image Reproduction', team: 'image-production', description: 'Reproduces a reference image with only specified text replaced', icon: 'fa-clone' },
      { id: 'style-transfer', name: 'Style Transfer', team: 'image-production', description: 'Apply a different visual style to an existing image', icon: 'fa-paintbrush' },
      { id: 'image-editor', name: 'Image Editor', team: 'image-production', description: 'Edit specific elements within an existing image', icon: 'fa-pen-ruler', tools: [{ toolId: 'fal-ai', required: false, purpose: 'Flux Kontext image editing' }] },
    ],
  },
  {
    id: 'video-production',
    name: 'Video Production Team',
    domain: 'create',
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
    id: 'sound-production',
    name: 'Sound Production Team',
    domain: 'create',
    description: 'Voice synthesis, voiceover, music generation, songs',
    icon: 'fa-headphones',
    agents: [
      { id: 'voice-generator', name: 'Voice Generator', team: 'sound-production', description: 'Create reusable synthetic voices with defined characteristics', icon: 'fa-user-astronaut', tools: [{ toolId: 'elevenlabs', required: false, purpose: 'ElevenLabs voice synthesis' }] },
      { id: 'voiceover-producer', name: 'Voiceover Producer', team: 'sound-production', description: 'Generate voiceover narration from script using a defined voice', icon: 'fa-microphone', tools: [{ toolId: 'elevenlabs', required: false, purpose: 'ElevenLabs TTS' }] },
      { id: 'music-track-generator', name: 'Music Track Generator', team: 'sound-production', description: 'Create original music from text prompt', icon: 'fa-drum' },
      { id: 'style-matched-music', name: 'Style-Matched Music', team: 'sound-production', description: 'Generate music that matches a reference sample style', icon: 'fa-music' },
      { id: 'song-creator', name: 'Song Creator', team: 'sound-production', description: 'Generate complete songs from lyrics/copy', icon: 'fa-guitar' },
    ],
  },
  {
    id: 'document-production',
    name: 'Document Production Team',
    domain: 'create',
    description: 'Reports, proposals, presentations, charts, contracts, invoices',
    icon: 'fa-file-word',
    agents: [
      { id: 'report-generator', name: 'Report Generator', team: 'document-production', description: 'Create formatted Word/PDF reports from data and analysis', icon: 'fa-file-pdf', tools: [{ toolId: 'file-write', required: true, purpose: 'Write report files' }] },
      { id: 'proposal-generator', name: 'Proposal Generator', team: 'document-production', description: 'Build business proposals with executive summary, scope, pricing', icon: 'fa-file-contract', tools: [{ toolId: 'file-write', required: true, purpose: 'Write proposal files' }] },
      { id: 'presentation-creator', name: 'Presentation Creator', team: 'document-production', description: 'Generate branded slide decks from content briefs', icon: 'fa-file-powerpoint', tools: [{ toolId: 'canva-create', required: false, purpose: 'Create in Canva' }] },
      { id: 'financial-summary-builder', name: 'Financial Summary Builder', team: 'document-production', description: 'Produce financial schedules and summaries in Excel', icon: 'fa-file-excel', tools: [{ toolId: 'spreadsheet-write', required: true, purpose: 'Write Excel files' }] },
      { id: 'chart-creator', name: 'Chart & Graph Creator', team: 'document-production', description: 'Generate data visualisations from structured data', icon: 'fa-chart-pie' },
      { id: 'diagram-builder', name: 'Diagram Builder', team: 'document-production', description: 'Create process flows, org charts, and system diagrams', icon: 'fa-diagram-project' },
      { id: 'contract-drafter', name: 'Contract & Agreement Drafter', team: 'document-production', description: 'Draft contracts and agreements from templates and parameters', icon: 'fa-file-signature', tools: [{ toolId: 'file-write', required: true, purpose: 'Write contract files' }] },
      { id: 'invoice-processor', name: 'Invoice Processor', team: 'document-production', description: 'Extract, code, and record invoice data from PDFs, scans, emails', icon: 'fa-file-invoice-dollar', tools: [{ toolId: 'file-read', required: true, purpose: 'Read invoice files' }, { toolId: 'gmail-read', required: false, purpose: 'Read invoices from email' }] },
    ],
  },
  {
    id: 'code-production',
    name: 'Code Production Team',
    domain: 'create',
    description: 'App ideas, architecture design, frontend/backend generation, tests',
    icon: 'fa-laptop-code',
    agents: [
      { id: 'app-idea-generator', name: 'App Idea Generator', team: 'code-production', description: 'Generate application concepts from business requirements', icon: 'fa-lightbulb' },
      { id: 'architecture-designer', name: 'Architecture Designer', team: 'code-production', description: 'Design system architecture and component structure', icon: 'fa-sitemap' },
      { id: 'frontend-builder', name: 'Frontend Builder', team: 'code-production', description: 'Generate UI components, layouts, and styling', icon: 'fa-window-restore' },
      { id: 'backend-builder', name: 'Backend Builder', team: 'code-production', description: 'Generate server-side logic, APIs, and database schemas', icon: 'fa-server' },
      { id: 'test-generator', name: 'Test Generator', team: 'code-production', description: 'Create test suites and test data sets', icon: 'fa-vial' },
      { id: 'code-documenter', name: 'Code Documenter', team: 'code-production', description: 'Generate documentation from code analysis', icon: 'fa-book' },
    ],
  },
  {
    id: 'image-assembly',
    name: 'Image Assembly Team',
    domain: 'create',
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
    domain: 'create',
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
      { id: 'translator', name: 'Translator', team: 'video-assembly', description: 'Script and copy localisation across target markets (EN/BG/GR)', icon: 'fa-language' },
      { id: 'cultural-reviewer', name: 'Cultural Reviewer', team: 'video-assembly', description: 'Cultural accuracy, tone, and brand alignment check', icon: 'fa-globe' },
      { id: 'subtitles-hooks', name: 'Subtitles & Hooks', team: 'video-assembly', description: 'Generates subtitles and attention hooks (text overlays, CTAs)', icon: 'fa-text-height' },
      { id: 'thumbnail', name: 'Thumbnail Generator', team: 'video-assembly', description: 'Generates thumbnail options from the final video', icon: 'fa-crop' },
      { id: 'video-assembly-reviewer', name: 'Assembly Reviewer', team: 'video-assembly', description: 'Final quality gate for the assembled video', icon: 'fa-check-double' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ORGANISE DOMAIN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'email-organisation',
    name: 'Email Organisation',
    domain: 'organise',
    description: 'Classify, forward, organise, and create reminders for email',
    icon: 'fa-inbox',
    agents: [
      { id: 'email-classifier', name: 'Email Classifier', team: 'email-organisation', description: 'Monitor incoming email and classify by type, priority, and action needed', icon: 'fa-tags', tools: [{ toolId: 'gmail-read', required: true, purpose: 'Read incoming email' }] },
      { id: 'email-auto-forwarder', name: 'Auto-Forwarder', team: 'email-organisation', description: 'Automatically forward specific email types to designated recipients', icon: 'fa-share', tools: [{ toolId: 'gmail-send', required: true, purpose: 'Forward emails' }] },
      { id: 'email-organiser', name: 'Email Organiser', team: 'email-organisation', description: 'Sort and label emails into logical folder structures', icon: 'fa-folder-open', tools: [{ toolId: 'gmail-read', required: true, purpose: 'Read and label emails' }] },
      { id: 'correspondence-summariser', name: 'Correspondence Summariser', team: 'email-organisation', description: 'Identify and summarise email threads on a topic', icon: 'fa-list-check', tools: [{ toolId: 'gmail-read', required: true, purpose: 'Read email threads' }] },
      { id: 'email-reminder', name: 'Email Reminder', team: 'email-organisation', description: 'Create follow-up reminders for pending email actions', icon: 'fa-bell', tools: [{ toolId: 'calendar-write', required: false, purpose: 'Create reminder events' }] },
    ],
  },
  {
    id: 'file-organisation',
    name: 'File & Directory Management',
    domain: 'organise',
    description: 'Structure analysis, monitoring, reorganisation, gap detection',
    icon: 'fa-folder-tree',
    agents: [
      { id: 'file-structure-analyser', name: 'Structure Analyser', team: 'file-organisation', description: 'Identify logical file structure and suggest improvements', icon: 'fa-sitemap', tools: [{ toolId: 'file-list', required: true, purpose: 'List directory contents' }, { toolId: 'gdrive-read', required: false, purpose: 'Read Google Drive structure' }] },
      { id: 'file-structure-monitor', name: 'Structure Monitor', team: 'file-organisation', description: 'Daily monitoring of file structure with discrepancy alerts', icon: 'fa-eye' },
      { id: 'reorganisation-advisor', name: 'Reorganisation Advisor', team: 'file-organisation', description: 'Generate actionable suggestions for reorganising information', icon: 'fa-arrows-rotate' },
      { id: 'missing-info-detector', name: 'Missing Info Detector', team: 'file-organisation', description: 'Identify gaps in documentation and file coverage', icon: 'fa-circle-question' },
      { id: 'training-repo-builder', name: 'AI Training Repository', team: 'file-organisation', description: 'Curate and organise data for AI model training', icon: 'fa-brain' },
    ],
  },
  {
    id: 'calendar-organisation',
    name: 'Calendar & Meeting Management',
    domain: 'organise',
    description: 'Calendar management, meeting notes, briefing preparation',
    icon: 'fa-calendar-days',
    agents: [
      { id: 'calendar-organiser', name: 'Calendar Organiser', team: 'calendar-organisation', description: 'Manage scheduling, conflicts, and time allocation', icon: 'fa-calendar-check', tools: [{ toolId: 'calendar-read', required: true, purpose: 'Read calendar' }, { toolId: 'calendar-write', required: true, purpose: 'Create/update events' }] },
      { id: 'meeting-notes-processor', name: 'Meeting Notes Processor', team: 'calendar-organisation', description: 'Extract action items, decisions, and follow-ups from meeting notes', icon: 'fa-clipboard-list' },
      { id: 'meeting-prep-brief', name: 'Meeting Prep Brief', team: 'calendar-organisation', description: 'Prepare briefing documents for upcoming meetings', icon: 'fa-file-lines' },
    ],
  },
  {
    id: 'data-organisation',
    name: 'Data Organisation',
    domain: 'organise',
    description: 'Database normalisation, deduplication, static data maintenance, migration',
    icon: 'fa-database',
    agents: [
      { id: 'database-normaliser', name: 'Database Normaliser', team: 'data-organisation', description: 'Review and normalise database structures', icon: 'fa-table-cells', tools: [{ toolId: 'sql-schema', required: true, purpose: 'Read schema' }, { toolId: 'sql-query', required: true, purpose: 'Execute changes' }] },
      { id: 'data-deduplicator', name: 'Data Deduplicator', team: 'data-organisation', description: 'Identify and resolve duplicate records', icon: 'fa-copy', tools: [{ toolId: 'sql-query', required: true, purpose: 'Find and resolve duplicates' }] },
      { id: 'static-data-maintainer', name: 'Static Data Maintainer', team: 'data-organisation', description: 'Automate maintenance of reference/lookup data', icon: 'fa-gear' },
      { id: 'data-migration-planner', name: 'Data Migration Planner', team: 'data-organisation', description: 'Plan and validate data migration between systems', icon: 'fa-truck-moving' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COMMUNICATE DOMAIN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'email-comms',
    name: 'Email Communications',
    domain: 'communicate',
    description: 'Reply drafting, response ideas, sending, tracking correspondence',
    icon: 'fa-envelope',
    agents: [
      { id: 'reply-drafter', name: 'Reply Drafter', team: 'email-comms', description: 'Analyse incoming email and draft an appropriate response', icon: 'fa-reply', tools: [{ toolId: 'gmail-read', required: true, purpose: 'Read email to reply to' }, { toolId: 'gmail-draft', required: true, purpose: 'Create draft reply' }] },
      { id: 'reply-idea-generator', name: 'Reply Idea Generator', team: 'email-comms', description: 'Generate multiple response options for complex emails', icon: 'fa-lightbulb' },
      { id: 'email-sender', name: 'Email Sender', team: 'email-comms', description: 'Send emails with appropriate formatting and attachments', icon: 'fa-paper-plane', tools: [{ toolId: 'gmail-send', required: true, purpose: 'Send emails' }] },
      { id: 'correspondence-tracker', name: 'Correspondence Tracker', team: 'email-comms', description: 'Track email threads and highlight items needing response', icon: 'fa-clock-rotate-left', tools: [{ toolId: 'gmail-read', required: true, purpose: 'Track email threads' }] },
    ],
  },
  {
    id: 'messaging-comms',
    name: 'Messaging Communications',
    domain: 'communicate',
    description: 'WhatsApp, Viber, Discord, Facebook Messenger, SMS — reply and send',
    icon: 'fa-message',
    agents: [
      { id: 'message-reply-drafter', name: 'Message Reply Drafter', team: 'messaging-comms', description: 'Draft responses appropriate to the channel and context', icon: 'fa-reply' },
      { id: 'message-idea-generator', name: 'Message Idea Generator', team: 'messaging-comms', description: 'Generate response options for complex messages', icon: 'fa-lightbulb' },
      { id: 'message-sender', name: 'Message Sender', team: 'messaging-comms', description: 'Send messages via the appropriate platform', icon: 'fa-paper-plane', tools: [{ toolId: 'whatsapp-send', required: false, purpose: 'Send via WhatsApp' }, { toolId: 'slack-send', required: false, purpose: 'Send via Slack' }] },
      { id: 'message-reminder', name: 'Reminder Creator', team: 'messaging-comms', description: 'Set up follow-up reminders for messaging conversations', icon: 'fa-bell' },
    ],
  },
  {
    id: 'presentation-comms',
    name: 'Presentations & Reporting',
    domain: 'communicate',
    description: 'Data summaries, dashboards, branded decks, interactive presentations',
    icon: 'fa-chart-column',
    agents: [
      { id: 'data-summary-presenter', name: 'Data Summary Presenter', team: 'presentation-comms', description: 'Create executive data summaries with key metrics', icon: 'fa-chart-simple' },
      { id: 'dashboard-creator', name: 'Dashboard Creator', team: 'presentation-comms', description: 'Build interactive dashboards from data sources', icon: 'fa-gauge' },
      { id: 'branded-presentation-builder', name: 'Branded Presentation', team: 'presentation-comms', description: 'Create presentations using brand-appropriate templates', icon: 'fa-file-powerpoint', tools: [{ toolId: 'canva-create', required: false, purpose: 'Create in Canva' }] },
      { id: 'interactive-presentation-builder', name: 'Interactive Presentation', team: 'presentation-comms', description: 'Create chat-based interactive presentation experiences', icon: 'fa-comments' },
    ],
  },
  {
    id: 'bot-comms',
    name: 'Bot Interactions',
    domain: 'communicate',
    description: 'Staff and customer support bots — chat, voice, and talking head',
    icon: 'fa-robot',
    agents: [
      { id: 'staff-support-bot', name: 'Staff Support Bot', team: 'bot-comms', description: 'Internal support assistant — chat (Phase I), talking head (Phase II)', icon: 'fa-headset' },
      { id: 'customer-support-bot', name: 'Customer Support Bot', team: 'bot-comms', description: 'Customer-facing support — chat (I), voice (II), talking head (III)', icon: 'fa-user-headset' },
    ],
  },
  {
    id: 'distribution',
    name: 'Distribution Team',
    domain: 'communicate',
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
