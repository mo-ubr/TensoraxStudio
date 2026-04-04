// Analysis engine — pure computation, no API calls, no side effects.
// Takes scraped data and produces a structured AnalysisSection.

import type { AnalysisSection, ContentPost, AccountProfile, HashtagAnalysis } from '../_shared/content-schema';
import type { PlatformId } from '../_shared/platform-config.types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  platform: PlatformId;
  ownAccount: AccountProfile | null;
  ownPosts: ContentPost[];
  competitorAccounts: AccountProfile[];
  competitorPosts: ContentPost[];
  allPosts: ContentPost[];
  hashtags: HashtagAnalysis[];
}

// ── Main analysis function ─────────────────────────────────────────────────

export function analyzeResearchData(input: AnalysisInput): AnalysisSection {
  const {
    ownAccount,
    ownPosts,
    competitorAccounts,
    competitorPosts,
    allPosts,
    hashtags,
  } = input;

  // All accounts including own (if available)
  const allAccounts = [...competitorAccounts];
  if (ownAccount) allAccounts.push(ownAccount);

  const ranked = rankAccounts(allAccounts);
  const viralContent = findViralContent(allPosts, 10);
  const optimalDuration = analyzeOptimalDuration(viralContent);

  // Current position
  const ownRank = ownAccount
    ? ranked.findIndex(a => a.handle === ownAccount.handle) + 1
    : ranked.length + 1;

  // Gap to top 10 — compare own metrics to average of top 10 accounts
  const top10 = ranked.slice(0, 10);
  const gapToTop10 = calculateGapToTop10(ownAccount, top10);

  // Viral content analysis
  const commonThemes = extractCommonThemes(viralContent);
  const bestFormats = extractBestFormats(viralContent);
  const peakPostingTimes = extractPeakPostingTimes(viralContent);

  // Hashtag gaps
  const ownHashtags = ownPosts.flatMap(p => p.hashtags);
  const hashtagGaps = identifyHashtagGaps(ownHashtags, hashtags);

  // Engagement quality
  const engagementQuality = analyzeEngagementQuality(ownPosts);

  // Key findings
  const keyFindings = compileKeyFindings(
    ownAccount, ownRank, ranked.length, gapToTop10,
    optimalDuration, hashtagGaps, engagementQuality, viralContent
  );

  return {
    currentPosition: {
      rank: ownRank,
      totalAccounts: ranked.length,
      gapToTop10,
    },
    viralVideoAnalysis: {
      commonThemes,
      optimalDuration,
      bestFormats,
      peakPostingTimes,
    },
    hashtagGaps,
    engagementQuality,
    keyFindings,
  };
}

// ── Ranking ────────────────────────────────────────────────────────────────

export function rankAccounts(accounts: AccountProfile[]): AccountProfile[] {
  return [...accounts].sort((a, b) => b.totalViews - a.totalViews);
}

// ── Viral content ──────────────────────────────────────────────────────────

export function findViralContent(posts: ContentPost[], topN: number = 10): ContentPost[] {
  return [...posts]
    .sort((a, b) => b.metrics.views - a.metrics.views)
    .slice(0, topN);
}

// ── Engagement rate ────────────────────────────────────────────────────────

export function calculateEngagementRate(post: ContentPost): number {
  const { views, likes, comments, shares, saves } = post.metrics;
  if (views === 0) return 0;
  return (likes + comments + shares + saves) / views;
}

// ── Optimal duration ───────────────────────────────────────────────────────

export function analyzeOptimalDuration(posts: ContentPost[]): { min: number; max: number } {
  const durations = posts
    .map(p => p.duration)
    .filter((d): d is number => d !== undefined && d > 0);

  if (durations.length === 0) return { min: 0, max: 0 };

  durations.sort((a, b) => a - b);

  // Use the 25th–75th percentile range of top-performing content
  const q1Index = Math.floor(durations.length * 0.25);
  const q3Index = Math.min(Math.floor(durations.length * 0.75), durations.length - 1);

  return {
    min: durations[q1Index],
    max: durations[q3Index],
  };
}

// ── Hashtag gap analysis ───────────────────────────────────────────────────

export function identifyHashtagGaps(
  ownHashtags: string[],
  competitorHashtags: HashtagAnalysis[]
): { underused: string[]; overused: string[]; recommended: string[] } {
  const ownSet = new Set(ownHashtags.map(h => h.toLowerCase()));

  // Sort competitor hashtags by average views per post (best performing first)
  const sorted = [...competitorHashtags].sort(
    (a, b) => b.averageViewsPerPost - a.averageViewsPerPost
  );

  // Underused: high-performing competitor hashtags we rarely or never use
  const underused = sorted
    .filter(h => !ownSet.has(h.hashtag.toLowerCase()) && h.averageViewsPerPost > 0)
    .slice(0, 15)
    .map(h => h.hashtag);

  // Overused: hashtags we use often but that have below-median performance
  const medianViews = sorted.length > 0
    ? sorted[Math.floor(sorted.length / 2)].averageViewsPerPost
    : 0;

  const overused = sorted
    .filter(h => ownSet.has(h.hashtag.toLowerCase()) && h.averageViewsPerPost < medianViews)
    .map(h => h.hashtag);

  // Recommended: top-performing hashtags with high relevance
  const recommended = sorted
    .filter(h => h.relevanceScore > 0.3 && h.averageViewsPerPost > medianViews)
    .slice(0, 20)
    .map(h => h.hashtag);

  return { underused, overused, recommended };
}

// ── Internal helpers ───────────────────────────────────────────────────────

function calculateGapToTop10(
  ownAccount: AccountProfile | null,
  top10: AccountProfile[]
): Record<string, number> {
  if (top10.length === 0) return {};

  const avgFollowers = top10.reduce((s, a) => s + a.followers, 0) / top10.length;
  const avgTotalViews = top10.reduce((s, a) => s + a.totalViews, 0) / top10.length;
  const avgAvgViews = top10.reduce((s, a) => s + a.averageViewsPerPost, 0) / top10.length;
  const avgTotalLikes = top10.reduce((s, a) => s + a.totalLikes, 0) / top10.length;

  const own = ownAccount ?? { followers: 0, totalViews: 0, averageViewsPerPost: 0, totalLikes: 0 };

  return {
    followers: Math.round(avgFollowers - own.followers),
    totalViews: Math.round(avgTotalViews - own.totalViews),
    averageViewsPerPost: Math.round(avgAvgViews - own.averageViewsPerPost),
    totalLikes: Math.round(avgTotalLikes - own.totalLikes),
  };
}

function extractCommonThemes(viralPosts: ContentPost[]): string[] {
  // Extract recurring words from captions (basic frequency analysis)
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'so', 'if', 'then', 'than', 'that', 'this', 'it', 'its',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they',
    'them', 'their', 'what', 'which', 'who', 'when', 'where', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  ]);

  const wordFreq = new Map<string, number>();
  for (const post of viralPosts) {
    const words = post.caption
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    const seen = new Set<string>();
    for (const word of words) {
      if (seen.has(word)) continue;
      seen.add(word);
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  // Return words that appear in at least 20% of viral posts
  const threshold = Math.max(2, Math.ceil(viralPosts.length * 0.2));
  return Array.from(wordFreq.entries())
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function extractBestFormats(viralPosts: ContentPost[]): string[] {
  const formatCounts = new Map<string, number>();
  for (const post of viralPosts) {
    const fmt = post.postType;
    formatCounts.set(fmt, (formatCounts.get(fmt) ?? 0) + 1);
  }
  return Array.from(formatCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([fmt]) => fmt);
}

function extractPeakPostingTimes(viralPosts: ContentPost[]): string[] {
  const hourCounts = new Map<number, number>();
  for (const post of viralPosts) {
    const hour = new Date(post.publishedAt).getUTCHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  return Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => `${hour.toString().padStart(2, '0')}:00 UTC`);
}

function analyzeEngagementQuality(ownPosts: ContentPost[]): AnalysisSection['engagementQuality'] {
  if (ownPosts.length === 0) {
    return {
      commentSentiment: 'mixed',
      shareToViewRatio: 0,
      saveToViewRatio: 0,
      authenticEngagementScore: 0,
    };
  }

  const totalViews = ownPosts.reduce((s, p) => s + p.metrics.views, 0);
  const totalShares = ownPosts.reduce((s, p) => s + p.metrics.shares, 0);
  const totalSaves = ownPosts.reduce((s, p) => s + p.metrics.saves, 0);
  const totalLikes = ownPosts.reduce((s, p) => s + p.metrics.likes, 0);
  const totalComments = ownPosts.reduce((s, p) => s + p.metrics.comments, 0);

  const shareToViewRatio = totalViews > 0 ? totalShares / totalViews : 0;
  const saveToViewRatio = totalViews > 0 ? totalSaves / totalViews : 0;

  // Authentic engagement score: shares and saves are higher-quality signals
  // Weighted: saves * 3 + shares * 2 + comments * 1.5 + likes * 1, normalised to views
  const weightedEngagement = totalViews > 0
    ? (totalSaves * 3 + totalShares * 2 + totalComments * 1.5 + totalLikes) / totalViews
    : 0;

  // Normalise to 0-1 range (cap at 0.3 as "perfect" score)
  const authenticEngagementScore = Math.min(weightedEngagement / 0.3, 1);

  return {
    commentSentiment: 'mixed', // Placeholder — would need NLP to determine
    shareToViewRatio,
    saveToViewRatio,
    authenticEngagementScore,
  };
}

function compileKeyFindings(
  ownAccount: AccountProfile | null,
  ownRank: number,
  totalAccounts: number,
  gapToTop10: Record<string, number>,
  optimalDuration: { min: number; max: number },
  hashtagGaps: { underused: string[]; overused: string[]; recommended: string[] },
  engagementQuality: AnalysisSection['engagementQuality'],
  viralContent: ContentPost[]
): string[] {
  const findings: string[] = [];

  // Position finding
  if (ownAccount) {
    findings.push(
      `Your account ranks #${ownRank} out of ${totalAccounts} analysed accounts by total views.`
    );
  } else {
    findings.push('No own account data available — analysis is based on competitor data only.');
  }

  // Gap finding
  if (gapToTop10.followers && gapToTop10.followers > 0) {
    findings.push(
      `You need approximately ${gapToTop10.followers.toLocaleString()} more followers to match the top-10 average.`
    );
  }

  // Duration finding
  if (optimalDuration.max > 0) {
    findings.push(
      `Top-performing content is typically ${optimalDuration.min}–${optimalDuration.max} seconds long.`
    );
  }

  // Hashtag finding
  if (hashtagGaps.underused.length > 0) {
    findings.push(
      `${hashtagGaps.underused.length} high-performing hashtags are missing from your content.`
    );
  }
  if (hashtagGaps.overused.length > 0) {
    findings.push(
      `${hashtagGaps.overused.length} hashtags you use frequently are underperforming.`
    );
  }

  // Engagement quality finding
  if (engagementQuality.authenticEngagementScore > 0) {
    const score = Math.round(engagementQuality.authenticEngagementScore * 100);
    findings.push(
      `Authentic engagement score: ${score}/100 (weighted by saves, shares, and comments).`
    );
  }

  // Viral content finding
  if (viralContent.length > 0) {
    const topViews = viralContent[0].metrics.views;
    findings.push(
      `The highest-performing post across all accounts has ${topViews.toLocaleString()} views.`
    );
  }

  return findings;
}
