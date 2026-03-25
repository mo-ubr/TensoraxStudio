/**
 * MasterOrchestrator — Primary chat panel for the Studio screen
 *
 * Full-width conversational interface that can dispatch templates,
 * compose pipelines, and route single-agent tasks. Supports file
 * drag-and-drop for images/videos.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GeminiService, hasStoredKeyForType } from '../services/geminiService';
import {
  buildMasterSystemPrompt,
  parseMasterActions,
  type MasterAction,
  type MasterChatMessage,
  type PipelinePlan,
  type FileAttachment,
} from '../services/orchestratorService';
import { PipelineComposer } from './PipelineComposer';
import { AgentCataloguePanel } from './AgentCataloguePanel';
import type { BrandProfile } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MasterOrchestratorProps {
  projectContext?: Record<string, unknown> | null;
  brand?: BrandProfile | null;
  onAction: (action: MasterAction) => void;
  onRunPipeline?: (plan: PipelinePlan) => void;
  chatHistoryRef?: React.MutableRefObject<string>;
}

const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export const MasterOrchestrator: React.FC<MasterOrchestratorProps> = ({
  projectContext,
  brand,
  onAction,
  onRunPipeline,
  chatHistoryRef,
}) => {
  const [messages, setMessages] = useState<MasterChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [model, setModel] = useState(MODELS[0].id);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Export chat history
  useEffect(() => {
    if (chatHistoryRef) {
      chatHistoryRef.current = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Orchestrator'}: ${m.text}`)
        .join('\n');
    }
  }, [messages, chatHistoryRef]);

  // Greeting on first load
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: "Welcome to the Studio. I'm your Master Orchestrator — I can launch templates, compose custom pipelines, or route tasks to any of our 43 specialised agents.\n\nWhat would you like to create?",
        timestamp: Date.now(),
      }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Send Message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && pendingFiles.length === 0) return;
    if (loading) return;

    // Check API key
    const hasKey = hasStoredKeyForType('analysis');
    if (!hasKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'No Gemini API key found. Please set one in Settings before using the Studio.',
        timestamp: Date.now(),
      }]);
      return;
    }

    // Build user message with file context
    let userText = text;
    if (pendingFiles.length > 0) {
      const fileNames = pendingFiles.map(f => f.name).join(', ');
      userText = `${text}\n\n[Attached files: ${fileNames}]`;
    }

    // Add user message
    const userMsg: MasterChatMessage = {
      role: 'user',
      text: userText,
      timestamp: Date.now(),
      attachments: pendingFiles.length > 0 ? [...pendingFiles] : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingFiles([]);
    setLoading(true);
    setLoadingElapsed(0);

    // Start elapsed timer
    loadingTimerRef.current = setInterval(() => {
      setLoadingElapsed(prev => prev + 1);
    }, 1000);

    try {
      // Create or reuse chat session
      if (!chatRef.current) {
        const systemPrompt = buildMasterSystemPrompt(projectContext, brand);
        chatRef.current = GeminiService.createChat(model, systemPrompt);
      }

      // Send to Gemini with timeout (60s)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 60 seconds. The model may be overloaded — try again.')), 60000)
      );
      const response = await Promise.race([
        chatRef.current.sendMessage({ message: userText }),
        timeoutPromise,
      ]);
      const rawText = response?.text || 'No response received.';

      // Parse actions
      const { cleanText, actions } = parseMasterActions(rawText);

      // Check for inline pipeline plan
      const pipelineAction = actions.find(a => a.type === 'show_pipeline');

      // Add assistant message
      const assistantMsg: MasterChatMessage = {
        role: 'assistant',
        text: cleanText || 'The orchestrator processed your request.',
        timestamp: Date.now(),
        inlinePlan: pipelineAction?.pipelinePlan,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Dispatch non-pipeline actions
      for (const action of actions) {
        if (action.type !== 'show_pipeline') {
          onAction(action);
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to get response from Gemini.';
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${errMsg.length > 200 ? errMsg.slice(0, 197) + '...' : errMsg}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setLoadingElapsed(0);
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
  }, [input, pendingFiles, loading, model, projectContext, brand, onAction]);

  // ─── File Drop Handlers ────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingFiles(prev => [...prev, {
            name: file.name,
            type: file.type,
            dataUri: reader.result as string,
          }]);
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const removePendingFile = useCallback((idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // ─── Pipeline Actions ──────────────────────────────────────────────────────

  const handlePipelineApprove = useCallback((plan: PipelinePlan) => {
    onRunPipeline?.(plan);
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: `Pipeline "${plan.name}" approved and starting execution with ${plan.steps.length} steps.`,
      timestamp: Date.now(),
    }]);
  }, [onRunPipeline]);

  const handlePipelineCancel = useCallback(() => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: 'Pipeline cancelled. What would you like to do instead?',
      timestamp: Date.now(),
    }]);
  }, []);

  // ─── Key Handler ───────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ─── Reset chat when model changes ─────────────────────────────────────────

  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel);
    chatRef.current = null;
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full bg-[#edecec]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Command Bar */}
      <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-[#e0d6e3] flex items-center gap-3">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-robot text-[#91569c]" />
          <span className="text-xs font-black uppercase tracking-wider text-[#5c3a62]">Master Orchestrator</span>
        </div>

        <div className="flex-1" />

        {/* Quick Actions */}
        <button
          onClick={() => onAction({ type: 'navigate', screen: 'template-library' })}
          className="px-3 py-1.5 rounded-lg border border-[#e0d6e3] text-[9px] font-bold uppercase tracking-wider text-[#888] hover:border-[#91569c] hover:text-[#91569c] transition-colors"
        >
          <i className="fa-solid fa-shapes mr-1.5" />Templates
        </button>
        <button
          onClick={() => setShowCatalogue(true)}
          className="px-3 py-1.5 rounded-lg border border-[#e0d6e3] text-[9px] font-bold uppercase tracking-wider text-[#888] hover:border-[#91569c] hover:text-[#91569c] transition-colors"
        >
          <i className="fa-solid fa-users mr-1.5" />Agent Catalogue
        </button>

        {/* Model Selector */}
        <select
          value={model}
          onChange={e => handleModelChange(e.target.value)}
          className="text-[9px] px-2 py-1.5 rounded-lg border border-[#e0d6e3] text-[#888] bg-white focus:outline-none focus:border-[#91569c]"
        >
          {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-6 py-4 space-y-4 ${isDragging ? 'ring-2 ring-[#91569c] ring-inset bg-[#f6f0f8]/30' : ''}`}
      >
        {isDragging && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <i className="fa-solid fa-cloud-arrow-up text-4xl text-[#91569c] mb-2" />
              <p className="text-xs font-bold text-[#91569c] uppercase tracking-wider">Drop files here</p>
              <p className="text-[9px] text-[#aaa]">Images and videos supported</p>
            </div>
          </div>
        )}

        {!isDragging && messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-last' : ''}`}>
              {/* Avatar + Name */}
              <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-[#91569c] flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-robot text-[8px] text-white" />
                  </div>
                )}
                <span className="text-[8px] font-bold uppercase tracking-wider text-[#aaa]">
                  {msg.role === 'user' ? 'You' : 'Orchestrator'}
                </span>
              </div>

              {/* Message Bubble */}
              <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#91569c] text-white rounded-tr-sm'
                  : 'bg-white border border-[#e0d6e3] text-[#333] rounded-tl-sm'
              }`}>
                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {msg.attachments.map((f, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-white/20">
                        {f.type.startsWith('image/') ? (
                          <img src={f.dataUri} alt={f.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-black/20 flex items-center justify-center">
                            <i className="fa-solid fa-video text-white/60" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Text */}
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>

              {/* Inline Pipeline Plan */}
              {msg.inlinePlan && (
                <PipelineComposer
                  plan={msg.inlinePlan}
                  onApprove={handlePipelineApprove}
                  onModify={(p) => onRunPipeline?.(p)}
                  onCancel={handlePipelineCancel}
                />
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator with elapsed time */}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-[#91569c] flex items-center justify-center flex-shrink-0 mt-1">
                <i className="fa-solid fa-robot text-[8px] text-white animate-pulse" />
              </div>
              <div>
                <div className="bg-white border border-[#e0d6e3] rounded-xl px-4 py-3 rounded-tl-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#91569c] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#91569c] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[#91569c] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[10px] text-[#aaa] font-bold uppercase tracking-wider">
                      {loadingElapsed < 5 ? 'Thinking...' :
                       loadingElapsed < 15 ? 'Processing your request...' :
                       loadingElapsed < 30 ? 'Still working — complex requests take longer...' :
                       'Almost there — hang tight...'}
                    </span>
                  </div>
                </div>
                <span className="text-[8px] text-[#ccc] mt-1 block pl-1">{loadingElapsed}s elapsed</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Files Bar */}
      {pendingFiles.length > 0 && (
        <div className="flex-shrink-0 px-6 py-2 bg-[#f6f0f8] border-t border-[#e0d6e3] flex items-center gap-2 flex-wrap">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 border border-[#e0d6e3]">
              {f.type.startsWith('image/') ? (
                <img src={f.dataUri} alt={f.name} className="w-6 h-6 rounded object-cover" />
              ) : (
                <i className="fa-solid fa-video text-[#91569c] text-[10px]" />
              )}
              <span className="text-[9px] text-[#5c3a62] font-bold truncate max-w-[100px]">{f.name}</span>
              <button onClick={() => removePendingFile(i)} className="text-[#aaa] hover:text-red-500 text-[9px]">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-t border-[#e0d6e3]">
        <div className="flex items-end gap-3">
          {/* File Upload Button */}
          <label className="flex-shrink-0 w-9 h-9 rounded-lg border border-[#e0d6e3] flex items-center justify-center text-[#aaa] hover:border-[#91569c] hover:text-[#91569c] cursor-pointer transition-colors">
            <i className="fa-solid fa-paperclip text-sm" />
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                for (const file of files) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setPendingFiles(prev => [...prev, {
                      name: file.name,
                      type: file.type,
                      dataUri: reader.result as string,
                    }]);
                  };
                  reader.readAsDataURL(file);
                }
                e.target.value = '';
              }}
            />
          </label>

          {/* Text Input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to create, or ask me to run a template..."
            rows={1}
            className="flex-1 resize-none text-sm px-4 py-2.5 border border-[#e0d6e3] rounded-xl focus:outline-none focus:border-[#91569c] focus:ring-1 focus:ring-[#91569c]/20 min-h-[40px] max-h-[120px]"
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={e => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />

          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && pendingFiles.length === 0)}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#91569c] text-white flex items-center justify-center hover:bg-[#7a4785] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-sm`} />
          </button>
        </div>
        <p className="text-[8px] text-[#bbb] mt-1.5 px-12">
          Enter to send, Shift+Enter for newline. Drag & drop images/videos into the chat.
        </p>
      </div>

      {/* Agent Catalogue Modal */}
      {showCatalogue && (
        <AgentCataloguePanel
          onClose={() => setShowCatalogue(false)}
          onSelectAgent={(agentId) => {
            setInput(prev => prev + (prev ? ' ' : '') + `@${agentId} `);
            setShowCatalogue(false);
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
};
