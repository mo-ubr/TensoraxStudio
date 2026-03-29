/**
 * Media Analysis Pipeline
 *
 * Video: Downloads from Google Drive → uploads to Gemini File API → waits for processing →
 *        sends to gemini-3.1-pro-preview for native video analysis (no FFmpeg needed).
 * Images: Downloads from Drive → sends inline to Gemini for analysis.
 *
 * Output: structured cinematography breakdown + optimised generative prompt.
 */

import { Router } from "express";
import { resolve, join } from "path";
import { mkdir, writeFile, readFile, readdir, unlink, rmdir } from "fs/promises";
import { existsSync } from "fs";
import { listFiles, downloadFile } from "./driveService.js";

const router = Router();

const TEMP_DIR = resolve(process.cwd(), "assets", ".tmp-video");
const SCREENPLAYS_DIR = resolve(process.cwd(), "assets", "2. Screenplays");

function extractFolderId(url) {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractFileId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function cleanTemp(dir) {
  if (!existsSync(dir)) return;
  try {
    const files = await readdir(dir);
    for (const f of files) await unlink(join(dir, f));
    await rmdir(dir);
  } catch { /* ignore */ }
}

function isImageMime(mime) { return /^image\/(jpeg|jpg|png|gif|webp|bmp|tiff)$/i.test(mime); }
function isVideoMime(mime) { return /^video\//i.test(mime); }
function isImageFile(name) { return /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(name); }
function isVideoFile(name) { return /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(name); }

function getMimeForVideo(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = { mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", webm: "video/webm", mkv: "video/x-matroska", m4v: "video/mp4" };
  return map[ext] || "video/mp4";
}

const VIDEO_PROMPT = `You are an expert cinematographer and AI prompt engineer. Your task is to analyze the provided video and extract a highly detailed, structured breakdown of its visual elements to recreate its exact vibe.

Please analyze the video and provide the following:

1. **Core Subject & Action:** A concise 2-3 sentence summary of the main subjects and the primary action taking place.
2. **Visual Style & Medium:** Define the specific aesthetic (e.g., photorealistic, 3D animation, cinematic, 8-bit, retro VHS) and the dominant color grading or palette.
3. **Cinematography & Lighting:** Describe the camera work (e.g., fast panning, static close-up, sweeping drone shot) and the lighting setup (e.g., harsh shadows, neon rim lighting, soft golden hour).
4. **Subject & Characters:** Describe every person/object in extreme detail — age, ethnicity, build, clothing (fabric, cut, colour), hair, expression, pose, spatial relationships between subjects.
5. **Colour & Grade:** Exact colour palette (hex-like descriptions), colour grading approach (LUT feel), contrast curve, saturation level, white balance, split toning (highlights/shadows).
6. **Setting & Environment:** Location type, props, set dressing, background elements, time of day, weather/atmosphere.
7. **Typography & Graphics:** Any text overlays, titles, lower thirds, branding elements — describe fonts, sizes, placement, animation style.
8. **Chronological Breakdown:** A concise, timestamped list of major visual transitions, cuts, or key actions.
9. **Overall Vibe:** The emotional and aesthetic feel in one paragraph.
10. **Optimized Generative Prompt:** Synthesize your analysis into a highly descriptive, comma-separated text prompt. This prompt should be optimized for a state-of-the-art AI image or video generator to perfectly recreate the essence of this video's opening scene. Focus heavily on visual keywords, medium, and lighting. Label it **MASTER PROMPT:**.

Ensure your output is strictly formatted using these exact headings. Be highly descriptive and prioritize specific, technical visual keywords over generic descriptions.`;

const IMAGE_PROMPT_FN = (count) => `Analyze these ${count} reference images in extreme detail, focusing on subject, lighting, medium, and style.

For each aspect below, be as specific and precise as possible:

1. **Subject & Content**: What appears — people (age, ethnicity, build, clothing detail), objects, text, layout
2. **Lighting**: Type, direction, quality, colour temperature, shadow characteristics
3. **Medium & Technical**: Lens feel, depth of field, grain/noise, resolution quality, print vs digital
4. **Colour & Grade**: Exact palette, contrast, saturation, white balance, toning
5. **Composition**: Framing, visual hierarchy, use of space, alignment
6. **Typography & Branding**: Fonts, logos, text treatments, brand elements
7. **Setting & Environment**: Backgrounds, context, props, atmosphere
8. **Overall Vibe**: The emotional and aesthetic feel in one paragraph

Then, output a highly optimized, comma-separated text prompt designed for a state-of-the-art image generator to recreate this exact vibe. Label it **MASTER PROMPT:**.`;

// ─── Native video analysis via Gemini File API ──────────────────────────────

/** Video/image analysis models — best-of-breed, best first */
const ANALYSIS_MODELS = [
  "gemini-3.1-pro-preview",        // Best: native video understanding, longest context
  "gemini-3-pro-preview",          // Strong multimodal reasoning
  "gemini-2.5-pro",                // Reliable pro-tier fallback
  "gemini-2.5-flash",              // Fast, good quality fallback
  "gemini-2.0-flash",              // Lightweight last-resort
];

async function analyseVideoNative(videoPath, videoName, apiKey, model, customPrompt) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = model ? [model, ...ANALYSIS_MODELS] : ANALYSIS_MODELS;

  console.log(`[Analysis] Uploading video to Gemini File API...`);
  let videoFile = await ai.files.upload({
    file: videoPath,
    config: { mimeType: getMimeForVideo(videoName) },
  });
  console.log(`[Analysis] Uploaded as: ${videoFile.name}, waiting for processing...`);

  const maxWaitMs = 300000;
  const start = Date.now();
  while (videoFile.state === "PROCESSING") {
    if (Date.now() - start > maxWaitMs) throw new Error("Video processing timed out after 5 minutes");
    await new Promise(r => setTimeout(r, 3000));
    videoFile = await ai.files.get({ name: videoFile.name });
    process.stdout.write(".");
  }
  console.log("");

  if (videoFile.state === "FAILED") throw new Error("Video processing failed on Google's servers");

  const filePart = { fileData: { fileUri: videoFile.uri, mimeType: videoFile.mimeType } };
  let lastError;
  for (const m of modelsToTry) {
    try {
      console.log(`[Analysis] Trying model ${m}...`);
      const response = await ai.models.generateContent({
        model: m,
        contents: [{ role: "user", parts: [filePart, { text: customPrompt || VIDEO_PROMPT }] }],
      });
      const text = typeof response.text === "string" ? response.text : "";
      if (text.trim()) {
        try { await ai.files.delete({ name: videoFile.name }); } catch { /* ignore */ }
        return text;
      }
    } catch (err) {
      console.warn(`[Analysis] Model ${m} failed: ${err.message}`);
      lastError = err;
    }
  }

  try { await ai.files.delete({ name: videoFile.name }); } catch { /* ignore */ }
  throw lastError || new Error("All analysis models failed");
}

// ─── Image analysis (inline, no File API needed) ────────────────────────────

async function analyseImages(imagePaths, apiKey, model) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = model ? [model, ...ANALYSIS_MODELS] : ANALYSIS_MODELS;

  const imageParts = [];
  for (const fp of imagePaths) {
    const data = await readFile(fp);
    const ext = fp.split(".").pop().toLowerCase();
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };
    imageParts.push({ inlineData: { mimeType: mimeMap[ext] || "image/jpeg", data: data.toString("base64") } });
  }

  let lastError;
  for (const m of modelsToTry) {
    try {
      console.log(`[Analysis] Analysing ${imagePaths.length} images with ${m}...`);
      const response = await ai.models.generateContent({
        model: m,
        contents: [{ role: "user", parts: [{ text: IMAGE_PROMPT_FN(imagePaths.length) }, ...imageParts] }],
      });
      const text = typeof response.text === "string" ? response.text : "";
      if (text.trim()) return text;
    } catch (err) {
      console.warn(`[Analysis] Model ${m} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All image analysis models failed");
}

// ─── Save analysis to Word doc ──────────────────────────────────────────────

const ANALYSES_JSON = join(SCREENPLAYS_DIR, "style_references.json");
const ANALYSES_DOCX = join(SCREENPLAYS_DIR, "Style_References_Analysis.docx");

function markdownToParagraphs(text) {
  const { Paragraph, TextRun, HeadingLevel } = require("docx");
  return text.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed) return new Paragraph({ text: "" });
    if (trimmed.startsWith("# ")) return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: trimmed.replace(/^#+\s*/, ""), bold: true })] });
    if (trimmed.startsWith("## ")) return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: trimmed.replace(/^#+\s*/, ""), bold: true })] });
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) return new Paragraph({ children: [new TextRun({ text: trimmed.replace(/\*\*/g, ""), bold: true, size: 22 })] });
    const numbered = trimmed.match(/^(\d+\.\s+)\*\*([^*]+)\*\*:?\s*(.*)/);
    if (numbered) return new Paragraph({ children: [new TextRun({ text: numbered[1], size: 22 }), new TextRun({ text: numbered[2], bold: true, size: 22 }), new TextRun({ text: numbered[3] ? ": " + numbered[3] : "", size: 22 })] });
    return new Paragraph({ children: [new TextRun({ text: trimmed, size: 22 })] });
  });
}

async function saveAnalysisAsDocx(analysis, mediaName, mediaType) {
  await mkdir(SCREENPLAYS_DIR, { recursive: true });

  let allAnalyses = [];
  try {
    const raw = await readFile(ANALYSES_JSON, "utf-8");
    allAnalyses = JSON.parse(raw);
  } catch { /* first time */ }

  allAnalyses.push({ mediaName, mediaType, date: new Date().toISOString(), analysis });
  await writeFile(ANALYSES_JSON, JSON.stringify(allAnalyses, null, 2), "utf-8");

  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const sections = allAnalyses.map((a, i) => ({
    children: [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [
        new TextRun({ text: `Reference ${i + 1}: ${a.mediaType === "video" ? "Video" : "Image"} Analysis`, bold: true }),
      ]}),
      new Paragraph({ children: [new TextRun({ text: `Source: ${a.mediaName}`, italics: true, color: "888888", size: 18 })] }),
      new Paragraph({ children: [new TextRun({ text: `Analysed: ${new Date(a.date).toLocaleDateString()} by TensorAx Studio`, italics: true, color: "888888", size: 18 })] }),
      new Paragraph({ text: "" }),
      ...markdownToParagraphs(a.analysis),
    ],
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Style References Analysis", bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `${allAnalyses.length} reference${allAnalyses.length !== 1 ? "s" : ""} analysed`, italics: true, color: "888888", size: 20 })] }),
        new Paragraph({ text: "" }),
      ],
    }, ...sections],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(ANALYSES_DOCX, buffer);
  console.log(`[Analysis] Updated Word doc: ${ANALYSES_DOCX} (${allAnalyses.length} references)`);
  return ANALYSES_DOCX;
}

// ─── API endpoint ────────────────────────────────────────────────────────────

router.post("/analyse-video", async (req, res) => {
  const { url, apiKey, model, prompt: customPrompt } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!apiKey) return res.status(400).json({ error: "Missing API key for Gemini Vision" });

  const sessionDir = join(TEMP_DIR, `session-${Date.now()}`);

  try {
    await mkdir(sessionDir, { recursive: true });

    const folderId = extractFolderId(url);
    const fileId = extractFileId(url);
    let mediaType = "video";
    let mediaName = "media";
    let analysis = "";

    if (folderId) {
      console.log(`[Analysis] Listing files in Drive folder: ${folderId}`);
      const files = await listFiles(folderId);
      const videoFile = files.find(f => isVideoMime(f.mimeType) || isVideoFile(f.name));
      const imageFiles = files.filter(f => isImageMime(f.mimeType) || isImageFile(f.name));

      if (videoFile) {
        mediaType = "video";
        mediaName = videoFile.name;
        console.log(`[Analysis] Downloading video: ${videoFile.name}`);
        const buffer = await downloadFile(videoFile.id);
        const videoPath = join(sessionDir, videoFile.name);
        await writeFile(videoPath, buffer);
        console.log(`[Analysis] Video saved (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
        analysis = await analyseVideoNative(videoPath, videoFile.name, apiKey, model, customPrompt);
      } else if (imageFiles.length > 0) {
        mediaType = "images";
        mediaName = `${imageFiles.length}_images_from_folder`;
        console.log(`[Analysis] Found ${imageFiles.length} images, downloading...`);
        const imgDir = join(sessionDir, "images");
        await mkdir(imgDir, { recursive: true });
        const paths = [];
        for (const img of imageFiles.slice(0, 20)) {
          const buf = await downloadFile(img.id);
          const imgPath = join(imgDir, img.name);
          await writeFile(imgPath, buf);
          paths.push(imgPath);
        }
        analysis = await analyseImages(paths, apiKey, model);
      } else {
        return res.status(404).json({ error: "No video or image files found in the Drive folder" });
      }
    } else if (fileId) {
      console.log(`[Analysis] Downloading file: ${fileId}`);
      const buffer = await downloadFile(fileId);
      const { getFileMetadata } = await import("./driveService.js");
      const meta = await getFileMetadata(fileId);
      mediaName = meta.name || "file";

      if (isVideoMime(meta.mimeType) || isVideoFile(meta.name)) {
        mediaType = "video";
        const videoPath = join(sessionDir, mediaName);
        await writeFile(videoPath, buffer);
        analysis = await analyseVideoNative(videoPath, mediaName, apiKey, model, customPrompt);
      } else if (isImageMime(meta.mimeType) || isImageFile(meta.name)) {
        mediaType = "images";
        const imgPath = join(sessionDir, mediaName);
        await writeFile(imgPath, buffer);
        analysis = await analyseImages([imgPath], apiKey, model);
      } else {
        return res.status(400).json({ error: `Unsupported file type: ${meta.mimeType}` });
      }
    } else {
      return res.status(400).json({ error: "Could not parse Drive folder or file ID from URL" });
    }

    console.log(`[Analysis] Complete (${analysis.length} chars)`);
    if (customPrompt) {
      res.json({ mediaName, mediaType, analysis });
    } else {
      const docPath = await saveAnalysisAsDocx(analysis, mediaName, mediaType);
      res.json({ mediaName, mediaType, analysis, savedTo: docPath });
    }
  } catch (err) {
    console.error("[Analysis] Error:", err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  } finally {
    cleanTemp(sessionDir).catch(() => {});
  }
});

// ─── Analyse uploaded video (data-URI or raw file) ──────────────────────────

const TRANSFORMATION_ANALYSIS_PROMPT = `You are an expert motion designer and cinematographer. Analyse this reference video to extract a precise description of its transformation/motion pattern for recreating it on a different subject.

Focus on:
1. **Transformation Stages**: Describe each distinct stage of change (e.g., "stage 1: surface cleanup, stage 2: structural renovation, stage 3: landscaping added"). Be very specific about what changes at each stage.
2. **Motion & Pacing**: How does the transformation progress? (gradual reveal, left-to-right sweep, dissolve, morphing, jump cuts?) What is the timing/rhythm?
3. **Camera Work**: Is the camera static, panning, zooming? Describe any camera movement.
4. **Visual Effects**: Any specific effects (glow, particle effects, cross-dissolve, colour shift)?
5. **Duration & Rhythm**: Total length, pace of each stage, any pauses or acceleration.

Then synthesize everything into a single **MOTION PROMPT** (a concise paragraph suitable as a video generation prompt that captures the exact motion pattern, transformation style, and pacing). This prompt should be written so that an AI video generator can apply the same transformation pattern to any starting image.

Format your response as:
**ANALYSIS:**
[your detailed analysis]

**MOTION PROMPT:**
[the synthesized prompt]`;

router.post("/analyse-uploaded-video", async (req, res) => {
  const { videoData, fileName, apiKey, model } = req.body;
  if (!videoData) return res.status(400).json({ error: "Missing video data" });
  if (!apiKey) return res.status(400).json({ error: "Missing Gemini API key" });

  const sessionDir = join(TEMP_DIR, `upload-${Date.now()}`);

  try {
    await mkdir(sessionDir, { recursive: true });

    // Convert data-URI to buffer
    let buffer;
    const name = fileName || "reference.mp4";
    if (videoData.startsWith("data:")) {
      const match = videoData.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) throw new Error("Invalid data-URI format");
      buffer = Buffer.from(match[1], "base64");
    } else {
      // Assume raw base64
      buffer = Buffer.from(videoData, "base64");
    }

    const videoPath = join(sessionDir, name);
    await writeFile(videoPath, buffer);
    console.log(`[TemplateAnalysis] Video saved (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);

    const analysis = await analyseVideoNative(videoPath, name, apiKey, model, TRANSFORMATION_ANALYSIS_PROMPT);
    console.log(`[TemplateAnalysis] Complete (${analysis.length} chars)`);

    // Extract the MOTION PROMPT section
    const motionPromptMatch = analysis.match(/\*\*MOTION PROMPT:\*\*\s*([\s\S]*?)$/i);
    const motionPrompt = motionPromptMatch ? motionPromptMatch[1].trim() : '';

    res.json({ analysis, motionPrompt });
  } catch (err) {
    console.error("[TemplateAnalysis] Error:", err);
    res.status(500).json({ error: err.message || "Video analysis failed" });
  } finally {
    cleanTemp(sessionDir).catch(() => {});
  }
});

// ─── Review generated video via URL ─────────────────────────────────────────

const REVIEW_PROMPT = `You are a senior creative director reviewing an AI-generated video clip. Watch the video carefully and provide a concise, actionable review covering:

1. **Overall Impression** (2 sentences): First reaction — does it feel polished and professional?
2. **Motion & Pacing**: Is the movement natural? Any jitter, warping, or unnatural morphing?
3. **Visual Quality**: Sharpness, colour consistency, lighting coherence, any artefacts or glitches?
4. **Subject Consistency**: Do characters/objects maintain their appearance throughout? Any deformations?
5. **Composition**: Framing, camera movement — does it feel intentional and cinematic?
6. **Brand Alignment**: Does the tone/style fit a premium retail brand (NEXT)?
7. **Score**: Rate 1–10 with one-line justification.
8. **Top 3 Improvements**: Specific, actionable suggestions to fix in the next generation.

Be direct and specific. Reference exact moments (e.g., "at ~2s the hand warps"). Keep the total review under 400 words.`;

router.post("/review-generated-video", async (req, res) => {
  const { videoUrl, apiKey, model, prompt } = req.body;
  if (!videoUrl) return res.status(400).json({ error: "Missing video URL" });
  if (!apiKey) return res.status(400).json({ error: "Missing Gemini API key" });

  const sessionDir = join(TEMP_DIR, `review-${Date.now()}`);

  try {
    await mkdir(sessionDir, { recursive: true });

    console.log(`[Review] Downloading generated video from: ${videoUrl.substring(0, 80)}...`);
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download video: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const ext = videoUrl.match(/\.(mp4|webm|mov)/i)?.[1] || "mp4";
    const fileName = `generated-clip.${ext}`;
    const videoPath = join(sessionDir, fileName);
    await writeFile(videoPath, buffer);
    console.log(`[Review] Video saved (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);

    const reviewPrompt = prompt || REVIEW_PROMPT;
    const analysis = await analyseVideoNative(videoPath, fileName, apiKey, model, reviewPrompt);

    console.log(`[Review] Complete (${analysis.length} chars)`);
    res.json({ analysis });
  } catch (err) {
    console.error("[Review] Error:", err);
    res.status(500).json({ error: err.message || "Video review failed" });
  } finally {
    cleanTemp(sessionDir).catch(() => {});
  }
});

export default router;
