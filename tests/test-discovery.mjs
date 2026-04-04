/**
 * Research Workflow Testing Script — Gate 1: Competitor Discovery
 *
 * Tests auto-discovery via the server endpoint /api/test/discover
 * The API key is passed via GEMINI_API_KEY env var or --key= argument.
 *
 * Usage:
 *   GEMINI_API_KEY=AIza... node tests/test-discovery.mjs
 *   node tests/test-discovery.mjs --key=AIza...
 *   node tests/test-discovery.mjs --platform=tiktok --key=AIza...
 */

const SERVER = 'http://localhost:5182';

// ── Test Configuration ──────────────────────────────────────────────────
const TEST_DATA = {
  direction: 'Политика, български политически партии или страници афилиирани към политически партии, български политици',
  ownHandle: 'zahorata222a',
  platforms: ['tiktok', 'instagram', 'facebook', 'youtube'],
  maxResults: 8,
};

// Domain relevance signals
const DOMAIN_SIGNALS = [
  'politi', 'партия', 'партии', 'полити', 'bulgaria', 'българ', 'депутат',
  'парламент', 'избори', 'election', 'government', 'правителств', 'civic',
  'campaign', 'кампания', 'гражданск', 'protest', 'протест', 'опозиция',
  'opposition', 'democrat', 'демократ', 'national', 'народ', 'движение',
  'movement', 'party', 'герб', 'бсп', 'дпс', 'възраждане', 'радев',
  'борисов', 'костадинов', 'петков',
];

const WRONG_DOMAIN_SIGNALS = [
  'fashion', 'retail', 'clothing', 'apparel', 'shopping', 'store', 'brand',
  'zara', 'h&m', 'asos', 'next official', 'primark', 'shein',
  'marksandspencer', 'uniqlo', 'prettylittlething', 'boohoo',
];

// ── Call server endpoint ────────────────────────────────────────────────
async function callDiscover(apiKey, model, platform) {
  const res = await fetch(`${SERVER}/api/test/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      model,
      direction: TEST_DATA.direction,
      platform,
      ownHandle: TEST_DATA.ownHandle,
      maxResults: TEST_DATA.maxResults,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }

  return res.json();
}

// ── Test Runner ─────────────────────────────────────────────────────────
function checkDomainRelevance(competitor) {
  const text = `${competitor.handle} ${competitor.reasoning}`.toLowerCase();
  const hasCorrectSignal = DOMAIN_SIGNALS.some(s => text.includes(s));
  const hasWrongSignal = WRONG_DOMAIN_SIGNALS.some(s => text.includes(s));
  return { relevant: hasCorrectSignal && !hasWrongSignal, hasWrongSignal, hasCorrectSignal };
}

async function runGate1Test(apiKey, model, platform) {
  const results = { platform, passed: true, checks: [], competitors: [], errors: [] };

  // CHECK 1: Discovery returns results
  let data;
  try {
    data = await callDiscover(apiKey, model, platform);
    results.competitors = data.competitors || [];

    if (results.competitors.length === 0) {
      results.checks.push({ name: 'discovery_returns_results', passed: false, detail: 'No competitors returned' });
      results.passed = false;
      return results;
    }
    results.checks.push({ name: 'discovery_returns_results', passed: true, detail: `${results.competitors.length} competitors found` });
  } catch (err) {
    results.checks.push({ name: 'discovery_returns_results', passed: false, detail: err.message });
    results.errors.push(err.message);
    results.passed = false;
    return results;
  }

  const competitors = results.competitors;

  // CHECK 2: No off-topic competitors
  const offTopic = competitors.filter(c => {
    const text = `${c.handle} ${c.reasoning}`.toLowerCase();
    return WRONG_DOMAIN_SIGNALS.some(s => text.includes(s));
  });
  if (offTopic.length > 0) {
    results.checks.push({ name: 'no_off_topic_competitors', passed: false, detail: `Off-topic: ${offTopic.map(c => c.handle).join(', ')}` });
    results.passed = false;
  } else {
    results.checks.push({ name: 'no_off_topic_competitors', passed: true, detail: 'All competitors are on-topic' });
  }

  // CHECK 3: Majority are domain-relevant
  const relevant = competitors.filter(c => checkDomainRelevance(c).hasCorrectSignal);
  const ratio = relevant.length / competitors.length;
  results.checks.push({
    name: 'domain_relevance',
    passed: ratio >= 0.6,
    detail: `${relevant.length}/${competitors.length} (${(ratio * 100).toFixed(0)}%) domain-relevant${ratio < 0.6 ? ' — need >60%' : ''}`,
  });
  if (ratio < 0.6) results.passed = false;

  // CHECK 4: Own handle excluded
  const selfIncluded = competitors.some(c => c.handle.toLowerCase() === TEST_DATA.ownHandle.toLowerCase());
  results.checks.push({ name: 'own_handle_excluded', passed: !selfIncluded, detail: selfIncluded ? 'Own handle NOT excluded' : 'Own handle correctly excluded' });
  if (selfIncluded) results.passed = false;

  // CHECK 5: All have reasoning
  const missingReasoning = competitors.filter(c => !c.reasoning?.trim());
  results.checks.push({ name: 'all_have_reasoning', passed: missingReasoning.length === 0, detail: missingReasoning.length > 0 ? `${missingReasoning.length} missing reasoning` : 'All have reasoning' });

  return results;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const keyArg = process.argv.find(a => a.startsWith('--key='));
  const apiKey = keyArg ? keyArg.split('=')[1] : process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!apiKey) {
    console.error('ERROR: No API key. Set GEMINI_API_KEY env var or pass --key=AIza...');
    process.exit(1);
  }

  const platformArg = process.argv.find(a => a.startsWith('--platform='));
  const platforms = platformArg ? [platformArg.split('=')[1]] : TEST_DATA.platforms;

  console.log('═══════════════════════════════════════════════════');
  console.log('  RESEARCH WORKFLOW TEST: Gate 1 — Discovery');
  console.log(`  Model: ${model}`);
  console.log(`  Direction: ${TEST_DATA.direction.slice(0, 60)}...`);
  console.log(`  Platforms: ${platforms.join(', ')}`);
  console.log('═══════════════════════════════════════════════════\n');

  const allResults = [];
  let allPassed = true;

  for (const platform of platforms) {
    console.log(`── Testing ${platform.toUpperCase()} ──`);
    try {
      const result = await runGate1Test(apiKey, model, platform);
      allResults.push(result);
      if (!result.passed) allPassed = false;

      for (const check of result.checks) {
        console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}: ${check.detail}`);
      }

      if (result.competitors.length > 0) {
        console.log(`  Discovered:`);
        for (const c of result.competitors) {
          const r = checkDomainRelevance(c);
          const tag = r.hasWrongSignal ? ' ⚠️ OFF-TOPIC' : r.hasCorrectSignal ? '' : ' ❓';
          console.log(`    @${c.handle} (${(c.confidence * 100).toFixed(0)}%)${tag} — ${c.reasoning.slice(0, 80)}`);
        }
      }
    } catch (err) {
      console.log(`  ❌ FATAL: ${err.message}`);
      allResults.push({ platform, passed: false, checks: [], errors: [err.message], competitors: [] });
      allPassed = false;
    }
    console.log('');
  }

  // Write results for Claude Code to read
  const fs = await import('fs');
  const report = { timestamp: new Date().toISOString(), model, testData: TEST_DATA, allPassed, platformResults: allResults };
  fs.writeFileSync('tests/test-results.json', JSON.stringify(report, null, 2));

  console.log('═══════════════════════════════════════════════════');
  console.log(`  VERDICT: ${allPassed ? '✅ ALL GATES PASSED' : '❌ SOME GATES FAILED'}`);
  console.log('  Results: tests/test-results.json');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(2); });
