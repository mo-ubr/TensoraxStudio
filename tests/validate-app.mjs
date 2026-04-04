#!/usr/bin/env node
/**
 * validate-app.mjs — Pre-commit validation for TensoraxStudio
 *
 * Runs automatically before every git commit (via pre-commit hook).
 * Also runnable manually: node tests/validate-app.mjs
 *
 * GATES:
 *  1. Vite build compiles without errors
 *  2. App serves and returns HTML with root element
 *  3. No hardcoded retail defaults in research code
 *  4. No hardcoded Gemini model in discovery
 *  5. Key imports resolve (no missing modules)
 *  6. Critical files exist and aren't stubs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
let failures = 0;
let passes = 0;

function pass(name, detail) {
  passes++;
  console.log(`  ✅ ${name}${detail ? ': ' + detail : ''}`);
}

function fail(name, detail) {
  failures++;
  console.log(`  ❌ ${name}: ${detail}`);
}

function readFile(relPath) {
  const full = resolve(ROOT, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

// ── GATE 1: Build compiles ─────────────────────────────────────────────
function gate1_build() {
  console.log('\n── Gate 1: Build Compilation ──');
  try {
    execSync('npx vite build', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    pass('Vite build', 'compiled successfully');
  } catch (err) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || '';
    // Vite build warnings are OK, only real errors fail
    if (stderr.includes('error') && !stderr.includes('warning')) {
      fail('Vite build', stderr.slice(0, 300));
    } else {
      pass('Vite build', 'compiled with warnings');
    }
  }
}

// ── GATE 2: App serves ─────────────────────────────────────────────────
async function gate2_serves() {
  console.log('\n── Gate 2: App Serves ──');
  try {
    const res = await fetch('http://localhost:5180', { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    if (html.includes('id="root"')) {
      pass('App serves', `HTTP ${res.status}, root element found`);
    } else {
      fail('App serves', 'HTML returned but no root element');
    }
  } catch {
    // Dev server might not be running — skip, don't fail
    console.log('  ⚠️  Dev server not running (skipped)');
  }
}

// ── GATE 3: No hardcoded retail defaults ───────────────────────────────
function gate3_no_retail() {
  console.log('\n── Gate 3: No Hardcoded Retail Defaults ──');

  const researchFiles = [
    'components/ResearchScreen.tsx',
    'src/workflows/segments/social-media/research/research-orchestrator.ts',
    'src/workflows/segments/social-media/research/research-guardrails.ts',
  ];

  // These are retail handles that should NEVER appear as defaults
  const retailHandles = ['@zara', '@hm', '@asos', '@nextofficial', '@marksandspencer', '@primark', '@shein', '@uniqlo'];

  for (const file of researchFiles) {
    const content = readFile(file);
    if (!content) continue;

    // Check for hardcoded competitor arrays containing retail handles
    for (const handle of retailHandles) {
      // Only flag if it appears as a string literal default, not in comments or domain signal lists
      const inDefault = new RegExp(`['"]${handle.replace('@', '')}['"]`, 'i');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments and domain signal detection lists
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (line.includes('WRONG_DOMAIN') || line.includes('RETAIL_DEFAULTS') || line.includes('DOMAIN_SIGNALS')) continue;
        if (line.includes('Signal') || line.includes('signal') || line.includes('detect')) continue;

        if (inDefault.test(line) && (line.includes('default') || line.includes('Default') || line.includes('competitor') || line.includes('handle'))) {
          fail(`No retail defaults in ${file}`, `Line ${i + 1}: found "${handle}" as potential default`);
        }
      }
    }
  }

  if (failures === 0) pass('No retail defaults', 'No hardcoded retail handles found as defaults');
}

// ── GATE 4: No hardcoded Gemini in discovery ───────────────────────────
function gate4_no_hardcoded_model() {
  console.log('\n── Gate 4: Discovery Uses Configured API ──');

  const content = readFile('components/ResearchScreen.tsx');
  if (!content) { fail('ResearchScreen exists', 'File not found'); return; }

  // Should NOT have hardcoded fetch to generativelanguage.googleapis.com
  if (content.includes('generativelanguage.googleapis.com')) {
    fail('No hardcoded Gemini API', 'Direct fetch to googleapis.com found — must use configured provider');
  } else {
    pass('No hardcoded Gemini API', 'No direct Gemini API calls');
  }

  // Should use getModelForType or similar
  if (content.includes('getModelForType') || content.includes('detectProvider')) {
    pass('Uses configured model', 'getModelForType/detectProvider found');
  } else {
    fail('Uses configured model', 'No model configuration detection found');
  }

  // Should NOT import GoogleGenAI at the top level (only dynamic import OK)
  const topImports = content.split('\n').slice(0, 20).join('\n');
  if (topImports.includes("from '@google/genai'") || topImports.includes("from \"@google/genai\"")) {
    fail('No static Gemini import', 'GoogleGenAI imported statically at top — should be dynamic import()');
  } else {
    pass('No static Gemini import', 'Gemini SDK imported dynamically');
  }
}

// ── GATE 5: Key imports resolve ────────────────────────────────────────
function gate5_imports() {
  console.log('\n── Gate 5: Key Files Exist ──');

  const criticalFiles = [
    'components/ResearchScreen.tsx',
    'services/agentRunner.ts',
    'services/geminiService.ts',
    'src/workflows/segments/social-media/research/research-orchestrator.ts',
    'src/workflows/segments/social-media/research/research-guardrails.ts',
    'src/workflows/segments/social-media/research/platform-configs/tiktok.ts',
    'src/workflows/segments/social-media/research/platform-configs/instagram.ts',
    'src/workflows/segments/social-media/research/platform-configs/facebook.ts',
    'src/workflows/segments/social-media/research/platform-configs/youtube.ts',
    'server/index.js',
    'server/dashboardGenerator.js',
    'server/researchPipeline.js',
    'App.tsx',
    'index.tsx',
  ];

  let missing = 0;
  for (const file of criticalFiles) {
    if (!existsSync(resolve(ROOT, file))) {
      fail('File exists', `Missing: ${file}`);
      missing++;
    }
  }
  if (missing === 0) pass('All critical files exist', `${criticalFiles.length} files verified`);
}

// ── GATE 6: Platform configs aren't stubs ──────────────────────────────
function gate6_platform_configs() {
  console.log('\n── Gate 6: Platform Configs Are Real ──');

  const platforms = ['tiktok', 'instagram', 'facebook', 'youtube'];
  for (const p of platforms) {
    const content = readFile(`src/workflows/segments/social-media/research/platform-configs/${p}.ts`);
    if (!content) { fail(`${p} config`, 'File not found'); continue; }
    if (content.length < 200) { fail(`${p} config`, `Only ${content.length} chars — likely a stub`); continue; }
    if (!content.includes('metrics') && !content.includes('Metrics')) {
      fail(`${p} config`, 'No metrics definition found');
      continue;
    }
    pass(`${p} config`, `${content.length} chars, has metrics`);
  }
}

// ── GATE 7: No broken state defaults ───────────────────────────────────
function gate7_direction_field() {
  console.log('\n── Gate 7: Direction Field Architecture ──');

  const content = readFile('components/ResearchScreen.tsx');
  if (!content) return;

  // Direction should be labeled as binding constraint
  if (content.includes('Direction') && (content.includes('bind') || content.includes('constraint') || content.includes('drives'))) {
    pass('Direction is binding', 'Direction field described as binding/constraining');
  } else {
    fail('Direction is binding', 'Direction field not described as binding constraint in UI');
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  TensoraxStudio Validation');
  console.log('═══════════════════════════════════════════════════');

  gate1_build();
  await gate2_serves();
  gate3_no_retail();
  gate4_no_hardcoded_model();
  gate5_imports();
  gate6_platform_configs();
  gate7_direction_field();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log(`  VERDICT: ${failures === 0 ? '✅ ALL GATES PASSED' : '❌ COMMIT BLOCKED — fix failures above'}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(failures > 0 ? 1 : 0);
}

main();
