# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Vite dev server only (port 5180) — frontend with Gemini consumer API
npm run dev:full      # Vite + Express concurrently — enables Vertex AI, DALL-E, fal.ai backends
npm run server        # Express backend only (port 5182)
npm run build         # Vite production build → dist/
npm run preview       # Preview production build locally
```

No test runner or linter is configured.

Production deploy (DigitalOcean/PM2): `bash deploy.sh` runs git pull → npm ci → build → pm2 reload.

## Architecture

Tensorax Studio is an AI-powered creative production platform for branded video campaigns. It guides users through a pipeline: **Copy** (concept/screenplay) → **Images** (character/key visual generation) → **Frames** (9-shot storyboard grid) → **Video** (AI video generation).

### Frontend (React + Vite, TypeScript)

- **No router or state library** — `App.tsx` manages all global state via `useState`/`useEffect` with prop drilling. Screen routing uses a `currentScreen` string state.
- **Persistent state**: localStorage (API keys, model selections, brand, provider), SQLite via server (projects, assets, metadata).
- `types.ts` — all shared interfaces (`GridImage`, `VideoState`, `ProjectBrief`, `ConceptIdea`, `GeneralDirection`, `BrandProfile`).
- Tailwind v4, accent colour `#91569c`, fonts Poppins (headings) + Sora (body).

### Backend (Express, port 5182 dev / 3000 prod)

- `server/index.js` — mounts all routers, registers endpoints, serves static `dist/` in production.
- `server/dbService.js` — SQLite REST API at `/api/db` (projects, assets, metadata CRUD).
- `server/prompt_api.js` — two-step prompt pipeline (image analysis → 9-shot prompt generation) via Claude or Gemini.
- `server/tensorax_api.js` — Vertex AI Imagen 3 image generation (GCP service account auth).
- `server/seedanceService.js`, `server/klingService.js` — video generation via fal.ai queue API (poll every 8s).
- `server/videoAnalysis.js` — video/image analysis via Gemini, mounted at `/api/video`.
- `server/driveService.js` — Google Drive API wrapper.
- `server/openai_imagen.js` — DALL-E 3 fallback.

### Services (client-side, `services/`)

- `geminiService.ts` — main AI service: image gen, analysis, chat, video (Veo), prompt enhancement. Runs in browser via `@google/genai`.
- `claudeService.ts` — Claude image analysis + prompt generation. Uses `@anthropic-ai/sdk` client-side; server-side via `/api/generate-prompts`.
- `projectDB.ts` — typed client wrapper for all `/api/db` endpoints.
- `brandData.ts` — brand profile management (NEXT hardcoded as default, custom brands from .docx/.md uploads, stored in localStorage).
- `promptConstants.ts` — single source of truth for AI prompts (`SHOT_SPECS`, `CONTINUITY_RULES`, `ANALYSIS_INSTRUCTION`). Note: these are manually mirrored in `server/prompt_api.js`.
- `imageProvider.ts` — provider abstraction routing to Gemini, OpenAI, or Vertex.

### Components (`components/`)

- `ConceptScreen.tsx` — orchestrates Copy pipeline: GeneralDirection → IdeaFactory → IdeaFinetune → Screenplay.
- `ImagesScreen.tsx` — Images pipeline: Characters → Backgrounds → Props → Key Visuals → Review.
- `CharacterBuilder.tsx` — visual SVG-based character trait composer that builds text prompts.
- `ProjectSettings.tsx` — per-project API key/model configuration for 5 task slots.
- `ChatBot.tsx` — AI assistant sidebar (Gemini chat); communicates via `[ACTION:TYPE:value]` tags parsed from responses.
- `NewProjectWizard.tsx` — 4-step project creation wizard (Brief → Name → Brand → Scope).

## Key Patterns

**Per-model API key slots**: Each AI task (analysis, copy, image gen, video gen) stores its own key+model in localStorage. Keys can be per-model: `${baseKey}__${model}`. Env vars (`TENSORAX_ANALYSIS_KEY`, etc.) are baked into the frontend bundle at build time via Vite `define`.

**Two-step prompt pipeline**: Step 1 = image analysis (structured description of character/clothing/background). Step 2 = 9-shot prompt generation from analysis + user note. Both Claude and Gemini implement the same interface.

**Model fallthrough**: Both `ClaudeService` and `GeminiService` try a priority list of model aliases if the preferred model fails.

**Video generation routing**: Provider determined by model name prefix in localStorage (`seedance-*` → fal.ai Seedance, `kling-*` → fal.ai Kling, others → Veo/Gemini).

**Asset folder structure**:
```
assets/
  tensorax.db                       # SQLite database
  0. Projects/{slug}/               # Per-project (concepts/, images/, frames/, videos/)
  2. Screenplays/                   # Word docs, style_references.json
  3. Characters/                    # Character reference images
  5. Brands/
```

## Vite Configuration

- Dev server port: 5180. Proxies `/api` to `localhost:5182`.
- Ignores `assets/` directory and `*.db` files from hot-reload watcher to prevent reloads during file saves.

## Brand Guidelines

NEXT brand identity rules (logotype, typography, colours, CTAs) are defined in `.cursor/rules/next-brand-identity.mdc`. Apply when generating prompts, building UI, or producing any creative output for the NEXT brand.

## Conventions

- Every response should end with either **DONE** (task complete) or **MARIELLA TO DO** (lists only tasks requiring external access like GCP console, app store, etc.). The agent handles everything accessible from code/terminal.
- Dev ports: frontend 5180, backend 5182.
