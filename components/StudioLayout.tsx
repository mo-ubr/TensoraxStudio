/**
 * StudioLayout — Layout wrapper for the Studio screen
 *
 * Phase 1-2: Full-width MasterOrchestrator panel.
 * Phase 3: Will add a collapsible right-side pipeline monitor.
 */

import React, { useRef } from 'react';
import { MasterOrchestrator } from './MasterOrchestrator';
import type { MasterAction, PipelinePlan } from '../services/orchestratorService';
import { composeTemplateFromPlan } from '../services/orchestratorService';
import { createTemplate } from '../services/templateService';
import type { BrandProfile } from '../types';
import type { Project } from '../services/projectDB';

interface StudioLayoutProps {
  projectContext?: Record<string, unknown> | null;
  brand?: BrandProfile | null;
  activeProject?: Project | null;
  onAction: (action: MasterAction) => void;
  onStartTemplate: (templateId: string, initialContext?: string) => void;
  onNavigate: (screen: string) => void;
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({
  projectContext,
  brand,
  activeProject,
  onAction,
  onStartTemplate,
  onNavigate,
}) => {
  const chatHistoryRef = useRef<string>('');

  const handleAction = (action: MasterAction) => {
    switch (action.type) {
      case 'run_template':
        if (action.templateId) onStartTemplate(action.templateId);
        break;
      case 'navigate':
        if (action.screen) onNavigate(action.screen);
        break;
      default:
        onAction(action);
    }
  };

  const handleRunPipeline = (plan: PipelinePlan) => {
    // Convert plan to TemplateConfig and save as custom template
    const templateConfig = composeTemplateFromPlan(plan);
    try {
      createTemplate(templateConfig);
    } catch {
      // Template with this ID may already exist — that's OK for execution
    }
    // Launch the template runner with the custom template + MO chat context
    onStartTemplate(templateConfig.id, chatHistoryRef.current);
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* Main: Master Orchestrator Chat */}
      <MasterOrchestrator
        projectContext={projectContext}
        brand={brand}
        onAction={handleAction}
        onRunPipeline={handleRunPipeline}
        chatHistoryRef={chatHistoryRef}
      />

      {/* Phase 3: Pipeline Monitor Panel will go here */}
      {/* <PipelineMonitor /> */}
    </div>
  );
};
