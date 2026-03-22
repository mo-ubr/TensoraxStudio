/**
 * Kling AI video generation via fal.ai
 *
 * Uses the official @fal-ai/client SDK for reliable queue polling.
 *
 * Supports Kling V3 and O3 (Omni) models:
 * - V3 Standard / Pro  — best for prompt-driven cinematic generation
 * - O3 Standard / Pro  — best for reference-heavy workflows with character consistency
 *
 * Get your key at: https://fal.ai/dashboard/keys
 */

import { fal } from "@fal-ai/client";

// ─── Model endpoint mapping ────────────────────────────────────────────────
const KLING_ENDPOINTS = {
  "kling-v3-standard": {
    i2v: "fal-ai/kling-video/v3/standard/image-to-video",
    t2v: "fal-ai/kling-video/v3/standard/text-to-video",
  },
  "kling-v3-pro": {
    i2v: "fal-ai/kling-video/v3/pro/image-to-video",
    t2v: "fal-ai/kling-video/v3/pro/text-to-video",
  },
  "kling-o3-standard": {
    i2v: "fal-ai/kling-video/o3/standard/image-to-video",
    t2v: "fal-ai/kling-video/o3/standard/image-to-video",
  },
  "kling-o3-pro": {
    i2v: "fal-ai/kling-video/o3/pro/image-to-video",
    t2v: "fal-ai/kling-video/o3/pro/image-to-video",
  },
};

const KLING_MOTION_MODEL = "fal-ai/kling-video/motion-control";
const DEFAULT_MODEL = "kling-v3-standard";

function resolveEndpoint(modelName, isImageToVideo) {
  const endpoints = KLING_ENDPOINTS[modelName] || KLING_ENDPOINTS[DEFAULT_MODEL];
  return isImageToVideo ? endpoints.i2v : endpoints.t2v;
}

/**
 * Generate a video using Kling V3/O3 via fal.ai SDK.
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

  // Configure fal client with the user's API key
  fal.config({ credentials: apiKey.trim() });

  const modelLabel = model.replace("kling-", "").toUpperCase();
  let endpoint, input;

  if (motionVideoUrl && startImageUrl) {
    endpoint = KLING_MOTION_MODEL;
    input = {
      image_url: startImageUrl,
      video_url: motionVideoUrl,
      prompt: prompt.trim(),
      character_orientation: "video",
      keep_original_sound: false,
    };
    console.log(`[Kling ${modelLabel}] Using motion control mode`);
  } else if (startImageUrl) {
    endpoint = resolveEndpoint(model, true);
    input = {
      prompt: prompt.trim(),
      start_image_url: startImageUrl,
      ...(endImageUrl ? { end_image_url: endImageUrl } : {}),
      duration: String(duration),
      aspect_ratio: aspectRatio,
      generate_audio: generateAudio,
      negative_prompt: "blur, distort, low quality, deformed, extra limbs",
      cfg_scale: 0.5,
    };
    console.log(`[Kling ${modelLabel}] Image-to-video: ${endpoint}`);
  } else {
    endpoint = resolveEndpoint(model, false);
    input = {
      prompt: prompt.trim(),
      duration: String(duration),
      aspect_ratio: aspectRatio,
      generate_audio: generateAudio,
      negative_prompt: "blur, distort, low quality, deformed, extra limbs",
      cfg_scale: 0.5,
    };
    console.log(`[Kling ${modelLabel}] Text-to-video: ${endpoint}`);
  }

  onProgress?.(`Submitting to Kling ${modelLabel}...`);

  // Submit to queue
  const { request_id } = await fal.queue.submit(endpoint, { input });
  if (!request_id) throw new Error("Kling: no request_id returned from fal.ai");
  console.log(`[Kling ${modelLabel}] Submitted: ${request_id}`);
  onProgress?.(`⏳ Submitted — waiting in queue...`);

  // Poll using SDK
  const MAX_POLL_SECONDS = 600;
  let elapsed = 0;

  while (true) {
    await new Promise(r => setTimeout(r, 8000));
    elapsed += 8;

    if (elapsed > MAX_POLL_SECONDS) {
      throw new Error(`Kling: timed out after ${MAX_POLL_SECONDS}s. The job may still be running on fal.ai — check your dashboard.`);
    }

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    try {
      const status = await fal.queue.status(endpoint, { requestId: request_id, logs: true });
      console.log(`[Kling] ${status.status} (${timeStr})`);

      const queuePos = status.queue_position != null ? ` (position ${status.queue_position})` : '';

      if (status.status === 'IN_QUEUE') {
        onProgress?.(`⏳ Waiting in queue${queuePos} — ${timeStr} elapsed`);
      } else if (status.status === 'IN_PROGRESS') {
        onProgress?.(`🎬 Generating video — ${timeStr} elapsed`);
      } else if (status.status === 'COMPLETED') {
        onProgress?.(`✅ Video ready! Downloading...`);

        const result = await fal.queue.result(endpoint, { requestId: request_id });
        const videoUrl =
          result?.data?.video?.url ||
          result?.video?.url ||
          result?.data?.output?.video?.url;

        if (!videoUrl) throw new Error("Kling: completed but no video URL. Response: " + JSON.stringify(result).slice(0, 300));
        console.log("[Kling] Video ready:", videoUrl);
        return videoUrl;
      } else if (status.status === 'FAILED') {
        throw new Error("Kling generation failed: " + (status.error || JSON.stringify(status).slice(0, 200)));
      } else {
        onProgress?.(`Status: ${status.status} — ${timeStr} elapsed`);
      }

      if (elapsed >= 120 && status.status === 'IN_QUEUE') {
        onProgress?.(`⏳ Still in queue after ${timeStr} — fal.ai may be busy. This is normal for Kling.`);
      }
    } catch (err) {
      if (err.message?.includes('timed out') || err.message?.includes('failed')) throw err;
      console.warn("[Kling] Poll error:", err.message);
      onProgress?.(`⚠️ Poll error — retrying... (${timeStr})`);
    }
  }
}
