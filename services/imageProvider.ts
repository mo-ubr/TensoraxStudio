import type { ImageGenParams } from "./geminiService";
import { GeminiService } from "./geminiService";
import { getFalApiKey } from "./imageTaskRouter";

export type ImageProviderId = "gemini" | "openai" | "fal-edit" | "other";

const STORAGE_KEY = "tensorax_image_provider";

const buildPrompt = (params: ImageGenParams) => {
  if (params.referenceImages.length === 0) return params.prompt;
  return `${params.prompt}\nUse visual consistency with the provided references for subject identity, style, and environment continuity.`;
};

/**
 * Edit an existing image via fal.ai (Flux Kontext / Nano Banana).
 * Used for faithful reproduction with text replacement.
 */
async function editWithFal(params: ImageGenParams): Promise<string> {
  const apiKey = getFalApiKey();
  if (!apiKey) throw new Error("fal.ai API key not set. Add it in Settings → Image Edit Key.");

  // Need at least one reference image to edit
  if (!params.referenceImages?.length) {
    throw new Error("Faithful image edit requires a reference image. Please attach the image you want to reproduce.");
  }

  const sourceImage = params.referenceImages[0];
  const modelId = localStorage.getItem('tensorax_fal_model')?.trim() || 'nano-banana';

  const res = await fetch("/api/image-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      imageUrl: sourceImage,
      prompt: params.prompt,
      modelId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `fal.ai image edit: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.url) throw new Error("fal.ai returned no image URL.");
  return data.url;
}

async function generateWithOpenAI(params: ImageGenParams): Promise<string> {
  const res = await fetch("/api/generate-image-openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: buildPrompt(params),
      aspectRatio: params.aspectRatio,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `OpenAI: ${res.status}`);
  }
  const data = await res.json();
  if (!data?.dataUrl) throw new Error("OpenAI returned no image.");
  return data.dataUrl;
}

export interface ImageProvider {
  id: ImageProviderId;
  label: string;
  generateImage(params: ImageGenParams): Promise<string>;
}

const providers: Record<ImageProviderId, ImageProvider> = {
  gemini: {
    id: "gemini",
    label: "Gemini (Imagen)",
    generateImage: (params) => GeminiService.generateImage(params),
  },
  openai: {
    id: "openai",
    label: "OpenAI (DALL-E 3)",
    generateImage: generateWithOpenAI,
  },
  "fal-edit": {
    id: "fal-edit",
    label: "fal.ai Image Edit (Flux Kontext / Nano Banana)",
    generateImage: editWithFal,
  },
  other: {
    id: "other",
    label: "Other (add your API)",
    generateImage: async () => {
      throw new Error(
        "Add your image API in services/imageProvider.ts (e.g. Replicate). Use provider id 'other' and implement generateImage."
      );
    },
  },
};

export function getImageProvider(id: ImageProviderId): ImageProvider {
  return providers[id];
}

export function getAllProviders(): ImageProvider[] {
  return Object.values(providers);
}

export function getDefaultImageProviderId(): ImageProviderId {
  if (typeof window === "undefined") return "gemini";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "gemini" || raw === "openai" || raw === "fal-edit" || raw === "other") return raw;
  } catch {
    // ignore
  }
  return "gemini";
}

export function setDefaultImageProviderId(id: ImageProviderId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

/** Generate image using the currently selected provider. */
export async function generateImageWithCurrentProvider(params: ImageGenParams): Promise<string> {
  const id = getDefaultImageProviderId();
  const provider = getImageProvider(id);
  return provider.generateImage(params);
}
