// Engagement metrics collector — pulls metrics at configurable intervals,
// normalizes across platforms, flags anomalies, and updates project memory.
// Designed to be triggered by n8n webhooks or cron schedules.

import type { PlatformId } from '../_shared/platform-config.types';
import type { ContentMetrics } from '../_shared/content-schema';
import type { NormalizedMetricId } from '../_shared/metrics-schema';
import type { Asset, AssetPerformanceSnapshot } from '../../../../assets/types';
import type { PerformanceBaseline } from '../../../../project/types';

import { getAvailableMetrics, NORMALIZED_METRICS } from '../_shared/metrics-schema';
import { getAssetsByProject, saveAsset } from '../../../../assets/asset-store';
import { addLearnedFact, updateBaseline, getBaselines } from '../../../../project/project-memory';

// ── Types ──────────────────────────────────────────────────────────────────

export type CollectionInterval = '1h' | '24h' | '72h' | '7d';

export interface MetricCollectionConfig {
  projectId: string;
  platform: PlatformId;
  assetIds: string[];          // Assets to collect metrics for
  intervals: CollectionInterval[];
  anomalyThreshold: number;     // standard deviations from mean to flag
}

export interface CollectedMetrics {
  assetId: string;
  platform: PlatformId;
  interval: CollectionInterval;
  metrics: AssetPerformanceSnapshot;
  previousMetrics?: AssetPerformanceSnapshot;
  delta: Partial<Record<NormalizedMetricId, number>>;
  anomalies: MetricAnomaly[];
  collectedAt: Date;
}

export interface MetricAnomaly {
  metric: NormalizedMetricId;
  currentValue: number;
  expectedValue: number;
  deviation: number;     // in standard deviations
  direction: 'above' | 'below';
  significance: 'low' | 'medium' | 'high';
}

// ── Interval helpers ──────────────────────────────────────────────────────

const INTERVAL_MS: Record<CollectionInterval, number> = {
  '1h':  1 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
};

function intervalLabel(interval: CollectionInterval): string {
  const labels: Record<CollectionInterval, string> = {
    '1h': '1 hour',
    '24h': '24 hours',
    '72h': '72 hours',
    '7d': '7 days',
  };
  return labels[interval];
}

// ── Core: collect metrics for a set of assets ─────────────────────────────

export async function collectMetrics(
  config: MetricCollectionConfig
): Promise<CollectedMetrics[]> {
  const results: CollectedMetrics[] = [];
  const allAssets = await getAssetsByProject(config.projectId);

  for (const assetId of config.assetIds) {
    const asset = allAssets.find(a => a.id === assetId);
    if (!asset) continue;

    // Only collect for published assets on the matching platform
    if (asset.platform !== config.platform) continue;

    for (const interval of config.intervals) {
      // Check if this interval is due (skip if last collection was too recent)
      const lastSnapshot = getLatestSnapshot(asset);
      if (lastSnapshot && !isIntervalDue(lastSnapshot.collectedAt, interval)) {
        continue;
      }

      // Fetch current metrics from the platform API
      const currentSnapshot = await fetchCurrentMetrics(asset, config.platform);
      const previousSnapshot = lastSnapshot ?? undefined;

      // Calculate deltas
      const delta = previousSnapshot
        ? calculateDelta(currentSnapshot, previousSnapshot)
        : {};

      // Detect anomalies against historical data
      const historicalSnapshots = getHistoricalSnapshots(asset);
      const anomalies = detectAnomalies(
        currentSnapshot,
        historicalSnapshots,
        config.anomalyThreshold
      );

      // Save the updated snapshot to the asset
      await savePerformanceSnapshot(asset, currentSnapshot);

      results.push({
        assetId,
        platform: config.platform,
        interval,
        metrics: currentSnapshot,
        previousMetrics: previousSnapshot,
        delta,
        anomalies,
        collectedAt: new Date(),
      });
    }
  }

  // Update project memory based on collected data
  if (results.length > 0) {
    await updateProjectMemoryFromMetrics(config.projectId, results);
  }

  return results;
}

// ── Convenience: collect for all published assets in a project ────────────

export async function collectMetricsForProject(
  projectId: string,
  interval: CollectionInterval
): Promise<CollectedMetrics[]> {
  const allAssets = await getAssetsByProject(projectId);

  // Group published assets by platform
  const publishedAssets = allAssets.filter(a => a.status === 'published' && a.platform);
  const platformGroups = new Map<PlatformId, string[]>();

  for (const asset of publishedAssets) {
    if (!asset.platform) continue;
    const platform = asset.platform as PlatformId;
    const existing = platformGroups.get(platform) ?? [];
    existing.push(asset.id);
    platformGroups.set(platform, existing);
  }

  const allResults: CollectedMetrics[] = [];

  for (const [platform, assetIds] of platformGroups) {
    const config: MetricCollectionConfig = {
      projectId,
      platform,
      assetIds,
      intervals: [interval],
      anomalyThreshold: 2.0, // default: flag anything > 2 std devs
    };

    const results = await collectMetrics(config);
    allResults.push(...results);
  }

  return allResults;
}

// ── Anomaly detection ─────────────────────────────────────────────────────

export function detectAnomalies(
  current: AssetPerformanceSnapshot,
  historical: AssetPerformanceSnapshot[],
  threshold: number
): MetricAnomaly[] {
  if (historical.length < 3) {
    // Not enough data to compute meaningful statistics
    return [];
  }

  const anomalies: MetricAnomaly[] = [];
  const metricIds: NormalizedMetricId[] = [
    'views', 'likes', 'shares', 'comments', 'saves',
    'engagement_rate', 'reach', 'impressions',
    'watch_time', 'completion_rate',
  ];

  for (const metricId of metricIds) {
    const currentValue = getSnapshotMetricValue(current, metricId);
    if (currentValue === null) continue;

    const historicalValues = historical
      .map(h => getSnapshotMetricValue(h, metricId))
      .filter((v): v is number => v !== null);

    if (historicalValues.length < 3) continue;

    const mean = historicalValues.reduce((sum, v) => sum + v, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) continue; // No variation in historical data

    const deviation = (currentValue - mean) / stdDev;
    const absDeviation = Math.abs(deviation);

    if (absDeviation >= threshold) {
      const direction: 'above' | 'below' = deviation > 0 ? 'above' : 'below';
      const significance: 'low' | 'medium' | 'high' =
        absDeviation >= threshold * 2 ? 'high' :
        absDeviation >= threshold * 1.5 ? 'medium' : 'low';

      anomalies.push({
        metric: metricId,
        currentValue,
        expectedValue: mean,
        deviation: Math.round(absDeviation * 100) / 100,
        direction,
        significance,
      });
    }
  }

  return anomalies;
}

// ── Delta calculation ─────────────────────────────────────────────────────

export function calculateDelta(
  current: AssetPerformanceSnapshot,
  previous: AssetPerformanceSnapshot
): Partial<Record<NormalizedMetricId, number>> {
  const delta: Partial<Record<NormalizedMetricId, number>> = {};
  const metricIds: NormalizedMetricId[] = [
    'views', 'likes', 'shares', 'comments', 'saves',
    'engagement_rate', 'reach', 'impressions',
    'watch_time', 'completion_rate',
  ];

  for (const metricId of metricIds) {
    const currentValue = getSnapshotMetricValue(current, metricId);
    const previousValue = getSnapshotMetricValue(previous, metricId);

    if (currentValue !== null && previousValue !== null) {
      delta[metricId] = currentValue - previousValue;
    }
  }

  return delta;
}

// ── Project memory updates ────────────────────────────────────────────────

export async function updateProjectMemoryFromMetrics(
  projectId: string,
  collected: CollectedMetrics[]
): Promise<void> {
  // Group by platform
  const byPlatform = new Map<PlatformId, CollectedMetrics[]>();
  for (const item of collected) {
    const existing = byPlatform.get(item.platform) ?? [];
    existing.push(item);
    byPlatform.set(item.platform, existing);
  }

  for (const [platform, items] of byPlatform) {
    // Add learned facts for significant anomalies
    const highAnomalies = items.flatMap(i =>
      i.anomalies.filter(a => a.significance === 'high')
    );

    for (const anomaly of highAnomalies) {
      const directionText = anomaly.direction === 'above' ? 'spike' : 'drop';
      await addLearnedFact(projectId, {
        id: crypto.randomUUID(),
        projectId,
        platform,
        category: 'performance',
        fact: `Significant ${directionText} detected in ${anomaly.metric}: ` +
              `${anomaly.currentValue.toLocaleString()} vs expected ` +
              `${anomaly.expectedValue.toLocaleString()} ` +
              `(${anomaly.deviation.toFixed(1)} std devs ${anomaly.direction} mean)`,
        confidence: anomaly.significance === 'high' ? 0.95 : 0.8,
        source: 'metrics_collector',
        learnedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    }

    // Update performance baselines with latest averages
    const metricTotals = new Map<NormalizedMetricId, { sum: number; count: number }>();

    for (const item of items) {
      const metricIds: NormalizedMetricId[] = [
        'views', 'likes', 'shares', 'comments', 'saves', 'engagement_rate',
      ];

      for (const metricId of metricIds) {
        const value = getSnapshotMetricValue(item.metrics, metricId);
        if (value === null) continue;

        const existing = metricTotals.get(metricId) ?? { sum: 0, count: 0 };
        existing.sum += value;
        existing.count += 1;
        metricTotals.set(metricId, existing);
      }
    }

    for (const [metricId, totals] of metricTotals) {
      if (totals.count === 0) continue;
      const avgValue = totals.sum / totals.count;

      await updateBaseline(projectId, {
        metric: metricId,
        platform,
        value: avgValue,
        measuredAt: new Date(),
        sampleSize: totals.count,
      });
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

function getSnapshotMetricValue(
  snapshot: AssetPerformanceSnapshot,
  metricId: NormalizedMetricId
): number | null {
  // AssetPerformanceSnapshot stores metrics as a record keyed by NormalizedMetricId
  const metrics = snapshot.metrics as Partial<Record<NormalizedMetricId, number>> | undefined;
  if (!metrics) return null;
  return metrics[metricId] ?? null;
}

function getLatestSnapshot(asset: Asset): AssetPerformanceSnapshot | null {
  const snapshots = asset.performanceSnapshots;
  if (!snapshots || snapshots.length === 0) return null;
  return snapshots.reduce((latest, s) =>
    new Date(s.collectedAt) > new Date(latest.collectedAt) ? s : latest
  );
}

function getHistoricalSnapshots(asset: Asset): AssetPerformanceSnapshot[] {
  return asset.performanceSnapshots ?? [];
}

function isIntervalDue(lastCollectedAt: Date, interval: CollectionInterval): boolean {
  const elapsed = Date.now() - new Date(lastCollectedAt).getTime();
  return elapsed >= INTERVAL_MS[interval];
}

async function fetchCurrentMetrics(
  asset: Asset,
  platform: PlatformId
): Promise<AssetPerformanceSnapshot> {
  // In production, this would call the platform's API (or a scraper)
  // to fetch current engagement metrics for the published content.
  // For now, it returns a placeholder that downstream integrations
  // (n8n webhooks, Apify actors) will populate.

  // TODO: Integrate with platform-scraper for live metric fetching
  // The actual implementation will depend on:
  // - TikTok: Apify TikTok Scraper actor or TikTok API
  // - Instagram: Apify Instagram Scraper or Graph API
  // - Facebook: Graph API with page access token
  // - YouTube: YouTube Data API v3

  return {
    assetId: asset.id,
    platform,
    metrics: {},
    collectedAt: new Date(),
  } as AssetPerformanceSnapshot;
}

async function savePerformanceSnapshot(
  asset: Asset,
  snapshot: AssetPerformanceSnapshot
): Promise<void> {
  // Append the new snapshot to the asset's performance history
  const updatedAsset: Asset = {
    ...asset,
    performanceSnapshots: [
      ...(asset.performanceSnapshots ?? []),
      snapshot,
    ],
  };

  await saveAsset(updatedAsset);
}
