import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PROJECT_TEMPLATES, TemplateState, VideoSegment, type TemplateId } from '../types';
import { DB } from '../services/projectDB';
import { GeminiService } from '../services/geminiService';
import { runAgent } from '../services/agentRunner';
import { videoFromKeyframesAgentPrompt } from '../prompts/Video/videoFromKeyframesAgent';
import DropZone from './DropZone';

/**
 * KeyframesWizard — "Video from Key Frames" template.
 *
 * Step 0: Upload keyframe images (any number, min 2), reorder, set format
 * Step 1: For each consecutive pair, generate a video segment (via videoFromKeyframesAgent + video gen)
 * Step 2: Stitch all segments into one final video (via videoStitchingAgent)
 */

interface KeyframesWizardProps {
  templateId: TemplateId;
  projectId?: string;
  onComplete: (state: TemplateState) => void;
  onCancel: () => void;
}

interface KeyFrame {
  id: number;
  dataUri: string;  // base64 data URI or URL
  name: string;
}

const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** Get the selected video model */
const getVideoModel = (): string => {
  try { return localStorage.getItem('tensorax_video_model')?.trim() || 'veo-2.0-generate-001'; } catch { return 'veo-2.0-generate-001'; }
};

/** Is the selected video model a Veo/Gemini model (vs fal.ai)? */
const isVeoModel = (model: string): boolean =>
  model.startsWith('veo') || model.startsWith('gemini');

/** Get fal.ai key for video generation */
const getFalVideoKey = (): string => {
  try {
    const falKey = localStorage.getItem('tensorax_fal_key')?.trim();
    if (falKey) return falKey;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('tensorax_video_key')) continue;
      const val = localStorage.getItem(key)?.trim() || '';
      if (val && !val.startsWith('AIza')) return val;
    }
    return '';
  } catch { return ''; }
};

/** Get the video API key for the selected model */
const getVideoKey = (): string => {
  try {
    const model = getVideoModel();
    const perModel = localStorage.getItem(`tensorax_video_key__${model}`)?.trim();
    if (perModel) return perModel;
    if (model.startsWith('kling-') || model.startsWith('seedance')) {
      const falKey = localStorage.getItem('tensorax_fal_key')?.trim();
      if (falKey) return falKey;
    }
    const base = localStorage.getItem('tensorax_video_key')?.trim();
    if (base) return base;
    if (isVeoModel(model)) {
      const analysisKey = localStorage.getItem('tensorax_analysis_key')?.trim();
      if (analysisKey) return analysisKey;
    }
    return '';
  } catch { return ''; }
};

export const KeyframesWizard: React.FC<KeyframesWizardProps> = ({ templateId, projectId, onComplete, onCancel }) => {
  const template = PROJECT_TEMPLATES.find(t => t.id === templateId)!;

  const [step, setStep] = useState(0);
  const [frames, setFrames] = useState<KeyFrame[]>([]);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | undefined>();
  const [outputFormat, setOutputFormat] = useState('landscape_16_9');
  const [segmentDuration, setSegmentDuration] = useState<'5' | '10'>('5');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(1);
  const hasRestoredRef = useRef(false);

  // ── Restore saved state ────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) { hasRestoredRef.current = true; return; }
    DB.getMetadata(projectId).then(meta => {
      if (meta.kfWizardState && typeof meta.kfWizardState === 'object') {
        const saved = meta.kfWizardState as Record<string, unknown>;
        if (typeof saved.step === 'number') setStep(saved.step);
        if (Array.isArray(saved.frames) && saved.frames.length > 0) {
          setFrames(saved.frames as KeyFrame[]);
          nextIdRef.current = Math.max(...(saved.frames as KeyFrame[]).map(f => f.id)) + 1;
        }
        if (Array.isArray(saved.segments) && saved.segments.length > 0) setSegments(saved.segments as VideoSegment[]);
        if (typeof saved.finalVideoUrl === 'string') setFinalVideoUrl(saved.finalVideoUrl);
        if (typeof saved.outputFormat === 'string') setOutputFormat(saved.outputFormat);
        if (saved.segmentDuration === '5' || saved.segmentDuration === '10') setSegmentDuration(saved.segmentDuration);
      }
      hasRestoredRef.current = true;
    }).catch(() => { hasRestoredRef.current = true; });
  }, [projectId]);

  // ── Auto-save state ────────────────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectId || isGenerating || !hasRestoredRef.current) return;
    if (frames.length === 0 && segments.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const kfWizardState = {
        step,
        frames: frames.map(f => ({ id: f.id, dataUri: f.dataUri, name: f.name })),
        segments: segments.map(s => ({ id: s.id, startStageId: s.startStageId, endStageId: s.endStageId, prompt: s.prompt, videoUrl: s.videoUrl })),
        finalVideoUrl,
        outputFormat,
        segmentDuration,
      };
      DB.saveMetadata(projectId, { kfWizardState }).catch(e => console.warn('[KeyframesWizard] Failed to save state:', e));
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [projectId, step, frames, segments, finalVideoUrl, isGenerating, outputFormat, segmentDuration]);

  // ── Frame management ───────────────────────────────────────────────────────
  const addFiles = async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const newFrames: KeyFrame[] = [];
    for (const file of imageFiles) {
      const dataUri = await fileToDataUri(file);
      newFrames.push({ id: nextIdRef.current++, dataUri, name: file.name });
    }
    setFrames(prev => [...prev, ...newFrames]);
  };

  const removeFrame = (id: number) => {
    setFrames(prev => prev.filter(f => f.id !== id));
  };

  const moveFrame = (fromIdx: number, toIdx: number) => {
    setFrames(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };

  // ── Build segments from frames ─────────────────────────────────────────────
  const buildSegments = (): VideoSegment[] => {
    const segs: VideoSegment[] = [];
    for (let i = 0; i < frames.length - 1; i++) {
      // Preserve existing segment if it matches the same pair
      const existing = segments.find(s => s.startStageId === frames[i].id && s.endStageId === frames[i + 1].id);
      segs.push(existing || {
        id: i + 1,
        startStageId: frames[i].id,
        endStageId: frames[i + 1].id,
        prompt: '',
      });
    }
    return segs;
  };

  // ── Generate video for one segment ─────────────────────────────────────────
  const generateSegment = async (seg: VideoSegment) => {
    const startFrame = frames.find(f => f.id === seg.startStageId);
    const endFrame = frames.find(f => f.id === seg.endStageId);
    if (!startFrame || !endFrame) return;

    setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, isGenerating: true } : s));
    setIsGenerating(true);
    setError(undefined);

    try {
      // Step 1: Run videoFromKeyframesAgent to get a motion prompt
      setProgressMessage(`Segment ${seg.id}: Generating motion prompt...`);
      const agentResult = await runAgent<{ videoPrompt: string; duration: string }>({
        agentPrompt: videoFromKeyframesAgentPrompt,
        userMessage: `Generate a smooth video transition between these two keyframes. Frame 1 is "${startFrame.name}" and Frame 2 is "${endFrame.name}". Create a cinematic motion prompt that interpolates between them.`,
        images: [startFrame.dataUri, endFrame.dataUri],
        temperature: 0.7,
      });

      const motionPrompt = agentResult.data.videoPrompt || seg.prompt || 'Smooth cinematic transition between keyframes.';

      // Update segment with AI-generated prompt
      setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, prompt: motionPrompt } : s));

      // Step 2: Generate the video
      const videoModel = getVideoModel();
      const videoApiKey = getVideoKey();
      if (!videoApiKey) throw new Error('No video API key found. Set it in Project Settings.');

      let resultVideoUrl: string;
      const isVeo = isVeoModel(videoModel);

      if (isVeo) {
        setProgressMessage(`Segment ${seg.id}: Generating with Veo (1-2 min)...`);
        resultVideoUrl = await GeminiService.generateVideo({
          prompt: motionPrompt,
          startImage: startFrame.dataUri,
          endImage: endFrame.dataUri,
          duration: `${segmentDuration}s` as '5s' | '10s',
          apiKey: videoApiKey,
          onProgress: (msg) => setProgressMessage(`Segment ${seg.id}: ${msg}`),
        });
      } else {
        // Kling / Seedance (fal.ai) — server-side via SSE
        setProgressMessage(`Segment ${seg.id}: Generating with ${videoModel}...`);
        resultVideoUrl = await new Promise<string>((resolve, reject) => {
          fetch('/api/generate-video-kling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: videoApiKey,
              model: videoModel,
              startImageUrl: startFrame.dataUri,
              endImageUrl: endFrame.dataUri,
              prompt: motionPrompt,
              duration: parseInt(segmentDuration),
              aspectRatio: '16:9',
              generateAudio: false,
            }),
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
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              let currentEvent = '';
              for (const line of lines) {
                if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
                else if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (currentEvent === 'progress') setProgressMessage(`Segment ${seg.id}: ${data.message}`);
                    else if (currentEvent === 'done') { resolve(data.videoUrl); return; }
                    else if (currentEvent === 'error') { reject(new Error(data.error)); return; }
                  } catch { /* skip */ }
                }
              }
            }
            reject(new Error('Stream ended without result'));
          }).catch(reject);
        });
      }

      setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, videoUrl: resultVideoUrl, isGenerating: false, prompt: motionPrompt } : s));
      setIsGenerating(false);
      setProgressMessage('');

      // Auto-save video to project
      if (projectId && resultVideoUrl) {
        DB.saveProjectFile(projectId, `kf-segment-${seg.id}.mp4`, resultVideoUrl, 'videos').catch(() => {});
        DB.saveProjectFile(projectId, `kf-segment-${seg.id}-prompt.txt`, motionPrompt, 'concepts').catch(() => {});
      }
    } catch (err: any) {
      setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, isGenerating: false } : s));
      setIsGenerating(false);
      setProgressMessage('');
      setError(`Segment ${seg.id}: ${err.message}`);
    }
  };

  const generateAllSegments = async () => {
    setIsGenerating(true);
    setProgressMessage('Generating video segments...');
    setError(undefined);
    for (const seg of segments) {
      if (seg.videoUrl) continue;
      await generateSegment(seg);
      await new Promise(r => setTimeout(r, 2000));
    }
    setIsGenerating(false);
    setProgressMessage('');
  };

  // ── Stitch all segments ────────────────────────────────────────────────────
  const stitchAllSegments = async () => {
    const videoUrls = segments.sort((a, b) => a.id - b.id).map(s => s.videoUrl).filter(Boolean) as string[];
    if (videoUrls.length < 2) { setError('Need at least 2 completed segments to stitch.'); return; }

    setIsGenerating(true);
    setProgressMessage('Stitching segments into final video...');
    setError(undefined);

    try {
      const apiKey = getVideoKey();
      const falKey = isVeoModel(getVideoModel())
        ? (localStorage.getItem('tensorax_video_key__kling-v3-standard')?.trim()
          || localStorage.getItem('tensorax_video_key')?.trim()
          || apiKey)
        : apiKey;
      const allLocal = videoUrls.every(u => u.startsWith('/') || u.startsWith('./'));
      if (!falKey && !allLocal) throw new Error('No fal.ai API key found. Set it in Project Settings → Video Generation.');

      const res = await fetch('/api/merge-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: falKey || '', videoUrls, resolution: outputFormat }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const result = await res.json();
      setFinalVideoUrl(result.videoUrl);
      setIsGenerating(false);
      setProgressMessage('');

      if (projectId && result.videoUrl) {
        DB.saveProjectFile(projectId, 'final-video.mp4', result.videoUrl, 'videos').catch(() => {});
      }
    } catch (err: any) {
      setIsGenerating(false);
      setProgressMessage('');
      setError(`Stitch failed: ${err.message}`);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const stepLabels = template.steps;
  const hasVideoKeySet = !!getVideoKey();
  const allSegmentsReady = segments.length > 0 && segments.every(s => s.videoUrl);
  const anySegmentGenerating = segments.some(s => s.isGenerating);

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
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-3">
          {stepLabels.map((label, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className={`flex-1 h-px ${i <= step ? 'bg-[#91569c]' : 'bg-[#ceadd4]'}`} />}
              <button
                onClick={() => { if (i <= step) setStep(i); }}
                className={`flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${i > step ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  i < step ? 'bg-[#91569c] text-white' :
                  i === step ? 'bg-[#91569c] text-white ring-2 ring-[#91569c]/30' :
                  'bg-[#e0d6e3] text-[#888]'
                }`}>
                  {i < step ? <i className="fa-solid fa-check text-[7px]"></i> : i + 1}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                  i <= step ? 'text-[#5c3a62]' : 'text-[#888]'
                }`}>{label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>

        {!hasVideoKeySet && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[10px]"></i>
            <span className="text-[10px] text-amber-700"><strong>Missing API key:</strong> Video Generation</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">

          {/* ═══ STEP 0: Upload Frames ═══ */}
          {step === 0 && (
            <div className="space-y-4 animate-fade-in">
              {/* Output Format */}
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide mb-4">
                  <i className="fa-solid fa-crop text-[#91569c] mr-2"></i>Output Format
                </h2>
                <div className="flex gap-3">
                  {[
                    { value: 'landscape_16_9', label: '16:9 Landscape', icon: 'fa-display' },
                    { value: 'portrait_9_16', label: '9:16 Portrait', icon: 'fa-mobile-screen' },
                    { value: 'square_1_1', label: '1:1 Square', icon: 'fa-square' },
                  ].map(fmt => (
                    <button
                      key={fmt.value}
                      onClick={() => setOutputFormat(fmt.value)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 text-center transition-all ${
                        outputFormat === fmt.value
                          ? 'border-[#91569c] bg-[#f6f0f8] text-[#5c3a62]'
                          : 'border-[#e0d6e3] hover:border-[#ceadd4] text-[#888]'
                      }`}
                    >
                      <i className={`fa-solid ${fmt.icon} text-lg mb-1 block`}></i>
                      <span className="text-[10px] font-bold uppercase">{fmt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Segment Duration */}
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide mb-4">
                  <i className="fa-solid fa-clock text-[#91569c] mr-2"></i>Segment Duration
                </h2>
                <p className="text-[10px] text-[#888] mb-3">
                  How long each video segment between keyframes should be. Longer = smoother transitions, higher cost.
                </p>
                <div className="flex gap-3">
                  {[
                    { value: '5' as const, label: '5 seconds', detail: 'Quick transitions' },
                    { value: '10' as const, label: '10 seconds', detail: 'Smooth, cinematic' },
                  ].map(dur => (
                    <button
                      key={dur.value}
                      onClick={() => setSegmentDuration(dur.value)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 text-center transition-all ${
                        segmentDuration === dur.value
                          ? 'border-[#91569c] bg-[#f6f0f8] text-[#5c3a62]'
                          : 'border-[#e0d6e3] hover:border-[#ceadd4] text-[#888]'
                      }`}
                    >
                      <i className="fa-solid fa-stopwatch text-lg mb-1 block"></i>
                      <span className="text-[10px] font-bold uppercase">{dur.label}</span>
                      <p className="text-[8px] text-[#888] mt-0.5">{dur.detail}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Zone */}
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide mb-2">
                  <i className="fa-solid fa-images text-[#91569c] mr-2"></i>Key Frames
                </h2>
                <p className="text-[10px] text-[#888] mb-4">
                  Upload your keyframe images in sequence. A video segment will be generated between each consecutive pair. Minimum 2 frames required.
                </p>

                <DropZone onFiles={addFiles} accept="image/*" multiple className="mb-4">
                  <div
                    className="border-2 border-dashed border-[#ceadd4] rounded-xl p-8 text-center cursor-pointer hover:border-[#91569c] hover:bg-[#f6f0f8]/50 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-[#ceadd4] mb-2"></i>
                    <p className="text-xs text-[#888]">Drop images here or <span className="text-[#91569c] font-bold">browse</span></p>
                    <p className="text-[9px] text-[#aaa] mt-1">PNG, JPG — any number of frames</p>
                  </div>
                </DropZone>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; }} />

                {/* Frame list — reorderable */}
                {frames.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[#5c3a62] uppercase">{frames.length} frame{frames.length !== 1 ? 's' : ''} loaded</span>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] font-bold text-[#91569c] uppercase hover:underline flex items-center gap-1">
                        <i className="fa-solid fa-plus text-[8px]"></i>Add More
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {frames.map((frame, idx) => (
                        <div
                          key={frame.id}
                          draggable
                          onDragStart={() => setDragIdx(idx)}
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveFrame(dragIdx, idx); setDragIdx(null); }}
                          onDragEnd={() => setDragIdx(null)}
                          className={`relative group rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                            dragIdx === idx ? 'border-[#91569c] opacity-50 scale-95' : 'border-[#e0d6e3] hover:border-[#ceadd4]'
                          }`}
                        >
                          <img src={frame.dataUri} alt={frame.name} className="w-full aspect-video object-cover" />
                          {/* Frame number badge */}
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#91569c] text-white text-[9px] font-bold flex items-center justify-center shadow">
                            {idx + 1}
                          </div>
                          {/* Delete button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFrame(frame.id); }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                          {/* Name */}
                          <div className="px-1.5 py-1 bg-white/90">
                            <p className="text-[8px] text-[#888] truncate">{frame.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-[#aaa] mt-2">
                      <i className="fa-solid fa-grip-dots-vertical mr-1"></i>Drag frames to reorder. The sequence determines the video flow.
                    </p>
                  </div>
                )}
              </div>

              {/* Proceed */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const segs = buildSegments();
                    setSegments(segs);
                    setStep(1);
                  }}
                  disabled={frames.length < 2}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-lg"
                >
                  Generate Videos <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 1: Generate Videos ═══ */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">
                    <i className="fa-solid fa-video text-[#91569c] mr-2"></i>Video Segments
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#888]">
                      {segments.filter(s => s.videoUrl).length}/{segments.length} complete
                    </span>
                    <button
                      onClick={generateAllSegments}
                      disabled={isGenerating || allSegmentsReady}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-play text-[8px]"></i>
                      {segments.some(s => s.videoUrl) ? 'Generate Remaining' : 'Generate All'}
                    </button>
                  </div>
                </div>

                {progressMessage && (
                  <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin text-[#91569c] text-[10px]"></i>
                    <span className="text-[10px] text-[#5c3a62] font-medium">{progressMessage}</span>
                  </div>
                )}

                <div className="space-y-3">
                  {segments.map((seg) => {
                    const startFrame = frames.find(f => f.id === seg.startStageId);
                    const endFrame = frames.find(f => f.id === seg.endStageId);
                    const startIdx = frames.findIndex(f => f.id === seg.startStageId);
                    const endIdx = frames.findIndex(f => f.id === seg.endStageId);

                    return (
                      <div key={seg.id} className="border border-[#e0d6e3] rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          {/* Start frame thumbnail */}
                          <div className="flex-shrink-0 w-20">
                            {startFrame && <img src={startFrame.dataUri} alt="" className="w-full aspect-video object-cover rounded" />}
                            <p className="text-[8px] text-center text-[#888] mt-0.5">Frame {startIdx + 1}</p>
                          </div>

                          {/* Arrow */}
                          <div className="flex-shrink-0 text-[#ceadd4]">
                            <i className="fa-solid fa-arrow-right"></i>
                          </div>

                          {/* End frame thumbnail */}
                          <div className="flex-shrink-0 w-20">
                            {endFrame && <img src={endFrame.dataUri} alt="" className="w-full aspect-video object-cover rounded" />}
                            <p className="text-[8px] text-center text-[#888] mt-0.5">Frame {endIdx + 1}</p>
                          </div>

                          {/* Status / Video preview */}
                          <div className="flex-1 min-w-0">
                            {seg.videoUrl ? (
                              <div>
                                <video src={seg.videoUrl} className="w-full max-w-xs rounded aspect-video object-cover" muted controls />
                                <p className="text-[9px] text-green-600 font-bold mt-1"><i className="fa-solid fa-circle-check mr-1"></i>Complete</p>
                              </div>
                            ) : seg.isGenerating ? (
                              <div className="flex items-center gap-2 text-[#91569c]">
                                <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                                <span className="text-[10px] font-bold">Generating...</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#888]">Pending</span>
                            )}
                          </div>

                          {/* Prompt */}
                          {seg.prompt && (
                            <div className="flex-shrink-0 max-w-[200px]">
                              <p className="text-[8px] text-[#888] line-clamp-3" title={seg.prompt}>{seg.prompt}</p>
                            </div>
                          )}

                          {/* Regenerate button */}
                          <button
                            onClick={() => {
                              setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, videoUrl: undefined } : s));
                              generateSegment({ ...seg, videoUrl: undefined });
                            }}
                            disabled={isGenerating}
                            className="flex-shrink-0 px-2 py-1 rounded text-[9px] font-bold text-[#888] hover:text-[#91569c] border border-[#e0d6e3] hover:border-[#ceadd4] disabled:opacity-40 transition-colors"
                          >
                            <i className="fa-solid fa-rotate-right text-[8px] mr-1"></i>Redo
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                  <i className="fa-solid fa-circle-exclamation mr-1.5"></i>{error}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button onClick={() => setStep(0)} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62]">
                  <i className="fa-solid fa-arrow-left mr-1"></i> Back to Frames
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!allSegmentsReady}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-lg"
                >
                  Stitch <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Stitch ═══ */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-white border border-[#e0d6e3] rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-[#5c3a62] uppercase tracking-wide">
                    <i className="fa-solid fa-film text-[#91569c] mr-2"></i>Final Video
                  </h2>
                  <button
                    onClick={stitchAllSegments}
                    disabled={isGenerating}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-40 transition-colors flex items-center gap-1"
                  >
                    <i className="fa-solid fa-link text-[8px]"></i>
                    {finalVideoUrl ? 'Re-stitch' : 'Stitch Now'}
                  </button>
                </div>

                {progressMessage && (
                  <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin text-[#91569c] text-[10px]"></i>
                    <span className="text-[10px] text-[#5c3a62] font-medium">{progressMessage}</span>
                  </div>
                )}

                {/* Segment thumbnails strip */}
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {segments.map((seg) => (
                    <div key={seg.id} className="text-center">
                      {seg.videoUrl ? (
                        <video src={seg.videoUrl} className="w-full rounded aspect-video object-cover" muted />
                      ) : (
                        <div className="w-full aspect-video bg-[#e0d6e3] rounded flex items-center justify-center">
                          <i className="fa-solid fa-video-slash text-[#ceadd4]"></i>
                        </div>
                      )}
                      <p className="text-[8px] font-bold text-[#5c3a62] mt-1 uppercase">Segment {seg.id}</p>
                    </div>
                  ))}
                </div>

                {finalVideoUrl && (
                  <div className="border-t border-[#e0d6e3] pt-4">
                    <video src={finalVideoUrl} controls className="w-full rounded-lg border border-[#e0d6e3]" style={{ maxHeight: 400 }} />
                    <div className="flex items-center gap-3 mt-2">
                      <a href={projectId ? `/api/db/projects/${projectId}/output-file/final-video.mp4` : finalVideoUrl} download="final-video.mp4"
                        className="text-[10px] font-bold text-[#91569c] uppercase hover:underline flex items-center gap-1">
                        <i className="fa-solid fa-download text-[9px]"></i>Download Final Video
                      </a>
                      {projectId && (
                        <button onClick={() => fetch(`/api/db/projects/${projectId}/open-folder`, { method: 'POST' })}
                          className="text-[10px] font-bold text-[#888] uppercase hover:text-[#5c3a62] flex items-center gap-1">
                          <i className="fa-solid fa-folder-open text-[9px]"></i>Open Output Folder
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
                  <i className="fa-solid fa-circle-exclamation mr-1.5"></i>{error}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button onClick={() => setStep(1)} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#888] hover:text-[#5c3a62]">
                  <i className="fa-solid fa-arrow-left mr-1"></i> Back to Videos
                </button>
                <button onClick={() => onComplete({
                  templateId,
                  step: 2,
                  stages: frames.map((f, i) => ({ id: f.id, label: f.name, prompt: '', imageUrl: f.dataUri })),
                  segments,
                  finalVideoUrl,
                  outputFormat,
                  isGenerating: false,
                  progressMessage: '',
                })} disabled={!finalVideoUrl}
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

export default KeyframesWizard;
