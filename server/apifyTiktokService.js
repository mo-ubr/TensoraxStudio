/**
 * Apify TikTok Service
 *
 * Scrapes TikTok data (videos, profiles, hashtags) via the Apify TikTok Scraper
 * (clockworks/tiktok-scraper) and returns structured data including video thumbnails
 * for visual analysis by Qwen VL.
 *
 * Actor ID: GdWCkxBtKWOsKjdch
 */

import { Router } from "express";

const router = Router();

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "GdWCkxBtKWOsKjdch"; // clockworks/tiktok-scraper

function getToken() {
  return process.env.APIFY_API_TOKEN || "";
}

// ─── Start a TikTok scrape run ───────────────────────────────────────────

async function startScrape({
  hashtags = [],
  profiles = [],
  searchQueries = [],
  urls = [],
  resultsPerPage = 20,
  shouldDownloadCovers = false,
  shouldDownloadVideos = false,
  proxyCountryCode = "None",
  oldestPostDate = "",
}) {
  const token = getToken();
  if (!token) throw new Error("APIFY_API_TOKEN not set");

  const input = {
    hashtags,
    profiles,
    searchQueries,
    urls,
    resultsPerPage,
    shouldDownloadCovers,
    shouldDownloadVideos,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    shouldDownloadSlideshowImages: false,
    scrapeRelatedVideos: false,
    excludePinnedPosts: false,
    commentsPerPost: 0,
    maxFollowersPerProfile: 0,
    maxFollowingPerProfile: 0,
    maxRepliesPerComment: 0,
    proxyCountryCode,
    ...(oldestPostDate ? { oldestPostDate } : {}),
  };

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
    status: data.data.status, // READY, RUNNING, SUCCEEDED, FAILED, ABORTING, ABORTED, TIMED-OUT
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

async function getResults(datasetId, { limit = 100, offset = 0 } = {}) {
  const token = getToken();
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=${limit}&offset=${offset}&format=json`
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`);
  return res.json();
}

// ─── Extract key fields for analysis ─────────────────────────────────────

function extractVideoData(item) {
  return {
    id: item.id,
    url: item.webVideoUrl,
    text: item.text,
    language: item.textLanguage,
    createdAt: item.createTimeISO,
    // Engagement
    plays: item.playCount,
    likes: item.diggCount,
    shares: item.shareCount,
    comments: item.commentCount,
    saves: item.collectCount,
    reposts: item.repostCount || 0,
    engagementRate: item.playCount > 0
      ? ((item.diggCount + item.shareCount + item.commentCount + item.collectCount) / item.playCount * 100).toFixed(2) + "%"
      : "0%",
    // Visual assets
    coverUrl: item.videoMeta?.coverUrl || item.videoMeta?.originalCoverUrl || "",
    // Author
    author: {
      name: item.authorMeta?.name,
      nickname: item.authorMeta?.nickName,
      profileUrl: item.authorMeta?.profileUrl,
      avatar: item.authorMeta?.avatar,
      followers: item.authorMeta?.fans,
      totalLikes: item.authorMeta?.heart,
      totalVideos: item.authorMeta?.video,
      verified: item.authorMeta?.verified,
    },
    // Content metadata
    hashtags: (item.hashtags || []).map(h => h.name).filter(Boolean),
    music: {
      name: item.musicMeta?.musicName,
      author: item.musicMeta?.musicAuthor,
      isOriginal: item.musicMeta?.musicOriginal,
    },
    // Video specs
    duration: item.videoMeta?.duration,
    resolution: item.videoMeta?.definition,
    isSlideshow: item.isSlideshow,
    isAd: item.isAd,
    isPinned: item.isPinned,
    // Transcription
    hasSubtitles: (item.videoMeta?.subtitleLinks || []).length > 0,
    subtitleUrl: item.videoMeta?.subtitleLinks?.[0]?.downloadLink || null,
  };
}

// ─── High-level: scrape and return structured data ───────────────────────

async function scrapeAndAnalyse(opts) {
  console.log("[Apify TikTok] Starting scrape...", opts);
  const run = await startScrape(opts);
  console.log(`[Apify TikTok] Run started: ${run.runId}`);

  const completed = await waitForRun(run.runId);
  console.log(`[Apify TikTok] Run completed. Cost: $${completed.usageTotalUsd}`);

  const rawResults = await getResults(completed.datasetId, { limit: opts.resultsPerPage || 20 });
  const videos = rawResults.map(extractVideoData);

  console.log(`[Apify TikTok] Got ${videos.length} videos`);
  return {
    runId: run.runId,
    cost: completed.usageTotalUsd,
    videoCount: videos.length,
    videos,
    // Thumbnail URLs ready for Qwen VL analysis
    thumbnailUrls: videos.map(v => v.coverUrl).filter(Boolean),
  };
}

// ─── API Endpoints ───────────────────────────────────────────────────────

// POST /api/tiktok/scrape — start a scrape and return results
router.post("/scrape", async (req, res) => {
  try {
    const result = await scrapeAndAnalyse(req.body);
    res.json(result);
  } catch (err) {
    console.error("[Apify TikTok] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tiktok/scrape-async — start a scrape, return run ID immediately
router.post("/scrape-async", async (req, res) => {
  try {
    const run = await startScrape(req.body);
    res.json(run);
  } catch (err) {
    console.error("[Apify TikTok] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tiktok/status/:runId — check run status
router.get("/status/:runId", async (req, res) => {
  try {
    const status = await getRunStatus(req.params.runId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tiktok/results/:datasetId — fetch results from completed run
router.get("/results/:datasetId", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const rawResults = await getResults(req.params.datasetId, { limit, offset });
    const videos = rawResults.map(extractVideoData);
    res.json({ videoCount: videos.length, videos, thumbnailUrls: videos.map(v => v.coverUrl).filter(Boolean) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tiktok/quick-profile/:handle — scrape a single profile (20 videos)
router.get("/quick-profile/:handle", async (req, res) => {
  try {
    const result = await scrapeAndAnalyse({
      profiles: [req.params.handle],
      resultsPerPage: 20,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tiktok/quick-hashtag/:tag — scrape a single hashtag (20 videos)
router.get("/quick-hashtag/:tag", async (req, res) => {
  try {
    const result = await scrapeAndAnalyse({
      hashtags: [req.params.tag],
      resultsPerPage: 20,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
export { scrapeAndAnalyse, startScrape, waitForRun, getResults, extractVideoData };
