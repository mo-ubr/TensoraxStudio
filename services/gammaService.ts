/**
 * gammaService.ts — Gamma API v1.0 client for presentation & document generation
 *
 * REST API:  https://public-api.gamma.app/v1.0/
 * Auth:      X-API-KEY header (sk-gamma-... format)
 * Flow:      POST /generations → poll GET /generations/{id} every 5s → gammaUrl + exportUrl
 *
 * Docs:      https://developers.gamma.app/docs/getting-started
 */

// ─── Constants ──────────────────────────────────────────────────────────────

// Use server proxy to avoid CORS issues (proxied via server/gammaApi.js)
const GAMMA_BASE_URL = '/api/gamma';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes max

const LS_KEY = 'tensorax_gamma_key';

// ─── Types ──────────────────────────────────────────────────────────────────

export type GammaFormat = 'presentation' | 'document' | 'webpage' | 'social';
export type GammaTextMode = 'generate' | 'condense' | 'preserve';
export type GammaExportFormat = 'pdf' | 'pptx' | 'png';
export type GammaImageSource =
  | 'aiGenerated' | 'webAllImages' | 'webFreeToUse'
  | 'webFreeToUseCommercially' | 'pictographic' | 'giphy'
  | 'pexels' | 'placeholder' | 'noImages' | 'themeAccent';

export interface GammaTextOptions {
  amount?: 'brief' | 'medium' | 'detailed' | 'extensive';
  tone?: string;
  audience?: string;
  language?: string;
}

export interface GammaImageOptions {
  source?: GammaImageSource;
  model?: string;
  style?: string;
  stylePreset?: 'photorealistic' | 'illustration' | 'abstract' | '3D' | 'lineArt' | 'custom';
}

export interface GammaCardOptions {
  dimensions?: '16x9' | '4x3' | 'fluid' | 'letter' | 'a4' | 'pageless' | '1x1' | '4x5' | '9x16';
}

export interface GammaSharingOptions {
  workspaceAccess?: 'noAccess' | 'view' | 'comment' | 'edit' | 'fullAccess';
  externalAccess?: 'noAccess' | 'view' | 'comment' | 'edit';
}

export interface GammaGenerateParams {
  inputText: string;
  format?: GammaFormat;
  textMode?: GammaTextMode;
  numCards?: number;
  themeId?: string;
  exportAs?: GammaExportFormat;
  folderIds?: string[];
  textOptions?: GammaTextOptions;
  imageOptions?: GammaImageOptions;
  cardOptions?: GammaCardOptions;
  sharingOptions?: GammaSharingOptions;
  additionalInstructions?: string;
}

export type GammaStatus = 'pending' | 'completed' | 'failed';

export interface GammaGenerationResult {
  generationId: string;
  status: GammaStatus;
  gammaUrl?: string;
  exportUrl?: string;
  credits?: {
    deducted: number;
    remaining: number;
  };
  error?: string;
}

export interface GammaTheme {
  id: string;
  name: string;
  type: 'standard' | 'custom';
  colorKeywords?: string[];
  toneKeywords?: string[];
}

// ─── API Key Management ─────────────────────────────────────────────────────

export function getGammaApiKey(): string | null {
  try {
    const key = localStorage.getItem(LS_KEY)?.trim();
    if (!key || key.length < 10) return null;
    return key;
  } catch {
    return null;
  }
}

export function hasGammaApiKey(): boolean {
  return !!getGammaApiKey();
}

export function setGammaApiKey(key: string): void {
  localStorage.setItem(LS_KEY, key.trim());
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function gammaFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey?: string,
): Promise<T> {
  const key = apiKey || getGammaApiKey();
  if (!key) throw new Error('Gamma API key not configured. Add it in Settings → Presentation Generation.');

  const url = `${GAMMA_BASE_URL}${path}`;

  // For GET requests, pass API key via header; for POST, it goes in the body
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Gamma-Key': key,
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gamma API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Core API Methods ───────────────────────────────────────────────────────

/**
 * Start a new generation job (async — returns immediately with generationId).
 */
export async function createGeneration(
  params: GammaGenerateParams,
  apiKey?: string,
): Promise<GammaGenerationResult> {
  const key = apiKey || getGammaApiKey();
  if (!key) throw new Error('Gamma API key not configured. Add it in Settings → Presentation Generation.');

  const body: Record<string, unknown> = {
    apiKey: key, // Proxy extracts this and forwards as X-API-KEY header
    inputText: params.inputText,
    textMode: params.textMode ?? 'generate',
  };

  if (params.format) body.format = params.format;
  if (params.numCards) body.numCards = params.numCards;
  if (params.themeId) body.themeId = params.themeId;
  if (params.exportAs) body.exportAs = params.exportAs;
  if (params.folderIds?.length) body.folderIds = params.folderIds;
  if (params.textOptions) body.textOptions = params.textOptions;
  if (params.imageOptions) body.imageOptions = params.imageOptions;
  if (params.cardOptions) body.cardOptions = params.cardOptions;
  if (params.sharingOptions) body.sharingOptions = params.sharingOptions;
  if (params.additionalInstructions) body.additionalInstructions = params.additionalInstructions;

  return gammaFetch<GammaGenerationResult>('/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  }, apiKey);
}

/**
 * Poll the status of a generation job.
 */
export async function getGeneration(
  generationId: string,
  apiKey?: string,
): Promise<GammaGenerationResult> {
  return gammaFetch<GammaGenerationResult>(`/generations/${generationId}`, {}, apiKey);
}

/**
 * Generate and wait for completion. Returns the final result with gammaUrl.
 * Calls onProgress during polling to allow UI updates.
 */
export async function generateAndWait(
  params: GammaGenerateParams,
  onProgress?: (status: GammaStatus, attempt: number) => void,
  apiKey?: string,
): Promise<GammaGenerationResult> {
  const initial = await createGeneration(params, apiKey);
  const { generationId } = initial;

  if (initial.status === 'completed') return initial;
  if (initial.status === 'failed') throw new Error(initial.error || 'Generation failed immediately');

  // Poll loop
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const result = await getGeneration(generationId, apiKey);

    onProgress?.(result.status, attempt);

    if (result.status === 'completed') return result;
    if (result.status === 'failed') throw new Error(result.error || 'Generation failed');
  }

  throw new Error(`Generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * List available themes in the workspace.
 */
export async function listThemes(apiKey?: string): Promise<GammaTheme[]> {
  const res = await gammaFetch<{ themes: GammaTheme[]; count: number }>('/themes', {}, apiKey);
  return res.themes;
}

/**
 * List folders in the workspace.
 */
export async function listFolders(apiKey?: string): Promise<{ id: string; name: string }[]> {
  const res = await gammaFetch<{ folders: { id: string; name: string }[] }>('/folders', {}, apiKey);
  return res.folders;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Quick test: validates an API key by listing themes (lightweight call).
 * Returns true if the key works, false otherwise.
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    await listThemes(apiKey);
    return true;
  } catch {
    return false;
  }
}
