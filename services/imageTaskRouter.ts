/**
 * Image Task Router
 *
 * Detects whether an image generation request is:
 *   1. "Reproduce & replace text" → Faithful path (Flux Kontext edit or faithful reproduction prompt)
 *   2. "Create storyboard / 9-shot grid" → Standard 9-shot pipeline
 *   3. "Generate new image from scratch" → Standard image generation
 *
 * The router examines the user's request text, attached images, and context
 * to decide which pipeline to use. This prevents the 9-shot storyboard
 * system from hijacking simple text-replacement tasks.
 */

// ─── Route types ────────────────────────────────────────────────────────────

export type ImageTaskRoute =
  | 'faithful-edit'        // Image edit model (Flux Kontext / Nano Banana) — best for text replacement
  | 'faithful-generate'    // Faithful reproduction via generation model — fallback when edit model unavailable
  | 'storyboard-9shot'     // Standard 9-shot contact sheet pipeline
  | 'standard-generate';   // Single new image from prompt (no reference)

import { type CreativityLevels, detectCreativityLevels } from './creativityControl';
import { Settings } from './settingsDB';

export interface ImageTaskRoutingResult {
  route: ImageTaskRoute;
  confidence: number;          // 0–1, how sure we are about the route
  reason: string;              // Human-readable explanation
  editInstruction?: string;    // Pre-built edit instruction for faithful-edit route
  referenceImageUri?: string;  // The reference image to reproduce
  newText?: string;            // Replacement text extracted from the request
  creativityLevels: CreativityLevels; // Auto-detected creativity levels for this request
}

// ─── Detection keywords ─────────────────────────────────────────────────────

/** Phrases that strongly signal "reproduce this image with different text" */
const FAITHFUL_SIGNALS = [
  // Exact reproduction intent
  'identical', 'same image', 'same design', 'same layout', 'same style',
  'copy this', 'reproduce', 'replicate', 'duplicate', 'clone',
  'keep everything', 'keep the same', 'don\'t change', 'do not change',
  'exactly like', 'just like', 'match this', 'mirror this',
  // Text replacement intent
  'replace the text', 'change the text', 'swap the text', 'update the text',
  'replace the copy', 'change the copy', 'swap the copy', 'update the copy',
  'new text', 'different text', 'replace the headline', 'change the headline',
  'replace the title', 'change the title', 'swap the title',
  'replace the words', 'change the words', 'different words',
  'localise', 'localize', 'translate', 'different language',
  'same but with', 'same except',
  // Explicit anti-creativity
  'no interpretation', 'no creative', 'don\'t reinterpret', 'faithful',
  'exact copy', 'exact reproduction', 'practically identical',
];

/** Phrases that signal storyboard / 9-shot intent */
const STORYBOARD_SIGNALS = [
  'storyboard', 'contact sheet', '9 shot', '9-shot', 'nine shot',
  'camera angles', 'shot types', 'ELS', 'close-up', 'medium shot',
  'long shot', 'bird\'s eye', 'worm\'s eye', 'low angle', 'high angle',
  'cinematic', 'shot grid', 'frame grid', 'shot composition',
];

// ─── Router ─────────────────────────────────────────────────────────────────

/**
 * Analyse a user request and determine which image pipeline to use.
 *
 * @param userText   The user's instruction / prompt
 * @param hasReferenceImage  Whether the user attached a reference image
 * @param hasFluxKontextKey  Whether a fal.ai API key is available for image editing
 */
export function routeImageTask(
  userText: string,
  hasReferenceImage: boolean,
  hasFluxKontextKey: boolean = false,
  hasProvidedCopy: boolean = false,
): ImageTaskRoutingResult {
  const lower = userText.toLowerCase();

  // Auto-detect creativity levels from user language
  const creativityLevels = detectCreativityLevels(userText, hasProvidedCopy, hasReferenceImage);

  // Count signal matches
  const faithfulHits = FAITHFUL_SIGNALS.filter(s => lower.includes(s)).length;
  const storyboardHits = STORYBOARD_SIGNALS.filter(s => lower.includes(s)).length;

  // ── Strong faithful signal + reference image = faithful path ──
  if (faithfulHits >= 2 && hasReferenceImage) {
    if (hasFluxKontextKey) {
      return {
        route: 'faithful-edit',
        confidence: Math.min(0.95, 0.6 + faithfulHits * 0.1),
        reason: `Detected ${faithfulHits} reproduction/text-replacement signals with a reference image. Using image edit model for precise text replacement.`,
        referenceImageUri: undefined, // caller fills this in
        creativityLevels,
      };
    }
    return {
      route: 'faithful-generate',
      confidence: Math.min(0.9, 0.5 + faithfulHits * 0.1),
      reason: `Detected ${faithfulHits} reproduction signals with reference image. No edit model API key available — falling back to faithful generation prompt.`,
      creativityLevels,
    };
  }

  // ── Single faithful signal + reference image = likely faithful ──
  if (faithfulHits >= 1 && hasReferenceImage && storyboardHits === 0) {
    if (hasFluxKontextKey) {
      return {
        route: 'faithful-edit',
        confidence: 0.7,
        reason: `Detected reproduction intent with reference image. Using image edit model.`,
        creativityLevels,
      };
    }
    return {
      route: 'faithful-generate',
      confidence: 0.65,
      reason: `Detected reproduction intent with reference image. Using faithful generation prompt.`,
      creativityLevels,
    };
  }

  // ── Explicit storyboard signals = 9-shot pipeline ──
  if (storyboardHits >= 1) {
    return {
      route: 'storyboard-9shot',
      confidence: Math.min(0.95, 0.6 + storyboardHits * 0.15),
      reason: `Detected ${storyboardHits} storyboard/cinematography signals. Using 9-shot pipeline.`,
      creativityLevels,
    };
  }

  // ── Reference image but no clear reproduction signal = still check ──
  if (hasReferenceImage && faithfulHits === 0 && storyboardHits === 0) {
    // Ambiguous — reference image present but no strong signal either way.
    // Default to standard generation (the user probably wants something inspired by, not identical to).
    return {
      route: 'standard-generate',
      confidence: 0.5,
      reason: `Reference image provided but no clear reproduction or storyboard intent detected. Using standard image generation.`,
      creativityLevels,
    };
  }

  // ── Default: standard single image generation ──
  return {
    route: 'standard-generate',
    confidence: 0.6,
    reason: `No storyboard or reproduction signals detected. Using standard image generation.`,
    creativityLevels,
  };
}

/**
 * Build a Flux Kontext / Nano Banana edit instruction from the user's request.
 * This is a simple, direct instruction for the image edit model.
 */
export function buildEditInstruction(
  userText: string,
  newText?: string,
): string {
  // If the user explicitly provided new text, build a targeted instruction
  if (newText) {
    return `Replace all visible text in the image with: "${newText}". Keep everything else — layout, colours, subjects, background, style — exactly the same.`;
  }
  // Otherwise, pass the user's full instruction through as-is (it's already descriptive)
  return userText;
}

/**
 * Check if a fal.ai API key is available for image editing.
 */
export function hasFalApiKey(): boolean {
  const key = Settings.get('tensorax_fal_key') || Settings.get('FAL_KEY');
  return !!key;
}

/**
 * Get the fal.ai API key.
 */
export function getFalApiKey(): string | null {
  return Settings.get('tensorax_fal_key') || Settings.get('FAL_KEY') || null;
}
