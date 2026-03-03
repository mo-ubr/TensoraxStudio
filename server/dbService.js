/**
 * Tensorax Studio — Project DB backend service
 *
 * Manages assets/db.json and the assets/ folder structure.
 * Provides Express router mounted at /api/db.
 */

import { Router } from "express";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join } from "path";

const router = Router();

const ASSETS_ROOT = resolve(process.cwd(), "assets");
const DB_PATH = join(ASSETS_ROOT, "db.json");

const EMPTY_DB = {
  version: 1,
  projects: [],
  characters: [],
  scenery: [],
  clothing: [],
  assets: [],
};

const SUBFOLDER_MAP = {
  projects: "0. Projects",
  concepts: "1. Concepts",
  screenplays: "2. Screenplays",
  images: "3. Images",
  videos: "4. Videos",
  brands: "5. Brands",
};

async function ensureAssetFolders() {
  await mkdir(ASSETS_ROOT, { recursive: true });
  for (const sub of Object.values(SUBFOLDER_MAP)) {
    await mkdir(join(ASSETS_ROOT, sub), { recursive: true });
  }
}

async function loadDB() {
  await ensureAssetFolders();
  if (!existsSync(DB_PATH)) {
    await writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf-8");
    return structuredClone(EMPTY_DB);
  }
  const raw = await readFile(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

async function saveDB(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(name) {
  return name.trim().replace(/[^a-zA-Z0-9\s_-]/g, "").replace(/\s+/g, "_");
}

// ─── Full DB ─────────────────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  try {
    const db = await loadDB();
    res.json(db);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Projects ────────────────────────────────────────────────────────────────

router.get("/projects", async (_req, res) => {
  try {
    const db = await loadDB();
    res.json(db.projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const db = await loadDB();
    const p = db.projects.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const db = await loadDB();
    const now = new Date().toISOString();
    const project = {
      id: newId(),
      name: req.body.name || "Untitled",
      slug: slugify(req.body.name || "Untitled"),
      status: req.body.status || "active",
      brandId: req.body.brandId || "",
      description: req.body.description || "",
      createdAt: now,
      updatedAt: now,
      characterIds: req.body.characterIds || [],
      sceneryIds: req.body.sceneryIds || [],
      clothingIds: req.body.clothingIds || [],
      conceptIds: req.body.conceptIds || [],
      imageIds: req.body.imageIds || [],
      videoIds: req.body.videoIds || [],
      notes: req.body.notes || "",
    };
    db.projects.push(project);
    await saveDB(db);

    const projectDir = join(ASSETS_ROOT, SUBFOLDER_MAP.projects, project.slug);
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "concepts"), { recursive: true });
    await mkdir(join(projectDir, "images"), { recursive: true });
    await mkdir(join(projectDir, "frames"), { recursive: true });
    await mkdir(join(projectDir, "videos"), { recursive: true });

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/projects/:id", async (req, res) => {
  try {
    const db = await loadDB();
    const idx = db.projects.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Project not found" });
    const patch = { ...req.body, updatedAt: new Date().toISOString() };
    delete patch.id;
    delete patch.createdAt;
    db.projects[idx] = { ...db.projects[idx], ...patch };
    await saveDB(db);
    res.json(db.projects[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const db = await loadDB();
    db.projects = db.projects.filter((x) => x.id !== req.params.id);
    await saveDB(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Link / Unlink assets to a project ───────────────────────────────────────

router.post("/projects/:id/link", async (req, res) => {
  try {
    const db = await loadDB();
    const p = db.projects.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });
    const { assetType, assetId } = req.body;
    const key = `${assetType}Ids`;
    if (!Array.isArray(p[key])) p[key] = [];
    if (!p[key].includes(assetId)) p[key].push(assetId);
    p.updatedAt = new Date().toISOString();
    await saveDB(db);
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects/:id/unlink", async (req, res) => {
  try {
    const db = await loadDB();
    const p = db.projects.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });
    const { assetType, assetId } = req.body;
    const key = `${assetType}Ids`;
    if (Array.isArray(p[key])) p[key] = p[key].filter((id) => id !== assetId);
    p.updatedAt = new Date().toISOString();
    await saveDB(db);
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Save file to project folder ─────────────────────────────────────────────

router.post("/projects/:id/files", async (req, res) => {
  try {
    const db = await loadDB();
    const p = db.projects.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const { filename, data, subfolder } = req.body;
    if (!filename || !data) return res.status(400).json({ error: "Missing filename or data" });

    const projectDir = join(ASSETS_ROOT, SUBFOLDER_MAP.projects, p.slug);
    const targetDir = subfolder ? join(projectDir, subfolder) : projectDir;
    await mkdir(targetDir, { recursive: true });

    const filePath = join(targetDir, filename);
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

    console.log(`[DB] Saved project file: ${filePath}`);
    res.json({ path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Characters ──────────────────────────────────────────────────────────────

router.get("/characters", async (_req, res) => {
  try {
    const db = await loadDB();
    res.json(db.characters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/characters", async (req, res) => {
  try {
    const db = await loadDB();
    const character = {
      id: newId(),
      type: "character",
      name: req.body.name || "Unnamed",
      description: req.body.description || "",
      referenceImages: req.body.referenceImages || [],
      thumbnail: req.body.thumbnail || "",
      filePath: req.body.filePath || "",
      createdAt: new Date().toISOString(),
      tags: req.body.tags || [],
      metadata: req.body.metadata || {},
    };
    db.characters.push(character);
    await saveDB(db);
    res.json(character);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/characters/:id", async (req, res) => {
  try {
    const db = await loadDB();
    const idx = db.characters.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Character not found" });
    const patch = { ...req.body };
    delete patch.id;
    delete patch.createdAt;
    db.characters[idx] = { ...db.characters[idx], ...patch };
    await saveDB(db);
    res.json(db.characters[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/characters/:id", async (req, res) => {
  try {
    const db = await loadDB();
    db.characters = db.characters.filter((x) => x.id !== req.params.id);
    for (const p of db.projects) {
      p.characterIds = (p.characterIds || []).filter((id) => id !== req.params.id);
    }
    await saveDB(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Scenery ─────────────────────────────────────────────────────────────────

router.get("/scenery", async (_req, res) => {
  try {
    const db = await loadDB();
    res.json(db.scenery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/scenery", async (req, res) => {
  try {
    const db = await loadDB();
    const scenery = {
      id: newId(),
      type: "scenery",
      name: req.body.name || "Unnamed",
      description: req.body.description || "",
      referenceImages: req.body.referenceImages || [],
      thumbnail: req.body.thumbnail || "",
      filePath: req.body.filePath || "",
      createdAt: new Date().toISOString(),
      tags: req.body.tags || [],
      metadata: req.body.metadata || {},
    };
    db.scenery.push(scenery);
    await saveDB(db);
    res.json(scenery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/scenery/:id", async (req, res) => {
  try {
    const db = await loadDB();
    const idx = db.scenery.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Scenery not found" });
    const patch = { ...req.body };
    delete patch.id;
    delete patch.createdAt;
    db.scenery[idx] = { ...db.scenery[idx], ...patch };
    await saveDB(db);
    res.json(db.scenery[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Clothing ────────────────────────────────────────────────────────────────

router.get("/clothing", async (_req, res) => {
  try {
    const db = await loadDB();
    res.json(db.clothing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/clothing", async (req, res) => {
  try {
    const db = await loadDB();
    const clothing = {
      id: newId(),
      type: "clothing",
      name: req.body.name || "Unnamed",
      description: req.body.description || "",
      referenceImages: req.body.referenceImages || [],
      thumbnail: req.body.thumbnail || "",
      filePath: req.body.filePath || "",
      createdAt: new Date().toISOString(),
      tags: req.body.tags || [],
      metadata: req.body.metadata || {},
    };
    db.clothing.push(clothing);
    await saveDB(db);
    res.json(clothing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/clothing/:id", async (req, res) => {
  try {
    const db = await loadDB();
    const idx = db.clothing.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Clothing not found" });
    const patch = { ...req.body };
    delete patch.id;
    delete patch.createdAt;
    db.clothing[idx] = { ...db.clothing[idx], ...patch };
    await saveDB(db);
    res.json(db.clothing[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
