import type { AssetCategory, AssetQuery, AssetQueryResult, Asset } from './types';
import type { LanguageCode } from '../project/types';
import { listAssets } from './asset-store';

// ─── Gallery queries with filtering, sorting, and search ─────────────────────

export async function queryGallery(query: AssetQuery): Promise<AssetQueryResult> {
  return listAssets(query);
}

export async function searchAssets(
  projectId: string,
  searchText: string,
): Promise<Asset[]> {
  const result = await listAssets({
    projectId,
    searchText,
    pageSize: 200,
  });
  return result.assets;
}

export async function getAssetsByCategory(
  projectId: string,
  category: AssetCategory,
): Promise<Asset[]> {
  const result = await listAssets({
    projectId,
    category,
    pageSize: 200,
  });
  return result.assets;
}

export async function getAssetsByPlatform(
  projectId: string,
  platform: string,
): Promise<Asset[]> {
  const result = await listAssets({
    projectId,
    platform,
    pageSize: 200,
  });
  return result.assets;
}

export async function getRecentAssets(
  projectId: string,
  limit: number = 20,
): Promise<Asset[]> {
  const result = await listAssets({
    projectId,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    pageSize: limit,
  });
  return result.assets;
}

export interface AssetStats {
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  byLanguage: Record<string, number>;
  byPlatform: Record<string, number>;
  total: number;
}

export async function getAssetStats(projectId: string): Promise<AssetStats> {
  // Fetch all project assets in one call
  const result = await listAssets({
    projectId,
    pageSize: 10000,
  });
  const assets = result.assets;

  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};

  for (const asset of assets) {
    byCategory[asset.category] = (byCategory[asset.category] ?? 0) + 1;
    byType[asset.assetType] = (byType[asset.assetType] ?? 0) + 1;
    byLanguage[asset.language as string] = (byLanguage[asset.language as string] ?? 0) + 1;
    if (asset.platform) {
      byPlatform[asset.platform] = (byPlatform[asset.platform] ?? 0) + 1;
    }
  }

  return {
    byCategory,
    byType,
    byLanguage,
    byPlatform,
    total: assets.length,
  };
}
