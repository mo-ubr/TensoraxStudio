/**
 * Tensorax Studio - Vertex AI Imagen API
 *
 * Uses Google Cloud Vertex AI (Imagen 3) for storyboard frame generation.
 * Supports subject reference for character consistency across the 9-frame grid.
 *
 * Auth: Credentials from process.env.GOOGLE_APPLICATION_CREDENTIALS
 */

import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "tensoraxstudio";
const LOCATION = (process.env.GOOGLE_LOCATION || process.env.LOCATION || process.env.REGION || "us-central1").trim().toLowerCase();
const PUBLISHER = "google";
const MODEL = "imagen-3.0-capability-001";

/**
 * imagen-3.0-capability-001: subject reference support (character consistency across frames).
 * imagen-3.0-generate-001: text-only, no reference images (20 RPM).
 */

/** Extract base64 from data URL. */
function toBase64(dataUrl) {
  if (!dataUrl) return null;
  const m = String(dataUrl).match(/^data:[^;]+;base64,(.+)$/);
  return m ? m[1] : (dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl);
}

/** Retry fetch with exponential backoff on 429, but do NOT retry on rate limit (saves quota). */
async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    const errText = await res.text();
    const isRateLimit = res.status === 429 || (errText && /rate limit|resource exhausted|quota|try again|exceeded/i.test(errText));
    if (isRateLimit) {
      const msg = (() => { try { const j = JSON.parse(errText); return j.error?.message || errText; } catch { return errText; } })();
      throw new Error(msg || "Rate limit exceeded. Wait a minute and try again.");
    }
    if (attempt < maxRetries) {
      const delayMs = Math.min(2000 * Math.pow(2, attempt), 10000);
      console.log(`[Tensorax] Request failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, delayMs));
      lastError = errText;
      continue;
    }
    let msg;
    try {
      const j = JSON.parse(errText);
      msg = j.error?.message || errText;
      if (res.status === 403) {
        console.error("[Tensorax] Vertex 403 full response:", errText);
      }
    } catch {
      msg = errText;
    }
    throw new Error(msg);
  }
  throw new Error(lastError || "Request failed");
}

/**
 * Generates a storyboard frame for Tensorax Studio.
 * Uses imagen-3.0-capability; characterRef is used for subject/character consistency.
 *
 * @param {string} prompt - The shot description (e.g., "Medium shot of hero looking at sunset")
 * @param {string} aspectRatio - "16:9", "9:16", "1:1", etc.
 * @param {string|null} characterRef - Data URL of reference image (subject/character) for consistency
 * @returns {Promise<string>} Base64 image string (data URL format)
 */
export async function generateTensoraxFrame(
  prompt,
  aspectRatio = "16:9",
  characterRef = null
) {
  const projectId = PROJECT_ID;
  if (!projectId) {
    throw new Error("GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set.");
  }

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error("Failed to obtain Vertex AI access token.");
  }

  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/${PUBLISHER}/models/${MODEL}:predict`;

  // capability-001 supports referenceImages for subject/character consistency.
  const refImages = [];
  if (characterRef) {
    const b64 = toBase64(characterRef);
    if (b64) {
      refImages.push({
        referenceType: "REFERENCE_TYPE_SUBJECT",
        referenceId: 1,
        referenceImage: { bytesBase64Encoded: b64 },
        subjectImageConfig: {
          subjectDescription: "the main subject or character",
          subjectType: "SUBJECT_TYPE_PERSON",
        },
      });
    }
  }

  const finalPrompt = refImages.length > 0 ? `${prompt} Feature the subject [1] consistently.` : prompt;
  const instance = {
    prompt: finalPrompt,
    ...(refImages.length > 0 && { referenceImages: refImages }),
  };
  const parameters = {
    sampleCount: 1,
    aspectRatio: aspectRatio || "16:9",
    safetySetting: "block_medium_and_above",
    personGeneration: "allow_adult",
  };

  try {
    const res = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ instances: [instance], parameters }),
    });

    const data = await res.json();
    const pred = data.predictions?.[0];
    const b64Image = pred?.bytesBase64Encoded;
    const mime = pred?.mimeType || "image/png";

    if (!b64Image) {
      throw new Error("Vertex AI returned no image data (possibly filtered by safety).");
    }

    console.log(`[Tensorax] Frame generated successfully.`);
    return `data:${mime};base64,${b64Image}`;
  } catch (error) {
    console.error("[Tensorax API Error]:", error.message);
    throw error;
  }
}
