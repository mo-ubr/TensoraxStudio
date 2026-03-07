
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Chat } from '@google/genai';

const CHAT_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

export interface AssistantAction {
  type: 'set_field' | 'generate_idea' | 'regenerate_idea' | 'accept_concept';
  field?: string;
  value?: string;
  feedback?: string;
}

interface ChatBotProps {
  projectContext?: string;
  onAction?: (action: AssistantAction) => void;
  chatHistoryRef?: React.MutableRefObject<string>;
}

function parseActions(text: string): { cleanText: string; actions: AssistantAction[] } {
  const actions: AssistantAction[] = [];
  const cleaned = text.replace(/\[ACTION:([^\]]+)\]/g, (_match, body: string) => {
    const parts = body.split(':');
    const cmd = parts[0]?.toUpperCase();
    if (cmd === 'SET_FIELD' && parts[1]) {
      actions.push({ type: 'set_field', field: parts[1], value: parts.slice(2).join(':') });
    } else if (cmd === 'GENERATE_IDEA') {
      actions.push({ type: 'generate_idea' });
    } else if (cmd === 'REGENERATE') {
      actions.push({ type: 'regenerate_idea', feedback: parts.slice(1).join(':') });
    } else if (cmd === 'ACCEPT') {
      actions.push({ type: 'accept_concept' });
    }
    return '';
  }).trim();
  return { cleanText: cleaned, actions };
}

export const ChatBot: React.FC<ChatBotProps> = ({ projectContext, onAction, chatHistoryRef }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(CHAT_MODELS[0].id);
  const [hasKey, setHasKey] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<string | undefined>(undefined);
  const greetedRef = useRef(false);

  useEffect(() => {
    setHasKey(GeminiService.hasApiKey());
  }, []);

  useEffect(() => {
    if (hasKey && !chatRef.current) {
      try { chatRef.current = GeminiService.createChat(model, projectContext); } catch { /* key invalid */ }
    }
  }, [hasKey, model]);

  useEffect(() => {
    if (!hasKey) return;
    if (projectContext !== contextRef.current && messages.length === 0) {
      contextRef.current = projectContext;
      try { chatRef.current = GeminiService.createChat(model, projectContext); } catch { /* ignore */ }
    }
    contextRef.current = projectContext;

    if (projectContext && !greetedRef.current && messages.length === 0 && chatRef.current) {
      greetedRef.current = true;
      setLoading(true);
      const greeting = projectContext.includes('GENERATED IDEAS')
        ? 'The user has a generated idea. Read it carefully. In 2-3 SHORT sentences: (1) say what you like about it, (2) ask ONE specific question about whether they want to change anything. Be specific to their content — mention a scene or detail. Do NOT use action commands yet.'
        : projectContext.includes('MISSING REQUIRED')
        ? 'The user just started. Look at the ❌ fields. In 2 SHORT sentences: (1) welcome them, (2) ask about the FIRST missing required field. Explain what it means in simple terms. Do NOT use action commands yet — wait for their answer.'
        : 'All fields look good. In 1-2 sentences, confirm the setup and ask if they want to generate an idea. If yes, use [ACTION:GENERATE_IDEA].';
      chatRef.current.sendMessage({ message: greeting }).then(res => {
        const { cleanText, actions } = parseActions(res.text || '');
        setMessages([{ role: 'model', text: cleanText }]);
        actions.forEach(a => onAction?.(a));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [projectContext, hasKey]);

  // When context changes after ideas are generated, notify the chat
  useEffect(() => {
    if (!hasKey || !projectContext || messages.length === 0) return;
    const hadIdeas = contextRef.current?.includes('GENERATED IDEAS');
    const hasIdeasNow = projectContext.includes('GENERATED IDEAS');
    if (!hadIdeas && hasIdeasNow && chatRef.current) {
      contextRef.current = projectContext;
      setLoading(true);
      chatRef.current.sendMessage({
        message: `The idea has just been generated. Here is the updated context:\n\n${projectContext}\n\nRead the generated idea. In 2-3 SHORT sentences: (1) give your honest first impression — mention a specific scene you like, (2) ask ONE focused question about what the user might want to change. Do NOT use action commands yet.`
      }).then(res => {
        const { cleanText, actions } = parseActions(res.text || '');
        setMessages(prev => [...prev, { role: 'model', text: cleanText }]);
        actions.forEach(a => onAction?.(a));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [projectContext]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  useEffect(() => {
    if (chatHistoryRef) {
      chatHistoryRef.current = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Director'}: ${m.text}`)
        .join('\n');
    }
  }, [messages, chatHistoryRef]);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    chatRef.current = null;
    greetedRef.current = false;
    setMessages([]);
    try { chatRef.current = GeminiService.createChat(newModel, projectContext); } catch { /* ignore */ }
  };

  const processResponse = (text: string) => {
    const { cleanText, actions } = parseActions(text);
    setMessages(prev => [...prev, { role: 'model', text: cleanText }]);
    actions.forEach(a => onAction?.(a));
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (!chatRef.current) {
      try { chatRef.current = GeminiService.createChat(model, projectContext); } catch { /* ignore */ }
      if (!chatRef.current) {
        setMessages(prev => [...prev, { role: 'model', text: 'No API key configured. Set one in Project Settings.' }]);
        return;
      }
    }

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMsg });
      processResponse(response.text || 'No response');
    } catch (err) {
      console.error("Chat error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${msg.length > 120 ? msg.slice(0, 117) + '...' : msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="flex flex-col h-full bg-white border border-[#e0d6e3] rounded-xl w-full overflow-hidden items-center justify-center p-6 text-center">
        <i className="fa-solid fa-robot text-3xl text-[#ceadd4] mb-3"></i>
        <p className="text-xs text-[#888] font-bold uppercase tracking-wider mb-2">Assistant</p>
        <p className="text-[11px] text-[#888] mb-4">Set a Gemini API key to enable the chat assistant</p>
        <button
          onClick={() => {
            const key = prompt('Enter your Gemini API key:');
            if (key?.trim()) {
              GeminiService.setApiKey(key.trim());
              setHasKey(true);
            }
          }}
          className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors"
        >
          <i className="fa-solid fa-key mr-1.5"></i>Set API Key
        </button>
      </div>
    );
  }

  const phase = !projectContext ? 'idle'
    : projectContext.includes('GENERATED IDEAS') ? 'review'
    : projectContext.includes('MISSING REQUIRED') ? 'setup'
    : 'ready';

  return (
    <div className="flex flex-col h-full bg-white border border-[#e0d6e3] rounded-xl w-full overflow-hidden">
      <div className="p-3 border-b border-[#e0d6e3] flex items-center justify-between">
        <h2 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
          <i className="fa-solid fa-comments text-[#91569c]"></i>
          Director
        </h2>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="text-[9px] bg-[#f6f0f8] border border-[#ceadd4] rounded px-2 py-1 text-[#5c3a62] font-bold outline-none cursor-pointer"
        >
          {CHAT_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {phase !== 'idle' && (
        <div className={`px-3 py-1.5 border-b flex items-center gap-1.5 ${
          phase === 'review' ? 'bg-blue-50 border-blue-100' :
          phase === 'setup' ? 'bg-amber-50 border-amber-100' :
          'bg-green-50 border-green-100'
        }`}>
          <i className={`fa-solid text-[8px] ${
            phase === 'review' ? 'fa-film text-blue-500' :
            phase === 'setup' ? 'fa-clipboard-list text-amber-500' :
            'fa-circle-check text-green-500'
          }`}></i>
          <span className={`text-[9px] font-bold ${
            phase === 'review' ? 'text-blue-600' :
            phase === 'setup' ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {phase === 'review' ? 'Reviewing idea — give feedback to refine' :
             phase === 'setup' ? 'Setting up — tell me about your project' :
             'Ready to generate'}
          </span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="space-y-3 py-2">
            <div className="bg-[#f6f0f8] rounded-xl px-3 py-2.5 text-[11px] leading-relaxed text-[#3a3a3a] border border-[#e0d6e3]">
              {phase === 'idle'
                ? <>Open <strong>Copy</strong> from the menu to start. I'll guide you through every step.</>
                : <>Loading your project...</>
              }
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-[#91569c] text-white'
                : 'bg-[#f6f0f8] text-[#3a3a3a] border border-[#e0d6e3]'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#f6f0f8] rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider animate-pulse text-[#91569c] border border-[#e0d6e3]">
              <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i>Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#e0d6e3]">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } e.stopPropagation(); }}
            placeholder={phase === 'review' ? "Tell me what to change... (Shift+Enter for new line)" : phase === 'setup' ? "Describe your project... (Shift+Enter for new line)" : "Ask the director... (Shift+Enter for new line)"}
            rows={3}
            className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg py-2.5 pl-3 pr-10 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#91569c]/50 text-[#3a3a3a] placeholder:text-[#ceadd4] resize-none leading-relaxed"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="absolute right-2 bottom-2 text-[#ceadd4] hover:text-[#91569c] transition-colors p-1 disabled:opacity-30"
          >
            <i className="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
};
