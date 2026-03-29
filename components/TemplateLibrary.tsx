import React, { useState, useMemo } from 'react';
import type { TemplateConfig } from '../templates/templateConfig';
import {
  getAllTemplates,
  deleteTemplate,
  getTeamMeta,
  getAgentMeta,
} from '../services/templateService';

// ─── Category display names & icons for grouped view ────────────────────────

const CATEGORY_GROUP_META: Record<string, { label: string; icon: string }> = {
  marketing:      { label: 'Marketing & Creative Team',     icon: 'fa-bullhorn' },
  training:       { label: 'Training & Education Team',     icon: 'fa-graduation-cap' },
  social:         { label: 'Social Media Team',             icon: 'fa-share-nodes' },
  live:           { label: 'Selling Skills Team',           icon: 'fa-tv' },
  research:       { label: 'Research Team',                 icon: 'fa-microscope' },
  analysis:       { label: 'Analysis Team',                 icon: 'fa-magnifying-glass-chart' },
  documents:      { label: 'Documents & Reports Team',      icon: 'fa-file-lines' },
  code:           { label: 'Code & Development Team',       icon: 'fa-code' },
  organisation:   { label: 'Organisation Team',             icon: 'fa-folder-tree' },
  communication:  { label: 'Communication Team',            icon: 'fa-paper-plane' },
  finance:        { label: 'Finance & Accounting Team',     icon: 'fa-file-invoice-dollar' },
  legal:          { label: 'Legal & Compliance Team',       icon: 'fa-scale-balanced' },
  claude:         { label: 'Claude Platform Team',          icon: 'fa-wand-magic-sparkles' },
  custom:         { label: 'Custom Skills Team',            icon: 'fa-puzzle-piece' },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface TemplateLibraryProps {
  onSelectTemplate: (templateId: string) => void;
  onConfigureTemplates: () => void;
  onBack: () => void;
}

// ─── Category config ────────────────────────────────────────────────────────

type CategoryFilter = 'all' | 'marketing' | 'training' | 'social' | 'live' | 'claude' | 'custom';

const CATEGORY_PILLS: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: 'all',       label: 'All',       icon: 'fa-border-all' },
  { id: 'marketing', label: 'Marketing', icon: 'fa-bullhorn' },
  { id: 'training',  label: 'Training',  icon: 'fa-graduation-cap' },
  { id: 'social',    label: 'Social',    icon: 'fa-share-nodes' },
  { id: 'live',      label: 'Selling',   icon: 'fa-tv' },
  { id: 'claude',    label: 'Claude',    icon: 'fa-sparkles' },
  { id: 'custom',    label: 'Custom',    icon: 'fa-puzzle-piece' },
];

const CATEGORY_COLOURS: Record<string, string> = {
  marketing: 'bg-purple-100 text-purple-700',
  training:  'bg-blue-100 text-blue-700',
  social:    'bg-pink-100 text-pink-700',
  live:      'bg-red-100 text-red-700',
  claude:    'bg-orange-100 text-orange-700',
  custom:    'bg-gray-100 text-gray-600',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function countUniqueTeams(template: TemplateConfig): number {
  const teamIds = new Set(template.teams.map(t => t.teamId));
  return teamIds.size;
}

function countUniqueAgents(template: TemplateConfig): number {
  const agentIds = new Set(template.teams.flatMap(t => t.agents));
  return agentIds.size;
}

// ─── Template Card ──────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: TemplateConfig;
  onUse: () => void;
  onConfigure: () => void;
  onDelete?: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onUse, onConfigure, onDelete }) => {
  const teamCount = countUniqueTeams(template);
  const agentCount = countUniqueAgents(template);
  const stepCount = template.steps.length;
  const catClass = CATEGORY_COLOURS[template.category] || CATEGORY_COLOURS.custom;

  return (
    <div className="rounded-xl border border-[#e0d6e3] bg-white hover:border-[#91569c]/40 hover:shadow-md transition-all group flex flex-col">
      {/* Card header */}
      <div className="p-5 pb-3 flex-1">
        <div className="flex items-start gap-3 mb-3">
          {/* Icon */}
          <div className="w-11 h-11 rounded-xl bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
            <i className={`fa-solid ${template.icon || 'fa-shapes'} text-lg text-[#91569c]`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Name */}
            <h3 className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide leading-tight group-hover:text-[#91569c] transition-colors">
              {template.name}
            </h3>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${catClass}`}>
                {template.category}
              </span>
              {template.builtIn ? (
                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f6f0f8] text-[#91569c]">
                  Built-in
                </span>
              ) : (
                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  Custom
                </span>
              )}
              {template.outputs?.usesShotstack && (
                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-600">
                  Shotstack
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-[11px] text-[#888] leading-relaxed line-clamp-2 mb-3">
          {template.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[9px] text-[#999] font-medium">
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-users-gear text-[8px]" />
            {teamCount} team{teamCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-robot text-[8px]" />
            {agentCount} member{agentCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-list-ol text-[8px]" />
            {stepCount} step{stepCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {template.tags.map(tag => (
              <span key={tag} className="text-[8px] font-bold uppercase tracking-wide text-[#aaa] bg-[#f5f5f5] px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card footer — actions */}
      <div className="px-5 pb-4 pt-2 border-t border-[#f0eaf2] flex items-center gap-2">
        <button
          onClick={onUse}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#91569c] hover:bg-[#7a4685] text-white text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
        >
          <i className="fa-solid fa-play text-[8px]" />
          Run Skill
        </button>
        <button
          onClick={onConfigure}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#e0d6e3] hover:border-[#91569c]/40 hover:bg-[#f6f0f8] text-[#888] hover:text-[#91569c] text-[10px] font-black uppercase tracking-wider transition-all"
          title="Configure template"
        >
          <i className="fa-solid fa-gear text-[9px]" />
        </button>
        {!template.builtIn && onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center justify-center px-2.5 py-2 rounded-lg border border-[#e0d6e3] hover:border-red-300 hover:bg-red-50 text-[#ccc] hover:text-red-500 text-[10px] transition-all"
            title="Delete custom template"
          >
            <i className="fa-solid fa-trash text-[9px]" />
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  onSelectTemplate,
  onConfigureTemplates,
  onBack,
}) => {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (cat: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Load all templates (re-read when refreshKey changes, e.g. after delete)
  const allTemplates = useMemo(() => getAllTemplates(), [refreshKey]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let result = allTemplates;

    // Category filter
    if (category !== 'all') {
      result = result.filter(t => t.category === category);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allTemplates, category, search]);

  // Group filtered templates by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, TemplateConfig[]> = {};
    for (const t of filteredTemplates) {
      const cat = t.category || 'custom';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    // Sort groups by a sensible display order
    const order = ['marketing', 'training', 'social', 'live', 'research', 'analysis', 'documents', 'code', 'organisation', 'communication', 'finance', 'legal', 'claude', 'custom'];
    return order.filter(k => groups[k]).map(k => ({ category: k, templates: groups[k] }));
  }, [filteredTemplates]);

  const handleDelete = (templateId: string) => {
    if (!window.confirm('Delete this custom template? This cannot be undone.')) return;
    try {
      deleteTemplate(templateId);
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#edecec]">
      {/* ── Header ── */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-lg border border-[#e0d6e3] bg-white hover:bg-[#f6f0f8] flex items-center justify-center text-[#888] hover:text-[#91569c] transition-all"
                title="Back to home"
              >
                <i className="fa-solid fa-arrow-left text-xs" />
              </button>
              <div>
                <h1 className="text-lg font-black text-[#5c3a62] uppercase tracking-wide">
                  Skills Library
                </h1>
                <p className="text-[11px] text-[#888] mt-0.5">
                  Choose a skill for MO to run
                </p>
              </div>
            </div>
          </div>

          {/* Configure button */}
          <button
            onClick={onConfigureTemplates}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e0d6e3] bg-white hover:border-[#91569c]/40 hover:bg-[#f6f0f8] text-[#888] hover:text-[#91569c] text-[10px] font-black uppercase tracking-wider transition-all"
          >
            <i className="fa-solid fa-sliders text-[9px]" />
            Configure Skills
          </button>
        </div>

        {/* ── Filters row ── */}
        <div className="flex items-center gap-4">
          {/* Category pills */}
          <div className="flex items-center gap-1.5">
            {CATEGORY_PILLS.map(pill => (
              <button
                key={pill.id}
                onClick={() => setCategory(pill.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                  category === pill.id
                    ? 'bg-[#91569c] text-white border-[#91569c] shadow-sm'
                    : 'bg-white text-[#888] border-[#e0d6e3] hover:border-[#91569c]/40 hover:text-[#5c3a62]'
                }`}
              >
                <i className={`fa-solid ${pill.icon} text-[8px]`} />
                {pill.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="flex-1 max-w-xs relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-[#ccc]" />
            <input
              type="text"
              placeholder="Search skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#e0d6e3] bg-white text-xs text-[#5c3a62] placeholder-[#ccc] focus:outline-none focus:border-[#91569c]/50 focus:ring-1 focus:ring-[#91569c]/20 transition-all"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-[#e0d6e3] rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 text-[10px] ${viewMode === 'list' ? 'bg-[#91569c] text-white' : 'bg-white text-[#888] hover:text-[#5c3a62]'} transition-all`}
              title="Grouped list view"
            >
              <i className="fa-solid fa-list" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 text-[10px] ${viewMode === 'grid' ? 'bg-[#91569c] text-white' : 'bg-white text-[#888] hover:text-[#5c3a62]'} transition-all`}
              title="Card grid view"
            >
              <i className="fa-solid fa-grid-2" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Skills content ── */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <i className="fa-solid fa-shapes text-4xl text-[#ddd] mb-4" />
            <p className="text-sm font-bold text-[#888] uppercase tracking-wide">No skills found</p>
            <p className="text-[11px] text-[#aaa] mt-1">
              {search ? 'Try a different search term' : 'No skills match this category'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* ── Grouped accordion list ── */
          <div className="space-y-2">
            {groupedTemplates.map(group => {
              const meta = CATEGORY_GROUP_META[group.category] || { label: group.category, icon: 'fa-shapes' };
              const isOpen = expandedGroups.has(group.category) || !!search;
              return (
                <div key={group.category} className="rounded-xl border border-[#e0d6e3] bg-white overflow-hidden">
                  {/* Collapsible group header */}
                  <button
                    onClick={() => toggleGroup(group.category)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#faf9fb] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#f6f0f8] flex items-center justify-center flex-shrink-0">
                      <i className={`fa-solid ${meta.icon} text-[#91569c] text-sm`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[11px] font-black text-[#5c3a62] uppercase tracking-wide">{meta.label}</h3>
                    </div>
                    <span className="text-[9px] text-[#bbb] font-bold">{group.templates.length}</span>
                    <i className={`fa-solid ${isOpen ? 'fa-minus' : 'fa-plus'} text-[10px] text-[#91569c] w-5 text-center`} />
                  </button>

                  {/* Expanded skill rows */}
                  {isOpen && (
                    <div className="border-t border-[#f0eaf2] pb-2">
                      {group.templates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => onSelectTemplate(template.id)}
                          className="w-full flex items-center gap-3 px-5 pl-16 py-2.5 hover:bg-[#f6f0f8] transition-all text-left group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-[#f6f0f8] group-hover:bg-[#eadcef] flex items-center justify-center flex-shrink-0 transition-colors">
                            <i className={`fa-solid ${template.icon || 'fa-shapes'} text-xs text-[#91569c]`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide group-hover:text-[#91569c] transition-colors">
                              {template.name}
                            </span>
                            <p className="text-[9px] text-[#999] truncate">{template.description}</p>
                          </div>
                          {template.steps.length > 1 && (
                            <span className="text-[8px] text-[#bbb] font-bold flex-shrink-0">{template.steps.length} steps</span>
                          )}
                          <i className="fa-solid fa-chevron-right text-[9px] text-[#ddd] group-hover:text-[#91569c] transition-colors flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Card grid view ── */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={() => onSelectTemplate(template.id)}
                onConfigure={onConfigureTemplates}
                onDelete={template.builtIn ? undefined : () => handleDelete(template.id)}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        <div className="text-center mt-6">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#bbb]">
            {filteredTemplates.length} skill{filteredTemplates.length !== 1 ? 's' : ''}
            {category !== 'all' && ` in ${category}`}
            {search && ` matching "${search}"`}
          </span>
        </div>
      </div>
    </div>
  );
};
