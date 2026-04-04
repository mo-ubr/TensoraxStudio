import React, { useState, useCallback, useRef } from 'react';
import { runResearch } from '../src/workflows/segments/social-media/research/research-orchestrator';
import type { ResearchOrchestrationResult, ResearchProgress } from '../src/workflows/segments/social-media/research/research-orchestrator';
import type { Project, PlatformResearchConfig, ResearchSettings, ProjectMemory } from '../src/project/types';
import type { PlatformId } from '../src/workflows/segments/social-media/_shared/platform-config.types';
import {
  runPreExecutionChecks,
  runPostExecutionChecks,
  type GuardrailResult,
  type PreExecutionCheck,
} from '../src/workflows/segments/social-media/research/research-guardrails';
import { GeminiService, getApiKeyForType } from '../services/geminiService';

// ── Auto-discover competitors via Gemini ─────────────────────────────────

interface DiscoveredCompetitor {
  handle: string;
  reasoning: string;
  confidence: number;
}

async function discoverCompetitors(
  direction: string,
  platform: PlatformId,
  ownHandle: string,
  maxResults = 8,
): Promise<{ competitors: DiscoveredCompetitor[]; error?: string }> {
  const apiKey = GeminiService.getApiKey() || getApiKeyForType('analysis');
  if (!apiKey) {
    return { competitors: [], error: 'No Gemini API key set. Add one in Settings to enable auto-discovery.' };
  }

  const platformName = platform === 'tiktok' ? 'TikTok' : platform === 'instagram' ? 'Instagram' : platform === 'youtube' ? 'YouTube' : 'Facebook';

  const prompt = `You are a social media strategist and competitive intelligence expert.

Given a research direction/brief and platform, identify the top ${maxResults} ${platformName} accounts that are the most relevant competitors, benchmarks, or leading voices in this domain.

**Research Direction:** "${direction}"
**Platform:** ${platformName}
${ownHandle ? `**User's Own Account:** ${ownHandle} (exclude from results)` : ''}

Your task:
1. Identify the top-performing and most relevant ${platformName} accounts in this exact domain/niche
2. Include a mix of: direct competitors, industry leaders, and top-rated pages in this space
3. Only suggest accounts that actually exist on ${platformName}
4. Prefer accounts with high engagement and relevance to the direction

Return ONLY valid JSON, no markdown fences:
{
  "competitors": [
    {
      "handle": "username_without_at_symbol",
      "reasoning": "Brief explanation of why this account is relevant",
      "confidence": 0.85
    }
  ]
}

Rules:
- No @ prefix in handles
- ${maxResults} accounts maximum
- Must be real, public accounts on ${platformName}
- Must be directly relevant to: "${direction.slice(0, 200)}"
- Sort by relevance (most relevant first)
- If the direction is in a specific language/country, prioritise accounts from that region`;

  try {
    // Use Gemini chat for the discovery
    const { GoogleGenAI } = await import('@anthropic-ai/sdk').catch(() => ({ GoogleGenAI: null }));

    // Direct Gemini API call
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { competitors: [], error: `Gemini API error: ${(errData as any)?.error?.message || response.status}` };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (handle markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { competitors: [], error: 'Could not parse AI response. Try again.' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const discovered: DiscoveredCompetitor[] = (parsed.competitors || [])
      .filter((c: any) => c.handle && typeof c.handle === 'string')
      .map((c: any) => ({
        handle: c.handle.replace(/^@/, '').trim(),
        reasoning: c.reasoning || '',
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
      }))
      .filter((c: DiscoveredCompetitor) => c.handle.toLowerCase() !== ownHandle.replace(/^@/, '').toLowerCase());

    return { competitors: discovered };
  } catch (err: any) {
    return { competitors: [], error: `Discovery failed: ${err.message || err}` };
  }
}

// ── NO hardcoded defaults. Direction drives everything. ───────────────────

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

  const platformConfig: PlatformResearchConfig = {
    platform: overrides.platform,
    enabled: true,
    ownAccountHandle: overrides.ownHandle,
    competitorHandles: overrides.competitors,
    targetHashtags: overrides.hashtags,
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

// ── Guardrail Alert ───────────────────────────────────────────────────────

function GuardrailAlert({ results, title }: { results: GuardrailResult[]; title: string }) {
  const errors = results.filter(r => !r.passed && r.severity === 'error');
  const warnings = results.filter(r => !r.passed && r.severity === 'warning');

  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {errors.map((r, i) => (
        <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-shield-halved text-red-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-700 text-sm">{r.code}: {r.message}</h3>
              {r.details && <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap font-sans">{r.details}</pre>}
            </div>
          </div>
        </div>
      ))}
      {warnings.map((r, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm text-amber-700">{r.message}</p>
              {r.details && <p className="text-xs text-amber-600 mt-1">{r.details}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
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

// ── Results Display ───────────────────────────────────────────────────────

function ResultsPanel({ result, direction }: { result: ResearchOrchestrationResult; direction: string }) {
  const { report, errors } = result;

  // Run post-execution guardrails
  const postChecks = runPostExecutionChecks(report, direction);

  return (
    <div className="space-y-4">
      {/* Post-execution guardrail alerts */}
      <GuardrailAlert results={postChecks} title="Post-Execution Checks" />

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

// ── Main Screen ───────────────────────────────────────────────────────────

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
  const [preCheckResults, setPreCheckResults] = useState<GuardrailResult[]>([]);
  const abortRef = useRef(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredCompetitors, setDiscoveredCompetitors] = useState<DiscoveredCompetitor[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const hasApifyKey = !!getApifyKey();

  const handleDiscover = useCallback(async () => {
    if (!direction.trim() && !ownHandle.trim()) return;
    setDiscovering(true);
    setDiscoveryError(null);
    setDiscoveredCompetitors([]);
    try {
      const result = await discoverCompetitors(
        direction.trim() || `Research about ${ownHandle.trim()} and similar accounts`,
        selectedPlatform,
        ownHandle.trim(),
      );
      if (result.error) {
        setDiscoveryError(result.error);
      } else if (result.competitors.length > 0) {
        setDiscoveredCompetitors(result.competitors);
        // Auto-populate the competitors field
        const handles = result.competitors.map(c => `@${c.handle}`).join(', ');
        setCompetitors(prev => {
          const existing = prev.split(',').map(s => s.trim()).filter(Boolean);
          if (existing.length === 0) return handles;
          // Merge — add new ones that aren't already there
          const existingLower = new Set(existing.map(h => h.replace(/^@/, '').toLowerCase()));
          const newHandles = result.competitors
            .filter(c => !existingLower.has(c.handle.toLowerCase()))
            .map(c => `@${c.handle}`);
          return [...existing, ...newHandles].join(', ');
        });
      } else {
        setDiscoveryError('No competitors found for this direction. Try a more specific brief.');
      }
    } catch (err: any) {
      setDiscoveryError(err.message || 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }, [direction, selectedPlatform, ownHandle]);

  const handleRun = useCallback(async () => {
    // Parse inputs
    const parsedCompetitors = competitors.split(',').map(s => s.trim()).filter(Boolean);
    const parsedHashtags = hashtags.split(',').map(s => s.trim()).filter(Boolean);

    // ── PRE-EXECUTION GUARDRAILS ──────────────────────────────────────────
    const preCheck = runPreExecutionChecks(
      parsedCompetitors,
      parsedHashtags,
      direction.trim(),
      selectedPlatform
    );

    const allPreResults = [...preCheck.competitors, ...preCheck.hashtags, ...preCheck.config];
    setPreCheckResults(allPreResults);

    if (!preCheck.canProceed) {
      // Guardrails blocked execution — show errors, don't run
      return;
    }

    // Guardrails passed — check we actually have competitors
    if (preCheck.effectiveCompetitors.length === 0 && !direction.trim()) {
      setError('Please enter competitor handles or a research direction.');
      return;
    }

    // Auto-discover competitors if none provided but direction exists
    if (preCheck.effectiveCompetitors.length === 0 && direction.trim()) {
      setError(null);
      setProgress({ phase: 'scraping', platform: selectedPlatform, progress: 5, message: 'Discovering top competitors via AI...' });
      const discovery = await discoverCompetitors(direction.trim(), selectedPlatform, ownHandle.trim());
      if (discovery.error || discovery.competitors.length === 0) {
        setError(discovery.error || 'Could not auto-discover competitors. Please enter them manually.');
        setProgress(null);
        return;
      }
      // Populate the field and use discovered competitors
      const handles = discovery.competitors.map(c => `@${c.handle}`);
      setCompetitors(handles.join(', '));
      setDiscoveredCompetitors(discovery.competitors);
      preCheck.effectiveCompetitors = discovery.competitors.map(c => c.handle);
    }

    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    abortRef.current = false;

    const project = createResearchProject({
      platform: selectedPlatform,
      ownHandle: ownHandle.trim(),
      competitors: preCheck.effectiveCompetitors,
      hashtags: preCheck.effectiveHashtags,
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

  // Live validation hint: show warning if direction is set but competitors look like defaults
  const parsedCompetitors = competitors.split(',').map(s => s.trim()).filter(Boolean);
  const directionSet = !!direction.trim();
  const competitorsEmpty = parsedCompetitors.length === 0;

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
              No Apify API key found. Add one in <strong>Settings &rarr; API Keys &rarr; Apify</strong> to enable scraping.
            </p>
          </div>
        )}

        {/* Pre-execution guardrail alerts */}
        <GuardrailAlert results={preCheckResults} title="Pre-Execution Checks" />

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

          {/* Direction — THE BINDING CONSTRAINT */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direction <span className="text-xs text-gray-400 font-normal">(binds all research decisions)</span>
            </label>
            <p className="text-xs text-gray-400 mb-1">
              Industry, niche, target audience, or topic. Competitors and hashtags must align with this.
            </p>
            <textarea
              value={direction}
              onChange={e => setDirection(e.target.value)}
              placeholder="e.g. Bulgarian political parties and politicians, civic engagement campaigns, voter awareness"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Competitor Handles
                {directionSet && competitorsEmpty && (
                  <span className="text-[#91569c] font-normal text-xs ml-1">— will auto-discover if left empty</span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={competitors}
                  onChange={e => setCompetitors(e.target.value)}
                  placeholder={directionSet ? 'Leave empty to auto-discover, or enter manually' : '@competitor1, @competitor2, @competitor3'}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#91569c]"
                />
                <button
                  onClick={handleDiscover}
                  disabled={discovering || (!direction.trim() && !ownHandle.trim())}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#f6f0f8] border border-[#ceadd4] text-[#91569c] hover:bg-[#91569c] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                  title="Use AI to find top competitors in your niche"
                >
                  <i className={`fa-solid ${discovering ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-xs`} />
                  {discovering ? 'Finding...' : 'Discover'}
                </button>
              </div>
              {discoveryError && (
                <p className="text-[11px] text-red-500 mt-0.5">
                  <i className="fa-solid fa-triangle-exclamation mr-0.5" />{discoveryError}
                </p>
              )}
              {discoveredCompetitors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#91569c]">
                    <i className="fa-solid fa-wand-magic-sparkles mr-1" />AI-discovered competitors
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {discoveredCompetitors.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#f6f0f8] border border-[#ceadd4] text-[10px] text-[#5c3a62]"
                        title={c.reasoning}
                      >
                        @{c.handle}
                        <span className="text-[8px] text-[#91569c] font-bold">{Math.round(c.confidence * 100)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {directionSet && competitorsEmpty && discoveredCompetitors.length === 0 && !discovering && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Click "Discover" or leave empty — competitors will be auto-discovered when you run research.
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
              placeholder={directionSet ? 'Enter hashtags relevant to your direction' : '#hashtag1, #hashtag2'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#91569c]"
            />
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
            <pre className="text-sm text-red-600 whitespace-pre-wrap font-sans">{error}</pre>
          </div>
        )}

        {/* Results */}
        {result && <ResultsPanel result={result} direction={direction} />}
      </div>
    </div>
  );
}
