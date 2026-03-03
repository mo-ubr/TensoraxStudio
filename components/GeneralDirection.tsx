import React, { useState } from 'react';
import { GeneralDirection as GeneralDirectionType, BrandProfile } from '../types';

interface GeneralDirectionProps {
  value: GeneralDirectionType;
  onChange: (value: GeneralDirectionType) => void;
  activeBrand: BrandProfile | undefined;
  onGeneratePrompt: (feedback?: string) => void;
  onRegenerateSingleIdea?: (ideaNum: number, currentIdeas: { num: number; title: string; body: string }[], feedback?: { rating?: 'like' | 'neutral' | 'dislike'; comment?: string }) => void;
  isGenerating: boolean;
  regeneratingIdeaNum?: number | null;
  onSaveAndCreateScript?: (title: string, concept: string, directions: string) => void;
  isSaving?: boolean;
}

const emptyDirection: GeneralDirectionType = {
  projectName: '',
  aim: '',
  videoType: 'promo',
  format: '9:16',
  duration: '1.5min',
  tone: 'warm',
  cta: '',
  targetAudience: '',
  styleVideos: [],
  characterConsistency: '',
  sceneryConsistency: '',
  styleGuide: '',
  toolPreferences: '',
  additionalNotes: '',
  generatedPrompt: '',
};

const TEST_DIRECTION: GeneralDirectionType = {
  projectName: 'NEXT Gift CARD',
  aim: 'Create a 90s video showcasing the benefit for friends and family to buy gift cards instead of presents for the kids, because kids grow fast.',
  videoType: 'explainer',
  format: '9:16',
  duration: '1.5min',
  tone: 'warm',
  cta: 'Ask for gift cards, not presents',
  targetAudience: 'Parents of young children, expecting parents',
  styleVideos: [
    { url: 'https://drive.google.com/drive/folders/1lQxi6QEQk8bG9m24hA2IDDYNyvFx_nB8', file: '' },
  ],
  characterConsistency: '',
  sceneryConsistency: '',
  styleGuide: '',
  toolPreferences: '',
  additionalNotes: '',
  generatedPrompt: '',
};

export { emptyDirection };

const IDEA_MODEL_KEY = 'tensorax_idea_model';
const IDEA_APIKEY_KEY = 'tensorax_idea_apiKey';

export const getIdeaFactoryModel = (): string | null => localStorage.getItem(IDEA_MODEL_KEY);
export const getIdeaFactoryApiKey = (): string | null => localStorage.getItem(IDEA_APIKEY_KEY);

export const GENERAL_DIRECTION_SYSTEM_PROMPT = (direction: GeneralDirectionType, brand: BrandProfile | undefined) => `You are a senior creative director. Generate exactly 5 video concept ideas.

CRITICAL: The PROJECT BRIEF below is your PRIMARY instruction. Every idea MUST directly implement what the brief describes. Do NOT invent your own story — follow the brief's specific direction. If the brief says "show a growing child" then EVERY idea shows a growing child. If the brief says "show gift cards from relatives" then EVERY idea shows that. Vary only the creative TREATMENT (editing style, pacing, visual approach, narrative structure) — NOT the core content.

---

## PROJECT BRIEF (follow this EXACTLY)

${direction.aim || '(not specified)'}

---

## PROJECT DETAILS

Project name: ${direction.projectName || '(not specified)'}
Video type: ${direction.videoType}
Format: ${direction.format}
Duration: ${direction.duration}
Tone: ${direction.tone}
${direction.cta ? `CTA: ${direction.cta}` : ''}
${direction.targetAudience ? `Target audience: ${direction.targetAudience}` : ''}
${direction.styleVideos?.filter(v => v.url).map((v, i) => `Style inspiration ${i + 1}: ${v.url}`).join('\n') || ''}
${brand ? `Brand: ${brand.name}` : 'Brand: (none selected)'}
${brand ? `Brand colours: ${brand.colour}` : ''}
${brand ? `Brand typography: ${brand.typography}` : ''}

---

For EACH idea, use this exact format:

## Idea 1: [Creative Title]
**Summary:** [2-3 sentence overview of the concept — what's the story, what's the hook?]
**Key Scenes:** [4-5 key visual moments that would make up the video, described cinematically]
**Visual Style:** [Describe the visual treatment: colour palette, lighting mood, camera style, film stock feel]
**Why It Works:** [1 sentence on why this concept fits the brand, audience, and CTA]

## Idea 2: [Creative Title]
...and so on for all 5 ideas.

Rules:
- ALL 5 ideas must faithfully implement the PROJECT BRIEF — same core story elements, same characters, same message
- Vary ONLY the creative treatment: editing rhythm, visual metaphors, pacing, narrative structure, camera approach
- Keep it simple and uncomplicated as the brief requests — no overcomplication
- Ideas must be feasible with AI video generation tools (Veo, Kling, Imagen)
- Be very specific about scenes — describe exactly what is shown frame by frame
${brand ? `- Integrate the ${brand.name} brand naturally (logo placement, brand colours, typography style)` : ''}`;

export const SINGLE_IDEA_REGEN_PROMPT = (
  ideaNum: number,
  allIdeas: { num: number; title: string; body: string }[],
  direction: GeneralDirectionType,
  brand: BrandProfile | undefined,
  feedback?: { rating?: 'like' | 'neutral' | 'dislike'; comment?: string }
) => {
  const otherIdeas = allIdeas.filter(i => i.num !== ideaNum);
  const otherSummaries = otherIdeas.map(i => `- "${i.title}": ${i.body.slice(0, 120)}...`).join('\n');
  const replacedIdea = allIdeas.find(i => i.num === ideaNum);

  const feedbackLines: string[] = [];
  if (replacedIdea) {
    feedbackLines.push(`\n## IDEA BEING REPLACED\n\nTitle: "${replacedIdea.title}"\nContent: ${replacedIdea.body.slice(0, 300)}...`);
  }
  if (feedback?.rating) {
    const ratingLabel = feedback.rating === 'like' ? 'LIKED (keep the direction but give a fresh spin)'
      : feedback.rating === 'dislike' ? 'DISLIKED (take a completely different approach)'
      : 'NEUTRAL (improve it significantly)';
    feedbackLines.push(`\nUser rating: ${ratingLabel}`);
  }
  if (feedback?.comment?.trim()) {
    feedbackLines.push(`User feedback: "${feedback.comment.trim()}" — incorporate this feedback into the new idea.`);
  }

  return `You are a senior creative director. Generate exactly 1 replacement video concept idea.

CRITICAL: Follow the PROJECT BRIEF below EXACTLY. Do NOT invent your own story.

---

## PROJECT BRIEF (follow this EXACTLY)

${direction.aim || '(not specified)'}

---

## PROJECT DETAILS

Project name: ${direction.projectName || '(not specified)'}
Video type: ${direction.videoType}
Format: ${direction.format}
Duration: ${direction.duration}
Tone: ${direction.tone}
${direction.cta ? `CTA: ${direction.cta}` : ''}
${direction.targetAudience ? `Target audience: ${direction.targetAudience}` : ''}
${brand ? `Brand: ${brand.name}` : 'Brand: (none selected)'}
${brand ? `Brand colours: ${brand.colour}` : ''}
${brand ? `Brand typography: ${brand.typography}` : ''}

---

## EXISTING IDEAS (do NOT duplicate these — your idea must be DIFFERENT)

${otherSummaries}
${feedbackLines.length > 0 ? '\n---\n' + feedbackLines.join('\n') : ''}

---

Generate exactly 1 new idea using this format:

## Idea ${ideaNum}: [Creative Title]
**Summary:** [2-3 sentence overview]
**Key Scenes:** [4-5 key visual moments described cinematically]
**Visual Style:** [Colour palette, lighting, camera style]
**Why It Works:** [1 sentence on why this fits]

Rules:
- Must be completely distinct from all existing ideas listed above
- Must faithfully follow the PROJECT BRIEF
- Keep it simple and uncomplicated
- Feasible with AI video generation tools (Veo, Kling, Imagen)
- Be very specific about scenes
${feedback?.comment ? '- Address the user feedback above directly in the new idea' : ''}
${brand ? `- Integrate the ${brand.name} brand naturally` : ''}`;
};

const StyleInspirations: React.FC<{ value: GeneralDirectionType; onChange: (v: GeneralDirectionType) => void }> = ({ value, onChange }) => {
  return (
    <div className="mt-2.5">
      <label className="block text-[9px] font-bold text-[#d4cdd7]/80 uppercase tracking-wide mb-1.5">
        Style Inspirations <span className="text-[#d4cdd7]/40 font-normal">(up to 3)</span>
      </label>
      {(value.styleVideos || []).map((sv, i) => (
        <div key={i} className="mb-2 flex items-center gap-1.5">
          <span className="text-[8px] font-black text-[#91569c] uppercase tracking-wider w-3">{i + 1}</span>
          <input
            type="text"
            value={sv.url}
            onChange={(e) => {
              const updated = [...(value.styleVideos || [])];
              updated[i] = { ...updated[i], url: e.target.value };
              onChange({ ...value, styleVideos: updated });
            }}
            placeholder="Paste video URL (YouTube, Drive, etc.)..."
            className="flex-1 bg-[#3d3444] border border-[#5c4a63] rounded px-2 py-1.5 text-[9px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none"
          />
          <button
            onClick={() => {
              const updated = (value.styleVideos || []).filter((_, j) => j !== i);
              onChange({ ...value, styleVideos: updated });
            }}
            className="text-red-400/50 hover:text-red-400 transition-colors p-0.5"
            title="Remove"
          >
            <i className="fa-solid fa-xmark text-[9px]"></i>
          </button>
        </div>
      ))}
      {(value.styleVideos || []).length < 3 && (
        <button
          onClick={() => {
            const updated = [...(value.styleVideos || []), { url: '', file: '' }];
            onChange({ ...value, styleVideos: updated });
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[#5c4a63] text-[9px] font-bold text-[#d4cdd7]/60 hover:text-[#91569c] hover:border-[#91569c]/40 transition-colors"
        >
          <i className="fa-solid fa-plus text-[8px]"></i>
          Add Style Inspiration
        </button>
      )}
    </div>
  );
};

export const GeneralDirection: React.FC<GeneralDirectionProps> = ({
  value,
  onChange,
  activeBrand,
  onGeneratePrompt,
  onRegenerateSingleIdea,
  isGenerating,
  regeneratingIdeaNum,
  onSaveAndCreateScript,
  isSaving,
}) => {
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [ratings, setRatings] = useState<Record<number, 'like' | 'neutral' | 'dislike'>>({});
  const [feedbackNotes, setFeedbackNotes] = useState<Record<number, string>>({});
  const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
  const [finetuneMode, setFinetuneMode] = useState(false);
  const [finetuneText, setFinetuneText] = useState('');
  const [finetuneTitle, setFinetuneTitle] = useState('');
  const [finetuneDirection, setFinetuneDirection] = useState('');
  const [rejectionLog, setRejectionLog] = useState<string[]>([]);
  const [likedLog, setLikedLog] = useState<string[]>([]);
  const [deletedIdeas, setDeletedIdeas] = useState<Set<number>>(new Set());
  const [editingIdea, setEditingIdea] = useState<number | null>(null);
  const [editedBodies, setEditedBodies] = useState<Record<number, string>>({});
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [ideaModel, setIdeaModel] = useState(() => localStorage.getItem(IDEA_MODEL_KEY) || '');
  const [ideaApiKey, setIdeaApiKey] = useState(() => localStorage.getItem(IDEA_APIKEY_KEY) || '');

  const deleteIdea = (idea: { num: number; title: string; body: string }) => {
    const summary = `"${idea.title}" — ${idea.body.slice(0, 150)}...`;
    setRejectionLog(prev => [...prev, summary]);
    setDeletedIdeas(prev => new Set(prev).add(idea.num));
  };

  const buildFeedbackPrompt = (ideas: { num: number; title: string; body: string }[]) => {
    const newRejections: string[] = [];
    const newLikes: string[] = [];

    for (const idea of ideas) {
      if (deletedIdeas.has(idea.num)) continue;
      const rating = ratings[idea.num];
      const note = feedbackNotes[idea.num];
      if (rating === 'dislike') {
        newRejections.push(`"${idea.title}"${note ? ` — user said: "${note}"` : ''}`);
      } else if (rating === 'like') {
        newLikes.push(`"${idea.title}"${note ? ` — user said: "${note}"` : ''}: ${idea.body.slice(0, 200)}`);
      }
    }

    setRejectionLog(prev => [...prev, ...newRejections]);
    setLikedLog(prev => [...prev, ...newLikes]);

    const allRejections = [...rejectionLog, ...newRejections];
    const allLikes = [...likedLog, ...newLikes];

    const lines: string[] = [];

    if (allRejections.length > 0) {
      lines.push('=== REJECTED IDEAS (DO NOT recreate these or anything similar) ===');
      allRejections.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
      lines.push('');
    }

    if (allLikes.length > 0) {
      lines.push('=== LIKED IDEAS (generate new ideas in THIS direction) ===');
      allLikes.forEach((l, i) => lines.push(`${i + 1}. ${l}`));
      lines.push('');
    }

    const currentFeedback = ideas.filter(idea => !deletedIdeas.has(idea.num)).map(idea => {
      const rating = ratings[idea.num];
      const note = feedbackNotes[idea.num];
      if (!rating && !note) return null;
      const emoji = rating === 'like' ? 'LIKED' : rating === 'dislike' ? 'DISLIKED' : rating === 'neutral' ? 'NEUTRAL' : '';
      return `- "${idea.title}": ${emoji}${note ? ` — "${note}"` : ''}`;
    }).filter(Boolean);

    if (currentFeedback.length > 0) {
      lines.push('=== CURRENT ROUND FEEDBACK ===');
      lines.push(...(currentFeedback as string[]));
      lines.push('');
    }

    const numToReplace = deletedIdeas.size || 5;
    lines.push(`Generate exactly ${numToReplace} completely NEW ideas that:`);
    lines.push('- Are NOTHING like any rejected idea above — different story, different angle, different approach');
    lines.push('- Explore the DIRECTION of liked ideas — but with fresh creative spins, not copies');
    lines.push('- Each new idea must be distinct from all others and from the kept ideas');
    lines.push('- Incorporate specific user feedback notes');
    lines.push(`- Number them starting from Idea 1 through Idea ${numToReplace}`);

    return lines.join('\n');
  };

  const [keptIdeas, setKeptIdeas] = useState<{ num: number; title: string; body: string }[]>([]);

  const update = (field: keyof GeneralDirectionType, val: string) => {
    onChange({ ...value, [field]: val });
  };

  const hasContent = value.projectName || value.aim;
  const prevPromptRef = React.useRef(value.generatedPrompt);

  React.useEffect(() => {
    if (finetuneMode && value.generatedPrompt && value.generatedPrompt !== prevPromptRef.current) {
      setFinetuneText(value.generatedPrompt);
      setFinetuneDirection('');
    }
    prevPromptRef.current = value.generatedPrompt;
  }, [value.generatedPrompt, finetuneMode]);

  const handleGenerate = (feedback?: string, currentIdeas?: { num: number; title: string; body: string }[]) => {
    if (currentIdeas) {
      const kept = currentIdeas.filter(idea => !deletedIdeas.has(idea.num) && ratings[idea.num] === 'like');
      setKeptIdeas(kept);
    } else {
      setKeptIdeas([]);
    }
    setRatings({});
    setFeedbackNotes({});
    setSelectedIdea(null);
    setDeletedIdeas(new Set());
    onGeneratePrompt(feedback);
  };

  return (
    <div className="flex gap-3 h-full min-h-0">
      {/* LEFT: Form */}
      <aside className="w-[38%] min-w-[280px] max-w-[420px] h-full bg-[#2d2633] border border-[#6b5873] rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#5c4a63] flex-shrink-0 flex items-center justify-between">
          <h2 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-compass text-[#91569c]"></i>
            General Direction
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyModal(!showKeyModal)}
              className={`p-1.5 rounded-lg transition-colors relative ${ideaApiKey ? 'text-[#91569c]' : 'text-red-400/70 hover:text-red-400'}`}
              title={ideaApiKey ? `AI: ${ideaModel || 'claude-sonnet-4-6'}` : 'Set AI model & key for Idea Factory'}
            >
              <i className="fa-solid fa-robot text-xs"></i>
              {!ideaApiKey && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-400 rounded-full"></span>}
            </button>
            <button
              onClick={() => setShowPromptPreview(!showPromptPreview)}
              className={`p-1.5 rounded-lg transition-colors ${showPromptPreview ? 'bg-[#91569c]/20 text-[#91569c]' : 'text-[#d4cdd7]/60 hover:text-[#d4cdd7]'}`}
              title="Preview system prompt"
            >
              <i className="fa-solid fa-eye text-xs"></i>
            </button>
            <button
              onClick={() => {
                const exported = JSON.stringify(value, null, 2);
                const blob = new Blob([exported], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${value.projectName || 'general-direction'}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-1.5 rounded-lg text-[#d4cdd7]/60 hover:text-[#d4cdd7] transition-colors"
              title="Export as JSON"
            >
              <i className="fa-solid fa-download text-xs"></i>
            </button>
            <button
              onClick={() => onChange(TEST_DIRECTION)}
              className="px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-[#91569c]/10 text-[#91569c]/70 hover:text-[#91569c] hover:bg-[#91569c]/20 border border-[#91569c]/20 transition-colors"
              title="Load test data"
            >
              Load test
            </button>
          </div>
        </div>

        {showKeyModal && (
          <div className="p-3 border-b border-[#5c4a63] bg-[#4A4A4A] flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#91569c]">
                <i className="fa-solid fa-robot text-[8px] mr-1"></i>
                Idea Factory AI
              </span>
              <button onClick={() => setShowKeyModal(false)} className="text-[#d4cdd7]/40 hover:text-[#d4cdd7] transition-colors">
                <i className="fa-solid fa-xmark text-[10px]"></i>
              </button>
            </div>
            <div>
              <label className="block text-[8px] font-bold text-[#d4cdd7]/70 uppercase tracking-wide mb-0.5">Model</label>
              <input
                type="text"
                value={ideaModel}
                onChange={(e) => setIdeaModel(e.target.value)}
                placeholder="claude-sonnet-4-6"
                className="w-full bg-[#3d3444] border border-[#5c4a63] rounded px-2.5 py-1.5 text-[10px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-[#d4cdd7]/70 uppercase tracking-wide mb-0.5">API Key</label>
              <p className="text-[7px] text-[#d4cdd7]/40 mb-0.5">Separate from Scenes — Claude key for creative text, Gemini key for image analysis.</p>
              <input
                type="password"
                value={ideaApiKey}
                onChange={(e) => setIdeaApiKey(e.target.value)}
                placeholder="Enter your Anthropic API key..."
                className="w-full bg-[#3d3444] border border-[#5c4a63] rounded px-2.5 py-1.5 text-[10px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none"
              />
            </div>
            <button
              onClick={() => {
                localStorage.setItem(IDEA_MODEL_KEY, ideaModel);
                localStorage.setItem(IDEA_APIKEY_KEY, ideaApiKey);
                setShowKeyModal(false);
              }}
              className="w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#91569c] text-[#edecec] hover:bg-[#d4af1c] transition-all flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-floppy-disk text-[8px]"></i>
              Save
            </button>
            {ideaApiKey && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <i className="fa-solid fa-circle-check text-green-400 text-[8px]"></i>
                <span className="text-[8px] text-green-400/80">{ideaModel || 'claude-sonnet-4-6'} ready</span>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <i className="fa-solid fa-folder-open text-[#91569c] text-[9px]"></i>
              Project Name
            </label>
            <input
              type="text"
              value={value.projectName}
              onChange={(e) => update('projectName', e.target.value)}
              placeholder="e.g. NEXT Summer Campaign 2026"
              className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-3 py-2 text-[11px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none"
            />
          </div>

          {/* Project Aim */}
          <div>
            <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-bullseye text-[#91569c] text-[9px]"></i>
              Project Aim
            </label>
            <p className="text-[#d4cdd7]/60 text-[9px] mb-1.5">Define the overarching goal: what should the video achieve?</p>
            <textarea
              value={value.aim}
              onChange={(e) => update('aim', e.target.value)}
              placeholder="e.g. Create a 90-second brand video showcasing the new kidswear collection with consistent characters across all scenes..."
              rows={8}
              className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-3 py-2 text-[11px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
            />
          </div>

          {/* CTA & Target Audience */}
          <div>
            <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-bullhorn text-[#91569c] text-[9px]"></i>
              Call to Action
            </label>
            <input type="text" value={value.cta} onChange={(e) => update('cta', e.target.value)} placeholder="e.g. Visit our stores, Shop now, Sign up for loyalty card" className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-3 py-2 text-[11px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-users text-[#91569c] text-[9px]"></i>
              Target Audience
            </label>
            <input type="text" value={value.targetAudience} onChange={(e) => update('targetAudience', e.target.value)} placeholder="e.g. Parents of kids 0-10, expecting parents" className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-3 py-2 text-[11px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none" />
          </div>

          {/* Settings */}
          <div className="border-t border-[#5c4a63]/40 pt-3">
            <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <i className="fa-solid fa-sliders text-[#91569c] text-[9px]"></i>
              Settings
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[9px] font-bold text-[#d4cdd7]/80 uppercase tracking-wide mb-1">Video Type</label>
                <select value={value.videoType} onChange={(e) => update('videoType', e.target.value)} className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-2.5 py-1.5 text-[10px] text-[#edecec] focus:ring-1 focus:ring-[#91569c]/50 outline-none cursor-pointer">
                  <option value="explainer">Explainer</option>
                  <option value="promo">Promo / Ad</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="testimonial">Testimonial</option>
                  <option value="brand">Brand Story</option>
                  <option value="product">Product Showcase</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-[#d4cdd7]/80 uppercase tracking-wide mb-1">Format</label>
                <select value={value.format} onChange={(e) => update('format', e.target.value)} className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-2.5 py-1.5 text-[10px] text-[#edecec] focus:ring-1 focus:ring-[#91569c]/50 outline-none cursor-pointer">
                  <option value="9:16">9:16 (YT Short, TT, IG)</option>
                  <option value="16:9">16:9 (YT, Website)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-[#d4cdd7]/80 uppercase tracking-wide mb-1">Duration</label>
                <select value={value.duration} onChange={(e) => update('duration', e.target.value)} className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-2.5 py-1.5 text-[10px] text-[#edecec] focus:ring-1 focus:ring-[#91569c]/50 outline-none cursor-pointer">
                  <option value="1.5min">1.5 min (Short form)</option>
                  <option value="3min">3 min (Long form)</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-[#d4cdd7]/80 uppercase tracking-wide mb-1">Tone</label>
                <select value={value.tone} onChange={(e) => update('tone', e.target.value)} className="w-full bg-[#3d3444] border border-[#5c4a63] rounded-lg px-2.5 py-1.5 text-[10px] text-[#edecec] focus:ring-1 focus:ring-[#91569c]/50 outline-none cursor-pointer">
                  <option value="warm">Warm &amp; Emotional</option>
                  <option value="energetic">Energetic</option>
                  <option value="professional">Professional</option>
                  <option value="playful">Playful</option>
                  <option value="dramatic">Dramatic</option>
                  <option value="inspirational">Inspirational</option>
                </select>
              </div>
            </div>

            <StyleInspirations value={value} onChange={onChange} />
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-[#5c4a63] flex-shrink-0">
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating || !hasContent || finetuneMode}
            className="w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-[#edecec] hover:bg-[#d4af1c] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-lightbulb'}`}></i>
            {isGenerating ? 'Generating Ideas...' : 'Generate 5 Ideas'}
          </button>
        </div>
      </aside>

      {/* RIGHT: Idea Factory / Finetune */}
      <main className="flex-1 min-w-0 h-full bg-[#2d2633] border border-[#6b5873] rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#5c4a63] flex-shrink-0 flex items-center justify-between">
          <h2 className="text-base font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <i className={`fa-solid ${finetuneMode ? 'fa-wand-magic-sparkles' : 'fa-lightbulb'} text-[#91569c]`}></i>
            {finetuneMode ? 'Finetuning' : 'Idea Factory'}
          </h2>
          {finetuneMode && (
            <button
              onClick={() => setFinetuneMode(false)}
              className="text-[9px] font-bold uppercase tracking-wider text-[#d4cdd7]/60 hover:text-[#91569c] transition-colors flex items-center gap-1"
            >
              <i className="fa-solid fa-arrow-left text-[8px]"></i>
              Back to Ideas
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {finetuneMode ? (
            <div className="space-y-4">
              <div className="bg-[#4A4A4A] border border-[#91569c]/30 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-[#3A3A3A] border-b border-[#4a3a52]">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#91569c] flex items-center justify-center text-[#edecec] text-xs font-black"><i className="fa-solid fa-check text-[9px]"></i></span>
                  <input
                    type="text"
                    value={finetuneTitle}
                    onChange={(e) => setFinetuneTitle(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] font-bold text-white outline-none border-b border-transparent focus:border-[#91569c]/40"
                  />
                </div>
                <div className="p-4">
                  <textarea
                    value={finetuneText}
                    onChange={(e) => setFinetuneText(e.target.value)}
                    rows={16}
                    className="w-full bg-[#3A3A3A] border border-[#4a3a52] rounded-lg p-3 text-[11px] text-[#d4cdd7] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y font-sans"
                  />
                </div>
              </div>

              <div className="bg-[#4A4A4A] border border-[#4a3a52] rounded-xl p-4">
                <label className="block text-[10px] font-bold text-white uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-pen text-[#91569c] text-[9px]"></i>
                  Additional Directions <span className="font-normal text-[#d4cdd7]/40">(optional)</span>
                </label>
                <textarea
                  value={finetuneDirection}
                  onChange={(e) => setFinetuneDirection(e.target.value)}
                  placeholder="e.g. Make the ending more emotional, add a scene in a NEXT store, change the character to a grandmother..."
                  rows={2}
                  className="w-full bg-[#3A3A3A] border border-[#4a3a52] rounded-lg p-3 text-[11px] text-[#d4cdd7] placeholder:text-[#5c4a63] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-none"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onSaveAndCreateScript?.(finetuneTitle, finetuneText, finetuneDirection)}
                    disabled={isSaving || isGenerating || !finetuneText.trim()}
                    className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-[#edecec] hover:bg-[#d4af1c] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                    {isSaving ? 'Saving & Creating...' : 'Save & Create Script'}
                  </button>
                </div>
              </div>
            </div>
          ) : value.generatedPrompt ? (
            <div className="space-y-4">
              {(() => {
                const text = value.generatedPrompt;
                const ideaBlocks: { num: number; title: string; body: string }[] = [];
                const pattern = /(?:^|\n)#{1,3}\s*(?:\*\*)?(?:Idea|Concept)\s*(\d+)[:\s\-–.]*(.*?)(?:\*\*)?(?=\n)/gi;
                const headings: { index: number; num: number; title: string }[] = [];
                let m;
                while ((m = pattern.exec(text)) !== null) {
                  headings.push({ index: m.index, num: parseInt(m[1]), title: m[2].replace(/\*\*/g, '').trim() });
                }
                if (headings.length === 0) {
                  const altPattern = /(?:^|\n)\*?\*?(\d+)\.\s*(.*?)(?:\*\*)?(?=\n)/g;
                  while ((m = altPattern.exec(text)) !== null) {
                    headings.push({ index: m.index, num: parseInt(m[1]), title: m[2].replace(/\*\*/g, '').trim() });
                  }
                }
                for (let i = 0; i < headings.length; i++) {
                  const start = text.indexOf('\n', headings[i].index) + 1;
                  const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
                  ideaBlocks.push({ num: headings[i].num, title: headings[i].title, body: text.slice(start, end).trim() });
                }
                if (ideaBlocks.length === 0) {
                  ideaBlocks.push({ num: 1, title: 'Response', body: text });
                }

                if (keptIdeas.length > 0) {
                  const maxKeptNum = Math.max(...keptIdeas.map(k => k.num));
                  ideaBlocks.forEach((idea, idx) => { idea.num = maxKeptNum + idx + 1; });
                  ideaBlocks.unshift(...keptIdeas);
                }

                const hasFeedback = Object.keys(ratings).length > 0 || deletedIdeas.size > 0;

                const visibleIdeas = ideaBlocks.filter(idea => !deletedIdeas.has(idea.num));

                return (<>
                {rejectionLog.length > 0 && (
                  <div className="bg-[#3A3A3A] border border-[#4a3a52] rounded-lg px-3 py-2 mb-1">
                    <span className="text-[8px] font-black uppercase tracking-wider text-red-400/60">
                      <i className="fa-solid fa-ban text-[7px] mr-1"></i>
                      {rejectionLog.length} idea{rejectionLog.length > 1 ? 's' : ''} rejected (AI will avoid these)
                    </span>
                  </div>
                )}
                {visibleIdeas.map((idea, i) => {
                  const isKept = keptIdeas.some(k => k.num === idea.num && k.title === idea.title);
                  const sections = idea.body.split(/\n\*\*([^*]+)\*\*:?\s*/);
                  const parsed: { label: string; content: string }[] = [];
                  for (let s = 1; s < sections.length; s += 2) {
                    if (sections[s + 1] !== undefined) {
                      parsed.push({ label: sections[s].trim(), content: sections[s + 1].trim() });
                    }
                  }
                  const hasStructured = parsed.length > 0;
                  return (
                    <div key={i} className={`bg-[#4A4A4A] border rounded-xl overflow-hidden transition-colors ${isKept ? 'border-[#91569c]/40 ring-1 ring-[#91569c]/20' : 'border-[#4a3a52] hover:border-[#91569c]/30'}`}>
                      <div className="flex items-center gap-3 px-4 py-3 bg-[#3A3A3A] border-b border-[#4a3a52]">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#91569c] flex items-center justify-center text-[#edecec] text-xs font-black">{isKept ? <i className="fa-solid fa-heart text-[10px]"></i> : idea.num}</span>
                        <h3 className="flex-1 text-[13px] font-bold text-white leading-snug">{idea.title || `Idea ${idea.num}`}</h3>
                        {isKept && <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c]/60 bg-[#91569c]/10 px-1.5 py-0.5 rounded">kept</span>}
                        <button
                          onClick={() => {
                            if (editingIdea === idea.num) {
                              if (editedBodies[idea.num] !== undefined) {
                                idea.body = editedBodies[idea.num];
                              }
                              setEditingIdea(null);
                            } else {
                              setEditedBodies(prev => ({ ...prev, [idea.num]: idea.body }));
                              setEditingIdea(idea.num);
                            }
                          }}
                          className={`p-1 rounded transition-colors ${
                            editingIdea === idea.num
                              ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20'
                              : 'text-[#d4cdd7]/40 hover:text-[#91569c]'
                          }`}
                          title={editingIdea === idea.num ? 'Save edits' : 'Edit idea'}
                        >
                          <i className={`fa-solid ${editingIdea === idea.num ? 'fa-check' : 'fa-pencil'} text-[10px]`}></i>
                        </button>
                        <button
                          onClick={() => { deleteIdea(idea); if (isKept) setKeptIdeas(prev => prev.filter(k => k.num !== idea.num || k.title !== idea.title)); }}
                          className="text-red-400/40 hover:text-red-400 transition-colors p-1"
                          title="Delete — AI will never suggest this again"
                        >
                          <i className="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                      </div>
                      <div className="p-4">
                        {editingIdea === idea.num ? (
                          <textarea
                            value={editedBodies[idea.num] ?? idea.body}
                            onChange={(e) => setEditedBodies(prev => ({ ...prev, [idea.num]: e.target.value }))}
                            rows={14}
                            className="w-full bg-[#3A3A3A] border border-[#91569c]/30 rounded-lg p-3 text-[11px] text-[#d4cdd7] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y font-sans"
                            autoFocus
                          />
                        ) : hasStructured ? (
                          <div className="space-y-2.5">
                            {parsed.map((sec, j) => (
                              <div key={j}>
                                <span className="text-[9px] font-black uppercase tracking-wider text-[#91569c]/70">{sec.label}</span>
                                <p className="text-[11px] text-[#d4cdd7] leading-relaxed mt-0.5">{sec.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <pre className="text-[11px] text-[#d4cdd7]/80 whitespace-pre-wrap font-sans leading-relaxed">{idea.body}</pre>
                        )}
                      </div>
                      <div className="px-4 py-2.5 bg-[#3A3A3A] border-t border-[#4a3a52] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {([
                              { key: 'like' as const, icon: '😊', title: 'Like' },
                              { key: 'neutral' as const, icon: '😐', title: 'Neutral' },
                              { key: 'dislike' as const, icon: '😞', title: 'Dislike' },
                            ]).map(({ key, icon, title }) => (
                              <button
                                key={key}
                                onClick={() => setRatings(prev => ({ ...prev, [idea.num]: prev[idea.num] === key ? undefined as any : key }))}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${
                                  ratings[idea.num] === key
                                    ? 'bg-[#91569c]/20 scale-110 ring-1 ring-[#91569c]/40'
                                    : 'hover:bg-[#4A4A4A] opacity-50 hover:opacity-100'
                                }`}
                                title={title}
                              >
                                {icon}
                              </button>
                            ))}
                            <div className="w-px h-5 bg-[#4a3a52] mx-0.5"></div>
                            <button
                              onClick={() => onRegenerateSingleIdea?.(idea.num, visibleIdeas, {
                                rating: ratings[idea.num],
                                comment: feedbackNotes[idea.num],
                              })}
                              disabled={isGenerating || (regeneratingIdeaNum != null)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all text-[#d4cdd7]/40 hover:text-[#91569c] hover:bg-[#4A4A4A] disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Regenerate this idea"
                            >
                              <i className={`fa-solid ${regeneratingIdeaNum === idea.num ? 'fa-spinner fa-spin' : 'fa-rotate-right'} text-[10px]`}></i>
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedIdea(idea.num);
                              setFinetuneTitle(idea.title);
                              setFinetuneText(editedBodies[idea.num] ?? idea.body);
                              setFinetuneDirection(feedbackNotes[idea.num] || '');
                              setFinetuneMode(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all bg-[#2d2633] text-[#91569c] border border-[#91569c]/40 hover:bg-[#91569c]/10"
                          >
                            <i className="fa-solid fa-hand-pointer text-[8px] mr-1"></i>
                            Select
                          </button>
                        </div>
                        <input
                          type="text"
                          value={feedbackNotes[idea.num] || ''}
                          onChange={(e) => setFeedbackNotes(prev => ({ ...prev, [idea.num]: e.target.value }))}
                          placeholder="Feedback on this idea..."
                          className="w-full bg-[#4A4A4A] border border-[#4a3a52] rounded px-2.5 py-1.5 text-[10px] text-[#d4cdd7] placeholder:text-[#5c4a63] focus:ring-1 focus:ring-[#91569c]/50 outline-none"
                        />
                      </div>
                    </div>
                  );
                })}

                {hasFeedback && (
                  <button
                    onClick={() => handleGenerate(buildFeedbackPrompt(ideaBlocks), ideaBlocks)}
                    disabled={isGenerating}
                    className="w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#4A4A4A] text-[#91569c] hover:bg-[#2d2633] border border-[#91569c]/30 hover:border-[#91569c]/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] mt-2"
                  >
                    <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`}></i>
                    {isGenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
                  </button>
                )}
                </>);
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <i className="fa-solid fa-lightbulb text-5xl text-[#5c4a63] mb-4"></i>
              <p className="text-[#d4cdd7]/60 text-sm font-bold uppercase tracking-widest mb-2">Idea Factory</p>
              <p className="text-[#d4cdd7]/40 text-xs max-w-md leading-relaxed">
                Fill in the project details and click "Generate 5 Ideas". The AI will create 5 unique video concept ideas based on your brief, brand, and style inspirations.
              </p>
              {activeBrand && (
                <div className="mt-4 flex items-center gap-2 bg-[#3A3A3A] px-3 py-1.5 rounded-lg border border-[#4a3a52]">
                  <i className="fa-solid fa-tag text-[#91569c] text-[10px]"></i>
                  <span className="text-[10px] text-[#d4cdd7]">Brand: <strong className="text-white">{activeBrand.name}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
