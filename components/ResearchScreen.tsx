import React, { useState, useCallback, useRef } from 'react';
import { runResearch } from '../src/workflows/segments/social-media/research/research-orchestrator';
import type { ResearchOrchestrationResult, ResearchProgress } from '../src/workflows/segments/social-media/research/research-orchestrator';
import type { Project, PlatformResearchConfig, ResearchSettings, ProjectMemory } from '../src/project/types';
import type { PlatformId } from '../src/workflows/segments/social-media/_shared/platform-config.types';

// ── Default popular accounts per platform (used when competitors left blank) ──

const DEFAULT_COMPETITORS: Record<PlatformId, string[]> = {
  tiktok: ['@zara', '@hm', '@shein', '@prettylittlething', '@asos'],
  instagram: ['@zara', '@hm', '@marksandspencer', '@asos', '@nextofficial'],
  youtube: ['@ZaraOfficial', '@HM', '@ASOS', '@MarkAndSpencer', '@Primark'],
  facebook: ['@Zara', '@HM', '@marksandspencer', '@ASOS.com', '@NEXT'],
};

const DEFAULT_HASHTAGS: Record<PlatformId, string[]> = {
  tiktok: ['#fashion', '#retailtok', '#ootd', '#haul', '#newcollection'],
  instagram: ['#fashion', '#retailtherapy', '#ootd', '#instafashion', '#styleinspo'],
  youtube: ['#fashion', '#haul', '#tryonhaul', '#retailreview', '#newcollection'],
  facebook: ['#fashion', '#retail', '#shopping', '#newcollection', '#dealoftheday'],
};

interface ResearchScreenProps {
  onBack: () => void;
  activeProject?: any;
}

const PLATFORMS: { id: PlatformId; label: string; icon: string }[] = [
  { id: 'tiktok', label: 'TikTok', icon: 'fa-brands fa-tiktok' },
  { id: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram' },
  { id: 'youtube', label: 'YouTube', icon: 'fa-brands fa-youtube' },
  { id: 'facebook', label: 'Facebook', icon: 'fa-brands fa-facebook' },
];

function getApifyKey(): string {
  return localStorage.getItem('tensorax_provider_key__apify') ?? localStorage.getItem('apify_api_key') ?? '';
}

function createResearchProject(overrides: {
  platform: PlatformId;
  ownHandle: string;
  competitors: string[];
  hashtags: string[];
  direction: string;
}): Project {
  const apiKey = getApifyKey();

  const effectiveCompetitors = overrides.competitors.length > 0
    ? overrides.competitors
    : DEFAULT_COMPETITORS[overrides.platform];

  const effectiveHashtags = overrides.hashtags.length > 0
    ? overrides.hashtags
    : DEFAULT_HASHTAGS[overrides.platform];

  const platformConfig: PlatformResearchConfig = {
    platform: overrides.platform,
    enabled: true,
    ownAccountHandle: overrides.ownHandle,
    competitorHandles: effectiveCompetitors,
    targetHashtags: effectiveHashtags,
    scrapingConfig: {
      method: 'thirdParty',
      apiKey,
      maxPostsPerAccount: 30,
      includePromotedPosts: true,
    },
    platformSpecificSettings: {},
  };

  const researchSettings: ResearchSettings = {
    projectId: 'sm-research',
    platforms: [platformConfig],
    autoRefreshEnabled: false,
    refreshFrequency: 'weekly',
    lastRefreshAt: null,
    nextRefreshAt: null,
    outputLanguages: ['en'],
    defaultExportFormat: 'xlsx',
    userInstructions: overrides.direction,
    minFollowers: 0,
    maxCompetitors: 10,
    engagementRateFloor: 0,
    dateRange: 30,
  };

  const memory: ProjectMemory = {
    projectId: 'sm-research',
    learnedFacts: [],
    userContext: [],
    decisions: [],
    baselines: [],
    brandProfile: {
      voiceDescriptors: ['professional', 'approachable'],
      toneRange: { min: 'casual', max: 'formal' },
      visualStyle: '',
      tabooTopics: [],
      keyMessages: [],
      languageNotes: {},
    },
  };

  return {
    id: 'sm-research',
    name: 'Social Media Research',
    description: overrides.direction || 'Social media research workflow',
    primaryLanguage: 'en',
    outputLanguages: ['en'],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    researchSettings,
    memory,
    sourceFiles: [],
    assets: [],
    segments: [],
  };
}

// ── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: ResearchProgress | null }) {
  if (!progress) return null;

  const phaseLabels: Record<string, string> = {
    scraping: 'Scraping data',
    analyzing: 'Analysing',
    recommending: 'Generating recommendations',
    generating_assets: 'Saving assets',
    complete: 'Complete',
  };

  return (
    <div className="bg-white rounded-xl border border-[#e0d6e3] p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-[#91569c]">
          {phaseLabels[progress.phase] ?? progress.phase}
        </span>
        <span className="text-sm text-gray-500">{progress.progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-[#91569c] h-3 rounded-full transition-all duration-300"
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{progress.message}</p>
    </div>
  );
}

// ── Results Display ──────────────────────��────────────────────────────────

function ResultsPanel({ result }: { result: ResearchOrchestrationResult }) {
  const { report, errors } = result;

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-700 mb-2">Errors ({errors.length})</h3>
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-600">{err}</p>
          ))}
        </div>
      )}

      {report.overview.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e0d6e3] p-4">
          <h3 className="font-semibold text-[#91569c] mb-3">Account Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.overview.map((account, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">{account.handle} {account.verified ? '✓' : ''}</p>
                <p className="text-sm text-gray-600">{account.displayName}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{account.followers.toLocaleString()} followers</span>
                  <span>{account.totalPosts.toLocaleString()} posts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.analysis?.keyFindings?.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e0d6e3] p-4">
          <h3 className="font-semibold text-[#91569c] mb-3">Key Findings</h3>
          <ul className="space-y-2">
            {report.analysis.keyFindings.map((finding, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-[#91569c] font-bold">·</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.analysis?.viralVideoAnalysis && (
        <div className="bg-white rounded-xl border border-[#e0d6e3] p-4">
          <h3 className="font-semibold text-[#91569c] mb-3">Viral Video Analysis</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Common Themes</p>
              {report.analysis.viralVideoAnalysis.commonThemes.map((t, i) => (
                <span key={i} className="inline-block bg-purple-50 text-[#91569c] rounded-full px-2 py-0.5 text-xs mr-1 mb-1">{t}</span>
              ))}
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Best Formats</p>
              {report.analysis.viralVideoAnalysis.bestFormats.map((f, i) => (
                <span key={i} className="inline-block bg-purple-50 text-[#91569c] rounded-full px-2 py-0.5 text-xs mr-1 mb-1">{f}</span>
              ))}
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Optimal Duration</p>
              <p>{report.analysis.viralVideoAnalysis.optimalDuration.min}–{report.analysis.viralVideoAnalysis.optimalDuration.max}s</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Peak Posting Times</p>
              {report.analysis.viralVideoAnalysis.peakPostingTimes.map((t, i) => (
                <span key={i} className="block text-xs">{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {report.hashtags?.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e0d6e3] p-4">
          <h3 className="font-semibold text-[#91569c] mb-3">Hashtag Analysis ({report.hashtags.length})</h3>
          <div className="flex flex-wrap gap-2">
            {report.hashtags.slice(0, 30).map((h, i) => (
              <span key={i} className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                h.trend === 'rising' ? 'bg-green-100 text-green-700' :
                h.trend === 'declining' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                #{h.hashtag} ({h.usageCount})
              </span>
            ))}
          </div>
        </div>
      )}

      {report.recommendations && (
        <div className="bg-white rounded-xl border border-[#e0d6e3] p-4">
          <h3 className="font-semibold text-[#91569c] mb-3">Recommendations</h3>

          {report.recommendations.actionPlan?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Action Plan</h4>
              <div className="space-y-1">
                {report.recommendations.actionPlan.map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm py-1 border-b border-gray-100 last:border-0">
                    <span className="font-medium text-[#91569c] min-w-[60px]">{item.day}</span>
                    <span className="font-medium">{item.action}</span>
                    <span className="text-gray-500">{item.details}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.recommendations.growthTargets?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Growth Targets</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {report.recommendations.growthTargets.map((target, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2 text-sm">
                    <p className="font-medium">{target.metric}</p>
                    <p className="text-xs text-gray-500">
                      {target.current} → {target.target} ({target.timeframe})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.recommendations.contentCalendar?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Content Calendar</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="py-1">Day</th>
                    <th className="py-1">Time</th>
                    <th className="py-1">Format</th>
                    <th className="py-1">Topic</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recommendations.contentCalendar.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1 font-medium">{item.dayOfWeek}</td>
                      <td className="py-1">{item.time}</td>
                      <td className="py-1">{item.format}</td>
                      <td className="py-1 text-gray-600">{item.topic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {report.topViral?.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e0d6e3] p-4">
          <h3 className="font-semibold text-[#91569c] mb-3">Top Viral Posts ({report.topViral.length})</h3>
          <div className="space-y-2">
            {report.topViral.slice(0, 10).map((post, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-medium">@{post.accountHandle}</span>
                  <span className="text-xs text-gray-400">{post.postType}</span>
                </div>
                <p className="text-gray-600 mt-1 line-clamp-2">{post.caption}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{post.metrics.views.toLocaleString()} views</span>
                  <span>{post.metrics.likes.toLocaleString()} likes</span>
                  <span>{(post.metrics.engagementRate * 100).toFixed(1)}% engagement</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="bg-white rounded-xl border border-[#e0d6e3] p-4">
        <summary className="font-semibold text-gray-600 cursor-pointer">Raw Report JSON</summary>
        <pre className="mt-3 text-xs overflow-auto max-h-96 bg-gray-50 p-3 rounded-lg">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ── Main Screen ─────────────────────────────────────────��─────────────────

export default function ResearchScreen({ onBack, activeProject }: ResearchScreenProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('tiktok');
  const [ownHandle, setOwnHandle] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [direction, setDirection] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [result, setResult] = useState<ResearchOrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const hasApifyKey = !!getApifyKey();

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    abortRef.current = false;

    const project = createResearchProject({
      platform: selectedPlatform,
      ownHandle: ownHandle.trim(),
      competitors: competitors.split(',').map(s => s.trim()).filter(Boolean),
      hashtags: hashtags.split(',').map(s => s.trim()).filter(Boolean),
      direction: direction.trim(),
    });

    try {
      const res = await runResearch(
        project,
        selectedPlatform,
        (p) => {
          if (!abortRef.current) setProgress(p);
        }
      );
      setResult(res);
      setProgress({ phase: 'complete', platform: selectedPlatform, progress: 100, message: 'Done!' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [selectedPlatform, ownHandle, competitors, hashtags, direction]);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-[#91569c] transition-colors"
          >
            <i className="fa-solid fa-arrow-left mr-1" /> Workflows
          </button>
          <h1 className="text-2xl font-bold text-[#91569c]">Research Social Media</h1>
        </div>

        {/* API Key Warning */}
        {!hasApifyKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-amber-700">
              <i className="fa-solid fa-triangle-exclamation mr-1" />
              No Apify API key found. Add one in <strong>Settings → API Keys → Apify</strong> to enable scraping.
            </p>
          </div>
        )}

        {/* Config Form */}
        <div className="bg-white rounded-xl border border-[#e0d6e3] p-5 mb-6">

          {/* Platform Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
            <div className="flex gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedPlatform === p.id
                      ? 'bg-[#91569c] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <i className={p.icon} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
            <p className="text-xs text-gray-400 mb-1">Industry, niche, target audience, or specific research focus. This shapes the analysis and recommendations.</p>
            <textarea
              value={direction}
              onChange={e => setDirection(e.target.value)}
              placeholder="e.g. Fast fashion for 18-30 women in the UK, focused on TikTok viral trends and sustainable messaging"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#91569c] resize-none"
            />
          </div>

          {/* Handles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Account Handle</label>
              <input
                type="text"
                value={ownHandle}
                onChange={e => setOwnHandle(e.target.value)}
                placeholder="@yourhandle"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#91569c]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitor Handles</label>
              <input
                type="text"
                value={competitors}
                onChange={e => setCompetitors(e.target.value)}
                placeholder={DEFAULT_COMPETITORS[selectedPlatform].join(', ') + '  (defaults if blank)'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#91569c]"
              />
              {!competitors.trim() && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Using defaults: {DEFAULT_COMPETITORS[selectedPlatform].join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Hashtags</label>
            <input
              type="text"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder={DEFAULT_HASHTAGS[selectedPlatform].join(', ') + '  (defaults if blank)'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#91569c]"
            />
            {!hashtags.trim() && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                Using defaults: {DEFAULT_HASHTAGS[selectedPlatform].join(', ')}
              </p>
            )}
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={running || !ownHandle.trim()}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              running || !ownHandle.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#91569c] text-white hover:bg-[#7a4885]'
            }`}
          >
            {running ? 'Running...' : 'Run Research'}
          </button>
          {!ownHandle.trim() && !running && (
            <span className="text-xs text-gray-400 ml-3">Enter your account handle to start</span>
          )}
        </div>

        {/* Progress */}
        <ProgressBar progress={progress} />

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-red-700 mb-1">Error</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && <ResultsPanel result={result} />}
      </div>
    </div>
  );
}
