/**
 * gammaApi.js — Thin proxy for Gamma REST API v1.0
 *
 * Gamma's API doesn't support browser CORS, so we proxy through Express.
 * The client sends the API key in the request body; we forward it as X-API-KEY.
 */

import { Router } from "express";

const router = Router();
const GAMMA_BASE = "https://public-api.gamma.app/v1.0";

// ─── POST /api/gamma/generate ───────────────────────────────────────────────
// Create a new generation job
router.post("/generate", async (req, res) => {
  try {
    const { apiKey, ...params } = req.body;
    if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

    const response = await fetch(`${GAMMA_BASE}/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error("[Gamma] generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/gamma/generations/:id ─────────────────────────────────────────
// Poll generation status
router.get("/generations/:id", async (req, res) => {
  try {
    const apiKey = req.headers["x-gamma-key"] || req.query.apiKey;
    if (!apiKey) return res.status(400).json({ error: "apiKey is required (header x-gamma-key or query param)" });

    const response = await fetch(`${GAMMA_BASE}/generations/${req.params.id}`, {
      headers: { "X-API-KEY": String(apiKey) },
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error("[Gamma] poll error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/gamma/themes ──────────────────────────────────────────────────
// List available themes
router.get("/themes", async (req, res) => {
  try {
    const apiKey = req.headers["x-gamma-key"] || req.query.apiKey;
    if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

    const response = await fetch(`${GAMMA_BASE}/themes`, {
      headers: { "X-API-KEY": String(apiKey) },
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error("[Gamma] themes error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/gamma/folders ─────────────────────────────────────────────────
// List folders
router.get("/folders", async (req, res) => {
  try {
    const apiKey = req.headers["x-gamma-key"] || req.query.apiKey;
    if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

    const response = await fetch(`${GAMMA_BASE}/folders`, {
      headers: { "X-API-KEY": String(apiKey) },
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error("[Gamma] folders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
