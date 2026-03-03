/**
 * Vertex AI Imagen 3 - Image generation.
 * - imagen-3.0-capability-001: supports subject reference (character consistency across frames).
 * - imagen-3.0-generate-001: text-only, no reference images (20 RPM).
 *
 * Prerequisites:
 * - Enable Vertex AI API in Google Cloud Console
 * - Set GOOGLE_APPLICATION_CREDENTIALS to path of service account JSON
 * - Set GOOGLE_PROJECT_ID (or GOOGLE_CLOUD_PROJECT)
 */

import { GoogleAuth } from "google-auth-library";

const LOCATION = (process.env.GOOGLE_LOCATION || process.env.LOCATION || process.env.REGION || "us-central1").trim().toLowerCase();
const MODEL = "imagen-3.0-capability-001";
const SUPPORTS_REFERENCE_IMAGES = MODEL.includes("capability");

/** Extract base64 from data URL (data:image/png;base64,...) */
function parseDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : null;
}

/**
 * Generate a storyboard frame using Vertex AI Imagen 3.
 * Supports subject reference images for character consistency across the 9-frame grid.
 *
 * @param {string} prompt - Text prompt for the shot
 * @param {string} aspectRatio - e.g. "9:16", "1:1", "16:9"
 * @param {string[]} referenceImages - Base64 data URLs (character/clothing/background)
 * @param {string} [sampleImageSize] - "1K" or "2K"
 * @returns {Promise<string>} Data URL of generated image
 */
export async function generateStoryboardFrame(
  prompt,
  aspectRatio = "9:16",
  referenceImages = [],
  sampleImageSize = "1K"
) {
  const projectId =
    process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error(
      "GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set for Vertex AI."
    );
  }

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) {
    throw new Error("Failed to obtain Vertex AI access token.");
  }

  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`;

  // Only capability-001 supports reference images; generate-001 is text-only.
  const refImages = [];
  if (SUPPORTS_REFERENCE_IMAGES) {
    const base64Images = referenceImages
      .map(parseDataUrl)
      .filter(Boolean)
      .slice(0, 4);
    for (let i = 0; i < base64Images.length; i++) {
      refImages.push({
        referenceType: "REFERENCE_TYPE_SUBJECT",
        referenceId: 1,
        referenceImage: { bytesBase64Encoded: base64Images[i] },
        subjectImageConfig: {
          subjectDescription: "the main subject or character",
          subjectType: "SUBJECT_TYPE_PERSON",
        },
      });
    }
  }

  let finalPrompt = prompt;
  if (refImages.length > 0) {
    finalPrompt = `${prompt} Feature the subject [1] consistently.`;
  }

  const body = {
    instances: [
      {
        prompt: finalPrompt,
        ...(refImages.length > 0 && { referenceImages: refImages }),
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: aspectRatio || "9:16",
      sampleImageSize: sampleImageSize === "4K" ? "2K" : sampleImageSize,
      safetySetting: "block_medium_and_above",
      personGeneration: "allow_adult",
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error?.message || errText;
    } catch {
      errMsg = errText;
    }
    throw new Error(`Vertex AI Imagen error: ${errMsg}`);
  }

  const data = await res.json();
  const predictions = data.predictions;
  if (!predictions?.length) {
    throw new Error("Vertex AI returned no predictions.");
  }

  const b64 = predictions[0].bytesBase64Encoded;
  const mime = predictions[0].mimeType || "image/png";
  if (!b64) {
    throw new Error("Vertex AI response missing image data (possibly filtered by safety).");
  }

  return `data:${mime};base64,${b64}`;
}
