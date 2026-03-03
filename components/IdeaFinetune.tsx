import React, { useState, useRef, useEffect } from 'react';
import { ConceptIdea } from '../types';

interface FinetuneMessage {
  role: 'user' | 'ai';
  text: string;
}

interface IdeaFinetuneProps {
  selectedIdea: ConceptIdea;
  refinedConcept: string;
  onRefine: (direction: string) => Promise<string>;
  onUpdateConcept: (concept: string) => void;
  onFinalize: () => void;
  onBack: () => void;
  isRefining: boolean;
}

export const IdeaFinetune: React.FC<IdeaFinetuneProps> = ({
  selectedIdea,
  refinedConcept,
  onRefine,
  onUpdateConcept,
  onFinalize,
  onBack,
  isRefining,
}) => {
  const [direction, setDirection] = useState('');
  const [messages, setMessages] = useState<FinetuneMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmitDirection = async () => {
    const text = direction.trim();
    if (!text || isRefining) return;
    setDirection('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    try {
      const refined = await onRefine(text);
      setMessages((prev) => [...prev, { role: 'ai', text: refined }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `Error: ${e?.message || 'Refinement failed'}` },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Selected Idea Header */}
        <div className="bg-white border border-[#91569c]/30 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-star text-[#91569c]"></i>
              Selected Concept
            </h3>
            <button
              onClick={onBack}
              className="text-[9px] font-black uppercase tracking-wider text-[#91569c]/80 hover:text-[#91569c] transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i> Back to Ideas
            </button>
          </div>
          <h4 className="text-xs font-heading font-bold text-[#5c3a62] uppercase tracking-wide mb-1">
            {selectedIdea.title}
          </h4>
          <p className="text-[10px] text-[#3a3a3a] leading-relaxed">{selectedIdea.summary}</p>
        </div>

        {/* Editable Concept */}
        <div className="bg-white border border-[#e0d6e3]/80 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-file-pen text-[#91569c]"></i>
              Refined Concept
            </h3>
            <span className="text-[9px] text-[#3a3a3a]/60 font-bold uppercase">Editable</span>
          </div>
          <textarea
            value={refinedConcept}
            onChange={(e) => onUpdateConcept(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            rows={8}
            className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#91569c]/50 outline-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/50 resize-y min-h-[8rem]"
            placeholder="The refined concept will appear here..."
          />
        </div>

        {/* Refinement Chat */}
        <div className="bg-white border border-[#e0d6e3]/80 p-4 rounded-xl space-y-3">
          <h3 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-comments text-[#91569c]"></i>
            Refinement Chat
          </h3>
          <p className="text-[9px] text-[#3a3a3a]/60">
            Give directions to refine the concept. The AI will update based on your feedback.
          </p>

          {messages.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg bg-[#edecec]/30 p-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#91569c]/20 text-[#3a3a3a] border border-[#91569c]/30'
                        : 'bg-[#edecec] text-[#888] border border-[#ceadd4]'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <i
                        className={`fa-solid ${
                          msg.role === 'user' ? 'fa-user' : 'fa-robot'
                        } text-[8px] opacity-60`}
                      ></i>
                      <span className="text-[8px] font-black uppercase tracking-wider opacity-60">
                        {msg.role === 'user' ? 'You' : 'AI'}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isRefining && (
                <div className="flex justify-start">
                  <div className="bg-[#edecec] text-[#888] border border-[#ceadd4] rounded-xl px-3 py-2 text-[11px]">
                    <i className="fa-solid fa-spinner fa-spin mr-1 text-[#91569c]"></i> Refining...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitDirection();
                }
              }}
              rows={2}
              className="flex-1 bg-white border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] focus:ring-1 focus:ring-[#91569c]/50 outline-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/50 resize-none"
              placeholder="e.g. Make the tone more playful, add a scene with the baby crawling..."
            />
            <button
              onClick={handleSubmitDirection}
              disabled={!direction.trim() || isRefining}
              className="self-end px-4 py-2.5 rounded-lg text-[10px] font-black uppercase bg-[#edecec] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#585858] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#e0d6e3]/60 bg-[#edecec] flex-shrink-0">
        <button
          onClick={onFinalize}
          disabled={!refinedConcept.trim()}
          className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 ${
            refinedConcept.trim()
              ? 'bg-[#91569c] hover:bg-[#91569c]/90 text-black'
              : 'bg-white/50 text-[#3a3a3a]/40 cursor-not-allowed'
          }`}
        >
          <i className="fa-solid fa-check-double mr-2"></i>
          Finalise Concept
        </button>
      </div>
    </div>
  );
};
