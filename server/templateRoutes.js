/**
 * Tensorax Studio — Template CRUD REST API
 *
 * Manages built-in + custom pipeline templates stored in SQLite.
 * Built-in templates are read-only; custom templates support full CRUD.
 *
 * Mounted at /api/templates by server/index.js.
 */

import { Router } from "express";
import Database from "better-sqlite3";
import { resolve, join } from "path";
import { mkdir } from "fs/promises";

const router = Router();

const ASSETS_ROOT = resolve(process.cwd(), "assets");
const DB_PATH = join(ASSETS_ROOT, "tensorax.db");

// ─── Database ────────────────────────────────────────────────────────────────

let db;

/**
 * Get or initialise the SQLite database connection and ensure the templates table exists.
 * @returns {import("better-sqlite3").Database}
 */
function getDB() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      config     TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

// ─── Built-in template definitions ───────────────────────────────────────────

/**
 * The 5 built-in templates shipped with Tensorax Studio.
 * These are read-only and always merged into list responses.
 */
const BUILT_IN_TEMPLATES = [
  {
    id: "what-if-transformation",
    name: "What If? Transformation",
    description: "Create viral 'what if' transformation videos that reimagine products, spaces, or people with AI-powered before/after visuals.",
    icon: "fa-wand-magic-sparkles",
    category: "marketing",
    builtIn: true,
    teams: [
      { teamId: "research", label: "Research", agents: ["audience-research", "trend-analysis"], activationMode: "auto" },
      { teamId: "concept", label: "Concept", agents: ["concept-from-brief", "screenplay"], activationMode: "auto" },
      { teamId: "character", label: "Character", agents: ["character-analysis", "character-frames"], activationMode: "auto" },
      { teamId: "video", label: "Video", agents: ["video-generation"], activationMode: "auto" },
      { teamId: "editing", label: "Editing", agents: ["voiceover", "music-selection"], activationMode: "manual" },
      { teamId: "distribution", label: "Distribution", agents: ["posting-packages", "scheduling"], activationMode: "manual" },
    ],
    steps: [
      { id: "research", name: "Audience & Trend Research", agent: "audience-research", status: "pending", requiresReview: false },
      { id: "concept", name: "Concept Generation", agent: "concept-from-brief", status: "pending", requiresReview: true },
      { id: "screenplay", name: "Screenplay Writing", agent: "screenplay", status: "pending", requiresReview: true },
      { id: "characters", name: "Character Design", agent: "character-analysis", status: "pending", requiresReview: true },
      { id: "frames", name: "Keyframe Generation", agent: "character-frames", status: "pending", requiresReview: true },
      { id: "video", name: "Video Generation", agent: "video-generation", status: "pending", requiresReview: false },
      { id: "editing", name: "Post-Production", agent: "voiceover", status: "pending", requiresReview: true },
      { id: "distribution", name: "Distribution Setup", agent: "posting-packages", status: "pending", requiresReview: true },
    ],
  },
  {
    id: "video-from-keyframes",
    name: "Video from Keyframes",
    description: "Turn a set of keyframe images into a polished video with transitions, voiceover, and music.",
    icon: "fa-film",
    category: "production",
    builtIn: true,
    teams: [
      { teamId: "character", label: "Character", agents: ["character-analysis"], activationMode: "auto" },
      { teamId: "video", label: "Video", agents: ["video-generation"], activationMode: "auto" },
      { teamId: "editing", label: "Editing", agents: ["voiceover", "music-selection"], activationMode: "auto" },
    ],
    steps: [
      { id: "analysis", name: "Keyframe Analysis", agent: "character-analysis", status: "pending", requiresReview: true },
      { id: "video", name: "Video Generation", agent: "video-generation", status: "pending", requiresReview: false },
      { id: "editing", name: "Post-Production", agent: "voiceover", status: "pending", requiresReview: true },
    ],
  },
  {
    id: "staff-training-video",
    name: "Staff Training Video",
    description: "Generate training videos for retail staff covering procedures, product knowledge, or customer service scenarios.",
    icon: "fa-graduation-cap",
    category: "training",
    builtIn: true,
    teams: [
      { teamId: "research", label: "Research", agents: ["audience-research"], activationMode: "auto" },
      { teamId: "concept", label: "Concept", agents: ["concept-from-brief", "screenplay"], activationMode: "auto" },
      { teamId: "character", label: "Character", agents: ["character-analysis", "character-frames"], activationMode: "auto" },
      { teamId: "video", label: "Video", agents: ["video-generation"], activationMode: "auto" },
      { teamId: "editing", label: "Editing", agents: ["voiceover"], activationMode: "auto" },
    ],
    steps: [
      { id: "research", name: "Training Needs Analysis", agent: "audience-research", status: "pending", requiresReview: true },
      { id: "concept", name: "Training Concept", agent: "concept-from-brief", status: "pending", requiresReview: true },
      { id: "screenplay", name: "Training Script", agent: "screenplay", status: "pending", requiresReview: true },
      { id: "characters", name: "Character Setup", agent: "character-analysis", status: "pending", requiresReview: true },
      { id: "frames", name: "Scene Keyframes", agent: "character-frames", status: "pending", requiresReview: true },
      { id: "video", name: "Video Generation", agent: "video-generation", status: "pending", requiresReview: false },
      { id: "voiceover", name: "Voiceover & Narration", agent: "voiceover", status: "pending", requiresReview: true },
    ],
  },
  {
    id: "product-marketing-campaign",
    name: "Product Marketing Campaign",
    description: "End-to-end marketing campaign: from research and concept through video production to multi-platform distribution.",
    icon: "fa-bullhorn",
    category: "marketing",
    builtIn: true,
    teams: [
      { teamId: "research", label: "Research", agents: ["audience-research", "trend-analysis"], activationMode: "auto" },
      { teamId: "concept", label: "Concept", agents: ["concept-from-brief", "screenplay"], activationMode: "auto" },
      { teamId: "character", label: "Character", agents: ["character-analysis", "character-frames"], activationMode: "auto" },
      { teamId: "video", label: "Video", agents: ["video-generation"], activationMode: "auto" },
      { teamId: "editing", label: "Editing", agents: ["voiceover", "music-selection"], activationMode: "auto" },
      { teamId: "distribution", label: "Distribution", agents: ["posting-packages", "scheduling"], activationMode: "auto" },
    ],
    steps: [
      { id: "research", name: "Market Research", agent: "audience-research", status: "pending", requiresReview: true },
      { id: "trends", name: "Trend Analysis", agent: "trend-analysis", status: "pending", requiresReview: false },
      { id: "concept", name: "Campaign Concept", agent: "concept-from-brief", status: "pending", requiresReview: true },
      { id: "screenplay", name: "Video Script", agent: "screenplay", status: "pending", requiresReview: true },
      { id: "characters", name: "Character & Visual Design", agent: "character-analysis", status: "pending", requiresReview: true },
      { id: "frames", name: "Storyboard Keyframes", agent: "character-frames", status: "pending", requiresReview: true },
      { id: "video", name: "Video Production", agent: "video-generation", status: "pending", requiresReview: false },
      { id: "editing", name: "Post-Production", agent: "voiceover", status: "pending", requiresReview: true },
      { id: "posting", name: "Platform Posting Packages", agent: "posting-packages", status: "pending", requiresReview: true },
      { id: "scheduling", name: "Publish Schedule", agent: "scheduling", status: "pending", requiresReview: true },
    ],
  },
  {
    id: "live-shopping-channel",
    name: "Live Shopping Channel",
    description: "Set up a virtual presenter-led live shopping experience with product showcases, scripts, and streaming assets.",
    icon: "fa-cart-shopping",
    category: "commerce",
    builtIn: true,
    teams: [
      { teamId: "research", label: "Research", agents: ["audience-research"], activationMode: "auto" },
      { teamId: "concept", label: "Concept", agents: ["concept-from-brief", "screenplay"], activationMode: "auto" },
      { teamId: "character", label: "Character", agents: ["character-analysis", "character-frames"], activationMode: "auto" },
      { teamId: "video", label: "Video", agents: ["video-generation"], activationMode: "auto" },
      { teamId: "editing", label: "Editing", agents: ["voiceover"], activationMode: "auto" },
      { teamId: "distribution", label: "Distribution", agents: ["posting-packages"], activationMode: "manual" },
    ],
    steps: [
      { id: "research", name: "Audience & Product Research", agent: "audience-research", status: "pending", requiresReview: true },
      { id: "concept", name: "Show Concept", agent: "concept-from-brief", status: "pending", requiresReview: true },
      { id: "screenplay", name: "Show Script & Run Sheet", agent: "screenplay", status: "pending", requiresReview: true },
      { id: "presenter", name: "Virtual Presenter Design", agent: "character-analysis", status: "pending", requiresReview: true },
      { id: "frames", name: "Show Visuals & Overlays", agent: "character-frames", status: "pending", requiresReview: true },
      { id: "video", name: "Pre-roll & Segment Generation", agent: "video-generation", status: "pending", requiresReview: false },
      { id: "voiceover", name: "Presenter Voiceover", agent: "voiceover", status: "pending", requiresReview: true },
    ],
  },
];

/** Set of built-in template IDs for quick lookups. */
const BUILT_IN_IDS = new Set(BUILT_IN_TEMPLATES.map((t) => t.id));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

/**
 * Parse a custom template row from SQLite into the API response shape.
 * @param {object} row - SQLite row with id, name, config, created_at, updated_at
 * @returns {object} Merged template object
 */
function parseCustomRow(row) {
  if (!row) return null;
  try {
    const config = JSON.parse(row.config);
    return {
      ...config,
      id: row.id,
      name: row.name,
      builtIn: false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch {
    return {
      id: row.id,
      name: row.name,
      builtIn: false,
      config: row.config,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

/**
 * Validate that a template ID is kebab-case and non-empty.
 * @param {string} id
 * @returns {boolean}
 */
function isValidId(id) {
  return typeof id === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/templates
 * List all templates (built-in + custom from SQLite).
 */
router.get("/", (_req, res) => {
  try {
    const d = getDB();
    const customRows = d.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
    const customs = customRows.map(parseCustomRow).filter(Boolean);
    const all = [...BUILT_IN_TEMPLATES, ...customs];
    res.json({ success: true, data: all });
  } catch (err) {
    console.error("[Templates] List error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/templates/:id
 * Get a single template by ID.
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;

    // Check built-in first
    const builtIn = BUILT_IN_TEMPLATES.find((t) => t.id === id);
    if (builtIn) {
      return res.json({ success: true, data: builtIn });
    }

    // Check custom
    const d = getDB();
    const row = d.prepare("SELECT * FROM templates WHERE id = ?").get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    res.json({ success: true, data: parseCustomRow(row) });
  } catch (err) {
    console.error("[Templates] Get error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/templates
 * Create a new custom template.
 * Body: { id, name, ...rest of TemplateConfig }
 */
router.post("/", (req, res) => {
  try {
    const { id, name, ...rest } = req.body;

    if (!id || !name) {
      return res.status(400).json({ success: false, error: "Missing required fields: id, name" });
    }
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, error: "Template ID must be kebab-case (e.g. 'my-template')" });
    }
    if (BUILT_IN_IDS.has(id)) {
      return res.status(409).json({ success: false, error: "Cannot create a template with a built-in template ID" });
    }

    const d = getDB();
    const existing = d.prepare("SELECT id FROM templates WHERE id = ?").get(id);
    if (existing) {
      return res.status(409).json({ success: false, error: "A custom template with this ID already exists" });
    }

    const config = JSON.stringify({ id, name, ...rest });
    const ts = now();
    d.prepare("INSERT INTO templates (id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, name, config, ts, ts);

    const row = d.prepare("SELECT * FROM templates WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: parseCustomRow(row) });
  } catch (err) {
    console.error("[Templates] Create error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/templates/:id
 * Update a custom template. Built-in templates cannot be updated.
 * Body: { name?, ...rest of TemplateConfig }
 */
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;

    if (BUILT_IN_IDS.has(id)) {
      return res.status(400).json({ success: false, error: "Built-in templates are read-only" });
    }

    const d = getDB();
    const existing = d.prepare("SELECT * FROM templates WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }

    const name = req.body.name || existing.name;
    const config = JSON.stringify({ id, name, ...req.body });
    const ts = now();

    d.prepare("UPDATE templates SET name = ?, config = ?, updated_at = ? WHERE id = ?").run(name, config, ts, id);

    const row = d.prepare("SELECT * FROM templates WHERE id = ?").get(id);
    res.json({ success: true, data: parseCustomRow(row) });
  } catch (err) {
    console.error("[Templates] Update error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a custom template. Built-in templates cannot be deleted.
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;

    if (BUILT_IN_IDS.has(id)) {
      return res.status(400).json({ success: false, error: "Built-in templates are read-only" });
    }

    const d = getDB();
    const existing = d.prepare("SELECT id FROM templates WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }

    d.prepare("DELETE FROM templates WHERE id = ?").run(id);
    res.json({ success: true, data: { id, deleted: true } });
  } catch (err) {
    console.error("[Templates] Delete error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/templates/:id/duplicate
 * Duplicate any template (built-in or custom) as a new custom template.
 * Body: { newId?, newName? }
 */
router.post("/:id/duplicate", (req, res) => {
  try {
    const { id } = req.params;
    let source = null;

    // Find source template
    const builtIn = BUILT_IN_TEMPLATES.find((t) => t.id === id);
    if (builtIn) {
      source = { ...builtIn };
    } else {
      const d = getDB();
      const row = d.prepare("SELECT * FROM templates WHERE id = ?").get(id);
      if (row) {
        source = parseCustomRow(row);
      }
    }

    if (!source) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }

    const newId = req.body.newId || `${id}-copy-${Date.now().toString(36)}`;
    const newName = req.body.newName || `${source.name} (Copy)`;

    if (!isValidId(newId)) {
      return res.status(400).json({ success: false, error: "New template ID must be kebab-case" });
    }

    const d = getDB();
    if (BUILT_IN_IDS.has(newId) || d.prepare("SELECT id FROM templates WHERE id = ?").get(newId)) {
      return res.status(409).json({ success: false, error: "A template with this ID already exists" });
    }

    // Strip metadata that shouldn't carry over
    const { created_at, updated_at, builtIn: _bi, ...rest } = source;
    const config = JSON.stringify({ ...rest, id: newId, name: newName, builtIn: false });
    const ts = now();

    d.prepare("INSERT INTO templates (id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(newId, newName, config, ts, ts);

    const row = d.prepare("SELECT * FROM templates WHERE id = ?").get(newId);
    res.status(201).json({ success: true, data: parseCustomRow(row) });
  } catch (err) {
    console.error("[Templates] Duplicate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/templates/import
 * Import a template from a JSON payload.
 * Body: full TemplateConfig JSON object (must include id and name).
 */
router.post("/import", (req, res) => {
  try {
    const templateData = req.body;

    if (!templateData || !templateData.id || !templateData.name) {
      return res.status(400).json({ success: false, error: "Invalid template data: must include id and name" });
    }

    if (!isValidId(templateData.id)) {
      return res.status(400).json({ success: false, error: "Template ID must be kebab-case" });
    }

    if (BUILT_IN_IDS.has(templateData.id)) {
      return res.status(409).json({ success: false, error: "Cannot import a template with a built-in template ID" });
    }

    const d = getDB();
    const existing = d.prepare("SELECT id FROM templates WHERE id = ?").get(templateData.id);
    if (existing) {
      return res.status(409).json({ success: false, error: "A custom template with this ID already exists" });
    }

    const config = JSON.stringify({ ...templateData, builtIn: false });
    const ts = now();
    d.prepare("INSERT INTO templates (id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      templateData.id,
      templateData.name,
      config,
      ts,
      ts
    );

    const row = d.prepare("SELECT * FROM templates WHERE id = ?").get(templateData.id);
    res.status(201).json({ success: true, data: parseCustomRow(row) });
  } catch (err) {
    console.error("[Templates] Import error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/templates/:id/export
 * Export a template as JSON (works for both built-in and custom).
 */
router.get("/:id/export", (req, res) => {
  try {
    const { id } = req.params;

    // Check built-in first
    const builtIn = BUILT_IN_TEMPLATES.find((t) => t.id === id);
    if (builtIn) {
      return res.json({ success: true, data: builtIn });
    }

    // Check custom
    const d = getDB();
    const row = d.prepare("SELECT * FROM templates WHERE id = ?").get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }

    res.json({ success: true, data: parseCustomRow(row) });
  } catch (err) {
    console.error("[Templates] Export error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Init ────────────────────────────────────────────────────────────────────

// Ensure DB is initialised on import
mkdir(ASSETS_ROOT, { recursive: true }).then(() => {
  getDB();
  console.log("[Templates] Router ready");
});

export default router;
