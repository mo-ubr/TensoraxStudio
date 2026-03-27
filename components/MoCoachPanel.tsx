/**
 * MoCoachPanel — Mo's coaching sidebar for guided template workflows
 *
 * Shows instructions, checklist, validation feedback, and approval status
 * for the current step. Appears on the right side of the TemplateRunner
 * when a step has moGuidance defined.
 */

import React, { useState, useCallback } from 'react';
import type { MoGuidance } from '../templates/templateConfig';
import { TensorAxIcon } from './TensorAxIcon';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MoStatus = 'instructing' | 'checking' | 'approved' | 'needs-fixes' | 'idle';

export interface MoValidationResult {
  status: 'approved' | 'needs-fixes';
  feedback: string;
  issues?: string[];
  score?: number;
}

interface MoCoachPanelProps {
  guidance: MoGuidance;
  stepName: string;
  stepOrder: number;
  /** Current Mo status */
  status: MoStatus;
  /** Validation result from AI check */
  validationResult?: MoValidationResult | null;
  /** Whether the "Check My Work" button should be enabled */
  canValidate: boolean;
  /** Callback when user clicks "Check My Work" */
  onRequestValidation: () => void;
  /** Callback when user clicks "Skip Anyway" on needs-fixes */
  onSkipValidation: () => void;
}

// ─── Status config ──────────────────────────────────────────────────────────

const MO_STATUS_CONFIG: Record<MoStatus, { icon: string; label: string; colour: string; bgColour: string }> = {
  instructing:  { icon: 'fa-comment-dots',    label: 'Mo is ready',       colour: 'text-[#91569c]',   bgColour: 'bg-[#f6f0f8]' },
  checking:     { icon: 'fa-spinner',         label: 'Mo is checking...',  colour: 'text-amber-600',   bgColour: 'bg-amber-50' },
  approved:     { icon: 'fa-circle-check',    label: 'Mo approved',       colour: 'text-green-600',   bgColour: 'bg-green-50' },
  'needs-fixes':{ icon: 'fa-triangle-exclamation', label: 'Mo has notes', colour: 'text-amber-600',   bgColour: 'bg-amber-50' },
  idle:         { icon: 'fa-circle',          label: '',                   colour: 'text-[#ccc]',      bgColour: 'bg-gray-50' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export const MoCoachPanel: React.FC<MoCoachPanelProps> = ({
  guidance,
  stepName,
  stepOrder,
  status,
  validationResult,
  canValidate,
  onRequestValidation,
  onSkipValidation,
}) => {
  const [checklistState, setChecklistState] = useState<Record<number, boolean>>({});
  const cfg = MO_STATUS_CONFIG[status];

  const toggleChecklist = useCallback((index: number) => {
    setChecklistState(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const allChecked = guidance.checklist
    ? guidance.checklist.every((_, i) => checklistState[i])
    : true;

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-[#e0d6e3] flex flex-col min-h-0">
      {/* ── Mo header ── */}
      <div className="px-4 py-3 border-b border-[#f0eff0] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f6f0f8] to-[#eadcef] flex items-center justify-center">
          <TensorAxIcon className="w-5 h-5 text-[#91569c]" spinning={status === 'checking'} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-wider text-[#5c3a62]">
            Mo
          </span>
          <span className={`block text-[8px] font-bold uppercase tracking-wide ${cfg.colour}`}>
            <i className={`fa-solid ${cfg.icon} mr-1 ${status === 'checking' ? 'fa-spin' : ''}`} />
            {cfg.label}
          </span>
        </div>
        {/* Step badge */}
        <span className="text-[8px] font-black uppercase tracking-wider text-[#bbb] bg-[#f5f4f5] px-2 py-1 rounded-full">
          Step {stepOrder}
        </span>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Instructions ── */}
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-[#aaa] mb-2 block">
            <i className="fa-solid fa-message text-[8px] mr-1" />
            Instructions
          </span>
          <div className="rounded-xl bg-[#f9f7fa] border border-[#f0eaf2] p-3">
            <p className="text-[11px] text-[#444] leading-relaxed whitespace-pre-line">
              {guidance.instructions}
            </p>
          </div>
        </div>

        {/* ── Checklist ── */}
        {guidance.checklist && guidance.checklist.length > 0 && (
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-[#aaa] mb-2 block">
              <i className="fa-solid fa-list-check text-[8px] mr-1" />
              Checklist
            </span>
            <div className="space-y-1.5">
              {guidance.checklist.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleChecklist(i)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                    checklistState[i]
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-white border border-[#eee] hover:border-[#91569c]/30'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    checklistState[i]
                      ? 'bg-green-500 text-white'
                      : 'bg-[#f0eaf2] text-transparent'
                  }`}>
                    <i className="fa-solid fa-check text-[7px]" />
                  </div>
                  <span className={`text-[10px] leading-relaxed ${
                    checklistState[i] ? 'text-green-700 line-through' : 'text-[#555]'
                  }`}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Check My Work button ── */}
        {status === 'instructing' && (
          <button
            onClick={onRequestValidation}
            disabled={!canValidate}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${
              canValidate
                ? 'bg-[#91569c] hover:bg-[#7a4685] text-white cursor-pointer'
                : 'bg-[#e0d6e3] text-[#aaa] cursor-not-allowed'
            }`}
          >
            <i className="fa-solid fa-magnifying-glass text-[9px]" />
            Check My Work
          </button>
        )}

        {/* ── Checking animation ── */}
        {status === 'checking' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <TensorAxIcon className="w-5 h-5 text-amber-600" spinning />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
              Checking your work...
            </span>
            <div className="mt-2 flex items-center justify-center gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-1 rounded-full bg-amber-400 animate-pulse"
                  style={{ width: `${8 + i * 2}px`, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Validation result: Approved ── */}
        {status === 'approved' && validationResult && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <i className="fa-solid fa-circle-check text-green-500" />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-green-700">
                  Approved
                </span>
                {validationResult.score != null && (
                  <span className="block text-[8px] font-bold text-green-600">
                    Score: {validationResult.score}/10
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-green-800 leading-relaxed">
              {validationResult.feedback}
            </p>
            {guidance.nextStepTip && (
              <div className="rounded-lg bg-green-100/50 px-3 py-2 mt-2">
                <span className="text-[9px] font-bold text-green-700">
                  <i className="fa-solid fa-arrow-right mr-1 text-[8px]" />
                  {guidance.nextStepTip}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Validation result: Needs fixes ── */}
        {status === 'needs-fixes' && validationResult && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <i className="fa-solid fa-triangle-exclamation text-amber-500" />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-amber-700">
                  Needs Attention
                </span>
                {validationResult.score != null && (
                  <span className="block text-[8px] font-bold text-amber-600">
                    Score: {validationResult.score}/10
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-amber-800 leading-relaxed">
              {validationResult.feedback}
            </p>
            {validationResult.issues && validationResult.issues.length > 0 && (
              <div className="space-y-1">
                {validationResult.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-amber-100/50">
                    <i className="fa-solid fa-circle-exclamation text-amber-500 text-[8px] mt-0.5" />
                    <span className="text-[9px] text-amber-800">{issue}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={onRequestValidation}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#91569c] hover:bg-[#7a4685] text-white text-[9px] font-black uppercase tracking-wider transition-colors"
              >
                <i className="fa-solid fa-rotate-left text-[8px]" />
                Re-check
              </button>
              <button
                onClick={onSkipValidation}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-wider transition-all"
              >
                <i className="fa-solid fa-forward text-[8px]" />
                Skip Anyway
              </button>
            </div>
          </div>
        )}

        {/* ── Approval criteria (always visible as reference) ── */}
        {guidance.approvalCriteria && guidance.approvalCriteria.length > 0 && status === 'instructing' && (
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-[#aaa] mb-2 block">
              <i className="fa-solid fa-clipboard-check text-[8px] mr-1" />
              What Mo Checks
            </span>
            <div className="space-y-1">
              {guidance.approvalCriteria.map((criteria, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-lg bg-[#f9f7fa]">
                  <i className="fa-solid fa-circle text-[5px] text-[#91569c] mt-1" />
                  <span className="text-[9px] text-[#666]">{criteria}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
