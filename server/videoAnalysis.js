/**
 * Video Analysis Pipeline
 *
 * Downloads video from Google Drive → extracts keyframes with FFmpeg →
 * sends frames to Gemini Vision for analysis → returns structured description.
 */

import { Router } from "express";
import { resolve, join } from "path";
import { mkdir, writeFile, readFile, readdir, unlink, rmdir } from "fs/promises";
import { existsSync } from "fs";
import { listFiles, downloadFile } from "./driveService.js";

const router = Router();

const TEMP_DIR = resolve(process.cwd(), "assets", ".tmp-video");

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

async function extractFrames(videoPath, outputDir, interval = 3) {
  const ffmpegPath = (await import("ffmpeg-static")).default;
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  await mkdir(outputDir, { recursive: true });

  // Extract 1 frame every N seconds, output as JPEG, max 720p width for efficiency
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

async function analyseFramesWithGemini(framePaths, apiKey) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const imageParts = [];
  for (const fp of framePaths) {
    const data = await readFile(fp);
    imageParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: data.toString("base64"),
      },
    });
  }

  const prompt = `You are a video production analyst. These are ${framePaths.length} keyframes extracted from a reference video at regular intervals.

Analyse these frames and provide a detailed breakdown:

1. **Visual Style**: Colour grading, lighting approach, contrast, saturation, overall mood
2. **Camera Work**: Shot types used (wide, medium, close-up, etc.), camera movement patterns, angles
3. **Composition**: Framing techniques, rule of thirds, symmetry, depth of field
4. **Subjects & Characters**: Who/what appears, their appearance, clothing, expressions
5. **Setting & Environment**: Locations, backgrounds, props, set design
6. **Pacing & Editing**: How the visual rhythm flows across these frames, transitions implied
7. **Typography & Graphics**: Any text overlays, titles, branding elements
8. **Overall Tone & Mood**: The emotional feel the video conveys

Be specific and detailed — this analysis will be used to create a new video in the same style.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: prompt }, ...imageParts] },
    ],
  });

  return typeof response.text === "string" ? response.text : "";
}

// ─── API endpoint ────────────────────────────────────────────────────────────

router.post("/analyse-video", async (req, res) => {
  const { url, apiKey } = req.body;
  if (!url) return res.status(400).json({ error: "Missing video URL" });
  if (!apiKey) return res.status(400).json({ error: "Missing API key for Gemini Vision" });

  const sessionDir = join(TEMP_DIR, `session-${Date.now()}`);

  try {
    await mkdir(sessionDir, { recursive: true });
    let videoBuffer = null;
    let videoName = "video.mp4";

    const folderId = extractFolderId(url);
    const fileId = extractFileId(url);

    if (folderId) {
      console.log(`[VideoAnalysis] Listing files in Drive folder: ${folderId}`);
      const files = await listFiles(folderId);
      const videoFile = files.find(f =>
        f.mimeType?.startsWith("video/") ||
        /\.(mp4|mov|avi|webm|mkv)$/i.test(f.name)
      );
      if (!videoFile) {
        return res.status(404).json({ error: "No video file found in the Drive folder" });
      }
      console.log(`[VideoAnalysis] Downloading: ${videoFile.name} (${videoFile.id})`);
      videoBuffer = await downloadFile(videoFile.id);
      videoName = videoFile.name;
    } else if (fileId) {
      console.log(`[VideoAnalysis] Downloading file: ${fileId}`);
      videoBuffer = await downloadFile(fileId);
    } else {
      return res.status(400).json({ error: "Could not parse Drive folder or file ID from URL" });
    }

    const videoPath = join(sessionDir, videoName);
    await writeFile(videoPath, videoBuffer);
    console.log(`[VideoAnalysis] Saved video: ${videoPath} (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`);

    // Extract frames: 1 every 3 seconds, max 20 frames
    const framesDir = join(sessionDir, "frames");
    console.log("[VideoAnalysis] Extracting keyframes...");
    const framePaths = await extractFrames(videoPath, framesDir, 3);
    console.log(`[VideoAnalysis] Extracted ${framePaths.length} frames`);

    if (framePaths.length === 0) {
      return res.status(500).json({ error: "FFmpeg extracted no frames from the video" });
    }

    // Analyse with Gemini Vision
    console.log("[VideoAnalysis] Sending frames to Gemini Vision...");
    const analysis = await analyseFramesWithGemini(framePaths, apiKey);
    console.log(`[VideoAnalysis] Analysis complete (${analysis.length} chars)`);

    res.json({
      videoName,
      framesExtracted: framePaths.length,
      analysis,
    });
  } catch (err) {
    console.error("[VideoAnalysis] Error:", err);
    res.status(500).json({ error: err.message || "Video analysis failed" });
  } finally {
    cleanTemp(sessionDir).catch(() => {});
  }
});

export default router;
