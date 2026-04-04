import type { LanguageCode } from '../project/types';
import type { Asset, BilingualOutputConfig } from './types';
import { getAssetsByProject, updateAsset } from './asset-store';

// ─── Multi-language variant management ───────────────────────────────────────

/** Generate a unique group ID for linking language variants of the same content. */
export function createLanguageVariantGroup(): string {
  return `lvg-${crypto.randomUUID()}`;
}

/** Update an asset with variant group info and return the updated asset. */
export async function registerVariant(
  asset: Asset,
  groupId: string,
  isTranslation: boolean,
  sourceAssetId?: string,
): Promise<Asset> {
  return updateAsset(asset.id, {
    languageVariantGroup: groupId,
    isTranslation,
    sourceAssetId,
  });
}

/** Get all language variants within a variant group. */
export async function getVariantGroup(groupId: string): Promise<Asset[]> {
  // We need to scan all assets — the group ID is stored in metadata.
  // Since we don't know the projectId, fetch everything and filter.
  // In practice, callers should use this within a known project context.
  const API = '/api/db';
  const res = await fetch(`${API}/assets`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);

  const records = await res.json() as Array<{
    id: string;
    type: string;
    name: string;
    description?: string;
    thumbnail?: string;
    filePath?: string;
    tags?: string[];
    createdAt?: string;
    metadata?: Record<string, unknown>;
  }>;

  return records
    .filter((r) => {
      const m = r.metadata ?? {};
      return m.languageVariantGroup === groupId;
    })
    .map((rec) => {
      const m = (rec.metadata ?? {}) as Record<string, unknown>;
      return {
        id: rec.id,
        projectId: (m.projectId as string) ?? '',
        executionId: (m.executionId as string) ?? '',
        segmentId: (m.segmentId as string) ?? '',
        name: rec.name,
        assetType: rec.type as Asset['assetType'],
        category: (m.category as Asset['category']) ?? 'research_report',
        language: (m.language as Asset['language']) ?? 'en',
        languageVariantGroup: (m.languageVariantGroup as string) ?? '',
        isTranslation: (m.isTranslation as boolean) ?? false,
        sourceAssetId: m.sourceAssetId as string | undefined,
        filename: (m.filename as string) ?? rec.name,
        mimeType: (m.mimeType as string) ?? 'application/octet-stream',
        sizeBytes: (m.sizeBytes as number) ?? 0,
        storagePath: rec.filePath ?? '',
        downloadUrl: m.downloadUrl as string | undefined,
        textPreview: rec.description,
        thumbnailPath: rec.thumbnail,
        createdAt: rec.createdAt ? new Date(rec.createdAt) : new Date(),
        tags: rec.tags ?? [],
        platform: m.platform as string | undefined,
        status: (m.status as Asset['status']) ?? 'draft',
        publishedAt: m.publishedAt ? new Date(m.publishedAt as string) : undefined,
        publishedUrl: m.publishedUrl as string | undefined,
        performanceMetrics: m.performanceMetrics as Asset['performanceMetrics'],
        version: (m.version as number) ?? 1,
        previousVersionId: m.previousVersionId as string | undefined,
      } satisfies Asset;
    });
}

/** Determine which required languages are missing from a variant group. */
export async function getMissingLanguages(
  groupId: string,
  requiredLanguages: LanguageCode[],
): Promise<LanguageCode[]> {
  const variants = await getVariantGroup(groupId);
  const existing = new Set(variants.map((v) => v.language as string));
  return requiredLanguages.filter((lang) => !existing.has(lang));
}

/** Create a bilingual output configuration for a set of target languages. */
export function createBilingualConfig(
  primaryLanguage: LanguageCode,
  outputLanguages: LanguageCode[],
): BilingualOutputConfig {
  const languageOverrides = {} as BilingualOutputConfig['languageOverrides'];

  for (const lang of outputLanguages) {
    languageOverrides[lang] = {};
  }

  // Ensure primary language is also in overrides
  if (!languageOverrides[primaryLanguage]) {
    languageOverrides[primaryLanguage] = {};
  }

  return {
    strategy: outputLanguages.length <= 2 ? 'generate_both' : 'generate_primary_translate',
    languageOverrides,
  };
}
