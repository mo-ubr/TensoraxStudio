import React, { useState } from 'react';
import { getApiKeyForType, getModelForType, hasStoredKeyForType } from '../services/geminiService';
import { ProjectBrief, ConceptIdea, ConceptState, GeneralDirection as GeneralDirectionType, BrandProfile } from '../types';
import { BriefForm, VideoSuggestion } from './BriefForm';
import { IdeaFactory } from './IdeaFactory';
import { IdeaFinetune } from './IdeaFinetune';
import { GeneralDirection, emptyDirection, GENERAL_DIRECTION_SYSTEM_PROMPT, SINGLE_IDEA_REGEN_PROMPT, getIdeaFactoryModel, getIdeaFactoryApiKey } from './GeneralDirection';
import { isClaudeModel } from '../services/claudeService';
import { DB, type Project } from '../services/projectDB';

type ConceptStep = 'direction' | 'ideas' | 'screenplay';

const STEP_META: { id: ConceptStep; label: string; icon: string; num: number }[] = [
  { id: 'direction', label: 'General Direction', icon: 'fa-compass', num: 1 },
  { id: 'ideas', label: 'Idea Factory', icon: 'fa-lightbulb', num: 2 },
  { id: 'screenplay', label: 'Screenplay', icon: 'fa-clapperboard', num: 3 },
];

const emptyBrief: ProjectBrief = {
  backgroundInfo: '',
  promoDetails: '',
  videoConcept: '',
  proof: '',
  videoType: 'explainer',
  format: '9:16',
  duration: '1.5min',
  tone: 'warm',
  cta: '',
  targetAudience: '',
  offer: '',
  sampleVideoUrl: '',
};

function buildBriefSummary(brief: ProjectBrief): string {
  return [
    `Video Type: ${brief.videoType}`,
    `Format: ${brief.format} | Duration: ${brief.duration} | Tone: ${brief.tone}`,
    '',
    `Background: ${brief.backgroundInfo}`,
    '',
    `Promo Details: ${brief.promoDetails}`,
    '',
    `Video Concept: ${brief.videoConcept}`,
    brief.proof ? `\nProof: ${brief.proof}` : '',
    brief.cta ? `\nCTA: ${brief.cta}` : '',
    brief.targetAudience ? `Target Audience: ${brief.targetAudience}` : '',
    brief.offer ? `Offer: ${brief.offer}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseIdeas(text: string): ConceptIdea[] {
  const ideas: ConceptIdea[] = [];
  const blocks = text.split(/(?=(?:^|\n)##?\s*(?:Idea|Concept|Option)\s*\d)/i);

  for (const block of blocks) {
    const titleMatch = block.match(/##?\s*(?:Idea|Concept|Option)\s*\d[:\s\-–]*(.*)/i);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim().replace(/\*\*/g, '') || `Concept ${ideas.length + 1}`;
    const afterTitle = block.slice(titleMatch.index! + titleMatch[0].length).trim();

    let summary = '';
    let keyScenes = '';
    let visualStyle = '';

    const summaryMatch = afterTitle.match(/(?:^|\n)\*?\*?Summary\*?\*?[:\s]*([\s\S]*?)(?=\n\*?\*?(?:Key Scenes|Visual Style|Scenes|Style)\*?\*?[:\s]|$)/i);
    const scenesMatch = afterTitle.match(/(?:^|\n)\*?\*?(?:Key Scenes|Scenes)\*?\*?[:\s]*([\s\S]*?)(?=\n\*?\*?(?:Visual Style|Style)\*?\*?[:\s]|$)/i);
    const styleMatch = afterTitle.match(/(?:^|\n)\*?\*?(?:Visual Style|Style)\*?\*?[:\s]*([\s\S]*?)$/i);

    summary = (summaryMatch?.[1] || afterTitle.split('\n').slice(0, 3).join(' ')).trim();
    keyScenes = (scenesMatch?.[1] || '').trim();
    visualStyle = (styleMatch?.[1] || '').trim();

    if (!summary && !keyScenes) {
      summary = afterTitle.slice(0, 300).trim();
    }

    ideas.push({
      id: `idea-${Date.now()}-${ideas.length}`,
      title,
      summary,
      keyScenes,
      visualStyle,
      status: 'pending',
    });
  }

  if (ideas.length === 0 && text.trim().length > 50) {
    const numbered = text.split(/(?=\d+\.\s)/);
    for (const chunk of numbered) {
      const numMatch = chunk.match(/^(\d+)\.\s*(.*)/s);
      if (!numMatch) continue;
      const body = numMatch[2].trim();
      const firstLine = body.split('\n')[0].replace(/\*\*/g, '').trim();
      ideas.push({
        id: `idea-${Date.now()}-${ideas.length}`,
        title: firstLine.slice(0, 80) || `Concept ${ideas.length + 1}`,
        summary: body.slice(firstLine.length).trim().slice(0, 400),
        keyScenes: '',
        visualStyle: '',
        status: 'pending',
      });
    }
  }

  return ideas;
}

interface ConceptScreenProps {
  onBack: () => void;
  onOpenApiKeyModal: (type: 'analysis' | 'copy' | 'image') => void;
  brands: BrandProfile[];
  activeBrandId: string;
  activeProject?: Project | null;
}

export const ConceptScreen: React.FC<ConceptScreenProps> = ({ onBack, onOpenApiKeyModal, brands, activeBrandId, activeProject }) => {
  const [step, setStep] = useState<ConceptStep>('direction');
  const [generalDirection, setGeneralDirection] = useState<GeneralDirectionType>(() => {
    try {
      const stored = localStorage.getItem('tensorax_general_direction');
      const dir = stored ? JSON.parse(stored) : emptyDirection;
      if (activeProject) {
        dir.projectName = activeProject.name;
        if (!dir.aim && activeProject.description) dir.aim = activeProject.description;
      }
      return dir;
    } catch { return emptyDirection; }
  });
  const [isGeneratingDirection, setIsGeneratingDirection] = useState(false);
  const [regeneratingIdeaNum, setRegeneratingIdeaNum] = useState<number | null>(null);
  const [conceptState, setConceptState] = useState<ConceptState>({
    brief: emptyBrief,
    ideas: [],
    selectedIdea: null,
    refinedConcept: '',
    isFinalized: false,
  });
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isSavingConcept, setIsSavingConcept] = useState(false);
  const [screenplay, setScreenplay] = useState(() => localStorage.getItem('tensorax_screenplay') || '');
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editedSceneData, setEditedSceneData] = useState<{ scene: string; dialogue: string; prompt: string }>({ scene: '', dialogue: '', prompt: '' });

  const activeBrand = brands.find(b => b.id === activeBrandId) || brands[0];

  const handleSaveAndCreateScript = async (title: string, concept: string, directions: string) => {
    setIsSavingConcept(true);
    try {
      // Save to project folder on disk
      if (activeProject) {
        const conceptText = `${title}\n${'='.repeat(title.length)}\n\n${concept}\n${directions ? `\nDirections: ${directions}` : ''}\n\nGenerated: ${new Date().toISOString().split('T')[0]}`;
        await DB.saveProjectFile(activeProject.id, `${title.replace(/[^a-zA-Z0-9 _-]/g, '')}.txt`, conceptText, 'concepts').catch(e => console.warn('[ConceptScreen] Project file save failed:', e));
      }

      const res = await fetch('/api/save-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: generalDirection.projectName || 'Untitled Project',
          title,
          concept,
          parentFolderId: '1yUTinGkhgp8sGx-WchFfNfx3VrGMa6IM',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      const apiKey = getAiKey();
      const model = getAiModel();
      const scriptPrompt = `Based on the finalised video concept below, create a professional 3-column screenplay.

Title: ${title}

Concept:
${concept}
${directions ? `\nAdditional directions: ${directions}` : ''}

Generate a detailed screenplay as a scene-by-scene breakdown with exactly these 3 columns for EACH scene:

Column 1 — SCENE: Scene number, description of what happens, action, camera direction, SFX/music cues.
Column 2 — DIALOGUE: All spoken dialogue and/or narrator voiceover, attributed by character name.
Column 3 — VIDEO PROMPT: A complete AI image/video generation prompt for this scene — include subject, outfit, environment, framing, lighting, style.

Format each scene EXACTLY like this:

### Scene [N]: [Scene Title]
**SCENE:** [description]
**DIALOGUE:** [dialogue/voiceover]
**VIDEO PROMPT:** [full prompt]

Rules:
- Break the concept into 6-10 distinct scenes
- Each scene should be 5-15 seconds of the final video
- Maintain strict character/wardrobe/environment continuity across all scenes
- Video prompts must be fully self-contained (each prompt works independently for image generation)
- Include camera movements, transitions, and pacing notes in the SCENE column
- Dialogue should match the tone: ${generalDirection.tone}
- Total duration target: ${generalDirection.duration}
- Format: ${generalDirection.format}`;

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const modelName = model || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({ model: modelName, contents: scriptPrompt });
      const text = typeof response.text === 'string' ? response.text : '';

      if (text) {
        setScreenplay(text);
        setStep('screenplay' as ConceptStep);
      }
    } catch (err: any) {
      alert(`Failed: ${err.message || err}`);
    } finally {
      setIsSavingConcept(false);
    }
  };

  const handleDirectionChange = (dir: GeneralDirectionType) => {
    setGeneralDirection(dir);
    localStorage.setItem('tensorax_general_direction', JSON.stringify(dir));
  };

  const callAiText = async (prompt: string): Promise<string> => {
    const ideaKey = getIdeaFactoryApiKey();
    const ideaModel = getIdeaFactoryModel();
    const apiKey = ideaKey || getAiKey();
    const model = ideaModel || getAiModel();

    if (isClaudeModel(model || null)) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
      const msg = await client.messages.create({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      });
      return msg.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n')
        .trim();
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const modelName = model || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({ model: modelName, contents: prompt });
    return typeof response.text === 'string' ? response.text : '';
  };

  const handleGenerateDirection = async (feedback?: string) => {
    setIsGeneratingDirection(true);
    try {
      const systemPrompt = GENERAL_DIRECTION_SYSTEM_PROMPT(generalDirection, activeBrand);
      const fullPrompt = feedback ? `${systemPrompt}\n\n---\n\n${feedback}` : systemPrompt;
      const text = await callAiText(fullPrompt);

      if (text) {
        const updated = { ...generalDirection, generatedPrompt: text };
        setGeneralDirection(updated);
        localStorage.setItem('tensorax_general_direction', JSON.stringify(updated));
      }
    } catch (err: any) {
      alert(`Failed to generate direction: ${err.message || err}`);
    } finally {
      setIsGeneratingDirection(false);
    }
  };

  const handleRegenerateSingleIdea = async (ideaNum: number, currentIdeas: { num: number; title: string; body: string }[], feedback?: { rating?: 'like' | 'neutral' | 'dislike'; comment?: string }) => {
    setRegeneratingIdeaNum(ideaNum);
    try {
      const prompt = SINGLE_IDEA_REGEN_PROMPT(ideaNum, currentIdeas, generalDirection, activeBrand, feedback);
      const newText = await callAiText(prompt);

      if (newText && generalDirection.generatedPrompt) {
        const existingPrompt = generalDirection.generatedPrompt;
        const ideaPattern = new RegExp(
          `(#{1,3}\\s*(?:\\*\\*)?(?:Idea|Concept)\\s*${ideaNum}[:\\s\\-–.][\\s\\S]*?)(?=#{1,3}\\s*(?:\\*\\*)?(?:Idea|Concept)\\s*\\d|$)`,
          'i'
        );
        const match = existingPrompt.match(ideaPattern);

        let updatedPrompt: string;
        if (match) {
          updatedPrompt = existingPrompt.replace(match[1], newText.trim() + '\n\n');
        } else {
          updatedPrompt = existingPrompt + '\n\n' + newText.trim();
        }

        const updated = { ...generalDirection, generatedPrompt: updatedPrompt };
        setGeneralDirection(updated);
        localStorage.setItem('tensorax_general_direction', JSON.stringify(updated));
      }
    } catch (err: any) {
      alert(`Failed to regenerate idea: ${err.message || err}`);
    } finally {
      setRegeneratingIdeaNum(null);
    }
  };

  const getAiKey = (): string => {
    const copyKey = getApiKeyForType('copy');
    const analysisKey = getApiKeyForType('analysis');
    const key = copyKey || analysisKey;
    if (!key) {
      throw new Error('Please set an API key via Settings → API Keys (Analysis or Copy) on the Scenes page first, then return here.');
    }
    return key;
  };

  const getAiModel = (): string | undefined => {
    return getModelForType('copy') || getModelForType('analysis') || undefined;
  };

  const handleSearchVideos = async (brief: ProjectBrief): Promise<VideoSuggestion[]> => {
    const apiKey = getAiKey();
    const model = getAiModel();
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const modelName = model || 'gemini-2.5-flash';

    const briefContext = [
      brief.videoType && `Video type: ${brief.videoType}`,
      brief.videoConcept && `Concept: ${brief.videoConcept}`,
      brief.promoDetails && `Details: ${brief.promoDetails}`,
      brief.tone && `Tone: ${brief.tone}`,
      brief.targetAudience && `Audience: ${brief.targetAudience}`,
    ].filter(Boolean).join('\n');

    const prompt = `You are a video research assistant. Based on this project brief, suggest 5 real YouTube videos that are similar in style, concept, or audience. These should be actual videos that likely exist on YouTube.

PROJECT BRIEF:
${briefContext}

For each video, return EXACTLY this JSON format (no markdown, no code fences, just the JSON array):
[
  {
    "title": "Video Title - Channel Name",
    "url": "https://www.youtube.com/results?search_query=URL+encoded+search+terms",
    "why": "One sentence explaining why this is relevant"
  }
]

IMPORTANT: Since you cannot verify exact YouTube URLs, use YouTube SEARCH URLs instead (https://www.youtube.com/results?search_query=...) with specific search terms that would find this type of video. Make the search terms specific enough to find similar videos.

Return exactly 5 suggestions as a JSON array.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });

    const text = typeof response.text === 'string' ? response.text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse video suggestions');

    const parsed = JSON.parse(jsonMatch[0]) as VideoSuggestion[];
    return parsed.slice(0, 5);
  };

  const handleBriefSubmit = () => {
    setStep('ideas');
    handleGenerateIdeas();
  };

  const handleGenerateIdeas = async () => {
    setIsGeneratingIdeas(true);
    try {
      const apiKey = getAiKey();
      const model = getAiModel();
      const briefText = buildBriefSummary(conceptState.brief);

      const prompt = `You are a creative director at a top video production studio. Based on the following project brief, generate exactly 5 unique video concept ideas. Each concept should have a different creative angle.

For EACH idea, use this exact format:

## Idea 1: [Creative Title]
**Summary:** [2-3 sentence overview of the concept approach]
**Key Scenes:** [Brief description of 3-4 key visual moments]
**Visual Style:** [Describe the visual treatment, color palette, mood]

## Idea 2: [Creative Title]
...and so on for all 5 ideas.

PROJECT BRIEF:
${briefText}`;

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const modelName = model || 'gemini-2.5-flash';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const text = typeof response.text === 'string' ? response.text : '';
      const parsed = parseIdeas(text);

      if (parsed.length === 0) {
        throw new Error('Could not parse AI response into concepts. Raw response saved to console.');
      }

      setConceptState((prev) => ({
        ...prev,
        ideas: [...prev.ideas, ...parsed],
      }));
    } catch (e: any) {
      console.error('[ConceptScreen] Idea generation failed:', e);
      alert(`Idea generation failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleAcceptIdea = (idea: ConceptIdea) => {
    const updated = conceptState.ideas.map((i) =>
      i.id === idea.id ? { ...i, status: 'accepted' as const } : { ...i, status: i.status === 'accepted' ? 'pending' as const : i.status }
    );
    const initialConcept = [
      `# ${idea.title}`,
      '',
      idea.summary,
      '',
      idea.keyScenes ? `## Key Scenes\n${idea.keyScenes}` : '',
      idea.visualStyle ? `## Visual Style\n${idea.visualStyle}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    setConceptState((prev) => ({
      ...prev,
      ideas: updated,
      selectedIdea: idea,
      refinedConcept: initialConcept,
    }));
    setStep('ideas');
  };

  const handleRejectIdea = (id: string) => {
    setConceptState((prev) => ({
      ...prev,
      ideas: prev.ideas.map((i) => (i.id === id ? { ...i, status: 'rejected' as const } : i)),
    }));
  };

  const handleRefine = async (direction: string): Promise<string> => {
    setIsRefining(true);
    try {
      const apiKey = getAiKey();
      const model = getAiModel();
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const modelName = model || 'gemini-2.5-flash';

      const prompt = `You are a creative director refining a video concept. Here is the current concept:

${conceptState.refinedConcept}

The client has given this feedback/direction:
"${direction}"

Please refine the concept based on this feedback. Keep the same structure but incorporate the changes. Return ONLY the refined concept text, no meta-commentary.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const text = typeof response.text === 'string' ? response.text : '';
      setConceptState((prev) => ({ ...prev, refinedConcept: text.trim() }));
      return text.trim();
    } catch (e: any) {
      console.error('[ConceptScreen] Refinement failed:', e);
      throw e;
    } finally {
      setIsRefining(false);
    }
  };

  const handleFinalize = () => {
    setConceptState((prev) => ({ ...prev, isFinalized: true }));
    alert('Concept finalised! In a future update, this will flow into the Screenplay module.');
  };

  const stepIndex = STEP_META.findIndex((s) => s.id === step);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-navigation stepper */}
      <div className="flex-shrink-0 bg-[#edecec] border-b border-[#e0d6e3]/60 px-5 py-2">
        <div className="flex items-center gap-1 max-w-2xl mx-auto">
          {STEP_META.map((s, i) => {
            const isActive = s.id === step;
            const isDone = i < stepIndex || (s.id === 'finetune' && conceptState.isFinalized);
            return (
              <React.Fragment key={s.id}>
                {i > 0 && (
                  <div className={`flex-1 h-px ${i <= stepIndex ? 'bg-[#91569c]' : 'bg-[#4a3a52]'}`} />
                )}
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider ${
                    isActive
                      ? 'bg-[#91569c]/20 text-[#91569c] border border-[#91569c]/30'
                      : isDone
                      ? 'text-[#91569c]/60 hover:text-[#91569c]'
                      : 'text-[#888]/40 cursor-default'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] border ${
                    isActive
                      ? 'border-[#91569c] bg-[#91569c] text-black'
                      : isDone
                      ? 'border-[#91569c]/50 bg-[#91569c]/20 text-[#91569c]'
                      : 'border-[#ceadd4] text-[#4a3a52]'
                  }`}>
                    {isDone ? <i className="fa-solid fa-check text-[8px]"></i> : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden px-2 pb-2">
        {step === 'screenplay' ? (
          <div className="flex-1 h-full bg-[#edecec] border border-[#e0d6e3] rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#ceadd4] flex-shrink-0 flex items-center justify-between">
              <h2 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                <i className="fa-solid fa-clapperboard text-[#91569c]"></i>
                Screenplay
              </h2>
              <button onClick={() => setStep('ideas')} className="text-[9px] font-bold uppercase tracking-wider text-[#888]/60 hover:text-[#91569c] transition-colors flex items-center gap-1">
                <i className="fa-solid fa-arrow-left text-[8px]"></i>
                Back to Ideas
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const scenes = screenplay.split(/(?=###\s*Scene\s*\d)/i).filter(b => b.trim() && /^###\s*Scene\s*\d/i.test(b.trim()));
                if (scenes.length === 0) return <pre className="text-[11px] text-[#888] whitespace-pre-wrap font-sans">{screenplay}</pre>;
                const saveSceneEdit = (sceneIdx: number) => {
                  const updated = [...scenes];
                  const titleMatch = updated[sceneIdx].match(/###\s*Scene\s*(\d+)[:\s\-–]*(.*)/i);
                  const sceneNum = titleMatch?.[1] || `${sceneIdx + 1}`;
                  const sceneTitle = titleMatch?.[2]?.replace(/\*\*/g, '').trim() || `Scene ${sceneNum}`;
                  updated[sceneIdx] = `### Scene ${sceneNum}: ${sceneTitle}\n\n**SCENE:** ${editedSceneData.scene}\n\n**DIALOGUE:** ${editedSceneData.dialogue}\n\n**VIDEO PROMPT:** ${editedSceneData.prompt}\n`;
                  setScreenplay(updated.join('\n'));
                  setEditingScene(null);
                };

                return (
                  <div className="space-y-4">
                    {scenes.map((scene, i) => {
                      const titleMatch = scene.match(/###\s*Scene\s*(\d+)[:\s\-–]*(.*)/i);
                      const sceneNum = titleMatch?.[1] || `${i + 1}`;
                      const sceneTitle = titleMatch?.[2]?.replace(/\*\*/g, '').trim() || `Scene ${sceneNum}`;
                      const sceneMatch = scene.match(/\*\*SCENE:\*\*\s*([\s\S]*?)(?=\*\*DIALOGUE:\*\*|$)/i);
                      const dialogueMatch = scene.match(/\*\*DIALOGUE:\*\*\s*([\s\S]*?)(?=\*\*VIDEO PROMPT:\*\*|$)/i);
                      const promptMatch = scene.match(/\*\*VIDEO PROMPT:\*\*\s*([\s\S]*?)(?=###|$)/i);
                      const isEditing = editingScene === i;
                      return (
                        <div key={i} className={`bg-[#4A4A4A] border rounded-xl overflow-hidden transition-colors ${isEditing ? 'border-[#91569c]/40' : 'border-[#ceadd4]'}`}>
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#3A3A3A] border-b border-[#ceadd4]">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#91569c] flex items-center justify-center text-[#3a3a3a] text-[10px] font-black">{sceneNum}</span>
                            <h3 className="flex-1 text-[12px] font-bold text-[#5c3a62]">{sceneTitle}</h3>
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  saveSceneEdit(i);
                                } else {
                                  setEditedSceneData({
                                    scene: sceneMatch?.[1]?.trim() || '',
                                    dialogue: dialogueMatch?.[1]?.trim() || '',
                                    prompt: promptMatch?.[1]?.trim() || '',
                                  });
                                  setEditingScene(i);
                                }
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                isEditing
                                  ? 'text-green-400 bg-green-400/15 hover:bg-green-400/25 ring-1 ring-green-400/30'
                                  : 'text-[#888]/70 hover:text-[#91569c] hover:bg-[#4A4A4A]'
                              }`}
                              title={isEditing ? 'Save edits' : 'Edit scene'}
                            >
                              <i className={`fa-solid ${isEditing ? 'fa-check' : 'fa-pencil'} text-[11px]`}></i>
                            </button>
                          </div>
                          {isEditing ? (
                            <div className="grid grid-cols-3 divide-x divide-[#4a3a52]">
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Scene</span>
                                <textarea
                                  value={editedSceneData.scene}
                                  onChange={(e) => setEditedSceneData(prev => ({ ...prev, scene: e.target.value }))}
                                  rows={6}
                                  className="w-full bg-[#3A3A3A] border border-[#91569c]/30 rounded p-2 text-[10px] text-[#888] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
                                  autoFocus
                                />
                              </div>
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Dialogue</span>
                                <textarea
                                  value={editedSceneData.dialogue}
                                  onChange={(e) => setEditedSceneData(prev => ({ ...prev, dialogue: e.target.value }))}
                                  rows={6}
                                  className="w-full bg-[#3A3A3A] border border-[#91569c]/30 rounded p-2 text-[10px] text-[#888] leading-relaxed italic focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
                                />
                              </div>
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Video Prompt</span>
                                <textarea
                                  value={editedSceneData.prompt}
                                  onChange={(e) => setEditedSceneData(prev => ({ ...prev, prompt: e.target.value }))}
                                  rows={6}
                                  className="w-full bg-[#3A3A3A] border border-[#91569c]/30 rounded p-2 text-[10px] text-[#888] leading-relaxed font-mono focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 divide-x divide-[#4a3a52]">
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Scene</span>
                                <p className="text-[10px] text-[#888] leading-relaxed">{sceneMatch?.[1]?.trim() || '—'}</p>
                              </div>
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Dialogue</span>
                                <p className="text-[10px] text-[#888] leading-relaxed italic">{dialogueMatch?.[1]?.trim() || '—'}</p>
                              </div>
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Video Prompt</span>
                                <p className="text-[10px] text-[#888] leading-relaxed font-mono">{promptMatch?.[1]?.trim() || '—'}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t border-[#ceadd4] flex-shrink-0">
              <button
                onClick={async () => {
                  localStorage.setItem('tensorax_screenplay', screenplay);
                  const proj = (generalDirection.projectName || 'Project').replace(/\s+/g, '_');
                  const filename = `${proj}_Screenplay.md`;
                  try {
                    const res = await fetch('http://localhost:5182/api/save-file', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ filename, data: screenplay, folder: `output/${proj}` }),
                    });
                    const json = await res.json();
                    if (res.ok) alert(`Saved: ${json.path}`);
                    else throw new Error(json.error);
                  } catch {
                    const blob = new Blob([screenplay], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                disabled={!screenplay}
                className="w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-[#3a3a3a] hover:bg-[#d4af1c] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                Save Screenplay
              </button>
            </div>
          </div>
        ) : step === 'direction' ? (
          <GeneralDirection
            value={generalDirection}
            onChange={handleDirectionChange}
            activeBrand={activeBrand}
            onGeneratePrompt={handleGenerateDirection}
            onRegenerateSingleIdea={handleRegenerateSingleIdea}
            isGenerating={isGeneratingDirection}
            regeneratingIdeaNum={regeneratingIdeaNum}
            onSaveAndCreateScript={handleSaveAndCreateScript}
            isSaving={isSavingConcept}
          />
        ) : (
        <>
        <aside className="w-[30%] min-w-[320px] max-w-[480px] h-full min-h-0 bg-[#edecec] border border-[#e0d6e3] rounded-xl flex flex-col overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-[#ceadd4] flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                <i className={`fa-solid ${STEP_META[stepIndex].icon} text-[#91569c]`}></i>
                {STEP_META[stepIndex].label}
              </h2>
              <div className="flex gap-1.5">
                {([
                  { type: 'analysis' as const, icon: 'fa-eye', title: 'Analysis AI' },
                  { type: 'copy' as const, icon: 'fa-pen', title: 'Copy / Prompt AI' },
                ]).map(({ type, icon, title }) => {
                  const hasKey = hasStoredKeyForType(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onOpenApiKeyModal(type)}
                      title={`${title}${hasKey ? ' ✓' : ' — click to set'}`}
                      className={`relative w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                        hasKey
                          ? 'bg-[#edecec] border-[#91569c]/40 text-[#91569c]'
                          : 'bg-[#edecec] border-[#ceadd4] text-[#5c3a62]/50 hover:text-[#5c3a62] hover:border-[#ceadd4]'
                      }`}
                    >
                      <i className={`fa-solid ${icon} text-xs`}></i>
                      {hasKey && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#91569c] rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {step === 'ideas' && (
            <IdeaFactory
              brief={conceptState.brief}
              ideas={conceptState.ideas}
              isGenerating={isGeneratingIdeas}
              onGenerateIdeas={handleGenerateIdeas}
              onAcceptIdea={handleAcceptIdea}
              onRejectIdea={handleRejectIdea}
              onBack={() => setStep('direction')}
            />
          )}

        </aside>

        {/* Main preview area */}
        <main className="flex-1 flex flex-col min-h-0 bg-[#edecec] pt-0 pb-2 px-2 min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden mx-auto max-w-4xl w-full bg-[#edecec] border border-[#e0d6e3] rounded-xl">
            <div className="flex-shrink-0 p-4 border-b border-[#ceadd4]">
              <h2 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                <i className="fa-solid fa-eye text-[#91569c]"></i>
                Preview
              </h2>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {step === 'ideas' && conceptState.ideas.length > 0 && (
                <IdeasPreview ideas={conceptState.ideas} />
              )}
              {step === 'ideas' && conceptState.ideas.length === 0 && (
                <EmptyPreview
                  icon="fa-lightbulb"
                  title="Idea Factory"
                  subtitle="Submit your brief to generate video concepts"
                />
              )}
            </div>
          </div>
        </main>
        </>
        )}
      </div>
    </div>
  );
};

const BriefPreview: React.FC<{ brief: ProjectBrief }> = ({ brief }) => {
  const hasContent = brief.backgroundInfo || brief.promoDetails || brief.videoConcept;
  if (!hasContent) {
    return (
      <EmptyPreview
        icon="fa-file-lines"
        title="Project Brief"
        subtitle="Fill in the form to see a live preview"
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#91569c]/20 rounded-xl flex items-center justify-center">
          <i className="fa-solid fa-file-lines text-[#91569c]"></i>
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Project Brief</h3>
          <p className="text-[10px] text-[#888] uppercase tracking-wider">Live preview</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Type', value: brief.videoType, icon: 'fa-video' },
          { label: 'Format', value: brief.format, icon: 'fa-crop' },
          { label: 'Duration', value: brief.duration, icon: 'fa-clock' },
          { label: 'Tone', value: brief.tone, icon: 'fa-palette' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg p-3 text-center">
            <i className={`fa-solid ${item.icon} text-[#91569c] text-sm mb-1 block`}></i>
            <span className="text-[9px] font-black uppercase tracking-wider text-[#3a3a3a]/60 block">{item.label}</span>
            <span className="text-[11px] font-bold text-[#3a3a3a] capitalize">{item.value}</span>
          </div>
        ))}
      </div>

      {brief.backgroundInfo && (
        <PreviewSection title="Background" icon="fa-briefcase" text={brief.backgroundInfo} />
      )}
      {brief.promoDetails && (
        <PreviewSection title="Promo Details" icon="fa-bullhorn" text={brief.promoDetails} />
      )}
      {brief.videoConcept && (
        <PreviewSection title="Video Concept" icon="fa-book-open" text={brief.videoConcept} />
      )}
      {brief.proof && (
        <PreviewSection title="Proof" icon="fa-certificate" text={brief.proof} />
      )}
      {brief.cta && (
        <div className="bg-[#91569c]/10 border border-[#91569c]/20 rounded-lg p-4">
          <span className="text-[9px] font-black uppercase tracking-wider text-[#91569c] block mb-1">Call to Action</span>
          <p className="text-sm text-[#5c3a62] font-bold">{brief.cta}</p>
        </div>
      )}
      {(brief.targetAudience || brief.offer) && (
        <div className="grid grid-cols-2 gap-3">
          {brief.targetAudience && (
            <PreviewSection title="Target Audience" icon="fa-users" text={brief.targetAudience} />
          )}
          {brief.offer && (
            <PreviewSection title="Offer" icon="fa-gift" text={brief.offer} />
          )}
        </div>
      )}
    </div>
  );
};

const PreviewSection: React.FC<{ title: string; icon: string; text: string }> = ({ title, icon, text }) => (
  <div className="bg-white/60 rounded-lg p-4 space-y-1">
    <span className="text-[9px] font-black uppercase tracking-wider text-[#3a3a3a]/60 flex items-center gap-1">
      <i className={`fa-solid ${icon} text-[#91569c] text-[8px]`}></i>
      {title}
    </span>
    <p className="text-[11px] text-[#3a3a3a] leading-relaxed whitespace-pre-wrap">{text}</p>
  </div>
);

const IdeasPreview: React.FC<{ ideas: ConceptIdea[] }> = ({ ideas }) => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 bg-[#91569c]/20 rounded-xl flex items-center justify-center">
        <i className="fa-solid fa-lightbulb text-[#91569c]"></i>
      </div>
      <div>
        <h3 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Generated Concepts</h3>
        <p className="text-[10px] text-[#888] uppercase tracking-wider">{ideas.length} ideas generated</p>
      </div>
    </div>

    {ideas.map((idea, i) => (
      <div
        key={idea.id}
        className={`rounded-xl p-4 space-y-2 border ${
          idea.status === 'accepted'
            ? 'bg-[#91569c]/10 border-[#91569c]/30'
            : idea.status === 'rejected'
            ? 'bg-white/20 border-[#e0d6e3]/30 opacity-40'
            : 'bg-white/40 border-[#e0d6e3]/50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
            idea.status === 'accepted' ? 'bg-[#91569c] text-black' : 'bg-[#4a3a52] text-[#888]'
          }`}>
            {idea.status === 'accepted' ? <i className="fa-solid fa-check"></i> : i + 1}
          </span>
          <h4 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">{idea.title}</h4>
        </div>
        <p className="text-[11px] text-[#888] leading-relaxed">{idea.summary}</p>
        {idea.keyScenes && (
          <p className="text-[10px] text-[#888]/70 leading-relaxed">
            <span className="font-bold text-[#91569c]/60">Scenes:</span> {idea.keyScenes}
          </p>
        )}
      </div>
    ))}
  </div>
);

const ConceptPreview: React.FC<{ text: string; isFinalized: boolean }> = ({ text, isFinalized }) => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFinalized ? 'bg-green-500/20' : 'bg-[#91569c]/20'}`}>
        <i className={`fa-solid ${isFinalized ? 'fa-check-double text-green-400' : 'fa-wand-magic-sparkles text-[#91569c]'}`}></i>
      </div>
      <div>
        <h3 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide">
          {isFinalized ? 'Finalised Concept' : 'Refined Concept'}
        </h3>
        <p className="text-[10px] text-[#888] uppercase tracking-wider">
          {isFinalized ? 'Ready for screenplay' : 'Work in progress'}
        </p>
      </div>
    </div>
    {isFinalized && (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
        <i className="fa-solid fa-circle-check text-green-400"></i>
        <span className="text-[11px] text-green-300 font-bold uppercase tracking-wider">Concept approved and locked</span>
      </div>
    )}
    <div className="bg-white/40 border border-[#e0d6e3]/50 rounded-xl p-6">
      <div className="prose prose-sm max-w-none">
        {text.split('\n').map((line, i) => {
          if (line.startsWith('# ')) {
            return <h2 key={i} className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide mt-4 mb-2">{line.slice(2)}</h2>;
          }
          if (line.startsWith('## ')) {
            return <h3 key={i} className="text-sm font-heading font-bold text-[#91569c] uppercase tracking-wide mt-3 mb-1">{line.slice(3)}</h3>;
          }
          if (line.trim() === '') return <br key={i} />;
          return <p key={i} className="text-[12px] text-[#888] leading-relaxed mb-1">{line}</p>;
        })}
      </div>
    </div>
  </div>
);

const EmptyPreview: React.FC<{ icon: string; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-20">
    <i className={`fa-solid ${icon} text-[100px] text-[#888]`}></i>
    <p className="font-black uppercase tracking-[0.3em] text-[#888]">{title}</p>
    <p className="text-[10px] text-[#888] max-w-xs">{subtitle}</p>
  </div>
);
