// Project Model Types — Session A: Research, Measurement & Project Foundation

export type LanguageCode = 'en' | 'bg' | 'el' | 'de' | 'es' | 'fr' | (string & {});

export interface Project {
  id: string;
  name: string;
  description: string;
  primaryLanguage: LanguageCode;
  outputLanguages: LanguageCode[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'paused' | 'archived';
  researchSettings: ResearchSettings;
  memory: ProjectMemory;
  sourceFiles: SourceFile[];
  assets: string[]; // Asset IDs
  segments: string[];
}

export interface ResearchSettings {
  projectId: string;
  platforms: PlatformResearchConfig[];
  autoRefreshEnabled: boolean;
  refreshFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  lastRefreshAt: Date | null;
  nextRefreshAt: Date | null;
  outputLanguages: LanguageCode[];
  defaultExportFormat: 'xlsx' | 'csv' | 'json';
  userInstructions: string;
  minFollowers: number;
  maxCompetitors: number;
  engagementRateFloor: number;
  dateRange: number;
}

export interface PlatformResearchConfig {
  platform: 'tiktok' | 'facebook' | 'instagram' | 'youtube';
  enabled: boolean;
  ownAccountHandle: string;
  competitorHandles: string[];
  targetHashtags: string[];
  scrapingConfig: {
    method: 'api' | 'browser' | 'thirdParty';
    apiKey?: string;
    maxPostsPerAccount: number;
    includePromotedPosts: boolean;
  };
  platformSpecificSettings: Record<string, unknown>;
}

export interface ProjectMemory {
  projectId: string;
  learnedFacts: LearnedFact[];
  userContext: UserContextEntry[];
  decisions: DecisionRecord[];
  baselines: PerformanceBaseline[];
  brandProfile: BrandProfile;
}

export interface LearnedFact {
  id: string;
  category: 'audience' | 'content' | 'timing' | 'platform' | 'competitor' | 'trend';
  fact: string;
  confidence: number;
  evidenceCount: number;
  firstObserved: Date;
  lastConfirmed: Date;
  stillValid: boolean;
  source: 'automated' | 'user' | 'research';
}

export interface UserContextEntry {
  id: string;
  text: string;
  category: 'brand_voice' | 'audience' | 'goals' | 'constraints' | 'style' | 'general';
  addedAt: Date;
  active: boolean;
}

export interface DecisionRecord {
  id: string;
  projectId: string;
  decision: string;
  rationale: string;
  madeAt: Date;
  madeBy: 'user' | 'system';
  category: string;
  supersededBy?: string;
}

export interface PerformanceBaseline {
  id: string;
  projectId: string;
  platform: string;
  metric: string;
  value: number;
  measuredAt: Date;
  periodDays: number;
}

export interface BrandProfile {
  voiceDescriptors: string[];
  toneRange: { min: string; max: string };
  visualStyle: string;
  tabooTopics: string[];
  keyMessages: string[];
  languageNotes: Partial<Record<LanguageCode, string>>;
}

export interface SourceFile {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: 'research_input' | 'brand_asset' | 'reference' | 'template' | 'user_upload';
  description: string;
  uploadedAt: Date;
  uploadedBy: string;
  storagePath: string;
  checksum: string;
  metadata: Record<string, unknown>;
  linkedExecutions: string[];
}

// Factory defaults
export function createDefaultResearchSettings(projectId: string): ResearchSettings {
  return {
    projectId,
    platforms: [],
    autoRefreshEnabled: false,
    refreshFrequency: 'weekly',
    lastRefreshAt: null,
    nextRefreshAt: null,
    outputLanguages: ['en'],
    defaultExportFormat: 'xlsx',
    userInstructions: '',
    minFollowers: 1000,
    maxCompetitors: 20,
    engagementRateFloor: 0.01,
    dateRange: 14,
  };
}

export function createDefaultProjectMemory(projectId: string): ProjectMemory {
  return {
    projectId,
    learnedFacts: [],
    userContext: [],
    decisions: [],
    baselines: [],
    brandProfile: {
      voiceDescriptors: [],
      toneRange: { min: 'neutral', max: 'neutral' },
      visualStyle: '',
      tabooTopics: [],
      keyMessages: [],
      languageNotes: {},
    },
  };
}

export function createDefaultBrandProfile(): BrandProfile {
  return {
    voiceDescriptors: [],
    toneRange: { min: 'neutral', max: 'neutral' },
    visualStyle: '',
    tabooTopics: [],
    keyMessages: [],
    languageNotes: {},
  };
}
