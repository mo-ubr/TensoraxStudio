// Recommendation generator — takes analysis + platform config, produces actionable recommendations.
// Pure computation: no API calls, no side effects.

import type { AnalysisSection, RecommendationSection, AccountProfile } from '../_shared/content-schema';
import type { PlatformConfig, PlatformId } from '../_shared/platform-config.types';

// ── Main entry point ───────────────────────────────────────────────────────

export function generateRecommendations(
  platform: PlatformId,
  analysis: AnalysisSection,
  platformConfig: PlatformConfig,
  ownAccount: AccountProfile | null,
  userInstructions: string
): RecommendationSection {
  const algorithmSignals = buildAlgorithmSignals(platformConfig);
  const targetAudience = buildTargetAudience(platformConfig, analysis);
  const setupChecklist = buildSetupChecklist(platformConfig, ownAccount);
  const actionPlan = buildActionPlan(analysis, platformConfig);
  const contentCalendar = buildContentCalendar(platformConfig, analysis);
  const growthTargets = calculateGrowthTargets(ownAccount, analysis);
  const contentSeries = buildContentSeries(platformConfig, analysis);

  return {
    algorithmSignals,
    targetAudience,
    setupChecklist,
    actionPlan,
    contentCalendar,
    growthTargets,
    contentSeries,
  };
}

// ── Algorithm signals ──────────────────────────────────────────────────────

function buildAlgorithmSignals(
  platformConfig: PlatformConfig
): RecommendationSection['algorithmSignals'] {
  return platformConfig.algorithmSignals
    .filter(s => s.actionable)
    .sort((a, b) => {
      const weightOrder: Record<string, number> = {
        highest: 5, very_high: 4, high: 3, medium: 2, low: 1,
      };
      return (weightOrder[b.weight] ?? 0) - (weightOrder[a.weight] ?? 0);
    })
    .map(s => ({
      signal: s.signal,
      weight: s.weight,
      action: s.tips.length > 0 ? s.tips[0] : s.description,
    }));
}

// ── Target audience ────────────────────────────────────────────────────────

function buildTargetAudience(
  platformConfig: PlatformConfig,
  analysis: AnalysisSection
): RecommendationSection['targetAudience'] {
  const audience = platformConfig.audienceProfile;
  const primary = `${audience.primaryDemographic}, ages ${audience.ageRange.min}–${audience.ageRange.max}`;
  const secondary = audience.secondaryDemographics;
  const notes = [
    ...audience.behaviorNotes,
    ...analysis.viralVideoAnalysis.commonThemes.length > 0
      ? [`Trending themes: ${analysis.viralVideoAnalysis.commonThemes.slice(0, 5).join(', ')}`]
      : [],
  ].join('. ');

  return { primary, secondary, notes };
}

// ── Setup checklist ────────────────────────────────────────────────────────

function buildSetupChecklist(
  platformConfig: PlatformConfig,
  ownAccount: AccountProfile | null
): RecommendationSection['setupChecklist'] {
  return platformConfig.setupChecklist
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = {
        critical: 4, high: 3, medium: 2, low: 1,
      };
      return (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
    })
    .map(item => {
      // Auto-mark certain items as completed based on account state
      let isNeeded = true;
      if (ownAccount) {
        if (item.category === 'profile' && ownAccount.bio.length > 0 && item.id === 'bio') {
          isNeeded = false;
        }
        if (item.category === 'profile' && ownAccount.verified && item.id === 'verification') {
          isNeeded = false;
        }
      }

      return {
        item: isNeeded ? item.item : `✓ ${item.item}`,
        howTo: item.howTo,
        priority: item.priority,
      };
    });
}

// ── Action plan ────────────────────────────────────────────────────────────

export function buildActionPlan(
  analysis: AnalysisSection,
  platformConfig: PlatformConfig
): RecommendationSection['actionPlan'] {
  const plan: RecommendationSection['actionPlan'] = [];
  const bestFormats = analysis.viralVideoAnalysis.bestFormats;
  const primaryFormat = bestFormats[0] ?? 'video';
  const frequency = platformConfig.optimalTiming.postingFrequency;
  const postsPerWeek = Math.min(frequency.max, Math.max(frequency.min, 5));

  // Day 1-7: specific daily actions
  plan.push({
    day: 'Day 1',
    action: 'Profile optimisation',
    details: 'Complete all setup checklist items marked as critical and high priority. Update bio, profile image, and links.',
  });

  plan.push({
    day: 'Day 2',
    action: 'Competitor deep-dive',
    details: `Study the top 3 performing competitor accounts. Note their content style, posting frequency, and most-used hashtags.`,
  });

  plan.push({
    day: 'Day 3',
    action: 'First content piece',
    details: `Create and post your first ${primaryFormat} using the recommended hashtags: ${analysis.hashtagGaps.recommended.slice(0, 5).join(', ') || 'none identified yet'}.`,
  });

  plan.push({
    day: 'Day 4',
    action: 'Engagement sprint',
    details: 'Spend 30 minutes engaging with competitor audiences — like, comment on, and share relevant posts in your niche.',
  });

  plan.push({
    day: 'Day 5',
    action: 'Second content piece',
    details: `Post another ${primaryFormat}. Experiment with the optimal duration range: ${analysis.viralVideoAnalysis.optimalDuration.min}–${analysis.viralVideoAnalysis.optimalDuration.max}s.`,
  });

  plan.push({
    day: 'Day 6',
    action: 'Hashtag strategy refinement',
    details: `Review performance of Day 3 and Day 5 posts. Adjust hashtags based on initial results.`,
  });

  plan.push({
    day: 'Day 7',
    action: 'Week 1 review and plan',
    details: 'Review all metrics from the first week. Set baseline numbers. Plan Week 2 content calendar.',
  });

  // Week 2-4: weekly milestones
  plan.push({
    day: 'Week 2',
    action: `Scale to ${postsPerWeek} posts/week`,
    details: `Maintain a consistent ${postsPerWeek} posts per week. Focus on the formats that performed best in Week 1.`,
  });

  plan.push({
    day: 'Week 3',
    action: 'Content series launch',
    details: 'Start a recurring content series (see Content Series below). Consistency builds audience expectation.',
  });

  plan.push({
    day: 'Week 4',
    action: 'Month 1 review and optimise',
    details: 'Full performance review. Compare to baselines. Adjust posting times, formats, and hashtags based on data.',
  });

  return plan;
}

// ── Content calendar ───────────────────────────────────────────────────────

export function buildContentCalendar(
  platformConfig: PlatformConfig,
  analysis: AnalysisSection
): RecommendationSection['contentCalendar'] {
  const calendar: RecommendationSection['contentCalendar'] = [];
  const timing = platformConfig.optimalTiming;
  const bestFormats = analysis.viralVideoAnalysis.bestFormats;
  const themes = analysis.viralVideoAnalysis.commonThemes;

  // Build time string from optimal hours
  const startHour = timing.bestHoursStart.toString().padStart(2, '0');
  const endHour = timing.bestHoursEnd.toString().padStart(2, '0');
  const timeSlots = [`${startHour}:00`, `${endHour}:00`];

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const bestDaysSet = new Set(timing.bestDays.map(d => d.toLowerCase()));

  for (const day of daysOfWeek) {
    const isBestDay = bestDaysSet.has(day.toLowerCase());
    if (!isBestDay && calendar.length >= (timing.postingFrequency.min ?? 3)) {
      // Skip non-optimal days once we hit minimum frequency
      continue;
    }

    const formatIndex = calendar.length % Math.max(bestFormats.length, 1);
    const themeIndex = calendar.length % Math.max(themes.length, 1);
    const timeIndex = calendar.length % timeSlots.length;

    calendar.push({
      dayOfWeek: day,
      time: timeSlots[timeIndex],
      format: bestFormats[formatIndex] ?? 'video',
      topic: themes[themeIndex] ?? 'trending topic',
    });
  }

  return calendar;
}

// ── Growth targets ─────────────────────────────────────────────────────────

export function calculateGrowthTargets(
  ownAccount: AccountProfile | null,
  analysis: AnalysisSection,
  timeframeDays: number = 90
): RecommendationSection['growthTargets'] {
  const targets: RecommendationSection['growthTargets'] = [];

  const currentFollowers = ownAccount?.followers ?? 0;
  const currentViews = ownAccount?.averageViewsPerPost ?? 0;
  const currentTotalViews = ownAccount?.totalViews ?? 0;

  const followerGap = analysis.currentPosition.gapToTop10.followers ?? 0;
  const viewGap = analysis.currentPosition.gapToTop10.averageViewsPerPost ?? 0;

  // Followers: aim to close 20% of the gap in 90 days (realistic)
  const followerTarget30 = Math.round(currentFollowers + followerGap * 0.05);
  const followerTarget60 = Math.round(currentFollowers + followerGap * 0.12);
  const followerTarget90 = Math.round(currentFollowers + followerGap * 0.20);

  targets.push({
    metric: 'Followers',
    current: currentFollowers,
    target: followerTarget30,
    timeframe: '30 days',
  });
  targets.push({
    metric: 'Followers',
    current: currentFollowers,
    target: followerTarget60,
    timeframe: '60 days',
  });
  targets.push({
    metric: 'Followers',
    current: currentFollowers,
    target: followerTarget90,
    timeframe: '90 days',
  });

  // Average views per post: aim to close 25% of gap in 90 days
  const viewTarget30 = Math.round(currentViews + viewGap * 0.08);
  const viewTarget60 = Math.round(currentViews + viewGap * 0.16);
  const viewTarget90 = Math.round(currentViews + viewGap * 0.25);

  targets.push({
    metric: 'Avg views/post',
    current: currentViews,
    target: viewTarget30,
    timeframe: '30 days',
  });
  targets.push({
    metric: 'Avg views/post',
    current: currentViews,
    target: viewTarget60,
    timeframe: '60 days',
  });
  targets.push({
    metric: 'Avg views/post',
    current: currentViews,
    target: viewTarget90,
    timeframe: '90 days',
  });

  // Engagement rate
  const currentEngagement = analysis.engagementQuality.authenticEngagementScore;
  targets.push({
    metric: 'Engagement score',
    current: Math.round(currentEngagement * 100),
    target: Math.min(100, Math.round(currentEngagement * 100) + 15),
    timeframe: '90 days',
  });

  return targets;
}

// ── Content series ─────────────────────────────────────────────────────────

function buildContentSeries(
  platformConfig: PlatformConfig,
  analysis: AnalysisSection
): RecommendationSection['contentSeries'] {
  const formats = platformConfig.contentFormats
    .filter(f => f.recommended)
    .sort((a, b) => b.engagementMultiplier - a.engagementMultiplier);

  const themes = analysis.viralVideoAnalysis.commonThemes;
  const series: RecommendationSection['contentSeries'] = [];

  // Distribute posting percentage across recommended formats
  let remainingPercentage = 100;
  const formatCount = Math.min(formats.length, 4); // Max 4 series

  for (let i = 0; i < formatCount; i++) {
    const format = formats[i];
    const isLast = i === formatCount - 1;
    const percentage = isLast
      ? remainingPercentage
      : Math.round(remainingPercentage * (format.engagementMultiplier / formats.reduce((s, f) => s + f.engagementMultiplier, 0)));

    const theme = themes[i] ?? 'industry insights';
    const freq = platformConfig.optimalTiming.postingFrequency;
    const postsPerWeek = Math.max(1, Math.round(((freq.min + freq.max) / 2) * (percentage / 100)));

    series.push({
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} ${format.name}`,
      format: format.name,
      frequency: `${postsPerWeek}x per week`,
      percentage,
    });

    remainingPercentage -= percentage;
  }

  // If no formats were recommended, provide a generic series
  if (series.length === 0) {
    series.push({
      name: 'Main content',
      format: 'video',
      frequency: '3x per week',
      percentage: 60,
    });
    series.push({
      name: 'Behind the scenes',
      format: 'video',
      frequency: '1x per week',
      percentage: 20,
    });
    series.push({
      name: 'Community engagement',
      format: 'video',
      frequency: '1x per week',
      percentage: 20,
    });
  }

  return series;
}
