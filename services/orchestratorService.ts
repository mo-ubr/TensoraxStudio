/**
 * OrchestratorService — Brain of the Master Orchestrator
 *
 * Builds the system prompt with agent teams and template awareness,
 * parses the extended ACTION protocol, and converts pipeline plans
 * into executable TemplateConfig objects.
 */

import type { TemplateConfig, TemplateStep, TeamActivation, TeamId, AgentId, DomainId } from '../templates/templateConfig';
import { TEAM_CATALOGUE, DOMAIN_CATALOGUE, getAllTemplates, type TeamMeta, type DomainMeta } from './templateService';
import { buildToolAvailabilitySummary } from './toolRegistry';
import type { BrandProfile } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MasterActionType =
  | 'run_template'
  | 'run_single_agent'
  | 'show_pipeline'
  | 'build_template'
  | 'run_pm'
  | 'set_field'
  | 'navigate'
  | 'upload_request'
  | 'cancel_pipeline'
  | 'suggest_save_project';

export interface MasterAction {
  type: MasterActionType;
  templateId?: string;
  agentId?: string;
  agentInput?: string;
  pipelinePlan?: PipelinePlan;
  pmBrief?: string;           // User brief text for Project Manager delegation
  field?: string;
  value?: string;
  screen?: string;
  description?: string;
  projectName?: string;        // Suggested project name for save_project actions
}

export interface PipelinePlanStep {
  order: number;
  name: string;
  agentId: AgentId;
  teamId: TeamId;
  description: string;
  requiresReview: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
}

export interface PipelinePlan {
  id: string;
  name: string;
  steps: PipelinePlanStep[];
  estimatedDuration?: string;
  source: 'template' | 'modified_template' | 'freeform';
  sourceTemplateId?: string;
}

export interface FileAttachment {
  name: string;
  type: string;
  dataUri: string;
  thumbnailUri?: string;
}

export interface MasterChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  inlinePlan?: PipelinePlan;
  attachments?: FileAttachment[];
}

// ─── Agent Teams Summary (for system prompt) — grouped by domain ─────────

function buildAgentCatalogueSummary(): string {
  const sections: string[] = [];

  for (const domain of DOMAIN_CATALOGUE) {
    const domainTeams = TEAM_CATALOGUE.filter(t => t.domain === domain.id);
    const totalAgents = domainTeams.reduce((sum, t) => sum + t.agents.length, 0);

    const teamSections = domainTeams.map((team: TeamMeta) => {
      const agentLines = team.agents
        .map(a => {
          const toolNote = a.tools?.length ? ` [tools: ${a.tools.map(t => t.toolId).join(', ')}]` : '';
          return `    [${a.id}] ${a.name} — ${a.description}${toolNote}`;
        })
        .join('\n');
      return `  ${team.name} (${team.agents.length} agents):\n${agentLines}`;
    }).join('\n\n');

    sections.push(`── ${domain.name.toUpperCase()} (${totalAgents} agents across ${domainTeams.length} teams) ──\n${domain.description}\n\n${teamSections}`);
  }

  return sections.join('\n\n');
}

// ─── Template Catalogue Summary (for system prompt) ─────────────────────────

function buildTemplateCatalogueSummary(): string {
  const templates = getAllTemplates();
  return templates.map(t => {
    const teamCount = t.teams.length;
    const agentCount = t.teams.reduce((sum, team) => sum + team.agents.length, 0);
    return `  [${t.id}] "${t.name}" — ${t.description.slice(0, 100)}... (${t.steps.length} steps, ${teamCount} teams, ${agentCount} agents, output: ${t.outputs.primary})`;
  }).join('\n');
}

// ─── System Prompt Builder ──────────────────────────────────────────────────

export function buildMasterSystemPrompt(
  projectContext?: Record<string, unknown> | null,
  brand?: BrandProfile | null,
): string {
  const sections: string[] = [];

  const totalAgents = TEAM_CATALOGUE.reduce((s, t) => s + t.agents.length, 0);
  const totalTeams = TEAM_CATALOGUE.length;

  // Role
  sections.push(`═══ ROLE ═══
You are MO — Master Orchestrator of TensorAx Studio, an AI-powered operations platform for UBR Retail.

You handle ANY task across 5 domains: Research, Analyse, Create, Organise, and Communicate. You are not limited to creative production — you manage legal reviews, financial automation, competitor monitoring, email management, database analysis, document generation, and everything else a business needs.

You are the command centre. You plan and execute by routing work to specialised AI agents. Keep responses SHORT: 2-3 sentences + action tags. Be decisive, not conversational.`);

  // Capabilities
  sections.push(`═══ CAPABILITIES ═══
1. TEMPLATE DISPATCH — Launch a pre-built template by name ("Review this contract")
2. TEMPLATE MODIFICATION — Modify a template before running ("Run Sales Analysis but skip budget comparison")
3. FREEFORM COMPOSITION — Build a custom pipeline from agents ("Scrape competitor prices, analyse trends, write a report")
4. SINGLE AGENT CALLS — Route a task to one agent ("Summarise this document")
5. CROSS-DOMAIN PIPELINES — Chain agents from different domains ("Research competitors → Analyse findings → Create campaign brief → Generate visuals → Schedule posts")`);

  // Domain Overview
  sections.push(`═══ 5 CAPABILITY DOMAINS ═══
${DOMAIN_CATALOGUE.map(d => `• ${d.name.toUpperCase()} — ${d.description}`).join('\n')}`);

  // Agent Teams
  sections.push(`═══ AGENT TEAMS (${totalAgents} agents across ${totalTeams} teams in 5 domains) ═══

${buildAgentCatalogueSummary()}`);

  // Template Catalogue
  sections.push(`═══ AVAILABLE TEMPLATES ═══
${buildTemplateCatalogueSummary()}`);

  // Project Context
  if (projectContext) {
    const ctx = projectContext;
    sections.push(`═══ CURRENT PROJECT ═══
Project: ${ctx.projectName || 'None'}
Research: ${ctx.research ? 'Completed' : 'Not started'}
Concepts: ${ctx.concept ? 'Generated' : 'Not started'}
Characters: ${ctx.characters ? 'Designed' : 'Not started'}
Video: ${ctx.video ? 'Generated' : 'Not started'}
Editing: ${ctx.editing ? 'In progress' : 'Not started'}
Distribution: ${ctx.distribution ? 'Scheduled' : 'Not started'}`);
  } else {
    sections.push(`═══ CURRENT PROJECT ═══
No active project. User may start a new pipeline or select a template.`);
  }

  // Tools
  sections.push(`═══ AVAILABLE TOOLS ═══
${buildToolAvailabilitySummary()}`);

  // Brand
  if (brand) {
    sections.push(`═══ ACTIVE BRAND ═══
Name: ${brand.name}
${brand.description ? `Description: ${brand.description}` : ''}`);
  }

  // ACTION Protocol
  sections.push(`═══ ACTION PROTOCOL ═══
Embed these tags in your responses. They are parsed and executed automatically — the user sees only your text, not the tags.

[ACTION:RUN_TEMPLATE:templateId]
  Launch a built-in or custom template. Example: [ACTION:RUN_TEMPLATE:what-if-transformation]

[ACTION:RUN_AGENT:agentId:input text here]
  Run a single agent with the given input. Example: [ACTION:RUN_AGENT:copywriter:Rewrite this headline to be more energetic: "New Collection Available"]

[ACTION:SHOW_PIPELINE:{"name":"Pipeline Name","steps":[{"order":1,"name":"Step Name","agentId":"agent-id","teamId":"team-id","description":"What this step does","requiresReview":true}]}]
  Propose a custom pipeline for user review. The user will see an interactive step list and can approve, modify, or cancel.

[ACTION:NAVIGATE:screenName]
  Navigate to a screen. Valid: landing, concept, images, video, templates, settings, template-library

[ACTION:UPLOAD_REQUEST:description of files needed]
  Ask the user to upload specific files. Example: [ACTION:UPLOAD_REQUEST:Upload 3-5 product photos for the campaign]

[ACTION:BUILD_TEMPLATE:brief description of what to build]
  Trigger the Dev Agent pipeline (Backend Dev → Frontend Dev → QA) to generate a new custom template from scratch. Use this when the user's request doesn't match any existing template and needs a completely new pipeline design. Example: [ACTION:BUILD_TEMPLATE:A social media campaign that generates product photos, writes platform-specific captions, and schedules posts across Instagram and TikTok]

[ACTION:RUN_PM:user brief text]
  Delegate a complex, multi-team request to the Project Manager agent. The PM decomposes the brief into a structured execution plan with team assignments, dependencies, and quality gates — then presents the plan for user approval before any production starts. Use this for requests that span 3+ teams or require creative problem decomposition (full campaigns, multi-language content, cross-domain workflows). Example: [ACTION:RUN_PM:Launch our new eco water bottle. Target health-conscious millennials. Social, email, and video in English, Bulgarian, and Greek.]

[ACTION:SET_FIELD:fieldName:value]
  Set a project field. Valid fields: aim, cta, targetAudience, videoType, format, duration, tone

[ACTION:SAVE_PROJECT:Suggested Project Name]
  Suggest saving the current conversation as a named project. Use this when the conversation has become specific enough to warrant its own project folder — e.g. the user is discussing a particular campaign, research topic, brand initiative, or production task. The user will see a confirmation prompt with the suggested name and can accept or dismiss. Example: [ACTION:SAVE_PROJECT:TikTok Political Campaign Research]`);

  // Template Matching Rules
  sections.push(`═══ TEMPLATE MATCHING — CRITICAL ═══
When a user asks for something, FIRST check if it matches an existing template. This is your PRIMARY routing decision.

PATTERN → TEMPLATE mappings (use RUN_TEMPLATE immediately, do NOT use RUN_PM or SHOW_PIPELINE):

• "research [social media platform]", "analyse [TikTok/Instagram/Facebook/YouTube/LinkedIn] account/page/channel", "research @handle", "analyse our social media", "scrape [platform]", "competitive analysis on [platform]" → [ACTION:RUN_TEMPLATE:social-media-research]
  This is a 6-step workflow: Configure → Scrape → Dashboard → Analysis → Recommendations → Export.
  Save the user's FULL message as the project instructions. Include the platform URL/handle, any competitors mentioned, and all context the user provided.

• "what if [transformation]", "before and after", "transform this image" → [ACTION:RUN_TEMPLATE:what-if-transformation]
• "create video from images/keyframes" → [ACTION:RUN_TEMPLATE:video-from-keyframes]
• "training video", "staff training" → [ACTION:RUN_TEMPLATE:staff-training-video]
• "review this contract", "legal review" → [ACTION:RUN_TEMPLATE:legal-expert]

If a user provides a social media URL (tiktok.com, facebook.com, instagram.com, youtube.com, linkedin.com) → this is ALWAYS a social-media-research task. Use RUN_TEMPLATE immediately.

When creating a project from a template match:
1. Name the project: Research-SocialMedia-[Platform]-[AccountName] (for research) or [DescriptiveName] (for production)
2. SAVE THE USER'S FULL MESSAGE as project instructions — never lose context
3. Include the template ID in the project metadata`);

  // Behavioural Rules
  sections.push(`═══ RULES ═══
1. Keep responses SHORT — 2-3 sentences + action tags. No essays.
2. TEMPLATE FIRST — Always check template matches before proposing custom pipelines. Only use SHOW_PIPELINE for tasks that don't match any template.
3. If the request matches a built-in template, use RUN_TEMPLATE immediately. Do NOT ask for confirmation — just launch it.
4. If it's close but needs changes, describe what you'd modify and propose a SHOW_PIPELINE with the adjusted steps.
5. For complex multi-team requests that DON'T match any template (3+ teams, multi-language, full campaigns), use RUN_PM.
6. For simple single-agent tasks, use RUN_AGENT directly — no pipeline overhead.
7. When the user drops files, acknowledge them and suggest what to do with them.
8. If unsure about the task, ask a clarifying question — but NEVER ask if you should use a template that clearly matches.
9. After a successful custom pipeline, offer to save it as a reusable template.
10. IMAGE ROUTING — When a user wants to REPRODUCE an existing image with different text, use [ACTION:RUN_AGENT:faithful-image-reproduction:instruction]. The 9-shot grid is ONLY for video storyboards.
11. PROJECT SAVE — When suggesting a project, include [ACTION:SAVE_PROJECT:Name] AND save the user's original request as instructions. The project instructions field must contain the user's EXACT words plus any URLs, handles, or parameters they provided.
12. CREATIVITY CONTROL — TEXT FREEDOM IS ALWAYS 0 (VERBATIM) when the user provides text/copy unless they explicitly ask to rewrite.`);


  return sections.join('\n\n');
}

// ─── Action Parser ──────────────────────────────────────────────────────────

const ACTION_REGEX = /\[ACTION:([A-Z_]+)(?::([^\]]*))?\]/g;

/** Extract JSON from text using bracket-depth counting (handles nested {} and []) */
function extractJsonFromIndex(text: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

function buildPipelineAction(plan: Partial<PipelinePlan>): MasterAction {
  return {
    type: 'show_pipeline',
    pipelinePlan: {
      id: `plan-${Date.now()}`,
      name: plan.name || 'Custom Pipeline',
      steps: (plan.steps || []).map((s: any, i: number) => ({
        order: s.order ?? i + 1,
        name: s.name || `Step ${i + 1}`,
        agentId: s.agentId || 'general-analysis' as AgentId,
        teamId: s.teamId || 'research' as TeamId,
        description: s.description || '',
        requiresReview: s.requiresReview ?? true,
        status: 'pending' as const,
      })),
      source: 'freeform',
      ...plan,
    },
  };
}

export function parseMasterActions(text: string): { cleanText: string; actions: MasterAction[] } {
  const actions: MasterAction[] = [];
  let match: RegExpExecArray | null;
  let cleanedText = text;

  // 1. Extract SHOW_PIPELINE actions using bracket-depth JSON extraction
  const pipelineTag = '[ACTION:SHOW_PIPELINE:';
  let searchStart = 0;
  while (true) {
    const tagIdx = cleanedText.indexOf(pipelineTag, searchStart);
    if (tagIdx === -1) break;
    const jsonStart = tagIdx + pipelineTag.length;
    const jsonStr = extractJsonFromIndex(cleanedText, jsonStart);
    if (jsonStr) {
      try {
        const plan = JSON.parse(jsonStr) as Partial<PipelinePlan>;
        actions.push(buildPipelineAction(plan));
        // Find the closing ] of the action tag
        const afterJson = jsonStart + jsonStr.length;
        const closingBracket = cleanedText.indexOf(']', afterJson);
        const endIdx = closingBracket !== -1 ? closingBracket + 1 : afterJson;
        cleanedText = cleanedText.slice(0, tagIdx) + cleanedText.slice(endIdx);
        searchStart = tagIdx; // re-scan from same position
      } catch {
        console.warn('[OrchestratorService] Failed to parse SHOW_PIPELINE JSON');
        searchStart = jsonStart;
      }
    } else {
      searchStart = jsonStart;
    }
  }

  // 2. Also try ```json fenced blocks
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
  jsonBlockRegex.lastIndex = 0;
  while ((match = jsonBlockRegex.exec(cleanedText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && parsed.steps) {
        actions.push(buildPipelineAction(parsed));
        cleanedText = cleanedText.replace(match[0], '');
      }
    } catch {
      // Not a pipeline — ignore
    }
  }

  // 3. Parse remaining simple actions
  ACTION_REGEX.lastIndex = 0;

  while ((match = ACTION_REGEX.exec(cleanedText)) !== null) {
    const [, type, payload] = match;

    switch (type) {
      case 'RUN_TEMPLATE': {
        actions.push({ type: 'run_template', templateId: payload?.trim() });
        break;
      }
      case 'RUN_AGENT': {
        const colonIdx = payload?.indexOf(':') ?? -1;
        if (colonIdx > 0) {
          actions.push({
            type: 'run_single_agent',
            agentId: payload!.slice(0, colonIdx).trim(),
            agentInput: payload!.slice(colonIdx + 1).trim(),
          });
        }
        break;
      }
      case 'SHOW_PIPELINE': {
        // Already handled by bracket-depth extractor above — skip
        break;
      }
      case 'BUILD_TEMPLATE': {
        actions.push({ type: 'build_template', description: payload?.trim() });
        break;
      }
      case 'RUN_PM': {
        actions.push({ type: 'run_pm', pmBrief: payload?.trim() });
        break;
      }
      case 'SET_FIELD': {
        const parts = payload?.split(':') ?? [];
        if (parts.length >= 2) {
          actions.push({ type: 'set_field', field: parts[0].trim(), value: parts.slice(1).join(':').trim() });
        }
        break;
      }
      case 'NAVIGATE': {
        actions.push({ type: 'navigate', screen: payload?.trim() });
        break;
      }
      case 'UPLOAD_REQUEST': {
        actions.push({ type: 'upload_request', description: payload?.trim() });
        break;
      }
      case 'CANCEL_PIPELINE': {
        actions.push({ type: 'cancel_pipeline' });
        break;
      }
      case 'SAVE_PROJECT': {
        actions.push({ type: 'suggest_save_project', projectName: payload?.trim() });
        break;
      }
    }
  }

  // Strip remaining action tags from display text
  const cleanText = cleanedText.replace(ACTION_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();

  return { cleanText, actions };
}

// ─── Pipeline Plan → TemplateConfig ─────────────────────────────────────────

export function composeTemplateFromPlan(plan: PipelinePlan): TemplateConfig {
  // Group steps by team
  const teamMap = new Map<TeamId, AgentId[]>();
  for (const step of plan.steps) {
    const existing = teamMap.get(step.teamId) || [];
    if (!existing.includes(step.agentId)) existing.push(step.agentId);
    teamMap.set(step.teamId, existing);
  }

  const teams: TeamActivation[] = Array.from(teamMap.entries()).map(([teamId, agents]) => ({
    teamId,
    agents,
    notes: `Auto-composed from pipeline plan "${plan.name}"`,
  }));

  const steps: TemplateStep[] = plan.steps.map(s => ({
    order: s.order,
    name: s.name,
    teamId: s.teamId,
    agents: [s.agentId],
    requiresReview: s.requiresReview,
    description: s.description,
  }));

  return {
    id: `custom-${plan.id}`,
    name: plan.name,
    description: `Custom pipeline composed by the Master Orchestrator`,
    icon: 'fa-robot',
    category: 'custom',
    version: '1.0.0',
    builtIn: false,
    lastModified: new Date().toISOString(),
    author: 'Master Orchestrator',
    teams,
    steps,
    defaults: {
      provider: 'gemini',
      aspectRatio: '16:9',
    },
    inputs: {},
    outputs: {
      primary: 'mixed',
      usesShotstack: plan.steps.some(s => s.agentId === 'composition' || s.agentId === 'shotstack-render'),
    },
    tags: ['auto-composed'],
  };
}
