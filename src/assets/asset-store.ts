import type { Asset, AssetQuery, AssetQueryResult } from './types';

// ─── API helper ──────────────────────────────────────────────────────────────

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

// ─── Serialisation helpers ───────────────────────────────────────────────────

/** Pack workflow-specific fields into the metadata JSON the existing assets table expects. */
function toApiPayload(input: Omit<Asset, 'id' | 'createdAt' | 'version'>): Record<string, unknown> {
  return {
    type: input.assetType,
    name: input.name,
    description: input.textPreview ?? '',
    thumbnail: input.thumbnailPath ?? '',
    filePath: input.storagePath,
    tags: input.tags,
    metadata: {
      projectId: input.projectId,
      executionId: input.executionId,
      segmentId: input.segmentId,
      category: input.category,
      language: input.language,
      languageVariantGroup: input.languageVariantGroup,
      isTranslation: input.isTranslation,
      sourceAssetId: input.sourceAssetId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      platform: input.platform,
      status: input.status,
      publishedAt: input.publishedAt ? input.publishedAt.toISOString() : undefined,
      publishedUrl: input.publishedUrl,
      performanceMetrics: input.performanceMetrics,
      version: 1,
      previousVersionId: input.previousVersionId,
    },
  };
}

interface ApiAssetRecord {
  id: string;
  type: string;
  name: string;
  description?: string;
  thumbnail?: string;
  filePath?: string;
  tags?: string[];
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/** Reconstitute a full Asset from the API's flat record + metadata JSON. */
function fromApiRecord(rec: ApiAssetRecord): Asset {
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
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function saveAsset(
  input: Omit<Asset, 'id' | 'createdAt' | 'version'>,
): Promise<Asset> {
  const payload = toApiPayload(input);
  const created = await apiFetch<ApiAssetRecord>('/assets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Link to project
  if (input.projectId) {
    await apiFetch(`/projects/${input.projectId}/link`, {
      method: 'POST',
      body: JSON.stringify({ assetType: input.assetType, assetId: created.id }),
    });
  }

  return fromApiRecord(created);
}

export async function getAsset(id: string): Promise<Asset | null> {
  try {
    const all = await apiFetch<ApiAssetRecord[]>('/assets');
    const rec = all.find((a) => a.id === id);
    return rec ? fromApiRecord(rec) : null;
  } catch {
    return null;
  }
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
  // Fetch current record so we can merge metadata
  const current = await getAsset(id);
  if (!current) throw new Error(`Asset ${id} not found`);

  const merged: Asset = { ...current, ...updates };
  const payload = toApiPayload({
    ...merged,
    // Strip fields that toApiPayload doesn't expect
  } as Omit<Asset, 'id' | 'createdAt' | 'version'>);

  // The existing API only supports delete+recreate for generic assets,
  // so we delete and recreate with the same logical identity.
  await apiFetch<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' });

  const created = await apiFetch<ApiAssetRecord>('/assets', {
    method: 'POST',
    body: JSON.stringify({ ...payload, id }),
  });

  return fromApiRecord(created);
}

export async function deleteAsset(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' });
}

export async function listAssets(query: AssetQuery): Promise<AssetQueryResult> {
  const all = await apiFetch<ApiAssetRecord[]>('/assets');
  let assets = all.map(fromApiRecord);

  // Filter by projectId
  assets = assets.filter((a) => a.projectId === query.projectId);

  if (query.category) assets = assets.filter((a) => a.category === query.category);
  if (query.assetType) assets = assets.filter((a) => a.assetType === query.assetType);
  if (query.language) assets = assets.filter((a) => a.language === query.language);
  if (query.platform) assets = assets.filter((a) => a.platform === query.platform);
  if (query.status) assets = assets.filter((a) => a.status === query.status);
  if (query.tags && query.tags.length > 0) {
    assets = assets.filter((a) =>
      query.tags!.some((t) => a.tags.includes(t)),
    );
  }
  if (query.dateRange) {
    const from = query.dateRange.from.getTime();
    const to = query.dateRange.to.getTime();
    assets = assets.filter((a) => {
      const t = a.createdAt.getTime();
      return t >= from && t <= to;
    });
  }
  if (query.searchText) {
    const lower = query.searchText.toLowerCase();
    assets = assets.filter(
      (a) =>
        a.name.toLowerCase().includes(lower) ||
        a.tags.some((t) => t.toLowerCase().includes(lower)) ||
        (a.textPreview && a.textPreview.toLowerCase().includes(lower)),
    );
  }

  // Sort
  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';
  assets.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'createdAt') cmp = a.createdAt.getTime() - b.createdAt.getTime();
    else if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
    else if (sortBy === 'platform') cmp = (a.platform ?? '').localeCompare(b.platform ?? '');
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // Paginate
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const total = assets.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paged = assets.slice(start, start + pageSize);

  return { assets: paged, total, page, pageSize, totalPages };
}

export async function getAssetsByExecution(executionId: string): Promise<Asset[]> {
  const all = await apiFetch<ApiAssetRecord[]>('/assets');
  return all
    .map(fromApiRecord)
    .filter((a) => a.executionId === executionId);
}

export async function getAssetsByProject(projectId: string): Promise<Asset[]> {
  const all = await apiFetch<ApiAssetRecord[]>('/assets');
  return all
    .map(fromApiRecord)
    .filter((a) => a.projectId === projectId);
}
