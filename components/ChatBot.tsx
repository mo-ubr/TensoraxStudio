
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Chat } from '@google/genai';

const CHAT_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

export const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(CHAT_MODELS[0].id);
  const [hasKey, setHasKey] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasKey(GeminiService.hasApiKey());
  }, []);

  useEffect(() => {
    if (hasKey && !chatRef.current) {
      try { chatRef.current = GeminiService.createChat(model); } catch { /* key invalid */ }
    }
  }, [hasKey, model]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    chatRef.current = null;
    setMessages([]);
    try { chatRef.current = GeminiService.createChat(newModel); } catch { /* ignore */ }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (!chatRef.current) {
      try { chatRef.current = GeminiService.createChat(model); } catch { /* ignore */ }
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
      setMessages(prev => [...prev, { role: 'model', text: response.text || "No response" }]);
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

  return (
    <div className="flex flex-col h-full bg-white border border-[#e0d6e3] rounded-xl w-full overflow-hidden">
      <div className="p-3 border-b border-[#e0d6e3] flex items-center justify-between">
        <h2 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
          <i className="fa-solid fa-comments text-[#91569c]"></i>
          Assistant
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 opacity-50">
            <i className="fa-solid fa-wand-magic-sparkles text-2xl text-[#ceadd4] mb-2 block"></i>
            <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider">Ask me anything</p>
            <p className="text-[9px] text-[#ceadd4] mt-1">I can help with concepts, prompts, characters, and more</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
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
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#e0d6e3]">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } e.stopPropagation(); }}
            placeholder="Ask the assistant..."
            className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg py-2.5 pl-3 pr-10 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#91569c]/50 text-[#3a3a3a] placeholder:text-[#ceadd4]"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#ceadd4] hover:text-[#91569c] transition-colors p-1 disabled:opacity-30"
          >
            <i className="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
};
