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
import { TensorAxIcon } from './TensorAxIcon';
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

const ACTIVITY_PHRASES = [
  { icon: 'fa-brain', text: 'Analysing request...' },
  { icon: 'fa-route', text: 'Routing to agents...' },
  { icon: 'fa-pen-fancy', text: 'Consulting Copy Director...' },
  { icon: 'fa-palette', text: 'Checking Brand Analyst...' },
  { icon: 'fa-film', text: 'Preparing visual pipeline...' },
  { icon: 'fa-wand-magic-sparkles', text: 'Composing response...' },
  { icon: 'fa-check-double', text: 'Running QA checks...' },
  { icon: 'fa-layer-group', text: 'Assembling output...' },
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

  const [activityIdx, setActivityIdx] = useState(0);
  const [saveProjectPrompt, setSaveProjectPrompt] = useState<{ name: string; saving: boolean } | null>(null);
  const [saveProjectName, setSaveProjectName] = useState('');

  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cycle through activity phrases while loading
  useEffect(() => {
    if (!loading) { setActivityIdx(0); return; }
    const interval = setInterval(() => {
      setActivityIdx(prev => (prev + 1) % ACTIVITY_PHRASES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [loading]);

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

  // Time-based greeting
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const QUICK_ACTIONS = [
    { icon: 'fa-microscope',          label: 'Research',      prompt: 'Research a topic — market trends, competitors, audience, or deep web research' },
    { icon: 'fa-magnifying-glass',    label: 'Analyse',       prompt: 'Analyse something — a document, performance data, content, or a brief' },
    { icon: 'fa-wand-magic-sparkles', label: 'Create',        prompt: 'Create something — copy, images, video, presentations, or a full campaign' },
    { icon: 'fa-folder-tree',         label: 'Organise',      prompt: 'Organise my work — manage projects, assets, schedules, or content plans' },
    { icon: 'fa-paper-plane',         label: 'Communicate',   prompt: 'Help me communicate — distribute content, post to platforms, or prepare outreach' },
  ];

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
      console.log('[MO] Raw Gemini response:', rawText);

      // Parse actions
      const { cleanText, actions } = parseMasterActions(rawText);
      console.log('[MO] Parsed actions:', actions.length, actions.map(a => a.type));
      console.log('[MO] Clean text:', cleanText);

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
        if (action.type === 'suggest_save_project' && action.projectName) {
          setSaveProjectPrompt({ name: action.projectName, saving: false });
          setSaveProjectName(action.projectName);
        } else if (action.type !== 'show_pipeline') {
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

  const ACCEPTED_TYPES = [
    'image/', 'video/',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword',           // .doc
    'application/pdf',
    'text/plain', 'text/markdown',  // .txt, .md
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',      // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  ];

  const isAcceptedFile = (file: File) =>
    ACCEPTED_TYPES.some(t => t.endsWith('/') ? file.type.startsWith(t) : file.type === t)
    || /\.(docx?|pdf|txt|md|csv|xlsx?|pptx?)$/i.test(file.name);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (isAcceptedFile(file)) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingFiles(prev => [...prev, {
            name: file.name,
            type: file.type || 'application/octet-stream',
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

  // ─── Save Project Handler ────────────────────────────────────────────────

  const handleSaveProject = useCallback(async () => {
    if (!saveProjectPrompt || saveProjectPrompt.saving) return;
    const name = saveProjectName.trim();
    if (!name) return;

    setSaveProjectPrompt({ name, saving: true });

    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const savingDir = localStorage.getItem('tensorax_default_asset_dir') || '';

      // Create project via API
      const res = await fetch('/api/db/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description: `Created from chat conversation`,
          metadata: savingDir ? { customDirectory: `${savingDir}/${slug}` } : {},
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const project = await res.json();

      // If a saving directory is set, also set the custom directory
      if (savingDir) {
        await fetch(`/api/db/projects/${project.id}/set-directory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: `${savingDir}/${slug}` }),
        });
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Project "${name}" has been created${savingDir ? ` and will save to ${savingDir}/${slug}` : ''}. You can find it in your Projects list.`,
        timestamp: Date.now(),
      }]);
      setSaveProjectPrompt(null);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Failed to create project: ${err.message || 'Unknown error'}`,
        timestamp: Date.now(),
      }]);
      setSaveProjectPrompt(prev => prev ? { ...prev, saving: false } : null);
    }
  }, [saveProjectPrompt, saveProjectName]);

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
      {/* Status strip — visible when MO is working */}
      {loading && (
        <div className="flex-shrink-0 bg-white border-b border-[#e0d6e3] relative overflow-hidden">
          {/* Animated gradient bar at top */}
          <div className="h-[3px] bg-[#f6f0f8]">
            <div className="h-full bg-gradient-to-r from-[#91569c] via-[#c084fc] to-[#91569c]"
              style={{ width: '40%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
          </div>

          <div className="flex items-center gap-3 px-5 py-2.5">
            {/* Spinning TensorAx icon */}
            <TensorAxIcon className="w-6 h-6 text-[#91569c]" spinning />

            {/* Current activity + step dots */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${ACTIVITY_PHRASES[activityIdx].icon} text-[10px] text-[#91569c]`} />
                <span className="text-[11px] font-bold text-[#5c3a62] truncate">
                  {ACTIVITY_PHRASES[activityIdx].text}
                </span>
              </div>
              {/* Step progress dots */}
              <div className="flex items-center gap-1 mt-1.5">
                {ACTIVITY_PHRASES.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i < activityIdx
                        ? 'bg-[#91569c] w-5'
                        : i === activityIdx
                          ? 'bg-[#c084fc] w-5 animate-pulse'
                          : 'bg-[#e8dced] w-3'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Elapsed timer */}
            <span className="text-[10px] font-mono text-[#ceadd4] flex-shrink-0">{loadingElapsed}s</span>
          </div>
        </div>
      )}

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
              <p className="text-[9px] text-[#aaa]">Images, videos, documents (.docx, .pdf, .xlsx, .pptx)</p>
            </div>
          </div>
        )}

        {/* Hero greeting — shown when no conversation yet */}
        {!isDragging && messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full -mt-4">
            <TensorAxIcon className="w-12 h-12 text-[#91569c]/30 mb-5" spinning={loading} />
            <h1 className="text-3xl font-heading font-light text-[#5c3a62] mb-2">
              Hi, Mariella
            </h1>
            <p className="text-sm text-[#888] mb-1">I am <strong className="text-[#5c3a62]">MO</strong>, Tensorax' Master Orchestrator.</p>
            <p className="text-sm text-[#888] mb-8">What can I do for you today?</p>

            <div className="flex flex-wrap justify-center gap-2 max-w-[640px]">
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.label}
                  onClick={() => {
                    setInput(qa.prompt);
                    inputRef.current?.focus();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#e0d6e3] bg-white text-[11px] font-bold text-[#5c3a62] hover:border-[#91569c] hover:text-[#91569c] hover:shadow-sm transition-all"
                >
                  <i className={`fa-solid ${qa.icon} text-[#91569c]/60`} />
                  {qa.label}
                </button>
              ))}
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
                    <TensorAxIcon className="w-3 h-3 text-white" />
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

        {/* Rich loading indicator with agent activity */}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 w-full max-w-[85%]">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#c084fc] to-[#91569c] flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <TensorAxIcon className="w-4 h-4 text-white" spinning />
              </div>
              <div className="flex-1">
                <div className="bg-white border border-[#e0d6e3] rounded-xl rounded-tl-sm overflow-hidden shadow-sm">
                  {/* Progress bar */}
                  <div className="h-1 bg-[#f6f0f8]">
                    <div
                      className="h-full bg-gradient-to-r from-[#91569c] to-[#c084fc] transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(95, loadingElapsed * 1.6)}%` }}
                    />
                  </div>

                  <div className="px-4 py-3">
                    {/* Current activity */}
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`fa-solid ${ACTIVITY_PHRASES[activityIdx].icon} text-[#91569c] text-xs`} />
                      <span className="text-[11px] font-bold text-[#5c3a62]">
                        {ACTIVITY_PHRASES[activityIdx].text}
                      </span>
                    </div>

                    {/* Agent activity visualization */}
                    <div className="flex items-center gap-1.5 mb-2">
                      {ACTIVITY_PHRASES.slice(0, 6).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            i <= activityIdx
                              ? 'bg-[#91569c] w-6'
                              : i === activityIdx + 1
                                ? 'bg-[#ceadd4] w-4 animate-pulse'
                                : 'bg-[#e8dced] w-3'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Status line */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[#aaa] font-bold uppercase tracking-wider">
                        {loadingElapsed < 5 ? 'Initialising...' :
                         loadingElapsed < 15 ? 'Teams processing...' :
                         loadingElapsed < 30 ? 'Complex request — still working...' :
                         'Almost there — finalising...'}
                      </span>
                      <span className="text-[9px] text-[#ceadd4] font-mono">{loadingElapsed}s</span>
                    </div>
                  </div>
                </div>
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
              ) : f.type.startsWith('video/') ? (
                <i className="fa-solid fa-video text-[#91569c] text-[10px]" />
              ) : (
                <i className={`fa-solid ${
                  /\.docx?$/i.test(f.name) ? 'fa-file-word text-blue-500' :
                  /\.pdf$/i.test(f.name) ? 'fa-file-pdf text-red-500' :
                  /\.xlsx?$/i.test(f.name) ? 'fa-file-excel text-green-600' :
                  /\.pptx?$/i.test(f.name) ? 'fa-file-powerpoint text-orange-500' :
                  'fa-file-lines text-[#91569c]'
                } text-[10px]`} />
              )}
              <span className="text-[9px] text-[#5c3a62] font-bold truncate max-w-[100px]">{f.name}</span>
              <button onClick={() => removePendingFile(i)} className="text-[#aaa] hover:text-red-500 text-[9px]">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save Project Prompt */}
      {saveProjectPrompt && (
        <div className="flex-shrink-0 px-6 py-3 bg-[#f6f0f8] border-t border-[#ceadd4]">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-folder-plus text-[#91569c]" />
            <span className="text-xs font-bold text-[#5c3a62]">Save as project?</span>
            <input
              type="text"
              value={saveProjectName}
              onChange={e => setSaveProjectName(e.target.value)}
              className="flex-1 text-xs px-3 py-1.5 border border-[#ceadd4] rounded-lg focus:outline-none focus:border-[#91569c] bg-white"
              placeholder="Project name..."
              disabled={saveProjectPrompt.saving}
            />
            <button
              onClick={handleSaveProject}
              disabled={saveProjectPrompt.saving || !saveProjectName.trim()}
              className="px-3 py-1.5 rounded-lg bg-[#91569c] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#7a4785] disabled:opacity-40 transition-colors"
            >
              {saveProjectPrompt.saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setSaveProjectPrompt(null)}
              disabled={saveProjectPrompt.saving}
              className="text-[#aaa] hover:text-[#5c3a62] text-xs"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          {localStorage.getItem('tensorax_default_asset_dir') && (
            <p className="text-[9px] text-[#aaa] mt-1 ml-7">
              Will save to: {localStorage.getItem('tensorax_default_asset_dir')}/{saveProjectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '...'}
            </p>
          )}
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
              accept="image/*,video/*,.docx,.doc,.pdf,.txt,.md,.csv,.xlsx,.xls,.pptx,.ppt"
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
            placeholder="Describe what you want to create, or ask me to run a skill..."
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
          Enter to send, Shift+Enter for newline. Drag & drop files into the chat.
        </p>
      </div>

      {/* Teams Modal */}
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
