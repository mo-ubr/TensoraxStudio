import React, { useState } from 'react';
import ResearchScreen from './ResearchScreen';

interface WorkflowsScreenProps {
  onBack: () => void;
  activeProject?: any;
}

interface WorkflowCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'ready' | 'coming_soon';
}

const WORKFLOWS: WorkflowCard[] = [
  {
    id: 'sm-research',
    name: 'Research Social Media',
    description: 'Scrape competitor accounts, analyse engagement patterns, hashtags, viral content, and generate actionable recommendations with a content calendar.',
    icon: 'fa-magnifying-glass-chart',
    status: 'ready',
  },
  {
    id: 'content-production',
    name: 'Content Production',
    description: 'Generate branded video content from concept to final cut — copy, images, storyboard, and AI video.',
    icon: 'fa-film',
    status: 'coming_soon',
  },
  {
    id: 'performance-tracking',
    name: 'Performance Tracking',
    description: 'Monitor published content performance, track KPIs, and get automated optimisation suggestions.',
    icon: 'fa-chart-line',
    status: 'coming_soon',
  },
  {
    id: 'competitor-watch',
    name: 'Competitor Watch',
    description: 'Continuous monitoring of competitor activity with alerts on strategy shifts and new campaigns.',
    icon: 'fa-binoculars',
    status: 'coming_soon',
  },
];

export default function WorkflowsScreen({ onBack, activeProject }: WorkflowsScreenProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);

  // If a workflow is selected, render its screen
  if (activeWorkflow === 'sm-research') {
    return (
      <ResearchScreen
        onBack={() => setActiveWorkflow(null)}
        activeProject={activeProject}
      />
    );
  }

  // Workflow list
  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-[#91569c] transition-colors"
          >
            <i className="fa-solid fa-arrow-left mr-1" /> Back
          </button>
          <h1 className="text-2xl font-bold text-[#91569c]">Workflows</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORKFLOWS.map(wf => (
            <button
              key={wf.id}
              onClick={() => wf.status === 'ready' && setActiveWorkflow(wf.id)}
              disabled={wf.status === 'coming_soon'}
              className={`text-left rounded-xl border p-5 transition-all ${
                wf.status === 'ready'
                  ? 'bg-white border-[#e0d6e3] hover:border-[#91569c] hover:shadow-md cursor-pointer'
                  : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  wf.status === 'ready' ? 'bg-[#f6f0f8] text-[#91569c]' : 'bg-gray-100 text-gray-400'
                }`}>
                  <i className={`fa-solid ${wf.icon} text-lg`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">{wf.name}</h3>
                    {wf.status === 'coming_soon' && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Soon</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{wf.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
