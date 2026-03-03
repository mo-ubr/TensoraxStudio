/**
 * OpenAI DALL-E 3 image generation.
 * Alternative when Google/Vertex quotas are exceeded.
 */

import OpenAI from "openai";

const SIZE_MAP = {
  "9:16": "1024x1792",
  "1:1": "1024x1024",
  "16:9": "1792x1024",
  "3:4": "1024x1792",
  "4:3": "1792x1024",
};

export async function generateWithDalle(prompt, aspectRatio = "9:16") {
  const key = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY not set. Add it to .env.local to use DALL-E 3.");
  }

  const openai = new OpenAI({ apiKey: key.trim() });
  const size = SIZE_MAP[aspectRatio] || "1024x1792";

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    size,
    n: 1,
    response_format: "b64_json",
    quality: "standard",
    style: "vivid",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data.");
  return `data:image/png;base64,${b64}`;
}
