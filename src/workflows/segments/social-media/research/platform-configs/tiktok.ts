import type { PlatformConfig } from '../../_shared/platform-config.types';

export const PLATFORM_CONFIG: PlatformConfig = {
  platform: 'tiktok',
  displayName: 'TikTok',

  metrics: [
    { id: 'plays', name: 'Plays', description: 'Total video plays', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'likes', name: 'Likes', description: 'Total likes on video', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'shares', name: 'Shares', description: 'Total shares of video', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'comments', name: 'Comments', description: 'Total comments on video', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'saves', name: 'Saves', description: 'Times video was saved/bookmarked', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'duration', name: 'Duration', description: 'Video length in seconds', dataType: 'duration', aggregation: 'average', higherIsBetter: false, platformSpecific: false, available: true },
    { id: 'engagement_rate', name: 'Engagement Rate', description: 'Engagement as percentage of plays', dataType: 'percentage', aggregation: 'average', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'followers', name: 'Followers', description: 'Account follower count', dataType: 'number', aggregation: 'max', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'profile_visits', name: 'Profile Visits', description: 'Visits to profile from video', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'avg_watch_time', name: 'Average Watch Time', description: 'Average seconds viewers watch', dataType: 'duration', aggregation: 'average', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'completion_rate', name: 'Completion Rate', description: 'Percentage of viewers who watch to the end', dataType: 'percentage', aggregation: 'average', higherIsBetter: true, platformSpecific: false, available: true },
  ],

  algorithmSignals: [
    {
      signal: 'Watch Time',
      weight: 'highest',
      description: 'Total and average watch time is the single most important ranking factor, accounting for roughly 50% of the algorithm score',
      actionable: true,
      tips: [
        'Hook viewers in the first 1-2 seconds with a bold visual or question',
        'Use pattern interrupts every 3-5 seconds to maintain attention',
        'Keep videos under 60 seconds for highest completion rates',
        'Add text overlays so viewers re-watch to read everything',
      ],
    },
    {
      signal: 'Completion Rate',
      weight: 'very_high',
      description: 'Percentage of viewers who watch the entire video; signals content quality to the algorithm',
      actionable: true,
      tips: [
        'Tease the payoff at the start so viewers stay for it',
        'Shorter videos naturally achieve higher completion rates',
        'Use "wait for it" or countdown hooks to build anticipation',
        'End abruptly to encourage replays',
      ],
    },
    {
      signal: 'Shares',
      weight: 'high',
      description: 'Shares indicate content worth spreading; weighted heavily for distribution beyond followers',
      actionable: true,
      tips: [
        'Create content people want to show friends (funny, shocking, useful)',
        'Relatable content in local language drives shares in tight communities',
        'Educational "did you know" formats encourage sharing',
      ],
    },
    {
      signal: 'Replays',
      weight: 'high',
      description: 'Multiple views from the same user signal exceptionally engaging content',
      actionable: true,
      tips: [
        'Include fast-moving details that reward re-watching',
        'Use text that disappears quickly so viewers loop back',
        'Create satisfying loops where the end connects to the beginning',
      ],
    },
    {
      signal: 'Comments',
      weight: 'medium',
      description: 'Comments indicate engagement depth; longer comments and replies weigh more',
      actionable: true,
      tips: [
        'Ask a direct question in the video or caption',
        'Make a mildly controversial or debatable statement',
        'Reply to comments to boost the thread and signal activity',
        'Pin a comment with a question to encourage discussion',
      ],
    },
    {
      signal: 'Profile Visits',
      weight: 'medium',
      description: 'When viewers visit your profile after watching, it signals strong interest and intent to follow',
      actionable: true,
      tips: [
        'Create series content so viewers check your profile for more',
        'Use a consistent visual style so your profile grid looks cohesive',
        'Mention "check my other videos" or "part 2 on my page"',
      ],
    },
  ],

  contentFormats: [
    { id: 'short_video', name: 'Short Video (15s)', description: 'Quick-hit content for maximum completion rate', maxDuration: 15, aspectRatios: ['9:16'], recommended: true, engagementMultiplier: 1.3 },
    { id: 'standard_video', name: 'Standard Video (60s)', description: 'Core TikTok format, balances depth and completion', maxDuration: 60, aspectRatios: ['9:16'], recommended: true, engagementMultiplier: 1.0 },
    { id: 'extended_video', name: 'Extended Video (3min)', description: 'For tutorials, stories, deeper explanations', maxDuration: 180, aspectRatios: ['9:16'], recommended: false, engagementMultiplier: 0.7 },
    { id: 'long_video', name: 'Long Video (10min)', description: 'Long-form content for established accounts', maxDuration: 600, aspectRatios: ['9:16'], recommended: false, engagementMultiplier: 0.4 },
  ],

  optimalTiming: {
    bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
    bestHoursStart: 14,
    bestHoursEnd: 18,
    timezone: 'Europe/Sofia',
    postingFrequency: { min: 1, max: 3, unit: 'day' },
    notes: 'Bulgarian audience most active weekday afternoons. Consistency matters more than volume — the algorithm rewards daily posting.',
  },

  audienceProfile: {
    ageRange: { min: 25, max: 45 },
    primaryDemographic: 'Urban Bulgarians aged 25-45 interested in civic affairs and local issues',
    secondaryDemographics: [
      'Bulgarian diaspora (UK, Germany, Spain)',
      'Young professionals aged 18-25',
      'Parents aged 35-50 concerned about education and healthcare',
    ],
    interests: [
      'Bulgarian politics and governance',
      'Anti-corruption and transparency',
      'EU integration and European affairs',
      'Local community issues',
      'Education and youth opportunity',
    ],
    behaviorNotes: [
      'Bulgarian TikTok users engage heavily with local-language content',
      'Duet and stitch features drive conversation on civic topics',
      'Humour and satire perform exceptionally well for political content',
      'Evening browsing spikes after 20:00 on weekdays',
    ],
  },

  scrapingMethod: 'thirdParty',

  setupChecklist: [
    { id: 'tt-01', category: 'profile', item: 'Switch to Business Account', howTo: 'Settings → Manage Account → Switch to Business Account for analytics access', priority: 'critical' },
    { id: 'tt-02', category: 'profile', item: 'Complete profile bio with keywords', howTo: 'Add civic/political keywords in bio, include call-to-action and link', priority: 'critical' },
    { id: 'tt-03', category: 'profile', item: 'Add profile picture and banner', howTo: 'Use consistent branding; square profile pic, 9:16 banner if available', priority: 'high' },
    { id: 'tt-04', category: 'profile', item: 'Set up Linktree or bio link', howTo: 'Use linktr.ee or similar to direct traffic to website, petition, or donation page', priority: 'high' },
    { id: 'tt-05', category: 'content', item: 'Define 3-5 content pillars', howTo: 'Choose recurring themes (e.g. corruption explainers, citizen Q&A, EU news, local heroes)', priority: 'critical' },
    { id: 'tt-06', category: 'content', item: 'Create branded intro/outro template', howTo: 'Design a 1-2 second branded intro and consistent outro with CTA', priority: 'high' },
    { id: 'tt-07', category: 'content', item: 'Prepare 10 videos before launching', howTo: 'Batch-record first 10 videos so you can post daily without gaps', priority: 'high' },
    { id: 'tt-08', category: 'content', item: 'Research trending sounds and hashtags', howTo: 'Check TikTok Creative Center for trending audio in Bulgaria', priority: 'medium' },
    { id: 'tt-09', category: 'engagement', item: 'Follow and engage with 20+ relevant accounts', howTo: 'Follow civic influencers, journalists, and community pages; comment meaningfully', priority: 'high' },
    { id: 'tt-10', category: 'engagement', item: 'Set daily engagement routine (15 min)', howTo: 'Reply to comments, stitch/duet relevant content, engage in first hour after posting', priority: 'high' },
    { id: 'tt-11', category: 'engagement', item: 'Enable comment filters', howTo: 'Settings → Privacy → Comments → Filter keywords to block spam and hate speech', priority: 'medium' },
    { id: 'tt-12', category: 'analytics', item: 'Enable TikTok Analytics', howTo: 'Business Account automatically enables analytics; check Creator Tools → Analytics weekly', priority: 'critical' },
    { id: 'tt-13', category: 'analytics', item: 'Set up Apify scraping for competitors', howTo: 'Configure Apify TikTok Scraper actor to collect competitor data weekly', priority: 'high' },
    { id: 'tt-14', category: 'legal', item: 'Review TikTok Community Guidelines', howTo: 'Read and bookmark https://www.tiktok.com/community-guidelines — political content has extra scrutiny', priority: 'critical' },
    { id: 'tt-15', category: 'legal', item: 'Add election/political disclaimers if required', howTo: 'Check local electoral law for disclosure requirements on political content', priority: 'high' },
  ],

  paidAdvertising: {
    available: true,
    restrictions: [
      'Political advertising is heavily restricted or banned in many regions',
      'TikTok may flag civic content as political and limit distribution',
      'Requires identity verification for ad accounts',
      'Some regions require authorisation for issue-based advertising',
    ],
    formats: ['In-Feed Ads', 'TopView', 'Branded Hashtag Challenge', 'Spark Ads (boost organic posts)'],
    minBudget: 50,
    currency: 'USD',
    politicalAdRules: 'TikTok generally prohibits political advertising. Civic education content may be acceptable but is subject to review. Check TikTok Ad Policies for your region before spending.',
  },
};
