// Research Settings — management, validation, scheduling

import type { ResearchSettings, PlatformResearchConfig } from './types';
import { createDefaultResearchSettings } from './types';
import { getProject, updateProject } from './project';

// ─── Read / Write ───────────────────────────────────────────────────────────

export async function getResearchSettings(
  projectId: string,
): Promise<ResearchSettings> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.researchSettings;
}

export async function updateResearchSettings(
  projectId: string,
  updates: Partial<ResearchSettings>,
): Promise<ResearchSettings> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const merged: ResearchSettings = { ...project.researchSettings, ...updates };
  merged.projectId = projectId; // Ensure projectId stays correct

  // Recalculate next refresh if relevant fields changed
  if (
    updates.autoRefreshEnabled !== undefined ||
    updates.refreshFrequency !== undefined ||
    updates.lastRefreshAt !== undefined
  ) {
    if (merged.autoRefreshEnabled) {
      merged.nextRefreshAt = calculateNextRefresh(merged);
    } else {
      merged.nextRefreshAt = null;
    }
  }

  await updateProject(projectId, { researchSettings: merged });
  return merged;
}

// ─── Platform Configs ───────────────────────────────────────────────────────

export async function addPlatformConfig(
  projectId: string,
  config: PlatformResearchConfig,
): Promise<void> {
  const settings = await getResearchSettings(projectId);

  // Replace existing config for same platform, or add new
  const existingIndex = settings.platforms.findIndex(
    (p) => p.platform === config.platform,
  );
  if (existingIndex >= 0) {
    settings.platforms[existingIndex] = config;
  } else {
    settings.platforms.push(config);
  }

  await updateResearchSettings(projectId, { platforms: settings.platforms });
}

export async function removePlatformConfig(
  projectId: string,
  platform: string,
): Promise<void> {
  const settings = await getResearchSettings(projectId);
  settings.platforms = settings.platforms.filter((p) => p.platform !== platform);
  await updateResearchSettings(projectId, { platforms: settings.platforms });
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateResearchSettings(
  settings: ResearchSettings,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!settings.projectId) {
    errors.push('projectId is required');
  }

  if (settings.minFollowers < 0) {
    errors.push('minFollowers must be non-negative');
  }

  if (settings.maxCompetitors < 1) {
    errors.push('maxCompetitors must be at least 1');
  }

  if (settings.engagementRateFloor < 0 || settings.engagementRateFloor > 1) {
    errors.push('engagementRateFloor must be between 0 and 1');
  }

  if (settings.dateRange < 1) {
    errors.push('dateRange must be at least 1 day');
  }

  if (settings.outputLanguages.length === 0) {
    errors.push('At least one output language is required');
  }

  const validFormats = ['xlsx', 'csv', 'json'];
  if (!validFormats.includes(settings.defaultExportFormat)) {
    errors.push(`defaultExportFormat must be one of: ${validFormats.join(', ')}`);
  }

  const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
  if (!validFrequencies.includes(settings.refreshFrequency)) {
    errors.push(`refreshFrequency must be one of: ${validFrequencies.join(', ')}`);
  }

  // Validate each platform config
  for (const pc of settings.platforms) {
    const validPlatforms = ['tiktok', 'facebook', 'instagram', 'youtube'];
    if (!validPlatforms.includes(pc.platform)) {
      errors.push(`Invalid platform: ${pc.platform}`);
    }
    if (pc.enabled && !pc.ownAccountHandle && pc.competitorHandles.length === 0) {
      errors.push(`Platform ${pc.platform}: at least one account handle or competitor is required when enabled`);
    }
    if (pc.scrapingConfig.maxPostsPerAccount < 1) {
      errors.push(`Platform ${pc.platform}: maxPostsPerAccount must be at least 1`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

const FREQUENCY_DAYS: Record<ResearchSettings['refreshFrequency'], number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export function calculateNextRefresh(settings: ResearchSettings): Date {
  const base = settings.lastRefreshAt ? new Date(settings.lastRefreshAt) : new Date();
  const days = FREQUENCY_DAYS[settings.refreshFrequency] ?? 7;
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return next;
}
