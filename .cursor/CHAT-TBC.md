# Chat – To Be Continued

**Date:** Feb 19, 2026

---

## How to Start Tomorrow

```powershell
cd "c:\Users\marie\Documents\11 Apps\TensoraxStudio"
npm run server   # backend on port 5182
npm run dev      # frontend on port 5180
```

Open: http://localhost:5180

---

## What Was Built Today (Full Summary)

### 1. Prompt Generation (Auto Generate)
- **Step 1 (Analysis):** Uses Gemini model set in **Analysis** modal. Sends images in 3 labeled groups (GROUP A–CHARACTER, GROUP B–CLOTHING, GROUP C–BACKGROUND) so the model never mixes them up.
- **Step 2 (Copy):** Uses model set in **Copy** modal. Generates 9 shot prompts in a structured labeled format: `Subject character: ... Outfit: ... Environment: ... Shot framing: ... Style: ...`
- **Current best models:** Analysis = `gemini-2.5-flash`, Copy = `gemini-3-flash-preview`
- Both models use the same Gemini API key (Google AI Studio key)

### 2. Image Generation
- **Primary model:** `gemini-3-pro-image-preview` (AI Studio style) — sees ALL reference images (character + clothing + background) visually during generation. Best for consistency.
- **Fallback:** Vertex AI `imagen-3.0-capability-001`
- **Prompt structure** (sent to image model): `Consistent high-fidelity render. Use image references... [shot prompt]. Subject character: [...]. Outfit: [...]. Environment: [...]. Scene context: [scene prompt].`
- Reference images: uploaded in Scene Configuration panel (character / clothing / background slots)

### 3. Keyframe → Video Workflow
- Hover over any generated frame → **Start / Mid / End** buttons appear → click to set as video keyframe and jump to Video tab

### 4. Video Generation — Two Engines
| Engine | Model | Notes |
|---|---|---|
| **Veo 3.1** | `veo-3.1-generate-preview` | Via Gemini API. Supports Start + Mid + End frames. Falls back to `veo-2.0-generate-001`. |
| **Kling V3** | `fal-ai/kling-video/v3/standard/image-to-video` | Via fal.ai. Supports Start + End frames + **motion reference video**. |

**Kling Motion Control mode:** Upload a motion reference video in the Kling section → automatically uses `fal-ai/kling-video/motion-control` endpoint (Start frame = character style, video = motion guide).

**API Keys needed:**
- Gemini (analysis, copy, image, Veo): Google AI Studio key (`AIza...`) — set in Analysis + Copy modals in the app
- Kling: **fal.ai** key — get at https://fal.ai/dashboard/keys — paste into Video tab → Kling v2 section

### 5. Prompt Instructions (from "Prompt for a 3x3 Grid.docx")
Fully incorporated into `server/prompt_api.js` and `services/promptConstants.ts`:
- Full role: award-winning trailer director + cinematographer + storyboard artist
- Non-negotiable continuity rules (same subjects/wardrobe/lighting across all 9 shots)
- Row 1/2/3 shot structure
- Per-shot labeled format for image generation compatibility
- GROUP A/B/C image labeling for analysis

### 6. Infrastructure
- Body limit: 50mb (for large base64 images)
- MIME type auto-detection from binary magic bytes (fixes png-declared-but-actually-jpeg errors)
- Claude fallback list: `claude-opus-4-6 → claude-sonnet-4-6 → claude-sonnet-4-5 → ... → claude-3-haiku-20240307`
- Gemini fallback list: `gemini-2.5-flash → gemini-2.0-flash`
- Tailwind CSS: proper PostCSS install (no CDN), `index.css` with `@import "tailwindcss"`
- `services/promptConstants.ts` — single source of truth for all prompts (imported by geminiService.ts + claudeService.ts)
- `server/prompt_api.js` — server-side mirror of the same prompts

---

## Files Changed Today

| File | What Changed |
|---|---|
| `server/prompt_api.js` | Full rewrite: labeled image groups, structured prompts, MIME detection, extended Claude fallbacks, diagnostic logging |
| `server/index.js` | Body limit 50mb, added `/api/generate-video-kling` endpoint |
| `server/klingService.js` | **NEW** — Kling V3 via fal.ai, motion control mode |
| `server/tensorax_api.js` | Model: `imagen-3.0-capability-001` |
| `server/imagen.js` | Model: `imagen-3.0-capability-001` |
| `services/promptConstants.ts` | **NEW** — shared ANALYSIS_INSTRUCTION, COPY_INSTRUCTION, SHOT_SPECS, CONTINUITY_RULES, ASSISTANT_SYSTEM_INSTRUCTION |
| `services/geminiService.ts` | Priority swap (Gemini first, Vertex fallback), Veo 3.1, imports from promptConstants |
| `services/claudeService.ts` | Updated model list, imports from promptConstants |
| `App.tsx` | Keyframe buttons on grid images, Kling provider toggle + key + motion video upload, structured image prompt, scene prefix |
| `tailwind.config.js` | **NEW** — Tailwind V4 config |
| `postcss.config.cjs` | Updated to `@tailwindcss/postcss` |
| `index.css` | **NEW** — `@import "tailwindcss"` + body/scrollbar styles |
| `index.html` | Removed CDN Tailwind script |
| `index.tsx` | Added `import './index.css'` |

---

## Next Steps / Things to Test

1. **Auto Generate** with Gemini key + `gemini-2.5-flash` (Analysis) + `gemini-3-flash-preview` (Copy) — check shot prompts are labeled correctly
2. **Generate frames** — check gemini-3-pro-image-preview matches the dress/hair/park correctly
3. **Kling video** — get fal.ai key at https://fal.ai/dashboard/keys, paste in Video tab → Kling v2 section, test with a generated frame as Start
4. **Kling motion control** — upload a reference video in the Motion Reference Video slot and test
5. **Veo 3.1** — test with Start + End frames set from the grid

---

## Current API Keys Setup

| Key | Where to set |
|---|---|
| Gemini API key (`AIza...`) | App → Analysis modal + Copy modal (also optionally `.env.local` GEMINI_API_KEY) |
| fal.ai key (for Kling) | App → Video tab → Kling v2 section |
| Vertex AI | `Tensorax-Key.json` in project root (already set ✓) |

## Run Commands

```powershell
# Start everything (recommended)
npm run dev:full    # backend 5182 + frontend 5180

# Or separately
npm run server      # backend only
npm run dev         # frontend only (Vite)

# If port 5182 is busy
$p = (netstat -ano | Select-String ":5182.*LISTENING" | ForEach-Object { ($_ -split "\s+")[-1] } | Select-Object -First 1); if ($p) { taskkill /PID $p /F }
```
