/**
 * Creativity Control System
 *
 * Two-axis control over how much creative freedom agents have:
 *   - Text Freedom:   How much the agent can change user-provided copy
 *   - Visual Freedom: How much the agent can deviate from a reference image
 *
 * Each axis runs 0–3:
 *   0 = Zero freedom (verbatim / pixel-clone)
 *   1 = Minimal freedom (fix typos / minor variations)
 *   2 = Moderate freedom (adapt tone / inspired by reference)
 *   3 = Full freedom (rewrite / freeform creation)
 *
 * These levels are:
 *   1. Auto-detected from user's language (keywords/phrases)
 *   2. Overridable per-project via settings
 *   3. Injected into every agent prompt as a binding preamble
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type FreedomLevel = 0 | 1 | 2 | 3;

export interface CreativityLevels {
  text: FreedomLevel;
  visual: FreedomLevel;
}

export interface CreativityLabel {
  level: FreedomLevel;
  name: string;
  shortDescription: string;
  agentInstruction: string;
}

// ─── Level definitions ──────────────────────────────────────────────────────

export const TEXT_FREEDOM_LEVELS: CreativityLabel[] = [
  {
    level: 0,
    name: 'Verbatim',
    shortDescription: 'Use provided text exactly as given. Zero changes.',
    agentInstruction: `TEXT FREEDOM: 0 — VERBATIM
You MUST use the provided text EXACTLY as given — character for character, word for word, line for line.
DO NOT paraphrase, reword, shorten, expand, "improve", or reinterpret ANY part of the text.
DO NOT add your own text. DO NOT omit any part of the provided text.
If the text has typos, keep them. If the formatting seems odd, keep it. COPY IT EXACTLY.
Failure to reproduce the exact provided text is a CRITICAL FAILURE of your task.`,
  },
  {
    level: 1,
    name: 'Minor Edits',
    shortDescription: 'Fix obvious typos and formatting only. No rewording.',
    agentInstruction: `TEXT FREEDOM: 1 — MINOR EDITS ONLY
Use the provided text as-is. You may ONLY fix:
- Obvious spelling mistakes
- Broken formatting (e.g. missing line breaks)
- Punctuation errors
You MUST NOT reword, rephrase, add, remove, or restructure any sentences.
The meaning, tone, and structure must be identical to what was provided.`,
  },
  {
    level: 2,
    name: 'Adapt',
    shortDescription: 'Adjust length or tone but preserve the core message.',
    agentInstruction: `TEXT FREEDOM: 2 — ADAPT
You may adjust the provided text for length, tone, or format while preserving:
- The core message and all key information
- The overall structure and flow
- All specific names, numbers, dates, and proper nouns
You may rephrase sentences, adjust formality, and condense or expand sections.
You MUST NOT change the meaning or omit important information.`,
  },
  {
    level: 3,
    name: 'Rewrite',
    shortDescription: 'Full creative freedom. Reference text is just a brief.',
    agentInstruction: `TEXT FREEDOM: 3 — FULL CREATIVE FREEDOM
The provided text is a starting point / brief. You have full creative licence to:
- Rewrite completely in your own words
- Change structure, tone, and style
- Add new ideas and creative angles
- Adjust length freely
Preserve the core intent but express it however works best for the medium.`,
  },
];

export const VISUAL_FREEDOM_LEVELS: CreativityLabel[] = [
  {
    level: 0,
    name: 'Clone',
    shortDescription: 'Reproduce the reference image exactly. Same layout, colours, style.',
    agentInstruction: `VISUAL FREEDOM: 0 — CLONE
Reproduce the reference image as close to identically as possible.
Same composition, same layout, same colours, same lighting, same style, same mood.
DO NOT add elements, change the angle, reinterpret the scene, or apply a different style.
DO NOT create a storyboard grid, contact sheet, or multiple variants.
The output must look like the same image with only the specified changes applied.`,
  },
  {
    level: 1,
    name: 'Match',
    shortDescription: 'Same composition and style. Minor variations OK.',
    agentInstruction: `VISUAL FREEDOM: 1 — MATCH
Follow the reference image closely:
- Same general composition and layout
- Same colour palette and lighting style
- Same visual mood and tone
Minor variations in exact positioning and details are acceptable.
DO NOT change the overall style, angle, or mood. DO NOT add a storyboard grid.`,
  },
  {
    level: 2,
    name: 'Inspired',
    shortDescription: 'Same general feel. Creative choices allowed.',
    agentInstruction: `VISUAL FREEDOM: 2 — INSPIRED BY REFERENCE
Use the reference image as inspiration:
- Maintain the general mood, colour family, and visual tone
- You may change composition, angle, and specific elements
- Creative interpretation is welcomed
- Keep the same quality level and professional feel
The output should feel like it belongs in the same campaign as the reference.`,
  },
  {
    level: 3,
    name: 'Freeform',
    shortDescription: 'Reference is just a mood board. Full creative freedom.',
    agentInstruction: `VISUAL FREEDOM: 3 — FULL CREATIVE FREEDOM
The reference (if any) is loose inspiration only. You have full creative licence:
- Choose any composition, angle, style, and mood
- Create storyboard grids or contact sheets if appropriate
- Apply cinematic shot theory (ELS, CU, MCU, etc.) if the task calls for it
- Experiment with visual approaches
Only the brief/prompt constrains you, not any reference image.`,
  },
];

// ─── Auto-detection from user language ──────────────────────────────────────

/** Phrases that signal the user wants their text used exactly */
const VERBATIM_TEXT_SIGNALS = [
  'use this text', 'use the text', 'use the provided text',
  'use the attached text', 'use the following text',
  'here is the text', 'here\'s the text',
  'the text is', 'text should be', 'text should read',
  'replace with this', 'replace the text with',
  'change the text to', 'swap the text to',
  'put this text', 'place this text',
  'exact text', 'exactly this text', 'this exact text',
  'word for word', 'as is', 'as-is', 'as given',
  'don\'t change the text', 'do not change the text',
  'don\'t rewrite', 'do not rewrite',
  'verbatim', 'literally', 'character for character',
];

/** Phrases that signal the user wants moderate text adaptation */
const ADAPT_TEXT_SIGNALS = [
  'something like', 'along the lines of', 'similar to',
  'in the style of', 'inspired by', 'based on',
  'adjust the tone', 'make it more', 'make it less',
  'shorten', 'expand', 'condense',
];

/** Phrases that signal exact visual reproduction */
const CLONE_VISUAL_SIGNALS = [
  'identical', 'same image', 'same design', 'same layout',
  'exact copy', 'exact reproduction', 'clone',
  'replicate', 'duplicate', 'reproduce exactly',
  'pixel perfect', 'pixel-perfect',
  'keep everything the same', 'don\'t change the look',
  'same but with', 'same except', 'practically identical',
  'in the exact format', 'exact format',
];

/** Phrases that signal the user wants visual similarity but allows variation */
const MATCH_VISUAL_SIGNALS = [
  'similar look', 'similar style', 'match the style',
  'like this but', 'keep the style', 'same vibe',
  'same feel', 'in this style',
];

/** Phrases that signal full creative freedom */
const FREEFORM_SIGNALS = [
  'be creative', 'surprise me', 'your choice',
  'whatever works', 'up to you', 'feel free',
  'get creative', 'go wild', 'have fun with it',
];

/**
 * Auto-detect creativity levels from the user's request text.
 *
 * Rules:
 * 1. If the user provides text AND uses verbatim signals → text: 0
 * 2. If the user provides text without any signal → text: 0 (safe default)
 * 3. If the user uses adapt signals → text: 2
 * 4. No provided text → text: 3
 *
 * Visual follows similar logic with clone/match/freeform signals.
 */
export function detectCreativityLevels(
  userText: string,
  hasProvidedCopy: boolean,
  hasReferenceImage: boolean,
): CreativityLevels {
  const lower = userText.toLowerCase();

  // ── Text freedom ──
  let textLevel: FreedomLevel = 3; // default: full freedom

  if (hasProvidedCopy) {
    // User gave us text — default to VERBATIM unless they explicitly say otherwise
    textLevel = 0;

    // Check if they explicitly want adaptation
    const adaptHits = ADAPT_TEXT_SIGNALS.filter(s => lower.includes(s)).length;
    const freeformHits = FREEFORM_SIGNALS.filter(s => lower.includes(s)).length;

    if (freeformHits > 0) textLevel = 3;
    else if (adaptHits > 0) textLevel = 2;
    // Verbatim signals just reinforce the default of 0
  }

  // ── Visual freedom ──
  let visualLevel: FreedomLevel = 3; // default: full freedom

  if (hasReferenceImage) {
    // User gave us a reference — detect how closely to follow it
    const cloneHits = CLONE_VISUAL_SIGNALS.filter(s => lower.includes(s)).length;
    const matchHits = MATCH_VISUAL_SIGNALS.filter(s => lower.includes(s)).length;
    const freeformHits = FREEFORM_SIGNALS.filter(s => lower.includes(s)).length;

    if (freeformHits > 0) visualLevel = 3;
    else if (cloneHits > 0) visualLevel = 0;
    else if (matchHits > 0) visualLevel = 1;
    else visualLevel = 1; // reference image present but no signal → default to Match
  }

  return { text: textLevel, visual: visualLevel };
}

// ─── Prompt preamble builder ────────────────────────────────────────────────

/**
 * Build the creativity control preamble that gets injected at the TOP
 * of every agent prompt. This is a BINDING instruction that the agent
 * must follow — it overrides any default creative behaviour.
 */
export function buildCreativityPreamble(levels: CreativityLevels): string {
  const textInstruction = TEXT_FREEDOM_LEVELS[levels.text].agentInstruction;
  const visualInstruction = VISUAL_FREEDOM_LEVELS[levels.visual].agentInstruction;

  return `╔══════════════════════════════════════════════════════════════╗
║  CREATIVITY CONTROL — BINDING INSTRUCTIONS                   ║
║  These override ALL other creative defaults in this prompt.  ║
╚══════════════════════════════════════════════════════════════╝

${textInstruction}

${visualInstruction}

────────────────────────────────────────────────────────────────`;
}

// ─── localStorage persistence ───────────────────────────────────────────────

const TEXT_KEY = 'tensorax_creativity_text';
const VISUAL_KEY = 'tensorax_creativity_visual';

/** Get manually set creativity levels (from project settings). Returns null if not set. */
export function getStoredCreativityLevels(): CreativityLevels | null {
  try {
    const text = localStorage.getItem(TEXT_KEY);
    const visual = localStorage.getItem(VISUAL_KEY);
    if (text === null && visual === null) return null;
    return {
      text: (Number(text) || 0) as FreedomLevel,
      visual: (Number(visual) || 3) as FreedomLevel,
    };
  } catch {
    return null;
  }
}

/** Save manually set creativity levels (from project settings sliders). */
export function setStoredCreativityLevels(levels: CreativityLevels): void {
  try {
    localStorage.setItem(TEXT_KEY, String(levels.text));
    localStorage.setItem(VISUAL_KEY, String(levels.visual));
  } catch {
    // ignore
  }
}

/** Clear manual overrides — revert to auto-detection. */
export function clearStoredCreativityLevels(): void {
  try {
    localStorage.removeItem(TEXT_KEY);
    localStorage.removeItem(VISUAL_KEY);
  } catch {
    // ignore
  }
}

/**
 * Resolve creativity levels for a request.
 * Priority: manual override (from settings) > auto-detection from text.
 */
export function resolveCreativityLevels(
  userText: string,
  hasProvidedCopy: boolean,
  hasReferenceImage: boolean,
): CreativityLevels {
  const stored = getStoredCreativityLevels();
  if (stored) return stored;
  return detectCreativityLevels(userText, hasProvidedCopy, hasReferenceImage);
}
