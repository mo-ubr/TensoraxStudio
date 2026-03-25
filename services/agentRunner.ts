/**
 * AgentRunner — the execution layer for TensoraxStudio's agent architecture.
 *
 * Takes an agent prompt + input data + model preference, calls the right
 * AI provider (Gemini or Claude), parses the JSON response, and returns
 * typed output.
 *
 * This is the single point where all agent prompts meet AI providers.
 * Components and orchestrators never call Gemini/Claude directly — they
 * go through here.
 */

import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { type CreativityLevels, buildCreativityPreamble } from './creativityControl';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'claude';

export interface AgentRunOptions {
  /** The agent's system prompt (from prompts/*.ts) */
  agentPrompt: string;
  /** The user-facing input — what the agent should work on */
  userMessage: string;
  /** Optional images to include (base64 data URIs or URLs) */
  images?: string[];
  /** Which provider to use. Default: auto-detect from stored model preference */
  provider?: AIProvider;
  /** Specific model ID override (e.g. 'gemini-2.5-flash', 'claude-sonnet-4-6') */
  model?: string;
  /** API key override. If omitted, reads from localStorage / env */
  apiKey?: string;
  /** Temperature (0-2). Default: 1 */
  temperature?: number;
  /** Max output tokens. Default: 8192 */
  maxTokens?: number;
  /** Creativity control levels. When set, a binding preamble is injected before the agent prompt. */
  creativityLevels?: CreativityLevels;
}

export interface AgentRunResult<T = unknown> {
  /** Parsed JSON output from the agent */
  data: T;
  /** Raw text response before JSON parsing */
  rawText: string;
  /** Which provider actually handled the request */
  provider: AIProvider;
  /** Which model was used */
  model: string;
  /** Token usage if available */
  usage?: { inputTokens?: number; outputTokens?: number };
}

// ─── Key resolution ─────────────────────────────────────────────────────────

function resolveApiKey(provider: AIProvider, explicitKey?: string): string {
  if (explicitKey) return explicitKey;

  // Try localStorage (browser context)
  if (typeof window !== 'undefined') {
    const storageKeys = provider === 'gemini'
      ? ['gemini_api_key', 'tensorax_analysis_key', 'tensorax_image_gen_key']
      : ['claude_api_key', 'anthropic_api_key'];

    for (const key of storageKeys) {
      const val = localStorage.getItem(key);
      if (val && val.trim() && !/placeholder/i.test(val)) return val.trim();
    }
  }

  // Try env vars (build-time or server context)
  const envKeys = provider === 'gemini'
    ? ['VITE_GEMINI_API_KEY', 'TENSORAX_ANALYSIS_KEY']
    : ['VITE_CLAUDE_API_KEY', 'ANTHROPIC_API_KEY'];

  for (const key of envKeys) {
    const val = (import.meta as any)?.env?.[key] || (typeof process !== 'undefined' ? process.env[key] : undefined);
    if (val && val.trim()) return val.trim();
  }

  throw new Error(`No API key found for ${provider}. Set one in Project Settings.`);
}

// ─── Provider defaults ──────────────────────────────────────────────────────

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
const CLAUDE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'];

function resolveModel(provider: AIProvider, explicit?: string): string {
  if (explicit) return explicit;
  return provider === 'gemini' ? GEMINI_MODELS[0] : CLAUDE_MODELS[0];
}

function detectProvider(model?: string): AIProvider {
  if (!model) return 'gemini'; // default
  if (model.startsWith('claude') || model.startsWith('anthropic')) return 'claude';
  return 'gemini';
}

// ─── JSON extraction ────────────────────────────────────────────────────────

/**
 * Extract JSON from a model response that might contain markdown fences,
 * preamble text, or other wrapping.
 */
function extractJSON(text: string): string {
  // Try to find a JSON code block first
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Try to find raw JSON object or array
  const jsonStart = text.search(/[\[{]/);
  if (jsonStart === -1) throw new Error('No JSON found in agent response');

  const candidate = text.slice(jsonStart);

  // Find the matching closing bracket
  const opener = candidate[0];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    if (ch === closer) depth--;
    if (depth === 0) return candidate.slice(0, i + 1);
  }

  // Fallback: return everything from first bracket
  return candidate;
}

// ─── Image helpers ──────────────────────────────────────────────────────────

function isDataUri(s: string): boolean {
  return s.startsWith('data:');
}

function dataUriToBase64(dataUri: string): { base64: string; mimeType: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URI');
  return { mimeType: match[1], base64: match[2] };
}

// ─── Gemini execution ───────────────────────────────────────────────────────

async function runGemini(opts: AgentRunOptions & { resolvedKey: string; resolvedModel: string }): Promise<AgentRunResult> {
  const ai = new GoogleGenAI({ apiKey: opts.resolvedKey });

  // Build content parts
  const parts: any[] = [];

  // Add images if present
  if (opts.images?.length) {
    for (const img of opts.images) {
      if (isDataUri(img)) {
        const { base64, mimeType } = dataUriToBase64(img);
        parts.push({ inlineData: { data: base64, mimeType } });
      } else {
        // URL — let Gemini fetch it
        parts.push({ text: `[Reference image: ${img}]` });
      }
    }
  }

  // Add the user message
  parts.push({ text: opts.userMessage });

  const response = await ai.models.generateContent({
    model: opts.resolvedModel,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: opts.agentPrompt,
      temperature: opts.temperature ?? 1,
      maxOutputTokens: opts.maxTokens ?? 8192,
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text ?? '';
  const usage = response.usageMetadata;

  return {
    data: JSON.parse(extractJSON(rawText)),
    rawText,
    provider: 'gemini',
    model: opts.resolvedModel,
    usage: usage ? {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
    } : undefined,
  };
}

// ─── Claude execution ───────────────────────────────────────────────────────

async function runClaude(opts: AgentRunOptions & { resolvedKey: string; resolvedModel: string }): Promise<AgentRunResult> {
  const client = new Anthropic({ apiKey: opts.resolvedKey, dangerouslyAllowBrowser: true });

  // Build message content
  const content: any[] = [];

  if (opts.images?.length) {
    for (const img of opts.images) {
      if (isDataUri(img)) {
        const { base64, mimeType } = dataUriToBase64(img);
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        });
      } else {
        content.push({
          type: 'image',
          source: { type: 'url', url: img },
        });
      }
    }
  }

  content.push({ type: 'text', text: opts.userMessage });

  const response = await client.messages.create({
    model: opts.resolvedModel,
    max_tokens: opts.maxTokens ?? 8192,
    temperature: opts.temperature ?? 1,
    system: opts.agentPrompt,
    messages: [{ role: 'user', content }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    data: JSON.parse(extractJSON(rawText)),
    rawText,
    provider: 'claude',
    model: opts.resolvedModel,
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run an agent with the given prompt and input.
 *
 * Usage:
 * ```ts
 * import { runAgent } from './agentRunner';
 * import { conceptFromBriefAgentPrompt } from '../prompts/concept/conceptFromBriefAgent';
 *
 * const result = await runAgent({
 *   agentPrompt: conceptFromBriefAgentPrompt,
 *   userMessage: JSON.stringify({ brief, research }),
 *   provider: 'gemini',
 * });
 * console.log(result.data); // typed JSON from the agent
 * ```
 */
export async function runAgent<T = unknown>(opts: AgentRunOptions): Promise<AgentRunResult<T>> {
  const provider = opts.provider ?? detectProvider(opts.model);
  const resolvedModel = resolveModel(provider, opts.model);
  const resolvedKey = resolveApiKey(provider, opts.apiKey);

  // Inject creativity control preamble before the agent prompt when levels are set
  let agentPrompt = opts.agentPrompt;
  if (opts.creativityLevels) {
    const preamble = buildCreativityPreamble(opts.creativityLevels);
    agentPrompt = `${preamble}\n\n${agentPrompt}`;
  }

  const fullOpts = { ...opts, agentPrompt, resolvedKey, resolvedModel };

  const result = provider === 'gemini'
    ? await runGemini(fullOpts)
    : await runClaude(fullOpts);

  return result as AgentRunResult<T>;
}

/**
 * Run multiple agents in parallel and return all results.
 * Useful for research orchestrator running 4 research agents simultaneously.
 */
export async function runAgentsParallel<T = unknown>(
  agents: AgentRunOptions[]
): Promise<AgentRunResult<T>[]> {
  return Promise.all(agents.map(opts => runAgent<T>(opts)));
}

/**
 * Run agents sequentially, passing each result to the next via a transform function.
 * Useful for pipelines where output of agent A becomes input of agent B.
 */
export async function runAgentChain<T = unknown>(
  steps: Array<{
    opts: AgentRunOptions;
    /** Transform the result before passing to the next step's userMessage */
    transform?: (result: AgentRunResult) => string;
  }>
): Promise<AgentRunResult<T>> {
  let lastResult: AgentRunResult | null = null;

  for (const step of steps) {
    // If there's a previous result and a transform, inject it into the user message
    if (lastResult && step.transform) {
      step.opts.userMessage = step.transform(lastResult);
    }
    lastResult = await runAgent(step.opts);
  }

  return lastResult as AgentRunResult<T>;
}
