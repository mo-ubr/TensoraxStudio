/**
 * StudioLayout — Layout wrapper for the Studio screen.
 *
 * Mo's chat is the sole entry point. Users talk to Mo, who:
 *   1. Identifies the task (matches template or builds freeform pipeline)
 *   2. Launches the pipeline engine
 *   3. Shows progress in a collapsible right-side panel
 *   4. Pauses at review gates for user approval
 *
 * The old template picker and template wizard are still available as
 * fallbacks (via sidebar navigation) but Mo is the primary interface.
 */

import React, { useRef, useState, useCallback } from 'react';
import { MasterOrchestrator } from './MasterOrchestrator';
import type { MasterAction, PipelinePlan } from '../services/orchestratorService';
import { composeTemplateFromPlan } from '../services/orchestratorService';
import { createTemplate, getTemplate } from '../services/templateService';
import { generatePlan, planToTemplate, type PmPlan } from '../services/projectManagerService';
import {
  createPipeline,
  runPipeline,
  approveStep,
  skipStep,
  retryStep,
  checkPipelineTools,
  savePipeline,
  type PipelineState,
  type PipelineEvent,
} from '../services/pipelineEngine';
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
  const [activePipeline, setActivePipeline] = useState<PipelineState | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [showPipelinePanel, setShowPipelinePanel] = useState(false);

  // Pipeline event handler — updates UI in real-time
  const handlePipelineEvent = useCallback((event: PipelineEvent) => {
    setPipelineEvents(prev => [...prev, event]);
    console.log(`[Pipeline] ${event.type}${event.stepName ? `: ${event.stepName}` : ''}`);
  }, []);

  // Launch a template via the pipeline engine
  const launchPipeline = useCallback(async (templateId: string, globalInput?: Record<string, unknown>) => {
    const template = getTemplate(templateId);
    if (!template) {
      console.error(`[StudioLayout] Template "${templateId}" not found`);
      return;
    }

    // Check tool availability
    const { ready, missing } = checkPipelineTools(template);
    if (!ready) {
      console.warn('[StudioLayout] Missing tools:', missing);
      // Still allow launch — agents can degrade gracefully
    }

    // Create and run pipeline
    const pipeline = createPipeline(template, {
      ...globalInput,
      projectId: activeProject?.id,
      projectName: activeProject?.name,
      brandName: brand?.name,
    });

    setActivePipeline(pipeline);
    setShowPipelinePanel(true);
    setPipelineEvents([]);

    // Run until first review gate or completion
    const updated = await runPipeline(pipeline, handlePipelineEvent);
    setActivePipeline(updated);
    savePipeline(updated);
  }, [activeProject, brand, handlePipelineEvent]);

  // Handle Mo's actions
  const handleAction = useCallback((action: MasterAction) => {
    switch (action.type) {
      case 'run_template':
        if (action.templateId) {
          // Try pipeline engine first; fall back to old template runner
          const template = getTemplate(action.templateId);
          if (template) {
            launchPipeline(action.templateId);
          } else {
            onStartTemplate(action.templateId);
          }
        }
        break;
      case 'run_pm':
        if (action.pmBrief) {
          // Delegate to Project Manager for creative decomposition
          (async () => {
            try {
              const { plan } = await generatePlan(action.pmBrief!, activeProject ? { projectId: activeProject.id, projectName: activeProject.name } : undefined);
              // Convert PM plan to a TemplateConfig with TL-gated steps
              const templateConfig = planToTemplate(plan);
              try { createTemplate(templateConfig); } catch { /* may already exist */ }
              launchPipeline(templateConfig.id);
            } catch (err) {
              console.error('PM plan generation failed:', err);
            }
          })();
        }
        break;
      case 'navigate':
        if (action.screen) onNavigate(action.screen);
        break;
      default:
        onAction(action);
    }
  }, [launchPipeline, onStartTemplate, onNavigate, onAction, activeProject]);

  // Handle Mo's freeform pipeline plans
  const handleRunPipeline = useCallback(async (plan: PipelinePlan) => {
    // Convert plan to TemplateConfig
    const templateConfig = composeTemplateFromPlan(plan);
    try {
      createTemplate(templateConfig);
    } catch {
      // Template with this ID may already exist — that's OK
    }
    // Launch via pipeline engine
    await launchPipeline(templateConfig.id, { chatContext: chatHistoryRef.current });
  }, [launchPipeline]);

  // Pipeline control actions (called from pipeline panel)
  const handleApproveStep = useCallback(async () => {
    if (!activePipeline) return;
    const updated = approveStep(activePipeline);
    setActivePipeline(updated);
    savePipeline(updated);

    // Continue running if there are more steps
    if (updated.status === 'running' || (updated.status !== 'paused' && updated.status !== 'completed' && updated.status !== 'failed')) {
      const next = await runPipeline(updated, handlePipelineEvent);
      setActivePipeline(next);
      savePipeline(next);
    }
  }, [activePipeline, handlePipelineEvent]);

  const handleSkipStep = useCallback(async () => {
    if (!activePipeline) return;
    const updated = skipStep(activePipeline);
    setActivePipeline(updated);
    savePipeline(updated);

    if (updated.currentStep < updated.steps.length && updated.status !== 'completed') {
      const next = await runPipeline(updated, handlePipelineEvent);
      setActivePipeline(next);
      savePipeline(next);
    }
  }, [activePipeline, handlePipelineEvent]);

  const handleRetryStep = useCallback(async () => {
    if (!activePipeline) return;
    const updated = await retryStep(activePipeline, handlePipelineEvent);
    setActivePipeline(updated);
    savePipeline(updated);
  }, [activePipeline, handlePipelineEvent]);

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

      {/* Pipeline Monitor Panel (collapsible right side) */}
      {showPipelinePanel && activePipeline && (
        <div className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 truncate">{activePipeline.templateName}</h3>
              <span className={`text-xs font-medium ${
                activePipeline.status === 'completed' ? 'text-green-600' :
                activePipeline.status === 'failed' ? 'text-red-600' :
                activePipeline.status === 'paused' ? 'text-amber-600' :
                'text-blue-600'
              }`}>
                {activePipeline.status === 'paused' ? 'Awaiting Review' : activePipeline.status}
              </span>
            </div>
            <button
              onClick={() => setShowPipelinePanel(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              &times;
            </button>
          </div>

          {/* Steps list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {activePipeline.steps.map((stepState, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg text-xs ${
                  stepState.status === 'completed' ? 'bg-green-50 border border-green-200' :
                  stepState.status === 'running' ? 'bg-blue-50 border border-blue-200' :
                  stepState.status === 'awaiting_review' ? 'bg-amber-50 border border-amber-200' :
                  stepState.status === 'failed' ? 'bg-red-50 border border-red-200' :
                  stepState.status === 'skipped' ? 'bg-gray-50 border border-gray-200 opacity-50' :
                  'bg-gray-50 border border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-mono">{i + 1}</span>
                  <span className={`font-medium ${
                    stepState.status === 'completed' ? 'text-green-700' :
                    stepState.status === 'running' ? 'text-blue-700' :
                    stepState.status === 'awaiting_review' ? 'text-amber-700' :
                    stepState.status === 'failed' ? 'text-red-700' :
                    'text-gray-600'
                  }`}>{stepState.step.name}</span>
                  {stepState.status === 'completed' && <span className="ml-auto text-green-500">&#10003;</span>}
                  {stepState.status === 'running' && <span className="ml-auto text-blue-500 animate-pulse">&#9679;</span>}
                  {stepState.status === 'failed' && <span className="ml-auto text-red-500">&#10007;</span>}
                  {/* TL Quality Score Badge */}
                  {stepState.tlReviews && stepState.tlReviews.length > 0 && (() => {
                    const lastReview = stepState.tlReviews[stepState.tlReviews.length - 1];
                    const score = lastReview.qualityScore;
                    const color = score >= 8 ? 'bg-green-100 text-green-700 border-green-300' :
                                  score >= 6 ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                  'bg-red-100 text-red-700 border-red-300';
                    return (
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${color}`} title={lastReview.recommendation}>
                        TL {score}/10
                        {stepState.tlReviews.length > 1 && <span className="opacity-60 ml-0.5">(×{stepState.tlReviews.length})</span>}
                      </span>
                    );
                  })()}
                </div>
                {/* TL reviewing indicator */}
                {stepState.status === 'running' && stepState.step.executionMode === 'team-leader' && (
                  <p className="text-purple-500 mt-1 text-[10px] leading-tight animate-pulse">
                    <i className="fa-solid fa-user-shield mr-1"></i>Team Leader reviewing...
                  </p>
                )}
                {stepState.output?.summary && (
                  <p className="text-gray-500 mt-1 text-[10px] leading-tight">{stepState.output.summary}</p>
                )}
                {stepState.error && (
                  <p className="text-red-600 mt-1 text-[10px] leading-tight">{stepState.error}</p>
                )}
              </div>
            ))}
          </div>

          {/* Action buttons (when paused or failed) */}
          {activePipeline.status === 'paused' && (
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleApproveStep}
                className="flex-1 px-3 py-1.5 bg-[#91569c] text-white text-xs font-medium rounded-lg hover:bg-[#7a4885]"
              >
                Approve &amp; Continue
              </button>
              <button
                onClick={handleSkipStep}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200"
              >
                Skip
              </button>
            </div>
          )}
          {activePipeline.status === 'failed' && (
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleRetryStep}
                className="flex-1 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600"
              >
                Retry Step
              </button>
              <button
                onClick={() => { setActivePipeline(null); setShowPipelinePanel(false); }}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          )}
          {activePipeline.status === 'completed' && (
            <div className="p-3 border-t border-gray-200">
              <div className="text-xs text-green-700 font-medium text-center mb-2">Pipeline Complete</div>
              <button
                onClick={() => { setActivePipeline(null); setShowPipelinePanel(false); }}
                className="w-full px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
