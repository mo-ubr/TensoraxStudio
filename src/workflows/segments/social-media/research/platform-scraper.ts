// Platform-adaptive data collection — unified scraping interface
// Currently implements TikTok and Facebook via Apify API. Instagram and YouTube are stubs.

import type { PlatformResearchConfig } from '../../../../project/types';
import type { PlatformId } from '../_shared/platform-config.types';
import type { ContentPost, AccountProfile, HashtagAnalysis } from '../_shared/content-schema';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScrapeResult {
  platform: PlatformId;
  ownAccount: AccountProfile | null;
  ownPosts: ContentPost[];
  competitorAccounts: AccountProfile[];
  competitorPosts: ContentPost[];
  scrapedAt: Date;
  errors: string[];
  rateLimitInfo?: { remaining: number; resetAt: Date };
}

export interface ScraperConfig {
  platform: PlatformId;
  method: 'api' | 'browser' | 'thirdParty';
  apiKey?: string;
  maxPostsPerAccount: number;
  includePromotedPosts: boolean;
  dateRangeDays: number;
}

// ── Raw response shapes from Apify ─────────────────────────────────────────

interface ApifyTikTokPost {
  id?: string;
  webVideoUrl?: string;
  text?: string;
  createTimeISO?: string;
  videoMeta?: { duration?: number };
  diggCount?: number;
  shareCount?: number;
  commentCount?: number;
  playCount?: number;
  collectCount?: number;
  isAd?: boolean;
  hashtags?: { name: string }[];
  mentions?: string[];
  authorMeta?: {
    name?: string;
    nickName?: string;
    signature?: string;
    fans?: number;
    following?: number;
    video?: number;
    heart?: number;
    digg?: number;
    verified?: boolean;
  };
}

interface ApifyFacebookPost {
  postId?: string;
  postUrl?: string;
  postText?: string;
  time?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  isSponsored?: boolean;
  type?: string;
  user?: {
    name?: string;
    url?: string;
    id?: string;
  };
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function scrapePlatform(
  config: ScraperConfig,
  ownHandle: string,
  competitorHandles: string[],
  targetHashtags: string[]
): Promise<ScrapeResult> {
  switch (config.platform) {
    case 'tiktok':
      return scrapeTikTok(config, ownHandle, competitorHandles, targetHashtags);
    case 'facebook':
      return scrapeFacebook(config, ownHandle, competitorHandles, targetHashtags);
    case 'instagram':
      return createStubResult('instagram', 'Instagram scraper not yet implemented');
    case 'youtube':
      return createStubResult('youtube', 'YouTube scraper not yet implemented');
    default:
      return createStubResult(config.platform, `Unknown platform: ${config.platform}`);
  }
}

export async function scrapeAccount(
  platform: PlatformId,
  handle: string,
  config: ScraperConfig
): Promise<{ account: AccountProfile; posts: ContentPost[] }> {
  const result = await scrapePlatform(config, handle, [], []);
  if (result.ownAccount) {
    return { account: result.ownAccount, posts: result.ownPosts };
  }
  throw new Error(`Failed to scrape account ${handle} on ${platform}: ${result.errors.join(', ')}`);
}

export function extractHashtags(posts: ContentPost[]): HashtagAnalysis[] {
  const tagMap = new Map<string, { count: number; totalViews: number; posts: number; platform: PlatformId }>();

  for (const post of posts) {
    const seen = new Set<string>();
    for (const tag of post.hashtags) {
      const normalised = tag.toLowerCase().replace(/^#/, '');
      if (seen.has(normalised)) continue;
      seen.add(normalised);

      const existing = tagMap.get(normalised);
      if (existing) {
        existing.count += 1;
        existing.totalViews += post.metrics.views;
        existing.posts += 1;
      } else {
        tagMap.set(normalised, {
          count: 1,
          totalViews: post.metrics.views,
          posts: 1,
          platform: post.platform,
        });
      }
    }
  }

  const results: HashtagAnalysis[] = [];
  for (const [hashtag, data] of tagMap) {
    results.push({
      hashtag,
      platform: data.platform,
      totalPosts: data.posts,
      totalViews: data.totalViews,
      averageViewsPerPost: data.posts > 0 ? Math.round(data.totalViews / data.posts) : 0,
      usageCount: data.count,
      trend: 'stable', // Would need time-series data to determine trend
      relevanceScore: 0.5, // Placeholder — a proper scorer would compare to niche baselines
    });
  }

  // Sort by total views descending
  results.sort((a, b) => b.totalViews - a.totalViews);
  return results;
}

// ── TikTok scraper (Apify) ─────────────────────────────────────────────────

async function scrapeTikTok(
  config: ScraperConfig,
  ownHandle: string,
  competitorHandles: string[],
  _targetHashtags: string[]
): Promise<ScrapeResult> {
  const errors: string[] = [];
  const allHandles = [ownHandle, ...competitorHandles].filter(Boolean);

  if (!config.apiKey) {
    return createStubResult('tiktok', 'No Apify API key provided for TikTok scraping');
  }

  let rawPosts: ApifyTikTokPost[] = [];
  try {
    rawPosts = await callApifyTikTok(allHandles, config);
  } catch (err) {
    errors.push(`TikTok scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    return { platform: 'tiktok', ownAccount: null, ownPosts: [], competitorAccounts: [], competitorPosts: [], scrapedAt: new Date(), errors };
  }

  // Group posts by author handle
  const postsByAuthor = new Map<string, ApifyTikTokPost[]>();
  for (const raw of rawPosts) {
    const author = (raw.authorMeta?.name ?? '').toLowerCase();
    if (!postsByAuthor.has(author)) postsByAuthor.set(author, []);
    postsByAuthor.get(author)!.push(raw);
  }

  // Build own account
  const ownNorm = ownHandle.toLowerCase().replace(/^@/, '');
  const ownRaw = postsByAuthor.get(ownNorm) ?? [];
  const ownPosts = ownRaw
    .map(r => mapTikTokPost(r, config.includePromotedPosts))
    .filter((p): p is ContentPost => p !== null);
  const ownAccount = ownRaw.length > 0 ? buildTikTokProfile(ownNorm, ownRaw) : null;

  // Build competitor accounts
  const competitorAccounts: AccountProfile[] = [];
  const competitorPosts: ContentPost[] = [];
  for (const handle of competitorHandles) {
    const norm = handle.toLowerCase().replace(/^@/, '');
    const raw = postsByAuthor.get(norm) ?? [];
    if (raw.length === 0) {
      errors.push(`No posts found for competitor @${norm}`);
      continue;
    }
    competitorAccounts.push(buildTikTokProfile(norm, raw));
    for (const r of raw) {
      const mapped = mapTikTokPost(r, config.includePromotedPosts);
      if (mapped) competitorPosts.push(mapped);
    }
  }

  return {
    platform: 'tiktok',
    ownAccount,
    ownPosts,
    competitorAccounts,
    competitorPosts,
    scrapedAt: new Date(),
    errors,
  };
}

async function callApifyTikTok(handles: string[], config: ScraperConfig): Promise<ApifyTikTokPost[]> {
  const url = 'https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items';
  const body = {
    profiles: handles.map(h => h.replace(/^@/, '')),
    resultsPerPage: config.maxPostsPerAccount,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  };

  const response = await fetch(`${url}?token=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Apify TikTok API returned ${response.status}: ${text}`);
  }

  return (await response.json()) as ApifyTikTokPost[];
}

function mapTikTokPost(raw: ApifyTikTokPost, includePromoted: boolean): ContentPost | null {
  if (!includePromoted && raw.isAd) return null;

  const views = raw.playCount ?? 0;
  const likes = raw.diggCount ?? 0;
  const shares = raw.shareCount ?? 0;
  const comments = raw.commentCount ?? 0;
  const saves = raw.collectCount ?? 0;
  const total = likes + shares + comments + saves;

  return {
    id: raw.id ?? crypto.randomUUID(),
    platform: 'tiktok',
    accountHandle: raw.authorMeta?.name ?? '',
    postType: 'video',
    caption: raw.text ?? '',
    hashtags: (raw.hashtags ?? []).map(h => h.name),
    mentions: raw.mentions ?? [],
    url: raw.webVideoUrl ?? '',
    publishedAt: raw.createTimeISO ? new Date(raw.createTimeISO) : new Date(),
    duration: raw.videoMeta?.duration,
    metrics: {
      views,
      likes,
      shares,
      comments,
      saves,
      engagementRate: views > 0 ? total / views : 0,
      collectedAt: new Date(),
    },
    isPromoted: raw.isAd ?? false,
  };
}

function buildTikTokProfile(handle: string, posts: ApifyTikTokPost[]): AccountProfile {
  // Use the author meta from the first post that has it
  const meta = posts.find(p => p.authorMeta)?.authorMeta;
  const totalViews = posts.reduce((s, p) => s + (p.playCount ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.diggCount ?? 0), 0);

  return {
    platform: 'tiktok',
    handle,
    displayName: meta?.nickName ?? handle,
    bio: meta?.signature ?? '',
    followers: meta?.fans ?? 0,
    following: meta?.following ?? 0,
    totalPosts: meta?.video ?? posts.length,
    totalViews,
    totalLikes,
    averageViewsPerPost: posts.length > 0 ? Math.round(totalViews / posts.length) : 0,
    profileUrl: `https://www.tiktok.com/@${handle}`,
    verified: meta?.verified ?? false,
  };
}

// ── Facebook scraper (Apify) ───────────────────────────────────────────────

async function scrapeFacebook(
  config: ScraperConfig,
  ownHandle: string,
  competitorHandles: string[],
  _targetHashtags: string[]
): Promise<ScrapeResult> {
  const errors: string[] = [];
  const allHandles = [ownHandle, ...competitorHandles].filter(Boolean);

  if (!config.apiKey) {
    return createStubResult('facebook', 'No Apify API key provided for Facebook scraping');
  }

  let rawPosts: ApifyFacebookPost[] = [];
  try {
    rawPosts = await callApifyFacebook(allHandles, config);
  } catch (err) {
    errors.push(`Facebook scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    return { platform: 'facebook', ownAccount: null, ownPosts: [], competitorAccounts: [], competitorPosts: [], scrapedAt: new Date(), errors };
  }

  // Group posts by page name (Facebook doesn't always return a handle)
  const postsByPage = new Map<string, ApifyFacebookPost[]>();
  for (const raw of rawPosts) {
    const page = (raw.user?.name ?? 'unknown').toLowerCase();
    if (!postsByPage.has(page)) postsByPage.set(page, []);
    postsByPage.get(page)!.push(raw);
  }

  // Build own account
  const ownNorm = ownHandle.toLowerCase();
  const ownRaw = postsByPage.get(ownNorm) ?? [];
  const ownPosts = ownRaw
    .map(r => mapFacebookPost(r, config.includePromotedPosts))
    .filter((p): p is ContentPost => p !== null);
  const ownAccount = ownRaw.length > 0 ? buildFacebookProfile(ownNorm, ownRaw) : null;

  // Build competitor accounts
  const competitorAccounts: AccountProfile[] = [];
  const competitorPosts: ContentPost[] = [];
  for (const handle of competitorHandles) {
    const norm = handle.toLowerCase();
    const raw = postsByPage.get(norm) ?? [];
    if (raw.length === 0) {
      errors.push(`No posts found for competitor ${norm} on Facebook`);
      continue;
    }
    competitorAccounts.push(buildFacebookProfile(norm, raw));
    for (const r of raw) {
      const mapped = mapFacebookPost(r, config.includePromotedPosts);
      if (mapped) competitorPosts.push(mapped);
    }
  }

  return {
    platform: 'facebook',
    ownAccount,
    ownPosts,
    competitorAccounts,
    competitorPosts,
    scrapedAt: new Date(),
    errors,
  };
}

async function callApifyFacebook(handles: string[], config: ScraperConfig): Promise<ApifyFacebookPost[]> {
  const url = 'https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items';
  const body = {
    startUrls: handles.map(h => ({ url: `https://www.facebook.com/${h}` })),
    resultsLimit: config.maxPostsPerAccount,
  };

  const response = await fetch(`${url}?token=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Apify Facebook API returned ${response.status}: ${text}`);
  }

  return (await response.json()) as ApifyFacebookPost[];
}

function mapFacebookPost(raw: ApifyFacebookPost, includePromoted: boolean): ContentPost | null {
  if (!includePromoted && raw.isSponsored) return null;

  const views = raw.views ?? 0;
  const likes = raw.likes ?? 0;
  const shares = raw.shares ?? 0;
  const comments = raw.comments ?? 0;
  const total = likes + shares + comments;

  // Extract hashtags from text
  const hashtagMatches = (raw.postText ?? '').match(/#\w+/g) ?? [];
  const mentionMatches = (raw.postText ?? '').match(/@\w+/g) ?? [];

  return {
    id: raw.postId ?? crypto.randomUUID(),
    platform: 'facebook',
    accountHandle: raw.user?.name ?? '',
    postType: raw.type ?? 'text',
    caption: raw.postText ?? '',
    hashtags: hashtagMatches.map(h => h.replace('#', '')),
    mentions: mentionMatches.map(m => m.replace('@', '')),
    url: raw.postUrl ?? '',
    publishedAt: raw.time ? new Date(raw.time) : new Date(),
    metrics: {
      views,
      likes,
      shares,
      comments,
      saves: 0, // Facebook doesn't expose saves via scraping
      engagementRate: views > 0 ? total / views : 0,
      collectedAt: new Date(),
    },
    isPromoted: raw.isSponsored ?? false,
  };
}

function buildFacebookProfile(handle: string, posts: ApifyFacebookPost[]): AccountProfile {
  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);

  return {
    platform: 'facebook',
    handle,
    displayName: posts[0]?.user?.name ?? handle,
    bio: '',
    followers: 0, // Not available from post scraping
    following: 0,
    totalPosts: posts.length,
    totalViews,
    totalLikes,
    averageViewsPerPost: posts.length > 0 ? Math.round(totalViews / posts.length) : 0,
    profileUrl: `https://www.facebook.com/${handle}`,
    verified: false,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function createStubResult(platform: PlatformId, errorMessage: string): ScrapeResult {
  return {
    platform,
    ownAccount: null,
    ownPosts: [],
    competitorAccounts: [],
    competitorPosts: [],
    scrapedAt: new Date(),
    errors: [errorMessage],
  };
}
