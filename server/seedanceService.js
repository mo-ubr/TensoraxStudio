/**
 * Seedance 2.0 video generation via fal.ai
 *
 * Uses the official @fal-ai/client SDK for reliable queue polling.
 * Image-to-video using ByteDance Seedance via fal.ai.
 *
 * Get your key at: https://fal.ai/dashboard/keys
 */

import { fal } from "@fal-ai/client";

const SEEDANCE_I2V_MODEL = "fal-ai/bytedance/seedance/v1/pro/image-to-video";
const SEEDANCE_T2V_MODEL = "fal-ai/bytedance/seedance/v1.5/pro/text-to-video";

/**
 * Generate a video using Seedance via fal.ai SDK.
 */
export async function generateSeedanceVideo({
  apiKey,
  startImageUrl,
  endImageUrl,
  prompt,
  duration = "5",
  aspectRatio = "auto",
  resolution = "1080p",
  onProgress,
}) {
  if (!apiKey) throw new Error("Seedance: missing fal.ai API key. Add it in Project Settings → Video Generation.");
  if (!startImageUrl) throw new Error("Seedance: no start image.");
  if (!prompt?.trim()) throw new Error("Seedance: no prompt provided.");

  // Configure fal client with the user's API key
  fal.config({ credentials: apiKey.trim() });

  const model = SEEDANCE_I2V_MODEL;
  const input = {
    prompt: prompt.trim(),
    image_url: startImageUrl,
    ...(endImageUrl ? { end_image_url: endImageUrl } : {}),
    duration: String(duration),
    aspect_ratio: aspectRatio,
    resolution,
    enable_safety_checker: true,
  };

  console.log("[Seedance] Submitting image-to-video request");
  onProgress?.("Submitting to Seedance 2.0...");

  // Submit to queue
  const { request_id } = await fal.queue.submit(model, { input });
  if (!request_id) throw new Error("Seedance: no request_id returned from fal.ai");
  console.log("[Seedance] Submitted:", request_id);
  onProgress?.(`⏳ Submitted — waiting in queue...`);

  // Poll using SDK
  const MAX_POLL_SECONDS = 600;
  let elapsed = 0;

  while (true) {
    await new Promise(r => setTimeout(r, 8000));
    elapsed += 8;

    if (elapsed > MAX_POLL_SECONDS) {
      throw new Error(`Seedance: timed out after ${MAX_POLL_SECONDS}s. The job may still be running on fal.ai — check your dashboard.`);
    }

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    try {
      const status = await fal.queue.status(model, { requestId: request_id, logs: true });
      console.log(`[Seedance] ${status.status} (${timeStr})`);

      const queuePos = status.queue_position != null ? ` (position ${status.queue_position})` : '';

      if (status.status === 'IN_QUEUE') {
        onProgress?.(`⏳ Waiting in queue${queuePos} — ${timeStr} elapsed`);
      } else if (status.status === 'IN_PROGRESS') {
        onProgress?.(`🎬 Generating video — ${timeStr} elapsed`);
      } else if (status.status === 'COMPLETED') {
        onProgress?.(`✅ Video ready! Downloading...`);

        const result = await fal.queue.result(model, { requestId: request_id });
        const videoUrl =
          result?.data?.video?.url ||
          result?.video?.url ||
          result?.data?.output?.video?.url;

        if (!videoUrl) throw new Error("Seedance: completed but no video URL. Response: " + JSON.stringify(result).slice(0, 300));
        console.log("[Seedance] Video ready:", videoUrl);
        return videoUrl;
      } else if (status.status === 'FAILED') {
        throw new Error("Seedance generation failed: " + (status.error || JSON.stringify(status).slice(0, 200)));
      } else {
        onProgress?.(`Status: ${status.status} — ${timeStr} elapsed`);
      }

      if (elapsed >= 120 && status.status === 'IN_QUEUE') {
        onProgress?.(`⏳ Still in queue after ${timeStr} — fal.ai may be busy. This is normal.`);
      }
    } catch (err) {
      if (err.message?.includes('timed out') || err.message?.includes('failed')) throw err;
      console.warn("[Seedance] Poll error:", err.message);
      onProgress?.(`⚠️ Poll error — retrying... (${timeStr})`);
    }
  }
}
