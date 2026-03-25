/**
 * AgentCataloguePanel — Searchable overlay of all teams and agents
 *
 * Opened from the MasterOrchestrator's "Agent Catalogue" button.
 * Shows all 5 teams and 43 agents in a searchable, browsable list.
 */

import React, { useState, useMemo } from 'react';
import { TEAM_CATALOGUE, type TeamMeta, type AgentMeta } from '../services/templateService';

interface AgentCataloguePanelProps {
  onClose: () => void;
  onSelectAgent?: (agentId: string) => void;
  /** When true, renders as a full page instead of a modal overlay */
  inline?: boolean;
}

export const AgentCataloguePanel: React.FC<AgentCataloguePanelProps> = ({ onClose, onSelectAgent, inline }) => {
  const [search, setSearch] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const filteredTeams = useMemo(() => {
    if (!search) return TEAM_CATALOGUE;
    const q = search.toLowerCase();
    return TEAM_CATALOGUE.map(team => ({
      ...team,
      agents: team.agents.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      ),
    })).filter(team => team.agents.length > 0 || team.name.toLowerCase().includes(q));
  }, [search]);

  const totalAgents = TEAM_CATALOGUE.reduce((s, t) => s + t.agents.length, 0);

  if (inline) {
    return (
      <div className="flex flex-col h-full bg-[#edecec]">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-[#e0d6e3] flex-shrink-0">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#5c3a62]">Agent Catalogue</h2>
          <p className="text-[10px] text-[#aaa] mt-0.5">{TEAM_CATALOGUE.length} teams, {totalAgents} agents</p>
        </div>

        {/* Search */}
        <div className="px-6 py-3 bg-white border-b border-[#f0eff0] flex-shrink-0">
          <div className="relative max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb] text-xs" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agents by name, description, or ID..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#e0d6e3] rounded-lg focus:outline-none focus:border-[#91569c] focus:ring-1 focus:ring-[#91569c]/20"
              autoFocus
            />
          </div>
        </div>

        {/* Team List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTeams.map(team => {
            const isExpanded = expandedTeam === team.id || !!search;
            return (
              <div key={team.id} className="border-b border-[#e0d6e3] last:border-b-0 bg-white">
                <button
                  onClick={() => setExpandedTeam(isExpanded && !search ? null : team.id)}
                  className="w-full px-6 py-3 flex items-center gap-3 hover:bg-[#faf9fb] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#f6f0f8] flex items-center justify-center flex-shrink-0">
                    <i className={`fa-solid ${team.icon} text-[#91569c] text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#5c3a62]">{team.name}</span>
                    <p className="text-[9px] text-[#aaa]">{team.description}</p>
                  </div>
                  <span className="text-[9px] text-[#bbb] font-bold">{team.agents.length}</span>
                  <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[9px] text-[#ccc]`} />
                </button>
                {isExpanded && (
                  <div className="pb-2">
                    {team.agents.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => onSelectAgent?.(agent.id)}
                        className="w-full flex items-center gap-3 px-6 pl-16 py-2 hover:bg-[#f6f0f8] transition-colors text-left"
                      >
                        <i className={`fa-solid ${agent.icon} text-[#91569c] text-[10px] w-4 text-center`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">{agent.name}</span>
                          <p className="text-[9px] text-[#999] truncate">{agent.description}</p>
                        </div>
                        <code className="text-[8px] text-[#bbb] font-mono">{agent.id}</code>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filteredTeams.length === 0 && (
            <div className="py-8 text-center">
              <i className="fa-solid fa-robot text-3xl text-[#e0d6e3] mb-2" />
              <p className="text-[10px] text-[#aaa]">No agents match "{search}"</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e0d6e3] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-[#5c3a62]">Agent Catalogue</h2>
            <p className="text-[10px] text-[#aaa] mt-0.5">{TEAM_CATALOGUE.length} teams, {totalAgents} agents</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#f0f0f0] flex items-center justify-center text-[#888]">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#f0eff0] flex-shrink-0">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb] text-xs" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agents by name, description, or ID..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#e0d6e3] rounded-lg focus:outline-none focus:border-[#91569c] focus:ring-1 focus:ring-[#91569c]/20"
              autoFocus
            />
          </div>
        </div>

        {/* Team List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTeams.map(team => {
            const isExpanded = expandedTeam === team.id || !!search;
            return (
              <div key={team.id} className="border-b border-[#f0eff0] last:border-b-0">
                {/* Team Header */}
                <button
                  onClick={() => setExpandedTeam(isExpanded && !search ? null : team.id)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#faf9fb] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#f6f0f8] flex items-center justify-center flex-shrink-0">
                    <i className={`fa-solid ${team.icon} text-[#91569c] text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#5c3a62]">{team.name}</span>
                    <p className="text-[9px] text-[#aaa]">{team.description}</p>
                  </div>
                  <span className="text-[9px] text-[#bbb] font-bold">{team.agents.length}</span>
                  <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[9px] text-[#ccc]`} />
                </button>

                {/* Agent List */}
                {isExpanded && (
                  <div className="pb-2">
                    {team.agents.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => onSelectAgent?.(agent.id)}
                        className="w-full flex items-center gap-3 px-5 pl-16 py-2 hover:bg-[#f6f0f8] transition-colors text-left"
                      >
                        <i className={`fa-solid ${agent.icon} text-[#91569c] text-[10px] w-4 text-center`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide">{agent.name}</span>
                          <p className="text-[9px] text-[#999] truncate">{agent.description}</p>
                        </div>
                        <code className="text-[8px] text-[#bbb] font-mono">{agent.id}</code>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filteredTeams.length === 0 && (
            <div className="py-8 text-center">
              <i className="fa-solid fa-robot text-3xl text-[#e0d6e3] mb-2" />
              <p className="text-[10px] text-[#aaa]">No agents match "{search}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
