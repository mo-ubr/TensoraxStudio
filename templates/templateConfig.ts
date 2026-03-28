/**
 * Template Configuration System — v2 (5-Domain Architecture)
 *
 * Templates are "job specs" — blueprints that select and sequence
 * teams (persistent agent resources) for any task across 5 domains:
 *   Research → Analyse → Create → Organise → Communicate
 *
 * The construction site model:
 * - Teams are resources (electricians, carpenters, bricklayers)
 * - Templates are project briefs that pull from the shared pool
 * - Specialists are scheduled, not duplicated
 * - Tools are the equipment agents use (web search, SQL, file I/O, etc.)
 */

// ─── Capability Domains ─────────────────────────────────────────────────────

export type DomainId = 'research' | 'analyse' | 'create' | 'organise' | 'communicate';

// ─── Team identifiers (grouped by domain) ───────────────────────────────────

export type TeamId =
  // ══ RESEARCH domain ══
  | 'research'                // Deep web, social, monitoring, data extraction
  // ══ ANALYSE domain ══
  | 'text-analysis'           // Document summariser, email analyser, sentiment, OCR
  | 'data-analysis'           // Database audit, data quality, spreadsheet, statistical
  | 'code-analysis'           // Bug detector, optimisation, architecture review, security
  | 'media-analysis'          // Image/video/sound analysis (encoding, style, mood)
  // ══ CREATE domain ══
  | 'copy-production'         // Concepts, scripts, copy, taglines, social copy
  | 'image-production'        // Characters, keyframes, product shots, faithful reproduction
  | 'video-production'        // Video generation from prompts, keyframes, motion refs
  | 'sound-production'        // Voice generation, voiceover, music, songs
  | 'document-production'     // Reports, proposals, presentations, charts, contracts
  | 'code-production'         // App ideas, architecture, frontend, backend, tests
  | 'image-assembly'          // Post-production for static image deliverables
  | 'video-assembly'          // Post-production: editing, localisation, subtitling
  // ══ ORGANISE domain ══
  | 'email-organisation'      // Classify, forward, organise, remind
  | 'file-organisation'       // Structure analysis, monitoring, reorganisation
  | 'calendar-organisation'   // Calendar, meeting notes, meeting prep
  | 'data-organisation'       // DB normalise, deduplicate, static data, migration
  // ══ COMMUNICATE domain ══
  | 'email-comms'             // Reply drafter, reply ideas, email sender
  | 'messaging-comms'         // WhatsApp, Viber, Discord, SMS — reply and send
  | 'presentation-comms'      // Data summaries, dashboards, branded decks
  | 'bot-comms'               // Staff/customer support bots (chat, voice, talking head)
  | 'distribution';           // Posting, scheduling across platforms

// ─── Agent identifiers (every agent in the system) ──────────────────────────

export type AgentId =
  // ── RESEARCH team ──
  | 'audience-research'
  | 'brand-voice-research'
  | 'competitive-trend-research'
  | 'social-media-trend-research'
  | 'deep-research'
  | 'general-analysis'
  | 'web-scraper'
  | 'data-extractor'
  | 'social-media-monitor'
  | 'webpage-monitor'
  | 'regulatory-monitor'
  | 'news-monitor'
  | 'competitor-monitor'
  | 'youtube-channel-analyser'
  | 'content-calendar'
  | 'performance-report'
  // ── TEXT ANALYSIS team ──
  | 'document-summariser'
  | 'email-analyser'
  | 'feed-summariser'
  | 'message-analyser'
  | 'ocr-extractor'
  | 'trend-identifier'
  | 'sentiment-analyser'
  | 'legal-clause-analyser'
  | 'contract-risk-assessor'
  // ── DATA ANALYSIS team ──
  | 'database-auditor'
  | 'data-quality-checker'
  | 'relationship-mapper'
  | 'spreadsheet-analyser'
  | 'statistical-analyser'
  | 'data-profiler'
  | 'sql-query-agent'
  // ── CODE ANALYSIS team ──
  | 'bug-detector'
  | 'optimisation-advisor'
  | 'missing-coverage-identifier'
  | 'architecture-reviewer'
  | 'security-scanner'
  | 'schema-reviewer'
  // ── MEDIA ANALYSIS team ──
  | 'image-encoder'
  | 'image-summariser'
  | 'style-identifier'
  | 'mood-identifier'
  | 'brand-consistency-checker'
  | 'video-summariser'
  | 'movement-analyser'
  | 'cctv-analyser'
  | 'transcript-extractor'
  | 'voice-parameter-analyser'
  // ── COPY PRODUCTION team ── (Creative Director oversees all production sub-teams)
  | 'creative-director'
  | 'concept-creation'
  | 'screenplay'
  | 'copywriter'
  | 'tagline'
  | 'social-copy'
  | 'blog-article-writer'
  | 'email-sequence-writer'
  | 'prompt-engineer'
  // ── IMAGE PRODUCTION team ──
  | 'image-producer'
  | 'character-builder'
  | 'character-frames'
  | 'character-variations'
  | 'faithful-formatter'
  | 'faithful-image-reproduction'
  | 'style-transfer'
  | 'image-editor'
  // ── VIDEO PRODUCTION team ──
  | 'video-producer'
  | 'video-from-keyframes'
  | 'video-from-prompt'
  | 'video-from-start-image'
  | 'video-from-motion-reference'
  | 'video-stitching'
  | 'music-generation'
  // ── SOUND PRODUCTION team ──
  | 'voice-generator'
  | 'voiceover-producer'
  | 'music-track-generator'
  | 'style-matched-music'
  | 'song-creator'
  // ── DOCUMENT PRODUCTION team ──
  | 'report-generator'
  | 'proposal-generator'
  | 'presentation-creator'
  | 'financial-summary-builder'
  | 'chart-creator'
  | 'diagram-builder'
  | 'contract-drafter'
  | 'invoice-processor'
  | 'bank-statement-parser'
  | 'reconciliation-matcher'
  // ── CODE PRODUCTION team ──
  | 'app-idea-generator'
  | 'architecture-designer'
  | 'frontend-builder'
  | 'backend-builder'
  | 'test-generator'
  | 'code-documenter'
  // ── QA (shared across production sub-teams) ──
  | 'qa-consistency'
  | 'verification'
  // ── VIDEO ASSEMBLY team ──
  | 'text-overlay'
  | 'music-direction'
  | 'caption'
  | 'composition'
  | 'shotstack-render'
  | 'video-editing'
  | 'voiceover'
  | 'sound-sync'
  | 'translator'
  | 'cultural-reviewer'
  | 'subtitles-hooks'
  | 'thumbnail'
  | 'video-assembly-reviewer'
  // ── IMAGE ASSEMBLY team ──
  | 'image-frame-adjustments'
  | 'image-copy-research'
  | 'image-assembly'
  | 'image-assembly-reviewer'
  // ── EMAIL ORGANISATION team ──
  | 'email-classifier'
  | 'email-auto-forwarder'
  | 'email-organiser'
  | 'correspondence-summariser'
  | 'email-reminder'
  // ── FILE ORGANISATION team ──
  | 'file-structure-analyser'
  | 'file-structure-monitor'
  | 'reorganisation-advisor'
  | 'missing-info-detector'
  | 'training-repo-builder'
  // ── CALENDAR ORGANISATION team ──
  | 'calendar-organiser'
  | 'meeting-notes-processor'
  | 'meeting-prep-brief'
  // ── DATA ORGANISATION team ──
  | 'database-normaliser'
  | 'data-deduplicator'
  | 'static-data-maintainer'
  | 'data-migration-planner'
  // ── EMAIL COMMS team ──
  | 'reply-drafter'
  | 'reply-idea-generator'
  | 'email-sender'
  | 'correspondence-tracker'
  // ── MESSAGING COMMS team ──
  | 'message-reply-drafter'
  | 'message-idea-generator'
  | 'message-sender'
  | 'message-reminder'
  // ── PRESENTATION COMMS team ──
  | 'data-summary-presenter'
  | 'dashboard-creator'
  | 'branded-presentation-builder'
  | 'interactive-presentation-builder'
  // ── BOT COMMS team ──
  | 'staff-support-bot'
  | 'customer-support-bot'
  // ── DISTRIBUTION team ──
  | 'posting'
  | 'scheduling';

// ─── Tool identifiers (external capabilities agents can use) ────────────────

export type ToolId =
  // File & Document tools
  | 'file-read'              // Read local files (.docx, .pdf, .xlsx, .csv, .md, .txt)
  | 'file-write'             // Write/create files
  | 'file-list'              // List directory contents
  | 'gdrive-read'            // Read from Google Drive
  | 'gdrive-write'           // Write to Google Drive
  // Web tools
  | 'web-search'             // Search the web
  | 'web-fetch'              // Fetch and parse a URL
  | 'web-scrape'             // Structured web scraping
  // Data tools
  | 'sql-query'              // Execute SQL queries against databases
  | 'sql-schema'             // Read database schema
  | 'spreadsheet-read'       // Read Excel/CSV files
  | 'spreadsheet-write'      // Write Excel/CSV files
  | 'airtable-read'          // Read from Airtable
  | 'airtable-write'         // Write to Airtable
  // Communication tools
  | 'gmail-read'             // Read Gmail messages
  | 'gmail-send'             // Send Gmail messages
  | 'gmail-draft'            // Create Gmail drafts
  | 'calendar-read'          // Read Google Calendar
  | 'calendar-write'         // Create/update calendar events
  | 'whatsapp-send'          // Send WhatsApp messages
  | 'slack-send'             // Send Slack messages
  // AI tools
  | 'gemini-generate'        // Gemini text/image/video generation
  | 'claude-generate'        // Claude text generation
  | 'vertex-imagen'          // Vertex AI Imagen 3
  | 'dall-e'                 // DALL-E image generation
  | 'fal-ai'                 // fal.ai (Seedance, Kling, Flux)
  | 'elevenlabs'             // ElevenLabs voice synthesis
  // Design tools
  | 'canva-create'           // Create Canva designs
  | 'canva-edit'             // Edit Canva designs
  | 'figma-read'             // Read Figma designs
  // Automation tools
  | 'n8n-trigger'            // Trigger n8n workflows
  | 'n8n-webhook'            // Receive n8n webhook data
  | 'cron-schedule';         // Schedule recurring tasks

// ─── Tool requirement (what an agent needs) ─────────────────────────────────

export interface ToolRequirement {
  toolId: ToolId;
  /** Whether this tool is required (vs optional fallback) */
  required: boolean;
  /** Why the agent needs this tool */
  purpose: string;
}

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

// ─── Mo Guidance (AI coaching per step) ──────────────────────────────────────

export interface MoGuidance {
  /** What Mo tells the user before they start this step */
  instructions: string;
  /** Bullet-point checklist Mo shows the user */
  checklist?: string[];
  /** What Mo should validate when user clicks "Check My Work" */
  validationPrompt?: string;
  /** Pass/fail criteria (displayed as tooltips or badges) */
  approvalCriteria?: string[];
  /** Tips Mo shows after approval to prep for the next step */
  nextStepTip?: string;
}

// ─── Step input type (what the user provides in upload steps) ────────────────

export type StepInputType =
  | 'upload-images'
  | 'upload-video'
  | 'upload-documents'      // .docx, .pdf, .xlsx, .csv, .md, .txt
  | 'upload-any'            // Any file type
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'toggle'
  | 'email-select'          // Pick from Gmail inbox
  | 'file-browse'           // Browse local/shared drive
  | 'sql-connection'        // Database connection string
  | 'none';

export interface StepInput {
  /** Unique ID for this input */
  id: string;
  /** Display label */
  label: string;
  /** Input type */
  type: StepInputType;
  /** Whether this input is required */
  required: boolean;
  /** Allow multiple files/values */
  multiple?: boolean;
  /** Placeholder or helper text */
  placeholder?: string;
  /** Accepted file types (for uploads) */
  accept?: string;
  /** Minimum number of items */
  min?: number;
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
  /** Mo's guidance for this step (coaching instructions, validation, tips) */
  moGuidance?: MoGuidance;
  /** Structured inputs the user provides in this step */
  stepInputs?: StepInput[];
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
  /** Category for grouping in the UI (aligned to 5 domains + sub-categories) */
  category:
    | 'research'            // Research domain templates
    | 'analysis'            // Analyse domain templates
    | 'marketing'           // Create domain — marketing content
    | 'training'            // Create domain — staff training
    | 'social'              // Create domain — social media
    | 'live'                // Create domain — live commerce
    | 'documents'           // Create domain — reports, proposals, contracts
    | 'code'                // Create domain — software development
    | 'organisation'        // Organise domain templates
    | 'communication'       // Communicate domain templates
    | 'finance'             // Finance & admin automation
    | 'legal'               // Legal review & contract analysis
    | 'custom';             // User-created templates
  /** Which domain this template belongs to */
  domain?: DomainId;
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
    primary: 'video' | 'image' | 'audio' | 'document' | 'data' | 'email' | 'message' | 'presentation' | 'code' | 'report' | 'mixed';
    /** Expected deliverable formats */
    formats?: string[];
    /** Whether Shotstack composition is used for final assembly */
    usesShotstack?: boolean;
    /** Where to save output (project folder, Drive, email, etc.) */
    destination?: 'project' | 'gdrive' | 'email' | 'download' | 'clipboard';
  };

  /** Tools this template requires (checked at runtime) */
  requiredTools?: ToolId[];

  /** Scheduling configuration (for recurring templates like monitors) */
  schedule?: {
    /** Whether this template can run on a schedule */
    schedulable: boolean;
    /** Suggested interval */
    suggestedInterval?: 'hourly' | 'daily' | 'weekly' | 'monthly';
    /** Cron expression for custom scheduling */
    cronExpression?: string;
  };

  /** Tags for search/filtering */
  tags?: string[];
  /** Whether this is a built-in template (vs user-created) */
  builtIn?: boolean;
}

// ─── Template registry ───────────────────────────────────────────────────────

export type TemplateRegistry = Record<string, TemplateConfig>;
