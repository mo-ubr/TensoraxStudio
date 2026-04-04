import type { PlatformConfig } from '../../_shared/platform-config.types';

export const PLATFORM_CONFIG: PlatformConfig = {
  platform: 'youtube',
  displayName: 'YouTube',

  metrics: [
    { id: 'views', name: 'Views', description: 'Total video views', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'likes', name: 'Likes', description: 'Total likes on video', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'comments', name: 'Comments', description: 'Total comments on video', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'shares', name: 'Shares', description: 'Total shares of video', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'subscribers', name: 'Subscribers', description: 'Channel subscriber count', dataType: 'number', aggregation: 'max', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'watch_time_hours', name: 'Watch Time (Hours)', description: 'Total watch time in hours', dataType: 'duration', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'avg_view_duration', name: 'Average View Duration', description: 'Average time viewers spend watching', dataType: 'duration', aggregation: 'average', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'ctr', name: 'Click-Through Rate', description: 'Percentage of impressions that result in a view', dataType: 'percentage', aggregation: 'average', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'impressions', name: 'Impressions', description: 'Times thumbnail was shown to viewers', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
  ],

  algorithmSignals: [
    {
      signal: 'Watch Time',
      weight: 'highest',
      description: 'Total watch time is YouTube\'s primary ranking signal; longer cumulative watch time means more recommendations',
      actionable: true,
      tips: [
        'Front-load value — deliver on the title promise quickly to keep viewers',
        'Use chapter markers so viewers can jump to relevant sections',
        'Create playlists to chain videos and boost session watch time',
        'Longer videos (8-15 min) accumulate more watch time per view if retention is decent',
      ],
    },
    {
      signal: 'Click-Through Rate (CTR)',
      weight: 'very_high',
      description: 'The ratio of impressions to clicks; determined almost entirely by thumbnail and title',
      actionable: true,
      tips: [
        'Design thumbnails with faces, high contrast, and minimal text (3-4 words max)',
        'Use curiosity-gap titles that promise specific value',
        'A/B test thumbnails — YouTube now offers built-in thumbnail testing',
        'Avoid clickbait — high CTR with low retention hurts more than it helps',
      ],
    },
    {
      signal: 'Session Time',
      weight: 'high',
      description: 'Videos that lead viewers to watch MORE YouTube (not just your video) are rewarded with higher recommendations',
      actionable: true,
      tips: [
        'Add end screens linking to your next video or playlist',
        'Use cards to link to related content mid-video',
        'Create series content so viewers binge multiple episodes',
        'Avoid sending viewers off-platform (external links) in the first 48 hours',
      ],
    },
    {
      signal: 'Engagement (Likes, Comments, Shares)',
      weight: 'high',
      description: 'Combined engagement signals indicate content quality; comments and shares weigh more than likes',
      actionable: true,
      tips: [
        'Ask viewers a specific question related to the video topic',
        'Pin a comment with a question to spark discussion threads',
        'Respond to comments in the first 24 hours to boost the thread',
        'Create content that sparks debate or invites personal stories',
      ],
    },
    {
      signal: 'Upload Frequency',
      weight: 'medium',
      description: 'Consistent upload schedule signals an active channel; the algorithm favours channels that post regularly',
      actionable: true,
      tips: [
        'Set a realistic schedule (1-2x per week) and stick to it',
        'Use Community posts on off-days to maintain engagement',
        'Shorts can fill gaps between long-form uploads',
        'Batch-produce content to maintain a buffer of 2-3 unreleased videos',
      ],
    },
  ],

  contentFormats: [
    { id: 'long_form', name: 'Long-Form Video', description: 'Standard YouTube video, ideal for deep dives and tutorials', maxDuration: 43200, aspectRatios: ['16:9'], recommended: true, engagementMultiplier: 1.0 },
    { id: 'shorts', name: 'YouTube Shorts', description: 'Vertical short-form video under 60 seconds, high reach potential', maxDuration: 60, aspectRatios: ['9:16'], recommended: true, engagementMultiplier: 1.4 },
    { id: 'live', name: 'YouTube Live', description: 'Live streaming for events, Q&A, and real-time engagement', aspectRatios: ['16:9'], recommended: false, engagementMultiplier: 1.1 },
    { id: 'community', name: 'Community Posts', description: 'Text, polls, and images in the Community tab; keeps audience engaged between uploads', aspectRatios: ['1:1', '16:9'], recommended: true, engagementMultiplier: 0.3 },
  ],

  optimalTiming: {
    bestDays: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
    bestHoursStart: 14,
    bestHoursEnd: 16,
    timezone: 'Europe/Sofia',
    postingFrequency: { min: 1, max: 3, unit: 'week' },
    notes: 'Upload 2-3 hours before peak viewing time so the algorithm has time to index and start recommending. Weekend viewership is higher for long-form content. Shorts can be posted daily.',
  },

  audienceProfile: {
    ageRange: { min: 18, max: 55 },
    primaryDemographic: 'Broad Bulgarian audience aged 18-55 seeking in-depth content and explainers',
    secondaryDemographics: [
      'Students and young adults 18-25 (Shorts and educational content)',
      'Professionals 30-45 (long-form analysis and commentary)',
      'Bulgarian diaspora seeking news and cultural connection',
      'Older adults 50+ (increasingly active on YouTube)',
    ],
    interests: [
      'News analysis and commentary',
      'Educational content and explainers',
      'Documentary-style storytelling',
      'Technology and how-to content',
      'Political analysis and debate',
    ],
    behaviorNotes: [
      'YouTube has the broadest age range of any video platform',
      'Long-form content builds deeper audience loyalty than short-form',
      'Search-driven discovery means SEO (title, description, tags) matters more here',
      'Subscribers are harder to gain but more valuable than followers on other platforms',
      'YouTube viewers are more willing to watch 10+ minute content if the topic interests them',
    ],
  },

  scrapingMethod: 'api',

  setupChecklist: [
    { id: 'yt-01', category: 'profile', item: 'Create YouTube Channel with brand account', howTo: 'Use a Brand Account (not personal) so multiple people can manage it', priority: 'critical' },
    { id: 'yt-02', category: 'profile', item: 'Complete channel description with keywords', howTo: 'Write a keyword-rich channel description explaining your mission and content', priority: 'critical' },
    { id: 'yt-03', category: 'profile', item: 'Design channel art and profile picture', howTo: 'Banner: 2560x1440px with safe area 1546x423px; profile: 800x800px', priority: 'high' },
    { id: 'yt-04', category: 'profile', item: 'Create channel trailer', howTo: 'Record a 30-60 second trailer for non-subscribers explaining what the channel is about', priority: 'high' },
    { id: 'yt-05', category: 'content', item: 'Define content pillars and series', howTo: 'Plan 3-4 recurring series with consistent naming and branding', priority: 'critical' },
    { id: 'yt-06', category: 'content', item: 'Create thumbnail template', howTo: 'Design a reusable Canva/Photoshop template with consistent style across videos', priority: 'critical' },
    { id: 'yt-07', category: 'content', item: 'Prepare 5 videos before channel launch', howTo: 'Record and edit 5 videos so new visitors find a library to binge', priority: 'high' },
    { id: 'yt-08', category: 'content', item: 'Set up end screens and cards templates', howTo: 'Create reusable end screen layouts linking to next video and subscribe', priority: 'high' },
    { id: 'yt-09', category: 'content', item: 'Create playlists for each content series', howTo: 'Organise videos into playlists; optimise playlist titles and descriptions for search', priority: 'medium' },
    { id: 'yt-10', category: 'engagement', item: 'Enable Community tab', howTo: 'Available once you reach eligibility; use for polls, updates, and behind-the-scenes', priority: 'medium' },
    { id: 'yt-11', category: 'engagement', item: 'Set up comment moderation', howTo: 'YouTube Studio → Settings → Community → set held/blocked words and auto-filters', priority: 'high' },
    { id: 'yt-12', category: 'engagement', item: 'Create a pinned comment strategy', howTo: 'Pin a question or CTA as the first comment on every video', priority: 'medium' },
    { id: 'yt-13', category: 'analytics', item: 'Learn YouTube Studio Analytics', howTo: 'Review Reach, Engagement, Audience, and Revenue tabs weekly', priority: 'critical' },
    { id: 'yt-14', category: 'analytics', item: 'Set up impression and CTR tracking', howTo: 'Monitor impressions and CTR in YouTube Studio → Analytics → Reach', priority: 'high' },
    { id: 'yt-15', category: 'legal', item: 'Review YouTube Community Guidelines', howTo: 'Read https://www.youtube.com/howyoutubeworks/policies/community-guidelines/', priority: 'critical' },
  ],

  paidAdvertising: {
    available: true,
    restrictions: [
      'Political ads require verification through Google Ads political ad program',
      'Must verify identity and disclose who is paying for the ad',
      'Political ads are stored in Google Ads Transparency Center',
      'Targeting restrictions apply to political and election-related content',
    ],
    formats: ['Skippable In-Stream Ads', 'Non-Skippable In-Stream Ads', 'Bumper Ads (6s)', 'Discovery Ads', 'Shorts Ads'],
    minBudget: 10,
    currency: 'USD',
    politicalAdRules: 'Google requires election ad verification in supported countries. Advertisers must verify identity and disclose funding source. All political ads appear in Google Ads Transparency Center. Bulgaria may or may not be in the supported countries list — check https://support.google.com/adspolicy/answer/6014595.',
  },
};
