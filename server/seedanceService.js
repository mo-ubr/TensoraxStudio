/**
 * Seedance 2.0 video generation via fal.ai
 *
 * Image-to-video using ByteDance Seedance via fal.ai queue API.
 * Supports start frame, optional end frame, duration 2–12s, resolution up to 1080p.
 *
 * Get your key at: https://fal.ai/dashboard/keys
 */

const FAL_BASE = "https://queue.fal.run";

const SEEDANCE_I2V_MODEL = "fal-ai/bytedance/seedance/v1/pro/image-to-video";
const SEEDANCE_T2V_MODEL = "fal-ai/bytedance/seedance/v1.5/pro/text-to-video";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll fal.ai queue until COMPLETED or FAILED.
 */
async function pollFalQueue(model, requestId, headers, onProgress) {
  const statusUrl = `${FAL_BASE}/${model}/requests/${requestId}/status`;
  const resultUrl = `${FAL_BASE}/${model}/requests/${requestId}`;
  // Status/result polling must use GET with only Authorization — no Content-Type
  const pollHeaders = { "Authorization": headers["Authorization"] };

  let elapsed = 0;
  let lastStatus = '';
  const MAX_POLL_SECONDS = 300;

  while (true) {
    await wait(8000);
    elapsed += 8;

    if (elapsed > MAX_POLL_SECONDS) {
      throw new Error(`Seedance: timed out after ${MAX_POLL_SECONDS}s. The job may still be running on fal.ai — check your dashboard.`);
    }

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    let statusText = 'Checking...';
    let falStatus = null;

    try {
      const statusRes = await fetch(statusUrl, { method: 'GET', headers: pollHeaders });
      if (!statusRes.ok) {
        console.warn("[Seedance] Poll error", statusRes.status);
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
      console.warn("[Seedance] Fetch error during poll:", fetchErr.message);
      onProgress?.(`⚠️ Network error — retrying... (${timeStr})`);
      continue;
    }

    console.log(`[Seedance] ${lastStatus} (${timeStr})`);
    onProgress?.(statusText);

    if (falStatus?.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, { method: 'GET', headers: pollHeaders });
      if (!resultRes.ok) throw new Error(`Seedance: failed to fetch result (${resultRes.status})`);
      const result = await resultRes.json();
      const videoUrl =
        result?.video?.url ||
        result?.output?.video?.url ||
        result?.outputs?.[0]?.video?.url;
      if (!videoUrl) throw new Error("Seedance: completed but no video URL. Response: " + JSON.stringify(result).slice(0, 300));
      console.log("[Seedance] Video ready:", videoUrl);
      return videoUrl;
    }

    if (falStatus?.status === "FAILED") {
      throw new Error("Seedance generation failed: " + (falStatus.error || JSON.stringify(falStatus).slice(0, 200)));
    }

    if (elapsed >= 120 && lastStatus === 'IN_QUEUE') {
      onProgress?.(`⏳ Still in queue after ${timeStr} — fal.ai may be busy. This is normal.`);
    }
  }
}

/**
 * Generate a video using Seedance via fal.ai.
 *
 * @param {object}   opts
 * @param {string}   opts.apiKey          fal.ai API key
 * @param {string}   opts.startImageUrl   data-URI or HTTPS URL of start frame
 * @param {string}   [opts.endImageUrl]   optional end frame
 * @param {string}   opts.prompt
 * @param {string}   [opts.duration]      "5" (default) — supports "2"–"12"
 * @param {string}   [opts.aspectRatio]   "16:9" | "9:16" | "1:1" | "auto"
 * @param {string}   [opts.resolution]    "480p" | "720p" | "1080p"
 * @param {function} [opts.onProgress]
 * @returns {Promise<string>} video URL
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
  if (!startImageUrl) throw new Error("Seedance: no start image. Use Prompt Only mode (Veo) for text-to-video, or upload a Start frame.");
  if (!prompt?.trim()) throw new Error("Seedance: no prompt provided.");

  const headers = {
    "Authorization": `Key ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  const model = SEEDANCE_I2V_MODEL;

  const body = {
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
  const submitRes = await fetch(`${FAL_BASE}/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Seedance submit failed (${submitRes.status}): ${err}`);
  }

  const { request_id } = await submitRes.json();
  if (!request_id) throw new Error("Seedance: no request_id returned from fal.ai");
  console.log("[Seedance] Task submitted:", request_id);

  return pollFalQueue(model, request_id, headers, onProgress);
}
