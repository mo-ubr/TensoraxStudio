import type { LanguageCode } from '../project/types';

export type AssetType = 'text' | 'image' | 'video' | 'audio' | 'spreadsheet' | 'document' | 'archive';

export type AssetCategory =
  | 'research_report' | 'content_caption' | 'content_hook' | 'content_visual'
  | 'content_video' | 'content_audio' | 'content_thumbnail' | 'assembled_post'
  | 'cross_platform_variant' | 'analytics_report' | 'performance_report';

export type AssetStatus = 'draft' | 'approved' | 'published' | 'archived';

export interface Asset {
  id: string;
  projectId: string;
  executionId: string;
  segmentId: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  language: LanguageCode;
  languageVariantGroup: string;
  isTranslation: boolean;
  sourceAssetId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  downloadUrl?: string;
  textPreview?: string;
  thumbnailPath?: string;
  createdAt: Date;
  tags: string[];
  platform?: string;
  status: AssetStatus;
  publishedAt?: Date;
  publishedUrl?: string;
  performanceMetrics?: AssetPerformanceSnapshot;
  version: number;
  previousVersionId?: string;
}

export interface AssetPerformanceSnapshot {
  assetId: string;
  collectedAt: Date;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  engagementRate: number;
  reach: number;
  impressions: number;
  clickThroughRate: number;
  platform: string;
}

export interface BilingualOutputConfig {
  strategy: 'generate_both' | 'generate_primary_translate';
  languageOverrides: Record<LanguageCode, {
    tone?: string;
    formalityLevel?: number;
    culturalNotes?: string;
  }>;
}

export interface AssetQuery {
  projectId: string;
  category?: AssetCategory;
  assetType?: AssetType;
  language?: LanguageCode;
  platform?: string;
  status?: AssetStatus;
  tags?: string[];
  dateRange?: { from: Date; to: Date };
  searchText?: string;
  sortBy?: 'createdAt' | 'name' | 'status' | 'platform';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface AssetQueryResult {
  assets: Asset[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DownloadRequest {
  assetIds: string[];
  format?: 'zip' | 'tar';
  includeMetadata?: boolean;
}
