/**
 * Media Analysis Pipeline
 *
 * Downloads video/images from Google Drive → extracts keyframes (video) or uses images directly →
 * sends to Gemini Vision for analysis → saves Word doc → returns structured description.
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

function isImageMime(mime) {
  return /^image\/(jpeg|jpg|png|gif|webp|bmp|tiff)$/i.test(mime);
}

function isVideoMime(mime) {
  return /^video\//i.test(mime);
}

function isImageFile(name) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(name);
}

function isVideoFile(name) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(name);
}

async function extractFrames(videoPath, outputDir, interval = 3) {
  const ffmpegPath = (await import("ffmpeg-static")).default;
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  await mkdir(outputDir, { recursive: true });

  await execFileAsync(ffmpegPath, [
    "-i", videoPath,
    "-vf", `fps=1/${interval},scale=720:-1`,
    "-q:v", "3",
    "-frames:v", "20",
    join(outputDir, "frame_%03d.jpg"),
  ], { timeout: 120000 });

  const files = (await readdir(outputDir)).filter(f => f.startsWith("frame_") && f.endsWith(".jpg")).sort();
  return files.map(f => join(outputDir, f));
}

async function analyseWithGemini(imagePaths, apiKey, mediaType) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const imageParts = [];
  for (const fp of imagePaths) {
    const data = await readFile(fp);
    const ext = fp.split(".").pop().toLowerCase();
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };
    imageParts.push({
      inlineData: {
        mimeType: mimeMap[ext] || "image/jpeg",
        data: data.toString("base64"),
      },
    });
  }

  const isVideo = mediaType === "video";
  const prompt = isVideo
    ? `You are a video production analyst. These are ${imagePaths.length} keyframes extracted from a reference video at regular intervals.

Analyse these frames and provide a detailed breakdown:

1. **Visual Style**: Colour grading, lighting approach, contrast, saturation, overall mood
2. **Camera Work**: Shot types used (wide, medium, close-up, etc.), camera movement patterns, angles
3. **Composition**: Framing techniques, rule of thirds, symmetry, depth of field
4. **Subjects & Characters**: Who/what appears, their appearance, clothing, expressions
5. **Setting & Environment**: Locations, backgrounds, props, set design
6. **Pacing & Editing**: How the visual rhythm flows across these frames, transitions implied
7. **Typography & Graphics**: Any text overlays, titles, branding elements
8. **Overall Tone & Mood**: The emotional feel the video conveys

Be specific and detailed — this analysis will be used to create a new video in the same style.`
    : `You are a visual design analyst. These are ${imagePaths.length} reference images.

Analyse these images and provide a detailed breakdown:

1. **Visual Style**: Colour palette, lighting, contrast, saturation, overall aesthetic
2. **Composition**: Framing, layout, use of space, visual hierarchy
3. **Subjects & Content**: What appears in the images, people, objects, text
4. **Typography & Branding**: Fonts, logos, text treatments, brand elements
5. **Setting & Environment**: Backgrounds, context, props
6. **Mood & Tone**: The emotional feel and message conveyed
7. **Technical Details**: Resolution quality, format cues, print vs digital indicators

Be specific and detailed — this analysis will be used as creative reference for a new project.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: prompt }, ...imageParts] },
    ],
  });

  return typeof response.text === "string" ? response.text : "";
}

async function saveAnalysisAsDocx(analysis, mediaName, mediaType) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const paragraphs = analysis.split("\n").map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: trimmed.replace(/^#+\s*/, ""), bold: true })] });
    }
    if (trimmed.startsWith("## ")) {
      return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: trimmed.replace(/^#+\s*/, ""), bold: true })] });
    }
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      return new Paragraph({ children: [new TextRun({ text: trimmed.replace(/\*\*/g, ""), bold: true, size: 22 })] });
    }
    if (trimmed.match(/^\d+\.\s+\*\*/)) {
      const parts = trimmed.match(/^(\d+\.\s+)\*\*([^*]+)\*\*:?\s*(.*)/);
      if (parts) {
        return new Paragraph({ children: [
          new TextRun({ text: parts[1], size: 22 }),
          new TextRun({ text: parts[2], bold: true, size: 22 }),
          new TextRun({ text: parts[3] ? ": " + parts[3] : "", size: 22 }),
        ]});
      }
    }
    return new Paragraph({ children: [new TextRun({ text: trimmed, size: 22 })] });
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `${mediaType === "video" ? "Video" : "Image"} Style Analysis`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `Source: ${mediaName}`, italics: true, color: "888888", size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: `Analysed: ${new Date().toLocaleDateString()} by TensorAx Studio`, italics: true, color: "888888", size: 18 })] }),
        new Paragraph({ text: "" }),
        ...paragraphs,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await mkdir(SCREENPLAYS_DIR, { recursive: true });
  const filename = `${mediaName.replace(/\.[^.]+$/, "").replace(/\s+/g, "_")}_Analysis.docx`;
  const filepath = join(SCREENPLAYS_DIR, filename);
  await writeFile(filepath, buffer);
  console.log(`[Analysis] Saved Word doc: ${filepath}`);
  return filepath;
}

// ─── API endpoint ────────────────────────────────────────────────────────────

router.post("/analyse-video", async (req, res) => {
  const { url, apiKey } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });
  if (!apiKey) return res.status(400).json({ error: "Missing API key for Gemini Vision" });

  const sessionDir = join(TEMP_DIR, `session-${Date.now()}`);

  try {
    await mkdir(sessionDir, { recursive: true });

    const folderId = extractFolderId(url);
    const fileId = extractFileId(url);
    let mediaType = "video";
    let mediaName = "media";
    let framePaths = [];

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
        console.log(`[Analysis] Video saved (${(buffer.length / 1024 / 1024).toFixed(1)}MB), extracting frames...`);
        const framesDir = join(sessionDir, "frames");
        framePaths = await extractFrames(videoPath, framesDir, 3);
      } else if (imageFiles.length > 0) {
        mediaType = "images";
        mediaName = `${imageFiles.length}_images_from_folder`;
        console.log(`[Analysis] Found ${imageFiles.length} images, downloading...`);
        const imgDir = join(sessionDir, "images");
        await mkdir(imgDir, { recursive: true });
        for (const img of imageFiles.slice(0, 20)) {
          const buf = await downloadFile(img.id);
          const imgPath = join(imgDir, img.name);
          await writeFile(imgPath, buf);
          framePaths.push(imgPath);
        }
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
        const framesDir = join(sessionDir, "frames");
        framePaths = await extractFrames(videoPath, framesDir, 3);
      } else if (isImageMime(meta.mimeType) || isImageFile(meta.name)) {
        mediaType = "images";
        const imgPath = join(sessionDir, mediaName);
        await writeFile(imgPath, buffer);
        framePaths = [imgPath];
      } else {
        return res.status(400).json({ error: `Unsupported file type: ${meta.mimeType}` });
      }
    } else {
      return res.status(400).json({ error: "Could not parse Drive folder or file ID from URL" });
    }

    console.log(`[Analysis] ${framePaths.length} frames/images ready, sending to Gemini Vision...`);
    if (framePaths.length === 0) {
      return res.status(500).json({ error: "No frames or images extracted" });
    }

    const analysis = await analyseWithGemini(framePaths, apiKey, mediaType);
    console.log(`[Analysis] Complete (${analysis.length} chars)`);

    const docPath = await saveAnalysisAsDocx(analysis, mediaName, mediaType);

    res.json({
      mediaName,
      mediaType,
      framesAnalysed: framePaths.length,
      analysis,
      savedTo: docPath,
    });
  } catch (err) {
    console.error("[Analysis] Error:", err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  } finally {
    cleanTemp(sessionDir).catch(() => {});
  }
});

export default router;
