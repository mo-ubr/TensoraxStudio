import { Chat, GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageSize } from "../types";
import { ANALYSIS_INSTRUCTION, ASSISTANT_SYSTEM_INSTRUCTION, COPY_INSTRUCTION } from "./promptConstants";

const CHAT_MODEL = "gemini-2.5-flash";
/** Gemini image models (generateContent) – same path as Google AI Studio. */
const GEMINI_IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-2.5-flash", "gemini-3-pro-image-preview"];
/** Imagen models (generateImages). */
const IMAGE_MODELS = ["imagen-3.0-capability"];
const VIDEO_MODELS = ["veo-3.1-generate-preview", "veo-2.0-generate-001"];
const PROMPT_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"];
const API_KEY_STORAGE_KEY = "gemini_api_key";
const API_KEY_COOKIE_KEY = "gemini_api_key";

interface ApiImage {
  imageBytes: string;
  mimeType: string;
}

export interface ImageGenParams {
  prompt: string;
  size: ImageSize;
  aspectRatio: AspectRatio;
  referenceImages: string[];
}

export interface VideoGenParams {
  prompt: string;
  startImage?: string;
  midImage?: string;
  endImage?: string;
  movementDescription?: string;
  duration: "5s" | "10s";
  onProgress?: (message: string) => void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** If the model returned multiple options (Option 1/2/3), keep only the first one. */
function takeFirstPromptOnly(text: string): string {
  const trimmed = text.trim();
  const option2Match = /(?:\n|^)\s*#{0,3}\s*Option\s+2\b/i.exec(trimmed);
  const cut = option2Match ? trimmed.slice(0, option2Match.index) : trimmed;
  return cut.replace(/\n*#{1,3}\s*Option\s+1[:\s]*/i, "").trim();
}

let runtimeApiKey: string | null = null;

const normalizeApiKey = (key?: string | null): string | null => {
  if (!key) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (/placeholder_api_key/i.test(trimmed)) return null;
  if (/your[_-]?api[_-]?key/i.test(trimmed)) return null;
  return trimmed;
};

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length < 2) return null;
  return decodeURIComponent(parts.pop()!.split(";").shift() || "");
};

const writeCookie = (name: string, value: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
};

const readLocalStorageKey = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return normalizeApiKey(localStorage.getItem(API_KEY_STORAGE_KEY));
  } catch {
    return null;
  }
};

const writeLocalStorageKey = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch {
    // no-op: storage can be blocked in hardened browser profiles
  }
};

const getSavedApiKey = (): string | null => {
  const runtime = normalizeApiKey(runtimeApiKey);
  if (runtime) return runtime;
  const local = readLocalStorageKey();
  if (local) return local;
  const cookie = normalizeApiKey(readCookie(API_KEY_COOKIE_KEY));
  if (cookie) return cookie;
  return null;
};

const getApiKey = (): string => {
  const saved = getSavedApiKey();
  if (saved) return saved;
  
  // Fallback to env var if available
  const key = normalizeApiKey(process.env.GEMINI_API_KEY || process.env.API_KEY);
  if (!key) {
    throw new Error("Missing Gemini API key. Please click 'Select API Key' to set it.");
  }
  return key;
};

export const setApiKey = (key: string) => {
  const normalized = normalizeApiKey(key);
  if (!normalized) return;
  runtimeApiKey = normalized;
  writeLocalStorageKey(normalized);
  writeCookie(API_KEY_COOKIE_KEY, normalized);
};

const createClient = () => {
  return new GoogleGenAI({ apiKey: getApiKey() });
};

/** Create client with a specific API key (for Analysis/Copy/Image type-specific keys). */
const createClientWithKey = (apiKey: string) => {
  const k = normalizeApiKey(apiKey);
  if (!k) throw new Error("Invalid or empty API key.");
  return new GoogleGenAI({ apiKey: k });
};

const ENV_KEYS: Record<string, string> = {
  analysis: process.env.TENSORAX_ANALYSIS_KEY  || '',
  copy:     process.env.TENSORAX_COPY_KEY       || '',
  image:    process.env.TENSORAX_IMAGE_KEY      || '',
};

const ENV_MODELS: Record<string, string> = {
  analysis: process.env.TENSORAX_ANALYSIS_MODEL || '',
  copy:     process.env.TENSORAX_COPY_MODEL     || '',
  image:    process.env.TENSORAX_IMAGE_MODEL    || '',
};

export function getApiKeyForType(type: "analysis" | "copy" | "image"): string | null {
  const baseKey = `tensorax_${type}_key`;
  const modelKey = `tensorax_${type}_model`;
  if (typeof window !== "undefined") {
    try {
      const model = localStorage.getItem(modelKey)?.trim();
      if (model) {
        const perModel = normalizeApiKey(localStorage.getItem(`${baseKey}__${model}`));
        if (perModel) return perModel;
      }
      const base = normalizeApiKey(localStorage.getItem(baseKey));
      if (base) return base;
    } catch { /* ignore */ }
  }
  const envKey = normalizeApiKey(ENV_KEYS[type]);
  if (envKey) return envKey;
  return null;
}

/** Check if user has stored an API key for a given type. */
export function hasStoredKeyForType(type: "analysis" | "copy" | "image"): boolean {
  if (typeof window !== "undefined") {
    try {
      const baseKey = `tensorax_${type}_key`;
      const model = localStorage.getItem(`tensorax_${type}_model`)?.trim();
      if (model && normalizeApiKey(localStorage.getItem(`${baseKey}__${model}`))) return true;
      if (normalizeApiKey(localStorage.getItem(baseKey))) return true;
    } catch { /* ignore */ }
  }
  return !!normalizeApiKey(ENV_KEYS[type]);
}

export function getModelForType(type: "analysis" | "copy" | "image"): string | null {
  // 1. localStorage (user-entered via UI)
  if (typeof window !== "undefined") {
    try {
      const m = localStorage.getItem(`tensorax_${type}_model`)?.trim();
      if (m) return m;
    } catch { /* ignore */ }
  }
  // 2. Env var baked in at build time
  const envModel = ENV_MODELS[type]?.trim();
  if (envModel) return envModel;
  return null;
}

const parseDataUrl = (value?: string): ApiImage | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    imageBytes: match[2],
  };
};

const getImageSize = (size: ImageSize): "1K" | "2K" => {
  if (size === "1K" || size === "2K") {
    return size;
  }
  return "2K";
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown API error";
};

/** Log full API error details to console for debugging. */
function logApiError(context: string, error: unknown): void {
  const err = error as Record<string, unknown> | undefined;
  const detail: Record<string, unknown> = {
    context,
    message: toErrorMessage(error),
  };
  if (error instanceof Error && error.stack) {
    detail.stack = error.stack;
  }
  if (err && typeof err === "object") {
    if ("status" in err) detail.status = err.status;
    if ("statusText" in err) detail.statusText = err.statusText;
    if ("message" in err) detail.apiMessage = err.message;
    if ("body" in err) detail.body = err.body;
    if ("cause" in err) detail.cause = err.cause;
  }
  console.error("[TensorAx Gemini]", detail);
}

const buildImagePrompt = (params: ImageGenParams) => {
  if (params.referenceImages.length === 0) {
    return params.prompt;
  }
  return `${params.prompt}\nUse visual consistency with the provided references for subject identity, style, and environment continuity.`;
};

/** Try Vertex AI Imagen 3 backend (supports subject reference for character consistency). */
async function generateImageViaVertexBackend(params: ImageGenParams): Promise<string> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: buildImagePrompt(params),
      aspectRatio: params.aspectRatio,
      referenceImages: params.referenceImages,
      size: params.size,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Vertex backend: ${res.status}`);
  }
  const data = await res.json();
  if (!data?.dataUrl) throw new Error("Vertex backend returned no image.");
  return data.dataUrl;
}

/** Extract first image from generateContent-style response (candidates[0].content.parts). */
function extractImageFromGenerateContentResponse(obj: unknown): string | null {
  const candidates = (obj as { candidates?: unknown[] })?.candidates;
  const parts = candidates?.[0] && (candidates[0] as { content?: { parts?: unknown[] } })?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const p = part as { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) {
      const mime = (inline as { mimeType?: string; mime_type?: string }).mimeType ?? (inline as { mime_type?: string }).mime_type ?? "image/png";
      return `data:${mime};base64,${inline.data}`;
    }
  }
  return null;
}

/**
 * Generate image using the exact pattern from the AI Studio downloaded project:
 * model gemini-3-pro-image-preview, contents: { parts } (ref images + text), config: imageConfig only.
 */
async function generateImageAISTudioStyle(params: ImageGenParams): Promise<string> {
  const ai = createClient();
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

  params.referenceImages.forEach((imgData) => {
    const parsed = parseDataUrl(imgData);
    if (parsed) {
      parts.push({
        inlineData: { mimeType: parsed.mimeType, data: parsed.imageBytes },
      });
    }
  });

  parts.push({ text: buildImagePrompt(params) });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: params.aspectRatio,
        imageSize: params.size,
      },
    },
  });

  const dataUrl = extractImageFromGenerateContentResponse(response);
  if (dataUrl) return dataUrl;
  throw new Error("Image response did not contain image data.");
}

export const GeminiService = {
  setApiKey,

  hydrateApiKeyFromStorage(): boolean {
    const saved = getSavedApiKey();
    if (!saved) return false;
    setApiKey(saved);
    return true;
  },

  async enhancePrompt(prompt: string, instruction?: string): Promise<string> {
    const ai = createClient();
    const baseInstruction =
      instruction ||
      "Rewrite this prompt to be clearer, cinematic, and production-ready while keeping intent unchanged. Keep it concise.";
    let lastError: unknown;

    for (const model of PROMPT_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: `${baseInstruction}\n\nPrompt:\n${prompt}`,
        });
        if (response.text?.trim()) {
          return takeFirstPromptOnly(response.text);
        }
      } catch (error) {
        logApiError(`enhancePrompt (model: ${model})`, error);
        lastError = error;
      }
    }

    throw new Error(`Prompt enhancement failed: ${toErrorMessage(lastError)}`);
  },

  /**
   * Enhance scene prompt using reference images so the description is truthful to character, clothing, and scenery.
   * Returns a single concise description that does not deviate from what is visible in the images.
   */
  async enhanceScenePromptWithReferences(
    prompt: string,
    referenceImages: { character: string[]; clothing: string[]; background: string[] }
  ): Promise<string> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    const instruction = `You are an award-winning trailer director + cinematographer + storyboard artist. You will be given reference images in three groups: CHARACTER (face/person), CLOTHING, and SCENERY/BACKGROUND.

Your task: Write exactly ONE concise scene description (1–3 sentences) that is strictly truthful to what you see in these images.
- Describe the face/character only from the CHARACTER images.
- Describe the clothing exactly as shown in the CLOTHING images (e.g. if it is a knitted dress with long sleeves, say that – do not say linen or another fabric).
- Describe the scene/location only from the SCENERY images.
- Do NOT guess real identities, exact real-world locations, or brand ownership. Stick to visible facts.
- Do not add, invent, or change any detail. Do not offer multiple options.
Reply with only the single description.`;
    parts.push({ text: `${instruction}\n\nUser's current note (you may refine but must stay faithful to the images): ${prompt || "(describe only from the images below)"}\n\n---\nReference images:\n` });

    const addImages = (label: string, dataUrls: string[]) => {
      if (dataUrls.length === 0) return;
      parts.push({ text: `${label}\n` });
      dataUrls.forEach((url) => {
        const parsed = parseDataUrl(url);
        if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.imageBytes } });
      });
    };
    addImages("CHARACTER (face/person):", referenceImages.character);
    addImages("CLOTHING:", referenceImages.clothing);
    addImages("SCENERY/BACKGROUND:", referenceImages.background);

    const ai = createClient();
    let lastError: unknown;
    for (const model of PROMPT_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
        });
        if (response.text?.trim()) {
          return takeFirstPromptOnly(response.text);
        }
      } catch (error) {
        logApiError(`enhanceScenePromptWithReferences (model: ${model})`, error);
        lastError = error;
      }
    }
    throw new Error(`Scene prompt enhancement failed: ${toErrorMessage(lastError)}`);
  },

  /**
   * Generate the main scene prompt and all 9 shot prompts in one call.
   * Uses reference images when provided. Returns scenePrompt and shotPrompts (length 9).
   */
  async generateSceneAndShotPrompts(
    userNote: string,
    referenceImages: { character: string[]; clothing: string[]; background: string[] }
  ): Promise<{ scenePrompt: string; shotPrompts: string[] }> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    parts.push({ text: COPY_INSTRUCTION("(no prior analysis – use reference images and user note directly)", userNote || "(generate a creative cinematic scene)") });

    const addImages = (label: string, dataUrls: string[]) => {
      if (dataUrls.length === 0) return;
      parts.push({ text: `\n${label}\n` });
      dataUrls.forEach((url) => {
        const parsed = parseDataUrl(url);
        if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.imageBytes } });
      });
    };
    addImages("CHARACTER:", referenceImages.character);
    addImages("CLOTHING:", referenceImages.clothing);
    addImages("SCENERY/BACKGROUND:", referenceImages.background);

    const ai = createClient();
    let lastError: unknown;
    for (const model of PROMPT_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
        });
        const raw = response.text?.trim();
        if (!raw) continue;
        let parsed: { scene?: string; shots?: string[] };
        try {
          const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
          parsed = JSON.parse(jsonStr) as { scene?: string; shots?: string[] };
        } catch (parseErr) {
          logApiError(`generateSceneAndShotPrompts JSON parse (model: ${model})`, parseErr);
          continue;
        }
        const scene = typeof parsed.scene === "string" ? parsed.scene.trim() : "";
        const shots = Array.isArray(parsed.shots) ? parsed.shots.slice(0, 9).map((s) => String(s).trim()) : [];
        if (scene && shots.length === 9) {
          return { scenePrompt: scene, shotPrompts: shots };
        }
      } catch (error) {
        logApiError(`generateSceneAndShotPrompts (model: ${model})`, error);
        lastError = error;
      }
    }
    throw new Error(`Failed to generate prompts: ${toErrorMessage(lastError)}`);
  },

  /**
   * Step 1 (Image Analysis): Analyse reference images with the Analysis model to produce
   * a structured breakdown: Subject & Character, Clothes, Scene & Background, Technical & Aesthetic,
   * and a combined Final Prompt. Per "Prompt for a 3x3 Grid" doc.
   */
  async analyseImagesToStructuredPrompt(
    apiKey: string,
    model: string | null,
    referenceImages: { character: string[]; clothing: string[]; background: string[] }
  ): Promise<string> {
    const allImages = [
      ...referenceImages.character,
      ...referenceImages.clothing,
      ...referenceImages.background,
    ].filter(Boolean);
    if (allImages.length === 0) return "";

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: ANALYSIS_INSTRUCTION + "\n\nReference images:\n" },
    ];
    allImages.forEach((url) => {
      const parsed = parseDataUrl(url);
      if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.imageBytes } });
    });

    const ai = createClientWithKey(apiKey);
    const modelsToTry = model ? [model, ...PROMPT_MODELS] : PROMPT_MODELS;
    let lastError: unknown;
    for (const m of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: [{ role: "user", parts }],
        });
        if (response.text?.trim()) return response.text.trim();
      } catch (error) {
        logApiError(`analyseImagesToStructuredPrompt (model: ${m})`, error);
        lastError = error;
      }
    }
    throw new Error(`Image analysis failed: ${toErrorMessage(lastError)}`);
  },

  /**
   * Step 2 (Prompt Generation): Feed the structured description from Step 1 + user text
   * into the Copy model to synthesize the final scene prompt and 9 shot prompts.
   */
  async generatePromptsFromAnalysis(
    apiKey: string,
    model: string | null,
    structuredAnalysis: string,
    userNote: string
  ): Promise<{ scenePrompt: string; shotPrompts: string[] }> {
    const ai = createClientWithKey(apiKey);
    const modelsToTry = model ? [model, ...PROMPT_MODELS] : PROMPT_MODELS;
    let lastError: unknown;
    for (const m of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: [{ role: "user", parts: [{ text: COPY_INSTRUCTION(structuredAnalysis, userNote) }] }],
        });
        const raw = response.text?.trim();
        if (!raw) continue;
        let parsed: Record<string, unknown>;
        try {
          const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
          parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch (parseErr) {
          logApiError(`generatePromptsFromAnalysis JSON parse (model: ${m})`, parseErr);
          console.error("[TensorAx] Raw response sample:", raw.slice(0, 500));
          continue;
        }
        const scene = typeof parsed.scene === "string" ? parsed.scene.trim() : "";
        const shotsArr = Array.isArray(parsed.shots) ? parsed.shots : Array.isArray((parsed as { shot_prompts?: unknown[] }).shot_prompts) ? (parsed as { shot_prompts: unknown[] }).shot_prompts : [];
        let shots = shotsArr.slice(0, 9).map((s) => String(s).trim()).filter(Boolean);
        while (shots.length < 9 && scene) shots.push(scene);
        if (scene && shots.length >= 1) return { scenePrompt: scene, shotPrompts: shots.slice(0, 9) };
      } catch (error) {
        logApiError(`generatePromptsFromAnalysis (model: ${m})`, error);
        lastError = error;
      }
    }
    throw new Error(`Prompt generation failed: ${toErrorMessage(lastError)}`);
  },

  ASSISTANT_SYSTEM_INSTRUCTION,

  hasApiKey(): boolean {
    if (getSavedApiKey()) return true;
    if (normalizeApiKey(process.env.GEMINI_API_KEY || process.env.API_KEY)) return true;
    // Fall back to analysis key (Google) for assistant chat
    if (typeof window !== "undefined") {
      try {
        const ak = normalizeApiKey(localStorage.getItem('tensorax_analysis_key'));
        if (ak) { setApiKey(ak); return true; }
      } catch { /* ignore */ }
    }
    return false;
  },

  createChat(model?: string, projectContext?: string): Chat {
    const ai = createClient();
    const contextBlock = projectContext
      ? `\n\n═══ CURRENT PROJECT CONTEXT ═══\n\n${projectContext}\n\n═══ END PROJECT CONTEXT ═══\n\n═══ YOUR ROLE: CREATIVE DIRECTOR ═══\n\nYou are the creative director guiding this project. You don't just answer questions — you DRIVE the process.\n\nRULES:\n- Keep responses SHORT (2-3 sentences max). No walls of text.\n- Ask ONE question at a time. Wait for the answer before moving on.\n- Be specific — reference their actual content, not generic advice.\n- When the user gives you information, USE ACTION COMMANDS to apply it.\n\n═══ ACTION COMMANDS ═══\n\nYou can take actions by including these tags in your response. They are invisible to the user — only the text around them is shown.\n\n[ACTION:SET_FIELD:fieldName:value] — Set a form field. Available fields:\n  - aim (the main creative direction/brief)\n  - cta (call to action)\n  - targetAudience\n  - videoType (explainer | promo | tutorial | testimonial | brand | product)\n  - format (9:16 | 16:9 | 1:1)\n  - duration (1.5min | 3min)\n  - tone (warm | energetic | professional | playful | dramatic | inspirational)\n\n[ACTION:GENERATE_IDEA] — Trigger idea generation (only when all required fields are filled)\n\n[ACTION:REGENERATE:feedback text] — Regenerate the current idea with specific feedback\n\n[ACTION:ACCEPT] — Accept the current concept and move to screenplay\n\nEXAMPLES:\n\nUser: "It's for parents of young kids"\nYou: "Got it — targeting parents of young children. [ACTION:SET_FIELD:targetAudience:Parents of young children] What's the main message you want to get across?"\n\nUser: "I like it but scene 3 feels too long"\nYou: "Agreed, Scene 3 could be tighter. I'll regenerate with that note. [ACTION:REGENERATE:Make Scene 3 shorter and more dynamic — reduce duration and quicken the pacing]"\n\nUser: "This is perfect, let's go"\nYou: "Great — locking in this concept! [ACTION:ACCEPT]"\n\n═══ FLOW ═══\n\n1. SETUP: Walk through empty fields one at a time. After user answers, set the field and ask the next one.\n2. GENERATE: When all required fields are ✅, offer to generate. Use [ACTION:GENERATE_IDEA].\n3. REVIEW: After idea appears, give a brief opinion and ask what they'd change.\n4. ITERATE: Take their feedback, use [ACTION:REGENERATE:...] with a clear directive.\n5. ACCEPT: When they're happy, use [ACTION:ACCEPT].\n\n═══ END ROLE ═══`
      : '';
    return ai.chats.create({
      model: model || CHAT_MODEL,
      config: {
        temperature: 0.7,
        systemInstruction: GeminiService.ASSISTANT_SYSTEM_INSTRUCTION + contextBlock,
      },
    });
  },

  async generateImage(params: ImageGenParams): Promise<string> {
    const configuredModel = getModelForType('image') || 'gemini-3-flash-image';
    console.log("GeminiService: Generating image with model:", configuredModel);

    const imageKey = getApiKeyForType('image') || getApiKeyForType('analysis');
    if (imageKey) setApiKey(imageKey);

    const errors: string[] = [];
    let vertexError: string | null = null;

    const ai = createClient();
    const imagePrompt = buildImagePrompt(params);

    // 1) Try the configured model from Project Settings
    try {
      const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
      params.referenceImages.forEach((imgData) => {
        const parsed = parseDataUrl(imgData);
        if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.imageBytes } });
      });
      parts.push({ text: imagePrompt });

      const response = await ai.models.generateContent({
        model: configuredModel,
        contents: { parts },
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: params.aspectRatio },
        },
      });

      const dataUrl = extractImageFromGenerateContentResponse(response);
      if (dataUrl) return dataUrl;
      throw new Error("Model returned no image data.");
    } catch (error) {
      errors.push(`${configuredModel}: ${toErrorMessage(error)}`);
      logApiError(`generateImage (${configuredModel})`, error);
    }

    // 2) Fallback: Vertex AI Imagen 3
    try {
      return await generateImageViaVertexBackend(params);
    } catch (error) {
      const msg = toErrorMessage(error);
      vertexError = msg;
      errors.push(`Vertex AI (Imagen 3): ${msg}`);
      logApiError("generateImage Vertex backend", error);
    }

    // 3) Fallback: Imagen SDK (generateImages)
    for (const model of IMAGE_MODELS) {
      try {
        const result = await ai.models.generateImages({
          model,
          prompt: imagePrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: params.aspectRatio,
            imageSize: getImageSize(params.size),
            outputMimeType: "image/png",
          },
        });
        const generated = result.generatedImages?.[0]?.image;
        if (!generated?.imageBytes) throw new Error("No image data.");
        return `data:${generated.mimeType || "image/png"};base64,${generated.imageBytes}`;
      } catch (error) {
        const msg = toErrorMessage(error);
        if (!/not found|404/i.test(msg)) errors.push(`Imagen ${model}: ${msg}`);
        logApiError(`generateImage Imagen (${model})`, error);
      }
    }

    const fullMessage = errors.length > 0 ? errors.join("; ") : "Unknown error";
    console.error("[TensorAx Gemini] Image generation failed:", fullMessage);
    throw new Error(`Image generation failed: ${fullMessage}`);
  },

  async generateVideo(params: VideoGenParams): Promise<string> {
    console.log("GeminiService: Generating video...", params);
    const ai = createClient();
    const durationSeconds = params.duration === "10s" ? 10 : 5;
    const startImage = parseDataUrl(params.startImage);
    const endImage = parseDataUrl(params.endImage);
    const midImage = parseDataUrl(params.midImage);
    const movementPrompt = params.movementDescription?.trim();
    const fullPrompt = movementPrompt
      ? `${params.prompt}\nCamera and movement notes: ${movementPrompt}`
      : params.prompt;

    let lastError: unknown;
    params.onProgress?.("Submitting generation request...");

    for (const model of VIDEO_MODELS) {
      try {
        console.log(`GeminiService: Trying video model ${model}`);
        const config: Record<string, unknown> = {
          durationSeconds,
          aspectRatio: "16:9", // Veo often supports 16:9 natively
          numberOfVideos: 1,
        };

        if (endImage) {
          config.lastFrame = endImage;
        }

        if (midImage) {
          config.referenceImages = [
            {
              image: midImage,
              referenceType: "ASSET",
            },
          ];
        }

        let operation = await ai.models.generateVideos({
          model,
          prompt: fullPrompt,
          image: startImage ?? undefined,
          config,
        } as any);

        params.onProgress?.("Synthesizing clip...");

        while (!operation.done) {
          await wait(5000);
          operation = await ai.operations.getVideosOperation({ operation } as any);
          params.onProgress?.("Rendering frames...");
        }

        if (operation.error) {
          throw new Error(JSON.stringify(operation.error));
        }

        const video = operation.response?.generatedVideos?.[0]?.video;
        if (!video) {
          throw new Error("Video generation finished with no video payload.");
        }

        if (video.videoBytes) {
          const mimeType = video.mimeType || "video/mp4";
          params.onProgress?.("Finalizing output...");
          return `data:${mimeType};base64,${video.videoBytes}`;
        }

        if (video.uri) {
          params.onProgress?.("Finalizing output...");
          return video.uri;
        }

        throw new Error("No playable video URL or bytes were returned.");
      } catch (error) {
        console.error(`GeminiService: Video model ${model} failed`, error);
        lastError = error;
      }
    }

    throw new Error(`Video generation failed: ${toErrorMessage(lastError)}`);
  },
};
