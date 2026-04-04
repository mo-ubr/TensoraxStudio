import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getApiKeyForType, getModelForType, hasStoredKeyForType } from '../services/geminiService';
import { ProjectBrief, ConceptIdea, ConceptState, GeneralDirection as GeneralDirectionType, BrandProfile } from '../types';
import { BriefForm, VideoSuggestion } from './BriefForm';
import { IdeaFactory } from './IdeaFactory';
import { IdeaFinetune } from './IdeaFinetune';
import { GeneralDirection, emptyDirection, GENERAL_DIRECTION_SYSTEM_PROMPT, SINGLE_IDEA_REGEN_PROMPT } from './GeneralDirection';
import { isClaudeModel } from '../services/claudeService';
import { DB, type Project } from '../services/projectDB';
import { generateImageWithCurrentProvider } from '../services/imageProvider';
import { Settings } from '../services/settingsDB';

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

function buildBriefSummary(brief: ProjectBrief, direction?: GeneralDirectionType): string {
  const parts = [
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
  ];

  if (direction) {
    if (direction.aim) parts.push('', `Project Aim: ${direction.aim}`);
    if (direction.characterConsistency) parts.push(`Character Notes: ${direction.characterConsistency}`);
    if (direction.sceneryConsistency) parts.push(`Scenery Notes: ${direction.sceneryConsistency}`);
    if (direction.styleGuide) parts.push(`Style Guide: ${direction.styleGuide}`);
    if (direction.generatedPrompt) parts.push('', `Creative Direction:\n${direction.generatedPrompt}`);
    if (direction.additionalNotes) parts.push('', `REFERENCE VIDEO/IMAGE STYLE ANALYSIS (use this to match the visual style):\n${direction.additionalNotes}`);
  }

  return parts.filter(Boolean).join('\n');
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
  onNavigateToImages?: () => void;
  onContextChange?: (context: string) => void;
  actionRef?: React.MutableRefObject<((action: import('./ChatBot').AssistantAction) => void) | null>;
  chatHistoryRef?: React.MutableRefObject<string>;
  initialIntent?: 'screenplay' | null;
  onIntentConsumed?: () => void;
  onSendToVideo?: (prompt: string) => void;
}

export const ConceptScreen: React.FC<ConceptScreenProps> = ({ onBack, onOpenApiKeyModal, brands, activeBrandId, activeProject, onNavigateToImages, onContextChange, actionRef, chatHistoryRef, initialIntent, onIntentConsumed, onSendToVideo }) => {
  const [step, setStep] = useState<ConceptStep>('direction');
  const [generalDirection, setGeneralDirection] = useState<GeneralDirectionType>(() => {
    const dir = { ...emptyDirection };
    if (activeProject) {
      dir.projectName = activeProject.name;
      if (activeProject.description) dir.aim = activeProject.description;
    }
    return dir;
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
  const [screenplay, setScreenplay] = useState('');
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editedSceneData, setEditedSceneData] = useState<{ scene: string; dialogue: string; prompt: string }>({ scene: '', dialogue: '', prompt: '' });
  const [dbLoaded, setDbLoaded] = useState(false);
  const [sourceDocContent, setSourceDocContent] = useState('');
  const [sourceNotes, setSourceNotes] = useState('');
  const [characterNotes, setCharacterNotes] = useState('');
  const [acceptedConcept, setAcceptedConcept] = useState<{ title: string; concept: string } | null>(null);
  const [frameImages, setFrameImages] = useState<Record<string, string>>({});
  const [generatingFrames, setGeneratingFrames] = useState<Set<string>>(new Set());
  const [frameErrors, setFrameErrors] = useState<Record<string, string>>({});
  const [savedToAssets, setSavedToAssets] = useState(false);
  const [savingToAssets, setSavingToAssets] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB on mount
  useEffect(() => {
    if (!activeProject) return;
    DB.getMetadata(activeProject.id).then(meta => {
      if (meta.generalDirection) {
        // Merge with defaults so missing fields (e.g. styleVideos) don't cause crashes
        const dir = { ...emptyDirection, ...(meta.generalDirection as GeneralDirectionType) };
        dir.projectName = activeProject.name;
        // Ensure arrays are never undefined
        if (!Array.isArray(dir.styleVideos)) dir.styleVideos = [];
        setGeneralDirection(dir);
      }
      if (meta.screenplay) setScreenplay(meta.screenplay as string);
      if (meta.conceptState) setConceptState(meta.conceptState as ConceptState);
      // Load source document content for screenplay generation
      if (meta.sourceContents && typeof meta.sourceContents === 'object') {
        const contents = Object.values(meta.sourceContents as Record<string, string>).filter(Boolean);
        if (contents.length > 0) setSourceDocContent(contents.join('\n\n---\n\n'));
      }
      if (meta.sourceNotes) setSourceNotes(meta.sourceNotes as string);
      if (meta.characterNotes) setCharacterNotes(meta.characterNotes as string);
      if (meta.acceptedConcept) setAcceptedConcept(meta.acceptedConcept as { title: string; concept: string });
      setDbLoaded(true);
    }).catch(() => setDbLoaded(true));
  }, [activeProject?.id]);

  // Auto-save to DB (debounced 1s)
  const saveToDb = useCallback(() => {
    if (!activeProject || !dbLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      DB.saveMetadata(activeProject.id, {
        generalDirection,
        screenplay,
        conceptState,
      }).catch(e => console.warn('[ConceptScreen] Auto-save failed:', e));
    }, 1000);
  }, [activeProject?.id, generalDirection, screenplay, conceptState, dbLoaded]);

  useEffect(() => { saveToDb(); }, [saveToDb]);

  // Handle intent from project page (e.g., "Create Screenplay" button)
  const intentHandled = useRef(false);
  useEffect(() => {
    if (!dbLoaded || !initialIntent || intentHandled.current) return;
    if (initialIntent === 'screenplay') {
      intentHandled.current = true;
      onIntentConsumed?.();
      if (screenplay) {
        setStep('screenplay');
      } else if (acceptedConcept) {
        // Have an accepted concept — go straight to screenplay view and auto-generate
        setStep('screenplay');
        handleGenerateScreenplay(acceptedConcept.title, acceptedConcept.concept, '');
      }
    }
  }, [dbLoaded, initialIntent]);

  useEffect(() => {
    if (!onContextChange) return;
    const gd = generalDirection;
    const fields = [
      { label: 'User Direction', key: 'aim', value: gd.aim, required: true, help: 'The main creative brief — what the video should show and achieve' },
      { label: 'Video Type', key: 'videoType', value: gd.videoType, required: false, help: 'Options: explainer, promo, tutorial, testimonial, brand, product' },
      { label: 'Format', key: 'format', value: gd.format, required: false, help: 'Options: 9:16 (vertical/shorts), 16:9 (landscape), 1:1 (square)' },
      { label: 'Duration', key: 'duration', value: gd.duration, required: false, help: 'Options: 1.5min (short), 3min (long)' },
      { label: 'Tone', key: 'tone', value: gd.tone, required: false, help: 'Options: warm, energetic, professional, playful, dramatic, inspirational' },
      { label: 'Call to Action', key: 'cta', value: gd.cta, required: true, help: 'What should viewers do after watching? e.g. "Shop now", "Visit our stores"' },
      { label: 'Target Audience', key: 'targetAudience', value: gd.targetAudience, required: true, help: 'Who is this video for? e.g. "Parents of young children"' },
      { label: 'Style Inspirations', key: 'styleVideos', value: (gd.styleVideos || []).length > 0 ? gd.styleVideos.map(s => s.url).join(', ') : '', required: false, help: 'Reference video URLs from Google Drive that set the visual style' },
    ];

    const filled = fields.filter(f => !!f.value);
    const empty = fields.filter(f => !f.value && f.required);
    const optional = fields.filter(f => !f.value && !f.required);

    const parts: string[] = [];
    parts.push(`## CURRENT STEP: ${step === 'direction' ? 'General Direction (setup)' : step === 'ideas' ? 'Idea Factory (ideas generated)' : 'Screenplay'}`);
    parts.push(`Project: ${gd.projectName || '(not named yet)'}`);

    parts.push('\n## DIRECTION FIELDS STATUS');
    for (const f of fields) {
      const status = f.value ? `✅ ${f.label}: ${f.value}` : `❌ ${f.label}: (empty) — ${f.help}`;
      parts.push(status);
    }

    if (empty.length > 0) {
      parts.push(`\n⚠️ MISSING REQUIRED FIELDS: ${empty.map(f => f.label).join(', ')}`);
      parts.push('Help the user fill these in before generating ideas.');
    } else if (!gd.generatedPrompt) {
      parts.push('\n✅ All required fields are filled. The user can now click "Generate Idea".');
    }

    if (gd.generatedPrompt) {
      const ideasText = gd.generatedPrompt.length > 3000
        ? gd.generatedPrompt.slice(0, 3000) + '\n...(truncated)'
        : gd.generatedPrompt;
      parts.push(`\n## GENERATED IDEAS\n\n${ideasText}`);
    }
    if (screenplay) {
      const screenplayText = screenplay.length > 3000
        ? screenplay.slice(0, 3000) + '\n...(truncated)'
        : screenplay;
      parts.push(`\n## SCREENPLAY\n\n${screenplayText}`);
    }
    if (conceptState.refinedConcept) {
      parts.push(`\n## REFINED CONCEPT\n\n${conceptState.refinedConcept.slice(0, 1500)}`);
    }

    onContextChange(parts.join('\n'));
  }, [generalDirection, screenplay, conceptState.refinedConcept, step, onContextChange]);

  const activeBrand = activeBrandId ? brands.find(b => b.id === activeBrandId) : undefined;

  const actionHandlerRef = React.useRef<((action: import('./ChatBot').AssistantAction) => void) | null>(null);

  const handleAcceptConcept = async (title: string, concept: string, _directions: string) => {
    setIsSavingConcept(true);
    try {
      // Save accepted concept text to project folder
      if (activeProject) {
        const conceptText = `${title}\n${'='.repeat(title.length)}\n\n${concept}\n\nAccepted: ${new Date().toISOString().split('T')[0]}`;
        await DB.saveProjectFile(activeProject.id, `${title.replace(/[^a-zA-Z0-9 _-]/g, '')}.txt`, conceptText, 'concepts').catch(e => console.warn('[ConceptScreen] Project file save failed:', e));

        // Mark concept as accepted in metadata
        await DB.saveMetadata(activeProject.id, {
          acceptedConcept: { title, concept, acceptedAt: new Date().toISOString() },
        }).catch(() => {});
      }
    } catch (e) { console.warn('[ConceptScreen] Accept concept failed:', e); }
    setIsSavingConcept(false);

    // Navigate back to project page
    onBack();
  };

  const handleGenerateScreenplay = async (title: string, concept: string, directions: string) => {
    setIsSavingConcept(true);
    try {

      const styleAnalysis = generalDirection.additionalNotes || '';
      const hasSourceDoc = sourceDocContent.trim().length > 0;
      const scriptPrompt = `Based on the finalised video concept below, create a professional 3-column screenplay.

Title: ${title}

Concept:
${concept}
${directions ? `\nAdditional directions: ${directions}` : ''}
${generalDirection.aim ? `\nProject Aim: ${generalDirection.aim}` : ''}
${generalDirection.characterConsistency ? `\nCharacter Notes: ${generalDirection.characterConsistency}` : ''}${characterNotes.trim() ? `\nCharacter Reference Direction: ${characterNotes.trim()}` : ''}
${generalDirection.sceneryConsistency ? `\nScenery Notes: ${generalDirection.sceneryConsistency}` : ''}
${styleAnalysis ? `\nREFERENCE STYLE ANALYSIS (match this visual style in all VIDEO PROMPTs):\n${styleAnalysis}` : ''}
${hasSourceDoc ? `
═══════════════════════════════════════════════════════════════
SOURCE DOCUMENT — THIS IS YOUR PRIMARY REFERENCE
═══════════════════════════════════════════════════════════════

The user has uploaded the following source document. The screenplay MUST be based closely on this document.
${sourceNotes.trim() ? `
USER'S DIRECTION FOR THIS MATERIAL:
${sourceNotes.trim()}

Follow the user's direction above as your primary guide for HOW to use the source document.
` : ''}
CRITICAL INSTRUCTIONS FOR SOURCE DOCUMENT:
• Follow the document's structure, narrative flow, and sequence of points faithfully.
• Preserve ALL specific numbers, statistics, percentages, dates, and figures EXACTLY as they appear in the document — do NOT round, approximate, or change any numerical data.
• Use the document's key messages, arguments, and talking points as the backbone of the screenplay.
• The screenplay scenes should map to the document's sections/topics in the same order they appear.
• Do NOT invent facts, claims, or data points that are not in the source document.
• If the document contains quotes, product names, or brand-specific terminology, use them verbatim.
• Any creative interpretation (visuals, transitions, camera work) should serve the document's content, not replace it.

--- BEGIN SOURCE DOCUMENT ---
${sourceDocContent}
--- END SOURCE DOCUMENT ---
` : ''}

Generate a detailed screenplay as a scene-by-scene breakdown. Each scene has a SCENE description (with approximate duration), DIALOGUE, one or more FRAME prompts (for image generation), and one or more VIDEO PROMPT blocks (for AI video generation).

CRITICAL — VIDEO PROMPT COVERAGE:
Each scene has an approximate duration. AI video generation tools produce clips of 5-8 seconds each. You MUST generate enough VIDEO PROMPTs per scene to cover the scene's full duration AND every change in action, background, or camera angle. For example:
- A 5-8s scene with one continuous shot → 1 VIDEO PROMPT
- A 15s scene with one continuous action → 2-3 VIDEO PROMPTs
- A 25s scene with multiple locations → 4-5 VIDEO PROMPTs
- Any change in background/scenery/location within a scene → a new VIDEO PROMPT

Each VIDEO PROMPT must describe a 5-8 second clip. Consecutive VIDEO PROMPTs within the same scene MUST be seamlessly connected — the end state of one clip is the start state of the next. Include exact visual details: subject appearance, clothing, environment, lighting, camera angle, and motion.

Column 1 — SCENE: Scene number, description of what happens, action, camera direction, SFX/music cues, and APPROXIMATE DURATION in seconds (e.g. "~15s").
Column 2 — DIALOGUE: All spoken dialogue and/or narrator voiceover, attributed by character name.
Column 3 — FRAMES: Multiple numbered frame prompts. Each frame is a complete, self-contained AI image generation prompt for one distinct shot/moment in the scene — include subject, outfit, environment, framing, lighting, style. MUST match the reference style analysis if provided.
Column 4 — VIDEO PROMPTS: Multiple numbered video prompts. Each is a complete, self-contained AI video generation prompt for a 5-8 second clip. Together they must cover the scene's full duration and every scenery/action change.

Format each scene EXACTLY like this:

### Scene [N]: [Scene Title]
**SCENE:** [description, including ~Xs approximate duration]
**DIALOGUE:** [dialogue/voiceover]
**FRAME 1:** [first shot - complete image generation prompt]
**FRAME 2:** [second shot - complete image generation prompt]
**VIDEO PROMPT 1:** [first 5-8s clip - complete video generation prompt with full visual details]
**VIDEO PROMPT 2:** [next 5-8s clip - seamless continuation from VIDEO PROMPT 1]
**VIDEO PROMPT 3:** [next clip if scene duration or action changes require it]

Rules:
- Break the concept into as many scenes as needed to tell the full story
- Each scene should have an approximate duration noted in the SCENE description
- Generate enough VIDEO PROMPTs per scene to cover the FULL duration (one VIDEO PROMPT = one 5-8s clip)
- Every change in scenery, background, location, or major action within a scene MUST get its own VIDEO PROMPT
- Consecutive VIDEO PROMPTs must connect seamlessly — the end of one is the beginning of the next
- Each scene should have 2-4 frames (distinct shots/moments for image generation)
- Maintain strict character/wardrobe/environment continuity across all scenes, frames, and video prompts
- Every FRAME prompt must be fully self-contained (each works independently for image generation)
- Every VIDEO PROMPT must be fully self-contained (each works independently for video generation) but describe a seamless continuation
- Include camera movements, transitions, and pacing notes in the SCENE column
- Dialogue should match the tone: ${generalDirection.tone}
- Total duration target: ${generalDirection.duration}
- Format: ${generalDirection.format}
- If reference style analysis is provided, every VIDEO PROMPT must match that visual style, colour grading, lighting, and camera approach${hasSourceDoc ? `
- IMPORTANT: The dialogue and scene content MUST closely follow the source document. Every key point, fact, and figure from the source must be represented accurately in the screenplay. Do not contradict or deviate from the source material.` : ''}`;

      const text = await callAiText(scriptPrompt);

      if (text) {
        setScreenplay(text);
        setStep('screenplay' as ConceptStep);

        // Append screenplay to the Approved Concept Word doc
        try {
          const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, PageOrientation } = await import('docx');

          const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
          const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

          const scenes = text.split(/(?=###\s*Scene\s*\d)/i).filter((b: string) => b.trim() && /^###\s*Scene\s*\d/i.test(b.trim()));

          const conceptParas: any[] = [];
          const conceptLines = concept.split('\n');
          for (const line of conceptLines) {
            if (line.startsWith('## ')) {
              conceptParas.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.slice(3).replace(/\*\*/g, ''), bold: true })] }));
            } else if (line.trim()) {
              const parts: any[] = [];
              const boldPattern = /\*\*([^*]+)\*\*/g;
              let last = 0;
              let bm;
              while ((bm = boldPattern.exec(line)) !== null) {
                if (bm.index > last) parts.push(new TextRun({ text: line.slice(last, bm.index), size: 22 }));
                parts.push(new TextRun({ text: bm[1], bold: true, size: 22 }));
                last = bm.index + bm[0].length;
              }
              if (last < line.length) parts.push(new TextRun({ text: line.slice(last), size: 22 }));
              conceptParas.push(new Paragraph({ children: parts.length > 0 ? parts : [new TextRun({ text: line, size: 22 })] }));
            } else {
              conceptParas.push(new Paragraph({ text: '' }));
            }
          }

          const screenplayRows = scenes.map((scene: string) => {
            const titleMatch = scene.match(/###\s*Scene\s*(\d+)[:\s\-–]*(.*)/i);
            const sceneLabel = `Scene ${titleMatch?.[1] || '?'}: ${titleMatch?.[2]?.replace(/\*\*/g, '').trim() || ''}`;
            const sceneMatch = scene.match(/\*\*SCENE[:\s]*\*\*\s*([\s\S]*?)(?=\*\*DIALOGUE[:\s]*\*\*|$)/i);
            const dialogueMatch = scene.match(/\*\*DIALOGUE[:\s]*\*\*\s*([\s\S]*?)(?=\*\*(?:VIDEO\s*PROMPT|FRAME\s*\d+)[:\s]*\*\*|$)/i);

            // Parse FRAME prompts
            const framesList = [...scene.matchAll(/\*\*FRAME\s*(\d+)[:\s]*\*\*\s*([\s\S]*?)(?=\*\*(?:FRAME\s*\d+|VIDEO\s*PROMPT)[:\s]*\*\*|###|$)/gi)]
              .map(m => `Frame ${m[1]}: ${m[2]?.trim()}`).filter(Boolean);

            // Parse VIDEO PROMPT blocks (numbered)
            const videoPromptsList = [...scene.matchAll(/\*\*VIDEO\s*PROMPT\s*(\d+)[:\s]*\*\*\s*([\s\S]*?)(?=\*\*VIDEO\s*PROMPT\s*\d+[:\s]*\*\*|\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/gi)]
              .map(m => `VP ${m[1]}: ${m[2]?.trim()}`).filter(Boolean);
            // Fallback: single VIDEO PROMPT (no number)
            if (videoPromptsList.length === 0) {
              const vp = scene.match(/\*\*VIDEO\s*PROMPT[:\s]*\*\*\s*([\s\S]*?)(?=\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/i);
              if (vp?.[1]?.trim()) videoPromptsList.push(vp[1].trim());
            }

            return new TableRow({
              children: [
                new TableCell({ borders: cellBorders, width: { size: 20, type: WidthType.PERCENTAGE }, children: [
                  new Paragraph({ children: [new TextRun({ text: sceneLabel, bold: true, size: 18 })] }),
                  new Paragraph({ children: [new TextRun({ text: sceneMatch?.[1]?.trim() || '', size: 18 })] }),
                ] }),
                new TableCell({ borders: cellBorders, width: { size: 20, type: WidthType.PERCENTAGE }, children: [
                  new Paragraph({ children: [new TextRun({ text: dialogueMatch?.[1]?.trim() || '', italics: true, size: 18 })] }),
                ] }),
                new TableCell({ borders: cellBorders, width: { size: 30, type: WidthType.PERCENTAGE }, children:
                  framesList.map(f => new Paragraph({ children: [new TextRun({ text: f, size: 16, font: 'Consolas' })] }))
                }),
                new TableCell({ borders: cellBorders, width: { size: 30, type: WidthType.PERCENTAGE }, children:
                  videoPromptsList.length > 0
                    ? videoPromptsList.map(vp => new Paragraph({ children: [new TextRun({ text: vp, size: 16, font: 'Consolas' })] }))
                    : [new Paragraph({ children: [new TextRun({ text: '(no video prompts)', size: 16, color: '999999' })] })]
                }),
              ],
            });
          });

          const headerRow = new TableRow({
            children: ['SCENE', 'DIALOGUE', 'FRAMES', 'VIDEO PROMPTS'].map(h =>
              new TableCell({
                borders: cellBorders,
                shading: { fill: '91569C' },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })] })],
              })
            ),
          });

          const doc = new Document({
            sections: [{
              properties: {
                page: {
                  size: { orientation: PageOrientation.LANDSCAPE },
                  margin: { top: 720, bottom: 720, left: 720, right: 720 },
                },
              },
              children: [
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `${generalDirection.projectName || 'Project'} — Approved Concept`, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: `Approved: ${new Date().toLocaleDateString()} — TensorAx Studio`, italics: true, color: '888888', size: 18 })] }),
                new Paragraph({ text: '' }),
                ...conceptParas,
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Screenplay', bold: true })] }),
                new Paragraph({ text: '' }),
                new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...screenplayRows] }),
              ],
            }],
          });

          const blob = await Packer.toBlob(doc);
          const dataUrl = await new Promise<string>(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.readAsDataURL(blob);
          });
          const docxFilename = `${(generalDirection.projectName || 'Project').replace(/\s+/g, '_')}_Screenplay.docx`;
          if (activeProject) {
            await DB.saveProjectFile(activeProject.id, docxFilename, dataUrl).catch(e => console.warn('[ConceptScreen] Word doc save failed:', e));
          }
        } catch (e) { console.warn('Word screenplay append failed:', e); }
      }
    } catch (err: any) {
      alert(`Failed: ${err.message || err}`);
    } finally {
      setIsSavingConcept(false);
    }
  };

  const handleDirectionChange = (dir: GeneralDirectionType) => {
    setGeneralDirection(dir);
  };

  const callAiText = async (prompt: string): Promise<string> => {
    const globalModel = Settings.get('tensorax_active_model');
    const model = globalModel || getAiModel() || 'gemini-2.5-flash';

    if (isClaudeModel(model || null)) {
      const copyKey = getApiKeyForType('copy');
      if (!copyKey) throw new Error('Please set your Anthropic API key in Project Settings → Creative Ideas & Script.');
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: copyKey.trim(), dangerouslyAllowBrowser: true });
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

    const analysisKey = getApiKeyForType('analysis');
    if (!analysisKey) throw new Error('Please set your Google AI API key in Project Settings → Image Analysis.');
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: analysisKey });
    const modelName = model || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({ model: modelName, contents: prompt });
    return typeof response.text === 'string' ? response.text : '';
  };

  const handleGenerateDirection = async (feedback?: string) => {
    setIsGeneratingDirection(true);
    try {
      const systemPrompt = GENERAL_DIRECTION_SYSTEM_PROMPT(generalDirection, activeBrand, sourceDocContent, sourceNotes, characterNotes);
      const fullPrompt = feedback ? `${systemPrompt}\n\n---\n\n${feedback}` : systemPrompt;
      const text = await callAiText(fullPrompt);

      if (text) {
        const updated = { ...generalDirection, generatedPrompt: text };
        setGeneralDirection(updated);
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
      const prompt = SINGLE_IDEA_REGEN_PROMPT(ideaNum, currentIdeas, generalDirection, activeBrand, feedback, sourceDocContent, sourceNotes, characterNotes);
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
      }
    } catch (err: any) {
      alert(`Failed to regenerate idea: ${err.message || err}`);
    } finally {
      setRegeneratingIdeaNum(null);
    }
  };

  // Wire up the assistant action handler
  useEffect(() => {
    const handler = (action: import('./ChatBot').AssistantAction) => {
      if (action.type === 'set_field' && action.field && action.value !== undefined) {
        const fieldMap: Record<string, string> = {
          aim: 'aim', cta: 'cta', targetAudience: 'targetAudience',
          videoType: 'videoType', format: 'format', duration: 'duration', tone: 'tone',
          characterConsistency: 'characterConsistency', sceneryConsistency: 'sceneryConsistency',
        };
        const key = fieldMap[action.field];
        if (key) {
          setGeneralDirection(prev => ({ ...prev, [key]: action.value }));
        }
      } else if (action.type === 'generate_idea') {
        handleGenerateDirection();
      } else if (action.type === 'regenerate_idea') {
        const text = generalDirection.generatedPrompt;
        if (!text) { handleGenerateDirection(action.feedback); return; }

        const ideaBlocks: { num: number; title: string; body: string }[] = [];
        const pattern = /(?:^|\n)#{1,3}\s*(?:\*\*)?(?:Idea|Concept|Response)\s*(\d*)[:\s\-–.]*(.*?)(?:\*\*)?(?=\n)/gi;
        let m;
        while ((m = pattern.exec(text)) !== null) {
          const num = parseInt(m[1]) || (ideaBlocks.length + 1);
          const start = text.indexOf('\n', m.index) + 1;
          const rest = text.slice(start);
          const nextHeading = rest.search(/\n#{1,3}\s*(?:\*\*)?(?:Idea|Concept)\s*\d/i);
          const end = nextHeading >= 0 ? start + nextHeading : text.length;
          ideaBlocks.push({ num, title: m[2].replace(/\*\*/g, '').trim(), body: text.slice(start, end).trim() });
        }
        if (ideaBlocks.length === 0) {
          ideaBlocks.push({ num: 1, title: 'Response', body: text });
        }

        const chatHistory = chatHistoryRef?.current || '';
        const fullFeedback = [
          action.feedback,
          chatHistory ? `\n\nFull conversation with the user (incorporate ALL their comments):\n${chatHistory}` : '',
        ].filter(Boolean).join('\n');

        handleRegenerateSingleIdea(ideaBlocks[0].num, ideaBlocks, { comment: fullFeedback });
      } else if (action.type === 'accept_concept') {
        const text = generalDirection.generatedPrompt;
        const titleMatch = text.match(/(?:##?\s*(?:Idea|Concept)\s*\d*[:\s\-–.]*)(.*?)(?:\n|$)/i);
        const title = titleMatch?.[1]?.replace(/\*\*/g, '').trim() || 'Concept';
        handleAcceptConcept(title, text, '');
      }
    };
    actionHandlerRef.current = handler;
    if (actionRef) actionRef.current = handler;
  });

  const getGoogleKey = (): string => {
    const key = getApiKeyForType('analysis');
    if (!key) throw new Error('Please set your Google AI API key in Project Settings → Image Analysis.');
    return key;
  };

  const getAnthropicKey = (): string => {
    const key = getApiKeyForType('copy');
    if (!key) throw new Error('Please set your Anthropic API key in Project Settings → Creative Ideas & Script.');
    return key;
  };

  const getAiModel = (): string | undefined => {
    const globalModel = Settings.get('tensorax_active_model');
    return getModelForType('copy') || getModelForType('analysis') || globalModel || undefined;
  };

  const handleSearchVideos = async (brief: ProjectBrief): Promise<VideoSuggestion[]> => {
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

    const text = await callAiText(prompt);
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
    if (!generalDirection.additionalNotes?.includes('STYLE ANALYSIS')) {
      const proceed = confirm('No style analysis found. The AI works best when it has analysed reference videos/images first.\n\nGo to General Direction → Style Inspirations to analyse a reference.\n\nContinue anyway?');
      if (!proceed) return;
    }

    setIsGeneratingIdeas(true);
    try {
      const briefText = buildBriefSummary(conceptState.brief, generalDirection);

      const prompt = `You are a creative director at a top video production studio. Based on the following project brief AND the reference style analysis, generate exactly 1 video concept idea.

CRITICAL: If a REFERENCE VIDEO/IMAGE STYLE ANALYSIS is provided below, your concept MUST match that visual style, tone, pacing, and production approach. The style analysis is the primary creative reference.

Use this exact format:

## Idea: [Creative Title]
**Summary:** [2-3 sentence overview of the concept approach]
**Key Scenes:** [Brief description of 3-4 key visual moments]
**Visual Style:** [Describe the visual treatment, color palette, mood — must align with the reference analysis]
**Why It Works:** [1 sentence on why this concept fits]

PROJECT BRIEF & CREATIVE DIRECTION:
${briefText}`;

      const text = await callAiText(prompt);
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
      const prompt = `You are a creative director refining a video concept. Here is the current concept:

${conceptState.refinedConcept}

The client has given this feedback/direction:
"${direction}"

Please refine the concept based on this feedback. Keep the same structure but incorporate the changes. Return ONLY the refined concept text, no meta-commentary.`;

      const text = await callAiText(prompt);
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
                if (isSavingConcept && !screenplay) return (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
                    <i className="fa-solid fa-spinner fa-spin text-3xl text-[#91569c]"></i>
                    <p className="text-[12px] font-bold text-[#5c3a62] uppercase tracking-wider">Generating Screenplay...</p>
                    <p className="text-[10px] text-[#888]">This may take a minute. The AI is creating your scene breakdown.</p>
                  </div>
                );
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
                    {/* Generate All Frames button */}
                    <button
                      disabled={generatingFrames.size > 0}
                      onClick={async () => {
                        const allFrames: { key: string; prompt: string }[] = [];
                        scenes.forEach((scene, i) => {
                          const frameMatches = [...scene.matchAll(/\*\*FRAME\s*(\d+)[:\s]*\*\*\s*([\s\S]*?)(?=\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/gi)];
                          frameMatches.forEach(fm => {
                            if (fm[2]?.trim()) allFrames.push({ key: `scene-${i}-frame-${fm[1]}`, prompt: fm[2].trim() });
                          });
                          // Fallback: VIDEO PROMPT as single frame
                          if (frameMatches.length === 0) {
                            const vp = scene.match(/\*\*VIDEO\s*PROMPT[:\s]*\*\*\s*([\s\S]*?)(?=\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/i);
                            if (vp?.[1]?.trim()) allFrames.push({ key: `scene-${i}-frame-1`, prompt: vp[1].trim() });
                          }
                        });
                        console.log('[GenerateAllFrames] Found frames:', allFrames.length, allFrames.map(f => f.key));
                        if (allFrames.length === 0) { alert('No frame prompts found in screenplay. Try regenerating the screenplay.'); return; }
                        setGeneratingFrames(prev => {
                          const s = new Set(prev);
                          allFrames.forEach(f => s.add(f.key));
                          return s;
                        });
                        setFrameErrors({});
                        for (const { key, prompt } of allFrames) {
                          try {
                            const url = await generateImageWithCurrentProvider({ prompt, size: '1K', aspectRatio: '16:9', referenceImages: [] });
                            setFrameImages(prev => ({ ...prev, [key]: url }));
                          } catch (err: any) {
                            setFrameErrors(prev => ({ ...prev, [key]: err?.message || 'Generation failed' }));
                          }
                          setGeneratingFrames(prev => { const s = new Set(prev); s.delete(key); return s; });
                        }
                      }}
                      className="w-full py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#91569c] text-white hover:bg-[#7a4385] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {generatingFrames.size > 0 ? (
                        <><i className="fa-solid fa-spinner fa-spin"></i> Generating {generatingFrames.size} remaining...</>
                      ) : (
                        <><i className="fa-solid fa-images"></i> Generate All Frames</>
                      )}
                    </button>
                    {scenes.map((scene, i) => {
                      const titleMatch = scene.match(/###\s*Scene\s*(\d+)[:\s\-–]*(.*)/i);
                      const sceneNum = titleMatch?.[1] || `${i + 1}`;
                      const sceneTitle = titleMatch?.[2]?.replace(/\*\*/g, '').trim() || `Scene ${sceneNum}`;
                      const sceneMatch = scene.match(/\*\*SCENE[:\s]*\*\*\s*([\s\S]*?)(?=\*\*DIALOGUE[:\s]*\*\*|$)/i);
                      const dialogueMatch = scene.match(/\*\*DIALOGUE[:\s]*\*\*\s*([\s\S]*?)(?=\*\*(?:VIDEO\s*PROMPT|FRAME\s*\d+)[:\s]*\*\*|$)/i);
                      const frames = [...scene.matchAll(/\*\*FRAME\s*(\d+)[:\s]*\*\*\s*([\s\S]*?)(?=\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/gi)]
                        .map(m => ({ num: m[1], prompt: m[2]?.trim() || '' }))
                        .filter(f => f.prompt);
                      // Fallback: if no FRAME tags found, try VIDEO PROMPT as single frame
                      if (frames.length === 0) {
                        const vp = scene.match(/\*\*VIDEO\s*PROMPT[:\s]*\*\*\s*([\s\S]*?)(?=\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/i);
                        if (vp?.[1]?.trim()) frames.push({ num: '1', prompt: vp[1].trim() });
                      }
                      const isEditing = editingScene === i;
                      return (
                        <div key={i} className={`bg-[#f6f0f8] border rounded-xl overflow-hidden transition-colors ${isEditing ? 'border-[#91569c]/40' : 'border-[#ceadd4]'}`}>
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f6f0f8] border-b border-[#ceadd4]">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#91569c] flex items-center justify-center text-[#3a3a3a] text-[10px] font-black">{sceneNum}</span>
                            <h3 className="flex-1 text-[12px] font-bold text-[#5c3a62]">{sceneTitle}</h3>
                            <span className="text-[8px] text-[#888]/60">{frames.length} frame{frames.length !== 1 ? 's' : ''}</span>
                            {!isEditing ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingScene(i);
                                  setEditedSceneData({
                                    scene: sceneMatch?.[1]?.trim() || '',
                                    dialogue: dialogueMatch?.[1]?.trim() || '',
                                    prompt: frames.map(f => f.prompt).join('\n---\n'),
                                  });
                                }}
                                title="Edit this scene"
                                className="text-[8px] font-bold uppercase px-2 py-1 rounded border border-[#ceadd4] text-[#5c3a62] hover:border-[#91569c]/40 transition-colors flex items-center gap-1"
                              >
                                <i className="fa-solid fa-pen text-[7px]"></i>
                                Edit
                              </button>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Save edits back into the screenplay markdown
                                    const updated = [...scenes];
                                    const tMatch = updated[i].match(/###\s*Scene\s*(\d+)[:\s\-–]*(.*)/i);
                                    const sNum = tMatch?.[1] || `${i + 1}`;
                                    const sTitle = tMatch?.[2]?.replace(/\*\*/g, '').trim() || `Scene ${sNum}`;
                                    // Rebuild frame prompts
                                    const editedFrames = editedSceneData.prompt.split(/\n---\n/).map((p, fi) => `**FRAME ${fi + 1}:** ${p.trim()}`).join('\n\n');
                                    // Also use last frame as video prompt for compatibility
                                    const lastFramePrompt = editedSceneData.prompt.split(/\n---\n/).pop()?.trim() || editedSceneData.prompt.trim();
                                    updated[i] = `### Scene ${sNum}: ${sTitle}\n\n**SCENE:** ${editedSceneData.scene}\n\n**DIALOGUE:** ${editedSceneData.dialogue}\n\n${editedFrames}\n\n**VIDEO PROMPT:** ${lastFramePrompt}\n`;
                                    setScreenplay(updated.join('\n'));
                                    setEditingScene(null);
                                  }}
                                  className="text-[8px] font-bold uppercase px-2 py-1 rounded bg-[#91569c] text-white hover:bg-[#7a4385] transition-colors flex items-center gap-1"
                                >
                                  <i className="fa-solid fa-check text-[7px]"></i> Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingScene(null)}
                                  className="text-[8px] font-bold uppercase px-2 py-1 rounded border border-[#ceadd4] text-[#5c3a62] hover:border-[#91569c]/40 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {onSendToVideo && frames.length > 0 && (
                              <button
                                type="button"
                                onClick={() => onSendToVideo(frames[0].prompt)}
                                title="Send video prompt to Video screen"
                                className="text-[8px] font-bold uppercase px-2 py-1 rounded bg-[#91569c] text-white hover:bg-[#7a4385] transition-colors flex items-center gap-1"
                              >
                                <i className="fa-solid fa-video text-[7px]"></i>
                                Video
                              </button>
                            )}
                          </div>
                          {/* Scene + Dialogue */}
                          {isEditing ? (
                            <div className="grid grid-cols-2 divide-x divide-[#4a3a52]">
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Scene</span>
                                <textarea
                                  value={editedSceneData.scene}
                                  onChange={e => setEditedSceneData(prev => ({ ...prev, scene: e.target.value }))}
                                  className="w-full text-[10px] text-[#3a3a3a] bg-white border border-[#ceadd4] rounded-lg p-2 leading-relaxed resize-y min-h-[60px] focus:outline-none focus:border-[#91569c]"
                                  rows={4}
                                />
                              </div>
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Dialogue</span>
                                <textarea
                                  value={editedSceneData.dialogue}
                                  onChange={e => setEditedSceneData(prev => ({ ...prev, dialogue: e.target.value }))}
                                  className="w-full text-[10px] text-[#3a3a3a] bg-white border border-[#ceadd4] rounded-lg p-2 leading-relaxed italic resize-y min-h-[60px] focus:outline-none focus:border-[#91569c]"
                                  rows={4}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 divide-x divide-[#4a3a52]">
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Scene</span>
                                <p className="text-[10px] text-[#888] leading-relaxed">{sceneMatch?.[1]?.trim() || '—'}</p>
                              </div>
                              <div className="p-3">
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Dialogue</span>
                                <p className="text-[10px] text-[#888] leading-relaxed italic">{dialogueMatch?.[1]?.trim() || '—'}</p>
                              </div>
                            </div>
                          )}
                          {/* Frames */}
                          {frames.length > 0 && (
                            <div className="border-t border-[#ceadd4]/50">
                              {isEditing && (
                                <div className="p-3">
                                  <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">
                                    Frame / Video Prompts <span className="font-normal text-[#888]">(separate multiple with ---)</span>
                                  </span>
                                  <textarea
                                    value={editedSceneData.prompt}
                                    onChange={e => setEditedSceneData(prev => ({ ...prev, prompt: e.target.value }))}
                                    className="w-full text-[9px] text-[#3a3a3a] bg-white border border-[#ceadd4] rounded-lg p-2 leading-relaxed font-mono resize-y min-h-[80px] focus:outline-none focus:border-[#91569c]"
                                    rows={5}
                                  />
                                </div>
                              )}
                              <div className={`grid divide-x divide-[#ceadd4]/30`} style={{ gridTemplateColumns: `repeat(${frames.length}, 1fr)` }}>
                                {frames.map(frame => {
                                  const key = `scene-${i}-frame-${frame.num}`;
                                  return (
                                    <div key={key} className="p-2">
                                      <span className="text-[7px] font-black uppercase tracking-wider text-[#91569c]/60 block mb-1">Frame {frame.num}</span>
                                      {!isEditing && <p className="text-[9px] text-[#888] leading-relaxed font-mono mb-2">{frame.prompt}</p>}
                                      {generatingFrames.has(key) ? (
                                        <div className="flex items-center justify-center py-4">
                                          <i className="fa-solid fa-spinner fa-spin text-[#91569c]"></i>
                                        </div>
                                      ) : frameImages[key] ? (
                                        <div>
                                          <img src={frameImages[key]} alt={`Scene ${sceneNum} Frame ${frame.num}`} className="rounded-lg w-full object-contain mb-1.5" />
                                          <div className="flex gap-1">
                                            <button
                                              onClick={async () => {
                                                if (!activeProject) return;
                                                try {
                                                  const slug = (generalDirection.projectName || 'Project').replace(/\s+/g, '_');
                                                  const filename = `${slug}_Scene${sceneNum}_Frame${frame.num}.png`;
                                                  const resp = await fetch(frameImages[key]);
                                                  const blob = await resp.blob();
                                                  const reader = new FileReader();
                                                  reader.onloadend = async () => { await DB.saveProjectFile(activeProject.id, filename, reader.result as string, 'frames'); };
                                                  reader.readAsDataURL(blob);
                                                } catch (err) { console.error('Save failed:', err); }
                                              }}
                                              className="flex-1 py-1 rounded text-[7px] font-bold uppercase bg-[#91569c] text-white hover:bg-[#7a4385] transition-colors"
                                            >
                                              <i className="fa-solid fa-floppy-disk text-[6px] mr-0.5"></i>Save
                                            </button>
                                            <button
                                              onClick={async () => {
                                                setGeneratingFrames(prev => new Set(prev).add(key));
                                                setFrameImages(prev => { const n = { ...prev }; delete n[key]; return n; });
                                                setFrameErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
                                                try {
                                                  const url = await generateImageWithCurrentProvider({ prompt: frame.prompt, size: '1K', aspectRatio: '16:9', referenceImages: [] });
                                                  setFrameImages(prev => ({ ...prev, [key]: url }));
                                                } catch (err: any) {
                                                  setFrameErrors(prev => ({ ...prev, [key]: err?.message || 'Generation failed' }));
                                                }
                                                setGeneratingFrames(prev => { const s = new Set(prev); s.delete(key); return s; });
                                              }}
                                              className="flex-1 py-1 rounded text-[7px] font-bold uppercase bg-[#f6f0f8] border border-[#ceadd4] text-[#5c3a62] hover:border-[#91569c]/40 transition-colors"
                                            >
                                              <i className="fa-solid fa-rotate text-[6px] mr-0.5"></i>Redo
                                            </button>
                                          </div>
                                        </div>
                                      ) : null}
                                      {frameErrors[key] && (
                                        <p className="text-[8px] text-red-500 mt-1"><i className="fa-solid fa-triangle-exclamation mr-0.5"></i>{frameErrors[key]}</p>
                                      )}
                                    </div>
                                  );
                                })}
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
                  const proj = (generalDirection.projectName || 'Project').replace(/\s+/g, '_');
                  const filename = `${proj}_Screenplay.md`;
                  try {
                    if (activeProject) {
                      // Save screenplay markdown
                      await DB.saveProjectFile(activeProject.id, filename, screenplay);
                      // Save all generated frame images
                      const imageKeys = Object.keys(frameImages);
                      if (imageKeys.length > 0) {
                        for (const key of imageKeys) {
                          const parts = key.match(/scene-(\d+)-frame-(\d+)/);
                          if (!parts) continue;
                          const imgFilename = `${proj}_Scene${parseInt(parts[1]) + 1}_Frame${parts[2]}.png`;
                          const dataUrl = frameImages[key];
                          await DB.saveProjectFile(activeProject.id, imgFilename, dataUrl, 'frames').catch(e =>
                            console.warn(`Failed to save ${imgFilename}:`, e)
                          );
                        }
                      }
                    } else {
                      const res = await fetch('http://localhost:5182/api/save-file', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename, data: screenplay, folder: `output/${proj}` }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error);
                    }
                  } catch {
                    const blob = new Blob([screenplay], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                  onBack();
                }}
                disabled={!screenplay}
                className="w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-white hover:bg-[#e0d6e3] hover:text-[#5c3a62] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                Save Screenplay & All Images
              </button>
              {activeProject && screenplay && (
                <button
                  onClick={async () => {
                    if (!activeProject || savedToAssets) return;
                    setSavingToAssets(true);
                    try {
                      // Save screenplay as a concept asset
                      await DB.saveToAssets(activeProject.id, {
                        type: 'concept',
                        name: `${generalDirection.projectName || 'Project'} — Screenplay`,
                        description: screenplay.slice(0, 500),
                        tags: ['screenplay', 'concept'],
                        metadata: { source: 'concept-screen' },
                      });
                      // Save each frame image as an image asset
                      for (const [key, dataUrl] of Object.entries(frameImages)) {
                        const parts = key.match(/scene-(\d+)-frame-(\d+)/);
                        const name = parts ? `Scene ${parseInt(parts[1]) + 1} Frame ${parts[2]}` : key;
                        await DB.saveToAssets(activeProject.id, {
                          type: 'image',
                          name,
                          description: 'Frame image from screenplay',
                          thumbnail: dataUrl,
                          tags: ['frame', 'screenplay'],
                          metadata: { source: 'concept-screen' },
                        });
                      }
                      setSavedToAssets(true);
                    } catch (err: any) {
                      alert(`Failed to save to assets: ${err.message || err}`);
                    } finally {
                      setSavingToAssets(false);
                    }
                  }}
                  disabled={savedToAssets || savingToAssets}
                  className={`w-full mt-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                    savedToAssets
                      ? 'bg-green-50 border-green-300 text-green-600 cursor-default'
                      : 'bg-[#f6f0f8] border-[#ceadd4] text-[#5c3a62] hover:border-[#91569c] hover:bg-[#91569c]/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <i className={`fa-solid ${savingToAssets ? 'fa-spinner fa-spin' : savedToAssets ? 'fa-check' : 'fa-database'} text-[9px]`}></i>
                  {savedToAssets ? 'Saved to Assets' : savingToAssets ? 'Saving...' : 'Save All to Assets Database'}
                </button>
              )}
            </div>
          </div>
        ) : step === 'direction' ? (
          <>
          {acceptedConcept && !screenplay && (
            <div className="bg-[#f6f0f8] border border-[#91569c]/30 rounded-xl mx-2 mt-2 p-4 flex items-center gap-4 flex-shrink-0">
              <div className="w-10 h-10 rounded-lg bg-[#91569c] flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-check text-white"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#5c3a62]">Concept accepted: {acceptedConcept.title}</p>
                <p className="text-[9px] text-[#888] mt-0.5">Ready to generate the screenplay from this concept</p>
              </div>
              <button
                onClick={() => handleGenerateScreenplay(acceptedConcept.title, acceptedConcept.concept, '')}
                disabled={isSavingConcept}
                className="px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
              >
                <i className={`fa-solid ${isSavingConcept ? 'fa-spinner fa-spin' : 'fa-scroll'}`}></i>
                {isSavingConcept ? 'Generating...' : 'Create Screenplay'}
              </button>
            </div>
          )}
          <GeneralDirection
            value={generalDirection}
            onChange={handleDirectionChange}
            activeBrand={activeBrand}
            onGeneratePrompt={handleGenerateDirection}
            onRegenerateSingleIdea={handleRegenerateSingleIdea}
            isGenerating={isGeneratingDirection}
            regeneratingIdeaNum={regeneratingIdeaNum}
            onSaveAndCreateScript={handleAcceptConcept}
            onSaveFile={activeProject ? async (filename, data, subfolder) => {
              await DB.saveProjectFile(activeProject.id, filename, data, subfolder);
            } : undefined}
            isSaving={isSavingConcept}
          />
          </>
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
