export type PlatformId = 'tiktok' | 'facebook' | 'instagram' | 'youtube';

export interface PlatformConfig {
  platform: PlatformId;
  displayName: string;
  metrics: MetricDefinition[];
  algorithmSignals: AlgorithmSignal[];
  contentFormats: ContentFormat[];
  optimalTiming: TimingConfig;
  audienceProfile: AudienceProfile;
  scrapingMethod: 'api' | 'browser' | 'thirdParty';
  setupChecklist: SetupItem[];
  paidAdvertising: PaidAdvertisingConfig;
}

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  dataType: 'number' | 'percentage' | 'duration' | 'ratio';
  aggregation: 'sum' | 'average' | 'max' | 'min' | 'median';
  higherIsBetter: boolean;
  platformSpecific: boolean;
  available: boolean;
}

export interface AlgorithmSignal {
  signal: string;
  weight: 'highest' | 'very_high' | 'high' | 'medium' | 'low';
  description: string;
  actionable: boolean;
  tips: string[];
}

export interface ContentFormat {
  id: string;
  name: string;
  description: string;
  maxDuration?: number; // seconds
  aspectRatios: string[];
  recommended: boolean;
  engagementMultiplier: number; // relative to baseline
}

export interface TimingConfig {
  bestDays: string[];
  bestHoursStart: number;
  bestHoursEnd: number;
  timezone: string;
  postingFrequency: { min: number; max: number; unit: 'day' | 'week' };
  notes: string;
}

export interface AudienceProfile {
  ageRange: { min: number; max: number };
  primaryDemographic: string;
  secondaryDemographics: string[];
  interests: string[];
  behaviorNotes: string[];
}

export interface SetupItem {
  id: string;
  category: 'profile' | 'content' | 'engagement' | 'analytics' | 'legal';
  item: string;
  howTo: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  completed?: boolean;
}

export interface PaidAdvertisingConfig {
  available: boolean;
  restrictions: string[];
  formats: string[];
  minBudget?: number;
  currency?: string;
  politicalAdRules?: string;
}
