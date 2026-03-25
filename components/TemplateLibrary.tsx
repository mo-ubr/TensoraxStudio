import React, { useState, useMemo } from 'react';
import type { TemplateConfig } from '../templates/templateConfig';
import {
  getAllTemplates,
  deleteTemplate,
  getTeamMeta,
  getAgentMeta,
} from '../services/templateService';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TemplateLibraryProps {
  onSelectTemplate: (templateId: string) => void;
  onConfigureTemplates: () => void;
  onBack: () => void;
}

// ─── Category config ────────────────────────────────────────────────────────

type CategoryFilter = 'all' | 'marketing' | 'training' | 'social' | 'live' | 'custom';

const CATEGORY_PILLS: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: 'all',       label: 'All',       icon: 'fa-border-all' },
  { id: 'marketing', label: 'Marketing', icon: 'fa-bullhorn' },
  { id: 'training',  label: 'Training',  icon: 'fa-graduation-cap' },
  { id: 'social',    label: 'Social',    icon: 'fa-share-nodes' },
  { id: 'live',      label: 'Live',      icon: 'fa-tv' },
  { id: 'custom',    label: 'Custom',    icon: 'fa-puzzle-piece' },
];

const CATEGORY_COLOURS: Record<string, string> = {
  marketing: 'bg-purple-100 text-purple-700',
  training:  'bg-blue-100 text-blue-700',
  social:    'bg-pink-100 text-pink-700',
  live:      'bg-red-100 text-red-700',
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
            {agentCount} agent{agentCount !== 1 ? 's' : ''}
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
          Use Template
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
                  Template Library
                </h1>
                <p className="text-[11px] text-[#888] mt-0.5">
                  Choose a template to start a new project
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
            Configure Templates
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
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#e0d6e3] bg-white text-xs text-[#5c3a62] placeholder-[#ccc] focus:outline-none focus:border-[#91569c]/50 focus:ring-1 focus:ring-[#91569c]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Template grid ── */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <i className="fa-solid fa-shapes text-4xl text-[#ddd] mb-4" />
            <p className="text-sm font-bold text-[#888] uppercase tracking-wide">No templates found</p>
            <p className="text-[11px] text-[#aaa] mt-1">
              {search ? 'Try a different search term' : 'No templates match this category'}
            </p>
          </div>
        ) : (
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
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            {category !== 'all' && ` in ${category}`}
            {search && ` matching "${search}"`}
          </span>
        </div>
      </div>
    </div>
  );
};
