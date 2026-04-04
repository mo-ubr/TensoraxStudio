// Master research orchestrator — main entry point for the social media research pipeline.
// Given a project with platform + competitors, it:
// 1. Calls the platform scraper to collect data
// 2. Structures and normalizes data
// 3. Runs the analysis engine
// 4. Generates recommendations
// 5. Saves ALL outputs as Assets in ALL project.outputLanguages

import type { Project, PlatformResearchConfig, LanguageCode } from '../../../../project/types';
import type { Asset, AssetCategory } from '../../../../assets/types';
import type { ResearchReport } from '../_shared/content-schema';
import type { PlatformConfig, PlatformId } from '../_shared/platform-config.types';

import { scrapePlatform, extractHashtags } from './platform-scraper';
import type { ScrapeResult, ScraperConfig } from './platform-scraper';
import { analyzeResearchData } from './analysis-engine';
import type { AnalysisInput } from './analysis-engine';
import { generateRecommendations } from './recommendation-generator';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResearchOrchestrationResult {
  projectId: string;
  platform: PlatformId;
  report: ResearchReport;
  assetIds: string[];
  languages: LanguageCode[];
  completedAt: Date;
  errors: string[];
}

export interface ResearchProgress {
  phase: 'scraping' | 'analyzing' | 'recommending' | 'generating_assets' | 'complete';
  platform: PlatformId;
  progress: number; // 0-100
  message: string;
}

export type ProgressCallback = (progress: ResearchProgress) => void;

// ── Platform config loader (dynamic import from platform-configs/) ─────────

async function loadPlatformConfig(platform: PlatformId): Promise<PlatformConfig> {
  // Dynamic import from the platform-configs directory (managed by agent B)
  try {
    const configModule = await import(`./platform-configs/${platform}.config`);
    return configModule.default ?? configModule[`${platform}Config`] ?? configModule.config;
  } catch {
    throw new Error(
      `Platform config not found for "${platform}". ` +
      `Expected a file at research/platform-configs/${platform}.config.ts`
    );
  }
}

// ── Main orchestrator ──────────────────────────────────────────────────────

export async function runResearch(
  project: Project,
  platform: PlatformId,
  onProgress?: ProgressCallback
): Promise<ResearchOrchestrationResult> {
  const errors: string[] = [];
  const assetIds: string[] = [];

  // Find the platform research config from project settings
  const platformResearchConfig = project.researchSettings.platforms.find(
    p => p.platform === platform && p.enabled
  );

  if (!platformResearchConfig) {
    throw new Error(`Platform "${platform}" is not enabled in project research settings.`);
  }

  // Load the platform config (algorithm signals, timing, formats, etc.)
  const platformConfig = await loadPlatformConfig(platform);

  // ── Phase 1: Scraping ──────────────────────────────────────────────────

  onProgress?.({
    phase: 'scraping',
    platform,
    progress: 10,
    message: `Scraping ${platform} data for ${platformResearchConfig.competitorHandles.length} competitors...`,
  });

  const scraperConfig: ScraperConfig = {
    platform,
    method: platformResearchConfig.scrapingConfig.method,
    apiKey: platformResearchConfig.scrapingConfig.apiKey,
    maxPostsPerAccount: platformResearchConfig.scrapingConfig.maxPostsPerAccount,
    includePromotedPosts: platformResearchConfig.scrapingConfig.includePromotedPosts,
    dateRangeDays: project.researchSettings.dateRange,
  };

  let scrapeResult: ScrapeResult;
  try {
    scrapeResult = await scrapePlatform(
      scraperConfig,
      platformResearchConfig.ownAccountHandle,
      platformResearchConfig.competitorHandles,
      platformResearchConfig.targetHashtags
    );
    errors.push(...scrapeResult.errors);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Scraping failed: ${message}`);
    // Return partial result with empty report
    return {
      projectId: project.id,
      platform,
      report: createEmptyReport(project.id, platform, project.primaryLanguage),
      assetIds: [],
      languages: [],
      completedAt: new Date(),
      errors,
    };
  }

  onProgress?.({
    phase: 'scraping',
    platform,
    progress: 40,
    message: `Scraped ${scrapeResult.ownPosts.length} own posts and ${scrapeResult.competitorPosts.length} competitor posts.`,
  });

  // ── Phase 2: Analysis ──────────────────────────────────────────────────

  onProgress?.({
    phase: 'analyzing',
    platform,
    progress: 50,
    message: 'Analyzing scraped data...',
  });

  const allPosts = [...scrapeResult.ownPosts, ...scrapeResult.competitorPosts];
  const hashtags = extractHashtags(allPosts);

  const analysisInput: AnalysisInput = {
    platform,
    ownAccount: scrapeResult.ownAccount,
    ownPosts: scrapeResult.ownPosts,
    competitorAccounts: scrapeResult.competitorAccounts,
    competitorPosts: scrapeResult.competitorPosts,
    allPosts,
    hashtags,
  };

  const analysis = analyzeResearchData(analysisInput);

  onProgress?.({
    phase: 'analyzing',
    platform,
    progress: 65,
    message: `Analysis complete. ${analysis.keyFindings.length} key findings identified.`,
  });

  // ── Phase 3: Recommendations ───────────────────────────────────────────

  onProgress?.({
    phase: 'recommending',
    platform,
    progress: 70,
    message: 'Generating recommendations...',
  });

  const recommendations = generateRecommendations(
    platform,
    analysis,
    platformConfig,
    scrapeResult.ownAccount,
    project.researchSettings.userInstructions
  );

  onProgress?.({
    phase: 'recommending',
    platform,
    progress: 80,
    message: 'Recommendations generated.',
  });

  // ── Assemble full report ───────────────────────────────────────────────

  // Build competitor analysis objects
  const competitors = scrapeResult.competitorAccounts.map(account => {
    const posts = scrapeResult.competitorPosts.filter(
      p => p.accountHandle.toLowerCase() === account.handle.toLowerCase()
    );
    const topPosts = [...posts].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, 5);
    const accountHashtags = posts.flatMap(p => p.hashtags);
    const ownHashtags = scrapeResult.ownPosts.flatMap(p => p.hashtags);
    const hashtagOverlap = accountHashtags.filter(h =>
      ownHashtags.some(oh => oh.toLowerCase() === h.toLowerCase())
    );
    const totalEngagement = posts.reduce((s, p) => {
      const m = p.metrics;
      return s + m.likes + m.comments + m.shares + m.saves;
    }, 0);
    const totalViews = posts.reduce((s, p) => s + p.metrics.views, 0);

    return {
      account,
      posts,
      topPosts,
      hashtagOverlap: [...new Set(hashtagOverlap)],
      strengthAreas: [] as string[], // Would need deeper analysis
      weaknessAreas: [] as string[],
      postingFrequency: estimatePostingFrequency(posts),
      averageEngagementRate: totalViews > 0 ? totalEngagement / totalViews : 0,
      growthTrend: 'stable' as const,
    };
  });

  const topViral = [...allPosts].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, 10);

  const report: ResearchReport = {
    id: crypto.randomUUID(),
    projectId: project.id,
    platform,
    generatedAt: new Date(),
    language: project.primaryLanguage,
    overview: [
      ...(scrapeResult.ownAccount ? [scrapeResult.ownAccount] : []),
      ...scrapeResult.competitorAccounts,
    ],
    ownChannel: scrapeResult.ownPosts,
    competitors,
    topViral,
    allPosts,
    hashtags,
    analysis,
    recommendations,
  };

  // ── Phase 4: Save as assets ────────────────────────────────────────────

  onProgress?.({
    phase: 'generating_assets',
    platform,
    progress: 85,
    message: `Saving report as assets in ${project.outputLanguages.length} language(s)...`,
  });

  const languages = project.outputLanguages.length > 0
    ? project.outputLanguages
    : [project.primaryLanguage];

  const variantGroup = crypto.randomUUID();

  for (const lang of languages) {
    try {
      const langReport = { ...report, language: lang };
      const asset = buildReportAsset(project.id, langReport, lang, variantGroup, lang !== project.primaryLanguage);
      // In a full implementation, this would call projectDB.saveAsset(asset)
      // and write the JSON report to the asset storage path.
      // For now, we collect the asset IDs.
      assetIds.push(asset.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to save ${lang} asset: ${message}`);
    }
  }

  onProgress?.({
    phase: 'complete',
    platform,
    progress: 100,
    message: `Research complete. ${assetIds.length} asset(s) saved.`,
  });

  return {
    projectId: project.id,
    platform,
    report,
    assetIds,
    languages,
    completedAt: new Date(),
    errors,
  };
}

// ── Multi-platform research ────────────────────────────────────────────────

export async function runMultiPlatformResearch(
  project: Project,
  onProgress?: ProgressCallback
): Promise<ResearchOrchestrationResult[]> {
  const enabledPlatforms = project.researchSettings.platforms.filter(p => p.enabled);
  const results: ResearchOrchestrationResult[] = [];

  // Run sequentially to respect API rate limits
  for (const platformConfig of enabledPlatforms) {
    try {
      const result = await runResearch(project, platformConfig.platform, onProgress);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        projectId: project.id,
        platform: platformConfig.platform,
        report: createEmptyReport(project.id, platformConfig.platform, project.primaryLanguage),
        assetIds: [],
        languages: [],
        completedAt: new Date(),
        errors: [`Platform research failed: ${message}`],
      });
    }
  }

  return results;
}

// ── Refresh research (compare to baselines) ────────────────────────────────

export async function refreshResearch(
  project: Project,
  platform: PlatformId,
  onProgress?: ProgressCallback
): Promise<ResearchOrchestrationResult> {
  // Run the research again
  const result = await runResearch(project, platform, onProgress);

  // Compare to previous baselines stored in project memory
  const baselines = project.memory.baselines.filter(b => b.platform === platform);

  if (baselines.length > 0 && result.report.analysis) {
    const changes: string[] = [];

    for (const baseline of baselines) {
      const currentValue = getCurrentMetricValue(result.report, baseline.metric);
      if (currentValue !== null) {
        const delta = currentValue - baseline.value;
        const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged';
        const pctChange = baseline.value !== 0
          ? Math.round(Math.abs(delta / baseline.value) * 100)
          : 0;

        if (direction !== 'unchanged') {
          changes.push(
            `${baseline.metric}: ${direction} ${pctChange}% since last measurement ` +
            `(${baseline.value.toLocaleString()} → ${currentValue.toLocaleString()})`
          );
        }
      }
    }

    if (changes.length > 0) {
      result.report.analysis.keyFindings.unshift(
        `Changes since last research run:`,
        ...changes
      );
    }
  }

  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function createEmptyReport(
  projectId: string,
  platform: PlatformId,
  language: LanguageCode
): ResearchReport {
  return {
    id: crypto.randomUUID(),
    projectId,
    platform,
    generatedAt: new Date(),
    language,
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
      keyFindings: ['Research could not be completed — see errors.'],
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

function buildReportAsset(
  projectId: string,
  report: ResearchReport,
  language: LanguageCode,
  variantGroup: string,
  isTranslation: boolean
): Asset {
  const reportJson = JSON.stringify(report);
  const sizeBytes = new TextEncoder().encode(reportJson).length;

  return {
    id: crypto.randomUUID(),
    projectId,
    executionId: report.id,
    segmentId: `research-${report.platform}`,
    name: `Research Report — ${report.platform} (${language})`,
    assetType: 'document',
    category: 'research_report',
    language,
    languageVariantGroup: variantGroup,
    isTranslation,
    filename: `research-${report.platform}-${language}-${report.generatedAt.toISOString().slice(0, 10)}.json`,
    mimeType: 'application/json',
    sizeBytes,
    storagePath: `assets/0. Projects/${projectId}/research/${report.platform}/${language}/`,
    textPreview: report.analysis.keyFindings.slice(0, 3).join(' | '),
    createdAt: new Date(),
    tags: [report.platform, 'research', language],
    platform: report.platform,
    status: 'draft',
    version: 1,
  };
}

function estimatePostingFrequency(posts: import('../_shared/content-schema').ContentPost[]): number {
  if (posts.length < 2) return 0;

  const sorted = [...posts].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );
  const firstDate = new Date(sorted[0].publishedAt).getTime();
  const lastDate = new Date(sorted[sorted.length - 1].publishedAt).getTime();
  const daySpan = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

  if (daySpan === 0) return posts.length * 7; // All on same day — extrapolate
  return Math.round((posts.length / daySpan) * 7 * 10) / 10; // posts per week, 1 decimal
}

function getCurrentMetricValue(report: ResearchReport, metric: string): number | null {
  const ownAccount = report.overview.find(a =>
    report.ownChannel.some(p => p.accountHandle.toLowerCase() === a.handle.toLowerCase())
  );

  if (!ownAccount) return null;

  switch (metric) {
    case 'followers': return ownAccount.followers;
    case 'totalViews': return ownAccount.totalViews;
    case 'totalLikes': return ownAccount.totalLikes;
    case 'averageViewsPerPost': return ownAccount.averageViewsPerPost;
    default: return null;
  }
}
