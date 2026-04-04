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
import OpenAI from 'openai';
import { type CreativityLevels, buildCreativityPreamble } from './creativityControl';
import { verificationAgentPrompt } from '../prompts/qa/verificationAgent';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'claude' | 'openai';

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
  /**
   * Verification options. When set, a QA agent automatically checks the output
   * against the original task and retries if verification fails.
   */
  verification?: {
    /** The user's original text/copy that must appear verbatim in output */
    providedText: string;
    /** Where the text came from (e.g. 'uploaded .docx', 'pasted in chat') */
    providedTextSource?: string;
    /** Max retry attempts if verification fails. Default: 1 */
    maxRetries?: number;
  };
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  verdict: string;
  issues: Array<{
    severity: string;
    category: string;
    expected: string;
    actual: string;
    location: string;
  }>;
  correctionInstruction: string | null;
  summary: string;
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
  /** Verification result if verification was enabled */
  verification?: VerificationResult;
  /** Number of retry attempts made (0 if passed first time) */
  retryCount?: number;
}

// ─── Key resolution ─────────────────────────────────────────────────────────

const PROVIDER_STORAGE_KEYS: Record<AIProvider, string[]> = {
  gemini: ['gemini_api_key', 'tensorax_provider_key__gemini', 'tensorax_analysis_key', 'tensorax_image_gen_key'],
  claude: ['claude_api_key', 'anthropic_api_key', 'tensorax_provider_key__anthropic'],
  openai: ['openai_api_key', 'tensorax_provider_key__openai'],
};

const PROVIDER_ENV_KEYS: Record<AIProvider, string[]> = {
  gemini: ['VITE_GEMINI_API_KEY', 'TENSORAX_ANALYSIS_KEY', 'GEMINI_API_KEY'],
  claude: ['VITE_CLAUDE_API_KEY', 'ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
};

function resolveApiKey(provider: AIProvider, explicitKey?: string): string {
  if (explicitKey) return explicitKey;

  // Try localStorage (browser context)
  if (typeof window !== 'undefined') {
    // First try the per-model key (most specific)
    const modelKey = localStorage.getItem('tensorax_analysis_model');
    if (modelKey) {
      const perModelKey = localStorage.getItem(`tensorax_analysis_key__${modelKey}`);
      if (perModelKey?.trim()) return perModelKey.trim();
    }

    for (const key of PROVIDER_STORAGE_KEYS[provider] || []) {
      const val = localStorage.getItem(key);
      if (val && val.trim() && !/placeholder/i.test(val)) return val.trim();
    }
  }

  // Try env vars (build-time or server context)
  for (const key of PROVIDER_ENV_KEYS[provider] || []) {
    const val = (import.meta as any)?.env?.[key] || (typeof process !== 'undefined' ? process.env[key] : undefined);
    if (val && val.trim()) return val.trim();
  }

  throw new Error(`No API key found for ${provider}. Set one in Project Settings.`);
}

// ─── Provider defaults ──────────────────────────────────────────────────────

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4.1',
};

function resolveModel(provider: AIProvider, explicit?: string): string {
  if (explicit) return explicit;
  return DEFAULT_MODELS[provider];
}

function detectProvider(model?: string): AIProvider {
  if (!model) return 'gemini';
  if (model.startsWith('claude') || model.startsWith('anthropic')) return 'claude';
  if (model.startsWith('gpt') || model.startsWith('o3') || model.startsWith('o4') || model.startsWith('o1') || model.startsWith('chatgpt')) return 'openai';
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

// ─── OpenAI execution ──────────────────────────────────────────────────

async function runOpenAI(opts: AgentRunOptions & { resolvedKey: string; resolvedModel: string }): Promise<AgentRunResult> {
  const client = new OpenAI({ apiKey: opts.resolvedKey, dangerouslyAllowBrowser: true });

  // Build message content
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

  if (opts.images?.length) {
    for (const img of opts.images) {
      content.push({
        type: 'image_url',
        image_url: { url: isDataUri(img) ? img : img },
      });
    }
  }

  content.push({ type: 'text', text: opts.userMessage });

  // o3/o3-pro/o1 models don't support temperature or system messages the same way
  const isReasoningModel = /^o[134]/.test(opts.resolvedModel);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = isReasoningModel
    ? [
        { role: 'developer', content: opts.agentPrompt },
        { role: 'user', content },
      ]
    : [
        { role: 'system', content: opts.agentPrompt },
        { role: 'user', content },
      ];

  const response = await client.chat.completions.create({
    model: opts.resolvedModel,
    messages,
    ...(isReasoningModel ? {} : { temperature: opts.temperature ?? 1 }),
    max_completion_tokens: opts.maxTokens ?? 8192,
    response_format: { type: 'json_object' },
  });

  const rawText = response.choices?.[0]?.message?.content || '';

  return {
    data: JSON.parse(extractJSON(rawText)),
    rawText,
    provider: 'openai',
    model: opts.resolvedModel,
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
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

  const maxRetries = opts.verification?.maxRetries ?? 1;
  let lastResult: AgentRunResult;
  let lastVerification: VerificationResult | undefined;
  let retryCount = 0;
  let currentUserMessage = opts.userMessage;

  // Execution + verification loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const fullOpts = { ...opts, agentPrompt, userMessage: currentUserMessage, resolvedKey, resolvedModel };

    lastResult = provider === 'openai'
      ? await runOpenAI(fullOpts)
      : provider === 'claude'
        ? await runClaude(fullOpts)
        : await runGemini(fullOpts);

    // Skip verification if not configured or no provided text
    if (!opts.verification?.providedText) break;

    // Run verification agent
    try {
      const verificationInput = JSON.stringify({
        originalTask: opts.userMessage,
        providedText: opts.verification.providedText,
        providedTextSource: opts.verification.providedTextSource || 'user input',
        agentOutput: lastResult.rawText.slice(0, 4000), // cap to avoid token overflow
        agentId: 'unknown',
        textFreedom: opts.creativityLevels?.text ?? 0,
        visualFreedom: opts.creativityLevels?.visual ?? 3,
      });

      const verifyResult = await runGemini({
        ...opts,
        agentPrompt: verificationAgentPrompt,
        userMessage: verificationInput,
        images: undefined, // verifier doesn't need images
        creativityLevels: undefined, // no creativity control on the verifier itself
        resolvedKey,
        resolvedModel: 'gemini-2.5-flash', // fast model for verification
      } as any);

      lastVerification = verifyResult.data as VerificationResult;

      if (lastVerification.passed) {
        console.log(`[Verification] PASSED (score: ${lastVerification.score}) on attempt ${attempt + 1}`);
        break;
      }

      // Failed — if we have retries left, send correction back to the agent
      if (attempt < maxRetries && lastVerification.correctionInstruction) {
        retryCount++;
        console.warn(`[Verification] FAILED (${lastVerification.verdict}, score: ${lastVerification.score}). Retrying with correction...`);
        currentUserMessage = `CORRECTION REQUIRED — Your previous output failed verification.\n\n${lastVerification.correctionInstruction}\n\nORIGINAL TASK:\n${opts.userMessage}`;
      } else {
        console.warn(`[Verification] FAILED (${lastVerification.verdict}, score: ${lastVerification.score}). No retries left.`);
      }
    } catch (verifyErr) {
      console.warn('[Verification] Verification agent failed, skipping:', verifyErr);
      break; // Don't block on verification failures
    }
  }

  return {
    ...lastResult!,
    verification: lastVerification,
    retryCount,
  } as AgentRunResult<T>;
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
