import type { PlatformConfig } from '../../_shared/platform-config.types';

export const PLATFORM_CONFIG: PlatformConfig = {
  platform: 'facebook',
  displayName: 'Facebook',

  metrics: [
    { id: 'views', name: 'Views', description: 'Total video or post views', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'reactions', name: 'Reactions', description: 'Total reactions (like, love, haha, wow, sad, angry)', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'shares', name: 'Shares', description: 'Total shares of post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'comments', name: 'Comments', description: 'Total comments on post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'reach', name: 'Reach', description: 'Unique accounts who saw the post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: true, available: true },
    { id: 'impressions', name: 'Impressions', description: 'Total times post was displayed', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'total_watch_time', name: 'Total Watch Time', description: 'Cumulative watch time for video content', dataType: 'duration', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'link_clicks', name: 'Link Clicks', description: 'Clicks on links in post', dataType: 'number', aggregation: 'sum', higherIsBetter: true, platformSpecific: false, available: true },
    { id: 'engagement_rate', name: 'Engagement Rate', description: 'Engagement as percentage of reach', dataType: 'percentage', aggregation: 'average', higherIsBetter: true, platformSpecific: false, available: true },
  ],

  algorithmSignals: [
    {
      signal: 'Saves',
      weight: 'highest',
      description: 'Saving a post is the strongest signal of value; Facebook treats saves as high-intent engagement',
      actionable: true,
      tips: [
        'Create reference content people want to come back to (checklists, guides, data)',
        'Use "save this for later" CTAs in captions',
        'Infographics and explainers drive saves in civic content',
        'Post statistics and facts that people bookmark for sharing in conversations',
      ],
    },
    {
      signal: 'Shares via Messenger',
      weight: 'very_high',
      description: 'Private shares through Messenger indicate content people trust enough to send personally',
      actionable: true,
      tips: [
        'Create content that sparks private conversation ("send this to someone who...")',
        'Emotional or locally relevant stories drive DM sharing',
        'Memes and short-form video are the most shared formats via Messenger',
        'News-breaking or exclusive information triggers private sharing',
      ],
    },
    {
      signal: 'Comments',
      weight: 'high',
      description: 'Meaningful comments (not just emoji) signal engaged discussion; longer threads weigh more',
      actionable: true,
      tips: [
        'End posts with a clear question to invite discussion',
        'Respond to every comment in the first hour to build threads',
        'Controversial-but-respectful takes generate comment threads',
        'Tag relevant people or pages to pull them into the conversation',
      ],
    },
    {
      signal: 'Watch Time',
      weight: 'high',
      description: 'For video content (especially Reels), total watch time and retention drive distribution',
      actionable: true,
      tips: [
        'Front-load the hook — Facebook auto-plays so the first 3 seconds are critical',
        'Add captions/subtitles since most Facebook video is watched muted',
        'Keep Reels under 90 seconds for optimal completion',
        'Use native upload — linked YouTube videos get suppressed',
      ],
    },
    {
      signal: 'First-Hour Engagement Density',
      weight: 'high',
      description: 'The ratio of engagement in the first 60 minutes determines how widely the post is distributed',
      actionable: true,
      tips: [
        'Post when your audience is most active (check Page Insights)',
        'Share to relevant Groups immediately after posting',
        'Ask team/supporters to engage in the first 30 minutes',
        'Use Stories to drive traffic to new feed posts',
      ],
    },
    {
      signal: 'Originality',
      weight: 'medium',
      description: 'Facebook penalises reshared/recycled content and rewards original posts, especially original video',
      actionable: true,
      tips: [
        'Always create original content rather than sharing links or re-posting',
        'Native video outperforms YouTube links by 5-10x in reach',
        'Original photos outperform stock images',
        'Write unique captions — don\'t copy-paste across platforms',
      ],
    },
  ],

  contentFormats: [
    { id: 'reels', name: 'Reels', description: 'Short vertical video, Facebook\'s highest-reach format', maxDuration: 90, aspectRatios: ['9:16'], recommended: true, engagementMultiplier: 1.5 },
    { id: 'photo', name: 'Photo Post', description: 'Single or multiple images with caption', aspectRatios: ['1:1', '4:5', '16:9'], recommended: true, engagementMultiplier: 1.0 },
    { id: 'text', name: 'Text Post', description: 'Text-only post, works well for questions and discussions', aspectRatios: [], recommended: false, engagementMultiplier: 0.8 },
    { id: 'carousel', name: 'Carousel', description: 'Multiple swipeable images or cards', aspectRatios: ['1:1'], recommended: true, engagementMultiplier: 1.2 },
    { id: 'stories', name: 'Stories', description: '24-hour ephemeral content, good for behind-the-scenes', maxDuration: 60, aspectRatios: ['9:16'], recommended: false, engagementMultiplier: 0.6 },
    { id: 'live', name: 'Facebook Live', description: 'Live streaming for events, Q&A, breaking news', aspectRatios: ['16:9', '9:16'], recommended: false, engagementMultiplier: 1.3 },
  ],

  optimalTiming: {
    bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
    bestHoursStart: 8,
    bestHoursEnd: 15,
    timezone: 'Europe/Sofia',
    postingFrequency: { min: 3, max: 7, unit: 'week' },
    notes: 'Bulgarian Facebook users are active during work hours and lunch. Posting before 9AM catches the morning commute scroll. Avoid weekends unless covering events.',
  },

  audienceProfile: {
    ageRange: { min: 30, max: 55 },
    primaryDemographic: 'Bulgarians aged 30-55 who use Facebook as their primary social platform',
    secondaryDemographics: [
      'Bulgarian diaspora communities (UK, Germany, Spain, Greece)',
      'Parents and family-oriented users aged 35-50',
      'Local business owners and professionals',
      'Older adults 55+ (Facebook is their main digital social space)',
    ],
    interests: [
      'Local and national news',
      'Bulgarian politics and governance',
      'Community and neighbourhood issues',
      'Family and education',
      'EU affairs and Bulgaria\'s role in Europe',
    ],
    behaviorNotes: [
      'Facebook remains the dominant social platform in Bulgaria for 30+',
      'Groups are extremely important — many Bulgarians get news from Facebook Groups',
      'Sharing to personal timeline and Groups is the primary distribution mechanism',
      'Video content consumption is growing but photo/text posts still perform well',
      'Diaspora communities are highly active and engaged on civic topics',
    ],
  },

  scrapingMethod: 'thirdParty',

  setupChecklist: [
    { id: 'fb-01', category: 'profile', item: 'Create Facebook Page (not personal profile)', howTo: 'Go to facebook.com/pages/create → choose Category → fill in details', priority: 'critical' },
    { id: 'fb-02', category: 'profile', item: 'Complete Page info with keywords', howTo: 'Settings → Page Info → fill About, Description, Contact with relevant keywords', priority: 'critical' },
    { id: 'fb-03', category: 'profile', item: 'Add profile picture and cover photo', howTo: 'Use consistent branding; profile 170x170px, cover 820x312px', priority: 'high' },
    { id: 'fb-04', category: 'profile', item: 'Set up CTA button', howTo: 'Add a call-to-action button on your page (Learn More, Sign Up, Contact Us)', priority: 'high' },
    { id: 'fb-05', category: 'content', item: 'Define content pillars and posting schedule', howTo: 'Plan 3-5 recurring content themes and assign days of the week', priority: 'critical' },
    { id: 'fb-06', category: 'content', item: 'Create branded templates', howTo: 'Design Canva/Figma templates for quotes, data cards, announcements', priority: 'high' },
    { id: 'fb-07', category: 'content', item: 'Prepare 2 weeks of content before launch', howTo: 'Batch-create 10-14 posts to maintain consistency from day one', priority: 'high' },
    { id: 'fb-08', category: 'content', item: 'Set up Meta Business Suite for scheduling', howTo: 'Use business.facebook.com → Planner to schedule posts in advance', priority: 'medium' },
    { id: 'fb-09', category: 'engagement', item: 'Join 10+ relevant Facebook Groups', howTo: 'Search for civic, local community, and diaspora groups; join as Page or personal account', priority: 'high' },
    { id: 'fb-10', category: 'engagement', item: 'Set daily engagement routine (20 min)', howTo: 'Comment in Groups, reply to Page comments, share relevant content', priority: 'high' },
    { id: 'fb-11', category: 'engagement', item: 'Invite existing contacts to like the Page', howTo: 'Use the Invite Friends feature; share Page link in personal networks', priority: 'medium' },
    { id: 'fb-12', category: 'analytics', item: 'Enable Meta Insights', howTo: 'Page Insights is automatic for Pages; review weekly for reach, engagement, demographics', priority: 'critical' },
    { id: 'fb-13', category: 'analytics', item: 'Set up Meta Pixel on website', howTo: 'Install Meta Pixel code on your website for conversion tracking and retargeting', priority: 'medium' },
    { id: 'fb-14', category: 'legal', item: 'Review Facebook Community Standards', howTo: 'Read https://transparency.fb.com/policies/community-standards/', priority: 'critical' },
    { id: 'fb-15', category: 'legal', item: 'Apply for political ad authorisation if needed', howTo: 'Meta requires identity verification and "Paid for by" disclaimers for political ads in many countries', priority: 'high' },
  ],

  paidAdvertising: {
    available: true,
    restrictions: [
      'Political and issue-based ads require identity verification and "Paid for by" disclaimer',
      'Must apply for authorisation in each country where you want to run political ads',
      'Ad Library publicly displays all political ads and spend',
      'Some targeting options are restricted for political ads (no interest/behavior targeting)',
    ],
    formats: ['Image Ads', 'Video Ads', 'Carousel Ads', 'Boosted Posts', 'Lead Generation Ads', 'Event Ads'],
    minBudget: 1,
    currency: 'USD',
    politicalAdRules: 'Meta requires political ad authorisation per country. All political ads appear in the Ad Library with spend data. Identity verification takes 1-3 weeks. Issue-based ads (civic engagement, social issues) are treated the same as political ads.',
  },
};
