import type { Asset } from './types';
import { getAsset, saveAsset, updateAsset, getAssetsByProject } from './asset-store';

// ─── Link assets to executions, variant groups, and versions ─────────────────

const API = '/api/db';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Link an asset to an execution by updating its executionId. */
export async function linkToExecution(assetId: string, executionId: string): Promise<void> {
  await updateAsset(assetId, { executionId });
}

/** Link an asset to a project by updating its projectId and calling the link endpoint. */
export async function linkToProject(assetId: string, projectId: string): Promise<void> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  await updateAsset(assetId, { projectId });

  await apiFetch(`/projects/${projectId}/link`, {
    method: 'POST',
    body: JSON.stringify({ assetType: asset.assetType, assetId }),
  });
}

/** Create a new version of an asset, linked to the original. */
export async function createVersion(
  originalAssetId: string,
  newAsset: Omit<Asset, 'id' | 'createdAt' | 'version'>,
): Promise<Asset> {
  const original = await getAsset(originalAssetId);
  if (!original) throw new Error(`Original asset ${originalAssetId} not found`);

  const nextVersion = original.version + 1;

  // Save the new version with a link back to the original
  const created = await saveAsset({
    ...newAsset,
    previousVersionId: originalAssetId,
  });

  // Update the version number (saveAsset defaults to version 1)
  return updateAsset(created.id, { version: nextVersion });
}

/** Get the full version history of an asset, oldest first. */
export async function getVersionHistory(assetId: string): Promise<Asset[]> {
  const versions: Asset[] = [];
  const visited = new Set<string>();

  // Walk backwards through previousVersionId to find the root
  let currentId: string | undefined = assetId;
  const chain: string[] = [];

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    chain.unshift(currentId);
    const asset = await getAsset(currentId);
    if (!asset) break;
    currentId = asset.previousVersionId;
  }

  // Now walk forward: find all assets in the project whose previousVersionId
  // points to assets in our chain, building the full forward history.
  const rootAsset = chain.length > 0 ? await getAsset(chain[0]) : null;
  if (!rootAsset) return [];

  const allProjectAssets = await getAssetsByProject(rootAsset.projectId);
  const byPrevId = new Map<string, Asset[]>();
  for (const a of allProjectAssets) {
    if (a.previousVersionId) {
      const list = byPrevId.get(a.previousVersionId) ?? [];
      list.push(a);
      byPrevId.set(a.previousVersionId, list);
    }
  }

  // Rebuild the chain from root forward
  const result: Asset[] = [];
  const rootFull = allProjectAssets.find((a) => a.id === chain[0]);
  if (rootFull) result.push(rootFull);

  let tip = chain[0];
  while (tip) {
    const next = byPrevId.get(tip);
    if (!next || next.length === 0) break;
    // Take the highest version number if multiple point to the same previous
    const best = next.sort((a, b) => b.version - a.version)[0];
    result.push(best);
    tip = best.id;
  }

  return result;
}

/** Get the latest version of an asset. */
export async function getLatestVersion(assetId: string): Promise<Asset> {
  const history = await getVersionHistory(assetId);
  if (history.length === 0) {
    const asset = await getAsset(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);
    return asset;
  }
  return history[history.length - 1];
}
