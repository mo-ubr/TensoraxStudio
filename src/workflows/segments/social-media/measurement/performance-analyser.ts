// Performance analyser — compares actual vs predicted engagement,
// identifies best performers, analyses timing/hashtag/content-type patterns,
// and generates structured reports saved as assets.

import type { PlatformId } from '../_shared/platform-config.types';
import type { Asset, AssetPerformanceSnapshot, AssetCategory } from '../../../../assets/types';
import type { LanguageCode, PerformanceBaseline } from '../../../../project/types';
import type { NormalizedMetricId } from '../_shared/metrics-schema';

import { getAssetsByProject, saveAsset } from '../../../../assets/asset-store';
import { getBaselines, updateBaseline } from '../../../../project/project-memory';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PerformanceReport {
  projectId: string;
  platform: PlatformId;
  period: { from: Date; to: Date };
  generatedAt: Date;
  language: LanguageCode;
  summary: PerformanceSummary;
  topPerformers: AssetPerformanceRanking[];
  contentTypeAnalysis: ContentTypePerformance[];
  timingAnalysis: TimingPerformance[];
  hashtagPerformance: HashtagPerformanceEntry[];
  trends: PerformanceTrend[];
  insights: string[];
  recommendations: string[];
}

export interface PerformanceSummary {
  totalAssets: number;
  totalViews: number;
  totalEngagement: number;
  averageEngagementRate: number;
  bestPerformingCategory: AssetCategory;
  worstPerformingCategory: AssetCategory;
  periodOverPeriodChange: number; // percentage
}

export interface AssetPerformanceRanking {
  asset: Asset;
  rank: number;
  metrics: AssetPerformanceSnapshot;
  engagementRate: number;
  performanceScore: number; // 0-100 normalized
}

export interface ContentTypePerformance {
  contentType: string;
  count: number;
  averageViews: number;
  averageEngagement: number;
  averageEngagementRate: number;
  bestExample: Asset;
}

export interface TimingPerformance {
  dayOfWeek: string;
  hourRange: string;
  postsCount: number;
  averageViews: number;
  averageEngagementRate: number;
  recommendation: string;
}

export interface HashtagPerformanceEntry {
  hashtag: string;
  usageCount: number;
  averageViews: number;
  averageEngagementRate: number;
  trend: 'rising' | 'stable' | 'declining';
}

export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'stable' | 'declining';
  changePercent: number;
  period: string;
  dataPoints: { date: Date; value: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getMetricValue(snapshot: AssetPerformanceSnapshot, metricId: NormalizedMetricId): number {
  const metrics = snapshot.metrics as Partial<Record<NormalizedMetricId, number>> | undefined;
  return metrics?.[metricId] ?? 0;
}

function getLatestSnapshot(asset: Asset): AssetPerformanceSnapshot | null {
  const snapshots = asset.performanceSnapshots;
  if (!snapshots || snapshots.length === 0) return null;
  return snapshots.reduce((latest, s) =>
    new Date(s.collectedAt) > new Date(latest.collectedAt) ? s : latest
  );
}

function computeEngagementRate(snapshot: AssetPerformanceSnapshot): number {
  const views = getMetricValue(snapshot, 'views');
  if (views === 0) return 0;

  const likes = getMetricValue(snapshot, 'likes');
  const comments = getMetricValue(snapshot, 'comments');
  const shares = getMetricValue(snapshot, 'shares');
  const saves = getMetricValue(snapshot, 'saves');
  const totalEngagement = likes + comments + shares + saves;

  return totalEngagement / views;
}

function computePerformanceScore(snapshot: AssetPerformanceSnapshot, maxViews: number, maxEngRate: number): number {
  const views = getMetricValue(snapshot, 'views');
  const engRate = computeEngagementRate(snapshot);

  // Weighted score: 60% views (normalised), 40% engagement rate (normalised)
  const viewScore = maxViews > 0 ? (views / maxViews) * 60 : 0;
  const engScore = maxEngRate > 0 ? (engRate / maxEngRate) * 40 : 0;

  return Math.min(100, Math.round((viewScore + engScore) * 100) / 100);
}

function getAssetPublishDate(asset: Asset): Date {
  // Use the createdAt as a proxy for publish date
  return new Date(asset.createdAt);
}

// ── Main analysis function ────────────────────────────────────────────────

export async function analyzePerformance(
  projectId: string,
  platform: PlatformId,
  period: { from: Date; to: Date }
): Promise<PerformanceReport> {
  const allAssets = await getAssetsByProject(projectId);

  // Filter to published assets on the target platform within the period
  const periodAssets = allAssets.filter(asset => {
    if (asset.platform !== platform) return false;
    if (asset.status !== 'published') return false;

    const publishDate = getAssetPublishDate(asset);
    return publishDate >= period.from && publishDate <= period.to;
  });

  // Build rankings
  const topPerformers = identifyTopPerformers(periodAssets);

  // Content type analysis
  const contentTypeAnalysis = analyzeContentTypes(periodAssets);

  // Timing analysis
  const timingAnalysis = analyzeTiming(periodAssets);

  // Hashtag performance
  const hashtagPerformance = analyzeHashtags(periodAssets);

  // Trends
  const trends = analyzeTrends(periodAssets, period);

  // Compute summary
  const summary = computeSummary(periodAssets, topPerformers, contentTypeAnalysis, period);

  // Generate insights and recommendations from the data
  const insights = generateInsights(summary, topPerformers, contentTypeAnalysis, timingAnalysis, hashtagPerformance, trends);
  const recommendations = generateRecommendations(summary, contentTypeAnalysis, timingAnalysis, hashtagPerformance, trends);

  const report: PerformanceReport = {
    projectId,
    platform,
    period,
    generatedAt: new Date(),
    language: 'en' as LanguageCode,
    summary,
    topPerformers,
    contentTypeAnalysis,
    timingAnalysis,
    hashtagPerformance,
    trends,
    insights,
    recommendations,
  };

  // Save the report as an asset
  await saveReportAsAsset(projectId, platform, report);

  return report;
}

// ── Baseline comparison ───────────────────────────────────────────────────

export async function compareToBaseline(
  projectId: string,
  platform: PlatformId
): Promise<{ metric: string; baseline: number; current: number; change: number }[]> {
  const baselines = await getBaselines(projectId);
  const platformBaselines = baselines.filter(b => b.platform === platform);

  if (platformBaselines.length === 0) return [];

  const allAssets = await getAssetsByProject(projectId);
  const publishedAssets = allAssets.filter(
    a => a.platform === platform && a.status === 'published'
  );

  const results: { metric: string; baseline: number; current: number; change: number }[] = [];

  for (const baseline of platformBaselines) {
    const metricId = baseline.metric as NormalizedMetricId;
    const currentValues = publishedAssets
      .map(a => {
        const snap = getLatestSnapshot(a);
        return snap ? getMetricValue(snap, metricId) : null;
      })
      .filter((v): v is number => v !== null);

    if (currentValues.length === 0) continue;

    const currentAvg = currentValues.reduce((s, v) => s + v, 0) / currentValues.length;
    const change = baseline.value !== 0
      ? ((currentAvg - baseline.value) / baseline.value) * 100
      : 0;

    results.push({
      metric: baseline.metric,
      baseline: baseline.value,
      current: Math.round(currentAvg * 100) / 100,
      change: Math.round(change * 100) / 100,
    });
  }

  return results;
}

// ── Top performers ────────────────────────────────────────────────────────

export function identifyTopPerformers(
  assets: Asset[],
  topN: number = 10
): AssetPerformanceRanking[] {
  const assetsWithMetrics = assets
    .map(asset => {
      const snapshot = getLatestSnapshot(asset);
      if (!snapshot) return null;
      return { asset, snapshot };
    })
    .filter((item): item is { asset: Asset; snapshot: AssetPerformanceSnapshot } => item !== null);

  if (assetsWithMetrics.length === 0) return [];

  // Find max values for normalisation
  const maxViews = Math.max(...assetsWithMetrics.map(a => getMetricValue(a.snapshot, 'views')));
  const maxEngRate = Math.max(...assetsWithMetrics.map(a => computeEngagementRate(a.snapshot)));

  // Score and sort
  const ranked = assetsWithMetrics
    .map(({ asset, snapshot }) => ({
      asset,
      rank: 0,
      metrics: snapshot,
      engagementRate: computeEngagementRate(snapshot),
      performanceScore: computePerformanceScore(snapshot, maxViews, maxEngRate),
    }))
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, topN)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return ranked;
}

// ── Content type analysis ─────────────────────────────────────────────────

export function analyzeContentTypes(assets: Asset[]): ContentTypePerformance[] {
  const typeGroups = new Map<string, Asset[]>();

  for (const asset of assets) {
    const contentType = asset.assetType ?? 'unknown';
    const existing = typeGroups.get(contentType) ?? [];
    existing.push(asset);
    typeGroups.set(contentType, existing);
  }

  const results: ContentTypePerformance[] = [];

  for (const [contentType, groupAssets] of typeGroups) {
    const assetsWithMetrics = groupAssets
      .map(asset => {
        const snapshot = getLatestSnapshot(asset);
        return snapshot ? { asset, snapshot } : null;
      })
      .filter((item): item is { asset: Asset; snapshot: AssetPerformanceSnapshot } => item !== null);

    if (assetsWithMetrics.length === 0) continue;

    const totalViews = assetsWithMetrics.reduce((s, a) => s + getMetricValue(a.snapshot, 'views'), 0);
    const totalEngagement = assetsWithMetrics.reduce((s, a) => {
      const snap = a.snapshot;
      return s + getMetricValue(snap, 'likes') + getMetricValue(snap, 'comments') +
             getMetricValue(snap, 'shares') + getMetricValue(snap, 'saves');
    }, 0);
    const totalEngRate = assetsWithMetrics.reduce((s, a) => s + computeEngagementRate(a.snapshot), 0);

    const count = assetsWithMetrics.length;

    // Find best example by views
    const bestItem = assetsWithMetrics.reduce((best, current) =>
      getMetricValue(current.snapshot, 'views') > getMetricValue(best.snapshot, 'views')
        ? current : best
    );

    results.push({
      contentType,
      count,
      averageViews: Math.round(totalViews / count),
      averageEngagement: Math.round(totalEngagement / count),
      averageEngagementRate: Math.round((totalEngRate / count) * 10000) / 10000,
      bestExample: bestItem.asset,
    });
  }

  // Sort by average engagement rate descending
  return results.sort((a, b) => b.averageEngagementRate - a.averageEngagementRate);
}

// ── Timing analysis ───────────────────────────────────────────────────────

export function analyzeTiming(assets: Asset[]): TimingPerformance[] {
  // Group by day-of-week and 3-hour time blocks
  const timeBuckets = new Map<string, { views: number[]; engRates: number[]; count: number }>();

  for (const asset of assets) {
    const snapshot = getLatestSnapshot(asset);
    if (!snapshot) continue;

    const publishDate = getAssetPublishDate(asset);
    const dayOfWeek = DAYS_OF_WEEK[publishDate.getDay()];
    const hour = publishDate.getHours();
    const hourBlock = Math.floor(hour / 3) * 3;
    const hourRange = `${String(hourBlock).padStart(2, '0')}:00–${String(hourBlock + 3).padStart(2, '0')}:00`;
    const key = `${dayOfWeek}|${hourRange}`;

    const existing = timeBuckets.get(key) ?? { views: [], engRates: [], count: 0 };
    existing.views.push(getMetricValue(snapshot, 'views'));
    existing.engRates.push(computeEngagementRate(snapshot));
    existing.count += 1;
    timeBuckets.set(key, existing);
  }

  const results: TimingPerformance[] = [];

  for (const [key, bucket] of timeBuckets) {
    const [dayOfWeek, hourRange] = key.split('|');
    const avgViews = bucket.views.reduce((s, v) => s + v, 0) / bucket.count;
    const avgEngRate = bucket.engRates.reduce((s, v) => s + v, 0) / bucket.count;

    let recommendation = 'Neutral posting time.';
    if (avgEngRate > 0.05) {
      recommendation = 'High-engagement time slot — prioritise posting here.';
    } else if (avgEngRate > 0.03) {
      recommendation = 'Above-average engagement — good secondary slot.';
    } else if (avgEngRate < 0.01) {
      recommendation = 'Low engagement — consider avoiding this slot.';
    }

    results.push({
      dayOfWeek,
      hourRange,
      postsCount: bucket.count,
      averageViews: Math.round(avgViews),
      averageEngagementRate: Math.round(avgEngRate * 10000) / 10000,
      recommendation,
    });
  }

  // Sort by engagement rate descending
  return results.sort((a, b) => b.averageEngagementRate - a.averageEngagementRate);
}

// ── Hashtag analysis ──────────────────────────────────────────────────────

function analyzeHashtags(assets: Asset[]): HashtagPerformanceEntry[] {
  const hashtagData = new Map<string, { views: number[]; engRates: number[]; count: number; dates: Date[] }>();

  for (const asset of assets) {
    const snapshot = getLatestSnapshot(asset);
    if (!snapshot) continue;

    const tags = asset.tags ?? [];
    const views = getMetricValue(snapshot, 'views');
    const engRate = computeEngagementRate(snapshot);
    const date = getAssetPublishDate(asset);

    for (const tag of tags) {
      if (!tag.startsWith('#')) continue;
      const normalised = tag.toLowerCase();
      const existing = hashtagData.get(normalised) ?? { views: [], engRates: [], count: 0, dates: [] };
      existing.views.push(views);
      existing.engRates.push(engRate);
      existing.count += 1;
      existing.dates.push(date);
      hashtagData.set(normalised, existing);
    }
  }

  const results: HashtagPerformanceEntry[] = [];

  for (const [hashtag, data] of hashtagData) {
    const avgViews = data.views.reduce((s, v) => s + v, 0) / data.count;
    const avgEngRate = data.engRates.reduce((s, v) => s + v, 0) / data.count;

    // Determine trend by comparing first half vs second half usage
    const sortedDates = [...data.dates].sort((a, b) => a.getTime() - b.getTime());
    const midIndex = Math.floor(sortedDates.length / 2);
    const firstHalfCount = midIndex;
    const secondHalfCount = sortedDates.length - midIndex;

    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    if (sortedDates.length >= 4) {
      if (secondHalfCount > firstHalfCount * 1.3) trend = 'rising';
      else if (secondHalfCount < firstHalfCount * 0.7) trend = 'declining';
    }

    results.push({
      hashtag,
      usageCount: data.count,
      averageViews: Math.round(avgViews),
      averageEngagementRate: Math.round(avgEngRate * 10000) / 10000,
      trend,
    });
  }

  return results.sort((a, b) => b.averageEngagementRate - a.averageEngagementRate);
}

// ── Trend analysis ────────────────────────────────────────────────────────

function analyzeTrends(
  assets: Asset[],
  period: { from: Date; to: Date }
): PerformanceTrend[] {
  const trackedMetrics: NormalizedMetricId[] = ['views', 'likes', 'engagement_rate', 'shares'];
  const trends: PerformanceTrend[] = [];

  // Sort assets by date
  const sorted = [...assets]
    .map(a => ({ asset: a, date: getAssetPublishDate(a), snapshot: getLatestSnapshot(a) }))
    .filter((item): item is { asset: Asset; date: Date; snapshot: AssetPerformanceSnapshot } => item.snapshot !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length < 4) return trends;

  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  for (const metricId of trackedMetrics) {
    const firstValues = firstHalf.map(s => getMetricValue(s.snapshot, metricId));
    const secondValues = secondHalf.map(s => getMetricValue(s.snapshot, metricId));

    const firstAvg = firstValues.reduce((s, v) => s + v, 0) / firstValues.length;
    const secondAvg = secondValues.reduce((s, v) => s + v, 0) / secondValues.length;

    const changePercent = firstAvg !== 0
      ? Math.round(((secondAvg - firstAvg) / firstAvg) * 10000) / 100
      : 0;

    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    if (changePercent > 10) direction = 'improving';
    else if (changePercent < -10) direction = 'declining';

    const periodDays = Math.round(
      (period.to.getTime() - period.from.getTime()) / (1000 * 60 * 60 * 24)
    );

    const dataPoints = sorted.map(s => ({
      date: s.date,
      value: getMetricValue(s.snapshot, metricId),
    }));

    const metricDef = NORMALIZED_METRICS_DISPLAY[metricId] ?? metricId;

    trends.push({
      metric: metricDef,
      direction,
      changePercent,
      period: `${periodDays} days`,
      dataPoints,
    });
  }

  return trends;
}

const NORMALIZED_METRICS_DISPLAY: Partial<Record<NormalizedMetricId, string>> = {
  views: 'Views',
  likes: 'Likes',
  shares: 'Shares',
  comments: 'Comments',
  saves: 'Saves',
  engagement_rate: 'Engagement Rate',
  reach: 'Reach',
  impressions: 'Impressions',
  watch_time: 'Watch Time',
  completion_rate: 'Completion Rate',
};

// ── Summary computation ───────────────────────────────────────────────────

function computeSummary(
  assets: Asset[],
  topPerformers: AssetPerformanceRanking[],
  contentTypes: ContentTypePerformance[],
  period: { from: Date; to: Date }
): PerformanceSummary {
  let totalViews = 0;
  let totalEngagement = 0;
  let engRateSum = 0;
  let assetCount = 0;

  for (const asset of assets) {
    const snapshot = getLatestSnapshot(asset);
    if (!snapshot) continue;

    totalViews += getMetricValue(snapshot, 'views');
    totalEngagement += getMetricValue(snapshot, 'likes') + getMetricValue(snapshot, 'comments') +
                       getMetricValue(snapshot, 'shares') + getMetricValue(snapshot, 'saves');
    engRateSum += computeEngagementRate(snapshot);
    assetCount += 1;
  }

  const avgEngRate = assetCount > 0 ? engRateSum / assetCount : 0;

  // Best and worst content type categories
  const bestType = contentTypes.length > 0
    ? contentTypes[0].contentType as AssetCategory
    : 'video' as AssetCategory;
  const worstType = contentTypes.length > 0
    ? contentTypes[contentTypes.length - 1].contentType as AssetCategory
    : 'video' as AssetCategory;

  return {
    totalAssets: assetCount,
    totalViews,
    totalEngagement,
    averageEngagementRate: Math.round(avgEngRate * 10000) / 10000,
    bestPerformingCategory: bestType,
    worstPerformingCategory: worstType,
    periodOverPeriodChange: 0, // Requires previous period data to compute
  };
}

// ── Insight generation ────────────────────────────────────────────────────

function generateInsights(
  summary: PerformanceSummary,
  topPerformers: AssetPerformanceRanking[],
  contentTypes: ContentTypePerformance[],
  timing: TimingPerformance[],
  hashtags: HashtagPerformanceEntry[],
  trends: PerformanceTrend[]
): string[] {
  const insights: string[] = [];

  // Overall performance
  if (summary.totalAssets > 0) {
    insights.push(
      `${summary.totalAssets} assets published, generating ${summary.totalViews.toLocaleString()} total views ` +
      `with an average engagement rate of ${(summary.averageEngagementRate * 100).toFixed(2)}%.`
    );
  }

  // Top performer insight
  if (topPerformers.length > 0) {
    const top = topPerformers[0];
    insights.push(
      `Top performer: "${top.asset.name}" with a performance score of ${top.performanceScore}/100 ` +
      `and ${(top.engagementRate * 100).toFixed(2)}% engagement rate.`
    );
  }

  // Best content type
  if (contentTypes.length > 1) {
    const best = contentTypes[0];
    const worst = contentTypes[contentTypes.length - 1];
    if (best.averageEngagementRate > worst.averageEngagementRate * 2) {
      insights.push(
        `"${best.contentType}" content outperforms "${worst.contentType}" by ` +
        `${Math.round((best.averageEngagementRate / worst.averageEngagementRate) * 10) / 10}x in engagement.`
      );
    }
  }

  // Best timing
  if (timing.length > 0) {
    const bestSlot = timing[0];
    insights.push(
      `Best posting time: ${bestSlot.dayOfWeek} ${bestSlot.hourRange} ` +
      `(${(bestSlot.averageEngagementRate * 100).toFixed(2)}% avg engagement rate).`
    );
  }

  // Rising hashtags
  const risingTags = hashtags.filter(h => h.trend === 'rising');
  if (risingTags.length > 0) {
    insights.push(
      `Rising hashtags: ${risingTags.slice(0, 3).map(h => h.hashtag).join(', ')}.`
    );
  }

  // Trend insights
  const improvingTrends = trends.filter(t => t.direction === 'improving');
  const decliningTrends = trends.filter(t => t.direction === 'declining');
  if (improvingTrends.length > 0) {
    insights.push(
      `Improving metrics: ${improvingTrends.map(t => `${t.metric} (+${t.changePercent}%)`).join(', ')}.`
    );
  }
  if (decliningTrends.length > 0) {
    insights.push(
      `Declining metrics: ${decliningTrends.map(t => `${t.metric} (${t.changePercent}%)`).join(', ')}.`
    );
  }

  return insights;
}

// ── Recommendation generation ─────────────────────────────────────────────

function generateRecommendations(
  summary: PerformanceSummary,
  contentTypes: ContentTypePerformance[],
  timing: TimingPerformance[],
  hashtags: HashtagPerformanceEntry[],
  trends: PerformanceTrend[]
): string[] {
  const recommendations: string[] = [];

  // Content type recommendations
  if (contentTypes.length > 1) {
    const bestType = contentTypes[0];
    recommendations.push(
      `Increase "${bestType.contentType}" content — it has the highest engagement rate ` +
      `(${(bestType.averageEngagementRate * 100).toFixed(2)}%).`
    );
  }

  // Timing recommendations
  if (timing.length > 0) {
    const topSlots = timing.slice(0, 3);
    recommendations.push(
      `Prioritise posting on: ${topSlots.map(t => `${t.dayOfWeek} ${t.hourRange}`).join(', ')}.`
    );
  }

  // Hashtag recommendations
  const topHashtags = hashtags.filter(h => h.trend !== 'declining').slice(0, 5);
  if (topHashtags.length > 0) {
    recommendations.push(
      `Use these high-performing hashtags: ${topHashtags.map(h => h.hashtag).join(' ')}.`
    );
  }

  // Trend-based recommendations
  const declining = trends.filter(t => t.direction === 'declining');
  for (const trend of declining) {
    recommendations.push(
      `${trend.metric} is declining (${trend.changePercent}%) — review recent content strategy for this metric.`
    );
  }

  // Volume recommendation
  if (summary.totalAssets < 10) {
    recommendations.push(
      'Publishing volume is low — aim for at least 3-5 posts per week to build momentum.'
    );
  }

  return recommendations;
}

// ── Baseline updates ──────────────────────────────────────────────────────

export async function updateBaselinesFromAnalysis(
  projectId: string,
  report: PerformanceReport
): Promise<void> {
  const metricUpdates: { metric: NormalizedMetricId; value: number }[] = [
    { metric: 'views', value: report.summary.totalViews / Math.max(report.summary.totalAssets, 1) },
    { metric: 'engagement_rate', value: report.summary.averageEngagementRate },
  ];

  // Add top performer's metrics as aspirational baselines
  if (report.topPerformers.length > 0) {
    const topSnapshot = report.topPerformers[0].metrics;
    const topViews = getMetricValue(topSnapshot, 'views');
    if (topViews > 0) {
      metricUpdates.push({ metric: 'views', value: topViews });
    }
  }

  for (const update of metricUpdates) {
    await updateBaseline(projectId, {
      metric: update.metric,
      platform: report.platform,
      value: update.value,
      measuredAt: report.generatedAt,
      sampleSize: report.summary.totalAssets,
    });
  }
}

// ── Save report as asset ──────────────────────────────────────────────────

async function saveReportAsAsset(
  projectId: string,
  platform: PlatformId,
  report: PerformanceReport
): Promise<void> {
  const reportJson = JSON.stringify(report);
  const sizeBytes = new TextEncoder().encode(reportJson).length;
  const dateStr = report.generatedAt.toISOString().slice(0, 10);

  const asset: Asset = {
    id: crypto.randomUUID(),
    projectId,
    executionId: `perf-${platform}-${dateStr}`,
    segmentId: `performance-${platform}`,
    name: `Performance Report — ${platform} (${dateStr})`,
    assetType: 'document',
    category: 'performance_report' as AssetCategory,
    language: report.language,
    languageVariantGroup: undefined,
    isTranslation: false,
    filename: `performance-${platform}-${dateStr}.json`,
    mimeType: 'application/json',
    sizeBytes,
    storagePath: `assets/0. Projects/${projectId}/measurement/${platform}/`,
    textPreview: report.insights.slice(0, 2).join(' | '),
    createdAt: new Date(),
    tags: [platform, 'performance', 'report'],
    platform,
    status: 'draft',
    version: 1,
  };

  await saveAsset(asset);
}
