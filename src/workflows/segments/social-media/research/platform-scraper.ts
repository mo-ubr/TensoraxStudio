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

interface ApifyInstagramPost {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  type?: string;       // 'Image' | 'Video' | 'Sidecar'
  isSponsored?: boolean;
  isVideo?: boolean;
  ownerUsername?: string;
  ownerFullName?: string;
  ownerId?: string;
}

interface ApifyYouTubeVideo {
  id?: string;
  title?: string;
  url?: string;
  viewCount?: number;
  likes?: number;
  commentsCount?: number;
  date?: string;
  duration?: string;
  channelName?: string;
  channelUrl?: string;
  subscribers?: number;
  description?: string;
  tags?: string[];
  isShort?: boolean;
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
      return scrapeInstagram(config, ownHandle, competitorHandles, targetHashtags);
    case 'youtube':
      return scrapeYouTube(config, ownHandle, competitorHandles, targetHashtags);
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

// ── Instagram scraper (Apify) ─────────────────────────────────────────────

async function scrapeInstagram(
  config: ScraperConfig,
  ownHandle: string,
  competitorHandles: string[],
  _targetHashtags: string[]
): Promise<ScrapeResult> {
  const errors: string[] = [];
  const allHandles = [ownHandle, ...competitorHandles].filter(Boolean);

  if (!config.apiKey) {
    return createStubResult('instagram', 'No Apify API key provided for Instagram scraping');
  }

  let rawPosts: ApifyInstagramPost[] = [];
  try {
    rawPosts = await callApifyInstagram(allHandles, config);
  } catch (err) {
    errors.push(`Instagram scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    return { platform: 'instagram', ownAccount: null, ownPosts: [], competitorAccounts: [], competitorPosts: [], scrapedAt: new Date(), errors };
  }

  // Group posts by owner handle
  const postsByAuthor = new Map<string, ApifyInstagramPost[]>();
  for (const raw of rawPosts) {
    const author = (raw.ownerUsername ?? '').toLowerCase();
    if (!postsByAuthor.has(author)) postsByAuthor.set(author, []);
    postsByAuthor.get(author)!.push(raw);
  }

  // Build own account
  const ownNorm = ownHandle.toLowerCase().replace(/^@/, '');
  const ownRaw = postsByAuthor.get(ownNorm) ?? [];
  const ownPosts = ownRaw
    .map(r => mapInstagramPost(r, config.includePromotedPosts))
    .filter((p): p is ContentPost => p !== null);
  const ownAccount = ownRaw.length > 0 ? buildInstagramProfile(ownNorm, ownRaw) : null;

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
    competitorAccounts.push(buildInstagramProfile(norm, raw));
    for (const r of raw) {
      const mapped = mapInstagramPost(r, config.includePromotedPosts);
      if (mapped) competitorPosts.push(mapped);
    }
  }

  return {
    platform: 'instagram',
    ownAccount,
    ownPosts,
    competitorAccounts,
    competitorPosts,
    scrapedAt: new Date(),
    errors,
  };
}

async function callApifyInstagram(handles: string[], config: ScraperConfig): Promise<ApifyInstagramPost[]> {
  const url = 'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items';
  const body = {
    directUrls: handles.map(h => `https://www.instagram.com/${h.replace(/^@/, '')}/`),
    resultsLimit: config.maxPostsPerAccount,
    resultsType: 'posts',
  };

  const response = await fetch(`${url}?token=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Apify Instagram API returned ${response.status}: ${text}`);
  }

  return (await response.json()) as ApifyInstagramPost[];
}

function mapInstagramPost(raw: ApifyInstagramPost, includePromoted: boolean): ContentPost | null {
  if (!includePromoted && raw.isSponsored) return null;

  const views = raw.videoViewCount ?? raw.videoPlayCount ?? 0;
  const likes = raw.likesCount ?? 0;
  const comments = raw.commentsCount ?? 0;
  const total = likes + comments;

  // Map Instagram type to our post type
  const postType = raw.isVideo ? 'video'
    : raw.type === 'Sidecar' ? 'carousel'
    : 'photo';

  return {
    id: raw.id ?? raw.shortCode ?? crypto.randomUUID(),
    platform: 'instagram',
    accountHandle: raw.ownerUsername ?? '',
    postType,
    caption: raw.caption ?? '',
    hashtags: raw.hashtags ?? [],
    mentions: raw.mentions ?? [],
    url: raw.url ?? (raw.shortCode ? `https://www.instagram.com/p/${raw.shortCode}/` : ''),
    publishedAt: raw.timestamp ? new Date(raw.timestamp) : new Date(),
    metrics: {
      views,
      likes,
      shares: 0, // Instagram doesn't expose shares via scraping
      comments,
      saves: 0,  // Not available via scraping
      engagementRate: views > 0 ? total / views : (likes > 0 ? total / likes : 0),
      collectedAt: new Date(),
    },
    isPromoted: raw.isSponsored ?? false,
  };
}

function buildInstagramProfile(handle: string, posts: ApifyInstagramPost[]): AccountProfile {
  const totalViews = posts.reduce((s, p) => s + (p.videoViewCount ?? p.videoPlayCount ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likesCount ?? 0), 0);
  const firstPost = posts[0];

  return {
    platform: 'instagram',
    handle,
    displayName: firstPost?.ownerFullName ?? handle,
    bio: '',
    followers: 0, // Not available from post scraping
    following: 0,
    totalPosts: posts.length,
    totalViews,
    totalLikes,
    averageViewsPerPost: posts.length > 0 ? Math.round(totalViews / posts.length) : 0,
    profileUrl: `https://www.instagram.com/${handle}/`,
    verified: false,
  };
}

// ── YouTube scraper (Apify) ───────────────────────────────────────────────

async function scrapeYouTube(
  config: ScraperConfig,
  ownHandle: string,
  competitorHandles: string[],
  _targetHashtags: string[]
): Promise<ScrapeResult> {
  const errors: string[] = [];
  const allHandles = [ownHandle, ...competitorHandles].filter(Boolean);

  if (!config.apiKey) {
    return createStubResult('youtube', 'No Apify API key provided for YouTube scraping');
  }

  let rawVideos: ApifyYouTubeVideo[] = [];
  try {
    rawVideos = await callApifyYouTube(allHandles, config);
  } catch (err) {
    errors.push(`YouTube scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    return { platform: 'youtube', ownAccount: null, ownPosts: [], competitorAccounts: [], competitorPosts: [], scrapedAt: new Date(), errors };
  }

  // Group videos by channel name
  const videosByChannel = new Map<string, ApifyYouTubeVideo[]>();
  for (const raw of rawVideos) {
    const channel = (raw.channelName ?? '').toLowerCase();
    if (!videosByChannel.has(channel)) videosByChannel.set(channel, []);
    videosByChannel.get(channel)!.push(raw);
  }

  // Build own account
  const ownNorm = ownHandle.toLowerCase().replace(/^@/, '');
  // Try matching by channel name (case-insensitive)
  const ownRaw = videosByChannel.get(ownNorm)
    ?? [...videosByChannel.entries()].find(([k]) => k.includes(ownNorm))?.[1]
    ?? [];
  const ownPosts = ownRaw.map(r => mapYouTubeVideo(r));
  const ownAccount = ownRaw.length > 0 ? buildYouTubeProfile(ownNorm, ownRaw) : null;

  // Build competitor accounts
  const competitorAccounts: AccountProfile[] = [];
  const competitorPosts: ContentPost[] = [];
  for (const handle of competitorHandles) {
    const norm = handle.toLowerCase().replace(/^@/, '');
    const raw = videosByChannel.get(norm)
      ?? [...videosByChannel.entries()].find(([k]) => k.includes(norm))?.[1]
      ?? [];
    if (raw.length === 0) {
      errors.push(`No videos found for competitor @${norm}`);
      continue;
    }
    competitorAccounts.push(buildYouTubeProfile(norm, raw));
    for (const r of raw) {
      competitorPosts.push(mapYouTubeVideo(r));
    }
  }

  return {
    platform: 'youtube',
    ownAccount,
    ownPosts,
    competitorAccounts,
    competitorPosts,
    scrapedAt: new Date(),
    errors,
  };
}

async function callApifyYouTube(handles: string[], config: ScraperConfig): Promise<ApifyYouTubeVideo[]> {
  const url = 'https://api.apify.com/v2/acts/streamers~youtube-scraper/run-sync-get-dataset-items';
  const body = {
    startUrls: handles.map(h => ({ url: `https://www.youtube.com/@${h.replace(/^@/, '')}` })),
    maxResults: config.maxPostsPerAccount,
    maxResultsShorts: 10,
    maxResultStreams: 0,
  };

  const response = await fetch(`${url}?token=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Apify YouTube API returned ${response.status}: ${text}`);
  }

  return (await response.json()) as ApifyYouTubeVideo[];
}

function parseYouTubeDuration(duration: string | undefined): number | undefined {
  if (!duration) return undefined;
  // Handle formats like "5:30", "1:05:30", or "PT5M30S"
  if (duration.startsWith('PT')) {
    const hours = duration.match(/(\d+)H/)?.[1];
    const minutes = duration.match(/(\d+)M/)?.[1];
    const seconds = duration.match(/(\d+)S/)?.[1];
    return (parseInt(hours ?? '0') * 3600) + (parseInt(minutes ?? '0') * 60) + parseInt(seconds ?? '0');
  }
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

function mapYouTubeVideo(raw: ApifyYouTubeVideo): ContentPost {
  const views = raw.viewCount ?? 0;
  const likes = raw.likes ?? 0;
  const comments = raw.commentsCount ?? 0;
  const total = likes + comments;

  // Extract hashtags from description and title
  const text = `${raw.title ?? ''} ${raw.description ?? ''}`;
  const hashtagMatches = text.match(/#\w+/g) ?? [];
  const allTags = [...new Set([...hashtagMatches.map(h => h.replace('#', '')), ...(raw.tags ?? [])])];

  return {
    id: raw.id ?? crypto.randomUUID(),
    platform: 'youtube',
    accountHandle: raw.channelName ?? '',
    postType: raw.isShort ? 'short' : 'video',
    caption: raw.title ?? '',
    hashtags: allTags,
    mentions: [],
    url: raw.url ?? '',
    publishedAt: raw.date ? new Date(raw.date) : new Date(),
    duration: parseYouTubeDuration(raw.duration),
    metrics: {
      views,
      likes,
      shares: 0,
      comments,
      saves: 0,
      engagementRate: views > 0 ? total / views : 0,
      collectedAt: new Date(),
    },
    isPromoted: false,
  };
}

function buildYouTubeProfile(handle: string, videos: ApifyYouTubeVideo[]): AccountProfile {
  const totalViews = videos.reduce((s, v) => s + (v.viewCount ?? 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes ?? 0), 0);
  const firstVideo = videos[0];

  return {
    platform: 'youtube',
    handle,
    displayName: firstVideo?.channelName ?? handle,
    bio: '',
    followers: firstVideo?.subscribers ?? 0,
    following: 0,
    totalPosts: videos.length,
    totalViews,
    totalLikes,
    averageViewsPerPost: videos.length > 0 ? Math.round(totalViews / videos.length) : 0,
    profileUrl: firstVideo?.channelUrl ?? `https://www.youtube.com/@${handle}`,
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
