// Research updater — handles scheduled re-scraping per ResearchSettings.refreshFrequency.
// Detects changes between runs (new competitors, algorithm shifts, trending topics).
// Designed to be triggered by n8n webhooks or cron schedules.

import type { Project, ResearchSettings } from '../../../../project/types';
import type { PlatformId } from '../_shared/platform-config.types';
import type { ResearchOrchestrationResult } from '../research/research-orchestrator';
import type { ResearchReport, CompetitorAnalysis, HashtagAnalysis } from '../_shared/content-schema';
import type { Asset } from '../../../../assets/types';

import { runResearch } from '../research/research-orchestrator';
import { getAssetsByProject } from '../../../../assets/asset-store';
import { addLearnedFact } from '../../../../project/project-memory';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResearchRefreshResult {
  projectId: string;
  platform: PlatformId;
  previousResearchAt: Date | null;
  currentResearchAt: Date;
  newCompetitors: string[];
  algorithmShifts: string[];
  trendingTopics: string[];
  significantChanges: ResearchChange[];
  updatedRecommendations: boolean;
  researchResult: ResearchOrchestrationResult;
}

export interface ResearchChange {
  category: 'competitor' | 'algorithm' | 'trend' | 'metric' | 'audience';
  description: string;
  severity: 'low' | 'medium' | 'high';
  previousValue?: string;
  currentValue?: string;
  actionRequired: boolean;
}

export interface RefreshSchedule {
  projectId: string;
  platform: PlatformId;
  frequency: ResearchSettings['refreshFrequency'];
  lastRunAt: Date | null;
  nextRunAt: Date;
  enabled: boolean;
}

// ── Frequency → milliseconds mapping ──────────────────────────────────────

const FREQUENCY_MS: Record<ResearchSettings['refreshFrequency'], number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  manual: Infinity, // Never auto-refreshes
};

// ── Main refresh function ─────────────────────────────────────────────────

export async function refreshResearch(
  project: Project,
  platform: PlatformId
): Promise<ResearchRefreshResult> {
  // Load the previous research result from assets
  const previousResult = await loadPreviousResearch(project.id, platform);
  const previousResearchAt = previousResult?.report.generatedAt
    ? new Date(previousResult.report.generatedAt)
    : null;

  // Run fresh research via the orchestrator
  const currentResult = await runResearch(project, platform);

  // Compare previous and current to detect changes
  const changes = detectChanges(
    previousResult,
    currentResult
  );

  // Extract specific change categories
  const newCompetitors = changes
    .filter(c => c.category === 'competitor' && c.description.startsWith('New competitor'))
    .map(c => c.currentValue ?? c.description);

  const algorithmShifts = changes
    .filter(c => c.category === 'algorithm')
    .map(c => c.description);

  const trendingTopics = changes
    .filter(c => c.category === 'trend')
    .map(c => c.currentValue ?? c.description);

  const significantChanges = changes.filter(c => c.severity === 'high' || c.actionRequired);
  const updatedRecommendations = significantChanges.length > 0;

  // Update project memory with new learned facts
  await updateProjectMemoryFromRefresh(project.id, platform, changes);

  return {
    projectId: project.id,
    platform,
    previousResearchAt,
    currentResearchAt: new Date(currentResult.completedAt),
    newCompetitors,
    algorithmShifts,
    trendingTopics,
    significantChanges: changes,
    updatedRecommendations,
    researchResult: currentResult,
  };
}

// ── Change detection ──────────────────────────────────────────────────────

export function detectChanges(
  previous: ResearchOrchestrationResult | null,
  current: ResearchOrchestrationResult
): ResearchChange[] {
  if (!previous) {
    // First research run — no changes to detect
    return [{
      category: 'metric',
      description: 'Initial research run — baselines established.',
      severity: 'low',
      actionRequired: false,
    }];
  }

  const changes: ResearchChange[] = [];

  // ── Compare competitor lists ────────────────────────────────────────────

  const previousCompetitors = new Set(
    previous.report.competitors.map(c => c.account.handle.toLowerCase())
  );
  const currentCompetitors = new Set(
    current.report.competitors.map(c => c.account.handle.toLowerCase())
  );

  // New competitors
  for (const handle of currentCompetitors) {
    if (!previousCompetitors.has(handle)) {
      const competitor = current.report.competitors.find(
        c => c.account.handle.toLowerCase() === handle
      );
      changes.push({
        category: 'competitor',
        description: `New competitor detected: @${handle}`,
        severity: 'medium',
        currentValue: handle,
        actionRequired: true,
      });

      if (competitor && competitor.averageEngagementRate > 0.05) {
        changes.push({
          category: 'competitor',
          description: `New competitor @${handle} has high engagement (${(competitor.averageEngagementRate * 100).toFixed(1)}%)`,
          severity: 'high',
          currentValue: `${(competitor.averageEngagementRate * 100).toFixed(1)}%`,
          actionRequired: true,
        });
      }
    }
  }

  // Departed competitors
  for (const handle of previousCompetitors) {
    if (!currentCompetitors.has(handle)) {
      changes.push({
        category: 'competitor',
        description: `Competitor no longer active: @${handle}`,
        severity: 'low',
        previousValue: handle,
        actionRequired: false,
      });
    }
  }

  // ── Compare metric baselines ────────────────────────────────────────────

  const prevOwnAccount = previous.report.overview.find(a =>
    previous.report.ownChannel.some(
      p => p.accountHandle.toLowerCase() === a.handle.toLowerCase()
    )
  );
  const currOwnAccount = current.report.overview.find(a =>
    current.report.ownChannel.some(
      p => p.accountHandle.toLowerCase() === a.handle.toLowerCase()
    )
  );

  if (prevOwnAccount && currOwnAccount) {
    // Follower change
    const followerDelta = currOwnAccount.followers - prevOwnAccount.followers;
    const followerPct = prevOwnAccount.followers > 0
      ? Math.round((followerDelta / prevOwnAccount.followers) * 100)
      : 0;

    if (Math.abs(followerPct) >= 10) {
      const direction = followerDelta > 0 ? 'gained' : 'lost';
      changes.push({
        category: 'metric',
        description: `Followers ${direction} ${Math.abs(followerPct)}% (${prevOwnAccount.followers.toLocaleString()} → ${currOwnAccount.followers.toLocaleString()})`,
        severity: Math.abs(followerPct) >= 25 ? 'high' : 'medium',
        previousValue: prevOwnAccount.followers.toLocaleString(),
        currentValue: currOwnAccount.followers.toLocaleString(),
        actionRequired: followerDelta < 0,
      });
    }

    // Average views change
    const viewsDelta = currOwnAccount.averageViewsPerPost - prevOwnAccount.averageViewsPerPost;
    const viewsPct = prevOwnAccount.averageViewsPerPost > 0
      ? Math.round((viewsDelta / prevOwnAccount.averageViewsPerPost) * 100)
      : 0;

    if (Math.abs(viewsPct) >= 20) {
      const direction = viewsDelta > 0 ? 'increased' : 'decreased';
      changes.push({
        category: 'metric',
        description: `Average views per post ${direction} by ${Math.abs(viewsPct)}%`,
        severity: Math.abs(viewsPct) >= 40 ? 'high' : 'medium',
        previousValue: prevOwnAccount.averageViewsPerPost.toLocaleString(),
        currentValue: currOwnAccount.averageViewsPerPost.toLocaleString(),
        actionRequired: viewsDelta < 0,
      });
    }
  }

  // ── Compare trending hashtags ───────────────────────────────────────────

  const previousTags = new Set(
    previous.report.hashtags
      .filter(h => h.trend === 'rising')
      .map(h => h.hashtag.toLowerCase())
  );
  const currentTags = current.report.hashtags
    .filter(h => h.trend === 'rising');

  for (const tag of currentTags) {
    if (!previousTags.has(tag.hashtag.toLowerCase())) {
      changes.push({
        category: 'trend',
        description: `New trending hashtag: ${tag.hashtag} (${tag.averageViewsPerPost.toLocaleString()} avg views)`,
        severity: tag.averageViewsPerPost > 100000 ? 'high' : 'medium',
        currentValue: tag.hashtag,
        actionRequired: false,
      });
    }
  }

  // Declined hashtags (were rising, no longer rising)
  const currentRisingSet = new Set(
    currentTags.map(h => h.hashtag.toLowerCase())
  );
  const previousRising = previous.report.hashtags.filter(h => h.trend === 'rising');
  for (const tag of previousRising) {
    const currentTag = current.report.hashtags.find(
      h => h.hashtag.toLowerCase() === tag.hashtag.toLowerCase()
    );
    if (currentTag && currentTag.trend === 'declining') {
      changes.push({
        category: 'trend',
        description: `Hashtag ${tag.hashtag} shifted from rising to declining`,
        severity: 'medium',
        previousValue: 'rising',
        currentValue: 'declining',
        actionRequired: true,
      });
    }
  }

  // ── Compare optimal posting patterns ────────────────────────────────────

  const prevBestTimes = previous.report.analysis.viralVideoAnalysis.peakPostingTimes;
  const currBestTimes = current.report.analysis.viralVideoAnalysis.peakPostingTimes;

  if (prevBestTimes.length > 0 && currBestTimes.length > 0) {
    const prevSet = new Set(prevBestTimes.map(t => t.toLowerCase()));
    const newTimes = currBestTimes.filter(t => !prevSet.has(t.toLowerCase()));
    if (newTimes.length > 0) {
      changes.push({
        category: 'algorithm',
        description: `Optimal posting times shifted — new peak times: ${newTimes.join(', ')}`,
        severity: 'medium',
        previousValue: prevBestTimes.join(', '),
        currentValue: currBestTimes.join(', '),
        actionRequired: true,
      });
    }
  }

  // ── Compare content format effectiveness ────────────────────────────────

  const prevBestFormats = previous.report.analysis.viralVideoAnalysis.bestFormats;
  const currBestFormats = current.report.analysis.viralVideoAnalysis.bestFormats;

  if (prevBestFormats.length > 0 && currBestFormats.length > 0) {
    const prevTopFormat = prevBestFormats[0];
    const currTopFormat = currBestFormats[0];
    if (prevTopFormat.toLowerCase() !== currTopFormat.toLowerCase()) {
      changes.push({
        category: 'algorithm',
        description: `Top-performing content format changed from "${prevTopFormat}" to "${currTopFormat}"`,
        severity: 'medium',
        previousValue: prevTopFormat,
        currentValue: currTopFormat,
        actionRequired: true,
      });
    }
  }

  return changes;
}

// ── Refresh schedule ──────────────────────────────────────────────────────

export function getRefreshSchedule(project: Project): RefreshSchedule[] {
  const schedules: RefreshSchedule[] = [];
  const frequency = project.researchSettings.refreshFrequency;

  for (const platformConfig of project.researchSettings.platforms) {
    if (!platformConfig.enabled) continue;

    // Look for the last research timestamp from project data
    const lastRunAt = getLastResearchTimestamp(project, platformConfig.platform);

    const nextRunAt = lastRunAt
      ? new Date(lastRunAt.getTime() + FREQUENCY_MS[frequency])
      : new Date(); // Due immediately if never run

    schedules.push({
      projectId: project.id,
      platform: platformConfig.platform,
      frequency,
      lastRunAt,
      nextRunAt,
      enabled: frequency !== 'manual',
    });
  }

  return schedules;
}

// ── Check if refresh is due ───────────────────────────────────────────────

export function isRefreshDue(schedule: RefreshSchedule): boolean {
  if (!schedule.enabled) return false;
  return new Date() >= schedule.nextRunAt;
}

// ── Run all scheduled refreshes across projects ───────────────────────────

export async function runScheduledRefreshes(
  projects: Project[]
): Promise<ResearchRefreshResult[]> {
  const results: ResearchRefreshResult[] = [];

  for (const project of projects) {
    const schedules = getRefreshSchedule(project);
    const dueSchedules = schedules.filter(isRefreshDue);

    for (const schedule of dueSchedules) {
      try {
        const result = await refreshResearch(project, schedule.platform);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Create a minimal result with the error
        results.push({
          projectId: project.id,
          platform: schedule.platform,
          previousResearchAt: schedule.lastRunAt,
          currentResearchAt: new Date(),
          newCompetitors: [],
          algorithmShifts: [],
          trendingTopics: [],
          significantChanges: [{
            category: 'metric',
            description: `Refresh failed: ${message}`,
            severity: 'high',
            actionRequired: true,
          }],
          updatedRecommendations: false,
          researchResult: {
            projectId: project.id,
            platform: schedule.platform,
            report: createEmptyReport(project),
            assetIds: [],
            languages: [],
            completedAt: new Date(),
            errors: [message],
          },
        });
      }
    }
  }

  return results;
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function loadPreviousResearch(
  projectId: string,
  platform: PlatformId
): Promise<ResearchOrchestrationResult | null> {
  try {
    const assets = await getAssetsByProject(projectId);

    // Find the most recent research report asset for this platform
    const researchAssets = assets
      .filter(a =>
        a.segmentId === `research-${platform}` &&
        a.category === 'research_report' &&
        a.mimeType === 'application/json'
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (researchAssets.length === 0) return null;

    // The asset contains the serialised ResearchReport in its storage path.
    // In production, we'd read the JSON from disk/DB. For now, reconstruct
    // a minimal ResearchOrchestrationResult from the asset metadata.
    const latestAsset = researchAssets[0];

    // The full implementation would deserialise the stored JSON:
    // const reportJson = await readAssetContent(latestAsset.storagePath + latestAsset.filename);
    // const report: ResearchReport = JSON.parse(reportJson);

    // Placeholder: return null to indicate "no previous data loadable yet"
    // This will be replaced once the asset storage layer is fully wired.
    return null;
  } catch {
    return null;
  }
}

function getLastResearchTimestamp(project: Project, platform: PlatformId): Date | null {
  // Check project memory for last research run timestamps
  const relevantFacts = project.memory.learnedFacts
    .filter(f => f.platform === platform && f.source === 'research_orchestrator')
    .sort((a, b) => new Date(b.learnedAt).getTime() - new Date(a.learnedAt).getTime());

  if (relevantFacts.length > 0) {
    return new Date(relevantFacts[0].learnedAt);
  }

  return null;
}

async function updateProjectMemoryFromRefresh(
  projectId: string,
  platform: PlatformId,
  changes: ResearchChange[]
): Promise<void> {
  const significantChanges = changes.filter(
    c => c.severity === 'high' || c.severity === 'medium'
  );

  for (const change of significantChanges) {
    await addLearnedFact(projectId, {
      id: crypto.randomUUID(),
      projectId,
      platform,
      category: change.category,
      fact: change.description,
      confidence: change.severity === 'high' ? 0.95 : 0.8,
      source: 'research_updater',
      learnedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
  }
}

function createEmptyReport(project: Project): ResearchReport {
  return {
    id: crypto.randomUUID(),
    projectId: project.id,
    platform: 'tiktok' as PlatformId,
    generatedAt: new Date(),
    language: project.primaryLanguage,
    overview: [],
    ownChannel: [],
    competitors: [],
    topViral: [],
    allPosts: [],
    hashtags: [],
    analysis: {
      currentPosition: { rank: 0, totalAccounts: 0, gapToTop10: {} },
      viralVideoAnalysis: { commonThemes: [], optimalDuration: { min: 0, max: 0 }, bestFormats: [], peakPostingTimes: [] },
      hashtagGaps: { underused: [], overused: [], recommended: [] },
      engagementQuality: { commentSentiment: 'mixed', shareToViewRatio: 0, saveToViewRatio: 0, authenticEngagementScore: 0 },
      keyFindings: ['Research refresh could not be completed — see errors.'],
    },
    recommendations: {
      algorithmSignals: [],
      targetAudience: { primary: '', secondary: [], notes: '' },
      setupChecklist: [],
      actionPlan: [],
      contentCalendar: [],
      growthTargets: [],
      contentSeries: [],
    },
  };
}
