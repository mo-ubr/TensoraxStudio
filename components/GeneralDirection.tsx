import React, { useState } from 'react';
import { GeneralDirection as GeneralDirectionType, BrandProfile } from '../types';
import { Settings } from '../services/settingsDB';

interface GeneralDirectionProps {
  value: GeneralDirectionType;
  onChange: (value: GeneralDirectionType) => void;
  activeBrand: BrandProfile | undefined;
  onGeneratePrompt: (feedback?: string) => void;
  onRegenerateSingleIdea?: (ideaNum: number, currentIdeas: { num: number; title: string; body: string }[], feedback?: { rating?: 'like' | 'neutral' | 'dislike'; comment?: string }) => void;
  isGenerating: boolean;
  regeneratingIdeaNum?: number | null;
  onSaveAndCreateScript?: (title: string, concept: string, directions: string) => void;
  onSaveFile?: (filename: string, data: string, subfolder?: string) => Promise<void>;
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

export const GENERAL_DIRECTION_SYSTEM_PROMPT = (direction: GeneralDirectionType, brand: BrandProfile | undefined, sourceDocContent?: string, sourceNotes?: string, characterNotes?: string) => {
  const hasSourceDoc = sourceDocContent && sourceDocContent.trim().length > 0;
  const hasSourceNotes = sourceNotes && sourceNotes.trim().length > 0;
  const hasCharNotes = characterNotes && characterNotes.trim().length > 0;
  return `You are a senior creative director. Generate exactly 1 video concept idea.

CRITICAL: The PROJECT BRIEF below is your PRIMARY instruction. The idea MUST directly implement what the brief describes. Do NOT invent your own story — follow the brief's specific direction. If the brief says "show a growing child" then the idea shows a growing child. If the brief says "show gift cards from relatives" then the idea shows that.

---

## PROJECT BRIEF (follow this EXACTLY)

${direction.aim || '(not specified)'}

---
${hasSourceDoc ? `
═══════════════════════════════════════════════════════════════
SOURCE DOCUMENT — THE VIDEO CONCEPT MUST BE BASED ON THIS
═══════════════════════════════════════════════════════════════

The user has uploaded this source document. The concept idea MUST be closely based on this document's content.
${hasSourceNotes ? `
USER'S DIRECTION FOR THIS MATERIAL:
${sourceNotes!.trim()}

Follow the user's direction above as your primary guide for HOW to use the source document.
` : ''}
CRITICAL RULES FOR SOURCE DOCUMENT:
• Follow the document's structure and sequence of points — the video scenes should reflect the document's flow.
• Preserve ALL specific numbers, statistics, percentages, dates, and figures EXACTLY as stated — do NOT round, approximate, or change any numerical data.
• Use the document's key messages, facts, and talking points as the foundation of each scene.
• Do NOT invent facts, claims, or data that are not in the source document.
• If the document contains quotes, product names, or brand-specific terminology, use them verbatim.

--- BEGIN SOURCE DOCUMENT ---
${sourceDocContent}
--- END SOURCE DOCUMENT ---

` : ''}
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
${hasCharNotes ? `Character direction: ${characterNotes!.trim()}` : ''}

---

Use this exact format:

## Idea: [Creative Title]
**Summary:** [2-3 sentence overview of the concept — what's the story, what's the hook?]
**Scene 1 (~Xs):** [Describe the scene — what happens, who appears, camera angle, approximate duration in seconds. If the scene is longer than 8s, note the distinct video clips needed, e.g. "3 clips: establishing shot → close-up dialogue → reaction shot"]
**Scene 2 (~Xs):** [Next scene]
...continue with as many scenes as the concept needs — create enough scenes to cover the full video duration...
**Scene N (~Xs):** [Final scene — include the ending and CTA]
**Visual Style:** [Describe the visual treatment: colour palette, lighting mood, camera style, film stock feel]
**Why It Works:** [1 sentence on why this concept fits the brand, audience, and CTA]

Rules:
- The idea must faithfully implement the PROJECT BRIEF — same core story elements, same characters, same message${hasSourceDoc ? `
- The idea MUST faithfully represent the source document's content — every key point, fact, and figure must be accurately reflected
- Scene descriptions must map to the document's structure and cover all its main points in the same order` : ''}
- Keep it simple and uncomplicated as the brief requests — no overcomplication
- The idea must be feasible with AI video generation tools (Veo, Kling, Imagen) — each tool generates 5-8 second clips, so scenes longer than 8s need multiple clips
- Be very specific about scenes — describe exactly what is shown, include approximate duration for each scene
- Each scene that involves a change in background, scenery, or major action shift should note these transitions so the screenplay can generate separate video prompts for each
- The total of all scene durations must add up to approximately the target video duration
${brand ? `- Integrate the ${brand.name} brand naturally (logo placement, brand colours, typography style)` : ''}`;
};

export const SINGLE_IDEA_REGEN_PROMPT = (
  ideaNum: number,
  allIdeas: { num: number; title: string; body: string }[],
  direction: GeneralDirectionType,
  brand: BrandProfile | undefined,
  feedback?: { rating?: 'like' | 'neutral' | 'dislike'; comment?: string },
  sourceDocContent?: string,
  sourceNotes?: string,
  characterNotes?: string,
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

  const hasSourceDoc = sourceDocContent && sourceDocContent.trim().length > 0;
  const hasSourceNotes = sourceNotes && sourceNotes.trim().length > 0;

  return `You are a senior creative director. Generate exactly 1 replacement video concept idea.

CRITICAL: Follow the PROJECT BRIEF below EXACTLY. Do NOT invent your own story.

---

## PROJECT BRIEF (follow this EXACTLY)

${direction.aim || '(not specified)'}

---
${hasSourceDoc ? `
═══════════════════════════════════════════════════════════════
SOURCE DOCUMENT — THE VIDEO CONCEPT MUST BE BASED ON THIS
═══════════════════════════════════════════════════════════════

The user has uploaded this source document. The concept idea MUST be closely based on this document's content.
${hasSourceNotes ? `
USER'S DIRECTION FOR THIS MATERIAL:
${sourceNotes!.trim()}

Follow the user's direction above as your primary guide for HOW to use the source document.
` : ''}
Preserve ALL specific numbers, statistics, percentages, dates, and figures EXACTLY as stated.
Use the document's key messages and talking points as the foundation. Do NOT invent facts not in the document.

--- BEGIN SOURCE DOCUMENT ---
${sourceDocContent}
--- END SOURCE DOCUMENT ---

` : ''}
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
${characterNotes?.trim() ? `Character direction: ${characterNotes.trim()}` : ''}

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
- Must faithfully follow the PROJECT BRIEF${hasSourceDoc ? `
- MUST faithfully represent the source document's content — every key point, fact, and figure must be accurately reflected` : ''}
- Keep it simple and uncomplicated
- Feasible with AI video generation tools (Veo, Kling, Imagen)
- Be very specific about scenes
${feedback?.comment ? '- Address the user feedback above directly in the new idea' : ''}
${brand ? `- Integrate the ${brand.name} brand naturally` : ''}`;
};

const StyleInspirations: React.FC<{ value: GeneralDirectionType; onChange: (v: GeneralDirectionType) => void }> = ({ value, onChange }) => {
  const [analysing, setAnalysing] = useState<number | null>(null);
  const [analyses, setAnalyses] = useState<Record<number, string>>({});

  const analyseVideo = async (idx: number, url: string) => {
    if (!url.trim()) return;
    setAnalysing(idx);
    try {
      const isVideoUrl = /\.(mp4|mov|avi|webm|mkv|m4v)/i.test(url) || url.includes('video');
      const keyStorageKey = isVideoUrl ? 'tensorax_video_analysis_key' : 'tensorax_analysis_key';
      const modelStorageKey = isVideoUrl ? 'tensorax_video_analysis_model' : 'tensorax_analysis_model';

      const model = (() => {
        try { return localStorage.getItem(modelStorageKey)?.trim() || 'gemini-3.1-pro-preview'; } catch { return 'gemini-3.1-pro-preview'; }
      })();

      const apiKey = Settings.get(`${keyStorageKey}__${model}`)
              || Settings.get(keyStorageKey)
              || Settings.get(`tensorax_analysis_key__${model}`)
              || Settings.get('tensorax_analysis_key')
              || '';
      if (!apiKey) { alert('Set an Analysis API key in Project Settings first.'); setAnalysing(null); return; }

      const res = await fetch('/api/video/analyse-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, apiKey, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      setAnalyses(prev => ({ ...prev, [idx]: data.analysis }));

      const notes = value.additionalNotes || '';
      const header = `\n\n--- STYLE ANALYSIS (${data.mediaType === 'video' ? 'Video' : 'Images'} ${idx + 1}: ${data.mediaName}) ---\n`;
      onChange({ ...value, additionalNotes: notes + header + data.analysis });
    } catch (err: any) {
      alert(`Video analysis failed: ${err.message}`);
    } finally {
      setAnalysing(null);
    }
  };

  return (
    <div className="mt-2.5">
      <label className="block text-[9px] font-bold text-[#888]/80 uppercase tracking-wide mb-1.5">
        Style Inspirations <span className="text-[#888]/40 font-normal">(up to 3)</span>
      </label>
      {(value.styleVideos || []).map((sv, i) => (
        <div key={i} className="mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black text-[#91569c] uppercase tracking-wider w-3">{i + 1}</span>
            <input
              type="text"
              value={sv.url}
              onChange={(e) => {
                const updated = [...(value.styleVideos || [])];
                updated[i] = { ...updated[i], url: e.target.value };
                onChange({ ...value, styleVideos: updated });
              }}
              placeholder="Paste Google Drive video URL..."
              className="flex-1 bg-white border border-[#ceadd4] rounded px-2 py-1.5 text-[9px] text-[#3a3a3a] placeholder:text-[#3a3a3a]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none"
            />
            <button
              onClick={() => analyseVideo(i, sv.url)}
              disabled={analysing !== null || !sv.url.trim()}
              className="px-1.5 py-1 rounded text-[8px] font-bold uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Analyse video: extract frames and get AI style breakdown"
            >
              {analysing === i ? <i className="fa-solid fa-spinner fa-spin text-[8px]"></i> : <i className="fa-solid fa-eye text-[8px]"></i>}
            </button>
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
          {analyses[i] && (
            <div className="ml-4 mt-1 bg-[#f6f0f8] border border-[#ceadd4] rounded p-2 text-[8px] text-[#3a3a3a] max-h-24 overflow-y-auto leading-relaxed">
              <i className="fa-solid fa-circle-check text-green-500 mr-1"></i>
              <span className="font-bold text-[#91569c]">Analysis complete</span> — saved to Screenplays folder & appended to notes
            </div>
          )}
        </div>
      ))}
      {(value.styleVideos || []).length < 3 && (
        <button
          onClick={() => {
            const updated = [...(value.styleVideos || []), { url: '', file: '' }];
            onChange({ ...value, styleVideos: updated });
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[#ceadd4] text-[9px] font-bold text-[#888]/60 hover:text-[#91569c] hover:border-[#91569c]/40 transition-colors"
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
  onSaveFile,
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
  const [savingWord, setSavingWord] = useState(false);
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

  const hasContent = value.aim || value.projectName;
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
      <aside className="w-[38%] min-w-[280px] max-w-[420px] h-full bg-[#edecec] border border-[#e0d6e3] rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#ceadd4] flex-shrink-0 flex items-center justify-between">
          <h2 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-compass text-[#91569c]"></i>
            General Direction
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={async () => {
                try {
                  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = await import('docx');
                  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
                  const borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
                  const settingsRows = [
                    ['Video Type', value.videoType || '—'],
                    ['Format', value.format || '—'],
                    ['Duration', value.duration || '—'],
                    ['Tone', value.tone || '—'],
                  ];
                  const doc = new Document({
                    sections: [{
                      properties: {},
                      children: [
                        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: value.projectName || 'Project Direction', bold: true })] }),
                        new Paragraph({ children: [new TextRun({ text: `Generated by TensorAx Studio — ${new Date().toLocaleDateString()}`, italics: true, color: '888888', size: 18 })] }),
                        new Paragraph({ text: '' }),
                        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Settings', bold: true })] }),
                        new Table({
                          width: { size: 100, type: WidthType.PERCENTAGE },
                          rows: settingsRows.map(([label, val]) => new TableRow({
                            children: [
                              new TableCell({ borders, width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })] }),
                              new TableCell({ borders, width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: val, size: 20 })] })] }),
                            ],
                          })),
                        }),
                        new Paragraph({ text: '' }),
                        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'User Direction', bold: true })] }),
                        new Paragraph({ children: [new TextRun({ text: value.aim || '(not set)', size: 22 })] }),
                        new Paragraph({ text: '' }),
                        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Call to Action', bold: true })] }),
                        new Paragraph({ children: [new TextRun({ text: value.cta || '(not set)', size: 22 })] }),
                        new Paragraph({ text: '' }),
                        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Target Audience', bold: true })] }),
                        new Paragraph({ children: [new TextRun({ text: value.targetAudience || '(not set)', size: 22 })] }),
                        ...(value.styleVideos?.length ? [
                          new Paragraph({ text: '' }),
                          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Style Inspirations', bold: true })] }),
                          ...value.styleVideos.map((sv: { url: string }) => new Paragraph({ children: [new TextRun({ text: sv.url, size: 20, color: '91569c' })] })),
                        ] : []),
                        ...(value.characterConsistency ? [new Paragraph({ text: '' }), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Character Notes', bold: true })] }), new Paragraph({ children: [new TextRun({ text: value.characterConsistency, size: 22 })] })] : []),
                        ...(value.additionalNotes ? [new Paragraph({ text: '' }), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Additional Notes', bold: true })] }), new Paragraph({ children: [new TextRun({ text: value.additionalNotes, size: 22 })] })] : []),
                      ],
                    }],
                  });
                  const blob = await Packer.toBlob(doc);
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const base64 = reader.result as string;
                    const filename = `${(value.projectName || 'Project').replace(/\s+/g, '_')}_Direction.docx`;
                    try {
                      if (onSaveFile) {
                        await onSaveFile(filename, base64);
                        alert(`Direction saved to project folder.`);
                      } else {
                        const res = await fetch('/api/save-file', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ filename, data: base64, folder: 'output' }),
                        });
                        const json = await res.json();
                        if (res.ok) alert(`Saved: ${json.path}`);
                        else throw new Error(json.error);
                      }
                    } catch {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  };
                  reader.readAsDataURL(blob);
                } catch (err) {
                  console.error('Word export failed:', err);
                  alert('Failed to create Word document.');
                }
              }}
              className="px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-[#91569c] text-white hover:bg-[#5c3a62] border border-[#91569c] transition-colors"
              title="Save direction as Word document"
            >
              <i className="fa-solid fa-file-word text-[8px] mr-1"></i>Save Direction
            </button>
            <button
              onClick={() => {
                try { localStorage.setItem('tensorax_saved_direction', JSON.stringify(value)); } catch { /* ignore */ }
                alert('Saved as test data. Click "Load test" to restore.');
              }}
              className="px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-[#91569c]/10 text-[#91569c]/70 hover:text-[#91569c] hover:bg-[#91569c]/20 border border-[#91569c]/20 transition-colors"
              title="Save current data as test preset"
            >
              Save test
            </button>
            <button
              onClick={() => {
                try {
                  const saved = localStorage.getItem('tensorax_saved_direction');
                  if (saved) { onChange(JSON.parse(saved)); return; }
                } catch { /* ignore */ }
                onChange(TEST_DIRECTION);
              }}
              className="px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-[#91569c]/10 text-[#91569c]/70 hover:text-[#91569c] hover:bg-[#91569c]/20 border border-[#91569c]/20 transition-colors"
              title="Load saved or default test data"
            >
              Load test
            </button>
          </div>
        </div>


        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Settings summary — read-only, managed in Project Settings */}
          <div>
            <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i className="fa-solid fa-sliders text-[#91569c] text-[9px]"></i>
              Settings
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                value.videoType && { label: value.videoType },
                value.format && { label: value.format },
                value.duration && { label: value.duration },
                value.tone && { label: value.tone },
              ].filter(Boolean).map((tag, i) => (
                <span key={i} className="px-2 py-1 rounded-md bg-[#f6f0f8] border border-[#ceadd4] text-[9px] font-bold text-[#5c3a62] uppercase tracking-wide">
                  {(tag as any).label}
                </span>
              ))}
              <span className="px-2 py-1 rounded-md text-[9px] text-[#888] italic">Edit in Project Settings</span>
            </div>

            <StyleInspirations value={value} onChange={onChange} />
          </div>

          {/* User Direction */}
          <div>
            <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-compass text-[#91569c] text-[9px]"></i>
              User Direction
            </label>
            <p className="text-[#888]/60 text-[9px] mb-1.5">Describe what the video should achieve and any creative direction</p>
            <textarea
              value={value.aim}
              onChange={(e) => update('aim', e.target.value)}
              placeholder="e.g. Create a 90-second brand video showcasing the new kidswear collection with consistent characters across all scenes..."
              rows={6}
              className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] placeholder:text-[#3a3a3a]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
            />
          </div>

          {/* CTA */}
          <div>
            <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-bullhorn text-[#91569c] text-[9px]"></i>
              Call to Action
            </label>
            <input type="text" value={value.cta} onChange={(e) => update('cta', e.target.value)} placeholder="e.g. Visit our stores, Shop now, Sign up for loyalty card" className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] placeholder:text-[#3a3a3a]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none" />
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-users text-[#91569c] text-[9px]"></i>
              Target Audience
            </label>
            <input type="text" value={value.targetAudience} onChange={(e) => update('targetAudience', e.target.value)} placeholder="e.g. Parents of kids 0-10, expecting parents" className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-2 text-[11px] text-[#3a3a3a] placeholder:text-[#3a3a3a]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none" />
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-[#ceadd4] flex-shrink-0">
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating || !hasContent || finetuneMode}
            className="w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-lightbulb'}`}></i>
            {isGenerating ? 'Generating...' : 'Generate Idea'}
          </button>
        </div>
      </aside>

      {/* RIGHT: Idea Factory / Finetune */}
      <main className="flex-1 min-w-0 h-full bg-[#edecec] border border-[#e0d6e3] rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#ceadd4] flex-shrink-0 flex items-center justify-between">
          <h2 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
            <i className={`fa-solid ${finetuneMode ? 'fa-wand-magic-sparkles' : 'fa-lightbulb'} text-[#91569c]`}></i>
            {finetuneMode ? 'Review Concept' : 'Idea Factory'}
          </h2>
          {finetuneMode && (
            <button
              onClick={() => setFinetuneMode(false)}
              className="text-[9px] font-bold uppercase tracking-wider text-[#888]/60 hover:text-[#91569c] transition-colors flex items-center gap-1"
            >
              <i className="fa-solid fa-arrow-left text-[8px]"></i>
              Back to Concept
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {finetuneMode ? (
            <div className="space-y-4">
              <div className="bg-[#f6f0f8] border border-[#91569c]/30 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-[#f6f0f8] border-b border-[#ceadd4]">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#91569c] flex items-center justify-center text-[#3a3a3a] text-xs font-black"><i className="fa-solid fa-check text-[9px]"></i></span>
                  <input
                    type="text"
                    value={finetuneTitle}
                    onChange={(e) => setFinetuneTitle(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] font-bold text-[#5c3a62] outline-none border-b border-transparent focus:border-[#91569c]/40"
                  />
                </div>
                <div className="p-4">
                  <textarea
                    value={finetuneText}
                    onChange={(e) => setFinetuneText(e.target.value)}
                    rows={16}
                    className="w-full bg-white border border-[#ceadd4] rounded-lg p-3 text-[11px] text-[#3a3a3a] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y font-sans"
                  />
                </div>
              </div>

              <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-xl p-4">
                <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-pen text-[#91569c] text-[9px]"></i>
                  Additional Directions <span className="font-normal text-[#888]/40">(optional)</span>
                </label>
                <textarea
                  value={finetuneDirection}
                  onChange={(e) => setFinetuneDirection(e.target.value)}
                  placeholder="e.g. Make the ending more emotional, add a scene in a NEXT store, change the character to a grandmother..."
                  rows={2}
                  className="w-full bg-white border border-[#ceadd4] rounded-lg p-3 text-[11px] text-[#3a3a3a] placeholder:text-[#ceadd4] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-none"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onSaveAndCreateScript?.(finetuneTitle, finetuneText, finetuneDirection)}
                    disabled={isSaving || isGenerating || !finetuneText.trim()}
                    className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                    {isSaving ? 'Saving...' : 'Save Screenplay'}
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
                  <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 mb-1">
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
                    <div key={i} className={`bg-[#f6f0f8] border rounded-xl overflow-hidden transition-colors ${isKept ? 'border-[#91569c]/40 ring-1 ring-[#91569c]/20' : 'border-[#ceadd4] hover:border-[#91569c]/30'}`}>
                      <div className="flex items-center gap-3 px-4 py-3 bg-[#f6f0f8] border-b border-[#ceadd4]">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#91569c] flex items-center justify-center text-[#3a3a3a] text-xs font-black">{isKept ? <i className="fa-solid fa-heart text-[10px]"></i> : idea.num}</span>
                        <h3 className="flex-1 text-[13px] font-bold text-[#5c3a62] leading-snug">{idea.title || `Idea ${idea.num}`}</h3>
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
                              : 'text-[#888]/40 hover:text-[#91569c]'
                          }`}
                          title={editingIdea === idea.num ? 'Save edits' : 'Edit idea'}
                        >
                          <i className={`fa-solid ${editingIdea === idea.num ? 'fa-check' : 'fa-pencil'} text-[10px]`}></i>
                        </button>
                        <button
                          onClick={() => onRegenerateSingleIdea?.(idea.num, visibleIdeas, { rating: ratings[idea.num], comment: feedbackNotes[idea.num] })}
                          disabled={regeneratingIdeaNum === idea.num || isGenerating}
                          className="text-[#91569c]/40 hover:text-[#91569c] transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Regenerate this idea"
                        >
                          <i className={`fa-solid ${regeneratingIdeaNum === idea.num ? 'fa-spinner fa-spin' : 'fa-rotate-right'} text-[10px]`}></i>
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
                            className="w-full bg-white border border-[#ceadd4] rounded-lg p-3 text-[11px] text-[#3a3a3a] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y font-sans"
                            autoFocus
                          />
                        ) : hasStructured ? (
                          <div className="space-y-3">
                            {parsed.map((sec, j) => (
                              <div key={j}>
                                <span className="text-[9px] font-black uppercase tracking-wider text-[#91569c]">{sec.label}:</span>
                                <p className="text-[11px] text-[#3a3a3a] leading-relaxed mt-0.5 whitespace-pre-wrap">{sec.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <pre className="text-[11px] text-[#3a3a3a] whitespace-pre-wrap font-sans leading-relaxed">{idea.body}</pre>
                        )}
                      </div>
                      {/* Feedback & Regenerate */}
                      <div className="px-4 pb-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          {(['like', 'neutral', 'dislike'] as const).map(r => (
                            <button
                              key={r}
                              onClick={() => setRatings(prev => ({ ...prev, [idea.num]: prev[idea.num] === r ? undefined! : r }))}
                              className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                ratings[idea.num] === r
                                  ? r === 'like' ? 'bg-green-50 text-green-600 border-green-300'
                                    : r === 'dislike' ? 'bg-red-50 text-red-500 border-red-300'
                                    : 'bg-amber-50 text-amber-600 border-amber-300'
                                  : 'bg-white text-[#888] border-[#e0d6e3] hover:border-[#ceadd4]'
                              }`}
                            >
                              <i className={`fa-solid ${r === 'like' ? 'fa-thumbs-up' : r === 'dislike' ? 'fa-thumbs-down' : 'fa-minus'} text-[8px] mr-1`}></i>
                              {r}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={feedbackNotes[idea.num] || ''}
                            onChange={(e) => setFeedbackNotes(prev => ({ ...prev, [idea.num]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (feedbackNotes[idea.num]?.trim() || ratings[idea.num])) onRegenerateSingleIdea?.(idea.num, visibleIdeas, { rating: ratings[idea.num], comment: feedbackNotes[idea.num] }); }}
                            placeholder="Feedback — e.g. 'make it more playful' or 'focus on the unwrapping'"
                            className="flex-1 bg-white border border-[#e0d6e3] rounded-lg px-3 py-1.5 text-[10px] text-[#3a3a3a] placeholder:text-[#888]/50 outline-none focus:border-[#ceadd4] focus:ring-1 focus:ring-[#91569c]/20"
                          />
                          <button
                            onClick={() => onRegenerateSingleIdea?.(idea.num, visibleIdeas, { rating: ratings[idea.num], comment: feedbackNotes[idea.num] })}
                            disabled={regeneratingIdeaNum === idea.num || isGenerating}
                            className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            <i className={`fa-solid ${regeneratingIdeaNum === idea.num ? 'fa-spinner fa-spin' : 'fa-rotate-right'} text-[8px]`}></i>
                            Regen
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Saving notification */}
                {savingWord && (
                  <div className="flex items-center gap-3 bg-[#91569c]/15 border border-[#91569c]/30 rounded-xl px-4 py-3 mt-3 animate-pulse">
                    <i className="fa-solid fa-spinner fa-spin text-[#91569c]"></i>
                    <span className="text-[11px] font-bold text-[#5c3a62]">Saving concept to Word document, please wait...</span>
                  </div>
                )}

                {/* Actions for the whole concept */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || savingWord}
                    className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-white text-[#91569c] border border-[#ceadd4] hover:bg-[#f6f0f8] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`}></i>
                    {isGenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button
                    onClick={async () => {
                      setSavingWord(true);
                      const title = visibleIdeas[0]?.title || 'Concept';
                      const fullText = visibleIdeas.map(idea => {
                        const body = editedBodies[idea.num] ?? idea.body;
                        return `## ${idea.title || 'Scene ' + idea.num}\n${body}`;
                      }).join('\n\n');

                      try {
                        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
                        const sections = visibleIdeas.map(idea => {
                          const body = editedBodies[idea.num] ?? idea.body;
                          const parsed = body.split(/\n\*\*([^*]+)\*\*:?\s*/);
                          const paras: any[] = [];
                          for (let s = 1; s < parsed.length; s += 2) {
                            if (parsed[s + 1] !== undefined) {
                              paras.push(new Paragraph({ children: [new TextRun({ text: parsed[s].trim() + ':', bold: true, size: 22 })] }));
                              paras.push(new Paragraph({ children: [new TextRun({ text: parsed[s + 1].trim(), size: 22 })] }));
                              paras.push(new Paragraph({ text: '' }));
                            }
                          }
                          if (paras.length === 0) {
                            body.split('\n').forEach((line: string) => paras.push(new Paragraph({ children: [new TextRun({ text: line, size: 22 })] })));
                          }
                          return [
                            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: idea.title || `Scene ${idea.num}`, bold: true })] }),
                            ...paras,
                          ];
                        });
                        const doc = new Document({
                          sections: [{
                            children: [
                              new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `${value.projectName || 'Project'} — Approved Concept`, bold: true })] }),
                              new Paragraph({ children: [new TextRun({ text: `Approved: ${new Date().toLocaleDateString()} — TensorAx Studio`, italics: true, color: '888888', size: 18 })] }),
                              new Paragraph({ text: '' }),
                              ...sections.flat(),
                            ],
                          }],
                        });
                        const blob = await Packer.toBlob(doc);
                        const base64 = await new Promise<string>(resolve => {
                          const r = new FileReader();
                          r.onload = () => resolve(r.result as string);
                          r.readAsDataURL(blob);
                        });
                        const filename = `${(value.projectName || 'Concept').replace(/\s+/g, '_')}_Approved_Concept.docx`;
                        if (onSaveFile) {
                          await onSaveFile(filename, base64, 'concepts');
                        }
                      } catch (e) { console.warn('Word save failed:', e); }

                      setSavingWord(false);
                      onSaveAndCreateScript?.(title, fullText, '');
                    }}
                    disabled={savingWord || isSaving}
                    className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <i className={`fa-solid ${savingWord ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                    {savingWord ? 'Saving...' : 'Accept Concept'}
                  </button>
                </div>
                </>);
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <i className="fa-solid fa-lightbulb text-5xl text-[#ceadd4] mb-4"></i>
              <p className="text-[#888]/60 text-sm font-bold uppercase tracking-widest mb-2">Idea Factory</p>
              <p className="text-[#888]/40 text-xs max-w-md leading-relaxed">
                Fill in the project details and click "Generate Idea". The AI will create a video concept based on your brief, brand, and style inspirations.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
