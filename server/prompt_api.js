/**
 * Tensorax Studio - Prompt Generation API (Claude + Gemini)
 *
 * Runs Analysis (Step 1) and Copy (Step 2) server-side to avoid CORS.
 * Supports both Anthropic Claude and Google Gemini.
 */

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_CLAUDE = [
  "claude-opus-4-6",           // Latest Opus
  "claude-sonnet-4-6",         // Latest Sonnet
  "claude-sonnet-4-5",         // Sonnet 4.5 alias
  "claude-haiku-4-5",          // Haiku 4.5 alias
  "claude-sonnet-4-20250514",  // Sonnet 4 snapshot
  "claude-haiku-4-5-20251001", // Haiku 4.5 snapshot
  "claude-3-7-sonnet-20250219",// Sonnet 3.7
  "claude-3-haiku-20240307",   // Haiku 3 – available on all tiers
];
const DEFAULT_GEMINI = ["gemini-2.5-flash", "gemini-2.0-flash"];

const SHOT_SPECS = `Row 1 – Establishing Context:
1. ELS – Extreme Long Shot: Subject(s) small within the vast environment.
2. LS – Long Shot: Complete subject(s) or group visible from top to bottom (head to toe / wheels to roof).
3. MLS – Medium Long (American/3-4): Framed from knees up (for people) or a 3/4 view (for objects).

Row 2 – The Core Coverage:
4. MS – Medium Shot: Framed from the waist up (or central core of the object). Focus on interaction/action.
5. MCU – Medium Close-Up: Framed from chest up. Intimate framing of the main subject(s).
6. CU – Close-Up: Tight framing on the face(s) or the "front" of the object.

Row 3 – Details & Angles:
7. ECU – Extreme Close-Up: Macro detail focusing intensely on a key feature (eyes, hands, logo, texture).
8. Low Angle (Worm's Eye): Looking up at the subject(s) from the ground – imposing/heroic.
9. High Angle (Bird's Eye): Looking down on the subject(s) from above.`;

const CONTINUITY_RULES = `Non-negotiable continuity rules:
- First, analyse the full composition: identify ALL key subjects (person/group/vehicle/object/animal/props/environment elements) and describe spatial relationships and interactions (left/right/foreground/background, facing direction, what each is doing).
- Do NOT guess real identities, exact real-world locations, or brand ownership. Stick to visible facts. Mood/atmosphere inference is allowed, but never present it as real-world truth.
- Strict continuity across ALL 9 shots: same subjects, same wardrobe/appearance, same environment, same time-of-day and lighting style. Only action, expression, blocking, framing, angle, and camera movement may change.
- Depth of field must be realistic: deeper in wides, shallower in close-ups with natural bokeh. Keep ONE consistent cinematic colour grade across the entire sequence.
- Do NOT introduce new characters, objects, or elements not visible in the reference images. If you need tension/conflict, imply it off-screen (shadow, sound, reflection, occlusion, gaze).
- Format: assume 9:16 vertical unless another format has been explicitly requested.`;

const ANALYSIS_INSTRUCTION = `You are an award-winning trailer director + cinematographer + storyboard artist. You will receive three labeled groups of reference images. Analyse each group strictly as described below. Be truthful to what you see; do not invent or guess details.

${CONTINUITY_RULES}

The images are labeled in three groups:
- GROUP A – CHARACTER: photos of the person/subject
- GROUP B – CLOTHING: photos of the outfit/clothes
- GROUP C – BACKGROUND: photos of the scene/location

Produce a structured analysis with exactly these four sections:

**Subject & Character** (use GROUP A – CHARACTER images ONLY):
Describe physical appearance: age estimate, skin tone and texture, hair colour, texture, length and style, facial features, body type. Describe spatial relationships if multiple subjects. DO NOT describe clothing from these images — ignore what the character is wearing.

**Clothes/Outfits** (use GROUP B – CLOTHING images ONLY — ignore GROUP A and GROUP C):
Identify: garment category (e.g. dress, trousers, sweatshirt), subcategory (e.g. short/long sleeve, length: mini/midi/maxi), silhouette/style (e.g. A-line, fitted, oversized), exact colour including shade, likely material/fabric, all design features (pockets, buttons, zips, prints, embroidery, patterns), accessories visible.

**Scene & Background** (use GROUP C – BACKGROUND images ONLY):
Describe: location type, geographical setting if identifiable, environmental elements (trees, buildings, water, street furniture), time of day, weather, natural light quality, background clutter or depth.

**Technical & Aesthetic** (infer from all groups combined):
Lighting type (e.g. golden hour, overcast diffused, chiaroscuro), colour palette, film stock feel, cinematic artistic style.

**The Final Prompt:**
Combine all four sections into a single, cohesive, comma-separated prompt string optimised for high-fidelity image generation. The outfit must come from GROUP B only; the character appearance from GROUP A only; the scene from GROUP C only.

Reply with only the structured analysis and final combined prompt.`;

/** Detect the real image format from the first bytes of the base64 data.
 *  Overrides the declared MIME type so Claude never gets a mismatch error. */
function detectMimeFromBase64(base64) {
  try {
    const bytes = Buffer.from(base64.slice(0, 16), "base64");
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  } catch {
    // fall through to declared type
  }
  return null;
}

function parseDataUrl(url) {
  if (!url) return null;
  const m = String(url).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const declaredMime = m[1].toLowerCase();
  if (!/^image\/(jpeg|png|gif|webp)$/.test(declaredMime)) return null;
  const data = m[2];
  // Always detect real format from bytes – a file saved as .png may actually be JPEG
  const actualMime = detectMimeFromBase64(data) || declaredMime;
  if (actualMime !== declaredMime) {
    console.log(`[prompt_api] MIME mismatch corrected: declared=${declaredMime} actual=${actualMime}`);
  }
  return { mimeType: actualMime, data };
}

function isClaude(model) {
  return model && typeof model === "string" && /claude/i.test(model.trim());
}

function parsePromptResponse(raw) {
  const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
  const parsed = JSON.parse(jsonStr);
  const scene = typeof parsed.scene === "string" ? parsed.scene.trim() : "";
  const arr = Array.isArray(parsed.shots) ? parsed.shots : parsed.shot_prompts || [];
  let shots = arr.slice(0, 9).map((s) => String(s).trim()).filter(Boolean);
  while (shots.length < 9 && scene) shots.push(scene);
  return { scene, shots: shots.slice(0, 9) };
}

async function analyseClaude(apiKey, model, refImages) {
  const charImgs = (refImages.character  || []).filter(Boolean);
  const clothImgs = (refImages.clothing  || []).filter(Boolean);
  const bgImgs    = (refImages.background || []).filter(Boolean);
  if (charImgs.length + clothImgs.length + bgImgs.length === 0) return "";

  // Build content with clearly labeled image groups so the model never confuses them
  const content = [];

  const addGroup = (label, urls) => {
    if (urls.length === 0) return;
    content.push({ type: "text", text: `=== ${label} ===` });
    for (const url of urls) {
      const p = parseDataUrl(url);
      if (p) content.push({ type: "image", source: { type: "base64", media_type: p.mimeType, data: p.data } });
    }
  };

  addGroup("GROUP A – CHARACTER (use ONLY for Subject & Character section — ignore clothing)", charImgs);
  addGroup("GROUP B – CLOTHING (use ONLY for Clothes/Outfits section — ignore Groups A and C)", clothImgs);
  addGroup("GROUP C – BACKGROUND (use ONLY for Scene & Background section — ignore Groups A and B)", bgImgs);

  content.push({ type: "text", text: ANALYSIS_INSTRUCTION });

  const client = new Anthropic({ apiKey: apiKey.trim() });
  const models = model?.trim() ? [model.trim(), ...DEFAULT_CLAUDE] : DEFAULT_CLAUDE;
  let lastErr;
  for (const m of models) {
    try {
      const msg = await client.messages.create({ model: m, max_tokens: 4096, messages: [{ role: "user", content }] });
      const text = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      if (text) {
        console.log("[prompt_api] Claude analysis succeeded with model:", m);
        return text;
      }
    } catch (e) {
      console.error("[prompt_api] Claude analysis", m, e?.message);
      lastErr = e;
    }
  }
  throw new Error(
    `Image analysis failed – all Claude models returned errors. ` +
    `Last error: ${lastErr?.message || "unknown"}. ` +
    `Models tried: ${models.join(", ")}. ` +
    `Check your Anthropic API key and account tier at platform.claude.com.`
  );
}

async function analyseGemini(apiKey, model, refImages) {
  const charImgs  = (refImages.character  || []).filter(Boolean);
  const clothImgs = (refImages.clothing   || []).filter(Boolean);
  const bgImgs    = (refImages.background || []).filter(Boolean);
  if (charImgs.length + clothImgs.length + bgImgs.length === 0) return "";

  // Build parts with clearly labeled image groups so the model never confuses them
  const parts = [{ text: ANALYSIS_INSTRUCTION }];

  const addGroup = (label, urls) => {
    if (urls.length === 0) return;
    parts.push({ text: `=== ${label} ===` });
    for (const url of urls) {
      const p = parseDataUrl(url);
      if (p) parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
    }
  };

  addGroup("GROUP A – CHARACTER (use ONLY for Subject & Character section — ignore clothing)", charImgs);
  addGroup("GROUP B – CLOTHING (use ONLY for Clothes/Outfits section — ignore Groups A and C)", clothImgs);
  addGroup("GROUP C – BACKGROUND (use ONLY for Scene & Background section — ignore Groups A and B)", bgImgs);

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const models = model?.trim() ? [model.trim(), ...DEFAULT_GEMINI] : DEFAULT_GEMINI;
  let lastErr;
  for (const m of models) {
    try {
      const res = await ai.models.generateContent({ model: m, contents: [{ role: "user", parts }] });
      const text = res.text?.trim();
      if (text) return text;
    } catch (e) {
      console.error("[prompt_api] Gemini analysis", m, e?.message);
      lastErr = e;
    }
  }
  throw new Error(`Image analysis failed: ${lastErr?.message || "unknown"}`);
}

async function generatePromptsClaude(apiKey, model, structuredAnalysis, userNote) {
  const instruction = `You are an award-winning trailer director + cinematographer + storyboard artist. Your job: turn the structured image analysis below into a cohesive cinematic short sequence and output 9 AI-video-ready keyframe prompts as a 3×3 Cinematic Contact Sheet.

${CONTINUITY_RULES}

Step 1 – Synthesize a main scene description (1–3 sentences) that establishes the consistent world: subjects, wardrobe, location, lighting, colour grade, and time of day.

Step 2 – Generate exactly 9 shot-specific prompts following this structure:

${SHOT_SPECS}

Each shot prompt MUST be a FULLY SELF-CONTAINED image generation prompt using this exact labeled structure (the image model uses these labels to match visual reference images):

[Shot label] – Subject character: [exact physical description: age, skin tone, hair colour/length/style, facial features]. Outfit: [exact clothing: garment type, colour with shade, fabric, cut/silhouette, every design detail]. Environment: [exact scene: location, natural setting, time of day, lighting quality, weather, background elements — NO urban or invented elements]. Shot framing: [how the subject is framed for this shot type, depth of field, camera angle]. Style: photorealistic, cinematic, 9:16 vertical.

Rules:
- Use the EXACT labeled format above: "Subject character:", "Outfit:", "Environment:", "Shot framing:", "Style:"
- Environment must come STRICTLY from the Scene & Background analysis — if the background is a park, write park; never invent buildings or urban elements not in the references
- Only vary across shots: the framing, angle, camera position, action/expression/pose
- Never omit any labeled section from any shot

Output valid JSON only, no markdown fences:
{"scene":"...","shots":["shot1","shot2","shot3","shot4","shot5","shot6","shot7","shot8","shot9"]}

---
Structured image analysis:
${structuredAnalysis || "(no images provided – use user text only)"}

---
User text / additional guidance:
${userNote || "(none)"}`;

  const client = new Anthropic({ apiKey: apiKey.trim() });
  const models = model?.trim() ? [model.trim(), ...DEFAULT_CLAUDE] : DEFAULT_CLAUDE;
  let lastErr;
  for (const m of models) {
    try {
      const msg = await client.messages.create({ model: m, max_tokens: 4096, messages: [{ role: "user", content: instruction }] });
      const raw = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      if (!raw) continue;
      const { scene, shots } = parsePromptResponse(raw);
      if (scene && shots.length >= 1) {
        console.log("[prompt_api] Claude copy/generate succeeded with model:", m);
        return { scenePrompt: scene, shotPrompts: shots };
      }
    } catch (e) {
      console.error("[prompt_api] Claude generate", m, e?.message);
      lastErr = e;
    }
  }
  throw new Error(
    `Prompt generation failed – all Claude models returned errors. ` +
    `Last error: ${lastErr?.message || "unknown"}. ` +
    `Models tried: ${models.join(", ")}. ` +
    `Check your Anthropic API key and account tier at platform.claude.com.`
  );
}

async function generatePromptsGemini(apiKey, model, structuredAnalysis, userNote) {
  const instruction = `You are an award-winning trailer director + cinematographer + storyboard artist. Your job: turn the structured image analysis below into a cohesive cinematic short sequence and output 9 AI-video-ready keyframe prompts as a 3×3 Cinematic Contact Sheet.

${CONTINUITY_RULES}

Step 1 – Synthesize a main scene description (1–3 sentences) that establishes the consistent world: subjects, wardrobe, location, lighting, colour grade, and time of day.

Step 2 – Generate exactly 9 shot-specific prompts following this structure:

${SHOT_SPECS}

Each shot prompt MUST be a FULLY SELF-CONTAINED image generation prompt using this exact labeled structure (the image model uses these labels to match visual reference images):

[Shot label] – Subject character: [exact physical description: age, skin tone, hair colour/length/style, facial features]. Outfit: [exact clothing: garment type, colour with shade, fabric, cut/silhouette, every design detail]. Environment: [exact scene: location, natural setting, time of day, lighting quality, weather, background elements — NO urban or invented elements]. Shot framing: [how the subject is framed for this shot type, depth of field, camera angle]. Style: photorealistic, cinematic, 9:16 vertical.

Rules:
- Use the EXACT labeled format above: "Subject character:", "Outfit:", "Environment:", "Shot framing:", "Style:"
- Environment must come STRICTLY from the Scene & Background analysis — if the background is a park, write park; never invent buildings or urban elements not in the references
- Only vary across shots: the framing, angle, camera position, action/expression/pose
- Never omit any labeled section from any shot

Output valid JSON only, no markdown fences:
{"scene":"...","shots":["shot1","shot2","shot3","shot4","shot5","shot6","shot7","shot8","shot9"]}

---
Structured image analysis:
${structuredAnalysis || "(no images provided – use user text only)"}

---
User text / additional guidance:
${userNote || "(none)"}`;

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const models = model?.trim() ? [model.trim(), ...DEFAULT_GEMINI] : DEFAULT_GEMINI;
  let lastErr;
  for (const m of models) {
    try {
      const res = await ai.models.generateContent({ model: m, contents: [{ role: "user", parts: [{ text: instruction }] }] });
      const raw = res.text?.trim();
      if (!raw) continue;
      const { scene, shots } = parsePromptResponse(raw);
      if (scene && shots.length >= 1) return { scenePrompt: scene, shotPrompts: shots };
    } catch (e) {
      console.error("[prompt_api] Gemini generate", m, e?.message);
      lastErr = e;
    }
  }
  throw new Error(`Prompt generation failed: ${lastErr?.message || "unknown"}`);
}

/**
 * Run the full two-step prompt flow server-side.
 * @param {Object} body
 * @param {string} body.apiKey - API key (Anthropic or Google)
 * @param {string|null} body.analysisModel
 * @param {string|null} body.copyModel
 * @param {Object} body.refImages - { character: string[], clothing: string[], background: string[] }
 * @param {string} body.userNote - User's prompt/guidance
 * @returns {Promise<{scenePrompt: string, shotPrompts: string[]}>}
 */
export async function runAutoGeneratePrompts(body) {
  const { apiKey, analysisModel, copyModel, refImages = {}, userNote = "" } = body;
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("Missing API key. Save one via Analysis or Copy modal.");
  }

  const useClaude = isClaude(copyModel) || (copyModel == null && isClaude(analysisModel));

  // Flatten ref images, filtering out null/empty slots
  const charImgs   = (refImages.character  || []).filter(Boolean);
  const clothImgs  = (refImages.clothing   || []).filter(Boolean);
  const bgImgs     = (refImages.background || []).filter(Boolean);
  const hasRefImages = charImgs.length + clothImgs.length + bgImgs.length > 0;

  // Log what we received so it shows in the backend terminal
  console.log(`[prompt_api] Received images – character:${charImgs.length} clothing:${clothImgs.length} background:${bgImgs.length}`);
  console.log(`[prompt_api] analysisModel="${analysisModel}" copyModel="${copyModel}" useClaude=${useClaude}`);

  // Confirm parseDataUrl can parse each image and log sizes
  const parseOk = [...charImgs, ...clothImgs, ...bgImgs].every((url, i) => {
    const p = parseDataUrl(url);
    if (!p) {
      console.warn(`[prompt_api] Image slot ${i} failed parseDataUrl – bad format or unsupported mime type`);
      return false;
    }
    console.log(`[prompt_api] Image slot ${i}: mime=${p.mimeType} base64-length=${p.data.length}`);
    return true;
  });
  if (hasRefImages && !parseOk) {
    console.warn("[prompt_api] Some images could not be parsed – they will be skipped by the model.");
  }

  // When user chose Claude for copy, use Claude for image analysis too (same model sees the images)
  const claudeModelForAnalysis = (analysisModel && isClaude(analysisModel) ? analysisModel : null) || copyModel || analysisModel;

  let structuredAnalysis = "";
  if (hasRefImages) {
    // HARD FAIL if Step 1 errors – do NOT silently continue with no image context
    if (useClaude) {
      const analysisModelUsed = claudeModelForAnalysis || copyModel || analysisModel;
      console.log("[prompt_api] Step 1 (Analysis) – calling Claude:", analysisModelUsed || "(default list)");
      structuredAnalysis = await analyseClaude(apiKey, analysisModelUsed, refImages);
      console.log("[prompt_api] Step 1 complete – analysis length:", structuredAnalysis.length, "chars");
      console.log("[prompt_api] Step 1 preview:", structuredAnalysis.slice(0, 300));
    } else {
      console.log("[prompt_api] Step 1 (Analysis) – calling Gemini:", analysisModel || "(default)");
      structuredAnalysis = await analyseGemini(apiKey, analysisModel, refImages);
      console.log("[prompt_api] Step 1 complete – analysis length:", structuredAnalysis.length, "chars");
      console.log("[prompt_api] Step 1 preview:", structuredAnalysis.slice(0, 300));
    }
  } else {
    console.log("[prompt_api] No ref images provided – skipping Step 1, using user note only.");
  }

  if (useClaude) {
    const copyModelUsed = copyModel || analysisModel;
    console.log("[prompt_api] Step 2 (Copy) – calling Claude:", copyModelUsed || "(default list)");
    return generatePromptsClaude(apiKey, copyModelUsed, structuredAnalysis, userNote);
  }
  console.log("[prompt_api] Step 2 (Copy) – calling Gemini:", copyModel || "(default)");
  return generatePromptsGemini(apiKey, copyModel, structuredAnalysis, userNote);
}
