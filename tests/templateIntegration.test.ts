/**
 * Template Integration Tests
 *
 * Cross-cutting concerns: built-in template agent IDs match the catalogue,
 * no orphan agents/teams, prompt files exist, orchestrator files exist,
 * and template-specific business rules.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { BUILT_IN_TEMPLATES } from '../templates/builtInTemplates';
import { TEAM_CATALOGUE, ALL_AGENTS } from '../services/templateService';
import type { AgentId, TeamId } from '../templates/templateConfig';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '..');

function getTemplateById(id: string) {
  return BUILT_IN_TEMPLATES.find(t => t.id === id)!;
}

/** Collect all unique agent IDs referenced across all built-in templates */
function allReferencedAgentIds(): Set<AgentId> {
  const ids = new Set<AgentId>();
  BUILT_IN_TEMPLATES.forEach(t => {
    t.teams.forEach(team => team.agents.forEach(a => ids.add(a)));
    t.steps.forEach(step => step.agents.forEach(a => ids.add(a)));
  });
  return ids;
}

/** Collect all unique team IDs referenced across all built-in templates */
function allReferencedTeamIds(): Set<TeamId> {
  const ids = new Set<TeamId>();
  BUILT_IN_TEMPLATES.forEach(t => {
    t.teams.forEach(team => ids.add(team.teamId));
    t.steps.forEach(step => ids.add(step.teamId));
  });
  return ids;
}

// ─── Agent-to-catalogue mapping per agent ID ────────────────────────────────
// This maps every agent ID in the catalogue to the prompt file that should exist.
// Some agents are "service" agents (e.g. shotstack-render, music-generation)
// that don't have prompt files — they're handled by service integrations.

const AGENT_PROMPT_MAP: Record<string, string | null> = {
  // Research
  'audience-research':             'prompts/research/audienceResearchAgent.ts',
  'brand-voice-research':          'prompts/research/brandVoiceResearchAgent.ts',
  'competitive-trend-research':    'prompts/research/competitiveTrendResearchAgent.ts',
  'social-media-trend-research':   'prompts/research/socialMediaTrendResearchAgent.ts',
  'deep-research':                 null, // no prompt file yet — web research agent
  'general-analysis':              null, // uses geminiService.analyzeVideo directly
  // Production — Creative Director
  'creative-director':             null, // orchestration role, no single prompt
  'concept-creation':              'prompts/concept/conceptFromBriefAgent.ts',
  'screenplay':                    'prompts/concept/screenplayAgent.ts',
  // Production — Asset Producers
  'copywriter':                    'prompts/copyAgent.ts',
  'tagline':                       'prompts/concept/taglineAgent.ts',
  'social-copy':                   'prompts/concept/socialCopyAgent.ts',
  'image-producer':                'prompts/character/imageAgent.ts',
  'character-builder':             null, // UI component, not a prompt
  'character-frames':              'prompts/character/characterFrameAgent.ts',
  'character-variations':          'prompts/character/characterVariationAgent.ts',
  'video-producer':                'prompts/Video/videoAgent.ts',
  'video-from-keyframes':          'prompts/Video/videoFromKeyframesAgent.ts',
  'video-from-prompt':             'prompts/Video/videoFromPromptAgent.ts',
  'video-from-start-image':        'prompts/Video/videoFromStartImageAgent.ts',
  'video-from-motion-reference':   'prompts/Video/videoFromMotionReferenceAgent.ts',
  'video-stitching':               'prompts/Video/videoStitchingAgent.ts',
  'music-generation':              null, // service integration (Suno/Udio), no prompt
  'qa-consistency':                'prompts/qa/qaConsistencyAgent.ts',
  // Video Assembly
  'text-overlay':                  'prompts/Composition/textOverlayAgent.ts',
  'music-direction':               'prompts/Composition/musicDirectionAgent.ts',
  'caption':                       'prompts/Composition/captionAgent.ts',
  'composition':                   'prompts/Composition/compositionAgent.ts',
  'shotstack-render':              null, // API service, no prompt
  'video-editing':                 'prompts/editing/videoEditingAgent.ts',
  'voiceover':                     'prompts/editing/voiceoverAgent.ts',
  'sound-sync':                    'prompts/editing/soundSyncAgent.ts',
  'translator':                    'prompts/localisation/translatorAgent.ts',
  'cultural-reviewer':             'prompts/localisation/culturalReviewerAgent.ts',
  'subtitles-hooks':               'prompts/editing/subtitlesHooksAgent.ts',
  'thumbnail':                     'prompts/editing/thumbnailAgent.ts',
  'video-assembly-reviewer':       'prompts/editing/videoAssemblyReviewerAgent.ts',
  // Image Assembly
  'image-frame-adjustments':       'prompts/imageAssembly/imageFrameAdjustmentsAgent.ts',
  'image-copy-research':           'prompts/imageAssembly/imageCopyResearchAgent.ts',
  'image-assembly':                'prompts/imageAssembly/imageAssemblyAgent.ts',
  'image-assembly-reviewer':       'prompts/imageAssembly/imageAssemblyReviewerAgent.ts',
  // Distribution
  'posting':                       'prompts/distribution/postingAgent.ts',
  'scheduling':                    'prompts/distribution/schedulingAgent.ts',
};

// Orchestrator files per team
const TEAM_ORCHESTRATOR_MAP: Record<TeamId, string> = {
  'research':         'services/orchestrators/researchOrchestrator.ts',
  'production':       'services/orchestrators/conceptOrchestrator.ts',
  'video-assembly':   'services/orchestrators/compositionOrchestrator.ts',
  'image-assembly':   'services/orchestrators/imageAssemblyOrchestrator.ts',
  'distribution':     'services/orchestrators/distributionOrchestrator.ts',
};

// ─── Referential Integrity ──────────────────────────────────────────────────

describe('Referential Integrity — Templates to Catalogue', () => {
  it('all agent IDs referenced in built-in templates exist in TEAM_CATALOGUE', () => {
    const catalogueAgentIds = new Set(ALL_AGENTS.map(a => a.id));
    const referenced = allReferencedAgentIds();
    referenced.forEach(agentId => {
      expect(catalogueAgentIds.has(agentId)).toBe(true);
    });
  });

  it('all team IDs referenced in built-in templates exist in TEAM_CATALOGUE', () => {
    const catalogueTeamIds = new Set(TEAM_CATALOGUE.map(t => t.id));
    const referenced = allReferencedTeamIds();
    referenced.forEach(teamId => {
      expect(catalogueTeamIds.has(teamId)).toBe(true);
    });
  });
});

describe('Referential Integrity — No Orphan Agents', () => {
  it('every agent ID in TEAM_CATALOGUE maps to a valid AgentId type', () => {
    // This is implicitly typed, but we verify the IDs are sane
    ALL_AGENTS.forEach(agent => {
      expect(agent.id).toBeTruthy();
      expect(typeof agent.id).toBe('string');
    });
  });

  it('every agent in TEAM_CATALOGUE belongs to a team that exists', () => {
    const teamIds = new Set(TEAM_CATALOGUE.map(t => t.id));
    ALL_AGENTS.forEach(agent => {
      expect(teamIds.has(agent.team)).toBe(true);
    });
  });
});

describe('Referential Integrity — Template -> Team -> Agent chain', () => {
  BUILT_IN_TEMPLATES.forEach(template => {
    it(`${template.name}: complete chain is valid`, () => {
      template.teams.forEach(teamActivation => {
        // Team exists in catalogue
        const catalogueTeam = TEAM_CATALOGUE.find(t => t.id === teamActivation.teamId);
        expect(catalogueTeam).toBeDefined();

        // Each activated agent exists in that catalogue team
        const catalogueAgentIds = catalogueTeam!.agents.map(a => a.id);
        teamActivation.agents.forEach(agentId => {
          expect(catalogueAgentIds).toContain(agentId);
        });
      });
    });
  });
});

// ─── Prompt File Existence ──────────────────────────────────────────────────

describe('Prompt File Existence', () => {
  const agentsWithPrompts = Object.entries(AGENT_PROMPT_MAP).filter(([, path]) => path !== null);

  agentsWithPrompts.forEach(([agentId, promptPath]) => {
    it(`agent "${agentId}" has prompt file at ${promptPath}`, () => {
      const fullPath = resolve(ROOT, promptPath!);
      expect(existsSync(fullPath)).toBe(true);
    });
  });
});

// ─── Orchestrator File Existence ────────────────────────────────────────────

describe('Orchestrator File Existence', () => {
  Object.entries(TEAM_ORCHESTRATOR_MAP).forEach(([teamId, orchPath]) => {
    it(`team "${teamId}" has orchestrator file at ${orchPath}`, () => {
      const fullPath = resolve(ROOT, orchPath);
      expect(existsSync(fullPath)).toBe(true);
    });
  });
});

// ─── Template-Specific Business Rules ───────────────────────────────────────

describe('Product Marketing Campaign — uses all 5 teams', () => {
  const pmc = getTemplateById('product-marketing-campaign');

  it('has 5 team activations', () => {
    expect(pmc.teams).toHaveLength(5);
  });

  it('activates research team', () => {
    expect(pmc.teams.find(t => t.teamId === 'research')).toBeDefined();
  });

  it('activates production team', () => {
    expect(pmc.teams.find(t => t.teamId === 'production')).toBeDefined();
  });

  it('activates video-assembly team', () => {
    expect(pmc.teams.find(t => t.teamId === 'video-assembly')).toBeDefined();
  });

  it('activates image-assembly team', () => {
    expect(pmc.teams.find(t => t.teamId === 'image-assembly')).toBeDefined();
  });

  it('activates distribution team', () => {
    expect(pmc.teams.find(t => t.teamId === 'distribution')).toBeDefined();
  });
});

describe('Staff Training Video — includes localisation agents', () => {
  const stv = getTemplateById('staff-training-video');

  it('includes translator agent', () => {
    const videoAssembly = stv.teams.find(t => t.teamId === 'video-assembly');
    expect(videoAssembly).toBeDefined();
    expect(videoAssembly!.agents).toContain('translator');
  });

  it('includes cultural-reviewer agent', () => {
    const videoAssembly = stv.teams.find(t => t.teamId === 'video-assembly');
    expect(videoAssembly!.agents).toContain('cultural-reviewer');
  });

  it('includes subtitles-hooks agent', () => {
    const videoAssembly = stv.teams.find(t => t.teamId === 'video-assembly');
    expect(videoAssembly!.agents).toContain('subtitles-hooks');
  });
});

describe('What If? Transformation — includes research team with general-analysis', () => {
  const wit = getTemplateById('what-if-transformation');

  it('has research team activated', () => {
    const research = wit.teams.find(t => t.teamId === 'research');
    expect(research).toBeDefined();
  });

  it('research team includes general-analysis agent', () => {
    const research = wit.teams.find(t => t.teamId === 'research');
    expect(research!.agents).toContain('general-analysis');
  });
});

describe('Video from Keyframes — includes video-stitching in step 2', () => {
  const vfk = getTemplateById('video-from-keyframes');

  it('step 2 includes video-stitching agent', () => {
    const step2 = vfk.steps.find(s => s.order === 2);
    expect(step2).toBeDefined();
    expect(step2!.agents).toContain('video-stitching');
  });

  it('step 2 includes video-from-keyframes agent', () => {
    const step2 = vfk.steps.find(s => s.order === 2);
    expect(step2!.agents).toContain('video-from-keyframes');
  });
});

describe('Live Shopping Channel — includes distribution team', () => {
  const lsc = getTemplateById('live-shopping-channel');

  it('has distribution team activated', () => {
    const dist = lsc.teams.find(t => t.teamId === 'distribution');
    expect(dist).toBeDefined();
  });

  it('distribution team includes posting agent', () => {
    const dist = lsc.teams.find(t => t.teamId === 'distribution');
    expect(dist!.agents).toContain('posting');
  });

  it('distribution team includes scheduling agent', () => {
    const dist = lsc.teams.find(t => t.teamId === 'distribution');
    expect(dist!.agents).toContain('scheduling');
  });

  it('has a step for distribution/go-live', () => {
    const distStep = lsc.steps.find(s => s.teamId === 'distribution');
    expect(distStep).toBeDefined();
  });
});
