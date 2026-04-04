/**
 * Tensorax Studio — Project & Asset Database
 *
 * JSON-file-backed database stored at assets/db.json.
 * Tables: projects, characters, scenery, clothing, assets (images/videos/concepts).
 * Cross-references via ID arrays so a character can appear in many projects.
 */

// ─── Schema ──────────────────────────────────────────────────────────────────

export interface AssetRef {
  id: string;
  type: 'character' | 'scenery' | 'clothing' | 'concept' | 'image' | 'video';
  name: string;
  thumbnail?: string;
  filePath?: string;
  createdAt: string;
  tags: string[];
  metadata: Record<string, string>;
}

export interface CharacterAsset extends AssetRef {
  type: 'character';
  description: string;
  referenceImages: string[];
}

export interface SceneryAsset extends AssetRef {
  type: 'scenery';
  description: string;
  referenceImages: string[];
}

export interface ClothingAsset extends AssetRef {
  type: 'clothing';
  description: string;
  referenceImages: string[];
}

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  brandId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  characterIds: string[];
  sceneryIds: string[];
  clothingIds: string[];
  conceptIds: string[];
  imageIds: string[];
  videoIds: string[];
  notes: string;
}

export interface ProjectDB {
  version: number;
  projects: Project[];
  characters: CharacterAsset[];
  scenery: SceneryAsset[];
  clothing: ClothingAsset[];
  assets: AssetRef[];
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const emptyDB: ProjectDB = {
  version: 1,
  projects: [],
  characters: [],
  scenery: [],
  clothing: [],
  assets: [],
};

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function slugify(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_');
}

export function createProject(name: string, brandId: string, description = ''): Project {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    slug: slugify(name),
    status: 'active',
    brandId,
    description,
    createdAt: now,
    updatedAt: now,
    characterIds: [],
    sceneryIds: [],
    clothingIds: [],
    conceptIds: [],
    imageIds: [],
    videoIds: [],
    notes: '',
  };
}

export function createCharacter(name: string, description: string, referenceImages: string[] = [], tags: string[] = []): CharacterAsset {
  return {
    id: newId(),
    type: 'character',
    name,
    description,
    referenceImages,
    createdAt: new Date().toISOString(),
    tags,
    metadata: {},
  };
}

export function createScenery(name: string, description: string, referenceImages: string[] = [], tags: string[] = []): SceneryAsset {
  return {
    id: newId(),
    type: 'scenery',
    name,
    description,
    referenceImages,
    createdAt: new Date().toISOString(),
    tags,
    metadata: {},
  };
}

export function createClothing(name: string, description: string, referenceImages: string[] = [], tags: string[] = []): ClothingAsset {
  return {
    id: newId(),
    type: 'clothing',
    name,
    description,
    referenceImages,
    createdAt: new Date().toISOString(),
    tags,
    metadata: {},
  };
}

// ─── Client-side API helpers ─────────────────────────────────────────────────

const API = '/api/db';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API ${res.status}`);
  }
  return res.json();
}

export const DB = {
  load: () => apiFetch<ProjectDB>(''),

  // Projects
  listProjects: () => apiFetch<Project[]>('/projects'),
  getProject: (id: string) => apiFetch<Project>(`/projects/${id}`),
  createProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { name: string }) =>
    apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(p) }),
  updateProject: (id: string, patch: Partial<Project>) =>
    apiFetch<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProject: (id: string) =>
    apiFetch<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

  // Characters
  listCharacters: () => apiFetch<CharacterAsset[]>('/characters'),
  createCharacter: (c: Omit<CharacterAsset, 'id' | 'createdAt'>) =>
    apiFetch<CharacterAsset>('/characters', { method: 'POST', body: JSON.stringify(c) }),
  updateCharacter: (id: string, patch: Partial<CharacterAsset>) =>
    apiFetch<CharacterAsset>(`/characters/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteCharacter: (id: string) =>
    apiFetch<{ ok: boolean }>(`/characters/${id}`, { method: 'DELETE' }),

  // Scenery
  listScenery: () => apiFetch<SceneryAsset[]>('/scenery'),
  createScenery: (s: Omit<SceneryAsset, 'id' | 'createdAt'>) =>
    apiFetch<SceneryAsset>('/scenery', { method: 'POST', body: JSON.stringify(s) }),
  updateScenery: (id: string, patch: Partial<SceneryAsset>) =>
    apiFetch<SceneryAsset>(`/scenery/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // Clothing
  listClothing: () => apiFetch<ClothingAsset[]>('/clothing'),
  createClothing: (c: Omit<ClothingAsset, 'id' | 'createdAt'>) =>
    apiFetch<ClothingAsset>('/clothing', { method: 'POST', body: JSON.stringify(c) }),
  updateClothing: (id: string, patch: Partial<ClothingAsset>) =>
    apiFetch<ClothingAsset>(`/clothing/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // Link/unlink assets to projects
  linkAsset: (projectId: string, assetType: string, assetId: string) =>
    apiFetch<Project>(`/projects/${projectId}/link`, { method: 'POST', body: JSON.stringify({ assetType, assetId }) }),
  unlinkAsset: (projectId: string, assetType: string, assetId: string) =>
    apiFetch<Project>(`/projects/${projectId}/unlink`, { method: 'POST', body: JSON.stringify({ assetType, assetId }) }),

  // Save a generated asset file to the project folder
  saveProjectFile: (projectId: string, filename: string, data: string, subfolder?: string) =>
    apiFetch<{ path: string }>(`/projects/${projectId}/files`, { method: 'POST', body: JSON.stringify({ filename, data, subfolder }) }),

  // Project metadata (stores all user inputs: generalDirection, screenplay, etc.)
  getMetadata: (projectId: string) =>
    apiFetch<Record<string, unknown>>(`/projects/${projectId}/metadata`),
  saveMetadata: (projectId: string, patch: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>(`/projects/${projectId}/metadata`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // Generic assets
  listAssets: () => apiFetch<AssetRef[]>('/assets'),
  createAsset: (asset: { type: string; name: string; description?: string; thumbnail?: string; filePath?: string; tags?: string[]; metadata?: Record<string, string> }) =>
    apiFetch<AssetRef>('/assets', { method: 'POST', body: JSON.stringify(asset) }),
  deleteAsset: (id: string) =>
    apiFetch<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' }),

  /** Scan all project files on disk and register them as assets */
  syncProjectAssets: (projectId: string) =>
    apiFetch<{ ok: boolean; filesScanned: number; assetsCreated: number }>(`/projects/${projectId}/sync-assets`, { method: 'POST' }),

  /** Create an asset record and link it to a project in one call */
  saveToAssets: async (projectId: string, asset: { type: string; name: string; description?: string; thumbnail?: string; filePath?: string; tags?: string[]; metadata?: Record<string, string> }): Promise<AssetRef> => {
    const created = await apiFetch<AssetRef>('/assets', { method: 'POST', body: JSON.stringify(asset) });
    await apiFetch(`/projects/${projectId}/link`, { method: 'POST', body: JSON.stringify({ assetType: asset.type, assetId: created.id }) });
    return created;
  },
};
