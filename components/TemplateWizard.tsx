import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PROJECT_TEMPLATES, TemplateState, TransformationStage, VideoSegment, type TemplateId } from '../types';
import { DB } from '../services/projectDB';
import { GeminiService } from '../services/geminiService';
import DropZone from './DropZone';

/**
 * TemplateWizard — Multi-stage keyframe pipeline for "What If? Transformation".
 *
 * Step 0: Upload source image + reference transformation video
 * Step 1: Analyse video → extract transformation stages → user edits stage prompts
 * Step 2: Generate keyframe images (Flux Kontext, chained stage-by-stage)
 * Step 3: Generate video segments between keyframes (Kling start+end frame) + stitch
 */

interface TemplateWizardProps {
  templateId: TemplateId;
  projectId?: string;
  onComplete: (state: TemplateState) => void;
  onCancel: () => void;
}

const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** Get the selected image editing model — Nano Banana (Gemini) or Flux Kontext (fal.ai) */
const getImageEditingModel = (): string => {
  try {
    const model = localStorage.getItem('tensorax_image_model')?.trim() || 'gemini-3-pro-image-preview';
    // Nano Banana = gemini-3-pro-image-preview or gemini-3.1-flash-image-preview
    // Flux Kontext = flux-kontext-dev or flux-kontext-pro
    return model;
  } catch { return 'gemini-3-pro-image-preview'; }
};

/** Is the selected model a Gemini/Nano Banana model (vs fal.ai Flux Kontext)? */
const isGeminiModel = (model: string): boolean =>
  model.startsWith('gemini') || !model.startsWith('flux-kontext');

/** Get the API key for the selected image editing model */
const getImageEditingKey = (): string => {
  try {
    const model = getImageEditingModel();

    // 1. Per-model key
    const perModelKey = localStorage.getItem(`tensorax_image_key__${model}`)?.trim();
    if (perModelKey) return perModelKey;

    // 2. Base image key
    const baseKey = localStorage.getItem('tensorax_image_key')?.trim();
    if (baseKey) return baseKey;

    // 3. For Gemini models, try any Google AI key; for fal models, try any fal key
    const allImageKeys = Object.keys(localStorage).filter(k => k.startsWith('tensorax_image_key'));
    if (isGeminiModel(model)) {
      // Google AI keys start with AIza
      for (const lsKey of allImageKeys) {
        const val = localStorage.getItem(lsKey)?.trim() || '';
        if (val && val.startsWith('AIza')) return val;
      }
    } else {
      // fal.ai keys don't start with AIza
      for (const lsKey of allImageKeys) {
        const val = localStorage.getItem(lsKey)?.trim() || '';
        if (val && !val.startsWith('AIza')) return val;
      }
    }

    // 4. Try analysis key as fallback (for Gemini models)
    if (isGeminiModel(model)) {
      const analysisKey = localStorage.getItem('tensorax_analysis_key')?.trim();
      if (analysisKey) return analysisKey;
    }

    return '';
  } catch { return ''; }
};

/** Get fal.ai key for video generation (Kling/Seedance) from localStorage */
const getFalVideoKey = (): string => {
  try {
    // Shared fal key first
    const falKey = localStorage.getItem('tensorax_fal_key')?.trim();
    if (falKey) return falKey;
    // Search per-model keys for any fal key
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('tensorax_video_key__'));
    for (const lsKey of allKeys) {
      const val = localStorage.getItem(lsKey)?.trim() || '';
      if (val && !val.startsWith('AIza')) return val;
    }
    return localStorage.getItem('tensorax_video_key')?.trim() || '';
  } catch { return ''; }
};

/** Get any Gemini API key from localStorage — checks all possible storage locations */
const getGeminiKey = (): string => {
  try {
    // 1. Per-model analysis key
    const model = localStorage.getItem('tensorax_analysis_model')?.trim() || '';
    const perModel = localStorage.getItem(`tensorax_analysis_key__${model}`)?.trim();
    if (perModel) return perModel;
    // 2. Base analysis key
    const base = localStorage.getItem('tensorax_analysis_key')?.trim();
    if (base) return base;
    // 3. Video analysis key (separate slot in Project Settings)
    const vaModel = localStorage.getItem('tensorax_video_analysis_model')?.trim() || '';
    const vaPerModel = localStorage.getItem(`tensorax_video_analysis_key__${vaModel}`)?.trim();
    if (vaPerModel) return vaPerModel;
    const vaBase = localStorage.getItem('tensorax_video_analysis_key')?.trim();
    if (vaBase) return vaBase;
    // 4. Any Google AI key from image generation
    const imgModel = localStorage.getItem('tensorax_image_model')?.trim() || '';
    const imgKey = localStorage.getItem(`tensorax_image_key__${imgModel}`)?.trim();
    if (imgKey && imgKey.startsWith('AIza')) return imgKey;
    const imgBase = localStorage.getItem('tensorax_image_key')?.trim();
    if (imgBase && imgBase.startsWith('AIza')) return imgBase;
    return '';
  } catch { return ''; }
};

/**
 * Use Gemini to analyse the source image and generate context-appropriate
 * transformation stage prompts. Works for buildings, roads, bridges, parks,
 * or any infrastructure/construction subject.
 */
async function generateSmartStagePrompts(
  imageDataUri: string,
  apiKey: string,
): Promise<{ stages: TransformationStage[]; segments: VideoSegment[] } | null> {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const model = localStorage.getItem('tensorax_analysis_model')?.trim() || 'gemini-2.5-flash';

    const base64 = imageDataUri.split(',')[1];
    const mimeType = imageDataUri.match(/data:([^;]+)/)?.[1] || 'image/jpeg';

    const systemPrompt = `You are an expert in construction, civil engineering, and architectural renovation.

Analyse this image and identify what the subject is (e.g. residential building, road, bridge, park, commercial building, industrial site, public square, etc.).

Then generate exactly 6 transformation stages showing a realistic renovation/construction progression from current state to completed result. Each stage should show the RESULT of that phase of work — not the process. No people, no workers visible in any stage.

Use materials, techniques, and terminology specific to the subject type:
- For BUILDINGS: scaffolding, insulation boards, render/plaster, window frames, balcony railings, facade panels, roof elements, landscaping
- For ROADS: surface milling, base layer compaction, drainage installation, asphalt layers, line markings, signage, barriers, kerb stones
- For BRIDGES: structural reinforcement, deck resurfacing, bearing replacement, expansion joints, parapet walls, anti-corrosion coating, lighting
- For PARKS/PUBLIC SPACES: ground clearing, drainage, pathways, planting beds, irrigation, furniture, lighting, water features
- For other subjects: use appropriate construction/renovation terminology

CRITICAL RULES:
- Every prompt must start with "Same [subject], exact same camera angle. No people visible."
- Every prompt must end with "Photorealistic."
- Include specific materials, colours, textures, and construction details
- Each stage builds on the previous one progressively
- Stage 1 is always the current/original state (source image)
- Stage 6 is the fully completed transformation with attractive lighting

Also generate 5 video transition prompts (one between each consecutive pair of stages) describing the visible time-lapse transformation. Each must:
- Start with "Locked-off camera, no camera movement. Time-lapse:"
- Describe specific visible changes (materials appearing, surfaces transforming, elements being installed)
- Include "No people visible. Smooth, cinematic, photorealistic."

Return ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "subjectType": "residential building",
  "stages": [
    { "id": 1, "label": "Current State (source image)", "prompt": "(source image — no generation needed)" },
    { "id": 2, "label": "Stage Name", "prompt": "Detailed prompt..." },
    { "id": 3, "label": "Stage Name", "prompt": "Detailed prompt..." },
    { "id": 4, "label": "Stage Name", "prompt": "Detailed prompt..." },
    { "id": 5, "label": "Stage Name", "prompt": "Detailed prompt..." },
    { "id": 6, "label": "Stage Name", "prompt": "Detailed prompt..." }
  ],
  "segments": [
    { "id": 1, "prompt": "Locked-off camera transition prompt..." },
    { "id": 2, "prompt": "Locked-off camera transition prompt..." },
    { "id": 3, "prompt": "Locked-off camera transition prompt..." },
    { "id": 4, "prompt": "Locked-off camera transition prompt..." },
    { "id": 5, "prompt": "Locked-off camera transition prompt..." }
  ]
}`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Strip markdown code fences if present
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!parsed.stages || parsed.stages.length < 4) return null;

    const stages: TransformationStage[] = parsed.stages.map((s: any) => ({
      id: s.id,
      label: s.label,
      prompt: s.prompt,
    }));

    const segments: VideoSegment[] = (parsed.segments || []).map((s: any, i: number) => ({
      id: s.id || i + 1,
      startStageId: i + 1,
      endStageId: i + 2,
      prompt: s.prompt,
    }));

    console.log(`[TemplateWizard] Smart prompts generated for: ${parsed.subjectType}`);
    return { stages, segments };
  } catch (err) {
    console.warn('[TemplateWizard] Smart prompt generation failed, using defaults:', err);
    return null;
  }
}

/** Get the selected video model */
const getVideoModel = (): string => {
  try { return localStorage.getItem('tensorax_video_model')?.trim() || 'veo-2.0-generate-001'; } catch { return 'veo-2.0-generate-001'; }
};

/** Is the selected video model a Veo/Gemini model (vs fal.ai)? */
const isVeoModel = (model: string): boolean =>
  model.startsWith('veo') || model.startsWith('gemini');

/** Get the video API key for the selected model */
const getVideoKey = (): string => {
  try {
    const model = getVideoModel();
    // Per-model key first
    const perModel = localStorage.getItem(`tensorax_video_key__${model}`)?.trim();
    if (perModel) return perModel;
    // Shared fal key for fal-based models
    if (model.startsWith('kling-') || model.startsWith('seedance')) {
      const falKey = localStorage.getItem('tensorax_fal_key')?.trim();
      if (falKey) return falKey;
    }
    // Base video key
    const base = localStorage.getItem('tensorax_video_key')?.trim();
    if (base) return base;
    // For Veo, try any Google AI key
    if (isVeoModel(model)) {
      const analysisKey = localStorage.getItem('tensorax_analysis_key')?.trim();
      if (analysisKey) return analysisKey;
      const imgModel = localStorage.getItem('tensorax_image_model')?.trim() || '';
      const imgKey = localStorage.getItem(`tensorax_image_key__${imgModel}`)?.trim();
      if (imgKey && imgKey.startsWith('AIza')) return imgKey;
    }
    return '';
  } catch { return ''; }
};

// Default sample video embedded with the template
const SAMPLE_VIDEO_URL = '/samples/what-if-sample.mp4';
const SAMPLE_VIDEO_NAME = 'What If? Sample (built-in)';

export const TemplateWizard: React.FC<TemplateWizardProps> = ({ templateId, projectId, onComplete, onCancel }) => {
  const template = PROJECT_TEMPLATES.find(t => t.id === templateId)!;

  const [state, setState] = useState<TemplateState>({
    templateId,
    step: 0,
    stages: [],
    segments: [],
    isGenerating: false,
    progressMessage: '',
    referenceVideo: SAMPLE_VIDEO_URL,
    referenceVideoName: SAMPLE_VIDEO_NAME,
  });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const hasRestoredRef = useRef(false); // Prevent auto-save before initial restore

  const update = useCallback((partial: Partial<TemplateState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  // Auto-save wizard state to DB whenever it changes (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectId || state.isGenerating) return;
    // Don't save until initial restore from DB is complete
    if (!hasRestoredRef.current) return;
    // Don't save empty initial state
    if (state.stages.length === 0 && !state.beforeImage && !state.videoAnalysis) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const wizardState = {
        step: state.step,
        stages: state.stages.map(s => ({ id: s.id, label: s.label, prompt: s.prompt, imageUrl: s.imageUrl })),
        segments: state.segments.map(s => ({ id: s.id, startStageId: s.startStageId, endStageId: s.endStageId, prompt: s.prompt, videoUrl: s.videoUrl })),
        videoAnalysis: state.videoAnalysis,
        beforeImage: state.beforeImage,
        finalVideoUrl: state.finalVideoUrl,
      };
      DB.saveMetadata(projectId, { wizardState }).catch(e => console.warn('[TemplateWizard] Failed to save state:', e));
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [projectId, state.step, state.stages, state.segments, state.videoAnalysis, state.beforeImage, state.finalVideoUrl, state.isGenerating]);

  // Pre-load template material AND restore saved wizard state
  useEffect(() => {
    if (!projectId) return;
    DB.getMetadata(projectId).then(meta => {
      const partial: Partial<TemplateState> = {};

      // Restore saved wizard state (stages, segments, step, etc.)
      if (meta.wizardState && typeof meta.wizardState === 'object') {
        const saved = meta.wizardState as Record<string, unknown>;
        if (typeof saved.step === 'number') partial.step = saved.step;
        if (Array.isArray(saved.stages) && saved.stages.length > 0) partial.stages = saved.stages as TransformationStage[];
        if (Array.isArray(saved.segments) && saved.segments.length > 0) partial.segments = saved.segments as VideoSegment[];
        if (typeof saved.videoAnalysis === 'string') partial.videoAnalysis = saved.videoAnalysis;
        if (typeof saved.beforeImage === 'string') partial.beforeImage = saved.beforeImage;
        if (typeof saved.finalVideoUrl === 'string') partial.finalVideoUrl = saved.finalVideoUrl;
      }

      // Fallback: load from ProjectSettings uploads if no saved wizard state
      if (!partial.beforeImage && meta.templateImage && typeof meta.templateImage === 'string') {
        partial.beforeImage = meta.templateImage as string;
      }
      if (meta.templateVideo && typeof meta.templateVideo === 'string') {
        partial.referenceVideo = meta.templateVideo as string;
        if (meta.templateVideoName) partial.referenceVideoName = meta.templateVideoName as string;
      }
      if (Object.keys(partial).length > 0) {
        setState(prev => ({ ...prev, ...partial }));
      }
      // Mark restore as complete — auto-save can now safely run
      hasRestoredRef.current = true;
    }).catch(() => { hasRestoredRef.current = true; });
  }, [projectId]);

  const updateStage = useCallback((id: number, partial: Partial<TransformationStage>) => {
    setState(prev => ({
      ...prev,
      stages: prev.stages.map(s => s.id === id ? { ...s, ...partial } : s),
    }));
  }, []);

  const updateSegment = useCallback((id: number, partial: Partial<VideoSegment>) => {
    setState(prev => ({
      ...prev,
      segments: prev.segments.map(s => s.id === id ? { ...s, ...partial } : s),
    }));
  }, []);

  // ── Step 0: Upload media ───────────────────────────────────────────────────

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    update({ beforeImage: await fileToDataUri(file) });
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    update({ referenceVideo: await fileToDataUri(file), referenceVideoName: file.name });
  };

  // ── Step 1: Analyse video & define stages ──────────────────────────────────

  const analyseVideo = async () => {
    if (!state.referenceVideo) return;
    update({ isGenerating: true, progressMessage: 'Uploading video to Gemini for analysis...', error: undefined });

    try {
      const geminiKey = getGeminiKey();
      if (!geminiKey) throw new Error('No Gemini API key found. Go to Project Settings (gear icon at top right) → Analysis section and enter your Gemini key.');

      const res = await fetch('/api/video/analyse-uploaded-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoData: state.referenceVideo,
          fileName: state.referenceVideoName || 'reference.mp4',
          apiKey: geminiKey,
          model: localStorage.getItem('tensorax_analysis_model')?.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Failed (${res.status})`);
      }

      const result = await res.json();

      // Parse stages from analysis — try to extract numbered stages
      const stageMatches = result.analysis.matchAll(/(?:stage|phase)\s*(\d+)[:\s—–-]+\s*(.+?)(?=\n(?:stage|phase)\s*\d|$|\n\n)/gis);
      const parsedStages: TransformationStage[] = [];
      let stageId = 1;
      for (const match of stageMatches) {
        parsedStages.push({
          id: stageId++,
          label: match[2].split('\n')[0].trim().substring(0, 60),
          prompt: match[2].trim(),
        });
      }

      // If parsing found fewer than 3 stages, use AI to generate context-appropriate prompts
      let stages: TransformationStage[];
      let segments: VideoSegment[];

      if (parsedStages.length >= 3) {
        stages = parsedStages;
        // Build generic segments for parsed stages
        segments = [];
        for (let i = 0; i < stages.length - 1; i++) {
          segments.push({
            id: i + 1,
            startStageId: stages[i].id,
            endStageId: stages[i + 1].id,
            prompt: `Locked-off camera, no camera movement. Time-lapse transition: ${stages[i].label} gradually transforms into ${stages[i + 1].label}. No people visible. Smooth, cinematic, photorealistic.`,
          });
        }
      } else {
        // Use Gemini to analyse the source image and generate appropriate prompts
        update({ progressMessage: 'Analysing source image to generate construction-appropriate stage prompts...' });
        const smartResult = state.beforeImage
          ? await generateSmartStagePrompts(state.beforeImage, geminiKey)
          : null;

        if (smartResult) {
          stages = smartResult.stages;
          segments = smartResult.segments;
        } else {
          // Final fallback — generic transformation stages
          stages = [
            { id: 1, label: 'Current State (source image)', prompt: '(source image — no generation needed)' },
            { id: 2, label: 'Initial Preparation', prompt: 'Same subject, exact same camera angle. No people visible. Site cleared and prepared for renovation work. Temporary protective barriers and equipment staging areas visible. Damaged or deteriorated elements identified and marked. Overcast natural daylight, photorealistic.' },
            { id: 3, label: 'Structural Work', prompt: 'Same subject, exact same camera angle. No people visible. Major structural repairs and reinforcement completed. New foundational elements installed. Core infrastructure upgraded. Fresh materials contrast with remaining original surfaces. Overcast daylight, photorealistic.' },
            { id: 4, label: 'Surface & Finishing', prompt: 'Same subject, exact same camera angle. No people visible. New surface finishes applied — clean, modern materials and colours. All structural work covered with final layers. New fixtures and fittings installed. Slightly overcast daylight, photorealistic.' },
            { id: 5, label: 'Surroundings & Details', prompt: 'Same subject, exact same camera angle. No people visible. Surrounding area landscaped and finished. New pathways, greenery, lighting, and street furniture installed. All construction traces removed. Soft overcast daylight, photorealistic.' },
            { id: 6, label: 'Completed Transformation', prompt: 'Same subject, exact same camera angle. No people visible. Fully completed renovation in pristine condition. Warm golden-hour sunlight. Mature landscaping, ambient lighting glowing softly. Photorealistic, architectural photography style.' },
          ];
          segments = [];
          for (let i = 0; i < stages.length - 1; i++) {
            segments.push({
              id: i + 1,
              startStageId: stages[i].id,
              endStageId: stages[i + 1].id,
              prompt: `Locked-off camera, no camera movement. Time-lapse transition: ${stages[i].label} gradually transforms into ${stages[i + 1].label}. No people visible. Smooth, cinematic, photorealistic.`,
            });
          }
        }
      }

      // Stage 1 is always the source image
      if (stages[0]) {
        stages[0].imageUrl = state.beforeImage;
      }

      update({
        videoAnalysis: result.analysis,
        stages,
        segments,
        isGenerating: false,
        progressMessage: '',
        step: 1,
      });
    } catch (err: any) {
      update({ isGenerating: false, progressMessage: '', error: err.message });
    }
  };

  // ── Step 2: Generate keyframe images ───────────────────────────────────────

  const generateKeyframe = async (stage: TransformationStage) => {
    if (stage.id === 1) return; // Stage 1 is the source image
    updateStage(stage.id, { isGenerating: true, imageUrl: undefined });
    update({ error: undefined });

    try {
      const editingKey = getImageEditingKey();
      const modelId = getImageEditingModel();
      if (!editingKey) throw new Error(`No API key found. Go to Project Settings → Image Generation, select a Nano Banana model (e.g. gemini-3-pro-image-preview) and enter your Google AI key.`);

      // Chain: use the previous stage's image as input
      const prevStage = state.stages.find(s => s.id === stage.id - 1);
      const inputImage = prevStage?.imageUrl || state.beforeImage;
      if (!inputImage) throw new Error(`Previous stage (${stage.id - 1}) has no image yet. Generate it first.`);

      let resultImageUrl: string;

      if (isGeminiModel(modelId)) {
        // ── Nano Banana (Gemini) — client-side via Google AI API ──
        console.log(`[TemplateWizard] Using Gemini model ${modelId} for stage ${stage.id}`);
        const dataUri = await GeminiService.editImage({
          apiKey: editingKey,
          imageDataUri: inputImage,
          prompt: stage.prompt,
          model: modelId,
        });
        resultImageUrl = dataUri;
      } else {
        // ── Flux Kontext (fal.ai) — server-side ──
        console.log(`[TemplateWizard] Using fal.ai model ${modelId} for stage ${stage.id}`);
        const res = await fetch('/api/flux-kontext/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: editingKey,
            imageUrl: inputImage,
            prompt: stage.prompt,
            modelId,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `Failed (${res.status})`);
        }

        const result = await res.json();
        resultImageUrl = result.url;
      }

      updateStage(stage.id, { imageUrl: resultImageUrl, isGenerating: false });
    } catch (err: any) {
      updateStage(stage.id, { isGenerating: false });
      update({ error: `Stage ${stage.id}: ${err.message}` });
    }
  };

  const generateAllKeyframes = async () => {
    update({ isGenerating: true, progressMessage: 'Generating keyframe images...', error: undefined });

    for (const stage of state.stages) {
      if (stage.id === 1) continue; // Skip source
      if (stage.imageUrl) continue; // Skip already generated
      update({ progressMessage: `Generating Stage ${stage.id}: ${stage.label}...` });
      await generateKeyframe(stage);

      // Check for errors after each stage
      const updated = state.stages.find(s => s.id === stage.id);
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }

    update({ isGenerating: false, progressMessage: '' });
  };

  // ── Step 3: Generate video segments ────────────────────────────────────────

  const generateSegment = async (segment: VideoSegment) => {
    updateSegment(segment.id, { isGenerating: true, videoUrl: undefined });
    update({ isGenerating: true, progressMessage: `Segment ${segment.id}: Submitting to video API...`, error: undefined });

    try {
      const videoModel = getVideoModel();
      const videoApiKey = getVideoKey();
      if (!videoApiKey) throw new Error('No video API key found. Set it in Project Settings → Video Generation.');

      const startStage = state.stages.find(s => s.id === segment.startStageId);
      const endStage = state.stages.find(s => s.id === segment.endStageId);
      if (!startStage?.imageUrl) throw new Error(`Start keyframe (Stage ${segment.startStageId}) not generated yet.`);
      if (!endStage?.imageUrl) throw new Error(`End keyframe (Stage ${segment.endStageId}) not generated yet.`);

      let resultVideoUrl: string;

      // Duration: Kling/Seedance = 10s, Veo = 8s
      const isVeo = isVeoModel(videoModel);
      const segmentDuration = isVeo ? 8 : 10;

      if (isVeo) {
        // ── Veo (Google) — client-side via Gemini API ──
        console.log(`[TemplateWizard] Using Veo model for segment ${segment.id}`);
        update({ progressMessage: `Segment ${segment.id}: Generating with Veo (this may take 1-2 min)...` });
        resultVideoUrl = await GeminiService.generateVideo({
          prompt: segment.prompt,
          startImage: startStage.imageUrl,
          endImage: endStage.imageUrl,
          duration: `${segmentDuration}s`,
          apiKey: videoApiKey,
          onProgress: (msg) => update({ progressMessage: `Segment ${segment.id}: ${msg}` }),
        });
      } else {
        // ── Kling / Seedance (fal.ai) — server-side via SSE ──
        console.log(`[TemplateWizard] Using fal.ai (${videoModel}) for segment ${segment.id}`);
        resultVideoUrl = await new Promise<string>((resolve, reject) => {
          const body = JSON.stringify({
            apiKey: videoApiKey,
            model: videoModel,
            startImageUrl: startStage.imageUrl,
            endImageUrl: endStage.imageUrl,
            prompt: segment.prompt,
            duration: segmentDuration,
            aspectRatio: '16:9',
            generateAudio: false,
          });

          fetch('/api/generate-video-kling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          }).then(async (res) => {
            if (!res.ok || !res.body) {
              const err = await res.text().catch(() => `HTTP ${res.status}`);
              return reject(new Error(err));
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              // Parse SSE events from buffer
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // keep incomplete last line

              let currentEvent = '';
              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (currentEvent === 'progress') {
                      update({ progressMessage: `Segment ${segment.id}: ${data.message}` });
                    } else if (currentEvent === 'done') {
                      resolve(data.videoUrl);
                      return;
                    } else if (currentEvent === 'error') {
                      reject(new Error(data.error));
                      return;
                    }
                  } catch { /* skip malformed JSON */ }
                }
              }
            }
            reject(new Error('Stream ended without result'));
          }).catch(reject);
        });
      }

      updateSegment(segment.id, { videoUrl: resultVideoUrl, isGenerating: false });
      update({ isGenerating: false, progressMessage: '' });
    } catch (err: any) {
      updateSegment(segment.id, { isGenerating: false });
      update({ isGenerating: false, progressMessage: '', error: `Segment ${segment.id}: ${err.message}` });
    }
  };

  const generateAllSegments = async () => {
    update({ isGenerating: true, progressMessage: 'Generating video segments...', error: undefined });

    for (const seg of state.segments) {
      if (seg.videoUrl) continue;
      update({ progressMessage: `Generating Segment ${seg.id}: Stage ${seg.startStageId} → ${seg.endStageId}...` });
      await generateSegment(seg);
      await new Promise(r => setTimeout(r, 2000));
    }

    update({ isGenerating: false, progressMessage: '' });
  };

  // ── Stitch all segments into one video via fal.ai merge ──────────────────
  const stitchAllSegments = async () => {
    const videoUrls = state.segments
      .sort((a, b) => a.id - b.id)
      .map(s => s.videoUrl)
      .filter(Boolean) as string[];

    if (videoUrls.length < 2) {
      update({ error: 'Need at least 2 completed segments to stitch.' });
      return;
    }

    update({ isGenerating: true, progressMessage: 'Stitching segments into final video...', error: undefined });

    try {
      const apiKey = getVideoKey();
      // For Veo models, use the fal.ai key from video settings or env
      const falKey = isVeoModel(getVideoModel())
        ? (localStorage.getItem('tensorax_video_key__kling-v3-standard')?.trim()
          || localStorage.getItem('tensorax_video_key')?.trim()
          || apiKey)
        : apiKey;

      if (!falKey) throw new Error('No fal.ai API key found. Set it in Project Settings → Video Generation.');

      const res = await fetch('/api/merge-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: falKey,
          videoUrls,
          resolution: 'landscape_16_9',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Failed (${res.status})`);
      }

      const result = await res.json();
      update({ finalVideoUrl: result.videoUrl, isGenerating: false, progressMessage: '' });
    } catch (err: any) {
      update({ isGenerating: false, progressMessage: '', error: `Stitch failed: ${err.message}` });
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const stepLabels = template.steps;
  const canProceedStep0 = state.beforeImage && state.referenceVideo;
  const allKeyframesReady = state.stages.every(s => s.imageUrl);
  const allSegmentsReady = state.segments.every(s => s.videoUrl);
  const anyKeyframeGenerating = state.stages.some(s => s.isGenerating);
  const anySegmentGenerating = state.segments.some(s => s.isGenerating);

  // Check all API keys upfront
  const hasGeminiKey = !!getGeminiKey();
  const hasImageKey = !!getImageEditingKey();
  const hasVideoKey = !!getVideoKey();
  const missingKeys: string[] = [];
  if (!hasGeminiKey) missingKeys.push('Analysis (Gemini)');
  if (!hasImageKey) missingKeys.push('Image Generation');
  if (!hasVideoKey) missingKeys.push('Video Generation (fal.ai)');

  return (
    <div className="flex-1 flex flex-col bg-[#edecec] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-[#e0d6e3] px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-[#91569c]/80 hover:text-[#91569c] transition-colors p-1">
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <div>
            <h1 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
              <i className={`fa-solid ${template.icon} text-[#91569c]`}></i>
              {template.name}
            </h1>
          </div>
          <div className="ml-auto">
            <button onClick={() => {
              // Real AI-generated keyframes from the Panel Block (Панелен Блок) project
              const base = '/project-assets/_/frames';
              const testStages: TransformationStage[] = [
                { id: 1, label: 'Original State', prompt: 'A weathered Soviet-era panel block building facade — cracked concrete panels, rusted balcony railings, peeling paint, overgrown vegetation. Street-level view, natural daylight.', imageUrl: `${base}/${encodeURIComponent('Панелен_Блок_Scene1_Frame1.png')}` },
                { id: 2, label: 'Early Renovation', prompt: 'The same panel block after initial work — scaffolding erected, old facade panels removed, exposed concrete structure visible, construction materials staged nearby.', imageUrl: `${base}/${encodeURIComponent('Панелен_Блок_Scene2_Frame1.png')}` },
                { id: 3, label: 'Mid Renovation', prompt: 'The panel block mid-renovation — new insulation panels applied, fresh render on lower floors, modern window frames being installed, workers on scaffolding.', imageUrl: `${base}/${encodeURIComponent('Панелен_Блок_Scene3_Frame1.png')}` },
                { id: 4, label: 'Completed', prompt: 'The fully renovated panel block — modern colourful facade, new balcony railings, energy-efficient windows, landscaped entrance, vibrant and welcoming. Same angle, golden hour.', imageUrl: `${base}/${encodeURIComponent('Панелен_Блок_Scene5_Frame1.png')}` },
              ];
              const testSegments: VideoSegment[] = [
                { id: 1, startStageId: 1, endStageId: 2, prompt: 'Time-lapse transition: scaffolding rises around the old panel block, workers remove deteriorated facade panels piece by piece, dust clouds drift in the breeze, a crane lifts away old railings.' },
                { id: 2, startStageId: 2, endStageId: 3, prompt: 'Construction montage: insulation boards are fixed to the bare structure, fresh plaster is applied, new aluminium window frames are lifted into position, glass panes fitted. Workers move with purpose.' },
                { id: 3, startStageId: 3, endStageId: 4, prompt: 'Final transformation: scaffolding dismantled and lowered, colourful facade panels revealed, new balcony railings gleam, landscaping planted around the entrance, residents gather for a ribbon-cutting at golden hour.' },
              ];
              update({
                step: 3,
                stages: testStages,
                segments: testSegments,
                videoAnalysis: 'Test data loaded — 4-stage panel block renovation using real AI-generated keyframes.',
                beforeImage: `${base}/${encodeURIComponent('Панелен_Блок_Scene1_Frame1.png')}`,
              });
            }}
              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase border border-[#ceadd4] text-[#888] hover:text-[#91569c] hover:border-[#91569c] transition-colors flex items-center gap-1">
              <i className="fa-solid fa-bolt text-[8px]"></i> Test Data
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-3">
          {stepLabels.map((label, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className={`flex-1 h-px ${i <= state.step ? 'bg-[#91569c]' : 'bg-[#ceadd4]'}`} />}
              <button
                onClick={() => { if (i <= state.step || (state.stages.length > 0 && i <= 3)) update({ step: i }); }}
                className={`flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${i > state.step && state.stages.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  i < state.step ? 'bg-[#91569c] text-white' :
                  i === state.step ? 'bg-[#91569c] text-white ring-2 ring-[#91569c]/30' :
                  'bg-[#e0d6e3] text-[#888]'
                }`}>
                  {i < state.step ? <i className="fa-solid fa-check text-[7px]"></i> : i + 1}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                  i <= state.step ? 'text-[#5c3a62]' : 'text-[#888]'
                }`}>{label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* API Key status */}
        {missingKeys.length > 0 && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[10px]"></i>
            <span className="text-[10px] text-amber-700">
              <strong>Missing API keys:</strong> {missingKeys.join(', ')}
            </span>
            <span className="text-[10px] text-amber-600">— Set them in Project Settings</span>
          </div>
        )}
        {missingKeys.length === 0 && (
          <div className="mt-2 flex items-center gap-3 text-[9px] text-[#888]">
            <span><i className="fa-solid fa-circle-check text-green-500 mr-0.5"></i> Analysis</span>
            <span><i className="fa-solid fa-circle-check text-green-500 mr-0.5"></i> Image Gen</span>
            <span><i className="fa-solid fa-circle-check text-green-500 mr-0.5"></i> Video Gen</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">

          {/* ═══ STEP 0: Upload Media ═══ */}
          {state.step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                {/* Image upload */}
                <div className="bg-white border border-[#e0d6e3] rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide mb-3">
                    <i className="fa-solid fa-image text-[#91569c] mr-1.5"></i>Source Image
                  </h3>
                  <DropZone accept="image/*" onFiles={async (files) => { update({ beforeImage: await fileToDataUri(files[0]) }); }}>
                    {!state.beforeImage ? (
                      <div
                        onClick={() => imageInputRef.current?.click()}
                        className="border-2 border-dashed border-[#ceadd4] hover:border-[#91569c] rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-[#f6f0f8]/50 aspect-video flex flex-col items-center justify-center"
                      >
                        <i className="fa-solid fa-cloud-arrow-up text-2xl text-[#ceadd4] mb-1.5"></i>
                        <p className="text-[10px] font-bold text-[#5c3a62]">Drop image or click to upload</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <img src={state.beforeImage} alt="Source" className="w-full rounded-lg border border-[#e0d6e3] object-contain max-h-[250px]" />
                        <button onClick={() => { update({ beforeImage: undefined }); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500/90 hover:bg-red-600 rounded flex items-center justify-center text-white text-[10px]">
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    )}
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  </DropZone>
                </div>

                {/* Video upload — sample embedded by default */}
                <div className="bg-white border border-[#e0d6e3] rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide mb-3">
                    <i className="fa-solid fa-film text-[#91569c] mr-1.5"></i>Reference Video
                  </h3>
                  <div className="relative">
                    <video src={state.referenceVideo} controls muted className="w-full rounded-lg border border-[#e0d6e3] max-h-[250px]" />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[9px] text-[#888] truncate">
                        <i className="fa-solid fa-file-video mr-1"></i>
                        {state.referenceVideoName}
                        {state.referenceVideoName === SAMPLE_VIDEO_NAME && (
                          <span className="ml-1 text-[#91569c] font-bold">(default)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        {state.referenceVideoName !== SAMPLE_VIDEO_NAME && (
                          <button
                            onClick={() => { update({ referenceVideo: SAMPLE_VIDEO_URL, referenceVideoName: SAMPLE_VIDEO_NAME }); if (videoInputRef.current) videoInputRef.current.value = ''; }}
                            className="text-[9px] font-bold text-[#91569c] hover:text-[#7a4685] uppercase tracking-wide"
                          >
                            <i className="fa-solid fa-rotate-left mr-0.5"></i>Reset to sample
                          </button>
                        )}
                        <button
                          onClick={() => videoInputRef.current?.click()}
                          className="text-[9px] font-bold text-[#91569c] hover:text-[#7a4685] uppercase tracking-wide"
                        >
                          <i className="fa-solid fa-upload mr-0.5"></i>Upload different
                        </button>
                      </div>
                    </div>
                  </div>
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
                </div>
              </div>

              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                  <i className="fa-solid fa-circle-exclamation mr-1.5"></i>{state.error}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button onClick={onCancel} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62]">
                  <i className="fa-solid fa-arrow-left mr-1"></i> Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={analyseVideo} disabled={!canProceedStep0 || state.isGenerating}
                    className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-lg">
                    {state.isGenerating ? <><i className="fa-solid fa-spinner fa-spin"></i>{state.progressMessage}</> : <><i className="fa-solid fa-magnifying-glass-chart"></i>Analyse Video</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 1: Define Stages ═══ */}
          {state.step === 1 && (
            <div className="space-y-4 animate-fade-in">
              {/* Analysis summary (collapsible) */}
              <details className="bg-white border border-[#e0d6e3] rounded-xl shadow-sm">
                <summary className="px-4 py-3 cursor-pointer text-xs font-bold text-[#5c3a62] uppercase tracking-wide">
                  <i className="fa-solid fa-brain text-[#91569c] mr-1.5"></i>Video Analysis (click to expand)
                </summary>
                <div className="px-4 pb-4">
                  <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg p-3 max-h-[200px] overflow-y-auto">
                    <pre className="text-[10px] text-[#3a3a3a] whitespace-pre-wrap font-sans leading-relaxed">{state.videoAnalysis}</pre>
                  </div>
                </div>
              </details>

              {/* Stages editor */}
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide">
                    <i className="fa-solid fa-list-ol text-[#91569c] mr-1.5"></i>Transformation Stages
                  </h3>
                  <button onClick={() => {
                    const newId = state.stages.length > 0 ? Math.max(...state.stages.map(s => s.id)) + 1 : 1;
                    update({ stages: [...state.stages, { id: newId, label: 'New Stage', prompt: 'Same building, same angle. ' }] });
                  }}
                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase bg-[#f6f0f8] text-[#91569c] border border-[#ceadd4] hover:bg-[#eadcef]">
                    <i className="fa-solid fa-plus mr-1"></i>Add Stage
                  </button>
                </div>

                <div className="space-y-2">
                  {state.stages.map((stage, i) => (
                    <div key={stage.id} className={`border rounded-lg p-3 ${i === 0 ? 'border-[#91569c]/30 bg-[#f6f0f8]/50' : 'border-[#e0d6e3]'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#91569c] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{stage.id}</span>
                        <input
                          value={stage.label}
                          onChange={(e) => updateStage(stage.id, { label: e.target.value })}
                          className="flex-1 text-xs font-bold text-[#5c3a62] bg-transparent outline-none"
                          placeholder="Stage label..."
                        />
                        {i === 0 && <span className="text-[8px] font-bold text-[#91569c] uppercase tracking-wider bg-[#f6f0f8] border border-[#ceadd4] px-1.5 py-0.5 rounded">Source</span>}
                        {i > 0 && (
                          <button onClick={() => {
                            const filteredStages = state.stages.filter(s => s.id !== stage.id);
                            // Renumber stages sequentially (1, 2, 3...)
                            const renumberedStages = filteredStages.map((s, idx) => ({ ...s, id: idx + 1 }));
                            // Rebuild segments with new sequential IDs
                            const newSegments: VideoSegment[] = [];
                            for (let si = 0; si < renumberedStages.length - 1; si++) {
                              newSegments.push({
                                id: si + 1,
                                startStageId: renumberedStages[si].id,
                                endStageId: renumberedStages[si + 1].id,
                                prompt: `Static camera. Smooth transition: ${renumberedStages[si].label} transforms into ${renumberedStages[si + 1].label}. Gradual, cinematic change.`,
                              });
                            }
                            update({ stages: renumberedStages, segments: newSegments });
                          }}
                            className="text-[#888] hover:text-red-500 text-[10px]">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </div>
                      {i > 0 && (
                        <textarea
                          value={stage.prompt}
                          onChange={(e) => updateStage(stage.id, { prompt: e.target.value })}
                          rows={2}
                          className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded px-2.5 py-1.5 text-[10px] text-[#3a3a3a] outline-none focus:ring-1 focus:ring-[#91569c]/30 resize-none"
                          placeholder="Flux Kontext edit prompt for this stage..."
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                  <i className="fa-solid fa-circle-exclamation mr-1.5"></i>{state.error}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button onClick={() => update({ step: 0 })} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62]">
                  <i className="fa-solid fa-arrow-left mr-1"></i> Back
                </button>
                <button onClick={() => update({ step: 2 })} disabled={state.stages.length < 3}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-lg">
                  <i className="fa-solid fa-images"></i>Generate Keyframes
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Generate Keyframes ═══ */}
          {state.step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide">
                    <i className="fa-solid fa-images text-[#91569c] mr-1.5"></i>Keyframe Images
                  </h3>
                  <button onClick={generateAllKeyframes} disabled={state.isGenerating || anyKeyframeGenerating}
                    className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 flex items-center gap-1">
                    {state.isGenerating ? <><i className="fa-solid fa-spinner fa-spin"></i>Generating...</> : <><i className="fa-solid fa-bolt"></i>Generate All</>}
                  </button>
                </div>

                {state.isGenerating && state.progressMessage && (
                  <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 mb-3 text-[10px] text-[#5c3a62] flex items-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin text-[#91569c]"></i>{state.progressMessage}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {state.stages.map((stage) => (
                    <div key={stage.id} className="border border-[#e0d6e3] rounded-lg overflow-hidden">
                      <div className="aspect-video bg-[#f6f0f8] flex items-center justify-center relative">
                        {stage.imageUrl ? (
                          <img src={stage.imageUrl} alt={stage.label} className="w-full h-full object-cover" />
                        ) : stage.isGenerating ? (
                          <i className="fa-solid fa-spinner fa-spin text-[#91569c] text-xl"></i>
                        ) : (
                          <i className="fa-solid fa-image text-[#ceadd4] text-xl"></i>
                        )}
                        {stage.imageUrl && (
                          <div className="absolute top-1 right-1 flex gap-0.5">
                            <a
                              href={stage.imageUrl}
                              download={`stage-${stage.id}-${stage.label.replace(/\s+/g, '_').toLowerCase()}.png`}
                              className="w-5 h-5 bg-white/80 hover:bg-white rounded flex items-center justify-center text-[#91569c] text-[9px] shadow"
                              title="Download image"
                            >
                              <i className="fa-solid fa-download"></i>
                            </a>
                            {stage.id > 1 && (
                              <button onClick={() => generateKeyframe(stage)} disabled={stage.isGenerating}
                                className="w-5 h-5 bg-white/80 hover:bg-white rounded flex items-center justify-center text-[#91569c] text-[9px] shadow"
                                title="Regenerate"
                              >
                                <i className="fa-solid fa-rotate-right"></i>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[9px] font-bold text-[#5c3a62] truncate">
                          <span className="text-[#91569c]">{stage.id}.</span> {stage.label}
                        </p>
                        {stage.id > 1 && !stage.imageUrl && !stage.isGenerating && (
                          <button onClick={() => generateKeyframe(stage)}
                            className="mt-1 text-[8px] font-bold text-[#91569c] uppercase hover:underline">
                            Generate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                  <i className="fa-solid fa-circle-exclamation mr-1.5"></i>{state.error}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button onClick={() => update({ step: 1 })} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62]">
                  <i className="fa-solid fa-arrow-left mr-1"></i> Back to Stages
                </button>
                {allKeyframesReady && (
                  <button
                    onClick={() => {
                      state.stages.forEach((s) => {
                        if (!s.imageUrl) return;
                        const a = document.createElement('a');
                        a.href = s.imageUrl;
                        a.download = `stage-${s.id}-${s.label.replace(/\s+/g, '_').toLowerCase()}.png`;
                        a.click();
                      });
                    }}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#91569c] hover:text-[#5c3a62] flex items-center gap-1"
                  >
                    <i className="fa-solid fa-download text-[8px]"></i> Download All
                  </button>
                )}
                <button onClick={() => update({ step: 3 })} disabled={!allKeyframesReady}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-lg">
                  <i className="fa-solid fa-video"></i>Generate Video Segments
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: Generate Video Segments ═══ */}
          {state.step === 3 && (
            <div className="space-y-4 animate-fade-in">
              {/* Segment editor & generator */}
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide">
                    <i className="fa-solid fa-film text-[#91569c] mr-1.5"></i>Video Segments
                  </h3>
                  <button onClick={generateAllSegments} disabled={state.isGenerating || anySegmentGenerating}
                    className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 flex items-center gap-1">
                    {state.isGenerating ? <><i className="fa-solid fa-spinner fa-spin"></i>Generating...</> : <><i className="fa-solid fa-bolt"></i>Generate All Segments</>}
                  </button>
                </div>

                {state.isGenerating && state.progressMessage && (
                  <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 mb-3 text-[10px] text-[#5c3a62] flex items-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin text-[#91569c]"></i>{state.progressMessage}
                  </div>
                )}

                <div className="space-y-3">
                  {state.segments.map((seg) => {
                    const startStage = state.stages.find(s => s.id === seg.startStageId);
                    const endStage = state.stages.find(s => s.id === seg.endStageId);
                    return (
                      <div key={seg.id} className="border border-[#e0d6e3] rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-bold text-[#91569c] uppercase">Segment {seg.id}</span>
                          <span className="text-[9px] text-[#888]">Stage {seg.startStageId} → Stage {seg.endStageId}</span>
                          {seg.isGenerating && <i className="fa-solid fa-spinner fa-spin text-[#91569c] text-[10px]"></i>}
                          {seg.videoUrl && <i className="fa-solid fa-check-circle text-green-500 text-[10px]"></i>}
                        </div>

                        <div className="grid grid-cols-[80px_1fr_80px] gap-2 items-center mb-2">
                          <img src={startStage?.imageUrl} alt="" className="w-full rounded border border-[#e0d6e3]" />
                          <div className="text-center">
                            <i className="fa-solid fa-arrow-right text-[#ceadd4]"></i>
                          </div>
                          <img src={endStage?.imageUrl} alt="" className="w-full rounded border border-[#e0d6e3]" />
                        </div>

                        <textarea
                          value={seg.prompt}
                          onChange={(e) => updateSegment(seg.id, { prompt: e.target.value })}
                          rows={1}
                          className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded px-2.5 py-1.5 text-[10px] text-[#3a3a3a] outline-none focus:ring-1 focus:ring-[#91569c]/30 resize-none"
                        />

                        {seg.videoUrl && (
                          <div className="mt-2">
                            <video src={seg.videoUrl} controls muted className="w-full rounded border border-[#e0d6e3]" style={{ maxHeight: 150 }} />
                            <div className="flex items-center gap-2 mt-1.5">
                              <button onClick={() => generateSegment(seg)} disabled={seg.isGenerating}
                                className="text-[9px] font-bold text-[#91569c] uppercase hover:underline flex items-center gap-1">
                                <i className="fa-solid fa-rotate-right text-[8px]"></i>Regenerate
                              </button>
                              <a href={seg.videoUrl} download={`segment-${seg.id}.mp4`}
                                className="text-[9px] font-bold text-[#91569c] uppercase hover:underline flex items-center gap-1">
                                <i className="fa-solid fa-download text-[8px]"></i>Download
                              </a>
                            </div>
                          </div>
                        )}

                        {seg.isGenerating && state.progressMessage && (
                          <div className="mt-2 bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 text-[10px] text-[#5c3a62] flex items-center gap-2 animate-pulse">
                            <i className="fa-solid fa-spinner fa-spin text-[#91569c]"></i>
                            <span>{state.progressMessage}</span>
                          </div>
                        )}

                        {!seg.videoUrl && !seg.isGenerating && (
                          <button onClick={() => generateSegment(seg)}
                            className="mt-1.5 text-[9px] font-bold text-[#91569c] uppercase hover:underline">
                            <i className="fa-solid fa-play mr-1"></i>Generate This Segment
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                  <i className="fa-solid fa-circle-exclamation mr-1.5"></i>{state.error}
                </div>
              )}

              {/* Stitch & Final Video */}
              {allSegmentsReady && state.segments.length >= 2 && (
                <div className="bg-white border border-[#e0d6e3] rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-[#5c3a62] uppercase tracking-wide">
                      <i className="fa-solid fa-wand-magic-sparkles text-[#91569c] mr-1.5"></i>Final Video
                    </h3>
                    <button onClick={stitchAllSegments} disabled={state.isGenerating}
                      className="px-4 py-2 rounded-lg text-[10px] font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 flex items-center gap-1.5 transition-colors">
                      {state.isGenerating ? <><i className="fa-solid fa-spinner fa-spin"></i>Stitching...</> : <><i className="fa-solid fa-scissors"></i>Stitch All Segments</>}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#888] mb-3">Combines all {state.segments.length} segments into one continuous video using fal.ai.</p>
                  {state.finalVideoUrl && (
                    <div>
                      <video src={state.finalVideoUrl} controls className="w-full rounded-lg border border-[#e0d6e3]" style={{ maxHeight: 400 }} />
                      <div className="flex items-center gap-3 mt-2">
                        <a href={state.finalVideoUrl} download="final-transformation.mp4"
                          className="text-[10px] font-bold text-[#91569c] uppercase hover:underline flex items-center gap-1">
                          <i className="fa-solid fa-download text-[9px]"></i>Download Final Video
                        </a>
                        <button onClick={stitchAllSegments} disabled={state.isGenerating}
                          className="text-[10px] font-bold text-[#888] uppercase hover:text-[#5c3a62] flex items-center gap-1">
                          <i className="fa-solid fa-rotate-right text-[9px]"></i>Re-stitch
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button onClick={() => update({ step: 2 })} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62]">
                  <i className="fa-solid fa-arrow-left mr-1"></i> Back to Keyframes
                </button>
                <button onClick={() => onComplete(state)} disabled={!allSegmentsReady}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-lg">
                  <i className="fa-solid fa-check"></i>Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
