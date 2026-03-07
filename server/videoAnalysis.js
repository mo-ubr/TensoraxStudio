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

async function analyseVideoNative(videoPath, videoName, apiKey, model) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const useModel = model || "gemini-3.1-pro-preview";

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
  console.log(`[Analysis] Video processed, analysing with ${useModel}...`);

  const response = await ai.models.generateContent({
    model: useModel,
    contents: [videoFile, VIDEO_PROMPT],
  });

  // Clean up uploaded file
  try { await ai.files.delete({ name: videoFile.name }); } catch { /* ignore */ }

  return typeof response.text === "string" ? response.text : "";
}

// ─── Image analysis (inline, no File API needed) ────────────────────────────

async function analyseImages(imagePaths, apiKey, model) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const useModel = model || "gemini-3.1-pro-preview";

  const imageParts = [];
  for (const fp of imagePaths) {
    const data = await readFile(fp);
    const ext = fp.split(".").pop().toLowerCase();
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };
    imageParts.push({ inlineData: { mimeType: mimeMap[ext] || "image/jpeg", data: data.toString("base64") } });
  }

  console.log(`[Analysis] Analysing ${imagePaths.length} images with ${useModel}...`);
  const response = await ai.models.generateContent({
    model: useModel,
    contents: [{ role: "user", parts: [{ text: IMAGE_PROMPT_FN(imagePaths.length) }, ...imageParts] }],
  });

  return typeof response.text === "string" ? response.text : "";
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
  const { url, apiKey, model } = req.body;
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
        analysis = await analyseVideoNative(videoPath, videoFile.name, apiKey, model);
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
        analysis = await analyseVideoNative(videoPath, mediaName, apiKey, model);
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
    const docPath = await saveAnalysisAsDocx(analysis, mediaName, mediaType);

    res.json({ mediaName, mediaType, analysis, savedTo: docPath });
  } catch (err) {
    console.error("[Analysis] Error:", err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  } finally {
    cleanTemp(sessionDir).catch(() => {});
  }
});

export default router;
