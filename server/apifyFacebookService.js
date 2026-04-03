/**
 * Apify Facebook Service
 *
 * Scrapes Facebook page/profile data (posts, engagement, media) via the
 * Apify Facebook Posts Scraper (apify/facebook-posts-scraper) and returns
 * structured data for dashboard generation and analysis.
 *
 * Actor ID: KoJrdxJCTtpon81KY
 */

import { Router } from "express";

const router = Router();

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "KoJrdxJCTtpon81KY"; // apify/facebook-posts-scraper

function getToken() {
  return process.env.APIFY_API_TOKEN || "";
}

// ─── Start a Facebook scrape run ────────────────────────────────────────────

async function startScrape({
  startUrls = [],
  resultsLimit = 50,
  activeFilter = "all",       // "all", "last24h", "last7d", "last30d", "custom"
  startDate = "",
  endDate = "",
} = {}) {
  const token = getToken();
  if (!token) throw new Error("APIFY_API_TOKEN not set");

  const input = {
    startUrls: startUrls.map(u => typeof u === "string" ? { url: u } : u),
    resultsLimit,
  };

  // Date filtering
  if (activeFilter === "custom" && startDate) {
    input.onlyPostsNewerThan = startDate; // ISO date string
  } else if (activeFilter === "last24h") {
    input.onlyPostsNewerThan = new Date(Date.now() - 86400000).toISOString();
  } else if (activeFilter === "last7d") {
    input.onlyPostsNewerThan = new Date(Date.now() - 7 * 86400000).toISOString();
  } else if (activeFilter === "last30d") {
    input.onlyPostsNewerThan = new Date(Date.now() - 30 * 86400000).toISOString();
  }

  const res = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apify start failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    runId: data.data.id,
    status: data.data.status,
    datasetId: data.data.defaultDatasetId,
    startedAt: data.data.startedAt,
  };
}

// ─── Poll run status ─────────────────────────────────────────────────────

async function getRunStatus(runId) {
  const token = getToken();
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
  if (!res.ok) throw new Error(`Apify status check failed: ${res.status}`);
  const data = await res.json();
  return {
    status: data.data.status,
    datasetId: data.data.defaultDatasetId,
    finishedAt: data.data.finishedAt,
    usageTotalUsd: data.data.usageTotalUsd,
  };
}

// ─── Wait for run to complete (poll every 5s, max 5 min) ─────────────────

async function waitForRun(runId, maxWaitMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const status = await getRunStatus(runId);
    if (status.status === "SUCCEEDED") return status;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status.status)) {
      throw new Error(`Apify run ${status.status}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Apify run timed out after 5 minutes");
}

// ─── Fetch results from a completed run ──────────────────────────────────

async function getResults(datasetId, { limit = 200, offset = 0 } = {}) {
  const token = getToken();
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=${limit}&offset=${offset}&format=json`
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`);
  return res.json();
}

// ─── Extract key fields for analysis ─────────────────────────────────────

function extractPostData(item) {
  const media = item.media || [];
  const firstMedia = media[0] || {};

  return {
    id: item.postId || item.facebookId,
    url: item.url || item.topLevelUrl,
    facebookUrl: item.facebookUrl,
    text: item.text || "",
    createdAt: item.time,
    timestamp: item.timestamp,
    // Engagement
    likes: item.likes || 0,
    comments: item.comments || 0,
    shares: item.shares || 0,
    views: item.viewsCount || 0,
    topReactionsCount: item.topReactionsCount || 0,
    // Reaction breakdown
    reactionLike: item.reactionLikeCount || 0,
    reactionHaha: item.reactionHahaCount || 0,
    reactionLove: item.reactionLoveCount || 0,
    reactionWow: item.reactionWowCount || 0,
    reactionSad: item.reactionSadCount || 0,
    reactionAngry: item.reactionAngryCount || 0,
    engagementRate: item.viewsCount > 0
      ? (((item.likes || 0) + (item.shares || 0) + (item.comments || 0)) / item.viewsCount * 100).toFixed(2) + "%"
      : "0%",
    // Media
    isVideo: !!item.isVideo,
    thumbnailUrl: firstMedia.thumbnail || "",
    mediaCount: media.length,
    media: media.map(m => ({
      thumbnail: m.thumbnail || "",
      photoUrl: m.photo || "",
      photoUrlHD: m.photo_image?.uri || "",
      videoUrl: m.video || "",
    })),
    // Author
    author: {
      name: item.user?.name || item.pageName || "",
      profileUrl: item.user?.profileUrl || item.facebookUrl || "",
      id: item.user?.id || item.facebookId || "",
    },
    // Content metadata
    hashtags: extractHashtags(item.text || ""),
    textReferences: (item.textReferences || []).map(r => r.url).filter(Boolean),
    collaborators: item.collaborators || [],
  };
}

function extractHashtags(text) {
  const matches = text.match(/#[\wа-яА-ЯёЁ]+/gu) || [];
  return matches.map(h => h.replace("#", ""));
}

// ─── High-level: scrape and return structured data ───────────────────────

async function scrapeAndAnalyse(opts) {
  console.log("[Apify Facebook] Starting scrape...", opts);
  const run = await startScrape(opts);
  console.log(`[Apify Facebook] Run started: ${run.runId}`);

  const completed = await waitForRun(run.runId);
  console.log(`[Apify Facebook] Run completed. Cost: $${completed.usageTotalUsd}`);

  const rawResults = await getResults(completed.datasetId, { limit: opts.resultsLimit || 50 });
  const posts = rawResults.map(extractPostData);

  // Derive page info from the first post
  const pageInfo = posts.length > 0 ? {
    name: posts[0].author.name,
    profileUrl: posts[0].facebookUrl,
    id: posts[0].author.id,
  } : {};

  console.log(`[Apify Facebook] Got ${posts.length} posts`);
  return {
    platform: "facebook",
    runId: run.runId,
    cost: completed.usageTotalUsd,
    postCount: posts.length,
    pageInfo,
    posts,
    thumbnailUrls: posts.map(p => p.thumbnailUrl).filter(Boolean),
  };
}

// ─── API Endpoints ───────────────────────────────────────────────────────

// POST /api/facebook/scrape — start a scrape and return results (sync)
router.post("/scrape", async (req, res) => {
  try {
    const result = await scrapeAndAnalyse(req.body);
    res.json(result);
  } catch (err) {
    console.error("[Apify Facebook] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/facebook/scrape-async — start a scrape, return run ID immediately
router.post("/scrape-async", async (req, res) => {
  try {
    const run = await startScrape(req.body);
    res.json(run);
  } catch (err) {
    console.error("[Apify Facebook] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/facebook/status/:runId — check run status
router.get("/status/:runId", async (req, res) => {
  try {
    const status = await getRunStatus(req.params.runId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/facebook/results/:datasetId — fetch results from completed run
router.get("/results/:datasetId", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const offset = parseInt(req.query.offset) || 0;
    const rawResults = await getResults(req.params.datasetId, { limit, offset });
    const posts = rawResults.map(extractPostData);
    res.json({ postCount: posts.length, posts, thumbnailUrls: posts.map(p => p.thumbnailUrl).filter(Boolean) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/facebook/quick-page/:pageId — scrape a single page (50 posts)
router.get("/quick-page/:pageId", async (req, res) => {
  try {
    const pageId = req.params.pageId;
    // Support both numeric IDs and page slugs
    const url = /^\d+$/.test(pageId)
      ? `https://www.facebook.com/profile.php?id=${pageId}`
      : `https://www.facebook.com/${pageId}`;
    const result = await scrapeAndAnalyse({
      startUrls: [{ url }],
      resultsLimit: 50,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
export { scrapeAndAnalyse, startScrape, waitForRun, getResults, extractPostData };
