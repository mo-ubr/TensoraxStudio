# Agent Teams — Master Reference Guide

> **Last updated:** 2026-03-25 (v4 — added Dev Agent Pipeline: 3 dev agents + devOrchestrator + ProjectContext.dev namespace)
> **Maintainer:** Update this file every time the agent/team architecture changes.

---

## Table of Contents

1. [When to Use Teams (and When Not To)](#1-when-to-use-teams-and-when-not-to)
2. [Agent Teams vs Subagents](#2-agent-teams-vs-subagents)
3. [Architecture](#3-architecture)
4. [Display Modes](#4-display-modes)
5. [Team Control](#5-team-control)
6. [Task Management](#6-task-management)
7. [Communication](#7-communication)
8. [Permissions](#8-permissions)
9. [Hooks](#9-hooks)
10. [Cost Management](#10-cost-management)
11. [Best Practices](#11-best-practices)
12. [Prompt Templates](#12-prompt-templates)
13. [Troubleshooting](#13-troubleshooting)
14. [Limitations](#14-limitations)
15. [Full Subagent Reference](#15-full-subagent-reference)

---

## 1. When to Use Teams (and When Not To)

### Decision Guide

| Scenario | Use Teams? | Why |
|----------|-----------|-----|
| Full marketing campaign (research → video → distribution) | **Yes** | Multiple specialised agents across 5 teams, sequential pipeline |
| Generate a single image from a prompt | **No** | Single agent call via `runAgent()` — no orchestration needed |
| Staff training video with multi-language localisation | **Yes** | Requires Research + Production + Video Assembly + Localisation agents |
| Quick copy rewrite | **No** | Single Copywriter agent call |
| Video from uploaded keyframes | **Yes** | Pipeline: video generation → stitching → Shotstack composition |
| Brand consistency check on one asset | **No** | Single QA agent call |
| Live shopping stream prep | **Yes** | Research + Production + Assembly + Distribution in sequence |

### Rules of Thumb

- **Use teams** when 3+ agents from 2+ teams need to collaborate sequentially
- **Use a single agent** when the task maps to one prompt with clear input/output
- **Use `runAgentsParallel()`** when multiple independent agents can work simultaneously (e.g. all 4 research agents)
- **Use templates** when the pipeline is a repeatable workflow (not a one-off)

---

## 2. Agent Teams vs Subagents

| Dimension | Agent Teams | Individual Agents (Subagents) |
|-----------|------------|-------------------------------|
| **Scope** | Persistent resource pool — always available | Single-purpose execution units |
| **Lifecycle** | Exist for the project duration | Instantiated per step, discarded after |
| **State** | Share `ProjectContext` across the pipeline | Receive input, return output, no memory |
| **Coordination** | Orchestrators sequence and gate them | `AgentRunner` executes them in isolation |
| **Cost** | One API call per agent per step | Same — one call per invocation |
| **Parallelism** | Configurable via `TeamActivation.parallel` | `runAgentsParallel()` for concurrent execution |
| **Review gates** | Per-step via `requiresReview` flag | N/A — instant execution |

### Mental Model

Think of it like a film production:
- **Teams** = departments (camera, sound, editing, marketing)
- **Agents** = individual crew members within departments
- **Orchestrators** = the production manager scheduling who works when
- **Templates** = the shooting schedule / call sheet
- **ProjectContext** = the shared drive where all dailies and scripts live

---

## 3. Architecture

### Component Map

```
┌─────────────────────────────────────────────────────────┐
│  App.tsx (Global State + ProjectContext)                  │
│  ├── currentScreen routing                               │
│  ├── project state (brief, brand, direction)             │
│  └── localStorage (API keys, model selections)           │
├─────────────────────────────────────────────────────────┤
│  Templates Layer                                         │
│  ├── templateConfig.ts    → Type definitions             │
│  ├── builtInTemplates.ts  → 5 factory templates          │
│  ├── templateService.ts   → CRUD + team catalogue        │
│  └── TemplateConfigFacility.tsx → UI editor               │
├─────────────────────────────────────────────────────────┤
│  Orchestrators (Pipeline Executors)                      │
│  ├── campaignOrchestrator    → Master: chains all below  │
│  ├── researchOrchestrator    → 4 agents in parallel      │
│  ├── conceptOrchestrator     → Concept → Script → Copy   │
│  ├── characterOrchestrator   → Frames → Variations       │
│  ├── videoOrchestrator       → Dynamic agent routing      │
│  ├── editingOrchestrator     → Post-production specs      │
│  ├── compositionOrchestrator → Shotstack Edit JSON        │
│  ├── imageAssemblyOrchestrator → Static deliverables     │
│  └── distributionOrchestrator  → Posting + scheduling     │
├─────────────────────────────────────────────────────────┤
│  AgentRunner (Execution Layer)                           │
│  ├── runAgent<T>()           → Single agent execution    │
│  ├── runAgentsParallel<T>()  → Concurrent execution      │
│  └── runAgentChain<T>()      → Sequential with transform │
├─────────────────────────────────────────────────────────┤
│  AI Providers                                            │
│  ├── Gemini (@google/genai)  → Default, client-side      │
│  └── Claude (@anthropic-ai/sdk) → Alternative            │
├─────────────────────────────────────────────────────────┤
│  Server Services (Express, port 5182)                    │
│  ├── shotstackService.js    → Video composition render   │
│  ├── seedanceService.js     → Seedance 2.0 via fal.ai   │
│  ├── klingService.js        → Kling V3/O3 via fal.ai    │
│  ├── prompt_api.js          → Server-side prompt pipeline│
│  ├── videoAnalysis.js       → Gemini video analysis      │
│  └── dbService.js           → SQLite CRUD                │
└─────────────────────────────────────────────────────────┘
```

### File Locations

| Component | Path |
|-----------|------|
| Orchestrators | `services/orchestrators/*.ts` |
| Agent runner | `services/agentRunner.ts` |
| Agent prompts | `prompts/{domain}/*.ts` |
| Shared types | `services/orchestrators/types.ts` |
| Template types | `templates/templateConfig.ts` |
| Built-in templates | `templates/builtInTemplates.ts` |
| Template CRUD | `services/templateService.ts` |
| Template UI | `components/TemplateConfigFacility.tsx` |

### How Teams Start

1. User selects a template (or the master campaign orchestrator runs)
2. Template config defines which `TeamId`s and `AgentId`s to activate
3. Each step maps to an orchestrator + agent subset
4. Orchestrator reads `ProjectContext`, builds step input, calls `AgentRunner`
5. `AgentRunner` resolves provider + API key, calls Gemini/Claude
6. Result stored back in `ProjectContext`
7. If `requiresReview: true`, execution pauses for user approval
8. Repeat until all steps complete

---

## 3b. Master Orchestrator (3-Tier Architecture)

### Tier 1: Template Launcher (existing)
5 built-in templates as quick-start cards in Template Library. User picks one, runs pipeline.

### Tier 2: Master Orchestrator Chat (Studio screen)
Full-width conversational interface at `/studio`. Capabilities:
- **Template dispatch** — "Run the What-If template" emits `[ACTION:RUN_TEMPLATE:what-if-transformation]`
- **Freeform composition** — "Take photos, write copy, schedule posts" emits `[ACTION:SHOW_PIPELINE:{...}]` with proposed steps
- **Single-agent calls** — "Rewrite this copy" emits `[ACTION:RUN_AGENT:copywriter:input]`
- **File drag-and-drop** — Images/videos shown as thumbnails, base64 injected into context

### Tier 3: Dev Sandbox (future Phase 3)
Backend/Frontend/QA dev agents callable from orchestrator for custom Shotstack schemas, one-off integrations, etc.

### Key Files
| File | Purpose |
|------|---------|
| `services/orchestratorService.ts` | System prompt builder, action parser, PipelinePlan types |
| `components/MasterOrchestrator.tsx` | Full-width chat panel with Gemini |
| `components/PipelineComposer.tsx` | Interactive plan-review UI (inline in chat) |
| `components/AgentCataloguePanel.tsx` | Searchable agent browser modal |
| `components/StudioLayout.tsx` | Layout wrapper for Studio screen |

### Extended ACTION Protocol
| Action | Format | Purpose |
|--------|--------|---------|
| `RUN_TEMPLATE` | `[ACTION:RUN_TEMPLATE:templateId]` | Launch a template |
| `RUN_AGENT` | `[ACTION:RUN_AGENT:agentId:input]` | Single agent call |
| `SHOW_PIPELINE` | `[ACTION:SHOW_PIPELINE:JSON]` | Propose pipeline for review |
| `NAVIGATE` | `[ACTION:NAVIGATE:screen]` | Screen navigation |
| `UPLOAD_REQUEST` | `[ACTION:UPLOAD_REQUEST:desc]` | Request file upload |
| `SET_FIELD` | `[ACTION:SET_FIELD:field:value]` | Set project field (legacy compat) |

### Tier 3: Dev Agent Pipeline (Phase 3 — built, not yet wired to UI)

3-agent pipeline for building custom templates from natural language:

```
User Brief → Backend Dev Agent → Frontend Dev Agent → QA Gate
                 ↑                                        |
                 └──── revision feedback (max 3 retries) ←┘
```

| Step | Agent | Input | Output | Stored In |
|------|-------|-------|--------|-----------|
| 1 | `backendDevAgent` | Brief + brand + QA feedback | TemplateConfig JSON (teams, agents, steps) | `ProjectContext.dev.backendLogic` |
| 2 | `frontendDevAgent` | Brief + backend JSON | customFields, inputs, wizard steps | `ProjectContext.dev.frontendUI` |
| 3 | `qaDevAgent` | Brief + backend + frontend | Pass/fail report with revision feedback | `ProjectContext.dev.qaReport` |

**Key files:**
- `prompts/dev/backendDevAgent.ts` — Includes condensed TemplateConfig schema + all 43 agent IDs + hard rules
- `prompts/dev/frontendDevAgent.ts` — UI field generation guidelines
- `prompts/dev/qaDevAgent.ts` — 5-check validation (schema, referential integrity, pipeline logic, frontend, brief alignment)
- `services/orchestrators/devOrchestrator.ts` — Pipeline with retry loop (max 3 revisions)
- `services/orchestrators/types.ts` — `DevBackendOutput`, `DevFrontendOutput`, `DevQAOutput` types + `ProjectContext.dev`

**ACTION trigger:** `[ACTION:BUILD_TEMPLATE:description]` from Master Orchestrator

### Architecture Note: Agent Statelessness
Agents are single-purpose execution units with no memory between invocations. The Master Orchestrator is a **stateful Gemini chat** (multi-turn conversation via `GeminiService.createChat()`), but the agents it dispatches are stateless. All inter-agent state flows through `ProjectContext`. The orchestrator's system prompt contains a condensed agent catalogue and template registry — not the full agent prompts.

Each dev agent receives only what it needs via `buildInput()`:
- Backend Dev gets: brief, brand, QA feedback (if retry)
- Frontend Dev gets: brief, backend's TemplateConfig
- QA gets: brief, backend config, frontend fields, revision count

---

## 4. Display Modes

### Current Implementation

The UI is **in-process** — all orchestration runs in the browser tab alongside the UI.

| Mode | Description | Status |
|------|-------------|--------|
| **In-process** | Orchestrators run in the main React app | Current |
| **Split-pane** | Side-by-side pipeline monitor + canvas | Planned |
| **Background** | Pipeline runs while user works on other screens | Planned |

### Keyboard Shortcuts (Planned)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Toggle pipeline monitor panel |
| `Ctrl+Shift+R` | Re-run current step |
| `Ctrl+Shift+A` | Approve review gate and proceed |
| `Ctrl+Shift+S` | Skip current step |

---

## 5. Team Control

### Specifying Teams and Agents

Templates control team activation via `TeamActivation[]`:

```typescript
{
  teamId: 'production',
  agents: ['creative-director', 'screenplay', 'image-producer'],
  sequence: ['creative-director', 'screenplay', 'image-producer'],
  parallel: [['image-producer', 'music-generation']],
  params: { style: 'cinematic' },
  notes: 'Cinematic production — no social copy needed'
}
```

### Specifying Models per Agent

Each agent inherits the orchestrator's default model, but can be overridden:

- **Global default**: `OrchestratorConfig.model` (e.g. `gemini-2.5-flash`)
- **Per-step override**: `TemplateStep.params.model`
- **Per-agent override**: Not yet implemented — planned via `TeamActivation.params`

### Model Fallthrough

Both providers try a priority list if the preferred model fails:

| Provider | Priority |
|----------|----------|
| Gemini | `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.0-flash` |
| Claude | `claude-sonnet-4-6` → `claude-haiku-4-5` → `claude-opus-4-6` |

### Plan Approval

Every step with `requiresReview: true` pauses execution and calls `onReviewNeeded()`. The user can:

- **Approve** — proceed to next step
- **Reject** — re-run the step (with optional feedback)
- **Skip** — mark step as skipped, move on

### Shutdown/Cleanup

Orchestrators don't currently have explicit shutdown. If a pipeline is interrupted:
- `ProjectContext` retains all completed step outputs
- Steps can be individually re-run via `runStep(stepId)`
- No cleanup of generated assets is performed automatically

---

## 6. Task Management

### Pipeline Step States

```
pending → running → completed
                  → failed (with error message)
                  → paused (awaiting review)
                  → skipped (user chose to skip)
```

### Dependencies

Steps within an orchestrator run **sequentially by default**. Dependencies are implicit:
- Step N reads the output of Step N-1 from `ProjectContext`
- No explicit dependency graph — order is defined by the `steps[]` array

Cross-team dependencies are handled by the master `campaignOrchestrator`:
- Research must complete before Concept
- Concept must complete before Character/Video
- All production must complete before Assembly
- Assembly must complete before Distribution

### Assignment Strategies

| Strategy | Implementation | Used By |
|----------|---------------|---------|
| Sequential | Steps run one after another | All orchestrators (default) |
| Parallel | Multiple agents run simultaneously | ResearchOrchestrator (4 agents) |
| Dynamic routing | Agent selected based on input type | VideoOrchestrator (prompt/image/keyframes) |
| Conditional | Step skipped if inputs not available | CharacterOrchestrator (skip variations if no characters) |

### Sizing Guidelines

| Content Type | Typical Steps | Typical Duration | API Calls |
|-------------|--------------|-----------------|-----------|
| Quick video (keyframes only) | 3 | 5-10 min | 4-8 |
| Training video | 6 | 15-30 min | 12-20 |
| Full campaign | 8 | 30-60 min | 25-40 |
| Live shopping prep | 4 | 10-20 min | 8-15 |

---

## 7. Communication

### Message Delivery: ProjectContext

All inter-agent communication goes through `ProjectContext` — there is no direct agent-to-agent messaging.

```typescript
ProjectContext {
  projectId, projectName, projectSlug
  brief?: ProjectBrief
  direction?: GeneralDirection
  brand?: BrandProfile

  research?: {
    audience?,          // AudienceResearchOutput
    brandVoice?,        // BrandVoiceOutput
    competitiveTrends?, // CompetitiveTrendsOutput
    socialTrends?       // SocialTrendsOutput
  }
  concept?: {
    concepts?,          // ConceptOutput[]
    selectedConcept?,   // ConceptOutput
    screenplay?,        // ScreenplayOutput
    taglines?,          // TaglineOutput
    socialCopy?         // SocialCopyOutput
  }
  characters?: {
    analysis?,          // CharacterAnalysis
    frames?,            // CharacterFrameOutput
    variations?         // Record<string, unknown>
  }
  video?: {
    segments?,          // VideoSegment[]
    stitchedUrl?        // string
  }
  editing?: {
    voiceover?,         // VoiceoverOutput
    music?,             // MusicOutput
    onScreenText?,      // OnScreenTextOutput
    finalCut?,          // FinalCutOutput
    composition?,       // ShotstackEditJSON
    imageAssembly?      // ImageAssemblyOutput
  }
  distribution?: {
    postingPackages?,   // PostingOutput
    schedule?           // SchedulingOutput
  }
}
```

### Broadcasting

Orchestrators broadcast progress via callbacks:

```typescript
OrchestratorConfig {
  onStepComplete?: (step: PipelineStep, ctx: ProjectContext) => void;
  onReviewNeeded?: (step: PipelineStep, ctx: ProjectContext) => Promise<boolean>;
  onProgress?: (message: string, step?: PipelineStep) => void;
}
```

### Context at Spawn

Each agent receives a **serialised slice** of ProjectContext relevant to its task. The orchestrator's `buildInput()` function constructs this:

```
ResearchOrchestrator → sends: brief + direction + brand
ConceptOrchestrator  → sends: brief + direction + brand + research outputs
VideoOrchestrator    → sends: concept + screenplay + character frames
EditingOrchestrator  → sends: video segments + screenplay + music direction
```

### ChatBot Action Protocol

The ChatBot sidebar communicates with the main app via action tags in AI responses:

```
[ACTION:SET_FIELD:title:New Campaign Title]
[ACTION:GENERATE_IDEA]
[ACTION:REGENERATE:make it more playful]
[ACTION:ACCEPT_CONCEPT]
```

These are parsed by `parseActions()` and dispatched to App.tsx state handlers.

---

## 8. Permissions

### Inheritance Model

```
Global Settings (API keys, default provider)
  └── Project Settings (per-project key/model overrides)
       └── Template Defaults (provider, model, aspect ratio)
            └── Orchestrator Config (runtime overrides)
                 └── Agent Execution (inherits from above, can't override)
```

### API Key Resolution Order

1. Per-model key: `localStorage[${taskKey}__${model}]`
2. Per-task key: `localStorage[${taskKey}]`
3. Environment variable: `TENSORAX_ANALYSIS_KEY`, `TENSORAX_VIDEO_KEY`, etc.
4. Global Gemini key: `localStorage['gemini_api_key']`

### Template Permissions

| Template Type | Can Edit | Can Delete | Can Duplicate | Can Export |
|---------------|----------|------------|---------------|-----------|
| Built-in | No (read-only) | No | Yes | Yes |
| Custom | Yes | Yes | Yes | Yes |
| Imported | Yes | Yes | Yes | Yes |

---

## 9. Hooks

### TeammateIdle

Not yet implemented. Planned behaviour:

When an agent completes its step and the next step is a review gate, the orchestrator enters an "idle" state. This could trigger:

```typescript
// Planned
onTeammateIdle?: (agent: AgentId, step: PipelineStep) => void;
```

**Example use case:** Auto-notify the user that a review is waiting, or auto-approve if confidence is above threshold.

### TaskCompleted

Fires via `onStepComplete` callback when any pipeline step finishes:

```typescript
config.onStepComplete = (step, ctx) => {
  console.log(`Step "${step.name}" completed by agent ${step.agent}`);
  // Update UI progress indicator
  // Save checkpoint to database
  // Trigger next dependent pipeline
};
```

**Example: Auto-save checkpoint after each step**
```typescript
onStepComplete: async (step, ctx) => {
  await projectDB.updateProject(ctx.projectId, {
    metadata: { lastCompletedStep: step.id, context: JSON.stringify(ctx) }
  });
};
```

**Example: Send notification when pipeline completes**
```typescript
onStepComplete: (step, ctx) => {
  if (step.id === 'final-review') {
    showNotification('Pipeline complete! Review your campaign.');
  }
};
```

---

## 10. Cost Management

### Optimisation Strategies

| Strategy | Implementation | Savings |
|----------|---------------|---------|
| **Use Flash models for research** | Set `provider: 'gemini'`, model: `gemini-2.5-flash` for research agents | 10x cheaper than Pro |
| **Parallel research** | 4 agents run concurrently, wall-clock time = slowest agent | No cost saving, but 4x faster |
| **Skip unused teams** | Templates only activate needed agents | Avoids unnecessary API calls |
| **Review gates** | Catch bad outputs before expensive downstream steps | Prevents wasted video gen calls |
| **Model fallthrough** | Try cheaper model first, fall back to expensive | Average cost reduction |

### Token Estimates per Agent Type

| Agent Type | Input Tokens | Output Tokens | Typical Cost (Gemini Flash) |
|------------|-------------|--------------|----------------------------|
| Research agents | 500-1,000 | 2,000-5,000 | $0.001-0.003 |
| Concept/Copy agents | 1,000-3,000 | 3,000-8,000 | $0.002-0.005 |
| QA agent | 2,000-5,000 | 3,000-8,000 | $0.003-0.006 |
| Video prompts | 500-1,000 | 500-1,000 | $0.001 |
| Image gen (Imagen/DALL-E) | N/A | N/A | $0.02-0.04 per image |
| Video gen (Veo/Seedance/Kling) | N/A | N/A | $0.05-0.50 per segment |
| Shotstack render | N/A | N/A | $0.05-0.25 per render |

### Rate Limits

| Provider | Limit | Mitigation |
|----------|-------|------------|
| Gemini API | 15 RPM (free), 360 RPM (paid) | Sequential steps, parallel limited to 4 |
| Claude API | 50 RPM (tier 1) | Rarely hit — most work is on Gemini |
| fal.ai | 5 concurrent jobs | Queue-based polling (8s intervals) |
| Shotstack | Varies by plan | Queue-based polling (3s intervals) |

---

## 11. Best Practices

### 1. Let templates drive, not hard-coded wizards

Templates are the **single source of truth** for which agents run and in what order. Wizards should read template configs, not contain their own pipeline logic.

### 2. Keep agents stateless

Agents receive input and return output. All state lives in `ProjectContext`. An agent should never read from localStorage or make assumptions about what ran before it.

### 3. Always use review gates before expensive steps

Put `requiresReview: true` before video generation, Shotstack rendering, or distribution posting. These are expensive/irreversible.

### 4. Run research agents in parallel

The 4 research agents are independent — always use `runAgentsParallel()`. This cuts research phase wall-clock time by 75%.

### 5. Build input builders that are selective

Don't dump the entire `ProjectContext` into an agent prompt. Only include what that specific agent needs. Smaller inputs = cheaper + better responses.

### 6. Use the QA agent as a gate, not a step

The QA agent should review **all** production outputs before they flow to Assembly. It's a quality gate, not just another step.

### 7. Design templates for the happy path

The template defines the optimal pipeline. Error handling, retries, and alternative paths are the orchestrator's responsibility, not the template's.

---

## 12. Prompt Templates

### Pattern 1: Research Agent

```
You are the {ROLE} for TensoraxStudio.

## Input
- BRIEF: campaign objectives, audience, messages
- BRAND: tone, colours, typography, guidelines

## Your Job
{SPECIFIC RESEARCH INSTRUCTIONS}

## Output Format (JSON)
{
  "findings": [...],
  "recommendations": [...],
  "confidence": 0.0-1.0,
  "sources": [...]
}
```

### Pattern 2: Creative Production Agent

```
You are an award-winning {ROLE} for TensoraxStudio.

## Input
- BRIEF + RESEARCH: {what this agent receives}
- BRAND GUIDELINES: {relevant constraints}

## Your Job
{CREATIVE INSTRUCTIONS}

## Constraints
- Must align with brand voice
- Must address target audience: {from research}
- {ADDITIONAL CONSTRAINTS}

## Output Format (JSON)
{
  "deliverable": {...},
  "brandComplianceNotes": "...",
  "alternativeOptions": [...]
}
```

### Pattern 3: QA / Review Agent

```
You are the QA agent for TensoraxStudio.

## Input
- CREATIVE BRIEF + BRAND GUIDELINES
- ASSETS TO REVIEW: [{assetId, assetType, content, sourceAgent}]

## Checks
1. Brand compliance
2. Character consistency
3. Brief alignment
4. Technical quality
5. Cross-asset consistency

## Severity: PASS | ADVISORY | REVISION_REQUIRED | REJECT

## Output Format (JSON)
{
  "overallVerdict": "APPROVED | REVISIONS_NEEDED | REJECTED",
  "assetReviews": [{verdict, checks, issues, fix instructions}]
}
```

### Pattern 4: Assembly / Composition Agent

```
You are the {ROLE} for TensoraxStudio video assembly.

## Input
- VIDEO SEGMENTS: URLs + metadata
- SCREENPLAY: scene breakdown with timing
- MUSIC/VOICEOVER: specs from upstream agents

## Your Job
{ASSEMBLY INSTRUCTIONS — what to add, where, when}

## Output Format (JSON — Shotstack Edit JSON or spec)
{
  "timeline": {...},
  "tracks": [...],
  "output": { "format": "mp4", ... }
}
```

### Pattern 5: Distribution Agent

```
You are the {ROLE} for TensoraxStudio distribution.

## Input
- FINISHED ASSETS: video URLs, image URLs, copy
- TARGET PLATFORMS: from template config
- BRAND GUIDELINES: posting rules

## Your Job
{PLATFORM-SPECIFIC PACKAGING AND SCHEDULING}

## Output Format (JSON)
{
  "platforms": [{platform, assets, copy, schedule, hashtags}],
  "crossPlatformNotes": "..."
}
```

---

## 13. Troubleshooting

### Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Agent returns empty/malformed JSON | Model didn't follow JSON instruction | `AgentRunner` has JSON extraction with markdown fence handling. If still failing, increase `temperature` or try a different model. |
| "API key not found" error | Key not in localStorage for the selected model | Check `ProjectSettings` → ensure key is saved for the correct task slot |
| Research step takes too long | All 4 agents running sequentially instead of parallel | Ensure orchestrator uses `runAgentsParallel()` |
| Video generation times out | fal.ai queue congested | Polling runs for 10 min max. Check fal.ai status page. |
| Shotstack render fails | Invalid Edit JSON | Check composition agent output. Common issue: missing asset URLs or invalid timecodes. |
| QA agent rejects everything | Overly strict brand guidelines | Review brand profile — ensure guidelines are realistic, not aspirational |
| Template not appearing in UI | Custom template not saved | Check `localStorage` key `tensorax_custom_templates` |
| Step stuck in "running" | Agent call hung or errored silently | Check browser console. `AgentRunner` should throw on timeout but may hang on network issues. |
| Character drift between frames | Gemini generates inconsistent characters | Use character reference images as input. QA agent should catch this. |
| Model fallthrough not working | All models in priority list failing | Check API quotas. Usually means the API key is invalid or quota exhausted. |

### Debugging Steps

1. Open browser DevTools console — `AgentRunner` logs provider, model, and raw response
2. Check `ProjectContext` in React DevTools — verify previous step outputs are populated
3. Test the agent prompt manually in AI Studio / Claude Console with the same input
4. Check network tab for failed API calls (401 = key issue, 429 = rate limit, 500 = provider issue)

---

## 14. Limitations

### Known Constraints

1. **No persistent agent memory** — agents are stateless. Each invocation starts fresh with only the input provided. There is no conversation history between steps.

2. **No real-time streaming** — agents return complete responses. No partial/streaming output during generation.

3. **Client-side execution** — all orchestration runs in the browser. Long pipelines may be interrupted by page navigation, tab sleep, or browser crashes.

4. **No retry logic** — if an agent fails, the step fails. No automatic retry with backoff. User must manually re-run.

5. **No agent-to-agent messaging** — agents cannot directly communicate. All coordination goes through `ProjectContext` via orchestrators.

6. **Single-user, single-pipeline** — no concurrent pipeline execution. Running two templates simultaneously would create `ProjectContext` conflicts.

7. **Template configs are not validated at runtime** — a misconfigured template (wrong agent in wrong team) will fail at execution time, not at creation time.

8. **No cost tracking** — API costs are not tracked or displayed. Users must monitor their provider dashboards.

9. **Shotstack is external** — composition rendering depends on Shotstack API availability and the user's Shotstack plan tier.

10. **Video generation is slow** — fal.ai Seedance/Kling can take 2-5 minutes per segment. A 9-shot storyboard with transitions = 15-45 minutes of video generation.

11. **No offline mode** — all agents require API access. No local model support.

12. **Image inputs are data URIs** — large images are base64-encoded in the prompt, consuming significant input tokens.

---

## 15. Full Subagent Reference

### Teams (5)

| Team ID | Name | Orchestrator | Agent Count |
|---------|------|-------------|-------------|
| `research` | Research Team | `researchOrchestrator.ts` | 6 |
| `production` | Production Team | `conceptOrchestrator.ts`, `characterOrchestrator.ts`, `videoOrchestrator.ts` | 18 |
| `video-assembly` | Video Assembly Team | `editingOrchestrator.ts`, `compositionOrchestrator.ts` | 13 |
| `image-assembly` | Image Assembly Team | `imageAssemblyOrchestrator.ts` | 4 |
| `distribution` | Distribution Team | `distributionOrchestrator.ts` | 2 |

**Total: 43 agents across 5 teams, 9 orchestrators**

### All Agents by Team

#### Research Team (6 agents)

| Agent ID | Name | Prompt File | Description |
|----------|------|------------|-------------|
| `audience-research` | Audience Research | `prompts/research/audienceResearchAgent.ts` | Demographics, buyer personas, behaviour analysis |
| `brand-voice-research` | Brand Voice Research | `prompts/research/brandVoiceResearchAgent.ts` | Brand tone, language, personality validation |
| `competitive-trend-research` | Competitive Trends | `prompts/research/competitiveTrendResearchAgent.ts` | Competitor activity, market positioning |
| `social-media-trend-research` | Social Media Trends | `prompts/research/socialMediaTrendResearchAgent.ts` | Platform trends, hashtags, viral formats |
| `deep-research` | Deep Research | `prompts/research/deepResearchAgent.ts` | Open-ended multi-source web research |
| `general-analysis` | General Analysis | `prompts/research/generalAnalysisAgent.ts` | Document analysis, cross-domain pattern spotting |

#### Production Team (18 agents)

| Agent ID | Name | Prompt File | Description |
|----------|------|------------|-------------|
| `creative-director` | Creative Director | `prompts/concept/conceptOrchestrator.ts` (inline) | Team lead — orchestrates creative work |
| `concept-creation` | Concept Creation | `prompts/concept/conceptFromBriefAgent.ts` + variants | Generates 3-5 distinct campaign concepts |
| `screenplay` | Screenplay | `prompts/concept/screenplayAgent.ts` | Scene breakdowns, shot lists, narration |
| `copywriter` | Copywriter | `prompts/concept/copyAgent.ts` | Ad copy, blog posts, product descriptions |
| `tagline` | Tagline Generator | `prompts/concept/taglineAgent.ts` | Brand taglines and slogans |
| `social-copy` | Social Copy | `prompts/concept/socialCopyAgent.ts` | Platform-specific social media copy |
| `image-producer` | Image Producer | `prompts/character/imageAgent.ts` | Keyframes, product shots, lifestyle imagery |
| `character-builder` | Character Builder | `prompts/character/characterFrameAgent.ts` | SVG-based character trait composer |
| `character-frames` | Character Frames | `prompts/character/characterFrameAgent.ts` | Character scene frames and poses |
| `character-variations` | Character Variations | `prompts/character/characterVariationAgent.ts` | Wardrobe, aging, expression variations |
| `video-producer` | Video Producer | `prompts/Video/` (multiple) | Video clips from keyframes/prompts |
| `video-from-keyframes` | Video from Keyframes | `prompts/Video/videoFromKeyframesAgent.ts` | Segments between consecutive keyframe images |
| `video-from-prompt` | Video from Prompt | `prompts/Video/videoFromPromptAgent.ts` | Video from text prompt only |
| `video-from-start-image` | Video from Start Image | `prompts/Video/videoFromStartImageAgent.ts` | Video starting from a single image |
| `video-from-motion-reference` | Video from Motion Ref | `prompts/Video/videoFromMotionReferenceAgent.ts` | Video using a motion reference |
| `video-stitching` | Video Stitching | `prompts/Video/videoStitchingAgent.ts` | Concatenate multiple segments |
| `music-generation` | Music Generation | `prompts/editing/musicAgent.ts` | Background music, jingles, sound effects |
| `qa-consistency` | QA / Consistency | `prompts/qa/qaConsistencyAgent.ts` | Brand compliance + cross-asset QA gate |

#### Video Assembly Team (13 agents)

| Agent ID | Name | Prompt File | Description |
|----------|------|------------|-------------|
| `text-overlay` | Text Overlay | `prompts/Composition/textOverlayAgent.ts` | Decides what text appears on screen and when |
| `music-direction` | Music Direction | `prompts/Composition/musicDirectionAgent.ts` | Selects and adapts music to the final edit |
| `caption` | Captions | `prompts/Composition/captionAgent.ts` | Subtitle generation from voiceover/descriptive |
| `composition` | Composition (Shotstack) | `prompts/Composition/compositionAgent.ts` | Builds Shotstack Edit JSON from all inputs |
| `shotstack-render` | Shotstack Render | `server/shotstackService.js` | Sends JSON to Shotstack API for final render |
| `video-editing` | Video Editing | `prompts/editing/videoEditingAgent.ts` | Pacing, colour, continuity analysis |
| `voiceover` | Voiceover | `prompts/editing/voiceoverAgent.ts` | ElevenLabs voice generation specs |
| `sound-sync` | Sound Sync | `prompts/editing/soundSyncAgent.ts` | Beat-to-scene sync, audio levels |
| `translator` | Translator | `prompts/localisation/translatorAgent.ts` | Script localisation + transcreation |
| `cultural-reviewer` | Cultural Reviewer | `prompts/localisation/culturalReviewerAgent.ts` | Cultural accuracy + regulatory compliance |
| `subtitles-hooks` | Subtitles & Hooks | `prompts/editing/subtitlesHooksAgent.ts` | Subtitles + attention hooks (scroll stoppers, CTAs) |
| `thumbnail` | Thumbnail Generator | `prompts/editing/thumbnailAgent.ts` | 3-5 thumbnail options with psychology-based scoring |
| `video-assembly-reviewer` | Assembly Reviewer | `prompts/editing/videoAssemblyReviewerAgent.ts` | Final quality gate for assembled video |

#### Image Assembly Team (4 agents)

| Agent ID | Name | Prompt File | Description |
|----------|------|------------|-------------|
| `image-frame-adjustments` | Frame Adjustments | `prompts/imageAssembly/imageFrameAdjustmentsAgent.ts` | Platform-specific crop, resize, format |
| `image-copy-research` | Copy Research | `prompts/imageAssembly/imageCopyResearchAgent.ts` | Captions, hashtags, CTAs per platform |
| `image-assembly` | Image Assembly | `prompts/imageAssembly/imageAssemblyAgent.ts` | Layer-based composition specs |
| `image-assembly-reviewer` | Image Reviewer | `prompts/imageAssembly/imageAssemblyReviewerAgent.ts` | Brand consistency + platform spec check |

#### Distribution Team (2 agents)

| Agent ID | Name | Prompt File | Description |
|----------|------|------------|-------------|
| `posting` | Posting Agent | `prompts/distribution/postingAgent.ts` | Platform-specific posting packages |
| `scheduling` | Scheduling Agent | `prompts/distribution/schedulingAgent.ts` | Optimal timing, cross-platform coordination |

### Built-in Templates (5)

| Template ID | Name | Teams Used | Steps | Shotstack |
|------------|------|-----------|-------|-----------|
| `what-if-transformation` | What If? Transformation | Research, Production, Video Assembly | 5 | Yes |
| `video-from-keyframes` | Video from Key Frames | Production, Video Assembly | 3 | Yes |
| `staff-training-video` | Staff Training Video | Research, Production, Video Assembly | 6 | Yes |
| `product-marketing-campaign` | Product Marketing Campaign | All 5 teams | 8 | Yes |
| `live-shopping-channel` | Live Shopping Channel | Research, Production, Video Assembly, Distribution | 4 | Yes |

### Orchestrators (9)

| Orchestrator | File | Purpose |
|-------------|------|---------|
| `campaignOrchestrator` | `services/orchestrators/campaignOrchestrator.ts` | Master — chains all domain orchestrators |
| `researchOrchestrator` | `services/orchestrators/researchOrchestrator.ts` | 4 research agents in parallel |
| `conceptOrchestrator` | `services/orchestrators/conceptOrchestrator.ts` | Concept → Script → Copy |
| `characterOrchestrator` | `services/orchestrators/characterOrchestrator.ts` | Character design pipeline |
| `videoOrchestrator` | `services/orchestrators/videoOrchestrator.ts` | Dynamic video agent routing |
| `editingOrchestrator` | `services/orchestrators/editingOrchestrator.ts` | Post-production specs |
| `compositionOrchestrator` | `services/orchestrators/compositionOrchestrator.ts` | Shotstack Edit JSON builder |
| `imageAssemblyOrchestrator` | `services/orchestrators/imageAssemblyOrchestrator.ts` | Static image deliverables |
| `distributionOrchestrator` | `services/orchestrators/distributionOrchestrator.ts` | Posting + scheduling |

### Server Services (6)

| Service | File | Port | Purpose |
|---------|------|------|---------|
| Express API | `server/index.js` | 5182 (dev) / 3000 (prod) | Main backend |
| Shotstack | `server/shotstackService.js` | via Express | Video composition rendering |
| Seedance 2.0 | `server/seedanceService.js` | via Express | ByteDance video gen (fal.ai) |
| Kling | `server/klingService.js` | via Express | Kling V3/O3 video gen (fal.ai) |
| Prompt Pipeline | `server/prompt_api.js` | via Express | Server-side image analysis + prompt gen |
| Video Analysis | `server/videoAnalysis.js` | via Express | Gemini video/image analysis |

---

## Appendix: Configuration Interfaces

### TemplateConfig (Full Shape)

```typescript
interface TemplateConfig {
  id: string;                    // kebab-case unique ID
  name: string;                  // Human-readable name
  description: string;           // What this template produces
  icon: string;                  // Font Awesome class
  category: 'marketing' | 'training' | 'social' | 'live' | 'custom';
  version: string;
  author?: string;
  lastModified?: string;

  teams: TeamActivation[];       // Which teams + agents to activate
  steps: TemplateStep[];         // Ordered wizard flow

  defaults?: {
    provider?: 'gemini' | 'claude';
    model?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    segmentDuration?: number;
    transition?: string;
  };

  inputs: {
    requiresSourceImages?: boolean;
    minImages?: number;
    requiresReferenceVideo?: boolean;
    requiresBrief?: boolean;
    requiresBrand?: boolean;
    customFields?: Array<{
      id: string;
      label: string;
      type: 'text' | 'textarea' | 'select' | 'number' | 'toggle';
      options?: string[];
      defaultValue?: string | number | boolean;
      required?: boolean;
    }>;
  };

  outputs: {
    primary: 'video' | 'image' | 'mixed';
    formats?: string[];
    usesShotstack?: boolean;
  };

  tags?: string[];
  builtIn?: boolean;
}
```

### PipelineStep (Runtime)

```typescript
interface PipelineStep {
  id: string;
  name: string;
  agent: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  requiresReview?: boolean;
}
```

### AgentRunOptions

```typescript
interface AgentRunOptions {
  agentPrompt: string;      // System instruction
  userMessage: string;      // Input JSON
  images?: string[];        // Data URIs or URLs
  provider?: 'gemini' | 'claude';
  model?: string;
  apiKey?: string;
  temperature?: number;
}
```

### AgentRunResult

```typescript
interface AgentRunResult<T> {
  data: T;            // Parsed JSON output
  rawText: string;    // Raw model response
  provider: string;   // Which provider was used
  model: string;      // Which model was used
  usage?: {           // Token usage (if available)
    inputTokens: number;
    outputTokens: number;
  };
}
```
