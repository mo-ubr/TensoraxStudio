import type { PlatformId } from './platform-config.types';
import type { LanguageCode } from '../../../../project/types';

export interface ContentPost {
  id: string;
  platform: PlatformId;
  accountHandle: string;
  postType: string; // 'video', 'photo', 'reel', 'story', 'carousel', 'short', 'text'
  caption: string;
  hashtags: string[];
  mentions: string[];
  url: string;
  publishedAt: Date;
  duration?: number; // seconds, for video content
  language?: LanguageCode;
  metrics: ContentMetrics;
  isPromoted: boolean;
  promotionData?: PromotionData;
}

export interface ContentMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  engagementRate: number;
  reach?: number;
  impressions?: number;
  watchTime?: number;
  completionRate?: number;
  collectedAt: Date;
}

export interface AccountProfile {
  platform: PlatformId;
  handle: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  averageViewsPerPost: number;
  profileUrl: string;
  verified: boolean;
  category?: string;
  joinedAt?: Date;
  lastPostAt?: Date;
}

export interface HashtagAnalysis {
  hashtag: string;
  platform: PlatformId;
  totalPosts: number;
  totalViews: number;
  averageViewsPerPost: number;
  usageCount: number;
  trend: 'rising' | 'stable' | 'declining';
  relevanceScore: number; // 0-1
}

export interface PromotionData {
  budget: number;
  spent: number;
  currency: string;
  views: number;
  costPerView: number;
  costPerFollower?: number;
  status: 'active' | 'completed' | 'paused' | 'rejected';
  startDate: Date;
  endDate?: Date;
}

export interface CompetitorAnalysis {
  account: AccountProfile;
  posts: ContentPost[];
  topPosts: ContentPost[];
  hashtagOverlap: string[];
  strengthAreas: string[];
  weaknessAreas: string[];
  postingFrequency: number; // posts per week
  averageEngagementRate: number;
  growthTrend: 'growing' | 'stable' | 'declining';
}

export interface ResearchReport {
  id: string;
  projectId: string;
  platform: PlatformId;
  generatedAt: Date;
  language: LanguageCode;
  overview: AccountProfile[];
  ownChannel: ContentPost[];
  competitors: CompetitorAnalysis[];
  topViral: ContentPost[];
  allPosts: ContentPost[];
  hashtags: HashtagAnalysis[];
  analysis: AnalysisSection;
  recommendations: RecommendationSection;
  promotions?: PromotionData[];
}

export interface AnalysisSection {
  currentPosition: {
    rank: number;
    totalAccounts: number;
    gapToTop10: Record<string, number>;
  };
  viralVideoAnalysis: {
    commonThemes: string[];
    optimalDuration: { min: number; max: number };
    bestFormats: string[];
    peakPostingTimes: string[];
  };
  hashtagGaps: {
    underused: string[];
    overused: string[];
    recommended: string[];
  };
  engagementQuality: {
    commentSentiment: 'positive' | 'mixed' | 'negative';
    shareToViewRatio: number;
    saveToViewRatio: number;
    authenticEngagementScore: number;
  };
  keyFindings: string[];
}

export interface RecommendationSection {
  algorithmSignals: { signal: string; weight: string; action: string }[];
  targetAudience: { primary: string; secondary: string[]; notes: string };
  setupChecklist: { item: string; howTo: string; priority: string }[];
  actionPlan: { day: string; action: string; details: string }[];
  contentCalendar: { dayOfWeek: string; time: string; format: string; topic: string }[];
  growthTargets: { metric: string; current: number; target: number; timeframe: string }[];
  contentSeries: { name: string; format: string; frequency: string; percentage: number }[];
}
