/**
 * Tensorax Studio - Vertex AI Image Generation Backend
 *
 * Serves /api/generate-image for Imagen 3 with subject reference support.
 * Requires GOOGLE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.
 */

import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { generateTensoraxFrame } from "./tensorax_api.js";
import { generateWithDalle } from "./openai_imagen.js";
import { runAutoGeneratePrompts } from "./prompt_api.js";
import { generateKlingVideo } from "./klingService.js";
import { generateSeedanceVideo } from "./seedanceService.js";
import { mergeVideos } from "./mergeVideosService.js";
import { generateFluxKontextImage } from "./fluxKontextService.js";
import { renderShotstackVideo } from "./shotstackService.js";
import { listFiles, getFileMetadata, downloadFile, uploadFile, createFolder } from "./driveService.js";
import dbRouter from "./dbService.js";
import videoAnalysisRouter from "./videoAnalysis.js";
import templateRouter from "./templateRoutes.js";
import pipelineRouter from "./pipelineRoutes.js";

const app = express();
const PORT = process.env.PORT || 5182;

/** Resolve key path: relative paths are from process.cwd() (project root when you run npm run server). */
function resolveKeyPath() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return resolve(process.cwd(), trimmed);
}

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api/db", dbRouter);
app.use("/api/video", videoAnalysisRouter);
app.use("/api/templates", templateRouter);
app.use("/api/pipeline", pipelineRouter);

import { writeFile, mkdir, readdir, stat } from "fs/promises";
import { join } from "path";

app.post("/api/save-file", async (req, res) => {
  try {
    const { filename, data, folder } = req.body;
    if (!filename || !data) return res.status(400).json({ error: "Missing filename or data." });

    const outputDir = resolve(process.cwd(), folder || "output");
    await mkdir(outputDir, { recursive: true });
    const filePath = join(outputDir, filename);

    if (data.startsWith("data:")) {
      const match = data.match(/^data:[^;]+;base64,(.+)$/);
      if (match) {
        await writeFile(filePath, Buffer.from(match[1], "base64"));
      } else {
        await writeFile(filePath, data, "utf-8");
      }
    } else {
      await writeFile(filePath, data, "utf-8");
    }

    console.log(`[Tensorax] Saved: ${filePath}`);
    res.json({ path: filePath });
  } catch (err) {
    console.error("[Tensorax] Save failed:", err);
    res.status(500).json({ error: err.message || "Save failed." });
  }
});

// ─── List local character image files ────────────────────────────────────────

const CHARACTERS_DIR = resolve(process.cwd(), "assets/3. Characters");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

app.get("/api/character-files", async (_req, res) => {
  try {
    await mkdir(CHARACTERS_DIR, { recursive: true });
    const entries = await readdir(CHARACTERS_DIR, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const full = join(CHARACTERS_DIR, e.name);
      const st = await stat(full);
      files.push({ name: e.name, path: `/character-assets/${encodeURIComponent(e.name)}`, size: st.size, modified: st.mtime.toISOString() });
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ files });
  } catch (err) {
    console.error("[CharacterFiles]", err);
    res.status(500).json({ error: err.message || "Failed to list character files." });
  }
});

app.use("/character-assets", express.static(CHARACTERS_DIR));
app.use("/project-assets", express.static(resolve(process.cwd(), "assets/0. Projects")));
app.use("/test-fixtures", express.static(resolve(process.cwd(), "assets/test-fixtures")));

// API: list test fixture videos
app.get("/api/test-fixtures/videos", async (req, res) => {
  try {
    const videosDir = resolve(process.cwd(), "assets/test-fixtures/videos");
    const files = await readdir(videosDir);
    const videoFiles = files.filter(f => /\.(mp4|webm|mov)$/i.test(f));
    const results = [];
    for (const f of videoFiles) {
      const s = await stat(join(videosDir, f));
      results.push({ name: f, size: s.size, url: `/test-fixtures/videos/${encodeURIComponent(f)}` });
    }
    res.json(results);
  } catch (err) {
    res.json([]);
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio, referenceImages, size } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt." });
    }

    const images = Array.isArray(referenceImages) ? referenceImages : [];
    const charRef = images.length > 0 ? images[0] : null;

    const dataUrl = await generateTensoraxFrame(
      prompt,
      aspectRatio || "9:16",
      charRef
    );

    res.json({ dataUrl });
  } catch (err) {
    console.error("[Vertex Imagen]", err);
    res.status(500).json({
      error: err.message || "Image generation failed.",
    });
  }
});

app.post("/api/generate-image-openai", async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt." });
    }
    const dataUrl = await generateWithDalle(prompt, aspectRatio || "9:16");
    res.json({ dataUrl });
  } catch (err) {
    console.error("[OpenAI DALL-E]", err);
    res.status(500).json({ error: err.message || "Image generation failed." });
  }
});

app.post("/api/generate-prompts", async (req, res) => {
  try {
    const { apiKey, analysisModel, copyModel, refImages, userNote } = req.body;
    const result = await runAutoGeneratePrompts({
      apiKey,
      analysisModel: analysisModel || null,
      copyModel: copyModel || null,
      refImages: refImages || {},
      userNote: userNote || "",
    });
    res.json(result);
  } catch (err) {
    console.error("[prompt_api]", err);
    res.status(500).json({ error: err.message || "Prompt generation failed." });
  }
});

/**
 * Convert a local image path (e.g. /project-assets/...) to a base64 data URI
 * so fal.ai can actually read the image. Returns the original URL if it's
 * already a data URI or an external HTTPS URL.
 */
function resolveImageForFal(urlOrPath) {
  if (!urlOrPath) return null;
  // Already a data URI or external URL — pass through
  if (urlOrPath.startsWith('data:') || urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  // Local path like /project-assets/xxx/frames/img.png
  let localPath = null;
  if (urlOrPath.startsWith('/project-assets/')) {
    const rel = decodeURIComponent(urlOrPath.replace('/project-assets/', ''));
    localPath = resolve(process.cwd(), 'assets/0. Projects', rel);
  } else if (urlOrPath.startsWith('/character-assets/')) {
    const rel = decodeURIComponent(urlOrPath.replace('/character-assets/', ''));
    localPath = resolve(process.cwd(), 'assets/3. Characters', rel);
  }
  if (localPath && existsSync(localPath)) {
    const ext = localPath.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const base64 = readFileSync(localPath).toString('base64');
    console.log(`[resolveImage] Converted local path to data URI (${(base64.length / 1024).toFixed(0)}KB): ${urlOrPath.slice(0, 80)}`);
    return `data:${mime};base64,${base64}`;
  }
  console.warn(`[resolveImage] Could not resolve local path: ${urlOrPath}`);
  return urlOrPath;
}

// Kling video generation with SSE progress streaming
app.post("/api/generate-video-kling", async (req, res) => {
  const { apiKey, model, startImageUrl, endImageUrl, motionVideoUrl, prompt, duration, aspectRatio, generateAudio } = req.body;
  const resolvedApiKey = (apiKey || "").trim() || process.env.KLING_API_KEY || "";

  // Set up Server-Sent Events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const videoUrl = await generateKlingVideo({
      apiKey: resolvedApiKey,
      model: model || "kling-v3-standard",
      startImageUrl: resolveImageForFal(startImageUrl),
      endImageUrl: resolveImageForFal(endImageUrl) || null,
      motionVideoUrl: motionVideoUrl || null,
      prompt,
      duration: duration || "5",
      aspectRatio: aspectRatio || "9:16",
      generateAudio: !!generateAudio,
      onProgress: (msg) => {
        console.log("[Kling]", msg);
        sendSSE("progress", { message: msg });
      },
    });
    sendSSE("done", { videoUrl });
  } catch (err) {
    console.error("[Kling API]", err);
    sendSSE("error", { error: err.message || "Kling video generation failed." });
  } finally {
    res.end();
  }
});

app.post("/api/generate-video-seedance", async (req, res) => {
  try {
    const { apiKey, startImageUrl, endImageUrl, prompt, duration, aspectRatio } = req.body;
    const resolvedApiKey = (apiKey || "").trim() || process.env.FAL_API_KEY || "";

    const videoUrl = await generateSeedanceVideo({
      apiKey: resolvedApiKey,
      startImageUrl: resolveImageForFal(startImageUrl),
      endImageUrl: resolveImageForFal(endImageUrl) || null,
      prompt,
      duration: duration || "5",
      aspectRatio: aspectRatio || "auto",
      resolution: "1080p",
      onProgress: (msg) => { console.log("[Seedance]", msg); },
    });
    res.json({ videoUrl });
  } catch (err) {
    console.error("[Seedance API]", err);
    res.status(500).json({ error: err.message || "Seedance video generation failed." });
  }
});

// ─── Video Merge / Stitch ────────────────────────────────────────────────────

/** Download a remote URL to a local temp file */
async function downloadToFile(url, destPath) {
  console.log(`[MergeVideos-Local] Downloading ${url.substring(0, 80)}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url.substring(0, 80)}`);
  const { writeFileSync } = await import("fs");
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
  console.log(`[MergeVideos-Local] Downloaded → ${destPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
}

/** Local ffmpeg merge — downloads remote URLs first, no API key needed */
async function mergeVideosLocal(videoUrls) {
  let ffmpegPath;
  try {
    const installer = await import("@ffmpeg-installer/ffmpeg");
    ffmpegPath = installer.default?.path || installer.path;
  } catch { throw new Error("@ffmpeg-installer/ffmpeg not installed"); }

  const { execSync } = await import("child_process");
  const projectRoot = resolve(__dirname, "..");
  const tmpDir = resolve(projectRoot, "assets", ".tmp-video");
  await mkdir(tmpDir, { recursive: true });

  // Resolve all paths — download remote URLs in parallel for speed
  console.log(`[MergeVideos-Local] Resolving ${videoUrls.length} video URLs...`);
  const resolvedPaths = await Promise.all(videoUrls.map(async (u, i) => {
    if (u.startsWith("http://") || u.startsWith("https://")) {
      const tmpFile = join(tmpDir, `segment-${i}-${Date.now()}.mp4`);
      await downloadToFile(u, tmpFile);
      return tmpFile;
    } else if (u.startsWith("/") || u.startsWith("./")) {
      const rel = u.replace(/^\.?\//, "");
      const tryPublic = resolve(projectRoot, "public", rel);
      if (existsSync(tryPublic)) return tryPublic;
      const tryDist = resolve(projectRoot, "dist", rel);
      if (existsSync(tryDist)) return tryDist;
      throw new Error(`Local video not found: ${u}`);
    }
    return u;
  }));

  const listFile = join(tmpDir, `concat-${Date.now()}.txt`);
  const outFile = join(tmpDir, `merged-${Date.now()}.mp4`);
  const listContent = resolvedPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  const { writeFileSync, unlinkSync } = await import("fs");
  writeFileSync(listFile, listContent);

  console.log("[MergeVideos-Local] Concatenating", resolvedPaths.length, "videos with ffmpeg");
  execSync(`"${ffmpegPath}" -f concat -safe 0 -i "${listFile}" -c copy "${outFile}" -y`, { stdio: "pipe", timeout: 300000 });
  unlinkSync(listFile);

  // Clean up downloaded temp segment files
  for (const p of resolvedPaths) {
    if (p.startsWith(tmpDir)) {
      try { unlinkSync(p); } catch {}
    }
  }

  // Serve via /project-assets or a temp route — move to public
  const finalName = `final-video-${Date.now()}.mp4`;
  const publicOut = resolve(projectRoot, "public", "test-refs", finalName);
  const { renameSync } = await import("fs");
  renameSync(outFile, publicOut);

  const videoUrl = `/test-refs/${finalName}`;
  console.log("[MergeVideos-Local] Done →", videoUrl);
  return videoUrl;
}

app.post("/api/merge-videos", async (req, res) => {
  try {
    const { videoUrls } = req.body;

    // Always use local ffmpeg — downloads remote URLs automatically, no API key needed
    const videoUrl = await mergeVideosLocal(videoUrls);
    res.json({ videoUrl });
  } catch (err) {
    console.error("[MergeVideos API]", err);
    res.status(500).json({ error: err.message || "Video merge failed." });
  }
});

// ─── Shotstack Composition (Video Composition with text, music, transitions) ──

app.post("/api/compose-video", async (req, res) => {
  const { apiKey, edit, environment } = req.body;
  const resolvedApiKey = (apiKey || "").trim() || process.env.SHOTSTACK_API_KEY || "";

  if (!resolvedApiKey) {
    return res.status(400).json({ error: "No Shotstack API key provided." });
  }

  if (!edit || !edit.timeline || !edit.output) {
    return res.status(400).json({ error: "Invalid edit: must contain timeline and output." });
  }

  // SSE streaming for progress
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const videoUrl = await renderShotstackVideo({
      apiKey: resolvedApiKey,
      environment: environment || "v1",
      edit,
      onProgress: (msg) => {
        console.log("[Shotstack]", msg);
        sendSSE("progress", { message: msg });
      },
    });
    sendSSE("done", { videoUrl });
  } catch (err) {
    console.error("[Shotstack API Error]", err);
    sendSSE("error", { error: err.message || "Shotstack composition failed." });
  } finally {
    res.end();
  }
});

// ─── Flux Kontext (Image Transformation) ─────────────────────────────────────

app.post("/api/flux-kontext/generate", async (req, res) => {
  try {
    const { apiKey, imageUrl, prompt, modelId, guidanceScale, steps, seed, outputFormat, usePro } = req.body;
    const resolvedApiKey = (apiKey || "").trim() || process.env.FAL_API_KEY || "";

    const result = await generateFluxKontextImage({
      apiKey: resolvedApiKey,
      imageUrl,
      prompt,
      modelId: modelId || undefined,
      guidanceScale: guidanceScale || 2.5,
      steps: steps || 28,
      seed: seed || undefined,
      outputFormat: outputFormat || "jpeg",
      usePro: !!usePro,
      onProgress: (msg) => { console.log("[ImageEdit]", msg); },
    });
    res.json(result);
  } catch (err) {
    console.error("[ImageEdit API]", err);
    res.status(500).json({ error: err.message || "Image editing failed." });
  }
});

// ─── Google Drive (zLibraries) ───────────────────────────────────────────────

app.get("/api/drive/files", async (req, res) => {
  try {
    const { folderId, mimeType } = req.query;
    const files = await listFiles(folderId || undefined, mimeType || undefined);
    res.json({ files });
  } catch (err) {
    console.error("[Drive]", err);
    res.status(500).json({ error: err.message || "Failed to list files." });
  }
});

app.get("/api/drive/files/:fileId", async (req, res) => {
  try {
    const meta = await getFileMetadata(req.params.fileId);
    res.json(meta);
  } catch (err) {
    console.error("[Drive]", err);
    res.status(500).json({ error: err.message || "Failed to get file metadata." });
  }
});

app.get("/api/drive/files/:fileId/download", async (req, res) => {
  try {
    const { exportMime } = req.query;
    const content = await downloadFile(req.params.fileId, exportMime || undefined);
    if (Buffer.isBuffer(content)) {
      res.set("Content-Type", "application/octet-stream");
      res.send(content);
    } else {
      res.set("Content-Type", exportMime || "text/plain");
      res.send(content);
    }
  } catch (err) {
    console.error("[Drive]", err);
    res.status(500).json({ error: err.message || "Failed to download file." });
  }
});

app.post("/api/drive/files", async (req, res) => {
  try {
    const { name, content, mimeType, folderId } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: "Missing name or content." });
    }
    const file = await uploadFile(name, content, mimeType || "text/plain", folderId || undefined);
    res.json(file);
  } catch (err) {
    console.error("[Drive]", err);
    res.status(500).json({ error: err.message || "Failed to upload file." });
  }
});

app.post("/api/drive/folders", async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Missing folder name." });
    }
    const folder = await createFolder(name, parentId || undefined);
    res.json(folder);
  } catch (err) {
    console.error("[Drive]", err);
    res.status(500).json({ error: err.message || "Failed to create folder." });
  }
});

// ─── Save Concept to Drive ──────────────────────────────────────────────────

app.post("/api/save-concept", async (req, res) => {
  try {
    const { projectName, title, concept, parentFolderId } = req.body;
    if (!projectName || !concept) {
      return res.status(400).json({ error: "Missing projectName or concept." });
    }

    const parent = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const folder = await createFolder(projectName, parent);

    const docContent = [
      `${projectName}`,
      `${'='.repeat(projectName.length)}`,
      '',
      `Concept: ${title || 'Untitled'}`,
      `${'-'.repeat(40)}`,
      '',
      concept,
      '',
      `---`,
      `Generated by Tensorax Studio`,
      `Date: ${new Date().toISOString().split('T')[0]}`,
    ].join('\n');

    const file = await uploadFile(
      `${projectName} - Concept.txt`,
      docContent,
      'text/plain',
      folder.id
    );

    res.json({ folder, file });
  } catch (err) {
    console.error("[SaveConcept]", err);
    res.status(500).json({ error: err.message || "Failed to save concept." });
  }
});

// ─── Health ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  const hasProject = !!(process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT);
  const keyPath = resolveKeyPath();
  const keyFileExists = keyPath ? existsSync(keyPath) : false;
  const hasCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasDriveFolder = !!process.env.GOOGLE_DRIVE_FOLDER_ID;
  res.json({
    ok: hasProject && hasCreds && keyFileExists,
    vertex: {
      project: hasProject,
      credentials: hasCreds,
      keyFileExists,
      ...(keyPath && !keyFileExists && { keyPathResolved: keyPath }),
    },
    drive: {
      folderConfigured: hasDriveFolder,
    },
  });
});

// In production, serve the built React frontend (must be after all API routes)
if (process.env.NODE_ENV === "production") {
  const distPath = resolve(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(resolve(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  const region = (process.env.GOOGLE_LOCATION || process.env.LOCATION || "us-central1").trim();
  const keyPath = resolveKeyPath();
  const keyFileExists = keyPath ? existsSync(keyPath) : false;

  const projectId = process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  console.log(`[Tensorax] Vertex AI backend running at http://localhost:${PORT}`);
  console.log(`[Tensorax] Project ID: ${projectId || "(not set)"}`);
  console.log(`[Tensorax] Region: ${region}`);
  console.log(`[Tensorax] Key file: ${keyPath || "not set"} ${keyPath && existsSync(keyPath) ? "✓ found" : ""}`);
  if (!process.env.GOOGLE_PROJECT_ID && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.warn("[Tensorax] GOOGLE_PROJECT_ID not set - image generation will fail.");
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn("[Tensorax] GOOGLE_APPLICATION_CREDENTIALS not set - Vertex image gen will fail.");
  } else if (!keyFileExists) {
    console.warn("[Tensorax] JSON key file not found - did you download it and set the path in .env?");
    console.warn("[Tensorax]   GOOGLE_APPLICATION_CREDENTIALS=" + process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.warn("[Tensorax]   Resolved path: " + keyPath);
    console.warn("[Tensorax]   → Permission Denied is usually a missing key. Create Key in GCP, download JSON, put path in .env.local");
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[Tensorax] OPENAI_API_KEY not set - DALL-E 3 fallback will not work.");
  }
});
