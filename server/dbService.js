/**
 * Tensorax Studio — Project DB backend (SQLite)
 *
 * Single-file database at assets/tensorax.db.
 * All API shapes identical to the previous JSON version — frontend unchanged.
 */

import { Router } from "express";
import { mkdir, writeFile, readdir, readFile, stat } from "fs/promises";
import { resolve, join } from "path";
import Database from "better-sqlite3";
import multer from "multer";

const router = Router();

const ASSETS_ROOT = resolve(process.cwd(), "assets");
const DB_PATH = join(ASSETS_ROOT, "tensorax.db");

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

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(name) {
  return name.trim().replace(/[^a-zA-Z0-9\s_-]/g, "").replace(/\s+/g, "_");
}

function now() {
  return new Date().toISOString();
}

// ─── Database initialisation ─────────────────────────────────────────────────

let db;

function getDB() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      slug          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active',
      brandId       TEXT NOT NULL DEFAULT '',
      description   TEXT NOT NULL DEFAULT '',
      createdAt     TEXT NOT NULL,
      updatedAt     TEXT NOT NULL,
      notes         TEXT NOT NULL DEFAULT '',
      metadata      TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS assets (
      id              TEXT PRIMARY KEY,
      type            TEXT NOT NULL,  -- 'character','scenery','clothing','concept','image','video'
      name            TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      thumbnail       TEXT NOT NULL DEFAULT '',
      filePath        TEXT NOT NULL DEFAULT '',
      createdAt       TEXT NOT NULL,
      tags            TEXT NOT NULL DEFAULT '[]',       -- JSON array
      metadata        TEXT NOT NULL DEFAULT '{}',       -- JSON object
      referenceImages TEXT NOT NULL DEFAULT '[]'        -- JSON array
    );

    CREATE TABLE IF NOT EXISTS project_assets (
      projectId TEXT NOT NULL,
      assetId   TEXT NOT NULL,
      assetType TEXT NOT NULL,  -- 'character','scenery','clothing','concept','image','video'
      linkedAt  TEXT NOT NULL,
      PRIMARY KEY (projectId, assetId),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assetId)   REFERENCES assets(id)   ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_pa_project  ON project_assets(projectId);
    CREATE INDEX IF NOT EXISTS idx_pa_asset    ON project_assets(assetId);

    -- Session A: Research, Measurement & Project Foundation tables

    CREATE TABLE IF NOT EXISTS project_memory_facts (
      id              TEXT PRIMARY KEY,
      projectId       TEXT NOT NULL,
      category        TEXT NOT NULL,  -- 'audience','content','timing','platform','competitor','trend'
      fact            TEXT NOT NULL,
      confidence      REAL NOT NULL DEFAULT 0.5,
      evidenceCount   INTEGER NOT NULL DEFAULT 1,
      firstObserved   TEXT NOT NULL,
      lastConfirmed   TEXT NOT NULL,
      stillValid      INTEGER NOT NULL DEFAULT 1,
      source          TEXT NOT NULL DEFAULT 'automated',  -- 'automated','user','research'
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_memory_context (
      id          TEXT PRIMARY KEY,
      projectId   TEXT NOT NULL,
      text        TEXT NOT NULL,
      category    TEXT NOT NULL,  -- 'brand_voice','audience','goals','constraints','style','general'
      addedAt     TEXT NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_memory_decisions (
      id            TEXT PRIMARY KEY,
      projectId     TEXT NOT NULL,
      decision      TEXT NOT NULL,
      rationale     TEXT NOT NULL DEFAULT '',
      madeAt        TEXT NOT NULL,
      madeBy        TEXT NOT NULL DEFAULT 'user',  -- 'user','system'
      category      TEXT NOT NULL DEFAULT '',
      supersededBy  TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_memory_baselines (
      id          TEXT PRIMARY KEY,
      projectId   TEXT NOT NULL,
      platform    TEXT NOT NULL,
      metric      TEXT NOT NULL,
      value       REAL NOT NULL,
      measuredAt  TEXT NOT NULL,
      periodDays  INTEGER NOT NULL DEFAULT 30,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_brand_profiles (
      projectId        TEXT PRIMARY KEY,
      voiceDescriptors TEXT NOT NULL DEFAULT '[]',   -- JSON array
      toneRangeMin     TEXT NOT NULL DEFAULT 'neutral',
      toneRangeMax     TEXT NOT NULL DEFAULT 'neutral',
      visualStyle      TEXT NOT NULL DEFAULT '',
      tabooTopics      TEXT NOT NULL DEFAULT '[]',   -- JSON array
      keyMessages      TEXT NOT NULL DEFAULT '[]',   -- JSON array
      languageNotes    TEXT NOT NULL DEFAULT '{}',   -- JSON object
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS research_settings (
      projectId           TEXT PRIMARY KEY,
      autoRefreshEnabled  INTEGER NOT NULL DEFAULT 0,
      refreshFrequency    TEXT NOT NULL DEFAULT 'weekly',
      lastRefreshAt       TEXT,
      nextRefreshAt       TEXT,
      outputLanguages     TEXT NOT NULL DEFAULT '["en"]',  -- JSON array
      defaultExportFormat TEXT NOT NULL DEFAULT 'xlsx',
      userInstructions    TEXT NOT NULL DEFAULT '',
      minFollowers        INTEGER NOT NULL DEFAULT 1000,
      maxCompetitors      INTEGER NOT NULL DEFAULT 20,
      engagementRateFloor REAL NOT NULL DEFAULT 0.01,
      dateRange           INTEGER NOT NULL DEFAULT 14,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS platform_research_configs (
      id                       TEXT PRIMARY KEY,
      projectId                TEXT NOT NULL,
      platform                 TEXT NOT NULL,  -- 'tiktok','facebook','instagram','youtube'
      enabled                  INTEGER NOT NULL DEFAULT 1,
      ownAccountHandle         TEXT NOT NULL DEFAULT '',
      competitorHandles        TEXT NOT NULL DEFAULT '[]',  -- JSON array
      targetHashtags           TEXT NOT NULL DEFAULT '[]',  -- JSON array
      scrapingMethod           TEXT NOT NULL DEFAULT 'thirdParty',
      scrapingApiKey           TEXT,
      maxPostsPerAccount       INTEGER NOT NULL DEFAULT 100,
      includePromotedPosts     INTEGER NOT NULL DEFAULT 1,
      platformSpecificSettings TEXT NOT NULL DEFAULT '{}',  -- JSON object
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(projectId, platform)
    );

    CREATE TABLE IF NOT EXISTS source_files (
      id               TEXT PRIMARY KEY,
      projectId        TEXT NOT NULL,
      filename         TEXT NOT NULL,
      mimeType         TEXT NOT NULL DEFAULT '',
      sizeBytes        INTEGER NOT NULL DEFAULT 0,
      category         TEXT NOT NULL DEFAULT 'user_upload',
      description      TEXT NOT NULL DEFAULT '',
      uploadedAt       TEXT NOT NULL,
      uploadedBy       TEXT NOT NULL DEFAULT '',
      storagePath      TEXT NOT NULL DEFAULT '',
      checksum         TEXT NOT NULL DEFAULT '',
      metadata         TEXT NOT NULL DEFAULT '{}',
      linkedExecutions TEXT NOT NULL DEFAULT '[]',  -- JSON array
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_language_groups (
      groupId     TEXT NOT NULL,
      assetId     TEXT NOT NULL,
      language    TEXT NOT NULL,
      isTranslation INTEGER NOT NULL DEFAULT 0,
      sourceAssetId TEXT,
      PRIMARY KEY (groupId, assetId),
      FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_performance (
      id               TEXT PRIMARY KEY,
      assetId          TEXT NOT NULL,
      collectedAt      TEXT NOT NULL,
      platform         TEXT NOT NULL,
      views            INTEGER NOT NULL DEFAULT 0,
      likes            INTEGER NOT NULL DEFAULT 0,
      shares           INTEGER NOT NULL DEFAULT 0,
      comments         INTEGER NOT NULL DEFAULT 0,
      saves            INTEGER NOT NULL DEFAULT 0,
      engagementRate   REAL NOT NULL DEFAULT 0,
      reach            INTEGER NOT NULL DEFAULT 0,
      impressions      INTEGER NOT NULL DEFAULT 0,
      clickThroughRate REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_versions (
      assetId           TEXT NOT NULL,
      previousVersionId TEXT NOT NULL,
      version           INTEGER NOT NULL,
      createdAt         TEXT NOT NULL,
      PRIMARY KEY (assetId),
      FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_memory_facts_project ON project_memory_facts(projectId);
    CREATE INDEX IF NOT EXISTS idx_memory_context_project ON project_memory_context(projectId);
    CREATE INDEX IF NOT EXISTS idx_memory_decisions_project ON project_memory_decisions(projectId);
    CREATE INDEX IF NOT EXISTS idx_memory_baselines_project ON project_memory_baselines(projectId);
    CREATE INDEX IF NOT EXISTS idx_platform_configs_project ON platform_research_configs(projectId);
    CREATE INDEX IF NOT EXISTS idx_source_files_project ON source_files(projectId);
    CREATE INDEX IF NOT EXISTS idx_asset_lang_group ON asset_language_groups(groupId);
    CREATE INDEX IF NOT EXISTS idx_asset_perf_asset ON asset_performance(assetId);
    CREATE INDEX IF NOT EXISTS idx_asset_perf_collected ON asset_performance(collectedAt);
  `);

  // Migrate: add metadata column if missing (existing DBs)
  try {
    db.prepare("SELECT metadata FROM projects LIMIT 1").get();
  } catch {
    db.exec("ALTER TABLE projects ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'");
  }

  return db;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function projectRow(row) {
  if (!row) return null;
  const d = getDB();
  const links = d.prepare("SELECT assetId, assetType FROM project_assets WHERE projectId = ?").all(row.id);
  const grouped = { characterIds: [], sceneryIds: [], clothingIds: [], conceptIds: [], imageIds: [], videoIds: [] };
  for (const l of links) {
    const key = `${l.assetType}Ids`;
    if (grouped[key]) grouped[key].push(l.assetId);
  }
  let metadata = {};
  try { metadata = JSON.parse(row.metadata || "{}"); } catch { /* ignore */ }
  return { ...row, metadata, ...grouped };
}

function assetRow(row) {
  if (!row) return null;
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]"),
    metadata: JSON.parse(row.metadata || "{}"),
    referenceImages: JSON.parse(row.referenceImages || "[]"),
  };
}

// ─── Full DB (legacy compat) ─────────────────────────────────────────────────

router.get("/", (_req, res) => {
  try {
    const d = getDB();
    const projects = d.prepare("SELECT * FROM projects ORDER BY createdAt DESC").all().map(projectRow);
    const characters = d.prepare("SELECT * FROM assets WHERE type='character' ORDER BY createdAt DESC").all().map(assetRow);
    const scenery = d.prepare("SELECT * FROM assets WHERE type='scenery' ORDER BY createdAt DESC").all().map(assetRow);
    const clothing = d.prepare("SELECT * FROM assets WHERE type='clothing' ORDER BY createdAt DESC").all().map(assetRow);
    const assets = d.prepare("SELECT * FROM assets ORDER BY createdAt DESC").all().map(assetRow);
    res.json({ version: 2, projects, characters, scenery, clothing, assets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Projects ────────────────────────────────────────────────────────────────

router.get("/projects", (_req, res) => {
  try {
    const rows = getDB().prepare("SELECT * FROM projects ORDER BY createdAt DESC").all();
    // List endpoint: return lightweight project objects without full metadata
    // (metadata can be huge — MB of base64 images in wizard state)
    res.json(rows.map(r => {
      const full = projectRow(r);
      // Keep only the templateId from metadata if present, drop the rest
      const { metadata, ...rest } = full;
      const lightweight = { ...rest };
      if (metadata && metadata.templateId) {
        lightweight.templateId = metadata.templateId;
      }
      return lightweight;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/projects/:id", (req, res) => {
  try {
    const row = getDB().prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Project not found" });
    res.json(projectRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const d = getDB();
    const id = newId();
    const n = now();
    const name = req.body.name || "Untitled";
    const slug = slugify(name);

    d.prepare(`INSERT INTO projects (id, name, slug, status, brandId, description, createdAt, updatedAt, notes, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, name, slug,
      req.body.status || "active",
      req.body.brandId || "",
      req.body.description || "",
      n, n,
      req.body.notes || "",
      JSON.stringify(req.body.metadata || {})
    );

    const projectDir = join(ASSETS_ROOT, SUBFOLDER_MAP.projects, slug);
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "concepts"), { recursive: true });
    await mkdir(join(projectDir, "images"), { recursive: true });
    await mkdir(join(projectDir, "frames"), { recursive: true });
    await mkdir(join(projectDir, "videos"), { recursive: true });

    const row = d.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    res.json(projectRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/projects/:id", (req, res) => {
  try {
    const d = getDB();
    const existing = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Project not found" });

    const fields = ["name", "slug", "status", "brandId", "description", "notes"];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    }
    if (req.body.metadata !== undefined) {
      updates.push("metadata = ?");
      values.push(typeof req.body.metadata === 'string' ? req.body.metadata : JSON.stringify(req.body.metadata));
    }
    updates.push("updatedAt = ?");
    values.push(now());
    values.push(req.params.id);

    d.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    const row = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    res.json(projectRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/projects/:id/metadata", (req, res) => {
  try {
    const row = getDB().prepare("SELECT metadata FROM projects WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Project not found" });
    res.json(JSON.parse(row.metadata || "{}"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/projects/:id/metadata", (req, res) => {
  try {
    const d = getDB();
    const row = d.prepare("SELECT metadata FROM projects WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Project not found" });
    const existing = JSON.parse(row.metadata || "{}");
    const merged = { ...existing, ...req.body };
    d.prepare("UPDATE projects SET metadata = ?, updatedAt = ? WHERE id = ?").run(JSON.stringify(merged), now(), req.params.id);
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/projects/:id", (req, res) => {
  try {
    getDB().prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Link / Unlink ───────────────────────────────────────────────────────────

router.post("/projects/:id/link", (req, res) => {
  try {
    const d = getDB();
    const row = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Project not found" });
    const { assetType, assetId } = req.body;
    d.prepare("INSERT OR IGNORE INTO project_assets (projectId, assetId, assetType, linkedAt) VALUES (?, ?, ?, ?)").run(req.params.id, assetId, assetType, now());
    d.prepare("UPDATE projects SET updatedAt = ? WHERE id = ?").run(now(), req.params.id);
    res.json(projectRow(d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects/:id/unlink", (req, res) => {
  try {
    const d = getDB();
    const row = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Project not found" });
    const { assetType, assetId } = req.body;
    d.prepare("DELETE FROM project_assets WHERE projectId = ? AND assetId = ? AND assetType = ?").run(req.params.id, assetId, assetType);
    d.prepare("UPDATE projects SET updatedAt = ? WHERE id = ?").run(now(), req.params.id);
    res.json(projectRow(d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Project directory helpers ───────────────────────────────────────────────

/** Map internal subfolder names to Inputs/Outputs structure */
const IO_MAP = {
  concepts: "Inputs",      // prompts, analysis text
  images: "Outputs",       // generated keyframe images
  frames: "Outputs",       // generated frames
  videos: "Outputs",       // generated video segments + final
};

/** Get the effective project directory — custom if set, otherwise default */
function getProjectDir(project) {
  try {
    const meta = JSON.parse(project.metadata || "{}");
    if (meta.customDirectory && meta.customDirectory.trim()) {
      return meta.customDirectory.trim();
    }
  } catch { /* ignore */ }
  return join(ASSETS_ROOT, SUBFOLDER_MAP.projects, project.slug);
}

router.get("/projects/:id/directory", (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    res.json({ path: projectDir, slug: p.slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pick a directory via native folder picker (general-purpose, no project needed)
router.post("/projects/pick-directory", async (req, res) => {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const psScript = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select default asset directory'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { '' }`;
    const { stdout } = await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, { timeout: 60000 });
    const chosenPath = stdout.trim();

    if (!chosenPath) {
      return res.json({ cancelled: true, path: '' });
    }

    console.log(`[DB] Default asset directory picked: ${chosenPath}`);
    res.json({ path: chosenPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pick a custom directory for project assets (opens native folder picker on Windows)
router.post("/projects/:id/pick-directory", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Use PowerShell folder picker dialog on Windows
    const psScript = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select project directory for ${p.name.replace(/'/g, "''")}'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { '' }`;
    const { stdout } = await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, { timeout: 60000 });
    const chosenPath = stdout.trim();

    if (!chosenPath) {
      return res.json({ cancelled: true, path: getProjectDir(p) });
    }

    // Store in project metadata
    const meta = JSON.parse(p.metadata || "{}");
    meta.customDirectory = chosenPath;
    d.prepare("UPDATE projects SET metadata = ?, updatedAt = ? WHERE id = ?")
      .run(JSON.stringify(meta), now(), p.id);

    // Create Inputs/Outputs subfolders in the chosen directory
    await mkdir(join(chosenPath, "Inputs"), { recursive: true });
    await mkdir(join(chosenPath, "Outputs"), { recursive: true });

    console.log(`[DB] Project "${p.name}" directory set to: ${chosenPath}`);
    res.json({ path: chosenPath, slug: p.slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set directory from a typed path (no dialog)
router.post("/projects/:id/set-directory", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const { path: dirPath } = req.body;

    // Store in project metadata (empty string = reset to default)
    const meta = JSON.parse(p.metadata || "{}");
    meta.customDirectory = (dirPath || "").trim();
    d.prepare("UPDATE projects SET metadata = ?, updatedAt = ? WHERE id = ?")
      .run(JSON.stringify(meta), now(), p.id);

    if (dirPath && dirPath.trim()) {
      // Create Inputs/Outputs subfolders
      await mkdir(join(dirPath.trim(), "Inputs"), { recursive: true });
      await mkdir(join(dirPath.trim(), "Outputs"), { recursive: true });
      console.log(`[DB] Project "${p.name}" directory set to: ${dirPath.trim()}`);
      res.json({ path: dirPath.trim(), slug: p.slug });
    } else {
      const defaultDir = join(ASSETS_ROOT, SUBFOLDER_MAP.projects, p.slug);
      console.log(`[DB] Project "${p.name}" directory reset to default: ${defaultDir}`);
      res.json({ path: defaultDir, slug: p.slug });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get output directory contents for a project
router.get("/projects/:id/outputs", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    const hasCustomDir = (() => { try { const m = JSON.parse(p.metadata || "{}"); return !!(m.customDirectory && m.customDirectory.trim()); } catch { return false; } })();
    const outputDir = hasCustomDir ? join(projectDir, "Outputs") : join(projectDir, "videos");

    await mkdir(outputDir, { recursive: true });
    const entries = await readdir(outputDir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => ({
      name: e.name,
      path: join(outputDir, e.name),
      url: `/api/db/projects/${p.id}/output-file/${encodeURIComponent(e.name)}`,
    }));
    res.json({ outputDir, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve a file from the project output directory
router.get("/projects/:id/output-file/:filename", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    const hasCustomDir = (() => { try { const m = JSON.parse(p.metadata || "{}"); return !!(m.customDirectory && m.customDirectory.trim()); } catch { return false; } })();
    const outputDir = hasCustomDir ? join(projectDir, "Outputs") : join(projectDir, "videos");
    const filePath = join(outputDir, decodeURIComponent(req.params.filename));

    const { existsSync } = await import("fs");
    if (!existsSync(filePath)) return res.status(404).json({ error: "File not found" });

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/project-folders", async (_req, res) => {
  try {
    const projectsRoot = join(ASSETS_ROOT, SUBFOLDER_MAP.projects);
    await mkdir(projectsRoot, { recursive: true });
    const entries = await readdir(projectsRoot, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    res.json({ root: projectsRoot, folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects/:id/open-folder", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    await mkdir(projectDir, { recursive: true });

    const { exec } = await import("child_process");
    const platform = process.platform;
    const cmd = platform === "win32" ? `explorer "${projectDir}"`
              : platform === "darwin" ? `open "${projectDir}"`
              : `xdg-open "${projectDir}"`;
    exec(cmd);
    res.json({ opened: projectDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Save file to project folder ─────────────────────────────────────────────

router.post("/projects/:id/files", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const { filename, data, subfolder } = req.body;
    if (!filename || !data) return res.status(400).json({ error: "Missing filename or data" });

    const projectDir = getProjectDir(p);
    // If project has a custom directory, use Inputs/Outputs structure
    const hasCustomDir = (() => { try { const m = JSON.parse(p.metadata || "{}"); return !!(m.customDirectory && m.customDirectory.trim()); } catch { return false; } })();
    let targetDir;
    if (hasCustomDir && subfolder && IO_MAP[subfolder]) {
      targetDir = join(projectDir, IO_MAP[subfolder]);
    } else {
      targetDir = subfolder ? join(projectDir, subfolder) : projectDir;
    }
    await mkdir(targetDir, { recursive: true });

    const filePath = join(targetDir, filename);
    if (data.startsWith("data:")) {
      const match = data.match(/^data:[^;]+;base64,(.+)$/);
      if (match) {
        await writeFile(filePath, Buffer.from(match[1], "base64"));
      } else {
        await writeFile(filePath, data, "utf-8");
      }
    } else if (data.startsWith("http://") || data.startsWith("https://")) {
      // Download external URL (e.g. fal.ai CDN) and save locally
      console.log(`[DB] Downloading external file: ${data.slice(0, 80)}...`);
      const response = await fetch(data);
      if (!response.ok) throw new Error(`Failed to download ${data}: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(filePath, buffer);
    } else {
      await writeFile(filePath, data, "utf-8");
    }

    console.log(`[DB] Saved project file: ${filePath}`);
    res.json({ path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Multipart file upload to project folder ─────────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

router.post("/projects/:id/upload", upload.array("files", 20), async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    const subfolder = req.body.subfolder || "uploads";
    const targetDir = join(projectDir, subfolder);
    await mkdir(targetDir, { recursive: true });

    const saved = [];
    for (const file of (req.files || [])) {
      const filePath = join(targetDir, file.originalname);
      await writeFile(filePath, file.buffer);
      saved.push({ name: file.originalname, path: filePath, size: file.size });
      console.log(`[DB] Uploaded: ${filePath} (${file.size} bytes)`);
    }

    res.json({ uploaded: saved.length, files: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List ALL files in a project directory (recursive)
router.get("/projects/:id/all-files", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    await mkdir(projectDir, { recursive: true });

    const files = [];
    async function walk(dir, prefix) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const fullPath = join(dir, e.name);
          if (e.isDirectory()) {
            await walk(fullPath, prefix ? prefix + "/" + e.name : e.name);
          } else {
            const s = await stat(fullPath).catch(() => null);
            files.push({
              name: e.name,
              folder: prefix || "",
              path: fullPath,
              size: s?.size || 0,
              modified: s?.mtime?.toISOString() || "",
              url: `/api/db/projects/${p.id}/serve-file/${encodeURIComponent(prefix ? prefix + "/" + e.name : e.name)}`,
            });
          }
        }
      } catch { /* dir doesn't exist yet */ }
    }
    await walk(projectDir, "");
    res.json({ projectDir, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve any file from the project directory
router.get("/projects/:id/serve-file/:filepath(*)", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    const filePath = join(projectDir, decodeURIComponent(req.params.filepath));

    // Security: ensure the resolved path is within the project directory
    const resolved = resolve(filePath);
    if (!resolved.startsWith(resolve(projectDir))) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { existsSync } = await import("fs");
    if (!existsSync(resolved)) return res.status(404).json({ error: "File not found" });

    res.sendFile(resolved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync project files to assets ────────────────────────────────────────────

/** Detect asset type from file extension */
function detectAssetType(filename) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(filename)) return "image";
  if (/\.(mp4|webm|mov|avi)$/i.test(filename)) return "video";
  if (/\.(docx?|xlsx?|pdf|txt|md|csv)$/i.test(filename)) return "concept";
  if (/\.(json|html)$/i.test(filename)) return "concept";
  return "concept";
}

router.post("/projects/:id/sync-assets", async (req, res) => {
  try {
    const d = getDB();
    const p = d.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const projectDir = getProjectDir(p);
    await mkdir(projectDir, { recursive: true });

    // Walk all files
    const files = [];
    async function walk(dir, prefix) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const fullPath = join(dir, e.name);
          if (e.isDirectory()) {
            await walk(fullPath, prefix ? prefix + "/" + e.name : e.name);
          } else {
            const s = await stat(fullPath).catch(() => null);
            files.push({
              name: e.name,
              folder: prefix || "",
              path: fullPath,
              size: s?.size || 0,
              url: `/api/db/projects/${p.id}/serve-file/${encodeURIComponent(prefix ? prefix + "/" + e.name : e.name)}`,
            });
          }
        }
      } catch { /* dir doesn't exist yet */ }
    }
    await walk(projectDir, "");

    // Get existing asset filePaths for this project to avoid duplicates
    const linked = d.prepare("SELECT assetId FROM project_assets WHERE projectId = ?").all(req.params.id);
    const linkedIds = new Set(linked.map(r => r.assetId));
    const existingPaths = new Set();
    for (const { assetId } of linked) {
      const asset = d.prepare("SELECT filePath FROM assets WHERE id = ?").get(assetId);
      if (asset?.filePath) existingPaths.add(asset.filePath);
    }

    let created = 0;
    for (const f of files) {
      // Skip if already registered (match by file path or name)
      const relPath = f.folder ? f.folder + "/" + f.name : f.name;
      if (existingPaths.has(relPath) || existingPaths.has(f.path) || existingPaths.has(f.name)) continue;

      // Also check by name+type to avoid duplicates
      const type = detectAssetType(f.name);
      const existing = d.prepare("SELECT id FROM assets WHERE name = ? AND type = ? AND filePath = ?").get(f.name, type, relPath);
      if (existing) {
        // Link if not linked
        if (!linkedIds.has(existing.id)) {
          d.prepare("INSERT OR IGNORE INTO project_assets (projectId, assetId, assetType, linkedAt) VALUES (?, ?, ?, ?)").run(req.params.id, existing.id, type, now());
        }
        continue;
      }

      const id = newId();
      const folderTag = f.folder.split("/")[0] || "output";
      d.prepare(`INSERT INTO assets (id, type, name, description, thumbnail, filePath, createdAt, tags, metadata, referenceImages)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, type, f.name, "",
        type === "image" ? f.url : "",
        relPath, now(),
        JSON.stringify([folderTag, type]),
        JSON.stringify({ source: "sync", size: String(f.size), project: p.name }),
        "[]"
      );
      d.prepare("INSERT OR IGNORE INTO project_assets (projectId, assetId, assetType, linkedAt) VALUES (?, ?, ?, ?)").run(req.params.id, id, type, now());
      created++;
    }

    d.prepare("UPDATE projects SET updatedAt = ? WHERE id = ?").run(now(), req.params.id);
    res.json({ ok: true, filesScanned: files.length, assetsCreated: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generic asset CRUD (characters, scenery, clothing) ──────────────────────

function assetRoutes(typeName) {
  router.get(`/${typeName}`, (_req, res) => {
    try {
      const rows = getDB().prepare("SELECT * FROM assets WHERE type = ? ORDER BY createdAt DESC").all(typeName.replace(/s$/, "").replace("ry", "ry"));
      res.json(rows.map(assetRow));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post(`/${typeName}`, (req, res) => {
    try {
      const d = getDB();
      const id = newId();
      const type = typeName === "scenery" ? "scenery" : typeName.replace(/s$/, "");
      d.prepare(`INSERT INTO assets (id, type, name, description, thumbnail, filePath, createdAt, tags, metadata, referenceImages)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, type,
        req.body.name || "Unnamed",
        req.body.description || "",
        req.body.thumbnail || "",
        req.body.filePath || "",
        now(),
        JSON.stringify(req.body.tags || []),
        JSON.stringify(req.body.metadata || {}),
        JSON.stringify(req.body.referenceImages || [])
      );
      const row = d.prepare("SELECT * FROM assets WHERE id = ?").get(id);
      res.json(assetRow(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch(`/${typeName}/:id`, (req, res) => {
    try {
      const d = getDB();
      const existing = d.prepare("SELECT * FROM assets WHERE id = ?").get(req.params.id);
      if (!existing) return res.status(404).json({ error: `${typeName} not found` });

      const fields = { name: "name", description: "description", thumbnail: "thumbnail", filePath: "filePath" };
      const jsonFields = { tags: "tags", metadata: "metadata", referenceImages: "referenceImages" };
      const updates = [];
      const values = [];

      for (const [bodyKey, col] of Object.entries(fields)) {
        if (req.body[bodyKey] !== undefined) { updates.push(`${col} = ?`); values.push(req.body[bodyKey]); }
      }
      for (const [bodyKey, col] of Object.entries(jsonFields)) {
        if (req.body[bodyKey] !== undefined) { updates.push(`${col} = ?`); values.push(JSON.stringify(req.body[bodyKey])); }
      }

      if (updates.length > 0) {
        values.push(req.params.id);
        d.prepare(`UPDATE assets SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      }

      const row = d.prepare("SELECT * FROM assets WHERE id = ?").get(req.params.id);
      res.json(assetRow(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete(`/${typeName}/:id`, (req, res) => {
    try {
      getDB().prepare("DELETE FROM assets WHERE id = ?").run(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

assetRoutes("characters");
assetRoutes("scenery");
assetRoutes("clothing");

// ─── Generic assets endpoint (for image, video, concept types) ──────────────
router.get("/assets", (_req, res) => {
  try {
    const rows = getDB().prepare("SELECT * FROM assets ORDER BY createdAt DESC").all();
    res.json(rows.map(assetRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/assets", (req, res) => {
  try {
    const d = getDB();
    const id = req.body.id || newId();
    d.prepare(`INSERT INTO assets (id, type, name, description, thumbnail, filePath, createdAt, tags, metadata, referenceImages)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      req.body.type || "image",
      req.body.name || "Unnamed",
      req.body.description || "",
      req.body.thumbnail || "",
      req.body.filePath || "",
      now(),
      JSON.stringify(req.body.tags || []),
      JSON.stringify(req.body.metadata || {}),
      JSON.stringify(req.body.referenceImages || [])
    );
    const row = d.prepare("SELECT * FROM assets WHERE id = ?").get(id);
    res.json(assetRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/assets/:id", (req, res) => {
  try {
    getDB().prepare("DELETE FROM assets WHERE id = ?").run(req.params.id);
    getDB().prepare("DELETE FROM project_assets WHERE assetId = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Init ────────────────────────────────────────────────────────────────────

ensureAssetFolders().then(() => {
  getDB();
  console.log(`[DB] SQLite ready: ${DB_PATH}`);

  // Migrate JSON data if db.json exists and SQLite is empty
  import("fs").then(({ existsSync, readFileSync }) => {
    const jsonPath = join(ASSETS_ROOT, "db.json");
    if (!existsSync(jsonPath)) return;
    const d = getDB();
    const count = d.prepare("SELECT COUNT(*) as c FROM projects").get().c;
    if (count > 0) return;

    try {
      const json = JSON.parse(readFileSync(jsonPath, "utf-8"));
      const insertProject = d.prepare(`INSERT OR IGNORE INTO projects (id, name, slug, status, brandId, description, createdAt, updatedAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const insertAsset = d.prepare(`INSERT OR IGNORE INTO assets (id, type, name, description, thumbnail, filePath, createdAt, tags, metadata, referenceImages) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const insertLink = d.prepare(`INSERT OR IGNORE INTO project_assets (projectId, assetId, assetType, linkedAt) VALUES (?, ?, ?, ?)`);

      const migrate = d.transaction(() => {
        for (const p of json.projects || []) {
          insertProject.run(p.id, p.name, p.slug || slugify(p.name), p.status || "active", p.brandId || "", p.description || "", p.createdAt || now(), p.updatedAt || now(), p.notes || "");
          for (const type of ["character", "scenery", "clothing", "concept", "image", "video"]) {
            for (const aid of p[`${type}Ids`] || []) {
              insertLink.run(p.id, aid, type, now());
            }
          }
        }
        for (const list of [json.characters, json.scenery, json.clothing, json.assets]) {
          for (const a of list || []) {
            insertAsset.run(a.id, a.type || "character", a.name || "Unnamed", a.description || "", a.thumbnail || "", a.filePath || "", a.createdAt || now(), JSON.stringify(a.tags || []), JSON.stringify(a.metadata || {}), JSON.stringify(a.referenceImages || []));
          }
        }
      });
      migrate();
      console.log("[DB] Migrated JSON data to SQLite");
    } catch (e) {
      console.warn("[DB] JSON migration skipped:", e.message);
    }
  });
});

export default router;
