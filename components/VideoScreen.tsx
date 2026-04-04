
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { VideoState, VideoMode, AspectRatio } from '../types';
import { GeminiService } from '../services/geminiService';
import { DB } from '../services/projectDB';
import DropZone from './DropZone';

/** A single video clip prompt within a scene. */
export interface VideoClip {
  label: string;       // e.g. "Video Prompt 1" or "Frame 1"
  prompt: string;
}

/** A frame prompt for image generation. */
export interface FrameClip {
  label: string;       // e.g. "Frame 1"
  prompt: string;
}

/** Parse screenplay markdown into scene entries with FRAME and VIDEO PROMPT blocks. */
export interface ScreenplayScene {
  index: number;
  title: string;
  framePrompts: FrameClip[];   // image generation prompts (FRAME N)
  videoPrompts: VideoClip[];   // video generation prompts (VIDEO PROMPT N)
  sceneDescription: string;
  dialogue: string;
  duration: string;            // e.g. "12s" or "0-12s"
}

export function parseScreenplayScenes(screenplay: string): ScreenplayScene[] {
  if (!screenplay) return [];
  const blocks = screenplay.split(/(?=###\s*Scene\s*\d)/i).filter(b => /^###\s*Scene\s*\d/i.test(b.trim()));
  return blocks.map((block, i) => {
    const titleMatch = block.match(/^###\s*Scene\s*\d+[:\s]*(.*)/im);
    const sceneMatch = block.match(/\*\*SCENE:\*\*\s*([\s\S]*?)(?=\n\*\*)/i);
    const dialogueMatch = block.match(/\*\*DIALOGUE:\*\*\s*([\s\S]*?)(?=\n\*\*(?!DIALOGUE))/i);

    // Parse duration from scene description
    const sceneDesc = sceneMatch?.[1] || '';
    let duration = '';
    const rangeMatch = sceneDesc.match(/\((\d+)\s*[–-]\s*(\d+)\s*s?\s*\)/i);
    const explicitMatch = sceneDesc.match(/~\s*(\d+)\s*s/i);
    let sceneDurationSecs = 0;
    if (rangeMatch) {
      sceneDurationSecs = parseInt(rangeMatch[2], 10) - parseInt(rangeMatch[1], 10);
      duration = `${rangeMatch[1]}–${rangeMatch[2]}s`;
    } else if (explicitMatch) {
      sceneDurationSecs = parseInt(explicitMatch[1], 10);
      duration = `~${explicitMatch[1]}s`;
    }

    // ── Extract FRAME prompts (always separate from video prompts) ──
    const frameMatches = [...block.matchAll(/\*\*FRAME\s*(\d+)[:\s]*\*\*\s*([\s\S]*?)(?=\*\*FRAME\s*\d+[:\s]*\*\*|\*\*VIDEO\s*PROMPT[:\s]*\*\*|###|$)/gi)];
    let framePrompts: FrameClip[] = frameMatches
      .map(m => ({ label: `Frame ${m[1]}`, prompt: m[2]?.trim() }))
      .filter(f => f.prompt);

    // ── Extract VIDEO PROMPT blocks ──
    // 1. Try multiple **VIDEO PROMPT N:** blocks (preferred)
    const vpMatches = [...block.matchAll(/\*\*VIDEO\s*PROMPT\s*(\d+)[:\s]*\*\*\s*([\s\S]*?)(?=\*\*VIDEO\s*PROMPT\s*\d+[:\s]*\*\*|\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/gi)];
    let videoPrompts: VideoClip[] = vpMatches
      .map(m => ({ label: `Video Prompt ${m[1]}`, prompt: m[2]?.trim() }))
      .filter(v => v.prompt);

    // 2. Fallback: single **VIDEO PROMPT:** (no number)
    if (videoPrompts.length === 0) {
      const singleVP = block.match(/\*\*VIDEO\s*PROMPT[:\s]*\*\*\s*([\s\S]*?)(?=\*\*FRAME\s*\d+[:\s]*\*\*|###|$)/i);
      if (singleVP?.[1]?.trim()) {
        videoPrompts = [{ label: 'Video Prompt', prompt: singleVP[1].trim() }];
      }
    }

    // 3. If no VIDEO PROMPT at all but have frames, use frames as video fallback too
    if (videoPrompts.length === 0 && framePrompts.length > 0) {
      videoPrompts = framePrompts.map(f => ({ label: f.label, prompt: f.prompt }));
    }

    // 4. If we have video prompts but NO frame prompts, auto-generate frame prompts from the video prompts
    if (framePrompts.length === 0 && videoPrompts.length > 0) {
      framePrompts = videoPrompts.map((vp, idx) => ({
        label: `Frame ${idx + 1}`,
        prompt: vp.prompt,
      }));
    }

    // 5. Auto-split: if only 1 video prompt but scene duration > 8s, split into multiple 5-8s clips
    if (videoPrompts.length === 1) {
      if (sceneDurationSecs === 0 && videoPrompts[0].prompt.length > 200) {
        sceneDurationSecs = 10;
      }
      if (sceneDurationSecs > 8) {
        const numClips = Math.ceil(sceneDurationSecs / 7);
        const clipDuration = Math.round(sceneDurationSecs / numClips);
        const originalPrompt = videoPrompts[0].prompt;
        const sentences = originalPrompt.split(/(?<=\.)\s+/).filter(s => s.trim());
        const splitPrompts: VideoClip[] = [];
        if (sentences.length >= numClips) {
          const perClip = Math.ceil(sentences.length / numClips);
          for (let c = 0; c < numClips; c++) {
            const clipSentences = sentences.slice(c * perClip, (c + 1) * perClip);
            if (clipSentences.length > 0) {
              splitPrompts.push({
                label: `Video Prompt ${c + 1} (~${clipDuration}s)`,
                prompt: clipSentences.join(' ').trim(),
              });
            }
          }
        } else {
          for (let c = 0; c < numClips; c++) {
            const startT = c * clipDuration;
            const endT = Math.min(startT + clipDuration, sceneDurationSecs);
            splitPrompts.push({
              label: `Video Prompt ${c + 1} (~${endT - startT}s)`,
              prompt: `[${startT}s–${endT}s] ${originalPrompt}`,
            });
          }
        }
        if (splitPrompts.length > 1) {
          videoPrompts = splitPrompts;
        }
      }
    }

    return {
      index: i,
      title: titleMatch?.[1]?.trim() || `Scene ${i + 1}`,
      framePrompts,
      videoPrompts,
      sceneDescription: sceneDesc.trim(),
      dialogue: dialogueMatch?.[1]?.trim() || '',
      duration,
    };
  }).filter(s => s.videoPrompts.length > 0 || s.framePrompts.length > 0);
}

// ─── Logo components (duplicated from App to keep self-contained) ────────────
const LOGO_SOURCES = ['/logo-secondary.png', '/logo-main.png', '/logo.png'];
const LogoSvg = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 110" className={className}>
    <path d="M50 5 L95 35 L85 40 L50 17 L15 40 L5 35 Z" fill="#5a5a5a" />
    <path d="M50 15 L90 42 L80 47 L50 27 L20 47 L10 42 Z" fill="#666" />
    <path d="M22 50 L38 50 L38 95 L22 95 Z" fill="#666" />
    <path d="M42 42 L58 42 L58 90 L50 100 L42 90 Z" fill="#666" />
    <path d="M62 50 L78 50 L78 95 L62 95 Z" fill="#666" />
  </svg>
);
const LogoIcon = ({ className = "w-6 h-6" }: { className?: string }) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) return <LogoSvg className={className} />;
  const tryNext = () => {
    if (srcIndex + 1 < LOGO_SOURCES.length) setSrcIndex(i => i + 1);
    else setImgFailed(true);
  };
  return <img src={LOGO_SOURCES[srcIndex]} alt="Tensorax" className={className} onError={tryNext} />;
};

// ─── Mode descriptor ─────────────────────────────────────────────────────────
const MODE_INFO: Record<VideoMode, { label: string; icon: string; description: string }> = {
  'prompt-only':         { label: 'Prompt Only',           icon: 'fa-pen-fancy',     description: 'Generate video from a text prompt alone' },
  'prompt-images':       { label: 'Prompt + Images',       icon: 'fa-images',        description: 'Text prompt with keyframe images (Start / Mid / End)' },
  'prompt-images-video': { label: 'Prompt + Images + Video', icon: 'fa-film',        description: 'Text prompt, keyframes, and a movement reference video' },
};

// ─── Props ───────────────────────────────────────────────────────────────────
export interface VideoScreenProps {
  videoState: VideoState;
  setVideoState: React.Dispatch<React.SetStateAction<VideoState>>;
  screenplay?: string;
  getVideoModel: () => string;
  getVideoProvider: () => 'seedance' | 'veo' | 'kling';
  getVideoApiKey: () => string;
  aspectRatio: AspectRatio;
  projectId?: string;
  onNavigateSettings: () => void;
}

export const VideoScreen: React.FC<VideoScreenProps> = ({
  videoState,
  setVideoState,
  screenplay,
  getVideoModel,
  getVideoProvider,
  getVideoApiKey,
  aspectRatio,
  projectId,
  onNavigateSettings,
}) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isReviewingVideo, setIsReviewingVideo] = useState(false);
  const [videoReview, setVideoReview] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const [savedVideoToAssets, setSavedVideoToAssets] = useState(false);
  const [savingVideoToAssets, setSavingVideoToAssets] = useState(false);
  const [savedRefKeys, setSavedRefKeys] = useState<Set<string>>(new Set());
  const [savedFrameKeys, setSavedFrameKeys] = useState<Set<string>>(new Set());

  const provider = getVideoProvider();
  const scenes = useMemo(() => parseScreenplayScenes(screenplay || ''), [screenplay]);

  // ── Mode helpers ──────────────────────────────────────────────────────────
  const mode = videoState.mode;
  const setMode = (m: VideoMode) => setVideoState(v => ({ ...v, mode: m }));
  const showImages = mode === 'prompt-images' || mode === 'prompt-images-video';
  const showRefVideo = mode === 'prompt-images-video';

  // ── Scene picker & reference images ──────────────────────────────────────
  const [selectedClipKey, setSelectedClipKey] = useState<string | undefined>();
  const [refImages, setRefImages] = useState<Record<string, string>>({}); // clipKey → data URL
  const [frameImages, setFrameImages] = useState<Record<string, string>>({}); // "sceneIdx-frameIdx" → data URL
  const [generatingRefKey, setGeneratingRefKey] = useState<string | undefined>();
  const [generatingFrameKey, setGeneratingFrameKey] = useState<string | undefined>();
  const [expandedScene, setExpandedScene] = useState<number | undefined>();
  const promptSectionRef = useRef<HTMLDivElement>(null);

  const handleSelectClip = (sceneIdx: number, clipIdx: number) => {
    const scene = scenes[sceneIdx];
    if (!scene || !scene.videoPrompts[clipIdx]) return;
    const key = `${sceneIdx}-${clipIdx}`;
    setSelectedClipKey(key);

    const thisRef = refImages[key];
    const prevKey = clipIdx > 0 ? `${sceneIdx}-${clipIdx - 1}` : undefined;
    const prevRef = prevKey ? refImages[prevKey] : undefined;

    // Chain logic:
    // - If previous clip has a ref → use it as START (continuity from prior clip)
    // - If this clip has a ref → use it as END (target frame for this clip)
    // - If only this clip has a ref and no previous → use as START
    const startImg = prevRef || (!prevRef ? thisRef : undefined);
    const endImg = prevRef && thisRef ? thisRef : undefined;
    const hasAnyRef = !!(startImg || endImg);

    setVideoState(v => ({
      ...v,
      prompt: scene.videoPrompts[clipIdx].prompt,
      selectedSceneIndex: sceneIdx,
      ...(hasAnyRef ? {
        startImage: startImg,
        endImage: endImg,
        mode: 'prompt-images' as VideoMode,
      } : {}),
    }));

    // Scroll the prompt section into view so the user sees the loaded prompt
    setTimeout(() => {
      promptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // Generate a reference image from a clip's video prompt
  const handleGenerateRefImage = useCallback(async (sceneIdx: number, clipIdx: number) => {
    const scene = scenes[sceneIdx];
    if (!scene || !scene.videoPrompts[clipIdx]) return;
    const key = `${sceneIdx}-${clipIdx}`;
    setGeneratingRefKey(key);
    try {
      const clipPrompt = scene.videoPrompts[clipIdx].prompt;
      // Prefix the prompt to generate a cinematic still frame
      const imagePrompt = `Cinematic still frame, photorealistic: ${clipPrompt}`;
      const imageUrl = await GeminiService.generateImage({
        prompt: imagePrompt,
        size: '1K',
        aspectRatio: aspectRatio === '9:16' ? '9:16' : aspectRatio === '1:1' ? '1:1' : '16:9',
        referenceImages: [],
      });
      setRefImages(prev => ({ ...prev, [key]: imageUrl }));

      // Save to project assets
      if (projectId) {
        const filename = `ref_scene${sceneIdx + 1}_clip${clipIdx + 1}.png`;
        DB.saveProjectFile(projectId, filename, imageUrl, 'videos/references').catch(e =>
          console.warn('Failed to save reference image to project:', e)
        );
      }

      // If this clip is currently selected, auto-populate start image
      if (selectedClipKey === key) {
        setVideoState(v => ({ ...v, startImage: imageUrl, mode: 'prompt-images' as VideoMode }));
      }
    } catch (e: any) {
      console.error('Reference image generation failed:', e);
      alert(`Reference image generation failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setGeneratingRefKey(undefined);
    }
  }, [scenes, aspectRatio, selectedClipKey, setVideoState]);

  // Generate a frame image from a frame prompt
  const handleGenerateFrameImage = useCallback(async (sceneIdx: number, frameIdx: number) => {
    const scene = scenes[sceneIdx];
    if (!scene || !scene.framePrompts[frameIdx]) return;
    const key = `${sceneIdx}-${frameIdx}`;
    setGeneratingFrameKey(key);
    try {
      const framePrompt = scene.framePrompts[frameIdx].prompt;
      const imageUrl = await GeminiService.generateImage({
        prompt: framePrompt,
        size: '1K',
        aspectRatio: aspectRatio === '9:16' ? '9:16' : aspectRatio === '1:1' ? '1:1' : '16:9',
        referenceImages: [],
      });
      setFrameImages(prev => ({ ...prev, [key]: imageUrl }));

      if (projectId) {
        const filename = `frame_scene${sceneIdx + 1}_frame${frameIdx + 1}.png`;
        DB.saveProjectFile(projectId, filename, imageUrl, 'images/frames').catch(e =>
          console.warn('Failed to save frame image to project:', e)
        );
      }
    } catch (e: any) {
      console.error('Frame image generation failed:', e);
      alert(`Frame image generation failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setGeneratingFrameKey(undefined);
    }
  }, [scenes, aspectRatio, projectId]);

  // ── File upload ───────────────────────────────────────────────────────────
  const processFileForSlot = (file: File, slot: 'start' | 'mid' | 'end' | 'movementVideo') => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result !== 'string') return;
      if (slot === 'movementVideo') setVideoState(v => ({ ...v, movementVideo: result }));
      else if (slot === 'start') setVideoState(v => ({ ...v, startImage: result }));
      else if (slot === 'mid') setVideoState(v => ({ ...v, midImage: result }));
      else if (slot === 'end') setVideoState(v => ({ ...v, endImage: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 'start' | 'mid' | 'end' | 'movementVideo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFileForSlot(file, slot);
    e.target.value = '';
  };

  // ── Enhance prompt ────────────────────────────────────────────────────────
  const enhancePrompt = async () => {
    if (!videoState.prompt || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await GeminiService.enhancePrompt(
        videoState.prompt,
        "You are Gemini 3 creative prompt optimizer. Rewrite this video generation prompt to be cinematic, technical, and concise (under 80 words), preserving intent."
      );
      setVideoState(v => ({ ...v, prompt: enhanced }));
    } catch (e) {
      console.error("Enhance prompt failed", e);
      alert("Prompt enhancement failed. Check API key or model access.");
    } finally {
      setIsEnhancing(false);
    }
  };

  // ── Video generation ──────────────────────────────────────────────────────
  // If images are loaded (even in prompt-only mode), use the selected provider.
  // Only fall back to Veo when truly prompt-only with no images.
  const hasImages = !!(videoState.startImage || videoState.endImage);
  const effectiveProvider = (mode === 'prompt-only' && !hasImages) ? 'veo' : provider;

  const stopVideoGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVideoState(v => ({ ...v, isGenerating: false, progressMessage: '' }));
  };

  const startVideoGeneration = async () => {
    if (videoState.isGenerating || !videoState.prompt) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setVideoState(v => ({ ...v, isGenerating: true, progressMessage: 'Initializing...' }));
    // When prompt-only forces Veo, grab the Veo-specific key (or global Gemini key) instead of the selected provider's key
    let apiKey = getVideoApiKey();
    if (effectiveProvider === 'veo' && provider !== 'veo') {
      const veoKey = localStorage.getItem('tensorax_video_key__veo-3.1-generate-preview')?.trim()
        || localStorage.getItem('tensorax_video_key__veo-2.0-generate-001')?.trim()
        || localStorage.getItem('gemini_api_key')?.trim()
        || '';
      if (veoKey) apiKey = veoKey;
    }

    try {
      let url: string | undefined;

      if (effectiveProvider === 'seedance') {
        if (!apiKey) { alert("Please set your fal.ai API key in Project Settings → Video Generation."); setVideoState(v => ({ ...v, isGenerating: false, progressMessage: '' })); return; }
        if (!videoState.startImage) { alert("Seedance requires a Start frame. Switch to Prompt + Images mode or upload a start frame."); setVideoState(v => ({ ...v, isGenerating: false, progressMessage: '' })); return; }
        const durationSecs = videoState.duration === '10s' ? '10' : '5';
        const body: Record<string, unknown> = {
          apiKey,
          prompt: videoState.prompt,
          duration: durationSecs,
          aspectRatio,
          startImageUrl: videoState.startImage,
          endImageUrl: videoState.endImage || null,
        };
        const res = await fetch('/api/generate-video-seedance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Seedance request failed: ${res.status}`); }
        url = (await res.json()).videoUrl;

      } else if (effectiveProvider === 'kling') {
        if (!apiKey) { alert("Please set your fal.ai API key in Project Settings → Video Generation."); setVideoState(v => ({ ...v, isGenerating: false, progressMessage: '' })); return; }
        if (!videoState.startImage) { alert("Kling requires a Start frame. Switch to Prompt + Images mode or upload a start frame."); setVideoState(v => ({ ...v, isGenerating: false, progressMessage: '' })); return; }
        const durationSecs = videoState.duration === '10s' ? '10' : '5';
        const body: Record<string, unknown> = {
          apiKey,
          model: getVideoModel(),
          prompt: videoState.prompt,
          duration: durationSecs,
          aspectRatio,
          generateAudio: false,
          startImageUrl: videoState.startImage,
          endImageUrl: videoState.endImage || null,
        };
        if (showRefVideo && videoState.movementVideo) {
          body.motionVideoUrl = videoState.movementVideo;
        }
        // SSE streaming — read progress events in real time
        const res = await fetch('/api/generate-video-kling', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
        if (!res.ok || !res.body) { const d = await res.text().catch(() => ''); throw new Error(d || `Kling request failed: ${res.status}`); }
        url = await new Promise<string>((resolve, reject) => {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          (async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              let currentEvent = '';
              for (const line of lines) {
                if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); }
                else if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (currentEvent === 'progress') { setVideoState(v => ({ ...v, progressMessage: data.message })); }
                    else if (currentEvent === 'done') { resolve(data.videoUrl); return; }
                    else if (currentEvent === 'error') { reject(new Error(data.error)); return; }
                  } catch { /* skip malformed JSON */ }
                }
              }
            }
            reject(new Error('Stream ended without result'));
          })().catch(reject);
        });

      } else {
        // Veo via Gemini — supports both text-to-video and image-to-video
        url = await GeminiService.generateVideo({
          prompt: videoState.prompt,
          startImage: showImages ? videoState.startImage : undefined,
          midImage: showImages ? videoState.midImage : undefined,
          endImage: showImages ? videoState.endImage : undefined,
          movementDescription: videoState.movementDescription,
          duration: videoState.duration,
          apiKey: apiKey || undefined,
          onProgress: (msg) => setVideoState(v => ({ ...v, progressMessage: msg })),
        });
      }

      if (url) {
        setVideoState(v => ({ ...v, resultUrl: url, isGenerating: false, progressMessage: '' }));
        setSavedVideoToAssets(false);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') { console.log("[Video] Generation cancelled by user."); return; }
      console.error("Video generation failed:", e);
      setVideoState(v => ({ ...v, isGenerating: false, progressMessage: 'Error encountered.' }));
      alert(`Video generation failed: ${e?.message || 'Unknown error'}`);
    }
  };

  // ── Video review ──────────────────────────────────────────────────────────
  const reviewGeneratedVideo = async () => {
    if (!videoState.resultUrl || isReviewingVideo) return;
    setIsReviewingVideo(true);
    setVideoReview('');
    try {
      const apiKey = GeminiService.getApiKey();
      if (!apiKey) { alert('Set a Gemini API key in Project Settings first.'); return; }
      const res = await fetch('/api/video/review-generated-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoState.resultUrl, apiKey, model: 'gemini-2.5-pro' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      setVideoReview(data.analysis);
    } catch (e: any) {
      alert(`Video review failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsReviewingVideo(false);
    }
  };

  // ── Provider label ────────────────────────────────────────────────────────
  const effectiveProviderLabel = effectiveProvider === 'seedance' ? 'Seedance' : effectiveProvider === 'kling' ? 'Kling' : 'Veo';
  const providerLabel = effectiveProviderLabel;
  const generateLabel = videoState.isGenerating ? 'PROCESSING' : `GENERATE ${effectiveProviderLabel.toUpperCase()} CLIP`;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-80 bg-[#edecec] border-r border-[#e0d6e3] flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-[#e0d6e3] bg-white/50">
          <h2 className="text-lg font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Video Studio</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* ── MODE SELECTOR ── */}
          <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-3">
            <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Generation Mode</label>
            <div className="space-y-1.5">
              {(Object.keys(MODE_INFO) as VideoMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                    mode === m
                      ? 'bg-[#91569c]/10 border-[#91569c]/40 text-[#5c3a62]'
                      : 'bg-white border-[#e0d6e3] text-[#3a3a3a]/70 hover:border-[#ceadd4]'
                  }`}
                >
                  <i className={`fa-solid ${MODE_INFO[m].icon} text-sm ${mode === m ? 'text-[#91569c]' : 'text-[#888]'}`} />
                  <div>
                    <span className={`text-[11px] font-black uppercase tracking-wide ${mode === m ? 'text-[#5c3a62]' : ''}`}>{MODE_INFO[m].label}</span>
                    <p className="text-[9px] text-[#888] leading-tight mt-0.5">{MODE_INFO[m].description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── VIDEO ENGINE ── */}
          <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Video Engine</label>
              <button type="button" onClick={onNavigateSettings} className="text-[9px] font-bold text-[#91569c] hover:text-[#5c3a62] transition-colors flex items-center gap-1">
                <i className="fa-solid fa-gear text-[8px]" /> Change in Settings
              </button>
            </div>
            <div className="flex items-center gap-2 bg-[#f6f0f8] rounded-xl px-4 py-2.5 border border-[#e0d6e3]">
              <i className="fa-solid fa-video text-[#91569c] text-sm" />
              <span className="text-[11px] font-black text-[#5c3a62] uppercase tracking-wide">{getVideoModel()}</span>
              {!getVideoApiKey() && provider !== 'veo' ? (
                <span className="ml-auto text-[9px] text-red-500 font-bold flex items-center gap-1"><i className="fa-solid fa-circle-xmark text-[8px]" /> No API key</span>
              ) : (
                <span className="ml-auto text-[9px] text-green-600 font-bold flex items-center gap-1"><i className="fa-solid fa-circle-check text-[8px]" /> Ready</span>
              )}
            </div>
            {provider === 'seedance' && <p className="text-[9px] text-[#3a3a3a]/60">Seedance 2.0 via fal.ai. Supports Start and End frames, up to 1080p.</p>}
            {provider === 'veo' && <p className="text-[9px] text-[#3a3a3a]/60">Veo via Gemini API. Supports Start, Mid and End frames.</p>}
            {provider === 'kling' && <p className="text-[9px] text-[#3a3a3a]/60">Kling {getVideoModel().includes('o3') ? 'O3 Omni' : 'V3'} via fal.ai. Supports Start/End frames, motion reference, native audio, up to 15s.</p>}
            {mode === 'prompt-only' && provider !== 'veo' && (
              <p className="text-[9px] text-[#91569c] font-bold mt-1"><i className="fa-solid fa-info-circle mr-1" />Prompt Only uses Veo (Gemini) — Seedance/Kling require images.</p>
            )}
          </div>

          {/* ── SCREENPLAY SCENES — expanded card per scene ── */}
          {scenes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Screenplay Scenes</label>
                <div className="flex items-center gap-2">
                  {projectId && (Object.keys(refImages).length > 0 || Object.keys(frameImages).length > 0) && (
                    <button
                      onClick={async () => {
                        if (!projectId) return;
                        let saved = 0;
                        for (const [key, url] of Object.entries(refImages)) {
                          if (savedRefKeys.has(key)) continue;
                          const [si, ci] = key.split('-').map(Number);
                          await DB.saveToAssets(projectId, {
                            type: 'image',
                            name: `Scene ${si + 1} Clip ${ci + 1} — Reference`,
                            description: scenes[si]?.videoPrompts[ci]?.prompt || '',
                            thumbnail: url,
                            tags: ['reference', 'video'],
                            metadata: { source: 'video-screen' },
                          });
                          setSavedRefKeys(prev => new Set(prev).add(key));
                          saved++;
                        }
                        for (const [key, url] of Object.entries(frameImages)) {
                          if (savedFrameKeys.has(key)) continue;
                          const [si, fi] = key.split('-').map(Number);
                          await DB.saveToAssets(projectId, {
                            type: 'image',
                            name: `Scene ${si + 1} Frame ${fi + 1}`,
                            description: scenes[si]?.framePrompts[fi]?.prompt || '',
                            thumbnail: url,
                            tags: ['frame', 'video'],
                            metadata: { source: 'video-screen' },
                          });
                          setSavedFrameKeys(prev => new Set(prev).add(key));
                          saved++;
                        }
                        if (saved === 0) alert('All images already saved to assets.');
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors"
                    >
                      <i className="fa-solid fa-database text-[7px]"></i>
                      Save All to Assets
                    </button>
                  )}
                  <span className="text-[8px] text-[#3a3a3a]/50 font-bold">{scenes.length} scenes</span>
                </div>
              </div>

              {scenes.map((scene) => {
                const isExpanded = expandedScene === scene.index;
                const isActiveScene = videoState.selectedSceneIndex === scene.index;
                return (
                  <div key={scene.index} className={`border rounded-2xl overflow-hidden transition-all ${
                    isActiveScene ? 'border-[#91569c] bg-[#faf7fb]' : 'border-[#ceadd4] bg-white/80'
                  }`}>
                    {/* ── Scene Header (always visible, clickable to expand/collapse) ── */}
                    <button
                      onClick={() => setExpandedScene(isExpanded ? undefined : scene.index)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f6f0f8] transition-all"
                    >
                      <i className={`fa-solid fa-chevron-right text-[8px] text-[#91569c] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-[#5c3a62]">
                            Scene {scene.index + 1}
                          </span>
                          <span className="text-[9px] text-[#3a3a3a]/70 truncate">{scene.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {scene.duration && (
                            <span className="text-[7px] bg-[#91569c]/10 text-[#91569c] px-1.5 py-0.5 rounded-full font-bold">{scene.duration}</span>
                          )}
                          <span className="text-[7px] text-[#3a3a3a]/40">
                            {scene.framePrompts.length} frame{scene.framePrompts.length !== 1 ? 's' : ''} · {scene.videoPrompts.length} clip{scene.videoPrompts.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {isActiveScene && <i className="fa-solid fa-circle text-[6px] text-[#91569c]" />}
                    </button>

                    {/* ── Expanded Scene Content ── */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-[#e0d6e3]">
                        {/* Scene description */}
                        {scene.sceneDescription && (
                          <p className="text-[8px] text-[#3a3a3a]/60 mt-2 leading-relaxed line-clamp-3">{scene.sceneDescription.slice(0, 200)}{scene.sceneDescription.length > 200 ? '…' : ''}</p>
                        )}
                        {/* Dialogue */}
                        {scene.dialogue && (
                          <div className="bg-[#f9f7fa] rounded-lg px-2.5 py-1.5 border-l-2 border-[#ceadd4]">
                            <p className="text-[7px] font-bold uppercase tracking-wider text-[#91569c] mb-0.5"><i className="fa-solid fa-comment-dots mr-1" />Dialogue</p>
                            <p className="text-[8px] text-[#3a3a3a]/70 leading-relaxed line-clamp-3">{scene.dialogue.slice(0, 200)}{scene.dialogue.length > 200 ? '…' : ''}</p>
                          </div>
                        )}

                        {/* ── FRAMES section ── */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <i className="fa-solid fa-image text-[8px] text-[#91569c]" />
                            <span className="text-[9px] font-black uppercase tracking-wider text-[#5c3a62]">Frames</span>
                            <span className="text-[7px] text-[#3a3a3a]/40">({scene.framePrompts.length})</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {scene.framePrompts.map((frame, frameIdx) => {
                              const fKey = `${scene.index}-${frameIdx}`;
                              const hasFrameImg = !!frameImages[fKey];
                              const isGeneratingFrame = generatingFrameKey === fKey;
                              return (
                                <div key={fKey} className="bg-white border border-[#e0d6e3] rounded-lg overflow-hidden">
                                  {/* Frame image or generate button */}
                                  <div className="aspect-[16/10] bg-[#f5f0f7] flex items-center justify-center relative">
                                    {hasFrameImg ? (
                                      <img src={frameImages[fKey]} alt={frame.label} className="w-full h-full object-cover" />
                                    ) : (
                                      <button
                                        onClick={() => handleGenerateFrameImage(scene.index, frameIdx)}
                                        disabled={!!generatingFrameKey}
                                        className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#91569c]/40 hover:text-[#91569c] transition-all disabled:opacity-30"
                                      >
                                        {isGeneratingFrame ? (
                                          <i className="fa-solid fa-spinner fa-spin text-sm" />
                                        ) : (
                                          <>
                                            <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                                            <span className="text-[7px] font-bold uppercase">Generate</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                    {hasFrameImg && (
                                      <button
                                        onClick={() => handleGenerateFrameImage(scene.index, frameIdx)}
                                        disabled={!!generatingFrameKey}
                                        className="absolute top-1 right-1 w-5 h-5 bg-black/40 rounded-full text-white text-[7px] flex items-center justify-center hover:bg-[#91569c] transition-colors"
                                        title="Regenerate"
                                      >
                                        <i className={`fa-solid ${isGeneratingFrame ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`} />
                                      </button>
                                    )}
                                  </div>
                                  {/* Frame label and prompt */}
                                  <div className="px-2 py-1.5">
                                    <p className="text-[8px] font-bold text-[#5c3a62]">{frame.label}</p>
                                    <p className="text-[7px] text-[#3a3a3a]/50 truncate mt-0.5">{frame.prompt.slice(0, 50)}…</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── VIDEO PROMPTS section ── */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <i className="fa-solid fa-film text-[8px] text-[#91569c]" />
                            <span className="text-[9px] font-black uppercase tracking-wider text-[#5c3a62]">Video Clips</span>
                            <span className="text-[7px] text-[#3a3a3a]/40">({scene.videoPrompts.length})</span>
                          </div>
                          {scene.videoPrompts.map((clip, clipIdx) => {
                            const key = `${scene.index}-${clipIdx}`;
                            const isSelected = selectedClipKey === key;
                            const hasRef = !!refImages[key];
                            const isGeneratingThis = generatingRefKey === key;
                            return (
                              <div
                                key={key}
                                className={`flex items-stretch border-l-2 rounded-lg transition-all ${
                                  isSelected
                                    ? 'bg-[#91569c]/10 border-l-[#91569c]'
                                    : 'bg-white border-l-[#e0d6e3] hover:border-l-[#ceadd4] hover:bg-[#faf7fb]'
                                }`}
                              >
                                {/* Ref image thumbnail or generate button */}
                                <div className="flex-shrink-0 w-11 flex items-center justify-center p-1">
                                  {hasRef ? (
                                    <img
                                      src={refImages[key]}
                                      alt="ref"
                                      className="w-9 h-9 rounded object-cover border border-[#ceadd4] cursor-pointer hover:ring-1 hover:ring-[#91569c]"
                                      title="Reference image — click clip to use as start frame"
                                      onClick={() => handleSelectClip(scene.index, clipIdx)}
                                    />
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleGenerateRefImage(scene.index, clipIdx); }}
                                      disabled={!!generatingRefKey}
                                      title="Generate reference image for this clip"
                                      className="w-9 h-9 rounded border border-dashed border-[#ceadd4] flex items-center justify-center text-[#91569c]/40 hover:text-[#91569c] hover:border-[#91569c]/40 transition-all disabled:opacity-30"
                                    >
                                      {isGeneratingThis ? (
                                        <i className="fa-solid fa-spinner fa-spin text-[9px]" />
                                      ) : (
                                        <i className="fa-solid fa-video text-[9px]" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                {/* Clip label and prompt preview */}
                                <button
                                  onClick={() => handleSelectClip(scene.index, clipIdx)}
                                  className="flex-1 text-left px-2 py-1.5 text-[9px] min-w-0"
                                >
                                  <div className="flex items-center gap-1">
                                    <i className={`fa-solid fa-film text-[6px] ${isSelected ? 'text-[#91569c]' : 'text-[#ceadd4]'}`} />
                                    <span className={isSelected ? 'text-[#5c3a62] font-semibold' : 'text-[#3a3a3a]/70'}>{clip.label}</span>
                                    {hasRef && <i className="fa-solid fa-check-circle text-[6px] text-green-500" />}
                                  </div>
                                  <p className="text-[7px] opacity-50 truncate mt-0.5">{clip.prompt.slice(0, 55)}…</p>
                                </button>
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
          )}

          {/* ── GENERATION PROMPT ── */}
          <div ref={promptSectionRef} className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Generation Prompt</label>
              <button
                onClick={enhancePrompt}
                disabled={isEnhancing || !videoState.prompt}
                title="Enhance Prompt"
                className={`text-sm transition-all p-1.5 rounded-lg border ${isEnhancing ? 'bg-white border-[#ceadd4] text-[#3a3a3a]' : 'bg-white border-[#ceadd4] text-[#91569c]/70 hover:text-[#91569c] hover:border-[#91569c]/30 active:scale-95'}`}
              >
                <i className={`fa-solid ${isEnhancing ? 'fa-wand-magic-sparkles fa-spin' : 'fa-wand-magic-sparkles'}`} />
              </button>
            </div>
            <textarea
              value={videoState.prompt}
              onChange={(e) => setVideoState(v => ({ ...v, prompt: e.target.value, selectedSceneIndex: undefined }))}
              placeholder="Describe the cinematic scene..."
              className="w-full bg-white border border-[#ceadd4] rounded-xl p-3 text-[11px] focus:ring-1 focus:ring-[#91569c] outline-none h-28 resize-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/70"
            />
          </div>

          {/* ── REFERENCE IMAGE CONTEXT (auto-populated from scene selection) ── */}
          {selectedClipKey && (refImages[selectedClipKey] || (selectedClipKey.split('-')[1] !== '0' && refImages[`${selectedClipKey.split('-')[0]}-${parseInt(selectedClipKey.split('-')[1]) - 1}`])) && (
            <div className="bg-[#f6f0f8] border border-[#ceadd4] p-3 rounded-2xl space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#91569c]"><i className="fa-solid fa-link mr-1" />Reference Image Context</p>
              <div className="flex gap-2">
                {(() => {
                  const [si, ci] = selectedClipKey.split('-').map(Number);
                  const prevKey = ci > 0 ? `${si}-${ci - 1}` : undefined;
                  const prevRef = prevKey ? refImages[prevKey] : undefined;
                  const thisRef = refImages[selectedClipKey];
                  return (
                    <>
                      {prevRef && (
                        <div className="text-center">
                          <img src={prevRef} className="w-16 h-16 rounded-lg object-cover border border-[#ceadd4]" />
                          <p className="text-[7px] text-[#91569c] mt-0.5 font-bold">Start (prev clip)</p>
                        </div>
                      )}
                      {thisRef && (
                        <div className="text-center">
                          <img src={thisRef} className="w-16 h-16 rounded-lg object-cover border border-[#ceadd4]" />
                          <p className="text-[7px] text-[#91569c] mt-0.5 font-bold">{prevRef ? 'End (this clip)' : 'Start (this clip)'}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── KEY FRAME SEQUENCE (always visible — upload, replace or remove frames) ── */}
          <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-4">
            <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Key Frames</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'start' as const, label: 'Start' },
                { id: 'mid' as const, label: 'Mid' },
                { id: 'end' as const, label: 'End' },
              ].map(slot => {
                const imgKey = `${slot.id}Image` as 'startImage' | 'midImage' | 'endImage';
                const img = videoState[imgKey];
                return (
                  <div key={slot.id}>
                  <DropZone accept="image/*" onFiles={(files) => processFileForSlot(files[0], slot.id)} className="aspect-square">
                    <div className="relative w-full h-full">
                      <input type="file" id={`upload-${slot.id}`} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, slot.id)} />
                      <label htmlFor={`upload-${slot.id}`} className="flex flex-col items-center justify-center w-full h-full bg-white border border-[#ceadd4] border-dashed rounded-lg cursor-pointer hover:border-[#91569c]/30 transition-all overflow-hidden group">
                        {img ? (
                          <>
                            <img src={img} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                <i className="fa-solid fa-arrow-rotate-right text-[7px]" /> Change
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <i className="fa-solid fa-cloud-arrow-up text-[#5c3a62] text-lg group-hover:text-[#91569c]/50 transition-colors" />
                            <span className="text-xs font-black uppercase text-[#3a3a3a]">{slot.label}</span>
                          </div>
                        )}
                      </label>
                      {img && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setVideoState(v => ({ ...v, [imgKey]: undefined })); }}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white text-[9px] flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                      )}
                    </div>
                  </DropZone>
                  <p className="text-[8px] font-bold uppercase text-center text-[#888] mt-1">{slot.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── MOVEMENT PATH (always shown) ── */}
          <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-4">
            <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Movement Path</label>
            <textarea
              value={videoState.movementDescription}
              onChange={(e) => setVideoState(v => ({ ...v, movementDescription: e.target.value }))}
              placeholder="Describe specific movements (e.g. camera zooms in slowly, subject walks left to right)..."
              className="w-full bg-white border border-[#ceadd4] rounded-xl p-3 text-[11px] focus:ring-1 focus:ring-[#91569c] outline-none h-20 resize-none text-[#3a3a3a] placeholder:text-[#3a3a3a]/70"
            />

            {/* Reference video upload — mode 3 only */}
            {showRefVideo && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-[#3a3a3a] tracking-wider">Movement Reference Video</p>
                <DropZone accept="video/*" onFiles={(files) => processFileForSlot(files[0], 'movementVideo')}>
                  <div className="relative">
                    <input type="file" id="upload-movement-video" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'movementVideo')} />
                    <label
                      htmlFor="upload-movement-video"
                      className={`flex items-center gap-3 w-full p-3 rounded-xl border border-dashed transition-all cursor-pointer ${videoState.movementVideo ? 'border-[#91569c]/50 bg-[#91569c]/5' : 'border-[#ceadd4] bg-white hover:border-[#91569c]/30'}`}
                    >
                      <i className={`fa-solid ${videoState.movementVideo ? 'fa-video text-[#91569c]' : 'fa-film text-[#5c3a62] text-lg'}`} />
                      <span className="text-xs font-black uppercase text-[#3a3a3a]">
                        {videoState.movementVideo ? 'Video Attached' : 'Drop video or click to select'}
                      </span>
                    </label>
                    {videoState.movementVideo && (
                      <button
                        type="button"
                        onClick={() => setVideoState(v => ({ ...v, movementVideo: undefined }))}
                        className="absolute top-2 right-2 text-[10px] text-red-500 hover:text-red-400"
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    )}
                  </div>
                </DropZone>
              </div>
            )}
          </div>

          {/* ── DURATION ── */}
          <div className="bg-white/80 border border-[#ceadd4] p-4 rounded-2xl space-y-3">
            <label className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide">Duration</label>
            <select
              value={videoState.duration}
              onChange={(e) => setVideoState(v => ({ ...v, duration: e.target.value as '5s' | '10s' }))}
              className="w-full bg-white border border-[#ceadd4] rounded-xl p-3 text-[11px] outline-none text-[#3a3a3a] focus:ring-1 focus:ring-[#91569c] appearance-none cursor-pointer"
            >
              <option value="5s">5 Seconds Clip</option>
              <option value="10s">10 Seconds Clip</option>
            </select>
          </div>
        </div>

        {/* ── GENERATE / STOP BUTTONS ── */}
        <div className="p-4 border-t border-[#ceadd4] bg-white space-y-2">
          {videoState.isGenerating ? (
            <>
              <div className="w-full py-3 rounded-2xl bg-[#f6f0f8] text-center">
                <span className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#5c3a62]">
                  <i className="fa-solid fa-gear fa-spin" /> PROCESSING
                </span>
                {videoState.progressMessage && (
                  <p className="text-[9px] text-[#3a3a3a]/60 mt-1">{videoState.progressMessage}</p>
                )}
              </div>
              <button
                onClick={stopVideoGeneration}
                className="w-full py-3 rounded-2xl font-black uppercase text-xs tracking-[0.2em] bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg active:scale-95"
              >
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-stop" /> STOP GENERATION
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={startVideoGeneration}
              className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 bg-[#91569c] hover:bg-[#91569c]/90 text-black"
            >
              {generateLabel}
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 bg-[#edecec] p-6 flex flex-col items-center justify-center relative">

        {/* Idle state */}
        {!videoState.resultUrl && !videoState.isGenerating && (
          <div className="text-center space-y-6 opacity-20">
            <i className="fa-solid fa-clapperboard text-[120px] text-[#888]" />
            <p className="font-black uppercase tracking-[0.3em] text-[#888]">Video Studio Idle</p>
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold">
              {mode === 'prompt-only' ? 'Enter a prompt and generate' : mode === 'prompt-images' ? 'Add keyframes and a prompt' : 'Add keyframes, a reference video, and a prompt'}
            </p>
          </div>
        )}

        {/* Generating state */}
        {videoState.isGenerating && (
          <div className="w-full max-w-lg text-center space-y-8 animate-pulse">
            <div className="w-32 h-32 mx-auto relative">
              <LogoIcon className="w-full h-full text-[#91569c] animate-spin-slow opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-gear fa-spin text-3xl text-[#91569c]" />
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-lg font-black uppercase tracking-widest text-[#888]">{videoState.progressMessage}</p>
              <p className="text-[10px] text-[#888] uppercase tracking-[0.4em] font-bold">This typically takes 2-4 minutes</p>
            </div>
          </div>
        )}

        {/* Result state */}
        {videoState.resultUrl && !videoState.isGenerating && (
          <div className="w-full max-w-4xl animate-fade-in space-y-6">
            <div className="relative rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[#ceadd4] bg-black">
              <video src={videoState.resultUrl} controls autoPlay loop className="w-full aspect-video" />
              <div className="absolute top-6 right-6 flex gap-2">
                <button
                  onClick={reviewGeneratedVideo}
                  disabled={isReviewingVideo}
                  className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-[#5c3a62] hover:bg-white/20 transition-all shadow-xl disabled:opacity-40"
                  title="Review with Gemini"
                >
                  <i className={`fa-solid ${isReviewingVideo ? 'fa-spinner fa-spin' : 'fa-eye'}`} />
                </button>
                <a
                  href={videoState.resultUrl}
                  download="tensorax-video.mp4"
                  className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-[#5c3a62] hover:bg-white/20 transition-all shadow-xl"
                >
                  <i className="fa-solid fa-download" />
                </a>
                {projectId && (
                  <button
                    onClick={async () => {
                      if (!projectId || !videoState.resultUrl || savedVideoToAssets) return;
                      setSavingVideoToAssets(true);
                      try {
                        await DB.saveToAssets(projectId, {
                          type: 'video',
                          name: `${getVideoModel()} — ${videoState.prompt?.slice(0, 60) || 'Video'}`,
                          description: videoState.prompt || '',
                          thumbnail: videoState.startImage || videoState.resultUrl,
                          tags: ['video', getVideoProvider()],
                          metadata: { source: 'video-screen', model: getVideoModel(), provider: getVideoProvider() },
                        });
                        setSavedVideoToAssets(true);
                      } catch (err: any) {
                        alert(`Failed to save to assets: ${err?.message || err}`);
                      } finally {
                        setSavingVideoToAssets(false);
                      }
                    }}
                    disabled={savedVideoToAssets || savingVideoToAssets}
                    className={`w-12 h-12 backdrop-blur-xl border rounded-full flex items-center justify-center transition-all shadow-xl ${
                      savedVideoToAssets
                        ? 'bg-green-500/30 border-green-400/40 text-green-200'
                        : 'bg-white/10 border-white/20 text-[#5c3a62] hover:bg-white/20'
                    }`}
                    title={savedVideoToAssets ? 'Saved to assets' : 'Save to assets database'}
                  >
                    <i className={`fa-solid ${savingVideoToAssets ? 'fa-spinner fa-spin' : savedVideoToAssets ? 'fa-check' : 'fa-database'}`} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center px-4">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 bg-white border border-[#ceadd4] rounded-xl flex items-center justify-center">
                  <LogoIcon className="w-5 h-5 text-[#888]" />
                </div>
                <div>
                  <h3 className="text-base font-heading font-bold text-[#5c3a62] uppercase tracking-wide">{providerLabel} Cinematic Generation</h3>
                  <p className="text-[10px] text-[#888] uppercase font-bold">
                    {mode === 'prompt-only' ? 'Prompt Only' : mode === 'prompt-images' ? 'Prompt + Images' : 'Prompt + Images + Video'} • Motion Consistent
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setVideoState(v => ({ ...v, resultUrl: undefined })); setVideoReview(''); }}
                className="text-[10px] font-black text-[#888] uppercase hover:text-red-500 transition-colors"
              >
                Discard Session
              </button>
            </div>

            {/* Review loading */}
            {isReviewingVideo && !videoReview && (
              <div className="bg-white border border-[#ceadd4] rounded-2xl p-6 text-center animate-pulse">
                <i className="fa-solid fa-eye fa-beat-fade text-2xl text-[#91569c] mb-3" />
                <p className="text-xs font-black uppercase tracking-widest text-[#888]">Gemini is watching your video...</p>
                <p className="text-[9px] text-[#888] mt-1">Uploading, processing, and analysing — this takes 30-90 seconds</p>
              </div>
            )}

            {/* Review result */}
            {videoReview && (
              <div className="bg-white border border-[#ceadd4] rounded-2xl p-5 space-y-3 max-h-[400px] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-eye text-[#91569c]" />
                    <h4 className="text-xs font-black uppercase tracking-wide text-[#5c3a62]">Gemini Video Review</h4>
                  </div>
                  <button onClick={() => setVideoReview('')} className="text-[9px] text-[#888] hover:text-red-500 uppercase font-bold">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
                <div
                  className="text-[11px] text-[#3a3a3a] leading-relaxed whitespace-pre-wrap prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: videoReview
                      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      .replace(/^### (.+)$/gm, '<h3 class="text-xs font-black uppercase tracking-wide text-[#5c3a62] mt-3 mb-1">$1</h3>')
                      .replace(/^## (.+)$/gm, '<h3 class="text-xs font-black uppercase tracking-wide text-[#5c3a62] mt-3 mb-1">$1</h3>')
                      .replace(/^\d+\.\s/gm, '&bull; ')
                  }}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
};
