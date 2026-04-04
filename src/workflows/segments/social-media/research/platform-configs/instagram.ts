import type { PlatformConfig } from '../../_shared/platform-config.types';

export const PLATFORM_CONFIG: PlatformConfig = {
  platform: 'instagram',
  displayName: 'Instagram',

  metrics: [
    { id: 'views', name: 'Views', description: 'Total views on Reels and videos', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'likes', name: 'Likes', description: 'Total likes on post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'comments', name: 'Comments', description: 'Total comments on post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'shares', name: 'Shares', description: 'Times post was shared via DM or to Stories', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'saves', name: 'Saves', description: 'Times post was saved/bookmarked', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'reach', name: 'Reach', description: 'Unique accounts who saw the post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'impressions', name: 'Impressions', description: 'Total times post was displayed', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'profile_visits', name: 'Profile Visits', description: 'Visits to profile from post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'engagement_rate', name: 'Engagement Rate', description: 'Engagement as percentage of reach', dataType: 'percentage', aggregation: 'average', higherIsBetter: true, platformSpecific: false, available: true },
  ],

  algorithmSignals: [
    {
      signal: 'Saves',
      weight: 'highest',
      description: 'Saves are the top-weighted engagement signal on Instagram, indicating content worth revisiting',
      actionable: true,
      tips: [
        'Create educational carousels that serve as reference material',
        'Post infographics with data people want to keep',
        'Use "save this" CTAs in captions and on-screen text',
        'Tip lists and how-to content drive the highest save rates',
      ],
    },
    {
      signal: 'Shares via DM',
      weight: 'very_high',
      description: 'Sending a post via DM is a strong signal of trust and relevance; drives distribution to non-followers',
      actionable: true,
      tips: [
        'Create relatable content people want to send to friends',
        'Memes and locally relevant humour get shared via DM',
        'Controversial or surprising facts trigger "did you see this?" sharing',
        'Tag-a-friend prompts in captions encourage DM shares',
      ],
    },
    {
      signal: 'Comments',
      weight: 'high',
      description: 'Comments signal active engagement; the algorithm favours posts that generate conversation',
      actionable: true,
      tips: [
        'Ask questions in captions — open-ended ones work best',
        'Reply to every comment to double the comment count and build threads',
        'Use polls and "this or that" prompts in captions',
        'Respond within 30 minutes of posting for maximum algorithm boost',
      ],
    },
    {
      signal: 'Watch Time (Reels)',
      weight: 'high',
      description: 'For Reels, total and average watch time determine how widely the content is distributed',
      actionable: true,
      tips: [
        'Hook in the first second — Reels auto-play so visual impact is everything',
        'Keep Reels under 30 seconds for highest completion rates',
        'Use text overlays and captions for muted viewing',
        'Create loops where the end seamlessly connects to the start',
      ],
    },
    {
      signal: 'Carousel Swipe-Through Rate',
      weight: 'medium',
      description: 'For carousels, the percentage of slides users swipe through signals content depth',
      actionable: true,
      tips: [
        'Start with a hook slide that promises value in the rest',
        'Use 7-10 slides for optimal engagement (not too short, not too long)',
        'End with a CTA slide — save, share, follow, or comment',
        'Make each slide valuable so users swipe all the way through',
      ],
    },
  ],

  contentFormats: [
    { id: 'reels', name: 'Reels', description: 'Short vertical video, Instagram\'s highest-reach format', maxDuration: 90, aspectRatios: ['9:16'], recommended: true, engagementMultiplier: 1.5 },
    { id: 'feed_post', name: 'Feed Post', description: 'Single image or video in the feed', aspectRatios: ['1:1', '4:5'], recommended: true, engagementMultiplier: 0.8 },
    { id: 'carousel', name: 'Carousel', description: 'Swipeable multi-image posts, excellent for education and storytelling', aspectRatios: ['1:1', '4:5'], recommended: true, engagementMultiplier: 1.3 },
    { id: 'stories', name: 'Stories', description: '24-hour ephemeral content with polls, questions, links', maxDuration: 60, aspectRatios: ['9:16'], recommended: true, engagementMultiplier: 0.7 },
    { id: 'live', name: 'Instagram Live', description: 'Live streaming for real-time engagement', aspectRatios: ['9:16'], recommended: false, engagementMultiplier: 1.2 },
  ],

  optimalTiming: {
    bestDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    bestHoursStart: 11,
    bestHoursEnd: 14,
    timezone: 'Europe/Sofia',
    postingFrequency: { min: 3, max: 7, unit: 'week' },
    notes: 'Lunchtime (11AM-2PM) and evening (7-9PM) are peak engagement windows. Stories can be posted throughout the day. Reels benefit from posting during off-peak hours when competition is lower.',
  },

  audienceProfile: {
    ageRange: { min: 18, max: 40 },
    primaryDemographic: 'Urban Bulgarians aged 18-40, more female-skewing than TikTok',
    secondaryDemographics: [
      'Young professionals aged 25-35',
      'Students and university-age users 18-24',
      'Creative professionals and small business owners',
      'Bulgarian diaspora, especially in Western Europe',
    ],
    interests: [
      'Lifestyle and aesthetics',
      'Travel and food',
      'Fashion and personal style',
      'Social causes and activism',
      'Local events and culture',
    ],
    behaviorNotes: [
      'Instagram users expect higher visual quality than TikTok',
      'Stories are used more casually; feed posts are curated',
      'Carousels are the best-performing format for educational/civic content',
      'DM engagement is critical — many conversations happen privately',
      'Hashtag discovery is less powerful than on TikTok but still relevant',
    ],
  },

  scrapingMethod: 'thirdParty',

  setupChecklist: [
    { id: 'ig-01', category: 'profile', item: 'Switch to Professional/Creator Account', howTo: 'Settings → Account → Switch to Professional Account for analytics', priority: 'critical' },
    { id: 'ig-02', category: 'profile', item: 'Optimise bio with keywords and CTA', howTo: 'Include mission statement, relevant keywords, and a clear call-to-action with link', priority: 'critical' },
    { id: 'ig-03', category: 'profile', item: 'Set up profile picture and bio link', howTo: 'Use consistent branding; add Linktree or direct link in bio', priority: 'high' },
    { id: 'ig-04', category: 'profile', item: 'Create Story Highlights for key topics', howTo: 'Organise Stories into Highlights that serve as an evergreen content library', priority: 'high' },
    { id: 'ig-05', category: 'content', item: 'Define visual identity and grid aesthetic', howTo: 'Choose a colour palette, font style, and layout pattern for a cohesive profile grid', priority: 'critical' },
    { id: 'ig-06', category: 'content', item: 'Create carousel and Reel templates', howTo: 'Design reusable Canva/Figma templates for carousels, quote cards, and data graphics', priority: 'high' },
    { id: 'ig-07', category: 'content', item: 'Prepare 2 weeks of content', howTo: 'Batch-create 10-14 posts mixing Reels, carousels, and single images', priority: 'high' },
    { id: 'ig-08', category: 'content', item: 'Research and save 30 relevant hashtags', howTo: 'Group hashtags into sets of 10-15: broad, niche, and local. Rotate per post', priority: 'medium' },
    { id: 'ig-09', category: 'engagement', item: 'Follow 50+ relevant accounts', howTo: 'Follow civic influencers, journalists, community pages, and engaged citizens', priority: 'high' },
    { id: 'ig-10', category: 'engagement', item: 'Set daily engagement routine (20 min)', howTo: 'Like and comment on target audience posts, respond to DMs, engage with Stories', priority: 'high' },
    { id: 'ig-11', category: 'engagement', item: 'Use interactive Story features daily', howTo: 'Post polls, questions, quizzes, and countdowns in Stories to boost engagement', priority: 'medium' },
    { id: 'ig-12', category: 'analytics', item: 'Enable Instagram Insights', howTo: 'Professional Account automatically enables Insights; review weekly', priority: 'critical' },
    { id: 'ig-13', category: 'analytics', item: 'Track save and share rates', howTo: 'Saves and shares are the most important metrics — track them per post type', priority: 'high' },
    { id: 'ig-14', category: 'legal', item: 'Review Instagram Community Guidelines', howTo: 'Read https://help.instagram.com/477434105621119 — understand content policies', priority: 'critical' },
    { id: 'ig-15', category: 'legal', item: 'Add disclaimers for political content', howTo: 'Meta requires "Paid for by" labels on political/issue ads; organic posts may also need disclosure', priority: 'high' },
  ],

  paidAdvertising: {
    available: true,
    restrictions: [
      'Political and issue-based ads require Meta ad authorisation (same as Facebook)',
      'Must complete identity verification process',
      'All political ads appear in Meta Ad Library',
      'Limited targeting options for political/issue ads',
    ],
    formats: ['Feed Ads', 'Reels Ads', 'Stories Ads', 'Carousel Ads', 'Explore Ads', 'Boosted Posts'],
    minBudget: 1,
    currency: 'USD',
    politicalAdRules: 'Instagram uses the same Meta political ad policies as Facebook. Authorisation is required per country. All political/issue ads are publicly visible in the Ad Library with spend transparency.',
  },
};
