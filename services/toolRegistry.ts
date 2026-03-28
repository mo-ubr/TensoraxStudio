/**
 * Tool Registry — external capabilities that agents can use.
 *
 * Tools are the "hands" of agents. An agent prompt generates intent;
 * tools execute it in the real world (read files, query databases,
 * send emails, generate images, etc.).
 *
 * Each tool has:
 *   - A unique ID matching ToolId from templateConfig.ts
 *   - A human-readable name and description
 *   - An availability check (is the tool configured / API key present?)
 *   - An execute function (runs the tool with given parameters)
 *
 * Tools are registered at app startup. Agents declare which tools they
 * need via ToolRequirement[]. The runner checks availability before
 * executing and provides tool results back to the agent.
 */

import type { ToolId } from '../templates/templateConfig';

// ─── Tool Status ────────────────────────────────────────────────────────────

export type ToolStatus = 'available' | 'not_configured' | 'error';

export interface ToolAvailability {
  toolId: ToolId;
  status: ToolStatus;
  message?: string;
  /** What's needed to make this tool available (for user-facing messages) */
  setupHint?: string;
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  category: 'file' | 'web' | 'data' | 'communication' | 'ai' | 'design' | 'automation';
  /** Check if this tool is currently available (API key set, service reachable) */
  checkAvailability: () => ToolAvailability;
  /** Human-readable setup instructions */
  setupInstructions: string;
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

function hasLocalStorageKey(key: string): boolean {
  if (typeof window === 'undefined') return false;
  const val = localStorage.getItem(key);
  return !!(val && val.trim() && !/placeholder/i.test(val));
}

function hasEnvVar(key: string): boolean {
  try {
    const val = (import.meta as any)?.env?.[key];
    return !!(val && val.trim());
  } catch {
    return false;
  }
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ── File & Document tools ──
  {
    id: 'file-read',
    name: 'File Reader',
    description: 'Read local files (.docx, .pdf, .xlsx, .csv, .md, .txt)',
    category: 'file',
    checkAvailability: () => ({ toolId: 'file-read', status: 'available' }),
    setupInstructions: 'Available by default — requires backend server running (npm run dev:full)',
  },
  {
    id: 'file-write',
    name: 'File Writer',
    description: 'Write/create files to local filesystem',
    category: 'file',
    checkAvailability: () => ({ toolId: 'file-write', status: 'available' }),
    setupInstructions: 'Available by default — requires backend server running',
  },
  {
    id: 'file-list',
    name: 'Directory Lister',
    description: 'List directory contents on local or shared drives',
    category: 'file',
    checkAvailability: () => ({ toolId: 'file-list', status: 'available' }),
    setupInstructions: 'Available by default — requires backend server running',
  },
  {
    id: 'gdrive-read',
    name: 'Google Drive Reader',
    description: 'Read files and folder structure from Google Drive',
    category: 'file',
    checkAvailability: () => ({
      toolId: 'gdrive-read',
      status: hasEnvVar('VITE_GOOGLE_DRIVE_FOLDER_ID') || hasEnvVar('GOOGLE_DRIVE_FOLDER_ID') ? 'available' : 'not_configured',
      setupHint: 'Set GOOGLE_DRIVE_FOLDER_ID in environment and configure Google Drive API credentials',
    }),
    setupInstructions: 'Set GOOGLE_DRIVE_FOLDER_ID env var and provide Google service account credentials',
  },
  {
    id: 'gdrive-write',
    name: 'Google Drive Writer',
    description: 'Upload files and create folders in Google Drive',
    category: 'file',
    checkAvailability: () => ({
      toolId: 'gdrive-write',
      status: hasEnvVar('VITE_GOOGLE_DRIVE_FOLDER_ID') || hasEnvVar('GOOGLE_DRIVE_FOLDER_ID') ? 'available' : 'not_configured',
      setupHint: 'Set GOOGLE_DRIVE_FOLDER_ID in environment and configure Google Drive API credentials',
    }),
    setupInstructions: 'Set GOOGLE_DRIVE_FOLDER_ID env var and provide Google service account credentials',
  },

  // ── Web tools ──
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for information',
    category: 'web',
    checkAvailability: () => ({
      toolId: 'web-search',
      status: hasLocalStorageKey('gemini_api_key') ? 'available' : 'not_configured',
      setupHint: 'Requires Gemini API key (uses Gemini grounding/search)',
    }),
    setupInstructions: 'Set a Gemini API key in Project Settings — web search uses Gemini grounding',
  },
  {
    id: 'web-fetch',
    name: 'Web Page Fetcher',
    description: 'Fetch and parse a URL into structured content',
    category: 'web',
    checkAvailability: () => ({ toolId: 'web-fetch', status: 'available' }),
    setupInstructions: 'Available by default via backend proxy',
  },
  {
    id: 'web-scrape',
    name: 'Web Scraper',
    description: 'Structured web scraping with CSS selectors',
    category: 'web',
    checkAvailability: () => ({ toolId: 'web-scrape', status: 'available' }),
    setupInstructions: 'Available by default via backend',
  },

  // ── Data tools ──
  {
    id: 'sql-query',
    name: 'SQL Query Runner',
    description: 'Execute SQL queries against connected databases',
    category: 'data',
    checkAvailability: () => ({
      toolId: 'sql-query',
      status: hasLocalStorageKey('sql_connection_string') ? 'available' : 'not_configured',
      setupHint: 'Set SQL connection string in Project Settings to connect to TensorAx Retail or other databases',
    }),
    setupInstructions: 'Set sql_connection_string in Project Settings (supports SQL Server, PostgreSQL, SQLite)',
  },
  {
    id: 'sql-schema',
    name: 'SQL Schema Reader',
    description: 'Read database schema (tables, columns, relationships)',
    category: 'data',
    checkAvailability: () => ({
      toolId: 'sql-schema',
      status: hasLocalStorageKey('sql_connection_string') ? 'available' : 'not_configured',
      setupHint: 'Set SQL connection string in Project Settings',
    }),
    setupInstructions: 'Requires sql_connection_string — same as SQL Query Runner',
  },
  {
    id: 'spreadsheet-read',
    name: 'Spreadsheet Reader',
    description: 'Read Excel (.xlsx) and CSV files',
    category: 'data',
    checkAvailability: () => ({ toolId: 'spreadsheet-read', status: 'available' }),
    setupInstructions: 'Available by default via backend',
  },
  {
    id: 'spreadsheet-write',
    name: 'Spreadsheet Writer',
    description: 'Create and write Excel (.xlsx) and CSV files',
    category: 'data',
    checkAvailability: () => ({ toolId: 'spreadsheet-write', status: 'available' }),
    setupInstructions: 'Available by default via backend',
  },
  {
    id: 'airtable-read',
    name: 'Airtable Reader',
    description: 'Read data from Airtable bases and tables',
    category: 'data',
    checkAvailability: () => ({
      toolId: 'airtable-read',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Airtable MCP server',
  },
  {
    id: 'airtable-write',
    name: 'Airtable Writer',
    description: 'Create and update records in Airtable',
    category: 'data',
    checkAvailability: () => ({
      toolId: 'airtable-write',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Airtable MCP server',
  },

  // ── Communication tools ──
  {
    id: 'gmail-read',
    name: 'Gmail Reader',
    description: 'Read Gmail messages and threads',
    category: 'communication',
    checkAvailability: () => ({
      toolId: 'gmail-read',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Gmail MCP server',
  },
  {
    id: 'gmail-send',
    name: 'Gmail Sender',
    description: 'Send emails via Gmail',
    category: 'communication',
    checkAvailability: () => ({
      toolId: 'gmail-send',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Gmail MCP server',
  },
  {
    id: 'gmail-draft',
    name: 'Gmail Draft Creator',
    description: 'Create email drafts in Gmail',
    category: 'communication',
    checkAvailability: () => ({
      toolId: 'gmail-draft',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Gmail MCP server',
  },
  {
    id: 'calendar-read',
    name: 'Calendar Reader',
    description: 'Read Google Calendar events',
    category: 'communication',
    checkAvailability: () => ({
      toolId: 'calendar-read',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Google Calendar MCP server',
  },
  {
    id: 'calendar-write',
    name: 'Calendar Writer',
    description: 'Create and update Google Calendar events',
    category: 'communication',
    checkAvailability: () => ({
      toolId: 'calendar-write',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Google Calendar MCP server',
  },
  {
    id: 'whatsapp-send',
    name: 'WhatsApp Sender',
    description: 'Send messages via WhatsApp Business API',
    category: 'communication',
    checkAvailability: () => ({
      toolId: 'whatsapp-send',
      status: 'not_configured',
      setupHint: 'WhatsApp Business API integration not yet configured',
    }),
    setupInstructions: 'Configure WhatsApp Business API credentials in settings',
  },
  {
    id: 'slack-send',
    name: 'Slack Sender',
    description: 'Send messages to Slack channels or DMs',
    category: 'communication',
    checkAvailability: () => ({
      toolId: 'slack-send',
      status: 'not_configured',
      setupHint: 'Slack integration not yet configured',
    }),
    setupInstructions: 'Configure Slack webhook URL or bot token in settings',
  },

  // ── AI tools ──
  {
    id: 'gemini-generate',
    name: 'Gemini AI',
    description: 'Text, image, and video generation via Google Gemini',
    category: 'ai',
    checkAvailability: () => ({
      toolId: 'gemini-generate',
      status: hasLocalStorageKey('gemini_api_key') ? 'available' : 'not_configured',
      setupHint: 'Set Gemini API key in Project Settings',
    }),
    setupInstructions: 'Set gemini_api_key in Project Settings',
  },
  {
    id: 'claude-generate',
    name: 'Claude AI',
    description: 'Text generation and analysis via Anthropic Claude',
    category: 'ai',
    checkAvailability: () => ({
      toolId: 'claude-generate',
      status: hasLocalStorageKey('claude_api_key') ? 'available' : 'not_configured',
      setupHint: 'Set Claude API key in Project Settings',
    }),
    setupInstructions: 'Set claude_api_key in Project Settings',
  },
  {
    id: 'vertex-imagen',
    name: 'Vertex AI Imagen 3',
    description: 'Enterprise image generation via GCP Vertex AI',
    category: 'ai',
    checkAvailability: () => ({
      toolId: 'vertex-imagen',
      status: hasEnvVar('GOOGLE_APPLICATION_CREDENTIALS') ? 'available' : 'not_configured',
      setupHint: 'Set GOOGLE_APPLICATION_CREDENTIALS to GCP service account JSON path',
    }),
    setupInstructions: 'Set GOOGLE_APPLICATION_CREDENTIALS env var pointing to GCP service account JSON',
  },
  {
    id: 'dall-e',
    name: 'DALL-E 3',
    description: 'Image generation via OpenAI DALL-E',
    category: 'ai',
    checkAvailability: () => ({
      toolId: 'dall-e',
      status: hasEnvVar('OPENAI_API_KEY') ? 'available' : 'not_configured',
      setupHint: 'Set OPENAI_API_KEY in environment',
    }),
    setupInstructions: 'Set OPENAI_API_KEY env var',
  },
  {
    id: 'fal-ai',
    name: 'fal.ai',
    description: 'Seedance, Kling, Flux Kontext video and image generation',
    category: 'ai',
    checkAvailability: () => ({
      toolId: 'fal-ai',
      status: hasEnvVar('FAL_API_KEY') ? 'available' : 'not_configured',
      setupHint: 'Set FAL_API_KEY in environment',
    }),
    setupInstructions: 'Set FAL_API_KEY env var',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Voice synthesis and text-to-speech',
    category: 'ai',
    checkAvailability: () => ({
      toolId: 'elevenlabs',
      status: hasLocalStorageKey('elevenlabs_api_key') ? 'available' : 'not_configured',
      setupHint: 'Set ElevenLabs API key in Project Settings',
    }),
    setupInstructions: 'Set elevenlabs_api_key in Project Settings',
  },

  // ── Design tools ──
  {
    id: 'canva-create',
    name: 'Canva Creator',
    description: 'Create designs in Canva',
    category: 'design',
    checkAvailability: () => ({
      toolId: 'canva-create',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Canva MCP server',
  },
  {
    id: 'canva-edit',
    name: 'Canva Editor',
    description: 'Edit existing Canva designs',
    category: 'design',
    checkAvailability: () => ({
      toolId: 'canva-edit',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Canva MCP server',
  },
  {
    id: 'figma-read',
    name: 'Figma Reader',
    description: 'Read Figma designs and extract design context',
    category: 'design',
    checkAvailability: () => ({
      toolId: 'figma-read',
      status: 'available', // via MCP
    }),
    setupInstructions: 'Connected via Figma MCP server',
  },

  // ── Automation tools ──
  {
    id: 'n8n-trigger',
    name: 'n8n Workflow Trigger',
    description: 'Trigger n8n workflows via webhook',
    category: 'automation',
    checkAvailability: () => ({
      toolId: 'n8n-trigger',
      status: hasLocalStorageKey('n8n_webhook_url') ? 'available' : 'not_configured',
      setupHint: 'Set n8n webhook base URL in Project Settings',
    }),
    setupInstructions: 'Set n8n_webhook_url in Project Settings',
  },
  {
    id: 'n8n-webhook',
    name: 'n8n Webhook Receiver',
    description: 'Receive data from n8n webhook calls',
    category: 'automation',
    checkAvailability: () => ({ toolId: 'n8n-webhook', status: 'available' }),
    setupInstructions: 'Available by default via backend webhook endpoint',
  },
  {
    id: 'cron-schedule',
    name: 'Scheduler',
    description: 'Schedule recurring tasks (cron-based)',
    category: 'automation',
    checkAvailability: () => ({ toolId: 'cron-schedule', status: 'available' }),
    setupInstructions: 'Available by default',
  },
];

// ─── Registry (singleton) ───────────────────────────────────────────────────

const toolMap = new Map<ToolId, ToolDefinition>();

// Populate on module load
for (const tool of TOOL_DEFINITIONS) {
  toolMap.set(tool.id, tool);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Get all registered tools */
export function getAllTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

/** Get a single tool by ID */
export function getTool(id: ToolId): ToolDefinition | undefined {
  return toolMap.get(id);
}

/** Check availability of a specific tool */
export function checkTool(id: ToolId): ToolAvailability {
  const tool = toolMap.get(id);
  if (!tool) return { toolId: id, status: 'error', message: `Unknown tool: ${id}` };
  return tool.checkAvailability();
}

/** Check availability of multiple tools (e.g. for a template's requiredTools) */
export function checkTools(ids: ToolId[]): ToolAvailability[] {
  return ids.map(id => checkTool(id));
}

/** Get all available tools */
export function getAvailableTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter(t => t.checkAvailability().status === 'available');
}

/** Get tools grouped by category */
export function getToolsByCategory(): Record<string, ToolDefinition[]> {
  const groups: Record<string, ToolDefinition[]> = {};
  for (const tool of TOOL_DEFINITIONS) {
    if (!groups[tool.category]) groups[tool.category] = [];
    groups[tool.category].push(tool);
  }
  return groups;
}

/** Build a summary string for Mo's system prompt — which tools are available */
export function buildToolAvailabilitySummary(): string {
  const available = getAvailableTools();
  const notConfigured = TOOL_DEFINITIONS.filter(t => t.checkAvailability().status === 'not_configured');

  const lines = [
    `AVAILABLE (${available.length}):`,
    ...available.map(t => `  [${t.id}] ${t.name} — ${t.description}`),
  ];

  if (notConfigured.length > 0) {
    lines.push('');
    lines.push(`NOT CONFIGURED (${notConfigured.length}) — ask Mariella to set up:`);
    lines.push(...notConfigured.map(t => {
      const avail = t.checkAvailability();
      return `  [${t.id}] ${t.name} — ${avail.setupHint || t.setupInstructions}`;
    }));
  }

  return lines.join('\n');
}
