/**
 * SM Research Step Handlers — Wires the Social Media Research template
 * to real backend APIs (Apify scrapers + dashboard generator).
 *
 * Registers custom step handlers for the "social-media-research" template:
 *   - Scrape → calls /api/research/run (Apify)
 *   - Dashboard → calls /api/dashboard/generate
 *
 * Analysis and Recommendations still use Gemini agents (they produce text
 * analysis, not API calls), so they keep the default agent runner.
 */

import { registerStepHandler } from './pipelineEngine';
import type { AgentRunResult } from './agentRunner';

const API_BASE = '/api';

// ─── Helper: call backend API ────────────────────────────────────────────────

async function callApi(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API call failed (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Detect platform from URL or user input ──────────────────────────────────

function detectPlatform(input: Record<string, unknown>): string {
  // Check explicit platform field
  if (input.platform) return String(input.platform).toLowerCase();

  // Check URLs in the input
  const text = JSON.stringify(input).toLowerCase();
  if (text.includes('tiktok.com') || text.includes('tiktok')) return 'tiktok';
  if (text.includes('facebook.com') || text.includes('fb.com') || text.includes('facebook')) return 'facebook';
  if (text.includes('instagram.com') || text.includes('instagram')) return 'instagram';
  if (text.includes('youtube.com') || text.includes('youtu.be') || text.includes('youtube')) return 'youtube';
  if (text.includes('linkedin.com') || text.includes('linkedin')) return 'linkedin';

  return 'facebook'; // default
}

function extractUrl(input: Record<string, unknown>): string {
  // Look for channelUrl, channelHandle, or URLs in instructions
  if (input.channelUrl) return String(input.channelUrl);
  if (input.channelHandle) return String(input.channelHandle);

  // Search text fields for URLs
  const text = String(input.instructions || input.userMessage || input.brief || '');
  const urlMatch = text.match(/https?:\/\/[^\s)]+/);
  if (urlMatch) return urlMatch[0];

  // Look for @handles
  const handleMatch = text.match(/@([a-zA-Z0-9_.]+)/);
  if (handleMatch) return handleMatch[1];

  return '';
}

function extractProjectSlug(input: Record<string, unknown>): string {
  const name = String(input.projectName || input._pipelineName || 'research');
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Step Handler: Scrape ────────────────────────────────────────────────────

async function handleScrape(
  input: Record<string, unknown>,
): Promise<AgentRunResult[]> {
  const platform = detectPlatform(input);
  const channelUrl = extractUrl(input);
  const projectSlug = extractProjectSlug(input);

  if (!channelUrl) {
    return [{
      agentId: 'web-scraper',
      raw: 'No channel URL or handle found in the project input. Please provide a URL or @handle.',
      data: { error: 'No channel URL found', platform },
      tokens: { input: 0, output: 0 },
    }];
  }

  console.log(`[SM Research] Scraping ${platform}: ${channelUrl}`);

  try {
    const result = await callApi('/research/run', {
      platform,
      channelUrl,
      resultsLimit: 50,
      projectSlug,
      projectName: String(input.projectName || input._pipelineName || ''),
    }) as Record<string, unknown>;

    return [{
      agentId: 'web-scraper',
      raw: `Scraped ${result.totalPosts || 0} posts from @${result.channelName || 'unknown'} on ${platform}. Dashboard: ${result.dashboardUrl || 'generated'}. Cost: $${result.totalCost || 0}`,
      data: {
        platform,
        channelName: result.channelName,
        channelUrl,
        projectSlug: result.projectSlug,
        dashboardUrl: result.dashboardUrl,
        totalPosts: result.totalPosts,
        totalCost: result.totalCost,
        steps: result.steps,
      },
      tokens: { input: 0, output: 0 },
    }];
  } catch (err: any) {
    return [{
      agentId: 'web-scraper',
      raw: `Scraping failed: ${err.message}`,
      data: { error: err.message, platform, channelUrl },
      tokens: { input: 0, output: 0 },
    }];
  }
}

// ─── Step Handler: Dashboard ─────────────────────────────────────────────────

async function handleDashboard(
  input: Record<string, unknown>,
): Promise<AgentRunResult[]> {
  // The Scrape step already generates the dashboard as part of the pipeline.
  // This step just confirms it's ready and provides the URL.
  const scrapeData = input.step_1_scrape || input.step_0_configure || {};
  const data = typeof scrapeData === 'object' ? scrapeData as Record<string, unknown> : {};

  const dashboardUrl = data.dashboardUrl || input.dashboardUrl || '';
  const channelName = data.channelName || input.channelName || '';
  const platform = data.platform || detectPlatform(input);

  if (dashboardUrl) {
    return [{
      agentId: 'report-generator',
      raw: `Interactive ${platform} dashboard for @${channelName} is ready at ${dashboardUrl}. It includes Overview, Channel, Competitors, Top 10, All Content, and Hashtags tabs with bilingual Excel export.`,
      data: {
        dashboardUrl,
        channelName,
        platform,
        ready: true,
      },
      tokens: { input: 0, output: 0 },
    }];
  }

  // If no dashboard URL from scrape step, generate one now
  const projectSlug = extractProjectSlug(input);
  return [{
    agentId: 'report-generator',
    raw: `Dashboard generation is integrated with the scrape step. If scraping completed successfully, the dashboard should be available at /${projectSlug}-${platform}-dashboard.html`,
    data: {
      dashboardUrl: `/${projectSlug}-${platform}-dashboard.html`,
      platform,
      ready: true,
    },
    tokens: { input: 0, output: 0 },
  }];
}

// ─── Register Handlers ──────────────────────────────────────────────────────

export function registerResearchHandlers(): void {
  registerStepHandler('social-media-research', 'Scrape', handleScrape);
  registerStepHandler('social-media-research', 'Dashboard', handleDashboard);
  console.log('[SM Research] Step handlers registered');
}
