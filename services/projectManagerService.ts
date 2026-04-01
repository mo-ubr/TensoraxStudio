/**
 * Project Manager Service — Layer 3 of the Three-Layer Architecture.
 *
 * Takes a user brief (from MO) and runs the PM agent to produce
 * a structured execution plan. Then converts that plan into a
 * TemplateConfig the pipeline engine can execute.
 */

import { runAgent, type AgentRunResult } from './agentRunner';
import { projectManagerPrompt } from '../prompts/orchestration/projectManagerPrompt';
import type { TemplateConfig, TemplateStep, TeamId, AgentId } from '../templates/templateConfig';
import { TEAM_CATALOGUE } from './templateService';

// ─── PM Plan Types ─────────────────────────────────────────────────────────

export interface PmPlanStep {
  stepNumber: number;
  name: string;
  teamId: string;
  instruction: string;
  dependsOn: number[];
  qualityGate: boolean;
  userApproval: boolean;
  parallel: boolean;
  expectedOutput: string;
}

export interface PmPlan {
  planName: string;
  summary: string;
  estimatedSteps: number;
  steps: PmPlanStep[];
  risks: string[];
  requiredAssets: string[];
}

// ─── PM Execution ──────────────────────────────────────────────────────────

/**
 * Run the Project Manager agent to decompose a user brief into a plan.
 */
export async function generatePlan(
  brief: string,
  projectContext?: Record<string, unknown>,
): Promise<{ plan: PmPlan; raw: AgentRunResult }> {
  const userMessage = JSON.stringify({
    userBrief: brief,
    projectContext: projectContext ?? {},
    availableTeams: TEAM_CATALOGUE.map(t => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
      agents: t.agents.map(a => a.name),
    })),
  }, null, 2);

  const result = await runAgent({
    agentPrompt: projectManagerPrompt,
    userMessage,
  });

  // Parse the PM's JSON plan
  let plan: PmPlan;
  try {
    plan = (typeof result.data === 'object' && result.data !== null)
      ? result.data as PmPlan
      : JSON.parse(result.rawText || '{}');
  } catch {
    // If PM output isn't valid JSON, create a minimal plan
    plan = {
      planName: 'Custom Plan',
      summary: result.rawText?.slice(0, 200) || 'Plan generation failed — raw output returned.',
      estimatedSteps: 0,
      steps: [],
      risks: ['PM output was not valid JSON — manual planning may be needed.'],
      requiredAssets: [],
    };
  }

  return { plan, raw: result };
}

// ─── Plan → TemplateConfig Conversion ──────────────────────────────────────

/**
 * Convert a PM plan into a TemplateConfig that the pipeline engine can execute.
 * All steps are created with `executionMode: 'team-leader'` so TL QA gates apply.
 */
export function planToTemplate(plan: PmPlan): TemplateConfig {
  const steps: TemplateStep[] = plan.steps.map((s, i) => {
    const teamId = resolveTeamId(s.teamId);
    const agents = resolveAgentsForTeam(teamId);

    return {
      order: i + 1,
      name: s.name,
      teamId,
      agents,
      requiresReview: s.userApproval,
      description: s.instruction,
      executionMode: 'team-leader' as const,
      teamLeaderId: `${teamId}-leader` as any,
      qualityThreshold: s.qualityGate ? 7 : 5,
      maxTlRetries: 2,
    };
  });

  return {
    id: `pm-plan-${Date.now()}`,
    name: plan.planName,
    description: plan.summary,
    icon: 'fa-diagram-project',
    category: 'custom',
    teams: [],
    steps,
    defaults: {},
    inputs: { requiresSourceImages: false, customFields: [] },
    outputs: { primary: 'mixed', formats: [] },
    requiredTools: [],
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Map a PM's team name to a valid TeamId */
function resolveTeamId(pmTeamId: string): TeamId {
  // Try exact match first
  const team = TEAM_CATALOGUE.find(t => t.id === pmTeamId);
  if (team) return team.id as TeamId;

  // Try fuzzy match (PM might say "research" or "Research" or "research-team")
  const normalized = pmTeamId.toLowerCase().replace(/[\s_-]+team$/i, '').replace(/[\s_]+/g, '-');
  const fuzzy = TEAM_CATALOGUE.find(t => t.id === normalized || t.name.toLowerCase().includes(normalized));
  if (fuzzy) return fuzzy.id as TeamId;

  // Fallback to research (safest default)
  return 'research';
}

/** Get a reasonable set of agents for a team (first 3 for breadth) */
function resolveAgentsForTeam(teamId: TeamId): AgentId[] {
  const team = TEAM_CATALOGUE.find(t => t.id === teamId);
  if (!team) return [];

  // Return up to 3 agents — the PM's instruction will guide which actually runs
  return team.agents.slice(0, 3).map(a => a.id) as AgentId[];
}
