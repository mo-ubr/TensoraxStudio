# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Owner & Working Style

Mariella Ostend, owner of UBR Retail (mariella.ostend@ubr-retail.com). Non-coder business owner with a Physics degree and a decade of retail operations experience. Early AI adopter.

- I am NOT a coder. Explain changes in plain English.
- Never ask me clarifying questions. If you need to plan, just plan and execute.
- Always use deep thinking for better results.
- I prefer to see results in an external browser at http://localhost:5180
- Test changes before committing.
- Every response should end with either **DONE** (task complete) or **MARIELLA TO DO** (lists only tasks requiring external access like GCP console, app store, etc.). The agent handles everything accessible from code/terminal.
- Mariella is an expert-level n8n user — respond accordingly in relevant conversations.

## Git Safety — Automatic Commits

Claude Code must run git commits automatically at these three moments. Do not ask Mariella — just do it.

1. **Start of every session**: Before any work begins, commit and push everything that's currently uncommitted.
2. **Before any major change**: Before starting risky work (database changes, major refactors, deleting files, rewriting modules), commit and push first so there's a safe rollback point.
3. **End of every session**: After the final task is done, commit and push all work.

The commands to run each time:
```bash
git add -A && git commit -m "checkpoint: <brief description of what's about to happen or what was done>" && git push
```

If there's nothing to commit, that's fine — just move on. Never skip these checkpoints.

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

## What This Project Is

Tensorax Studio is an AI-powered creative production platform for branded video campaigns — the core product of UBR Retail's pivot from physical retail to a B2B AI services company for other retailers.

It guides users through a pipeline: **Copy** (concept/screenplay) → **Images** (character/key visual generation) → **Frames** (9-shot storyboard grid) → **Video** (AI video generation).

## The Bigger Picture — UBR Retail's B2B Pivot

TensoraxStudio is Pillar 3 of a five-pillar strategy:
1. **Productivity Suite** — Email, invoicing, cashflow, bookkeeping, presentations
2. **Retail Operations Tools** — AI-enhanced RFID, smart CCTV, stock optimisation, analytics, training videos
3. **AI Marketing Suite** — THIS PROJECT. Viral video, virtual influencers, live selling, social bots, trend tracking
4. **International Subfranchise Network** — HQ services to local operators running dual-role physical/online stores
5. **Localisation Services** — Last-mile delivery, local customer service, smart marketing

Development sequence: Marketing Suite (NOW) → Subfranchise Network → Productivity Suite

## Key Goals

- Consistent virtual influencer character set across all generated content
- Live shopping channel with virtual presenter
- Self-optimising A/B testing (Auto Research pattern) for marketing campaigns
- Staff training video generation
- Bot training content
- Two-layer AI architecture: multimodal generative models for style/character extraction + Gemini Embeddings 2 as a consistency gate

## Architecture

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

## Brand Context

- Primary retail brand: NEXT (UK fashion retailer)
- Operating in retail leasing and brand partnerships
- Key contacts at Lamda Development (Greek commercial property)
- Also working on positioning for The Ellinikon Mall in Greece

## Conventions

- Dev ports: frontend 5180, backend 5182.
- UK/US (ISO/ANSI) keyboard layouts preferred.

## Other Projects (for reference, not part of this codebase)

- za_horata YouTube channel — civic content encouraging Bulgarian voter participation
- UBR Greek Comms & Compliance GPT (planned)
- Economic think tank work in Bulgaria/EU focusing on entrepreneurial culture and European federalisation
