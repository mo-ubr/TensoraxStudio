/**
 * MoGuidedChat — Chat-centric guided workflow for templates
 *
 * Mo guides the user step-by-step through a template pipeline.
 * Users drop files directly into the chat, Mo validates inline,
 * and the conversation flows naturally from one step to the next.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TemplateStep, MoGuidance } from '../templates/templateConfig';
import { GeminiService, hasStoredKeyForType } from '../services/geminiService';
import { TensorAxIcon } from './TensorAxIcon';
import type { Chat } from '@google/genai';

// ─── Message types ──────────────────────────────────────────────────────────

interface ChatFile {
  file: File;
  previewUrl: string;
}

interface GuidedMessage {
  role: 'mo' | 'user' | 'system';
  text: string;
  files?: ChatFile[];
  /** Step this message belongs to */
  stepOrder?: number;
  /** Validation result embedded in message */
  validation?: { status: 'approved' | 'needs-fixes'; score?: number };
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface MoGuidedChatProps {
  steps: TemplateStep[];
  activeStepIndex: number;
  /** Collected files per step: stepIndex → inputId → File[] */
  stepFiles: Record<number, Record<string, File[]>>;
  /** Toggle values per step */
  toggleValues: Record<string, boolean>;
  /** Callback when files are dropped for current step */
  onFilesAdded: (inputId: string, files: File[]) => void;
  /** Callback when Mo approves the current step */
  onStepApproved: () => void;
  /** Callback when user wants to proceed without Mo approval */
  onStepSkipped: () => void;
  /** Callback when an agent step should run */
  onRunAgentStep: () => void;
  /** Whether an agent step is currently running */
  agentRunning: boolean;
  /** Output text from agent step */
  agentOutput?: string | null;
  /** Whether agent step is in review */
  agentInReview: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const MoGuidedChat: React.FC<MoGuidedChatProps> = ({
  steps,
  activeStepIndex,
  stepFiles,
  toggleValues,
  onFilesAdded,
  onStepApproved,
  onStepSkipped,
  onRunAgentStep,
  agentRunning,
  agentOutput,
  agentInReview,
}) => {
  const [messages, setMessages] = useState<GuidedMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'checking' | 'approved' | 'needs-fixes'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat | null>(null);
  const lastStepRef = useRef(-1);
  const dragCounterRef = useRef(0);

  const currentStep = steps[activeStepIndex];
  const guidance = currentStep?.moGuidance;
  const isUploadStep = currentStep?.agents.length === 0;
  const currentFiles = stepFiles[activeStepIndex] || {};
  const totalFilesThisStep = Object.values(currentFiles).reduce((sum, arr) => sum + arr.length, 0);

  // ── Auto-scroll ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // ── Init chat session ──
  useEffect(() => {
    if (hasStoredKeyForType('analysis') && !chatRef.current) {
      try {
        chatRef.current = GeminiService.createChat('gemini-2.5-flash',
          'You are Mo, the AI coach for TensorAx Studio. You guide users through creative production templates step by step. Be concise, friendly, and specific. When validating uploads, give actionable feedback. Use emoji sparingly.'
        );
      } catch { /* key invalid */ }
    }
  }, []);

  // ── When step changes, add Mo's greeting for the new step ──
  useEffect(() => {
    if (lastStepRef.current === activeStepIndex) return;
    lastStepRef.current = activeStepIndex;
    setValidationStatus('idle');

    if (guidance) {
      const stepMsg: GuidedMessage = {
        role: 'system',
        text: `── Step ${currentStep.order}: ${currentStep.name} ──`,
        stepOrder: currentStep.order,
      };
      const moMsg: GuidedMessage = {
        role: 'mo',
        text: guidance.instructions,
        stepOrder: currentStep.order,
      };
      setMessages(prev => [...prev, stepMsg, moMsg]);
    } else {
      const stepMsg: GuidedMessage = {
        role: 'system',
        text: `── Step ${currentStep.order}: ${currentStep.name} ──`,
        stepOrder: currentStep.order,
      };
      const moMsg: GuidedMessage = {
        role: 'mo',
        text: currentStep.description,
        stepOrder: currentStep.order,
      };
      setMessages(prev => [...prev, stepMsg, moMsg]);
    }
  }, [activeStepIndex, currentStep, guidance]);

  // ── When agent output arrives, show it ──
  useEffect(() => {
    if (agentOutput && !agentRunning) {
      setMessages(prev => [...prev, {
        role: 'mo',
        text: agentOutput,
        stepOrder: currentStep?.order,
      }]);
    }
  }, [agentOutput, agentRunning]);

  // ── Drag & drop handlers ──
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const dt = e.dataTransfer;
    if (!dt?.files || dt.files.length === 0) return;

    // Filter to images
    const imageFiles = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setMessages(prev => [...prev, {
        role: 'mo',
        text: '⚠️ Only image files are supported. Please drop JPG, PNG, or WebP files.',
        stepOrder: currentStep?.order,
      }]);
      return;
    }

    // Determine which input ID to use for this step
    const stepInputs = currentStep?.stepInputs?.filter(i => i.type === 'upload-images') || [];
    const inputId = stepInputs[0]?.id || 'images';

    // Add files
    onFilesAdded(inputId, imageFiles);

    // Show in chat as user message with thumbnails
    const chatFiles: ChatFile[] = imageFiles.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));

    setMessages(prev => [...prev, {
      role: 'user',
      text: `Dropped ${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''}`,
      files: chatFiles,
      stepOrder: currentStep?.order,
    }]);

    // Auto-acknowledge
    setTimeout(() => {
      const totalNow = totalFilesThisStep + imageFiles.length;
      setMessages(prev => [...prev, {
        role: 'mo',
        text: `📎 Got ${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''}. You now have ${totalNow} total for this step.\n\nDrop more, or click **Check My Work** when you're ready.`,
        stepOrder: currentStep?.order,
      }]);
    }, 300);
  }, [currentStep, onFilesAdded, totalFilesThisStep]);

  // ── File click upload (fallback) ──
  const handleClickUpload = useCallback(() => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = true;
    inp.onchange = () => {
      if (!inp.files || inp.files.length === 0) return;
      const imageFiles = Array.from(inp.files);
      const stepInputs = currentStep?.stepInputs?.filter(i => i.type === 'upload-images') || [];
      const inputId = stepInputs[0]?.id || 'images';
      onFilesAdded(inputId, imageFiles);

      const chatFiles: ChatFile[] = imageFiles.map(f => ({
        file: f,
        previewUrl: URL.createObjectURL(f),
      }));
      setMessages(prev => [...prev, {
        role: 'user',
        text: `Uploaded ${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''}`,
        files: chatFiles,
        stepOrder: currentStep?.order,
      }]);

      setTimeout(() => {
        const totalNow = totalFilesThisStep + imageFiles.length;
        setMessages(prev => [...prev, {
          role: 'mo',
          text: `📎 Got ${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''}. You now have ${totalNow} total for this step.\n\nDrop more, or click **Check My Work** when you're ready.`,
          stepOrder: currentStep?.order,
        }]);
      }, 300);
    };
    inp.click();
  }, [currentStep, onFilesAdded, totalFilesThisStep]);

  // ── Mo validation (Check My Work) ──
  const handleCheckWork = useCallback(async () => {
    if (!guidance?.validationPrompt) {
      // No validation prompt — just approve
      setValidationStatus('approved');
      setMessages(prev => [...prev, {
        role: 'mo',
        text: '✅ Looks good! Ready to move on.',
        stepOrder: currentStep?.order,
        validation: { status: 'approved' },
      }]);
      return;
    }

    setValidationStatus('checking');
    setMessages(prev => [...prev, {
      role: 'mo',
      text: '🔍 Checking your work...',
      stepOrder: currentStep?.order,
    }]);

    try {
      const filesDesc = Object.entries(currentFiles)
        .map(([id, files]) => `${id}: ${files.length} file(s) — ${files.map(f => f.name).join(', ')}`)
        .join('\n');

      const prompt = `${guidance.validationPrompt}

USER UPLOADED:
${filesDesc || '(no files)'}

Respond in this exact JSON format:
{"status": "approved" or "needs-fixes", "feedback": "your assessment", "issues": ["issue1"], "score": 8}
Score 7+ = approved. Only return JSON.`;

      if (!chatRef.current) {
        chatRef.current = GeminiService.createChat('gemini-2.5-flash');
      }

      const response = await Promise.race([
        chatRef.current.sendMessage({ message: prompt }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)),
      ]);

      const text = (response as any)?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        const isApproved = result.status === 'approved' || (result.score && result.score >= 7);
        setValidationStatus(isApproved ? 'approved' : 'needs-fixes');

        let feedback = isApproved ? '✅ ' : '⚠️ ';
        feedback += result.feedback || '';
        if (result.issues?.length > 0 && !isApproved) {
          feedback += '\n\n' + result.issues.map((i: string) => `• ${i}`).join('\n');
        }
        if (isApproved && guidance.nextStepTip) {
          feedback += `\n\n→ ${guidance.nextStepTip}`;
        }

        setMessages(prev => [...prev, {
          role: 'mo',
          text: feedback,
          stepOrder: currentStep?.order,
          validation: { status: isApproved ? 'approved' : 'needs-fixes', score: result.score },
        }]);
      } else {
        setValidationStatus('approved');
        setMessages(prev => [...prev, {
          role: 'mo',
          text: `✅ ${text}`,
          stepOrder: currentStep?.order,
          validation: { status: 'approved' },
        }]);
      }
    } catch (err: any) {
      setValidationStatus('needs-fixes');
      setMessages(prev => [...prev, {
        role: 'mo',
        text: `⚠️ Couldn't validate: ${err?.message || 'Unknown error'}. You can skip and continue anyway.`,
        stepOrder: currentStep?.order,
      }]);
    }
  }, [guidance, currentStep, currentFiles]);

  // ── Send text message ──
  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg, stepOrder: currentStep?.order }]);
    setLoading(true);

    try {
      if (!chatRef.current) {
        chatRef.current = GeminiService.createChat('gemini-2.5-flash',
          `You are Mo, the AI coach. Current step: ${currentStep?.name}. ${currentStep?.description}`
        );
      }
      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, {
        role: 'mo',
        text: (response as any)?.text || 'No response',
        stepOrder: currentStep?.order,
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'mo',
        text: `Error: ${err?.message || 'Unknown'}`,
        stepOrder: currentStep?.order,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentStep]);

  // ── Render ──
  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-white relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Drag overlay ── */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#91569c]/10 border-2 border-dashed border-[#91569c] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-lg px-8 py-6 text-center">
            <i className="fa-solid fa-cloud-arrow-up text-3xl text-[#91569c] mb-2" />
            <p className="text-sm font-black text-[#5c3a62] uppercase tracking-wide">
              Drop images here
            </p>
            <p className="text-[10px] text-[#888] mt-1">
              Step {currentStep?.order}: {currentStep?.name}
            </p>
          </div>
        </div>
      )}

      {/* ── Messages area ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i}>
            {/* System divider */}
            {m.role === 'system' && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-[#e0d6e3]" />
                <span className="text-[9px] font-black uppercase tracking-wider text-[#91569c] bg-[#f6f0f8] px-3 py-1 rounded-full">
                  {m.text}
                </span>
                <div className="flex-1 h-px bg-[#e0d6e3]" />
              </div>
            )}

            {/* Mo message */}
            {m.role === 'mo' && (
              <div className="flex items-start gap-2.5 max-w-[85%]">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f6f0f8] to-[#eadcef] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TensorAxIcon className="w-4 h-4 text-[#91569c]" />
                </div>
                <div className={`rounded-xl px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap ${
                  m.validation?.status === 'approved'
                    ? 'bg-green-50 border border-green-200 text-green-900'
                    : m.validation?.status === 'needs-fixes'
                    ? 'bg-amber-50 border border-amber-200 text-amber-900'
                    : 'bg-[#f6f0f8] text-[#333] border border-[#e0d6e3]'
                }`}>
                  {/* Render markdown bold */}
                  {m.text.split(/(\*\*[^*]+\*\*)/).map((part, pi) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={pi}>{part.slice(2, -2)}</strong>
                      : part
                  )}
                </div>
              </div>
            )}

            {/* User message */}
            {m.role === 'user' && (
              <div className="flex flex-col items-end">
                <div className="max-w-[85%]">
                  {/* File thumbnails */}
                  {m.files && m.files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end mb-1.5">
                      {m.files.map((f, fi) => (
                        <img
                          key={fi}
                          src={f.previewUrl}
                          alt={f.file.name}
                          className="w-16 h-16 object-cover rounded-lg border border-[#91569c]/30"
                        />
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl px-4 py-2.5 text-[11px] leading-relaxed bg-[#91569c] text-white">
                    {m.text}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {(loading || agentRunning) && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f6f0f8] to-[#eadcef] flex items-center justify-center flex-shrink-0">
              <TensorAxIcon className="w-4 h-4 text-[#91569c]" spinning />
            </div>
            <div className="bg-[#f6f0f8] rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#91569c] border border-[#e0d6e3] animate-pulse">
              {agentRunning ? (
                <><i className="fa-solid fa-wand-magic-sparkles mr-1.5" />Agents working...</>
              ) : (
                <><i className="fa-solid fa-comment-dots mr-1.5" />Mo is thinking...</>
              )}
            </div>
          </div>
        )}

        {/* Validation checking animation */}
        {validationStatus === 'checking' && !loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-magnifying-glass text-amber-600 text-[10px]" />
            </div>
            <div className="bg-amber-50 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200 animate-pulse">
              <i className="fa-solid fa-spinner fa-spin mr-1.5" />Validating your work...
            </div>
          </div>
        )}
      </div>

      {/* ── Action bar (contextual buttons) ── */}
      <div className="px-6 py-2 border-t border-[#f0eff0] bg-[#faf8fb] flex items-center gap-2 flex-wrap">
        {/* Upload steps: show action buttons */}
        {isUploadStep && validationStatus !== 'approved' && (
          <>
            <button
              onClick={handleClickUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#e0d6e3] hover:border-[#91569c]/40 hover:bg-[#f6f0f8] text-[#5c3a62] text-[9px] font-black uppercase tracking-wider transition-all"
            >
              <i className="fa-solid fa-cloud-arrow-up text-[8px] text-[#91569c]" />
              Upload Files
            </button>
            {totalFilesThisStep > 0 && validationStatus !== 'checking' && (
              <button
                onClick={handleCheckWork}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#91569c] hover:bg-[#7a4685] text-white text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm"
              >
                <i className="fa-solid fa-magnifying-glass text-[8px]" />
                Check My Work
              </button>
            )}
            {totalFilesThisStep > 0 && (
              <span className="text-[9px] font-bold text-[#91569c] bg-[#f6f0f8] px-2 py-1 rounded-full">
                {totalFilesThisStep} file{totalFilesThisStep !== 1 ? 's' : ''}
              </span>
            )}
          </>
        )}

        {/* Upload step approved: show Continue */}
        {isUploadStep && validationStatus === 'approved' && (
          <button
            onClick={onStepApproved}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm"
          >
            <i className="fa-solid fa-arrow-right text-[8px]" />
            Continue to Next Step
          </button>
        )}

        {/* Upload step needs-fixes: show Skip Anyway */}
        {isUploadStep && validationStatus === 'needs-fixes' && (
          <>
            <button
              onClick={handleCheckWork}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#91569c] hover:bg-[#7a4685] text-white text-[9px] font-black uppercase tracking-wider transition-colors"
            >
              <i className="fa-solid fa-rotate-left text-[8px]" />
              Re-check
            </button>
            <button
              onClick={() => { setValidationStatus('approved'); onStepSkipped(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-wider transition-all"
            >
              <i className="fa-solid fa-forward text-[8px]" />
              Skip Anyway
            </button>
          </>
        )}

        {/* Agent steps: show Run Step */}
        {!isUploadStep && !agentRunning && !agentInReview && !agentOutput && (
          <button
            onClick={onRunAgentStep}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#91569c] hover:bg-[#7a4685] text-white text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm"
          >
            <i className="fa-solid fa-play text-[8px]" />
            Run Step
          </button>
        )}

        {/* Agent step in review: show Approve / Reject */}
        {agentInReview && (
          <>
            <button
              onClick={onStepApproved}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm"
            >
              <i className="fa-solid fa-check text-[8px]" />
              Approve & Continue
            </button>
            <button
              onClick={onStepSkipped}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-wider transition-all"
            >
              <i className="fa-solid fa-rotate-left text-[8px]" />
              Reject & Retry
            </button>
          </>
        )}
      </div>

      {/* ── Text input ── */}
      <div className="px-4 py-3 border-t border-[#e0d6e3]">
        <div className="relative">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClickUpload}
              className="w-8 h-8 rounded-lg bg-[#f6f0f8] hover:bg-[#eadcef] flex items-center justify-center text-[#91569c] transition-colors flex-shrink-0"
              title="Upload files"
            >
              <i className="fa-solid fa-paperclip text-xs" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                e.stopPropagation();
              }}
              placeholder="Type a message or drop images here..."
              rows={1}
              className="flex-1 bg-[#f6f0f8] border border-[#e0d6e3] rounded-xl py-2.5 px-4 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#91569c]/50 text-[#333] placeholder:text-[#bbb] resize-none leading-relaxed"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-lg bg-[#91569c] hover:bg-[#7a4685] flex items-center justify-center text-white transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-paper-plane text-[10px]" />
            </button>
          </div>
          <p className="text-[8px] text-[#bbb] mt-1 ml-10">
            Enter to send. Shift+Enter for new line. Drag & drop files into the chat.
          </p>
        </div>
      </div>
    </div>
  );
};
