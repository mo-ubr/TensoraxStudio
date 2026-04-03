/**
 * Research Pipeline — End-to-end Social Media Research Automation
 *
 * Orchestrates the full SM Research workflow:
 *   1. Scrape — calls platform-specific Apify service
 *   2. Dashboard — generates interactive HTML dashboard
 *   3. Analysis — Gemini analyses the scraped data
 *   4. Recommendations — Gemini generates actionable recommendations
 *   5. Export — generates bilingual Excel + saves all assets
 *
 * Mounted at /api/research by server/index.js.
 */

import { Router } from "express";
import { scrapeAndAnalyse as scrapeTikTok } from "./apifyTiktokService.js";
import { scrapeAndAnalyse as scrapeFacebook } from "./apifyFacebookService.js";
import { generateAndSaveDashboard } from "./dashboardGenerator.js";
import { writeFile, mkdir } from "fs/promises";
import { resolve, join } from "path";

const router = Router();

// ─── Platform scrapers ───────────────────────────────────────────────────────

const SCRAPERS = {
  tiktok: async ({ channelUrl, channelHandle, resultsLimit = 20, periodDays }) => {
    // Parse handle from URL if needed
    let handle = channelHandle || "";
    if (!handle && channelUrl) {
      const match = channelUrl.match(/@([^/?]+)/);
      if (match) handle = match[1];
      else handle = channelUrl.split("/").filter(Boolean).pop() || "";
    }
    const opts = {
      profiles: handle ? [handle] : [],
      urls: !handle && channelUrl ? [channelUrl] : [],
      resultsPerPage: resultsLimit,
    };
    if (periodDays) {
      opts.oldestPostDate = new Date(Date.now() - periodDays * 86400000).toISOString().substring(0, 10);
    }
    return scrapeTikTok(opts);
  },
  facebook: async ({ channelUrl, channelHandle, resultsLimit = 50, periodDays }) => {
    let url = channelUrl || "";
    if (!url && channelHandle) {
      url = /^\d+$/.test(channelHandle)
        ? `https://www.facebook.com/profile.php?id=${channelHandle}`
        : `https://www.facebook.com/${channelHandle}`;
    }
    return scrapeFacebook({
      startUrls: [{ url }],
      resultsLimit,
      activeFilter: periodDays ? "custom" : "all",
      startDate: periodDays ? new Date(Date.now() - periodDays * 86400000).toISOString() : "",
    });
  },
  // Instagram and YouTube can be added here when scrapers are ready
};

// ─── Extract channel name from scraped results ───────────────────────────────

function extractChannelName(platform, scrapeResult) {
  if (platform === "tiktok") {
    const first = scrapeResult.videos?.[0];
    return first?.author?.name || first?.authorMeta?.name || "Unknown";
  }
  if (platform === "facebook") {
    return scrapeResult.pageInfo?.name || scrapeResult.posts?.[0]?.author?.name || "Unknown";
  }
  return "Unknown";
}

// ─── Get raw posts array from scrape result ──────────────────────────────────

function getRawPosts(platform, scrapeResult) {
  if (platform === "tiktok") return scrapeResult.videos || [];
  if (platform === "facebook") return scrapeResult.posts || [];
  return [];
}

// ─── Full pipeline execution ─────────────────────────────────────────────────

async function runResearchPipeline({
  platform,
  channelUrl,
  channelHandle,
  competitors = [],       // [{ handle, url }]
  resultsLimit = 50,
  periodDays = 7,          // default: last 7 days
  projectSlug,
  projectName,
  onProgress,              // optional: (step, message) => void
}) {
  const progress = onProgress || ((step, msg) => console.log(`[Research] [${step}] ${msg}`));
  const results = { steps: {} };

  // ── Step 1: Scrape main channel ──
  progress("scrape", `Scraping ${platform} channel (last ${periodDays} days)...`);
  const scraper = SCRAPERS[platform];
  if (!scraper) throw new Error(`Unsupported platform: ${platform}. Supported: ${Object.keys(SCRAPERS).join(", ")}`);

  const scrapeResult = await scraper({ channelUrl, channelHandle, resultsLimit, periodDays });
  const channelName = extractChannelName(platform, scrapeResult);
  const rawPosts = getRawPosts(platform, scrapeResult);
  progress("scrape", `Got ${rawPosts.length} posts from @${channelName}. Cost: $${scrapeResult.cost}`);
  results.steps.scrape = { postCount: rawPosts.length, cost: scrapeResult.cost, channelName };

  // ── Step 1b: Scrape competitors (if any) ──
  const competitorResults = [];
  for (const comp of competitors) {
    try {
      progress("scrape", `Scraping competitor: ${comp.handle || comp.url}...`);
      const compResult = await scraper({
        channelUrl: comp.url,
        channelHandle: comp.handle,
        resultsLimit: Math.min(resultsLimit, 20), // fewer for competitors
        periodDays,
      });
      const compName = extractChannelName(platform, compResult);
      const compPosts = getRawPosts(platform, compResult);
      competitorResults.push({ name: compName, rawPosts: compPosts });
      progress("scrape", `Got ${compPosts.length} posts from competitor @${compName}`);
    } catch (err) {
      progress("scrape", `Failed to scrape competitor ${comp.handle || comp.url}: ${err.message}`);
    }
  }
  results.steps.scrapeCompetitors = competitorResults.map(c => ({ name: c.name, postCount: c.rawPosts.length }));

  // ── Step 2: Generate Dashboard ──
  progress("dashboard", "Generating interactive dashboard...");
  const slug = projectSlug || `research-${platform}-${channelName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dashboard = await generateAndSaveDashboard({
    platform,
    channelName,
    channelUrl,
    scrapedDate: new Date().toISOString().substring(0, 10),
    rawPosts,
    competitors: competitorResults,
    projectSlug: slug,
    projectName: projectName || `${channelName} ${platform} Research`,
  });
  progress("dashboard", `Dashboard saved: ${dashboard.publicUrl}`);
  results.steps.dashboard = dashboard;

  // ── Step 3 & 4: Analysis + Recommendations ──
  // These will be done client-side by Gemini (the MO chat / template runner sends the
  // scraped data to Gemini for analysis). We save the raw data for that step.
  const dataPath = join(resolve(process.cwd(), "assets/0. Projects", slug), `${platform}-scraped-data.json`);
  await mkdir(resolve(process.cwd(), "assets/0. Projects", slug), { recursive: true });
  await writeFile(dataPath, JSON.stringify({ platform, channelName, posts: rawPosts, competitors: competitorResults }, null, 2), "utf-8");
  progress("data", `Raw data saved: ${dataPath}`);
  results.steps.dataSaved = dataPath;

  // ── Summary ──
  results.platform = platform;
  results.channelName = channelName;
  results.projectSlug = slug;
  results.dashboardUrl = dashboard.publicUrl;
  results.totalPosts = rawPosts.length;
  results.totalCompetitorPosts = competitorResults.reduce((s, c) => s + c.rawPosts.length, 0);
  results.totalCost = (scrapeResult.cost || 0);

  progress("complete", `Pipeline complete! Dashboard: ${dashboard.publicUrl}`);
  return results;
}

// ─── API Endpoints ───────────────────────────────────────────────────────────

// POST /api/research/run — run the full pipeline (sync, waits for completion)
router.post("/run", async (req, res) => {
  try {
    const result = await runResearchPipeline(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Research Pipeline] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/run-sse — run with Server-Sent Events progress
router.post("/run-sse", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await runResearchPipeline({
      ...req.body,
      onProgress: (step, message) => {
        sendSSE("progress", { step, message });
      },
    });
    sendSSE("done", result);
  } catch (err) {
    console.error("[Research Pipeline] Error:", err);
    sendSSE("error", { error: err.message });
  } finally {
    res.end();
  }
});

// GET /api/research/platforms — list supported platforms
router.get("/platforms", (_req, res) => {
  res.json({
    platforms: Object.keys(SCRAPERS).map(p => ({
      id: p,
      name: p.charAt(0).toUpperCase() + p.slice(1),
      ready: true,
    })),
  });
});

export default router;
export { runResearchPipeline };
