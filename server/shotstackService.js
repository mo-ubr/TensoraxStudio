/**
 * ShotstackService — server-side wrapper for the Shotstack Edit API.
 *
 * Submits render jobs, polls for completion, returns the final video URL.
 * Follows the same pattern as klingService.js / seedanceService.js.
 */

const SHOTSTACK_API_BASE = 'https://api.shotstack.io/edit';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300000; // 5 minutes

/**
 * Submit a Shotstack Edit for rendering and poll until complete.
 *
 * @param {Object} params
 * @param {string} params.apiKey - Shotstack API key
 * @param {string} [params.environment='v1'] - 'v1' (production) or 'stage' (sandbox)
 * @param {Object} params.edit - Full Shotstack Edit JSON (timeline + output)
 * @param {Function} [params.onProgress] - Progress callback
 * @returns {Promise<string>} Final rendered video URL
 */
export async function renderShotstackVideo({ apiKey, environment = 'v1', edit, onProgress }) {
  if (!apiKey?.trim()) {
    throw new Error('No Shotstack API key provided. Set it in Project Settings → Video Composition.');
  }

  const baseUrl = `${SHOTSTACK_API_BASE}/${environment}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-api-key': apiKey.trim(),
  };

  // 1. Submit render job
  onProgress?.('Submitting render job to Shotstack...');
  const submitRes = await fetch(`${baseUrl}/render`, {
    method: 'POST',
    headers,
    body: JSON.stringify(edit),
  });

  if (!submitRes.ok) {
    const errBody = await submitRes.text();
    throw new Error(`Shotstack render submit failed (${submitRes.status}): ${errBody}`);
  }

  const submitData = await submitRes.json();
  const renderId = submitData?.response?.id;
  if (!renderId) {
    throw new Error('Shotstack did not return a render ID');
  }

  console.log(`[Shotstack] Render queued: ${renderId}`);
  onProgress?.(`Render queued (${renderId}). Waiting for completion...`);

  // 2. Poll for completion
  const startTime = Date.now();
  const terminalStates = ['done', 'failed'];

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${baseUrl}/render/${renderId}`, { headers });
    if (!pollRes.ok) {
      const errBody = await pollRes.text();
      throw new Error(`Shotstack poll failed (${pollRes.status}): ${errBody}`);
    }

    const pollData = await pollRes.json();
    const status = pollData?.response?.status;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    console.log(`[Shotstack] Render ${renderId} — ${status} (${elapsed}s)`);

    if (status === 'queued') onProgress?.(`Queued... (${elapsed}s)`);
    else if (status === 'fetching') onProgress?.(`Fetching assets... (${elapsed}s)`);
    else if (status === 'rendering') onProgress?.(`Rendering video... (${elapsed}s)`);
    else if (status === 'saving') onProgress?.(`Saving final video... (${elapsed}s)`);

    if (terminalStates.includes(status)) {
      if (status === 'done') {
        const videoUrl = pollData.response.url;
        if (!videoUrl) throw new Error('Shotstack render done but no URL returned');
        console.log(`[Shotstack] Render complete: ${videoUrl}`);
        onProgress?.('Render complete!');
        return videoUrl;
      } else {
        throw new Error(`Shotstack render failed: ${JSON.stringify(pollData.response)}`);
      }
    }
  }

  throw new Error(`Shotstack render timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

/**
 * Probe a remote media file via Shotstack to get duration/metadata.
 */
export async function probeShotstackAsset({ apiKey, environment = 'v1', url }) {
  const baseUrl = `${SHOTSTACK_API_BASE}/${environment}`;
  const headers = {
    'Accept': 'application/json',
    'x-api-key': apiKey.trim(),
  };

  const res = await fetch(`${baseUrl}/probe/${encodeURIComponent(url)}`, { headers });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Shotstack probe failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data?.response;
}
