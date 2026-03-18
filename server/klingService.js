/**
 * Kling AI video generation via fal.ai
 *
 * Supports Kling V3 and O3 (Omni) models:
 * - V3 Standard / Pro  — best for prompt-driven cinematic generation
 * - O3 Standard / Pro  — best for reference-heavy workflows with character consistency
 *
 * All support: image-to-video, text-to-video, start/end frames,
 * motion reference video, native audio, 3–15 second duration, up to 1080p
 *
 * Get your key at: https://fal.ai/dashboard/keys
 */

const FAL_BASE = "https://queue.fal.run";

// ─── Model endpoint mapping ────────────────────────────────────────────────
const KLING_ENDPOINTS = {
  // V3 models
  "kling-v3-standard": {
    i2v: "fal-ai/kling-video/v3/standard/image-to-video",
    t2v: "fal-ai/kling-video/v3/standard/text-to-video",
  },
  "kling-v3-pro": {
    i2v: "fal-ai/kling-video/v3/pro/image-to-video",
    t2v: "fal-ai/kling-video/v3/pro/text-to-video",
  },
  // O3 Omni models
  "kling-o3-standard": {
    i2v: "fal-ai/kling-video/o3/standard/image-to-video",
    t2v: "fal-ai/kling-video/o3/standard/image-to-video", // O3 uses same endpoint
  },
  "kling-o3-pro": {
    i2v: "fal-ai/kling-video/o3/pro/image-to-video",
    t2v: "fal-ai/kling-video/o3/pro/image-to-video",
  },
};

// Motion control (shared across all Kling models)
const KLING_MOTION_MODEL = "fal-ai/kling-video/motion-control";

// Default fallback
const DEFAULT_MODEL = "kling-v3-standard";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve the fal.ai endpoint ID from a model name.
 */
function resolveEndpoint(modelName, isImageToVideo) {
  const endpoints = KLING_ENDPOINTS[modelName] || KLING_ENDPOINTS[DEFAULT_MODEL];
  return isImageToVideo ? endpoints.i2v : endpoints.t2v;
}

/**
 * Poll fal.ai queue until the request is COMPLETED or FAILED.
 */
const MAX_POLL_SECONDS = 600; // 10-minute timeout — Kling can be slow when queue is busy

async function pollFalQueue(model, requestId, headers, onProgress) {
  const statusUrl = `${FAL_BASE}/${model}/requests/${requestId}/status`;
  const resultUrl = `${FAL_BASE}/${model}/requests/${requestId}`;
  // fal.ai queue polling requires POST (GET returns 405)
  const pollHeaders = { "Authorization": headers["Authorization"], "Content-Type": "application/json" };

  let elapsed = 0;
  let lastStatus = '';

  while (true) {
    await wait(8000);
    elapsed += 8;

    if (elapsed > MAX_POLL_SECONDS) {
      throw new Error(`Kling: timed out after ${MAX_POLL_SECONDS}s. The job may still be running on fal.ai — check your dashboard.`);
    }

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    let statusText = 'Checking...';
    let falStatus = null;

    try {
      const statusRes = await fetch(statusUrl, { method: 'POST', headers: pollHeaders });
      if (!statusRes.ok) {
        console.warn("[Kling] Poll error", statusRes.status);
        onProgress?.(`⚠️ Poll error (HTTP ${statusRes.status}) — retrying... (${timeStr})`);
        continue;
      }

      falStatus = await statusRes.json();
      lastStatus = falStatus.status;
      const queuePos = falStatus.queue_position != null ? ` (position ${falStatus.queue_position})` : '';

      if (falStatus.status === 'IN_QUEUE') {
        statusText = `⏳ Waiting in queue${queuePos} — ${timeStr} elapsed`;
      } else if (falStatus.status === 'IN_PROGRESS') {
        statusText = `🎬 Generating video — ${timeStr} elapsed`;
      } else if (falStatus.status === 'COMPLETED') {
        statusText = `✅ Video ready! Downloading...`;
      } else if (falStatus.status === 'FAILED') {
        statusText = `❌ Generation failed`;
      } else {
        statusText = `Status: ${falStatus.status} — ${timeStr} elapsed`;
      }
    } catch (fetchErr) {
      console.warn("[Kling] Fetch error during poll:", fetchErr.message);
      onProgress?.(`⚠️ Network error — retrying... (${timeStr})`);
      continue;
    }

    console.log(`[Kling] ${lastStatus} (${timeStr})`);
    onProgress?.(statusText);

    if (falStatus?.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, { method: 'POST', headers: pollHeaders });
      if (!resultRes.ok) throw new Error(`Kling: failed to fetch result (${resultRes.status})`);
      const result = await resultRes.json();
      const videoUrl =
        result?.video?.url ||
        result?.output?.video?.url ||
        result?.outputs?.[0]?.video?.url;
      if (!videoUrl) throw new Error("Kling: completed but no video URL. Response: " + JSON.stringify(result).slice(0, 300));
      console.log("[Kling] Video ready:", videoUrl);
      return videoUrl;
    }

    if (falStatus?.status === "FAILED") {
      throw new Error("Kling generation failed: " + (falStatus.error || JSON.stringify(falStatus).slice(0, 200)));
    }

    // Warn if it's been a long time in queue
    if (elapsed >= 120 && lastStatus === 'IN_QUEUE') {
      onProgress?.(`⏳ Still in queue after ${timeStr} — fal.ai may be busy. This is normal for Kling.`);
    }
  }
}

/**
 * Generate a video using Kling V3/O3 via fal.ai.
 *
 * @param {object}   opts
 * @param {string}   opts.apiKey          fal.ai API key
 * @param {string}   [opts.model]         model name (e.g. "kling-v3-standard", "kling-o3-pro")
 * @param {string}   opts.startImageUrl   data-URI or HTTPS URL of start frame
 * @param {string}   [opts.endImageUrl]   optional end frame
 * @param {string}   [opts.motionVideoUrl] optional motion reference video
 * @param {string}   opts.prompt
 * @param {string}   [opts.duration]      "5"–"15" (default "5")
 * @param {string}   [opts.aspectRatio]   "9:16" | "16:9" | "1:1"
 * @param {boolean}  [opts.generateAudio] whether to generate native audio
 * @param {function} [opts.onProgress]
 * @returns {Promise<string>} video URL
 */
export async function generateKlingVideo({
  apiKey,
  model = DEFAULT_MODEL,
  startImageUrl,
  endImageUrl,
  motionVideoUrl,
  prompt,
  duration = "5",
  aspectRatio = "9:16",
  generateAudio = false,
  onProgress,
}) {
  if (!apiKey) throw new Error("Kling: missing fal.ai API key. Add it in the Video tab settings.");
  if (!prompt?.trim()) throw new Error("Kling: no prompt provided.");

  const headers = {
    "Authorization": `Key ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  const modelLabel = model.replace("kling-", "").toUpperCase();
  let endpoint, body;

  if (motionVideoUrl && startImageUrl) {
    // Motion control mode — dedicated endpoint, works with any Kling tier
    endpoint = KLING_MOTION_MODEL;
    body = {
      image_url: startImageUrl,
      video_url: motionVideoUrl,
      prompt: prompt.trim(),
      character_orientation: "video",
      keep_original_sound: false,
    };
    console.log(`[Kling ${modelLabel}] Using motion control mode with reference video`);
  } else if (startImageUrl) {
    // Image-to-video
    endpoint = resolveEndpoint(model, true);
    body = {
      prompt: prompt.trim(),
      start_image_url: startImageUrl,
      ...(endImageUrl ? { end_image_url: endImageUrl } : {}),
      duration: String(duration),
      aspect_ratio: aspectRatio,
      generate_audio: generateAudio,
      negative_prompt: "blur, distort, low quality, deformed, extra limbs",
      cfg_scale: 0.5,
    };
    console.log(`[Kling ${modelLabel}] Using image-to-video: ${endpoint}`);
  } else {
    // Text-to-video
    endpoint = resolveEndpoint(model, false);
    body = {
      prompt: prompt.trim(),
      duration: String(duration),
      aspect_ratio: aspectRatio,
      generate_audio: generateAudio,
      negative_prompt: "blur, distort, low quality, deformed, extra limbs",
      cfg_scale: 0.5,
    };
    console.log(`[Kling ${modelLabel}] Using text-to-video: ${endpoint}`);
  }

  onProgress?.(`Submitting to Kling ${modelLabel}...`);
  const submitRes = await fetch(`${FAL_BASE}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Kling submit failed (${submitRes.status}): ${err}`);
  }

  const { request_id } = await submitRes.json();
  if (!request_id) throw new Error("Kling: no request_id returned from fal.ai");
  console.log(`[Kling ${modelLabel}] Task submitted:`, request_id);

  return pollFalQueue(endpoint, request_id, headers, onProgress);
}
