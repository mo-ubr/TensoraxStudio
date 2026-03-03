import type { ImageGenParams } from "./geminiService";
import { GeminiService } from "./geminiService";

export type ImageProviderId = "gemini" | "openai" | "other";

const STORAGE_KEY = "tensorax_image_provider";

const buildPrompt = (params: ImageGenParams) => {
  if (params.referenceImages.length === 0) return params.prompt;
  return `${params.prompt}\nUse visual consistency with the provided references for subject identity, style, and environment continuity.`;
};

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
    if (raw === "gemini" || raw === "openai" || raw === "other") return raw;
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
