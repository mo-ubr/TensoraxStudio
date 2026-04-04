import * as JSZip from 'jszip';
import type { Asset, DownloadRequest } from './types';
import { getAsset } from './asset-store';

// ─── Single + bulk download ─────────────────────────────────────────────────

/** Download a single asset file as a Blob. */
export async function downloadAsset(assetId: string): Promise<Blob> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  const url = getDownloadUrl(assetId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

/** Download multiple assets as a ZIP archive. */
export async function downloadBulk(request: DownloadRequest): Promise<Blob> {
  const assets: Asset[] = [];
  for (const id of request.assetIds) {
    const asset = await getAsset(id);
    if (asset) assets.push(asset);
  }

  if (assets.length === 0) throw new Error('No assets found for download');

  return prepareZipArchive(assets, request.includeMetadata ?? false);
}

/** Generate a download URL for a single asset. */
export function getDownloadUrl(assetId: string): string {
  return `/api/db/assets/${assetId}/download`;
}

/** Create a ZIP archive from a list of assets, optionally including metadata. */
export async function prepareZipArchive(
  assets: Asset[],
  includeMetadata: boolean = false,
): Promise<Blob> {
  const zip = new JSZip();

  // Fetch all files in parallel
  const fetchResults = await Promise.allSettled(
    assets.map(async (asset) => {
      // Try the storage path first, fall back to download URL
      const url = asset.downloadUrl ?? asset.storagePath;
      if (!url) return { asset, blob: null };

      try {
        const res = await fetch(url);
        if (!res.ok) return { asset, blob: null };
        const blob = await res.blob();
        return { asset, blob };
      } catch {
        return { asset, blob: null };
      }
    }),
  );

  for (const result of fetchResults) {
    if (result.status !== 'fulfilled') continue;
    const { asset, blob } = result.value;
    if (!blob) continue;

    // Use a folder structure: category/filename
    const folder = asset.category ?? 'uncategorised';
    const filename = asset.filename || `${asset.id}.bin`;
    zip.file(`${folder}/${filename}`, blob);
  }

  if (includeMetadata) {
    const metadataEntries = assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      assetType: asset.assetType,
      language: asset.language,
      platform: asset.platform,
      tags: asset.tags,
      createdAt: asset.createdAt.toISOString(),
      status: asset.status,
      version: asset.version,
      languageVariantGroup: asset.languageVariantGroup,
    }));
    zip.file('_metadata.json', JSON.stringify(metadataEntries, null, 2));
  }

  return zip.generateAsync({ type: 'blob' });
}
