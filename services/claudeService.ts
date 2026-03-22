import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_INSTRUCTION, COPY_INSTRUCTION } from "./promptConstants";

/** Returns true if the model identifier indicates a Claude model. */
export function isClaudeModel(model: string | null): boolean {
  if (!model || typeof model !== "string") return false;
  return /claude/i.test(model.trim());
}

const parseDataUrl = (value?: string): { mimeType: string; data: string } | null => {
  if (!value) return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  if (!/^image\/(jpeg|png|gif|webp)$/.test(mime)) return null;
  return { mimeType: match[1], data: match[2] };
};

/** Default Claude models to try if none specified. */
const DEFAULT_CLAUDE_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-sonnet-4-20250514",
  "claude-haiku-4-5-20251001",
  "claude-3-7-sonnet-20250219",
  "claude-3-haiku-20240307",
];

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const ClaudeService = {
  /**
   * Step 1 (Image Analysis): Analyse reference images to produce a structured breakdown.
   * Same semantics as GeminiService.analyseImagesToStructuredPrompt.
   */
  async analyseImagesToStructuredPrompt(
    apiKey: string,
    model: string | null,
    referenceImages: { character: string[]; clothing: string[]; background: string[] }
  ): Promise<string> {
    const allImages = [
      ...referenceImages.character,
      ...referenceImages.clothing,
      ...referenceImages.background,
    ].filter(Boolean);
    if (allImages.length === 0) return "";

    const content: Anthropic.MessageParam["content"] = [];
    allImages.forEach((url) => {
      const parsed = parseDataUrl(url);
      if (parsed) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: parsed.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: parsed.data },
        });
      }
    });
    content.push({ type: "text", text: ANALYSIS_INSTRUCTION });

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const modelsToTry = model?.trim() ? [model.trim(), ...DEFAULT_CLAUDE_MODELS] : DEFAULT_CLAUDE_MODELS;
    let lastError: unknown;
    for (const m of modelsToTry) {
      try {
        const msg = await client.messages.create({
          model: m,
          max_tokens: 4096,
          messages: [{ role: "user", content }],
        });
        const text = msg.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();
        if (text) return text;
      } catch (error) {
        console.error("[TensorAx Claude]", "analyseImagesToStructuredPrompt", m, toErrorMessage(error));
        lastError = error;
      }
    }
    throw new Error(`Image analysis failed: ${toErrorMessage(lastError)}`);
  },

  /**
   * Step 2 (Prompt Generation): Synthesize scene + 9 shot prompts from structured analysis + user note.
   * Same semantics as GeminiService.generatePromptsFromAnalysis.
   */
  async generatePromptsFromAnalysis(
    apiKey: string,
    model: string | null,
    structuredAnalysis: string,
    userNote: string
  ): Promise<{ scenePrompt: string; shotPrompts: string[] }> {
    const client = new Anthropic({ apiKey: apiKey.trim() });
    const modelsToTry = model?.trim() ? [model.trim(), ...DEFAULT_CLAUDE_MODELS] : DEFAULT_CLAUDE_MODELS;
    let lastError: unknown;
    for (const m of modelsToTry) {
      try {
        const msg = await client.messages.create({
          model: m,
          max_tokens: 4096,
          messages: [{ role: "user", content: COPY_INSTRUCTION(structuredAnalysis, userNote) }],
        });
        const raw = msg.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();
        if (!raw) continue;
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch (parseErr) {
          console.error("[TensorAx Claude] JSON parse failed", { raw: raw.slice(0, 500), model: m }, parseErr);
          continue;
        }
        const scene = typeof parsed.scene === "string" ? parsed.scene.trim() : "";
        const shotsArr = Array.isArray(parsed.shots) ? parsed.shots : Array.isArray((parsed as { shot_prompts?: unknown[] }).shot_prompts) ? (parsed as { shot_prompts: unknown[] }).shot_prompts : [];
        let shots = shotsArr.slice(0, 9).map((s) => String(s).trim()).filter(Boolean);
        while (shots.length < 9 && scene) shots.push(scene);
        if (scene && shots.length >= 1) return { scenePrompt: scene, shotPrompts: shots.slice(0, 9) };
      } catch (error) {
        console.error("[TensorAx Claude]", "generatePromptsFromAnalysis", m, toErrorMessage(error));
        lastError = error;
      }
    }
    throw new Error(`Prompt generation failed: ${toErrorMessage(lastError)}`);
  },
};
