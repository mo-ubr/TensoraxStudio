/**
 * Kling AI video generation via fal.ai
 *
 * Uses Kling V3 Standard which supports:
 * - Image-to-video (start frame + prompt)
 * - End frame
 * - Motion reference video (via elements parameter)
 * - Native audio generation
 * - 3–15 second duration, up to 1080p
 *
 * Get your key at: https://fal.ai/dashboard/keys
 */

const FAL_BASE = "https://queue.fal.run";

// Kling V3 Standard – supports elements (motion video reference)
const KLING_V3_MODEL = "fal-ai/kling-video/v3/standard/image-to-video";
// Kling Motion Control – dedicated endpoint for video-as-motion-reference
const KLING_MOTION_MODEL = "fal-ai/kling-video/motion-control";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll fal.ai queue until the request is COMPLETED or FAILED.
 */
async function pollFalQueue(model, requestId, headers, onProgress) {
  const statusUrl = `${FAL_BASE}/${model}/requests/${requestId}/status`;
  const resultUrl = `${FAL_BASE}/${model}/requests/${requestId}`;

  const progressMessages = [
    "Analysing reference frame...",
    "Synthesising motion vectors...",
    "Applying character consistency...",
    "Rendering keyframes...",
    "Encoding video stream...",
    "Finalising output...",
  ];
  let msgIdx = 0;
  let elapsed = 0;

  while (true) {
    await wait(8000);
    elapsed += 8;
    onProgress?.(`${progressMessages[msgIdx % progressMessages.length]} (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`);
    msgIdx++;

    const statusRes = await fetch(statusUrl, { headers });
    if (!statusRes.ok) { console.warn("[Kling] Poll error", statusRes.status); continue; }

    const status = await statusRes.json();
    console.log("[Kling] Status:", status.status);

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, { headers });
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

    if (status.status === "FAILED") {
      throw new Error("Kling generation failed: " + (status.error || JSON.stringify(status).slice(0, 200)));
    }
  }
}

/**
 * Generate a video using Kling V3 via fal.ai.
 *
 * @param {object}   opts
 * @param {string}   opts.apiKey          fal.ai API key
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
  if (!startImageUrl) throw new Error("Kling: no start image. Hover over a generated frame and click 'start'.");
  if (!prompt?.trim()) throw new Error("Kling: no prompt provided.");

  const headers = {
    "Authorization": `Key ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  let model, body;

  if (motionVideoUrl) {
    model = KLING_MOTION_MODEL;
    body = {
      image_url: startImageUrl,
      video_url: motionVideoUrl,
      prompt: prompt.trim(),
      character_orientation: "video",
      keep_original_sound: false,
    };
    console.log("[Kling] Using motion control mode with reference video");
  } else {
    model = KLING_V3_MODEL;
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
    console.log("[Kling] Using V3 standard image-to-video");
  }

  onProgress?.("Submitting to Kling V3...");
  const submitRes = await fetch(`${FAL_BASE}/${model}`, {
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
  console.log("[Kling] Task submitted:", request_id);

  return pollFalQueue(model, request_id, headers, onProgress);
}
