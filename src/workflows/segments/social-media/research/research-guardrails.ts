// Research Guardrails — pre-execution validators and post-execution gates
// These prevent domain mismatch, data quality failures, and incomplete outputs.

import type { PlatformId } from '../_shared/platform-config.types';
import type { ResearchReport } from '../_shared/content-schema';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GuardrailResult {
  passed: boolean;
  code: string;
  severity: 'error' | 'warning';
  message: string;
  details?: string;
  autoAction?: string; // what the system did to fix it
}

export interface PreExecutionCheck {
  competitors: GuardrailResult[];
  hashtags: GuardrailResult[];
  config: GuardrailResult[];
  canProceed: boolean;
  effectiveCompetitors: string[];
  effectiveHashtags: string[];
}

// ── Known domain defaults (for cross-contamination detection) ──────────────

const RETAIL_DEFAULTS = [
  'zara', 'hm', 'h&m', 'shein', 'prettylittlething', 'asos',
  'marksandspencer', 'nextofficial', 'next', 'primark', 'uniqlo',
  'zaraofficial', 'markandspencer',
];

const RETAIL_HASHTAGS = [
  'fashion', 'retailtok', 'ootd', 'haul', 'newcollection',
  'retailtherapy', 'instafashion', 'styleinspo', 'tryonhaul',
  'retailreview', 'shopping', 'dealoftheday',
];

// ── V3: Default Override Protection ────────────────────────────────────────

export function checkDefaultOverride(
  competitors: string[],
  direction: string
): GuardrailResult {
  if (!direction.trim()) {
    // No direction set — defaults are acceptable (though not ideal)
    return {
      passed: true,
      code: 'V3_DEFAULT_OVERRIDE',
      severity: 'warning',
      message: 'No direction specified — using system defaults.',
    };
  }

  const normalised = competitors.map(c => c.toLowerCase().replace(/^@/, ''));
  const retailMatches = normalised.filter(c => RETAIL_DEFAULTS.includes(c));

  if (retailMatches.length === 0) return {
    passed: true,
    code: 'V3_DEFAULT_OVERRIDE',
    severity: 'warning',
    message: 'Competitors are custom — no default override detected.',
  };

  // Direction is set but competitors are retail defaults
  return {
    passed: false,
    code: 'V3_DEFAULT_OVERRIDE',
    severity: 'error',
    message: `Default retail competitors detected but a specific direction was provided.`,
    details: `Direction: "${direction.slice(0, 100)}..."\n` +
      `Retail defaults found: ${retailMatches.map(h => '@' + h).join(', ')}\n` +
      `These fashion/retail accounts do not match the stated research direction.\n` +
      `Please enter competitors relevant to your direction, or leave both competitors AND direction blank to use defaults.`,
  };
}

// ── V3b: Hashtag Override Protection ───────────────────────────────────────

export function checkHashtagOverride(
  hashtags: string[],
  direction: string
): GuardrailResult {
  if (!direction.trim() || hashtags.length === 0) {
    return { passed: true, code: 'V3B_HASHTAG_OVERRIDE', severity: 'warning', message: 'OK' };
  }

  const normalised = hashtags.map(h => h.toLowerCase().replace(/^#/, ''));
  const retailMatches = normalised.filter(h => RETAIL_HASHTAGS.includes(h));
  const ratio = retailMatches.length / normalised.length;

  if (ratio < 0.5) return {
    passed: true, code: 'V3B_HASHTAG_OVERRIDE', severity: 'warning', message: 'OK',
  };

  return {
    passed: false,
    code: 'V3B_HASHTAG_OVERRIDE',
    severity: 'error',
    message: `Default retail hashtags detected but a specific direction was provided.`,
    details: `Retail hashtags: ${retailMatches.map(h => '#' + h).join(', ')}\n` +
      `Please enter hashtags relevant to: "${direction.slice(0, 80)}"`,
  };
}

// ── G2: Data Quality Gate ──────────────────────────────────────────────────

export function checkDataQuality(report: ResearchReport): GuardrailResult {
  const accounts = report.overview;
  if (accounts.length === 0) {
    return {
      passed: false,
      code: 'G2_DATA_QUALITY',
      severity: 'error',
      message: 'No accounts in research output. Scraping may have failed entirely.',
    };
  }

  let flagged = 0;
  const issues: string[] = [];

  for (const account of accounts) {
    const problems: string[] = [];
    if (account.followers === 0) problems.push('0 followers');
    if (account.totalPosts === 0) problems.push('0 posts');
    if (account.totalViews === 0 && account.totalLikes === 0) problems.push('0 views & likes');

    if (problems.length > 0) {
      flagged++;
      issues.push(`@${account.handle}: ${problems.join(', ')}`);
    }
  }

  const flagRatio = flagged / accounts.length;

  if (flagRatio > 0.3) {
    return {
      passed: false,
      code: 'G2_DATA_QUALITY',
      severity: 'error',
      message: `Data quality check failed. ${flagged} of ${accounts.length} accounts have zero/null metrics.`,
      details: `Flagged accounts:\n${issues.join('\n')}\n\nScraping may have failed silently. Check your Apify API key and rate limits.`,
    };
  }

  if (flagged > 0) {
    return {
      passed: true,
      code: 'G2_DATA_QUALITY',
      severity: 'warning',
      message: `${flagged} account(s) have incomplete metrics: ${issues.join('; ')}`,
    };
  }

  return { passed: true, code: 'G2_DATA_QUALITY', severity: 'warning', message: 'Data quality OK.' };
}

// ── G1: Output Schema Compliance ───────────────────────────────────────────

export function checkOutputSchema(report: ResearchReport): GuardrailResult {
  const missing: string[] = [];

  if (!report.overview || report.overview.length === 0) missing.push('Overview');
  if (!report.ownChannel || report.ownChannel.length === 0) missing.push('Channel (own posts)');
  if (!report.competitors || report.competitors.length === 0) missing.push('Competitors');
  if (!report.topViral || report.topViral.length === 0) missing.push('Top Viral');
  if (!report.allPosts || report.allPosts.length === 0) missing.push('All Content');
  if (!report.hashtags || report.hashtags.length === 0) missing.push('Hashtags');

  if (!report.analysis || !report.analysis.keyFindings || report.analysis.keyFindings.length === 0) {
    missing.push('Analysis');
  }
  if (!report.recommendations || (!report.recommendations.actionPlan?.length && !report.recommendations.algorithmSignals?.length)) {
    missing.push('Recommendations');
  }

  if (missing.length > 0) {
    return {
      passed: false,
      code: 'G1_OUTPUT_SCHEMA',
      severity: 'error',
      message: `Output incomplete. Missing sections: ${missing.join(', ')}`,
      details: `The research report must include all standard sections to match TikTok/Facebook research quality.\nMissing: ${missing.join(', ')}`,
    };
  }

  return { passed: true, code: 'G1_OUTPUT_SCHEMA', severity: 'warning', message: 'Output schema complete.' };
}

// ── G4: Domain Consistency Gate ────────────────────────────────────────────

export function checkDomainConsistency(
  report: ResearchReport,
  direction: string
): GuardrailResult {
  if (!direction.trim() || !report.hashtags || report.hashtags.length === 0) {
    return { passed: true, code: 'G4_DOMAIN_CONSISTENCY', severity: 'warning', message: 'No direction to validate against.' };
  }

  // Check if retail hashtags dominate the results
  const normalised = report.hashtags.map(h => h.hashtag.toLowerCase());
  const retailCount = normalised.filter(h => RETAIL_DEFAULTS.includes(h) || RETAIL_HASHTAGS.includes(h)).length;
  const retailRatio = retailCount / normalised.length;

  if (retailRatio > 0.4) {
    return {
      passed: false,
      code: 'G4_DOMAIN_CONSISTENCY',
      severity: 'warning',
      message: `Hashtag analysis dominated by off-topic (retail) tags (${Math.round(retailRatio * 100)}%).`,
      details: `This suggests competitor selection was incorrect for the stated direction: "${direction.slice(0, 80)}"`,
    };
  }

  return { passed: true, code: 'G4_DOMAIN_CONSISTENCY', severity: 'warning', message: 'Domain consistency OK.' };
}

// ── Master pre-execution check ─────────────────────────────────────────────

export function runPreExecutionChecks(
  competitors: string[],
  hashtags: string[],
  direction: string,
  _platform: PlatformId
): PreExecutionCheck {
  const results: GuardrailResult[] = [];

  // V3: Default Override Protection
  const v3 = checkDefaultOverride(competitors, direction);
  results.push(v3);

  // V3b: Hashtag Override Protection
  const v3b = checkHashtagOverride(hashtags, direction);
  results.push(v3b);

  const errors = results.filter(r => !r.passed && r.severity === 'error');

  // If direction is set but competitors are retail defaults, clear them
  // (force user to provide relevant ones)
  let effectiveCompetitors = competitors;
  let effectiveHashtags = hashtags;

  if (!v3.passed) {
    effectiveCompetitors = []; // cleared — user must provide relevant ones
  }
  if (!v3b.passed) {
    effectiveHashtags = []; // cleared
  }

  return {
    competitors: results.filter(r => r.code.startsWith('V3_')),
    hashtags: results.filter(r => r.code.startsWith('V3B')),
    config: [],
    canProceed: errors.length === 0,
    effectiveCompetitors,
    effectiveHashtags,
  };
}

// ── Master post-execution check ────────────────────────────────────────────

export function runPostExecutionChecks(
  report: ResearchReport,
  direction: string
): GuardrailResult[] {
  return [
    checkDataQuality(report),
    checkOutputSchema(report),
    checkDomainConsistency(report, direction),
  ];
}
