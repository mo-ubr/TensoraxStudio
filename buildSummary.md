# Build Summary — Template Library (Phase 4)

> **Date:** 2026-03-25
> **Branch:** `claude/silly-poitras`
> **Build method:** 3-agent Opus team (Backend Dev + Frontend Dev + QA)

---

## What Was Built

### Backend Dev — REST API + Pipeline Tracking

**Files created:**
- `server/templateRoutes.js` — Template CRUD REST API
- `server/pipelineRoutes.js` — Pipeline execution tracking API

**Files modified:**
- `server/index.js` — Mounted new routers at `/api/templates` and `/api/pipeline`

**Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/templates` | List all templates (built-in + custom) |
| GET | `/api/templates/:id` | Get single template |
| POST | `/api/templates` | Create custom template |
| PUT | `/api/templates/:id` | Update custom template |
| DELETE | `/api/templates/:id` | Delete custom template |
| POST | `/api/templates/:id/duplicate` | Duplicate any template |
| POST | `/api/templates/import` | Import from JSON |
| GET | `/api/templates/:id/export` | Export as JSON |
| POST | `/api/pipeline/start` | Start pipeline run |
| GET | `/api/pipeline/:runId` | Get run status |
| PUT | `/api/pipeline/:runId/step` | Update step status |
| GET | `/api/pipeline/project/:projectId` | List runs for project |

**Database:** Two new SQLite tables (`templates`, `pipeline_runs`) in `assets/tensorax.db`.

**Response format:** `{ success: true, data: ... }` or `{ success: false, error: "message" }`

---

### Frontend Dev — Template Library + Runner UI

**Files created:**
- `components/TemplateLibrary.tsx` — Full-screen template browser
- `components/TemplateRunner.tsx` — Pipeline execution wizard

**Files modified:**
- `App.tsx` — Added routing for `template-library` and `template-runner` screens
- `components/Sidebar.tsx` — Simplified click handler to always use `onNavigate`

**Template Library features:**
- Category filter pills (All / Marketing / Training / Social / Live / Custom)
- Search by name, description, tags
- Template cards with icon, name, badges (MARKETING, BUILT-IN, SHOTSTACK), description, stats (teams/agents/steps), tags
- "Use Template" and "Configure" buttons per card
- Custom template delete capability

**Template Runner features:**
- Left sidebar with numbered step stepper (pending/running/completed/review/failed states)
- Main content area showing step details, team badge, agent chips
- Simulated 2-second step execution with running animation
- Review gate UI (Approve & Continue / Reject & Retry) for steps with `requiresReview: true`
- Pipeline completion summary screen
- Progress bar and step counter in header

---

### QA — Test Suite + Report

**Files created:**
- `vitest.config.ts` — Vitest configuration (jsdom environment)
- `tests/templateConfig.test.ts` — 155 tests validating all 5 built-in template configs
- `tests/templateService.test.ts` — 33 tests for CRUD operations with mocked localStorage
- `tests/templateIntegration.test.ts` — 38 tests for cross-system integrity
- `tests/QA-REPORT.md` — Structured QA report

**Files modified:**
- `package.json` — Added `test` and `test:watch` scripts, vitest + jsdom + testing-library devDependencies

**Test results:** 226/226 passing (0 failures)

---

## Key Decisions

1. **Client-side template service preserved** — The existing `services/templateService.ts` (localStorage) continues to work alongside the new REST API. This avoids breaking existing functionality while adding server-side persistence for production use.

2. **Simulated pipeline execution** — The Template Runner currently simulates step execution (2-second delay + mock output). Real orchestrator integration is the next phase — the runner is pre-wired with the step/team/agent metadata needed to connect.

3. **Sidebar simplified** — Removed the `onTemplates` prop bypass in the Sidebar. Templates button now always goes through `onNavigate('templates')` like every other button, which fixed a routing issue where the old template list was showing instead of the new Library.

4. **Built-in templates hardcoded in API** — The 5 built-in template configs are defined in both the client bundle (`templates/builtInTemplates.ts`) and the server (`server/templateRoutes.js`). This avoids the server needing to import TypeScript modules.

5. **Vitest over Jest** — Chose Vitest because it integrates natively with Vite (the existing build tool), requires zero config, and runs 226 tests in under 2 seconds.

6. **Pipeline runs in SQLite** — Pipeline execution state is persisted in SQLite so runs survive page refreshes and can be resumed.

---

## How to Run

### Development server
```bash
npm run dev:full     # Frontend (Vite, port 5180) + Backend (Express, port 5182)
```

### View in browser
```
http://localhost:5180
```

Click **TEMPLATES** in the sidebar to open the Template Library.
Click **Use Template** on any card to launch the Template Runner.

### Run tests
```bash
npm test             # Run all 226 tests once
npm run test:watch   # Watch mode
```

### Build for production
```bash
npm run build        # Vite production build → dist/
```

---

## Files Changed (14 files, +3,817 lines)

| File | Type | Lines |
|------|------|-------|
| `server/templateRoutes.js` | New | ~350 |
| `server/pipelineRoutes.js` | New | ~200 |
| `server/index.js` | Modified | +4 |
| `components/TemplateLibrary.tsx` | New | ~400 |
| `components/TemplateRunner.tsx` | New | ~450 |
| `App.tsx` | Modified | +55 |
| `components/Sidebar.tsx` | Modified | -4 |
| `vitest.config.ts` | New | 10 |
| `tests/templateConfig.test.ts` | New | ~600 |
| `tests/templateService.test.ts` | New | ~250 |
| `tests/templateIntegration.test.ts` | New | ~300 |
| `tests/QA-REPORT.md` | New | ~150 |
| `package.json` | Modified | +5 |
| `package-lock.json` | Modified | auto |

---

## What's Next

1. **Wire real orchestrators** — Connect Template Runner steps to actual orchestrator execution (AgentRunner + Gemini/Claude API calls)
2. **Pipeline resume** — Use the pipeline_runs SQLite table to resume interrupted pipelines
3. **Template Library expansion** — Add more built-in templates using the Template Configuration Facility
4. **Cost tracking** — Display estimated and actual API costs per pipeline run
5. **Concurrent pipelines** — Agent scheduling when two templates need the same agent
