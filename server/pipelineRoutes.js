/**
 * Tensorax Studio — Pipeline Execution Tracking REST API
 *
 * Tracks pipeline runs (which template was executed, per-step status,
 * project context snapshots). All state persisted in SQLite.
 *
 * Mounted at /api/pipeline by server/index.js.
 */

import { Router } from "express";
import Database from "better-sqlite3";
import { resolve, join } from "path";
import { mkdir } from "fs/promises";
import { randomUUID } from "crypto";

const router = Router();

const ASSETS_ROOT = resolve(process.cwd(), "assets");
const DB_PATH = join(ASSETS_ROOT, "tensorax.db");

// ─── Database ────────────────────────────────────────────────────────────────

let db;

/**
 * Get or initialise the SQLite database connection and ensure the pipeline_runs table exists.
 * @returns {import("better-sqlite3").Database}
 */
function getDB() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL,
      template_id TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'running',
      steps       TEXT NOT NULL DEFAULT '[]',
      context     TEXT NOT NULL DEFAULT '{}',
      started_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_project ON pipeline_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_template ON pipeline_runs(template_id);
  `);

  return db;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

/** Valid pipeline run statuses. */
const VALID_RUN_STATUSES = new Set(["running", "paused", "completed", "failed"]);

/** Valid step statuses. */
const VALID_STEP_STATUSES = new Set(["pending", "running", "paused", "completed", "failed", "skipped"]);

/**
 * Parse a pipeline_runs row into the API response shape.
 * @param {object} row - SQLite row
 * @returns {object} Parsed run object
 */
function parseRunRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    templateId: row.template_id,
    status: row.status,
    steps: safeParseJSON(row.steps, []),
    context: safeParseJSON(row.context, {}),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Safely parse a JSON string, returning a fallback on failure.
 * @param {string} str
 * @param {*} fallback
 * @returns {*}
 */
function safeParseJSON(str, fallback) {
  try {
    return JSON.parse(str || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/pipeline/start
 * Start a new pipeline execution run.
 * Body: { projectId, templateId, steps?, context? }
 */
router.post("/start", (req, res) => {
  try {
    const { projectId, templateId, steps, context } = req.body;

    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid projectId" });
    }
    if (!templateId || typeof templateId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid templateId" });
    }

    const d = getDB();
    const id = randomUUID();
    const ts = now();

    // If steps are provided, use them; otherwise start with an empty array
    // (the frontend will populate steps as they begin).
    const stepsJSON = JSON.stringify(
      Array.isArray(steps)
        ? steps.map((s) => ({
            id: s.id || s.stepId,
            name: s.name || s.id || s.stepId,
            status: s.status || "pending",
            output: s.output || null,
            error: s.error || null,
          }))
        : []
    );

    const contextJSON = JSON.stringify(context || {});

    d.prepare(
      "INSERT INTO pipeline_runs (id, project_id, template_id, status, steps, context, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, projectId, templateId, "running", stepsJSON, contextJSON, ts, ts);

    const row = d.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: parseRunRow(row) });
  } catch (err) {
    console.error("[Pipeline] Start error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/pipeline/:runId
 * Get a pipeline run's current status and step details.
 */
router.get("/:runId", (req, res) => {
  try {
    const d = getDB();
    const row = d.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(req.params.runId);
    if (!row) {
      return res.status(404).json({ success: false, error: "Pipeline run not found" });
    }
    res.json({ success: true, data: parseRunRow(row) });
  } catch (err) {
    console.error("[Pipeline] Get error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/pipeline/:runId/step
 * Update a single step's status within a pipeline run.
 * Body: { stepId, status, output?, error? }
 *
 * Also auto-updates the overall run status:
 * - If any step is 'failed' and run was 'running' → run becomes 'failed'
 * - If all steps are 'completed' or 'skipped' → run becomes 'completed'
 * - If any step is 'paused' → run becomes 'paused'
 */
router.put("/:runId/step", (req, res) => {
  try {
    const { stepId, status, output, error: stepError } = req.body;

    if (!stepId || typeof stepId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid stepId" });
    }
    if (!status || !VALID_STEP_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid step status. Must be one of: ${[...VALID_STEP_STATUSES].join(", ")}`,
      });
    }

    const d = getDB();
    const row = d.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(req.params.runId);
    if (!row) {
      return res.status(404).json({ success: false, error: "Pipeline run not found" });
    }

    const steps = safeParseJSON(row.steps, []);
    const stepIndex = steps.findIndex((s) => s.id === stepId);

    if (stepIndex === -1) {
      // Step not found in array — add it
      steps.push({
        id: stepId,
        name: stepId,
        status,
        output: output || null,
        error: stepError || null,
      });
    } else {
      steps[stepIndex].status = status;
      if (output !== undefined) steps[stepIndex].output = output;
      if (stepError !== undefined) steps[stepIndex].error = stepError;
    }

    // Auto-derive run status from step statuses
    let runStatus = row.status;
    const allStatuses = steps.map((s) => s.status);

    if (allStatuses.includes("failed") && runStatus === "running") {
      runStatus = "failed";
    } else if (allStatuses.length > 0 && allStatuses.every((s) => s === "completed" || s === "skipped")) {
      runStatus = "completed";
    } else if (allStatuses.includes("paused")) {
      runStatus = "paused";
    } else if (allStatuses.includes("running")) {
      runStatus = "running";
    }

    const ts = now();
    d.prepare("UPDATE pipeline_runs SET steps = ?, status = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(steps),
      runStatus,
      ts,
      req.params.runId
    );

    const updated = d.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(req.params.runId);
    res.json({ success: true, data: parseRunRow(updated) });
  } catch (err) {
    console.error("[Pipeline] Step update error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/pipeline/project/:projectId
 * List all pipeline runs for a given project, most recent first.
 */
router.get("/project/:projectId", (req, res) => {
  try {
    const d = getDB();
    const rows = d
      .prepare("SELECT * FROM pipeline_runs WHERE project_id = ? ORDER BY started_at DESC")
      .all(req.params.projectId);
    res.json({ success: true, data: rows.map(parseRunRow) });
  } catch (err) {
    console.error("[Pipeline] Project runs error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Init ────────────────────────────────────────────────────────────────────

mkdir(ASSETS_ROOT, { recursive: true }).then(() => {
  getDB();
  console.log("[Pipeline] Router ready");
});

export default router;
