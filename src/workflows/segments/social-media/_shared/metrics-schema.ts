import type { PlatformId } from './platform-config.types';

// Normalized metric names that map across all platforms
export type NormalizedMetricId =
  | 'views' | 'likes' | 'shares' | 'comments' | 'saves'
  | 'followers' | 'engagement_rate' | 'reach' | 'impressions'
  | 'watch_time' | 'average_watch_time' | 'completion_rate'
  | 'click_through_rate' | 'profile_visits' | 'link_clicks';

export interface NormalizedMetric {
  id: NormalizedMetricId;
  displayName: string;
  description: string;
  dataType: 'number' | 'percentage' | 'duration';
  platformMapping: Partial<Record<PlatformId, string | null>>; // null = not available
}

// Define the full normalized metric schema
export const NORMALIZED_METRICS: NormalizedMetric[] = [
  { id: 'views', displayName: 'Views', description: 'Total content views/plays', dataType: 'number', platformMapping: { tiktok: 'plays', facebook: 'views', instagram: 'views', youtube: 'views' } },
  { id: 'likes', displayName: 'Likes', description: 'Total likes/reactions', dataType: 'number', platformMapping: { tiktok: 'likes', facebook: 'reactions', instagram: 'likes', youtube: 'likes' } },
  { id: 'shares', displayName: 'Shares', description: 'Total shares/reposts', dataType: 'number', platformMapping: { tiktok: 'shares', facebook: 'shares', instagram: 'shares', youtube: 'shares' } },
  { id: 'comments', displayName: 'Comments', description: 'Total comments', dataType: 'number', platformMapping: { tiktok: 'comments', facebook: 'comments', instagram: 'comments', youtube: 'comments' } },
  { id: 'saves', displayName: 'Saves', description: 'Content saves/bookmarks', dataType: 'number', platformMapping: { tiktok: 'saves', facebook: null, instagram: 'saves', youtube: null } },
  { id: 'followers', displayName: 'Followers', description: 'Account follower count', dataType: 'number', platformMapping: { tiktok: 'followers', facebook: 'followers', instagram: 'followers', youtube: 'subscribers' } },
  { id: 'engagement_rate', displayName: 'Engagement Rate', description: 'Engagement as % of views', dataType: 'percentage', platformMapping: { tiktok: 'engagement_rate', facebook: 'engagement_rate', instagram: 'engagement_rate', youtube: 'engagement_rate' } },
  { id: 'reach', displayName: 'Reach', description: 'Unique accounts reached', dataType: 'number', platformMapping: { tiktok: null, facebook: 'reach', instagram: 'reach', youtube: null } },
  { id: 'impressions', displayName: 'Impressions', description: 'Total impressions', dataType: 'number', platformMapping: { tiktok: null, facebook: 'impressions', instagram: 'impressions', youtube: 'impressions' } },
  { id: 'watch_time', displayName: 'Watch Time', description: 'Total watch time', dataType: 'duration', platformMapping: { tiktok: 'total_play_time', facebook: 'total_watch_time', instagram: null, youtube: 'watch_time_hours' } },
  { id: 'average_watch_time', displayName: 'Avg Watch Time', description: 'Average viewing duration', dataType: 'duration', platformMapping: { tiktok: 'avg_watch_time', facebook: 'avg_watch_time', instagram: null, youtube: 'avg_view_duration' } },
  { id: 'completion_rate', displayName: 'Completion Rate', description: '% watched to end', dataType: 'percentage', platformMapping: { tiktok: 'completion_rate', facebook: null, instagram: null, youtube: 'avg_percentage_viewed' } },
  { id: 'click_through_rate', displayName: 'CTR', description: 'Click-through rate', dataType: 'percentage', platformMapping: { tiktok: null, facebook: 'ctr', instagram: null, youtube: 'ctr' } },
  { id: 'profile_visits', displayName: 'Profile Visits', description: 'Profile page visits from content', dataType: 'number', platformMapping: { tiktok: 'profile_visits', facebook: null, instagram: 'profile_visits', youtube: null } },
  { id: 'link_clicks', displayName: 'Link Clicks', description: 'Clicks on links in content', dataType: 'number', platformMapping: { tiktok: null, facebook: 'link_clicks', instagram: 'link_clicks', youtube: null } },
];

// Helper functions
export function getAvailableMetrics(platform: PlatformId): NormalizedMetric[] {
  return NORMALIZED_METRICS.filter(m => m.platformMapping[platform] !== null && m.platformMapping[platform] !== undefined);
}

export function getPlatformMetricName(metricId: NormalizedMetricId, platform: PlatformId): string | null {
  const metric = NORMALIZED_METRICS.find(m => m.id === metricId);
  return metric?.platformMapping[platform] ?? null;
}

export function normalizeMetricValue(rawValue: number, metricId: NormalizedMetricId): number {
  // Percentages stored as decimals (e.g. 0.05 for 5%)
  const metric = NORMALIZED_METRICS.find(m => m.id === metricId);
  if (metric?.dataType === 'percentage' && rawValue > 1) {
    return rawValue / 100;
  }
  return rawValue;
}
