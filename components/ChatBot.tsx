
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Chat } from '@google/genai';

const ASSISTANT_INSTRUCTIONS = (
  <>
    <p className="font-black text-[#0d0d0d] mb-2">Role</p>
    <p className="text-[#0d0d0d] text-[11px] leading-relaxed mb-3">
      Award-winning trailer director + cinematographer + storyboard artist. You guide the full AI video production pipeline &mdash; from reference images through frame composition to final video generation.
    </p>
    <p className="font-black text-[#0d0d0d] mb-1">Non-negotiable rules</p>
    <ol className="list-decimal list-inside text-[#0d0d0d] text-[10px] leading-relaxed space-y-1 mb-3">
      <li>Analyse ALL subjects &amp; spatial relationships.</li>
      <li>Do NOT guess identities, locations, or brands.</li>
      <li>Strict continuity: same subjects, wardrobe, environment, lighting across all outputs.</li>
      <li>Realistic DOF (deep in wides, shallow in close-ups). One consistent colour grade.</li>
      <li>Never introduce new characters/objects not in the references.</li>
    </ol>

    <div className="border-t border-[#8A8A8A]/40 pt-2 mt-2 mb-2">
      <p className="font-black text-[#0d0d0d] text-[10px] uppercase tracking-wider mb-1">Phase 1 &mdash; Frame Composition</p>
    </div>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed mb-1">
      Generate a 3&times;3 Cinematic Contact Sheet (9 keyframes):
    </p>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed mb-0.5 font-semibold">Row 1 (Establishing):</p>
    <ul className="list-none text-[#0d0d0d] text-[10px] leading-relaxed space-y-0 mb-1.5 pl-0">
      <li>1. ELS &ndash; subject(s) small in vast environment</li>
      <li>2. LS &ndash; full subject head to toe</li>
      <li>3. MLS &ndash; knees up or 3/4 view</li>
    </ul>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed mb-0.5 font-semibold">Row 2 (Core coverage):</p>
    <ul className="list-none text-[#0d0d0d] text-[10px] leading-relaxed space-y-0 mb-1.5 pl-0">
      <li>4. MS &ndash; waist up, interaction/action</li>
      <li>5. MCU &ndash; chest up, intimate</li>
      <li>6. CU &ndash; face(s) or front of object</li>
    </ul>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed mb-0.5 font-semibold">Row 3 (Details &amp; angles):</p>
    <ul className="list-none text-[#0d0d0d] text-[10px] leading-relaxed space-y-0 mb-2 pl-0">
      <li>7. ECU &ndash; macro detail (eyes, hands, logo)</li>
      <li>8. Low angle &ndash; looking up, imposing</li>
      <li>9. High angle &ndash; looking down</li>
    </ul>

    <div className="border-t border-[#8A8A8A]/40 pt-2 mt-1 mb-2">
      <p className="font-black text-[#0d0d0d] text-[10px] uppercase tracking-wider mb-1">Phase 2 &mdash; Video Generation</p>
    </div>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed mb-1">
      Select keyframes as Start/Mid/End &rarr; write motion prompts:
    </p>
    <ul className="list-none text-[#0d0d0d] text-[10px] leading-relaxed space-y-0.5 mb-1.5 pl-0">
      <li>&bull; Veo: 3&ndash;4 keyframes, interpolated motion (5s/10s)</li>
      <li>&bull; Kling: Start + End frame + optional motion ref (5s/10s)</li>
    </ul>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed mb-0.5 font-semibold">Video prompt structure:</p>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed mb-1.5 italic">
      [Camera move]. [Subject action]. [Environment motion]. [Lighting]. [Tempo]. [Style].
    </p>
    <ul className="list-none text-[#0d0d0d] text-[10px] leading-relaxed space-y-0.5 mb-2 pl-0">
      <li>&bull; Describe <strong>motion</strong>, not static composition</li>
      <li>&bull; Camera: dolly, pan, tilt, track, crane, static lock</li>
      <li>&bull; Tempo: slow-mo, real-time, time-lapse</li>
      <li>&bull; Ambient: wind, fabric, leaves, light shifts</li>
      <li>&bull; Keep under 80 words, cinematic &amp; technical</li>
    </ul>
    <p className="text-[#0d0d0d] text-[10px] leading-relaxed">
      Consistency across all frames &amp; video segments. Match exit frame of segment N with entry of N+1. Audio/SFX added in post.
    </p>
  </>
);

const LogoSvg = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path d="M0 40 L50 10 L100 40 L100 55 L50 25 L0 55 Z" />
    <path d="M0 60 L33 60 L33 90 L0 90 Z" />
    <path d="M40 45 L60 45 L60 85 L50 95 L40 85 Z" />
    <path d="M67 60 L100 60 L100 90 L67 90 Z" />
  </svg>
);
const LogoIcon = ({ className = "w-6 h-6" }: { className?: string }) => {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) return <LogoSvg className={className} />;
  return <img src="/logo.png" alt="TensorAx" className={className} onError={() => setImgFailed(true)} />;
};

export const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = GeminiService.createChat();
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !chatRef.current) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || "No response" }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI assistant." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#5A5A5A] border border-[#9A9A9A] rounded-xl w-full overflow-hidden">
      <div className="p-4 border-b border-[#8A8A8A]">
        <h2 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
          <i className="fa-solid fa-comments text-[#E6C01F]"></i>
          Tensorax Assistant
        </h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-[#D7D7D7] mt-6 px-2 space-y-4">
            <div className="bg-[#B0B0B0] rounded-lg p-3 text-left">
              {ASSISTANT_INSTRUCTIONS}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
              m.role === 'user' ? 'bg-[#B0B0B0] text-[#0d0d0d]' : 'bg-[#B0B0B0] text-[#0d0d0d] border border-[#8A8A8A]'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#B0B0B0]/80 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest animate-pulse text-[#0d0d0d] border border-[#8A8A8A]">
              Processing...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#8A8A8A] bg-[#5A5A5A]">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendMessage())}
            placeholder="Input instructions..."
            className="w-full bg-[#B0B0B0]/80 border border-[#8A8A8A] rounded-lg py-2.5 pl-3 pr-10 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#E6C01F]/50 text-[#0d0d0d] placeholder:text-[#0d0d0d]/70"
          />
          <button
            onClick={sendMessage}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#0d0d0d] hover:text-[#E6C01F] transition-colors p-1.5"
          >
            <i className="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
};
