/**
 * Merge/stitch multiple video clips into one via fal.ai FFmpeg API.
 *
 * Endpoint: fal-ai/ffmpeg-api/merge-videos
 * Max 5 videos per call. If more than 5, chains multiple merges.
 *
 * Get your key at: https://fal.ai/dashboard/keys
 */

const FAL_BASE = "https://queue.fal.run";
const MERGE_ENDPOINT = "fal-ai/ffmpeg-api/merge-videos";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll fal.ai queue until COMPLETED or FAILED.
 */
async function pollFalQueue(endpoint, requestId, headers, onProgress) {
  const statusUrl = `${FAL_BASE}/${endpoint}/requests/${requestId}/status`;
  const resultUrl = `${FAL_BASE}/${endpoint}/requests/${requestId}`;
  let elapsed = 0;

  while (true) {
    await wait(3000);
    elapsed += 3;
    onProgress?.(`Merging videos... (${elapsed}s)`);

    const statusRes = await fetch(statusUrl, { headers });
    if (!statusRes.ok) { console.warn("[MergeVideos] Poll error", statusRes.status); continue; }

    const status = await statusRes.json();
    console.log("[MergeVideos] Status:", status.status);

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, { headers });
      if (!resultRes.ok) throw new Error(`MergeVideos: failed to fetch result (${resultRes.status})`);
      const result = await resultRes.json();
      const videoUrl = result?.video?.url;
      if (!videoUrl) throw new Error("MergeVideos: completed but no video URL. Response: " + JSON.stringify(result).slice(0, 300));
      console.log("[MergeVideos] Merged video ready:", videoUrl);
      return videoUrl;
    }

    if (status.status === "FAILED") {
      throw new Error("MergeVideos failed: " + (status.error || JSON.stringify(status).slice(0, 200)));
    }
  }
}

/**
 * Merge multiple video URLs into one.
 *
 * @param {object}   opts
 * @param {string}   opts.apiKey       fal.ai API key
 * @param {string[]} opts.videoUrls    Array of video URLs (min 2)
 * @param {string}   [opts.resolution] e.g. "landscape_16_9", "portrait_16_9"
 * @param {function} [opts.onProgress]
 * @returns {Promise<string>} merged video URL
 */
export async function mergeVideos({ apiKey, videoUrls, resolution, onProgress }) {
  if (!apiKey) throw new Error("MergeVideos: missing fal.ai API key.");
  if (!videoUrls || videoUrls.length < 2) throw new Error("MergeVideos: need at least 2 video URLs.");

  const headers = {
    "Authorization": `Key ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  // fal.ai allows max 5 per call — chain merges if more
  let urls = [...videoUrls];

  while (urls.length > 1) {
    const batch = urls.splice(0, 5);
    if (batch.length < 2 && urls.length > 0) {
      // Shouldn't happen, but safeguard
      batch.push(urls.shift());
    }
    if (batch.length < 2) {
      urls = batch;
      break;
    }

    const body = {
      video_urls: batch,
      ...(resolution ? { resolution } : {}),
    };

    onProgress?.(`Merging ${batch.length} clips...`);
    console.log(`[MergeVideos] Submitting ${batch.length} clips for merge`);

    const submitRes = await fetch(`${FAL_BASE}/${MERGE_ENDPOINT}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      throw new Error(`MergeVideos submit failed (${submitRes.status}): ${err}`);
    }

    const { request_id } = await submitRes.json();
    if (!request_id) throw new Error("MergeVideos: no request_id returned.");
    console.log("[MergeVideos] Task submitted:", request_id);

    const mergedUrl = await pollFalQueue(MERGE_ENDPOINT, request_id, headers, onProgress);
    urls.unshift(mergedUrl); // Use the merged result as input for the next batch
  }

  return urls[0];
}
