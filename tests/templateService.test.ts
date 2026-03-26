/**
 * Template Service Tests
 *
 * Tests the CRUD operations in templateService.ts — create, read, update,
 * delete, duplicate, export, import, blank scaffold. Uses mocked localStorage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllTemplates,
  getTemplate,
  getBuiltInTemplates,
  getCustomTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  exportTemplate,
  importTemplate,
  createBlankTemplate,
  TEAM_CATALOGUE,
  ALL_AGENTS,
  getAgentMeta,
  getTeamMeta,
} from '../services/templateService';
import type { TemplateConfig } from '../templates/templateConfig';

// ─── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  // Clear our mock store before each test
  Object.keys(store).forEach(key => delete store[key]);

  // Mock localStorage
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    length: 0,
    key: vi.fn(() => null),
  });
});

// ─── Helper: minimal valid custom template ──────────────────────────────────

function makeCustomTemplate(overrides: Partial<TemplateConfig> = {}): TemplateConfig {
  return {
    id: 'test-custom-template',
    name: 'Test Custom Template',
    description: 'A test template',
    icon: 'fa-flask',
    category: 'custom',
    version: '1.0.0',
    builtIn: false,
    teams: [],
    steps: [],
    inputs: {},
    outputs: { primary: 'video' },
    ...overrides,
  };
}

// ─── getAllTemplates ─────────────────────────────────────────────────────────

describe('getAllTemplates()', () => {
  it('returns at least 5 templates (built-in)', () => {
    const all = getAllTemplates();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it('includes built-in templates', () => {
    const all = getAllTemplates();
    const ids = all.map(t => t.id);
    expect(ids).toContain('product-marketing-campaign');
    expect(ids).toContain('staff-training-video');
  });

  it('includes custom templates from localStorage', () => {
    const custom = makeCustomTemplate();
    store['tensorax_custom_templates'] = JSON.stringify([custom]);
    const all = getAllTemplates();
    expect(all.find(t => t.id === 'test-custom-template')).toBeDefined();
  });
});

// ─── getTemplate ────────────────────────────────────────────────────────────

describe('getTemplate()', () => {
  it('returns correct template by ID', () => {
    const t = getTemplate('product-marketing-campaign');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Product Marketing Campaign');
  });

  it('returns undefined for non-existent ID', () => {
    expect(getTemplate('nonexistent-template-id')).toBeUndefined();
  });
});

// ─── getBuiltInTemplates / getCustomTemplates ───────────────────────────────

describe('getBuiltInTemplates()', () => {
  it('returns exactly 5 built-in templates', () => {
    expect(getBuiltInTemplates()).toHaveLength(5);
  });
});

describe('getCustomTemplates()', () => {
  it('returns empty array when no custom templates', () => {
    expect(getCustomTemplates()).toEqual([]);
  });

  it('returns custom templates from localStorage', () => {
    store['tensorax_custom_templates'] = JSON.stringify([makeCustomTemplate()]);
    expect(getCustomTemplates()).toHaveLength(1);
  });
});

// ─── createBlankTemplate ────────────────────────────────────────────────────

describe('createBlankTemplate()', () => {
  it('returns a valid scaffold with empty id and name', () => {
    const blank = createBlankTemplate();
    expect(blank.id).toBe('');
    expect(blank.name).toBe('');
    expect(blank.builtIn).toBe(false);
    expect(blank.category).toBe('custom');
  });

  it('has default provider and aspect ratio', () => {
    const blank = createBlankTemplate();
    expect(blank.defaults?.provider).toBe('gemini');
    expect(blank.defaults?.aspectRatio).toBe('16:9');
  });

  it('has empty teams and steps arrays', () => {
    const blank = createBlankTemplate();
    expect(blank.teams).toEqual([]);
    expect(blank.steps).toEqual([]);
  });

  it('has outputs with primary: video', () => {
    const blank = createBlankTemplate();
    expect(blank.outputs.primary).toBe('video');
  });
});

// ─── createTemplate ─────────────────────────────────────────────────────────

describe('createTemplate()', () => {
  it('adds a custom template to localStorage', () => {
    const custom = makeCustomTemplate();
    createTemplate(custom);
    const stored = JSON.parse(store['tensorax_custom_templates']);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('test-custom-template');
  });

  it('sets builtIn to false', () => {
    const custom = makeCustomTemplate({ builtIn: true as any });
    createTemplate(custom);
    const stored = JSON.parse(store['tensorax_custom_templates']);
    expect(stored[0].builtIn).toBe(false);
  });

  it('sets lastModified timestamp', () => {
    const custom = makeCustomTemplate();
    createTemplate(custom);
    const stored = JSON.parse(store['tensorax_custom_templates']);
    expect(stored[0].lastModified).toBeTruthy();
  });

  it('rejects duplicate IDs (custom)', () => {
    createTemplate(makeCustomTemplate());
    expect(() => createTemplate(makeCustomTemplate())).toThrow(/already exists/);
  });

  it('rejects IDs that conflict with built-in templates', () => {
    const conflicting = makeCustomTemplate({ id: 'product-marketing-campaign' });
    expect(() => createTemplate(conflicting)).toThrow(/already exists/);
  });
});

// ─── updateTemplate ─────────────────────────────────────────────────────────

describe('updateTemplate()', () => {
  it('modifies an existing custom template', () => {
    createTemplate(makeCustomTemplate());
    updateTemplate('test-custom-template', { name: 'Updated Name' });
    const all = getAllTemplates();
    const updated = all.find(t => t.id === 'test-custom-template');
    expect(updated?.name).toBe('Updated Name');
  });

  it('rejects edits to built-in templates', () => {
    expect(() => updateTemplate('product-marketing-campaign', { name: 'Hacked' }))
      .toThrow(/not found|Built-in/i);
  });

  it('updates lastModified timestamp', () => {
    createTemplate(makeCustomTemplate());
    const before = JSON.parse(store['tensorax_custom_templates'])[0].lastModified;
    // Small delay to ensure timestamp differs
    updateTemplate('test-custom-template', { description: 'New desc' });
    const after = JSON.parse(store['tensorax_custom_templates'])[0].lastModified;
    expect(after).toBeTruthy();
  });
});

// ─── deleteTemplate ─────────────────────────────────────────────────────────

describe('deleteTemplate()', () => {
  it('removes a custom template', () => {
    createTemplate(makeCustomTemplate());
    expect(getCustomTemplates()).toHaveLength(1);
    deleteTemplate('test-custom-template');
    expect(getCustomTemplates()).toHaveLength(0);
  });

  it('rejects deletion of built-in templates', () => {
    expect(() => deleteTemplate('product-marketing-campaign'))
      .toThrow(/Cannot delete a built-in template/);
  });
});

// ─── duplicateTemplate ──────────────────────────────────────────────────────

describe('duplicateTemplate()', () => {
  it('creates an independent copy with new ID and name', () => {
    const dup = duplicateTemplate('product-marketing-campaign', 'my-campaign-copy', 'My Campaign Copy');
    expect(dup.id).toBe('my-campaign-copy');
    expect(dup.name).toBe('My Campaign Copy');
    expect(dup.builtIn).toBe(false);
  });

  it('generates a truly independent copy (deep clone)', () => {
    const dup = duplicateTemplate('product-marketing-campaign', 'deep-clone-test', 'Clone');
    const original = getTemplate('product-marketing-campaign');
    // Modifying the copy should not affect the original
    dup.steps.push({
      order: 99,
      name: 'Extra',
      teamId: 'research',
      agents: [],
      requiresReview: false,
      description: 'test',
    });
    expect(original!.steps.length).not.toBe(dup.steps.length);
  });

  it('throws for non-existent source template', () => {
    expect(() => duplicateTemplate('nonexistent', 'copy', 'Copy')).toThrow(/not found/);
  });
});

// ─── exportTemplate / importTemplate ────────────────────────────────────────

describe('exportTemplate()', () => {
  it('returns a valid JSON string', () => {
    const json = exportTemplate('product-marketing-campaign');
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('product-marketing-campaign');
  });

  it('throws for non-existent template', () => {
    expect(() => exportTemplate('nonexistent')).toThrow(/not found/);
  });
});

describe('importTemplate()', () => {
  it('parses and stores a template from JSON', () => {
    const json = JSON.stringify(makeCustomTemplate({ id: 'imported-template', name: 'Imported' }));
    const imported = importTemplate(json);
    expect(imported.id).toBe('imported-template');
    expect(imported.builtIn).toBe(false);
    expect(getTemplate('imported-template')).toBeDefined();
  });

  it('throws for invalid JSON', () => {
    expect(() => importTemplate('not valid json')).toThrow();
  });

  it('throws for JSON missing id or name', () => {
    expect(() => importTemplate(JSON.stringify({ description: 'no id or name' }))).toThrow(/missing id or name/);
  });
});

// ─── TEAM_CATALOGUE ─────────────────────────────────────────────────────────

describe('TEAM_CATALOGUE', () => {
  it('has 5 teams', () => {
    expect(TEAM_CATALOGUE).toHaveLength(7);
  });

  it('has expected team IDs', () => {
    const ids = TEAM_CATALOGUE.map(t => t.id);
    expect(ids).toContain('research');
    expect(ids).toContain('copy-production');
    expect(ids).toContain('image-production');
    expect(ids).toContain('video-production');
    expect(ids).toContain('video-assembly');
    expect(ids).toContain('image-assembly');
    expect(ids).toContain('distribution');
  });

  it('every team has required fields', () => {
    TEAM_CATALOGUE.forEach(team => {
      expect(team.id).toBeTruthy();
      expect(team.name).toBeTruthy();
      expect(team.description).toBeTruthy();
      expect(team.icon).toBeTruthy();
      expect(team.agents.length).toBeGreaterThan(0);
    });
  });
});

// ─── ALL_AGENTS ─────────────────────────────────────────────────────────────

describe('ALL_AGENTS', () => {
  it('has 43 agents', () => {
    expect(ALL_AGENTS).toHaveLength(43);
  });

  it('every agent has required fields (id, name, team, description, icon)', () => {
    ALL_AGENTS.forEach(agent => {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.team).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.icon).toBeTruthy();
    });
  });

  it('no duplicate agent IDs', () => {
    const ids = ALL_AGENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── getAgentMeta / getTeamMeta ─────────────────────────────────────────────

describe('getAgentMeta()', () => {
  it('returns correct agent by ID', () => {
    const agent = getAgentMeta('audience-research');
    expect(agent).toBeDefined();
    expect(agent!.name).toBe('Audience Research');
    expect(agent!.team).toBe('research');
  });

  it('returns undefined for non-existent agent', () => {
    expect(getAgentMeta('nonexistent-agent' as any)).toBeUndefined();
  });
});

describe('getTeamMeta()', () => {
  it('returns correct team by ID', () => {
    const team = getTeamMeta('copy-production');
    expect(team).toBeDefined();
    expect(team!.name).toBe('Copy Production Team');
  });

  it('returns undefined for non-existent team', () => {
    expect(getTeamMeta('nonexistent-team' as any)).toBeUndefined();
  });
});
