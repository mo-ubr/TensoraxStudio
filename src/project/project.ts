// Project CRUD + lifecycle — persists via /api/db REST endpoints

import type {
  Project,
  ResearchSettings,
  ProjectMemory,
  SourceFile,
} from './types';
import {
  createDefaultResearchSettings,
  createDefaultProjectMemory,
} from './types';

// ─── Internal helpers ───────────────────────────────────────────────────────

const API_BASE = '/api/db';

interface ApiProjectRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  brandId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  metadata: Record<string, unknown>;
  characterIds?: string[];
  sceneryIds?: string[];
  clothingIds?: string[];
  conceptIds?: string[];
  imageIds?: string[];
  videoIds?: string[];
}

/** Convert a raw API row into our typed Project. */
function rowToProject(row: ApiProjectRow): Project {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const researchSettings = (meta.researchSettings as ResearchSettings | undefined)
    ?? createDefaultResearchSettings(row.id);
  const memory = (meta.memory as ProjectMemory | undefined)
    ?? createDefaultProjectMemory(row.id);
  const sourceFiles = (meta.sourceFiles as SourceFile[] | undefined) ?? [];
  const segments = (meta.segments as string[] | undefined) ?? [];

  // Dates stored in memory/researchSettings arrive as ISO strings — rehydrate
  rehydrateDates(researchSettings);
  rehydrateMemoryDates(memory);
  for (const sf of sourceFiles) {
    sf.uploadedAt = new Date(sf.uploadedAt);
  }

  const assetIds: string[] = [
    ...(row.characterIds ?? []),
    ...(row.sceneryIds ?? []),
    ...(row.clothingIds ?? []),
    ...(row.conceptIds ?? []),
    ...(row.imageIds ?? []),
    ...(row.videoIds ?? []),
  ];

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    primaryLanguage: (meta.primaryLanguage as string) || 'en',
    outputLanguages: (meta.outputLanguages as string[]) || ['en'],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    status: row.status as Project['status'],
    researchSettings,
    memory,
    sourceFiles,
    assets: assetIds,
    segments,
  };
}

function rehydrateDates(rs: ResearchSettings): void {
  if (rs.lastRefreshAt) rs.lastRefreshAt = new Date(rs.lastRefreshAt as unknown as string);
  if (rs.nextRefreshAt) rs.nextRefreshAt = new Date(rs.nextRefreshAt as unknown as string);
}

function rehydrateMemoryDates(mem: ProjectMemory): void {
  for (const f of mem.learnedFacts) {
    f.firstObserved = new Date(f.firstObserved);
    f.lastConfirmed = new Date(f.lastConfirmed);
  }
  for (const u of mem.userContext) {
    u.addedAt = new Date(u.addedAt);
  }
  for (const d of mem.decisions) {
    d.madeAt = new Date(d.madeAt);
  }
  for (const b of mem.baselines) {
    b.measuredAt = new Date(b.measuredAt);
  }
}

/** Build the metadata JSON that gets stored alongside the project row. */
function buildMetadata(project: Partial<Project>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (project.primaryLanguage !== undefined) meta.primaryLanguage = project.primaryLanguage;
  if (project.outputLanguages !== undefined) meta.outputLanguages = project.outputLanguages;
  if (project.researchSettings !== undefined) meta.researchSettings = project.researchSettings;
  if (project.memory !== undefined) meta.memory = project.memory;
  if (project.sourceFiles !== undefined) meta.sourceFiles = project.sourceFiles;
  if (project.segments !== undefined) meta.segments = project.segments;
  return meta;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function createProject(input: {
  name: string;
  description: string;
  primaryLanguage: string;
  outputLanguages: string[];
}): Promise<Project> {
  const id = crypto.randomUUID();
  const researchSettings = createDefaultResearchSettings(id);
  researchSettings.outputLanguages = input.outputLanguages;
  const memory = createDefaultProjectMemory(id);

  const metadata = {
    primaryLanguage: input.primaryLanguage,
    outputLanguages: input.outputLanguages,
    researchSettings,
    memory,
    sourceFiles: [],
    segments: [],
  };

  const row = await apiFetch<ApiProjectRow>('/projects', {
    method: 'POST',
    body: JSON.stringify({
      id,
      name: input.name,
      description: input.description,
      status: 'active',
      metadata,
    }),
  });

  return rowToProject(row);
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const row = await apiFetch<ApiProjectRow>(`/projects/${id}`);
    return rowToProject(row);
  } catch {
    return null;
  }
}

export async function updateProject(
  id: string,
  updates: Partial<Project>,
): Promise<Project> {
  // Fetch existing to merge metadata
  const existing = await getProject(id);
  if (!existing) throw new Error(`Project ${id} not found`);

  const merged: Project = { ...existing, ...updates };
  const metadata = {
    primaryLanguage: merged.primaryLanguage,
    outputLanguages: merged.outputLanguages,
    researchSettings: merged.researchSettings,
    memory: merged.memory,
    sourceFiles: merged.sourceFiles,
    segments: merged.segments,
  };

  const patchBody: Record<string, unknown> = { metadata };
  if (updates.name !== undefined) patchBody.name = updates.name;
  if (updates.description !== undefined) patchBody.description = updates.description;
  if (updates.status !== undefined) patchBody.status = updates.status;

  const row = await apiFetch<ApiProjectRow>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patchBody),
  });

  return rowToProject(row);
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' });
}

export async function listProjects(filter?: {
  status?: Project['status'];
}): Promise<Project[]> {
  const rows = await apiFetch<ApiProjectRow[]>('/projects');
  // The list endpoint returns lightweight rows without full metadata.
  // For filtering by status we can use the status field directly.
  // For full Project objects we need to fetch individually, but for listing
  // we reconstruct what we can and note that metadata fields will be defaults.
  // If the caller needs full data they should call getProject(id).
  let filtered = rows;
  if (filter?.status) {
    filtered = rows.filter((r) => r.status === filter.status);
  }

  // List endpoint omits metadata, so fetch full data per project
  const projects = await Promise.all(
    filtered.map(async (r) => {
      const full = await getProject(r.id);
      return full!;
    }),
  );

  return projects.filter(Boolean);
}

export async function archiveProject(id: string): Promise<Project> {
  return updateProject(id, { status: 'archived' });
}

export async function pauseProject(id: string): Promise<Project> {
  return updateProject(id, { status: 'paused' });
}
