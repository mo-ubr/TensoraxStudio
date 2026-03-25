import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { TemplateConfig, TemplateStep, TeamActivation, AgentId, TeamId } from '../templates/templateConfig';
import {
  getAllTemplates,
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
  getTeamMeta,
  getAgentMeta,
} from '../services/templateService';

/**
 * TemplateConfigFacility — UI for creating, editing, and managing templates.
 *
 * Three views:
 * 1. Template Library (list all templates, built-in + custom)
 * 2. Template Editor (create/edit a template config)
 * 3. Team/Agent browser (visual catalogue of all available teams and agents)
 */

interface TemplateConfigFacilityProps {
  onClose: () => void;
  /** Callback when a template is selected for use */
  onUseTemplate?: (templateId: string) => void;
}

type FacilityView = 'library' | 'editor' | 'agent-browser';

// ─── Helper: generate kebab-case ID from name ───────────────────────────────
function toKebabCase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Sub-component: Agent Chip ──────────────────────────────────────────────
function AgentChip({ agentId, selected, onToggle }: { agentId: AgentId; selected: boolean; onToggle: () => void }) {
  const meta = getAgentMeta(agentId);
  if (!meta) return null;
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${
        selected
          ? 'bg-[#91569c] text-white border-[#91569c] shadow-sm'
          : 'bg-white text-[#888] border-[#e0d6e3] hover:border-[#91569c]/40 hover:text-[#5c3a62]'
      }`}
      title={meta.description}
    >
      <i className={`fa-solid ${meta.icon} text-[9px]`}></i>
      {meta.name}
    </button>
  );
}

// ─── Sub-component: Team Card (for agent browser) ───────────────────────────
function TeamCard({ teamId }: { teamId: TeamId }) {
  const team = getTeamMeta(teamId);
  if (!team) return null;
  return (
    <div className="rounded-xl border border-[#e0d6e3] bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f6f0f8] flex items-center justify-center flex-shrink-0">
          <i className={`fa-solid ${team.icon} text-lg text-[#91569c]`}></i>
        </div>
        <div>
          <h4 className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide">{team.name}</h4>
          <p className="text-[10px] text-[#888]">{team.description}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {team.agents.map(agent => (
          <div key={agent.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f9f7fa] text-[10px]">
            <i className={`fa-solid ${agent.icon} text-[#91569c] w-4 text-center`}></i>
            <span className="font-bold text-[#5c3a62] uppercase tracking-wide">{agent.name}</span>
            <span className="text-[#999] ml-auto">{agent.description.slice(0, 60)}...</span>
          </div>
        ))}
      </div>
      <div className="text-[9px] text-[#aaa] text-right">{team.agents.length} agents</div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TemplateConfigFacility({ onClose, onUseTemplate }: TemplateConfigFacilityProps) {
  const [view, setView] = useState<FacilityView>('library');
  const [editingTemplate, setEditingTemplate] = useState<TemplateConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load templates
  const refreshTemplates = useCallback(() => setTemplates(getAllTemplates()), []);
  useEffect(() => refreshTemplates(), [refreshTemplates]);

  const builtIn = useMemo(() => templates.filter(t => t.builtIn), [templates]);
  const custom = useMemo(() => templates.filter(t => !t.builtIn), [templates]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleNewTemplate = () => {
    setEditingTemplate(createBlankTemplate());
    setIsNew(true);
    setView('editor');
  };

  const handleEditTemplate = (t: TemplateConfig) => {
    if (t.builtIn) {
      showMessage('error', 'Built-in templates cannot be edited directly. Duplicate it first.');
      return;
    }
    setEditingTemplate(JSON.parse(JSON.stringify(t)));
    setIsNew(false);
    setView('editor');
  };

  const handleDuplicate = (t: TemplateConfig) => {
    const newId = `${t.id}-copy-${Date.now().toString(36)}`;
    const newName = `${t.name} (Copy)`;
    try {
      duplicateTemplate(t.id, newId, newName);
      refreshTemplates();
      showMessage('success', `Duplicated as "${newName}"`);
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleDelete = (t: TemplateConfig) => {
    if (t.builtIn) return;
    try {
      deleteTemplate(t.id);
      refreshTemplates();
      showMessage('success', `Deleted "${t.name}"`);
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleExport = (t: TemplateConfig) => {
    const json = exportTemplate(t.id);
    navigator.clipboard.writeText(json);
    showMessage('success', 'Template JSON copied to clipboard');
  };

  const handleImport = () => {
    try {
      const t = importTemplate(importJson);
      refreshTemplates();
      setShowImport(false);
      setImportJson('');
      showMessage('success', `Imported "${t.name}"`);
    } catch (err: any) {
      showMessage('error', `Import failed: ${err.message}`);
    }
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;

    // Auto-generate ID from name if blank
    if (!editingTemplate.id && editingTemplate.name) {
      editingTemplate.id = toKebabCase(editingTemplate.name);
    }

    if (!editingTemplate.id || !editingTemplate.name) {
      showMessage('error', 'Template must have a name');
      return;
    }

    try {
      if (isNew) {
        createTemplate(editingTemplate);
        showMessage('success', `Created "${editingTemplate.name}"`);
      } else {
        updateTemplate(editingTemplate.id, editingTemplate);
        showMessage('success', `Updated "${editingTemplate.name}"`);
      }
      refreshTemplates();
      setView('library');
      setEditingTemplate(null);
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  // ─── Template Editor: toggle agent in a team ─────────────────────────────

  const toggleAgent = (teamId: TeamId, agentId: AgentId) => {
    if (!editingTemplate) return;
    const t = { ...editingTemplate };
    const teamIdx = t.teams.findIndex(ta => ta.teamId === teamId);

    if (teamIdx === -1) {
      // Add new team activation with this agent
      t.teams.push({ teamId, agents: [agentId] });
    } else {
      const team = { ...t.teams[teamIdx] };
      if (team.agents.includes(agentId)) {
        team.agents = team.agents.filter(a => a !== agentId);
        if (team.agents.length === 0) {
          t.teams = t.teams.filter((_, i) => i !== teamIdx);
        } else {
          t.teams[teamIdx] = team;
        }
      } else {
        team.agents = [...team.agents, agentId];
        t.teams[teamIdx] = team;
      }
    }

    setEditingTemplate(t);
  };

  const isAgentActive = (teamId: TeamId, agentId: AgentId): boolean => {
    if (!editingTemplate) return false;
    const team = editingTemplate.teams.find(ta => ta.teamId === teamId);
    return team?.agents.includes(agentId) ?? false;
  };

  // ─── Step management in editor ────────────────────────────────────────────

  const addStep = () => {
    if (!editingTemplate) return;
    const t = { ...editingTemplate };
    const newStep: TemplateStep = {
      order: t.steps.length + 1,
      name: `Step ${t.steps.length + 1}`,
      teamId: 'production',
      agents: [],
      requiresReview: true,
      description: '',
    };
    t.steps = [...t.steps, newStep];
    setEditingTemplate(t);
  };

  const updateStep = (idx: number, updates: Partial<TemplateStep>) => {
    if (!editingTemplate) return;
    const t = { ...editingTemplate };
    t.steps = t.steps.map((s, i) => i === idx ? { ...s, ...updates } : s);
    setEditingTemplate(t);
  };

  const removeStep = (idx: number) => {
    if (!editingTemplate) return;
    const t = { ...editingTemplate };
    t.steps = t.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    setEditingTemplate(t);
  };

  const moveStep = (idx: number, direction: 'up' | 'down') => {
    if (!editingTemplate) return;
    const t = { ...editingTemplate };
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= t.steps.length) return;
    const steps = [...t.steps];
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    t.steps = steps.map((s, i) => ({ ...s, order: i + 1 }));
    setEditingTemplate(t);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-[#edecec] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#e0d6e3] shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-[#888] hover:text-[#5c3a62] transition-colors">
            <i className="fa-solid fa-arrow-left text-lg"></i>
          </button>
          <h1 className="text-lg font-black text-[#5c3a62] uppercase tracking-wide">Template Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('library')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${view === 'library' ? 'bg-[#91569c] text-white' : 'text-[#888] hover:text-[#5c3a62] hover:bg-[#f6f0f8]'}`}
          >
            <i className="fa-solid fa-list mr-1.5"></i>Library
          </button>
          <button
            onClick={() => setView('agent-browser')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${view === 'agent-browser' ? 'bg-[#91569c] text-white' : 'text-[#888] hover:text-[#5c3a62] hover:bg-[#f6f0f8]'}`}
          >
            <i className="fa-solid fa-people-group mr-1.5"></i>Agent Browser
          </button>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Library View ── */}
        {view === 'library' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Actions bar */}
            <div className="flex items-center gap-3">
              <button onClick={handleNewTemplate} className="px-4 py-2 rounded-lg bg-[#91569c] text-white text-xs font-bold uppercase tracking-wide hover:bg-[#7a4785] transition-colors shadow-sm">
                <i className="fa-solid fa-plus mr-1.5"></i>New Template
              </button>
              <button onClick={() => setShowImport(!showImport)} className="px-4 py-2 rounded-lg border border-[#e0d6e3] bg-white text-[#5c3a62] text-xs font-bold uppercase tracking-wide hover:border-[#91569c]/40 transition-colors">
                <i className="fa-solid fa-file-import mr-1.5"></i>Import
              </button>
            </div>

            {/* Import panel */}
            {showImport && (
              <div className="p-4 rounded-xl border border-[#e0d6e3] bg-white space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#5c3a62]">Paste template JSON:</label>
                <textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  className="w-full h-32 px-3 py-2 rounded-lg border border-[#e0d6e3] text-xs font-mono focus:outline-none focus:border-[#91569c]"
                  placeholder='{"id": "my-template", "name": "My Template", ...}'
                />
                <div className="flex gap-2">
                  <button onClick={handleImport} className="px-3 py-1.5 rounded-lg bg-[#91569c] text-white text-[10px] font-bold uppercase">Import</button>
                  <button onClick={() => { setShowImport(false); setImportJson(''); }} className="px-3 py-1.5 rounded-lg border border-[#e0d6e3] text-[10px] font-bold uppercase text-[#888]">Cancel</button>
                </div>
              </div>
            )}

            {/* Built-in templates */}
            <div>
              <h3 className="text-xs font-black text-[#5c3a62] uppercase tracking-wide mb-3">
                <i className="fa-solid fa-cube mr-1.5 text-[#91569c]"></i>Built-in Templates ({builtIn.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {builtIn.map(t => (
                  <TemplateCard key={t.id} template={t} onEdit={handleEditTemplate} onDuplicate={handleDuplicate} onDelete={handleDelete} onExport={handleExport} onUse={onUseTemplate} />
                ))}
              </div>
            </div>

            {/* Custom templates */}
            <div>
              <h3 className="text-xs font-black text-[#5c3a62] uppercase tracking-wide mb-3">
                <i className="fa-solid fa-pen-ruler mr-1.5 text-[#91569c]"></i>Custom Templates ({custom.length})
              </h3>
              {custom.length === 0 ? (
                <div className="text-center py-8 text-[#aaa] text-xs">
                  No custom templates yet. Create one or duplicate a built-in template.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {custom.map(t => (
                    <TemplateCard key={t.id} template={t} onEdit={handleEditTemplate} onDuplicate={handleDuplicate} onDelete={handleDelete} onExport={handleExport} onUse={onUseTemplate} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Editor View ── */}
        {view === 'editor' && editingTemplate && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#5c3a62] uppercase tracking-wide">
                {isNew ? 'Create Template' : `Edit: ${editingTemplate.name}`}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => { setView('library'); setEditingTemplate(null); }} className="px-3 py-1.5 rounded-lg border border-[#e0d6e3] text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62]">Cancel</button>
                <button onClick={handleSaveTemplate} className="px-4 py-1.5 rounded-lg bg-[#91569c] text-white text-[10px] font-bold uppercase hover:bg-[#7a4785] transition-colors">
                  <i className="fa-solid fa-save mr-1.5"></i>Save Template
                </button>
              </div>
            </div>

            {/* ── Basic Info ── */}
            <div className="rounded-xl border border-[#e0d6e3] bg-white p-5 space-y-4">
              <h4 className="text-[10px] font-black text-[#91569c] uppercase tracking-widest">Basic Info</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">Name</label>
                  <input
                    value={editingTemplate.name}
                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value, id: isNew ? toKebabCase(e.target.value) : editingTemplate.id })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e0d6e3] text-sm focus:outline-none focus:border-[#91569c]"
                    placeholder="My Campaign Template"
                  />
                  {isNew && editingTemplate.name && (
                    <span className="text-[9px] text-[#aaa] mt-0.5">ID: {toKebabCase(editingTemplate.name)}</span>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">Category</label>
                  <select
                    value={editingTemplate.category}
                    onChange={e => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e0d6e3] text-sm focus:outline-none focus:border-[#91569c]"
                  >
                    <option value="marketing">Marketing</option>
                    <option value="training">Training</option>
                    <option value="social">Social</option>
                    <option value="live">Live</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">Description</label>
                <textarea
                  value={editingTemplate.description}
                  onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e0d6e3] text-xs focus:outline-none focus:border-[#91569c] h-20"
                  placeholder="Describe what this template produces..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">Icon</label>
                  <input
                    value={editingTemplate.icon}
                    onChange={e => setEditingTemplate({ ...editingTemplate, icon: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e0d6e3] text-xs focus:outline-none focus:border-[#91569c]"
                    placeholder="fa-bullhorn"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">Output Type</label>
                  <select
                    value={editingTemplate.outputs.primary}
                    onChange={e => setEditingTemplate({ ...editingTemplate, outputs: { ...editingTemplate.outputs, primary: e.target.value as any } })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e0d6e3] text-xs focus:outline-none focus:border-[#91569c]"
                  >
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">Aspect Ratio</label>
                  <select
                    value={editingTemplate.defaults?.aspectRatio ?? '16:9'}
                    onChange={e => setEditingTemplate({ ...editingTemplate, defaults: { ...editingTemplate.defaults, aspectRatio: e.target.value as any } })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e0d6e3] text-xs focus:outline-none focus:border-[#91569c]"
                  >
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.outputs.usesShotstack ?? false}
                    onChange={e => setEditingTemplate({ ...editingTemplate, outputs: { ...editingTemplate.outputs, usesShotstack: e.target.checked } })}
                    className="accent-[#91569c]"
                  />
                  Uses Shotstack
                </label>
                <label className="flex items-center gap-2 text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.inputs.requiresBrand ?? false}
                    onChange={e => setEditingTemplate({ ...editingTemplate, inputs: { ...editingTemplate.inputs, requiresBrand: e.target.checked } })}
                    className="accent-[#91569c]"
                  />
                  Requires Brand
                </label>
                <label className="flex items-center gap-2 text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.inputs.requiresBrief ?? false}
                    onChange={e => setEditingTemplate({ ...editingTemplate, inputs: { ...editingTemplate.inputs, requiresBrief: e.target.checked } })}
                    className="accent-[#91569c]"
                  />
                  Requires Brief
                </label>
              </div>
            </div>

            {/* ── Team & Agent Selection ── */}
            <div className="rounded-xl border border-[#e0d6e3] bg-white p-5 space-y-4">
              <h4 className="text-[10px] font-black text-[#91569c] uppercase tracking-widest">Teams & Agents</h4>
              <p className="text-[10px] text-[#888]">Click agents to activate/deactivate them for this template. Active agents are purple.</p>

              {TEAM_CATALOGUE.map(team => {
                const activeCount = team.agents.filter(a => isAgentActive(team.id, a.id)).length;
                return (
                  <div key={team.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <i className={`fa-solid ${team.icon} text-[#91569c] text-xs`}></i>
                      <span className="text-[10px] font-black text-[#5c3a62] uppercase tracking-wide">{team.name}</span>
                      <span className="text-[9px] text-[#aaa]">({activeCount}/{team.agents.length} active)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {team.agents.map(agent => (
                        <AgentChip
                          key={agent.id}
                          agentId={agent.id}
                          selected={isAgentActive(team.id, agent.id)}
                          onToggle={() => toggleAgent(team.id, agent.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Pipeline Steps ── */}
            <div className="rounded-xl border border-[#e0d6e3] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-[#91569c] uppercase tracking-widest">Pipeline Steps</h4>
                <button onClick={addStep} className="px-3 py-1 rounded-lg bg-[#f6f0f8] text-[#91569c] text-[10px] font-bold uppercase hover:bg-[#eadcef] transition-colors">
                  <i className="fa-solid fa-plus mr-1"></i>Add Step
                </button>
              </div>

              {editingTemplate.steps.length === 0 && (
                <p className="text-[10px] text-[#aaa] text-center py-4">No steps yet. Add steps to define the wizard flow.</p>
              )}

              <div className="space-y-3">
                {editingTemplate.steps.map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-[#e0d6e3] p-3 space-y-2 bg-[#fafafa]">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#91569c] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{step.order}</span>
                      <input
                        value={step.name}
                        onChange={e => updateStep(idx, { name: e.target.value })}
                        className="flex-1 px-2 py-1 rounded border border-[#e0d6e3] text-xs font-bold focus:outline-none focus:border-[#91569c]"
                        placeholder="Step name"
                      />
                      <select
                        value={step.teamId}
                        onChange={e => updateStep(idx, { teamId: e.target.value as TeamId })}
                        className="px-2 py-1 rounded border border-[#e0d6e3] text-[10px] focus:outline-none focus:border-[#91569c]"
                      >
                        {TEAM_CATALOGUE.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[9px] text-[#888] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.requiresReview}
                          onChange={e => updateStep(idx, { requiresReview: e.target.checked })}
                          className="accent-[#91569c]"
                        />
                        Review
                      </label>
                      <div className="flex gap-0.5">
                        <button onClick={() => moveStep(idx, 'up')} disabled={idx === 0} className="w-5 h-5 rounded text-[9px] text-[#888] hover:text-[#5c3a62] disabled:opacity-30"><i className="fa-solid fa-chevron-up"></i></button>
                        <button onClick={() => moveStep(idx, 'down')} disabled={idx === editingTemplate.steps.length - 1} className="w-5 h-5 rounded text-[9px] text-[#888] hover:text-[#5c3a62] disabled:opacity-30"><i className="fa-solid fa-chevron-down"></i></button>
                        <button onClick={() => removeStep(idx)} className="w-5 h-5 rounded text-[9px] text-red-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                      </div>
                    </div>
                    <input
                      value={step.description}
                      onChange={e => updateStep(idx, { description: e.target.value })}
                      className="w-full px-2 py-1 rounded border border-[#e0d6e3] text-[10px] text-[#666] focus:outline-none focus:border-[#91569c]"
                      placeholder="What happens in this step..."
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Tags ── */}
            <div className="rounded-xl border border-[#e0d6e3] bg-white p-5 space-y-2">
              <h4 className="text-[10px] font-black text-[#91569c] uppercase tracking-widest">Tags</h4>
              <input
                value={(editingTemplate.tags ?? []).join(', ')}
                onChange={e => setEditingTemplate({ ...editingTemplate, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className="w-full px-3 py-2 rounded-lg border border-[#e0d6e3] text-xs focus:outline-none focus:border-[#91569c]"
                placeholder="marketing, video, campaign (comma-separated)"
              />
            </div>
          </div>
        )}

        {/* ── Agent Browser View ── */}
        {view === 'agent-browser' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-xs text-[#888]">
              Full catalogue of all available teams and agents. These are the building blocks you select when creating templates.
            </p>
            <div className="space-y-4">
              {TEAM_CATALOGUE.map(team => (
                <TeamCard key={team.id} teamId={team.id} />
              ))}
            </div>
            <div className="text-center text-[10px] text-[#aaa] py-4">
              {TEAM_CATALOGUE.length} teams &middot; {ALL_AGENTS.length} agents
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template Card sub-component ─────────────────────────────────────────────

function TemplateCard({
  template: t,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  onUse,
}: {
  template: TemplateConfig;
  onEdit: (t: TemplateConfig) => void;
  onDuplicate: (t: TemplateConfig) => void;
  onDelete: (t: TemplateConfig) => void;
  onExport: (t: TemplateConfig) => void;
  onUse?: (id: string) => void;
}) {
  const teamCount = t.teams.length;
  const agentCount = t.teams.reduce((sum, ta) => sum + ta.agents.length, 0);

  return (
    <div className="rounded-xl border border-[#e0d6e3] bg-white p-4 space-y-3 hover:border-[#91569c]/30 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f6f0f8] flex items-center justify-center flex-shrink-0">
          <i className={`fa-solid ${t.icon} text-lg text-[#91569c]`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide">{t.name}</span>
            {t.builtIn && <span className="text-[8px] font-bold text-[#91569c] bg-[#f6f0f8] px-1.5 py-0.5 rounded-full">BUILT-IN</span>}
            <span className="text-[8px] font-bold text-[#aaa] bg-[#f0f0f0] px-1.5 py-0.5 rounded-full uppercase">{t.category}</span>
          </div>
          <p className="text-[10px] text-[#888] mt-1 line-clamp-2">{t.description}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[9px] text-[#aaa]">
        <span><i className="fa-solid fa-people-group mr-1"></i>{teamCount} teams</span>
        <span><i className="fa-solid fa-robot mr-1"></i>{agentCount} agents</span>
        <span><i className="fa-solid fa-list-ol mr-1"></i>{t.steps.length} steps</span>
        {t.outputs.usesShotstack && <span><i className="fa-solid fa-server mr-1 text-[#91569c]"></i>Shotstack</span>}
      </div>

      {/* Steps preview */}
      <div className="flex flex-wrap gap-1">
        {t.steps.map((s, i) => (
          <span key={i} className="text-[8px] font-bold uppercase tracking-wide text-[#91569c]/70 bg-[#f6f0f8] px-2 py-0.5 rounded-full">{s.name}</span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1">
        {onUse && (
          <button onClick={() => onUse(t.id)} className="px-2.5 py-1 rounded-lg bg-[#91569c] text-white text-[9px] font-bold uppercase hover:bg-[#7a4785] transition-colors">
            <i className="fa-solid fa-play mr-1"></i>Use
          </button>
        )}
        {!t.builtIn && (
          <button onClick={() => onEdit(t)} className="px-2.5 py-1 rounded-lg border border-[#e0d6e3] text-[9px] font-bold uppercase text-[#888] hover:text-[#5c3a62] hover:border-[#91569c]/40 transition-colors">
            <i className="fa-solid fa-pen mr-1"></i>Edit
          </button>
        )}
        <button onClick={() => onDuplicate(t)} className="px-2.5 py-1 rounded-lg border border-[#e0d6e3] text-[9px] font-bold uppercase text-[#888] hover:text-[#5c3a62] hover:border-[#91569c]/40 transition-colors">
          <i className="fa-solid fa-copy mr-1"></i>Duplicate
        </button>
        <button onClick={() => onExport(t)} className="px-2.5 py-1 rounded-lg border border-[#e0d6e3] text-[9px] font-bold uppercase text-[#888] hover:text-[#5c3a62] hover:border-[#91569c]/40 transition-colors">
          <i className="fa-solid fa-file-export mr-1"></i>Export
        </button>
        {!t.builtIn && (
          <button onClick={() => onDelete(t)} className="px-2.5 py-1 rounded-lg border border-red-200 text-[9px] font-bold uppercase text-red-400 hover:text-red-600 hover:border-red-400 transition-colors ml-auto">
            <i className="fa-solid fa-trash mr-1"></i>Delete
          </button>
        )}
      </div>
    </div>
  );
}
