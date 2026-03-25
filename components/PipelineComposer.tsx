/**
 * PipelineComposer — Interactive plan-review UI
 *
 * Rendered inline within the MasterOrchestrator chat when the model
 * proposes a pipeline via [ACTION:SHOW_PIPELINE:...]. Users can
 * approve, modify steps, or cancel before execution.
 */

import React, { useState, useCallback } from 'react';
import type { PipelinePlan, PipelinePlanStep } from '../services/orchestratorService';
import { getAgentMeta, getTeamMeta, TEAM_CATALOGUE, type AgentMeta } from '../services/templateService';
import type { AgentId, TeamId } from '../templates/templateConfig';

interface PipelineComposerProps {
  plan: PipelinePlan;
  onApprove: (plan: PipelinePlan) => void;
  onModify: (plan: PipelinePlan) => void;
  onCancel: () => void;
  executing?: boolean;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: PipelinePlanStep['status'] }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-[#f0f0f0]', text: 'text-[#888]', label: 'PENDING' },
    running: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', label: 'RUNNING' },
    completed: { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]', label: 'DONE' },
    failed: { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', label: 'FAILED' },
    skipped: { bg: 'bg-[#f3f4f6]', text: 'text-[#6b7280]', label: 'SKIPPED' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`${c.bg} ${c.text} text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full`}>
      {status === 'running' && <i className="fa-solid fa-spinner fa-spin mr-1 text-[7px]" />}
      {c.label}
    </span>
  );
};

// ─── Agent Picker (for adding steps) ─────────────────────────────────────────

const AgentPicker: React.FC<{ onSelect: (agentId: AgentId, teamId: TeamId) => void; onClose: () => void }> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = TEAM_CATALOGUE.flatMap(team =>
    team.agents
      .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase()))
      .map(a => ({ ...a, teamId: team.id as TeamId, teamName: team.name }))
  );

  return (
    <div className="border border-[#e0d6e3] rounded-xl bg-white p-3 mt-2 shadow-lg max-h-60 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="flex-1 text-xs px-2 py-1.5 border border-[#e0d6e3] rounded-lg focus:outline-none focus:border-[#91569c]"
          autoFocus
        />
        <button onClick={onClose} className="text-[#888] hover:text-[#5c3a62] text-xs">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      {filtered.map(a => (
        <button
          key={a.id}
          onClick={() => onSelect(a.id as AgentId, a.teamId)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f6f0f8] text-left text-[10px] transition-colors"
        >
          <i className={`fa-solid ${a.icon} text-[#91569c] w-4 text-center`} />
          <span className="font-bold text-[#5c3a62] uppercase tracking-wide">{a.name}</span>
          <span className="text-[#aaa] ml-auto text-[9px]">{a.teamName}</span>
        </button>
      ))}
      {filtered.length === 0 && (
        <p className="text-[10px] text-[#aaa] text-center py-2">No agents found</p>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const PipelineComposer: React.FC<PipelineComposerProps> = ({ plan, onApprove, onModify, onCancel, executing }) => {
  const [editedPlan, setEditedPlan] = useState<PipelinePlan>({ ...plan, steps: [...plan.steps] });
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  const moveStep = useCallback((idx: number, direction: -1 | 1) => {
    const newSteps = [...editedPlan.steps];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= newSteps.length) return;
    [newSteps[idx], newSteps[targetIdx]] = [newSteps[targetIdx], newSteps[idx]];
    // Renumber
    newSteps.forEach((s, i) => s.order = i + 1);
    setEditedPlan({ ...editedPlan, steps: newSteps });
  }, [editedPlan]);

  const removeStep = useCallback((idx: number) => {
    const newSteps = editedPlan.steps.filter((_, i) => i !== idx);
    newSteps.forEach((s, i) => s.order = i + 1);
    setEditedPlan({ ...editedPlan, steps: newSteps });
  }, [editedPlan]);

  const addStep = useCallback((agentId: AgentId, teamId: TeamId) => {
    const agent = getAgentMeta(agentId);
    const newStep: PipelinePlanStep = {
      order: editedPlan.steps.length + 1,
      name: agent?.name || agentId,
      agentId,
      teamId,
      description: agent?.description || '',
      requiresReview: true,
      status: 'pending',
    };
    setEditedPlan({ ...editedPlan, steps: [...editedPlan.steps, newStep] });
    setShowAgentPicker(false);
  }, [editedPlan]);

  const toggleReview = useCallback((idx: number) => {
    const newSteps = [...editedPlan.steps];
    newSteps[idx] = { ...newSteps[idx], requiresReview: !newSteps[idx].requiresReview };
    setEditedPlan({ ...editedPlan, steps: newSteps });
  }, [editedPlan]);

  const hasChanges = JSON.stringify(editedPlan.steps) !== JSON.stringify(plan.steps);

  return (
    <div className="border border-[#e0d6e3] rounded-xl bg-white overflow-hidden my-3">
      {/* Header */}
      <div className="px-4 py-3 bg-[#f6f0f8] border-b border-[#e0d6e3] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-list-check text-[#91569c]" />
          <span className="text-xs font-black uppercase tracking-wider text-[#5c3a62]">
            {executing ? 'Pipeline Running' : 'Proposed Pipeline'}
          </span>
          <span className="text-[9px] text-[#aaa]">{editedPlan.steps.length} steps</span>
        </div>
        {editedPlan.estimatedDuration && (
          <span className="text-[9px] text-[#888]">
            <i className="fa-solid fa-clock mr-1" />{editedPlan.estimatedDuration}
          </span>
        )}
      </div>

      {/* Step List */}
      <div className="divide-y divide-[#f0eff0]">
        {editedPlan.steps.map((step, idx) => {
          const agent = getAgentMeta(step.agentId);
          const team = getTeamMeta(step.teamId);
          return (
            <div key={`${step.order}-${step.agentId}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[#faf9fb] transition-colors">
              {/* Step number */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                step.status === 'completed' ? 'bg-[#d1fae5] text-[#065f46]' :
                step.status === 'running' ? 'bg-[#fef3c7] text-[#92400e]' :
                'bg-[#f0f0f0] text-[#888]'
              }`}>
                {step.status === 'completed' ? <i className="fa-solid fa-check text-[8px]" /> : step.order}
              </div>

              {/* Agent info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {agent && <i className={`fa-solid ${agent.icon} text-[#91569c] text-[10px]`} />}
                  <span className="text-[11px] font-bold text-[#5c3a62] uppercase tracking-wide">{step.name}</span>
                  {team && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#f6f0f8] text-[#91569c] font-bold uppercase tracking-wider">
                      {team.name.replace(' Team', '')}
                    </span>
                  )}
                  <StatusBadge status={step.status} />
                </div>
                <p className="text-[9px] text-[#999] mt-0.5 truncate">{step.description}</p>
              </div>

              {/* Controls (only when not executing) */}
              {!executing && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Review toggle */}
                  <button
                    onClick={() => toggleReview(idx)}
                    className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-all ${
                      step.requiresReview
                        ? 'border-[#91569c] text-[#91569c] bg-[#f6f0f8]'
                        : 'border-[#e0d6e3] text-[#bbb]'
                    }`}
                    title={step.requiresReview ? 'Review gate ON' : 'Review gate OFF'}
                  >
                    <i className="fa-solid fa-eye text-[7px]" />
                  </button>
                  {/* Move up */}
                  <button
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="w-5 h-5 flex items-center justify-center text-[9px] text-[#aaa] hover:text-[#5c3a62] disabled:opacity-30"
                  >
                    <i className="fa-solid fa-chevron-up" />
                  </button>
                  {/* Move down */}
                  <button
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === editedPlan.steps.length - 1}
                    className="w-5 h-5 flex items-center justify-center text-[9px] text-[#aaa] hover:text-[#5c3a62] disabled:opacity-30"
                  >
                    <i className="fa-solid fa-chevron-down" />
                  </button>
                  {/* Remove */}
                  <button
                    onClick={() => removeStep(idx)}
                    className="w-5 h-5 flex items-center justify-center text-[9px] text-[#aaa] hover:text-red-500"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Step */}
      {!executing && (
        <div className="px-4 py-2 border-t border-[#f0eff0]">
          {showAgentPicker ? (
            <AgentPicker onSelect={addStep} onClose={() => setShowAgentPicker(false)} />
          ) : (
            <button
              onClick={() => setShowAgentPicker(true)}
              className="text-[10px] font-bold uppercase tracking-wider text-[#91569c] hover:text-[#5c3a62] transition-colors"
            >
              <i className="fa-solid fa-plus mr-1" />Add Step
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!executing && (
        <div className="px-4 py-3 bg-[#faf9fb] border-t border-[#e0d6e3] flex items-center gap-2">
          <button
            onClick={() => onApprove(editedPlan)}
            disabled={editedPlan.steps.length === 0}
            className="flex-1 py-2 rounded-lg bg-[#91569c] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#7a4785] transition-colors disabled:opacity-50"
          >
            <i className="fa-solid fa-play mr-1.5" />Approve & Run
          </button>
          {hasChanges && (
            <button
              onClick={() => onModify(editedPlan)}
              className="px-4 py-2 rounded-lg border border-[#91569c] text-[#91569c] text-[10px] font-black uppercase tracking-wider hover:bg-[#f6f0f8] transition-colors"
            >
              Save Changes
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#e0d6e3] text-[#888] text-[10px] font-black uppercase tracking-wider hover:bg-[#f0f0f0] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
