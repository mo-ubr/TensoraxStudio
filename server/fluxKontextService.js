/**
 * Image-to-image editing via fal.ai
 *
 * Supports:
 *   - Nano Banana (Google)  — fal-ai/nano-banana/edit     ($0.039/image, recommended)
 *   - Nano Banana Pro        — fal-ai/nano-banana-pro/edit ($0.15/image)
 *   - Nano Banana 2          — fal-ai/nano-banana-2/edit
 *   - Flux Kontext Dev       — fal-ai/flux-kontext/dev     ($0.025/MP)
 *   - Flux Kontext Pro       — fal-ai/flux-pro/kontext     ($0.04/image)
 *
 * Docs:
 *   https://fal.ai/models/fal-ai/nano-banana/edit/api
 *   https://fal.ai/models/fal-ai/flux-kontext/dev/api
 */

const FAL_BASE = "https://queue.fal.run";

// ─── Model registry ─────────────────────────────────────────────────────────

const MODELS = {
  // Nano Banana family (Google-powered)
  "nano-banana":       "fal-ai/nano-banana/edit",
  "nano-banana-pro":   "fal-ai/nano-banana-pro/edit",
  "nano-banana-2":     "fal-ai/nano-banana-2/edit",
  // Flux Kontext family
  "flux-kontext-dev":  "fal-ai/flux-kontext/dev",
  "flux-kontext-pro":  "fal-ai/flux-pro/kontext",
};

function resolveModel(modelId) {
  if (!modelId) return { falModel: MODELS["nano-banana"], label: "Nano Banana", family: "nano-banana" };
  const key = modelId.toLowerCase().trim();
  if (MODELS[key]) {
    const family = key.startsWith("nano-banana") ? "nano-banana" : "flux-kontext";
    return { falModel: MODELS[key], label: key, family };
  }
  // Fallback: treat unknown as nano-banana
  return { falModel: MODELS["nano-banana"], label: "Nano Banana", family: "nano-banana" };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll fal.ai queue until the request is COMPLETED or FAILED.
 */
async function pollFalQueue(model, requestId, headers, onProgress) {
  const statusUrl = `${FAL_BASE}/${model}/requests/${requestId}/status`;
  const resultUrl = `${FAL_BASE}/${model}/requests/${requestId}`;

  const progressMessages = [
    "Analysing input image...",
    "Applying transformation...",
    "Preserving composition...",
    "Rendering output...",
    "Finalising image...",
  ];
  let msgIdx = 0;
  let elapsed = 0;

  while (true) {
    await wait(3000);
    elapsed += 3;
    onProgress?.(`${progressMessages[msgIdx % progressMessages.length]} (${elapsed}s)`);
    msgIdx++;

    const statusRes = await fetch(statusUrl, { headers });
    if (!statusRes.ok) { console.warn("[ImageEdit] Poll error", statusRes.status); continue; }

    const status = await statusRes.json();
    console.log("[ImageEdit] Status:", status.status);

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, { headers });
      if (!resultRes.ok) throw new Error(`ImageEdit: failed to fetch result (${resultRes.status})`);
      const result = await resultRes.json();
      const imageUrl =
        result?.images?.[0]?.url ||
        result?.output?.images?.[0]?.url;
      if (!imageUrl) throw new Error("ImageEdit: completed but no image URL. Response: " + JSON.stringify(result).slice(0, 300));
      console.log("[ImageEdit] Image ready:", imageUrl);
      return {
        url: imageUrl,
        width: result?.images?.[0]?.width,
        height: result?.images?.[0]?.height,
      };
    }

    if (status.status === "FAILED") {
      throw new Error("Image generation failed: " + (status.error || JSON.stringify(status).slice(0, 200)));
    }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Transform an image using fal.ai (Nano Banana or Flux Kontext).
 *
 * @param {object}   opts
 * @param {string}   opts.apiKey            fal.ai API key
 * @param {string}   opts.imageUrl          Source image (data-URI or HTTPS URL)
 * @param {string}   opts.prompt            Transformation instruction
 * @param {string}   [opts.modelId]         Model key: "nano-banana" | "nano-banana-pro" | "nano-banana-2" | "flux-kontext-dev" | "flux-kontext-pro"
 * @param {number}   [opts.guidanceScale]   CFG scale — only for Flux Kontext (default 2.5)
 * @param {number}   [opts.steps]           Inference steps — only for Flux Kontext (default 28)
 * @param {number}   [opts.seed]            Optional seed for reproducibility
 * @param {string}   [opts.outputFormat]    "jpeg" or "png" (default "jpeg")
 * @param {boolean}  [opts.usePro]          DEPRECATED — use modelId instead
 * @param {function} [opts.onProgress]
 * @returns {Promise<{url: string, width: number, height: number}>}
 */
export async function generateFluxKontextImage({
  apiKey,
  imageUrl,
  prompt,
  modelId,
  guidanceScale = 2.5,
  steps = 28,
  seed,
  outputFormat = "jpeg",
  usePro = false,
  onProgress,
}) {
  if (!apiKey) throw new Error("ImageEdit: missing fal.ai API key.");
  if (!imageUrl) throw new Error("ImageEdit: no input image provided.");
  if (!prompt?.trim()) throw new Error("ImageEdit: no transformation prompt provided.");

  // Legacy usePro flag → flux-kontext-pro
  if (!modelId && usePro) modelId = "flux-kontext-pro";

  const { falModel, label, family } = resolveModel(modelId);

  const headers = {
    "Authorization": `Key ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  // Build request body based on model family
  let body;
  if (family === "nano-banana") {
    // Nano Banana API: uses image_urls (array)
    body = {
      prompt: prompt.trim(),
      image_urls: [imageUrl],
      num_images: 1,
      output_format: outputFormat,
      ...(seed != null ? { seed } : {}),
    };
  } else {
    // Flux Kontext API: uses image_url (string)
    body = {
      prompt: prompt.trim(),
      image_url: imageUrl,
      guidance_scale: guidanceScale,
      num_inference_steps: steps,
      num_images: 1,
      output_format: outputFormat,
      resolution_mode: "match_input",
      ...(seed != null ? { seed } : {}),
    };
  }

  onProgress?.(`Submitting to ${label}...`);
  console.log(`[ImageEdit] Using ${label} (${falModel})`);
  const submitRes = await fetch(`${FAL_BASE}/${falModel}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`${label} submit failed (${submitRes.status}): ${err}`);
  }

  const { request_id } = await submitRes.json();
  if (!request_id) throw new Error(`${label}: no request_id returned from fal.ai`);
  console.log(`[ImageEdit] Task submitted (${label}):`, request_id);

  return pollFalQueue(falModel, request_id, headers, onProgress);
}
