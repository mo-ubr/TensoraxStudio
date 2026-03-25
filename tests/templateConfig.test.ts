/**
 * Template Configuration Tests
 *
 * Validates the built-in template configs: structure, types,
 * referential integrity (agents exist in catalogue), step ordering,
 * and naming conventions.
 */

import { describe, it, expect } from 'vitest';
import { BUILT_IN_TEMPLATES } from '../templates/builtInTemplates';
import type { TemplateConfig, TeamId, AgentId } from '../templates/templateConfig';
import { TEAM_CATALOGUE, ALL_AGENTS } from '../services/templateService';

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['marketing', 'training', 'social', 'live', 'custom'];
const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ALL_TEAM_IDS: TeamId[] = ['research', 'production', 'video-assembly', 'image-assembly', 'distribution'];
const ALL_AGENT_IDS: AgentId[] = ALL_AGENTS.map(a => a.id);

// ─── Helpers ────────────────────────────────────────────────────────────────

function allAgentsInSteps(template: TemplateConfig): AgentId[] {
  return template.steps.flatMap(s => s.agents);
}

function allAgentsInTeams(template: TemplateConfig): AgentId[] {
  return template.teams.flatMap(t => t.agents);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Built-in Templates — Existence & Count', () => {
  it('should have exactly 5 built-in templates', () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(5);
  });

  it('should contain the expected template IDs', () => {
    const ids = BUILT_IN_TEMPLATES.map(t => t.id);
    expect(ids).toContain('what-if-transformation');
    expect(ids).toContain('video-from-keyframes');
    expect(ids).toContain('staff-training-video');
    expect(ids).toContain('product-marketing-campaign');
    expect(ids).toContain('live-shopping-channel');
  });
});

describe('Built-in Templates — Required Fields', () => {
  BUILT_IN_TEMPLATES.forEach(template => {
    describe(`Template: ${template.name}`, () => {
      it('has an id', () => {
        expect(template.id).toBeTruthy();
        expect(typeof template.id).toBe('string');
      });

      it('has a name', () => {
        expect(template.name).toBeTruthy();
        expect(typeof template.name).toBe('string');
      });

      it('has a description', () => {
        expect(template.description).toBeTruthy();
        expect(typeof template.description).toBe('string');
      });

      it('has an icon', () => {
        expect(template.icon).toBeTruthy();
        expect(template.icon).toMatch(/^fa-/);
      });

      it('has a valid category', () => {
        expect(VALID_CATEGORIES).toContain(template.category);
      });

      it('has a version string', () => {
        expect(template.version).toBeTruthy();
        expect(template.version).toMatch(/^\d+\.\d+\.\d+$/);
      });

      it('has builtIn set to true', () => {
        expect(template.builtIn).toBe(true);
      });
    });
  });
});

describe('Built-in Templates — Team Activations', () => {
  BUILT_IN_TEMPLATES.forEach(template => {
    describe(`Template: ${template.name}`, () => {
      it('has at least 1 team activation', () => {
        expect(template.teams.length).toBeGreaterThanOrEqual(1);
      });

      it('all teamIds are valid TeamId values', () => {
        template.teams.forEach(team => {
          expect(ALL_TEAM_IDS).toContain(team.teamId);
        });
      });

      it('all agents in team activations exist in TEAM_CATALOGUE', () => {
        template.teams.forEach(team => {
          team.agents.forEach(agentId => {
            expect(ALL_AGENT_IDS).toContain(agentId);
          });
        });
      });

      it('every agent belongs to the correct team in TEAM_CATALOGUE', () => {
        template.teams.forEach(teamActivation => {
          const catalogueTeam = TEAM_CATALOGUE.find(t => t.id === teamActivation.teamId);
          expect(catalogueTeam).toBeDefined();
          const catalogueAgentIds = catalogueTeam!.agents.map(a => a.id);
          teamActivation.agents.forEach(agentId => {
            expect(catalogueAgentIds).toContain(agentId);
          });
        });
      });
    });
  });
});

describe('Built-in Templates — Pipeline Steps', () => {
  BUILT_IN_TEMPLATES.forEach(template => {
    describe(`Template: ${template.name}`, () => {
      it('has at least 1 step', () => {
        expect(template.steps.length).toBeGreaterThanOrEqual(1);
      });

      it('step orders are sequential starting from 1', () => {
        const orders = template.steps.map(s => s.order);
        for (let i = 0; i < orders.length; i++) {
          expect(orders[i]).toBe(i + 1);
        }
      });

      it('no duplicate step names', () => {
        const names = template.steps.map(s => s.name);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(names.length);
      });

      it('every step has a valid teamId', () => {
        template.steps.forEach(step => {
          expect(ALL_TEAM_IDS).toContain(step.teamId);
        });
      });

      it('every step teamId matches a team in the template teams array', () => {
        const templateTeamIds = template.teams.map(t => t.teamId);
        template.steps.forEach(step => {
          // Steps with no agents (e.g. Settings/Upload) can reference a team for UI grouping
          // but the team doesn't need to be in the teams array if agents are empty
          if (step.agents.length > 0) {
            expect(templateTeamIds).toContain(step.teamId);
          }
        });
      });

      it('every agent in a step exists in its team activation agents list', () => {
        template.steps.forEach(step => {
          if (step.agents.length === 0) return; // skip setup steps
          const teamActivation = template.teams.find(t => t.teamId === step.teamId);
          expect(teamActivation).toBeDefined();
          const teamAgents = teamActivation!.agents;
          step.agents.forEach(agentId => {
            expect(teamAgents).toContain(agentId);
          });
        });
      });

      it('every agent in a step exists in TEAM_CATALOGUE', () => {
        template.steps.forEach(step => {
          step.agents.forEach(agentId => {
            expect(ALL_AGENT_IDS).toContain(agentId);
          });
        });
      });

      it('every step has a description', () => {
        template.steps.forEach(step => {
          expect(step.description).toBeTruthy();
        });
      });

      it('requiresReview is a boolean on every step', () => {
        template.steps.forEach(step => {
          expect(typeof step.requiresReview).toBe('boolean');
        });
      });
    });
  });
});

describe('Built-in Templates — ID Format', () => {
  BUILT_IN_TEMPLATES.forEach(template => {
    it(`"${template.id}" is kebab-case`, () => {
      expect(template.id).toMatch(KEBAB_CASE_RE);
    });
  });
});

describe('Built-in Templates — Inputs & Outputs', () => {
  BUILT_IN_TEMPLATES.forEach(template => {
    describe(`Template: ${template.name}`, () => {
      it('has an inputs object', () => {
        expect(template.inputs).toBeDefined();
        expect(typeof template.inputs).toBe('object');
      });

      it('has an outputs object with a primary field', () => {
        expect(template.outputs).toBeDefined();
        expect(['video', 'image', 'mixed']).toContain(template.outputs.primary);
      });
    });
  });
});

describe('Built-in Templates — No Duplicate IDs', () => {
  it('all template IDs are unique', () => {
    const ids = BUILT_IN_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
