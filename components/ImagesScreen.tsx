import React, { useState, useEffect } from 'react';
import { BrandProfile } from '../types';
import { CharacterBuilder } from './CharacterBuilder';
import { CharacterProfile, loadCharacters, saveCharacters, buildPromptFromTraits } from './characterUtils';
import { generateImageWithCurrentProvider } from '../services/imageProvider';
import { getApiKeyForType } from '../services/geminiService';
import { DB, type Project } from '../services/projectDB';

const saveToProject = async (filename: string, data: string, folder?: string): Promise<string> => {
  const res = await fetch('http://localhost:5182/api/save-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, data, folder }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Save failed');
  return json.path;
};

type ImageStep = 'characters' | 'backgrounds' | 'props' | 'keyvisuals' | 'review';

const STEP_META: { id: ImageStep; label: string; icon: string; num: number }[] = [
  { id: 'characters', label: 'Characters', icon: 'fa-user', num: 4 },
  { id: 'backgrounds', label: 'Backgrounds', icon: 'fa-mountain-sun', num: 5 },
  { id: 'props', label: 'Props & Wardrobe', icon: 'fa-shirt', num: 6 },
  { id: 'keyvisuals', label: 'Key Visuals', icon: 'fa-images', num: 7 },
  { id: 'review', label: 'Review', icon: 'fa-check-double', num: 8 },
];

interface GeneratedAsset {
  id: string;
  type: ImageStep;
  label: string;
  prompt: string;
  imageUrl: string | null;
  isGenerating: boolean;
  charId?: string;
}

interface ImagesScreenProps {
  onBack: () => void;
  brands: BrandProfile[];
  activeBrandId: string;
  activeProject?: Project | null;
}

const STORAGE_KEY = 'tensorax_image_assets';
const IMAGES_MODEL_KEY = 'tensorax_images_model';
const IMAGES_APIKEY_KEY = 'tensorax_images_apiKey';

const loadAssets = (): GeneratedAsset[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const parseScreenplay = (): { scenes: { title: string; scene: string; prompt: string }[] } => {
  const raw = localStorage.getItem('tensorax_screenplay') || '';
  if (!raw) return { scenes: [] };
  const blocks = raw.split(/(?=###\s*Scene\s*\d)/i).filter(b => b.trim());
  return {
    scenes: blocks.map(block => {
      const titleMatch = block.match(/###\s*Scene\s*\d+[:\s\-–]*(.*)/i);
      const sceneMatch = block.match(/\*\*SCENE:\*\*\s*([\s\S]*?)(?=\*\*DIALOGUE:\*\*|$)/i);
      const promptMatch = block.match(/\*\*VIDEO PROMPT:\*\*\s*([\s\S]*?)(?=###|$)/i);
      return {
        title: titleMatch?.[1]?.replace(/\*\*/g, '').trim() || 'Untitled',
        scene: sceneMatch?.[1]?.trim() || '',
        prompt: promptMatch?.[1]?.trim() || '',
      };
    }),
  };
};

const extractCharactersFromScreenplay = (scenes: { title: string; scene: string; prompt: string }[]): string[] => {
  const characterPatterns = /\b(granny|grandma|grandmother|grandad|grandpa|grandfather|uncle|auntie|aunt|mother|father|parent|child|baby|toddler|newborn)\b/gi;
  const found = new Set<string>();
  scenes.forEach(s => {
    const matches = (s.scene + ' ' + s.prompt).matchAll(characterPatterns);
    for (const m of matches) found.add(m[1].toLowerCase());
  });
  return Array.from(found);
};

export const ImagesScreen: React.FC<ImagesScreenProps> = ({ onBack, brands, activeBrandId, activeProject }) => {
  const [step, setStep] = useState<ImageStep>('characters');
  const [assets, setAssets] = useState<GeneratedAsset[]>(loadAssets);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [imgModel, setImgModel] = useState(() => localStorage.getItem(IMAGES_MODEL_KEY) || '');
  const [imgApiKey, setImgApiKey] = useState(() => localStorage.getItem(IMAGES_APIKEY_KEY) || '');
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [characters, setCharacters] = useState<CharacterProfile[]>(loadCharacters);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const assetsRef = React.useRef(assets);
  assetsRef.current = assets;
  const cancelledRef = React.useRef(new Set<string>());

  const screenplay = parseScreenplay();
  const activeBrand = brands.find(b => b.id === activeBrandId);
  const detectedCharacters = extractCharactersFromScreenplay(screenplay.scenes);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    saveCharacters(characters);
  }, [characters]);

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const handleGeneratePrompt = async (_charId: string, rawTraits: string): Promise<string> => {
    stopAllGenerating();
    setIsGeneratingPrompt(true);
    try {
      const apiKey = imgApiKey || getApiKeyForType('image') || getApiKeyForType('copy') || getApiKeyForType('analysis') || '';
      if (!apiKey) throw new Error('No Google AI key found. Set one in Scenes (Image, Copy, or Analysis key) or in the Images robot icon.');

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert at writing prompts for AI image generation (Imagen 3, Midjourney, DALL-E). Convert the following character description into a single, optimised image generation prompt. The prompt should be detailed, cinematic, and photorealistic. Focus on physical appearance, lighting, composition, and mood. Output ONLY the prompt text, nothing else.

Character description:
${rawTraits}`,
      });
      const text = typeof response.text === 'string' ? response.text.trim() : rawTraits;
      return text || rawTraits;
    } catch (err: any) {
      alert(`Prompt generation failed: ${err.message || err}. Using raw traits instead.`);
      return rawTraits;
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCharacterGenerate = (charId: string, prompt: string, label?: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const assetId = addAsset('characters', label || char.name, prompt, charId);
    generateImage(assetId);
  };

  const addAsset = (type: ImageStep, label: string, prompt: string, charId?: string) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setAssets(prev => [...prev, { id, type, label, prompt, imageUrl: null, isGenerating: false, charId }]);
    return id;
  };

  const updateAsset = (id: string, updates: Partial<GeneratedAsset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const generateImage = async (assetId: string) => {
    const asset = assetsRef.current.find(a => a.id === assetId);
    if (!asset) return;

    cancelledRef.current.delete(assetId);
    updateAsset(assetId, { isGenerating: true });
    try {
      const charProfile = characters.find(c => c.name === asset.label);
      const referenceImages: string[] = [];
      if (charProfile?.photoUrls?.length) referenceImages.push(...charProfile.photoUrls);

      const url = await generateImageWithCurrentProvider({
        prompt: asset.prompt,
        size: '1024x1024' as any,
        aspectRatio: '9:16' as any,
        referenceImages,
      });
      if (cancelledRef.current.has(assetId)) return;
      updateAsset(assetId, { imageUrl: url, isGenerating: false });
    } catch (err: any) {
      if (cancelledRef.current.has(assetId)) return;
      updateAsset(assetId, { isGenerating: false });
      alert(`Image generation failed: ${err.message || err}`);
    }
  };

  const stepAssets = assets.filter(a => {
    if (a.type !== step) return false;
    if (step === 'characters' && activeCharId) return a.charId === activeCharId;
    return true;
  });

  const stepIndex = STEP_META.findIndex(s => s.id === step);

  const stopAllGenerating = () => {
    setAssets(prev => {
      prev.forEach(a => { if (a.isGenerating) cancelledRef.current.add(a.id); });
      return prev.map(a => a.isGenerating ? { ...a, isGenerating: false } : a);
    });
  };

  const autoSuggestPrompts = (): { label: string; prompt: string }[] => {
    const brandLine = activeBrand ? `Brand: ${activeBrand.name}. Colours: ${activeBrand.colour}. Typography: ${activeBrand.typography}.` : '';
    if (step === 'backgrounds') {
      const uniqueSettings = new Set<string>();
      screenplay.scenes.forEach(s => {
        if (s.scene) uniqueSettings.add(s.title);
      });
      return Array.from(uniqueSettings).slice(0, 6).map(title => ({
        label: title,
        prompt: `Background scene for "${title}": cinematic environment, warm natural lighting, soft depth of field, suitable for 9:16 vertical video frame. ${brandLine}`.trim(),
      }));
    }
    if (step === 'props') {
      return [
        { label: 'NEXT Gift Card', prompt: `A pristine NEXT gift card with white dot border frame on black background, minimalist, product photography, 9:16 vertical. ${brandLine}`.trim() },
        { label: 'Baby Outfit', prompt: `A folded soft white baby babygrow/sleepsuit on clean white surface, product photography, warm lighting, 9:16 vertical. ${brandLine}`.trim() },
      ];
    }
    if (step === 'keyvisuals') {
      return screenplay.scenes.slice(0, 4).map(s => ({
        label: s.title,
        prompt: s.prompt || `Key visual for scene "${s.title}": ${s.scene.slice(0, 200)}. Cinematic, photorealistic, 9:16 vertical.`,
      }));
    }
    return [];
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#2d2633]">
      <header className="h-12 flex-shrink-0 bg-[#2d2633] border-b border-gray-600/60 flex items-center justify-between px-5 z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-[#91569c]/80 hover:text-[#91569c] transition-colors p-1">
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <h1 className="text-base font-heading font-black tracking-tight uppercase text-white flex items-center gap-0">
            Tensor<span className="text-[#91569c]">ax</span>
            <span className="text-base font-light text-white ml-1.5">Studio</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKeyModal(!showKeyModal)}
            className={`p-1.5 rounded-lg transition-colors relative ${imgApiKey ? 'text-[#91569c]' : 'text-red-400/70 hover:text-red-400'}`}
            title={imgApiKey ? `Image AI: ${imgModel || 'gemini-2.0-flash-exp'}` : 'Set Image AI model & key'}
          >
            <i className="fa-solid fa-robot text-xs"></i>
            {!imgApiKey && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-400 rounded-full"></span>}
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#d4cdd7]/60">Images</span>
        </div>
      </header>

      {showKeyModal && (
        <div className="px-5 py-3 border-b border-[#5c4a63] bg-[#4A4A4A] flex-shrink-0">
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#91569c]">
                <i className="fa-solid fa-robot text-[8px] mr-1"></i>
                Image Generation AI
              </span>
              <button onClick={() => setShowKeyModal(false)} className="text-[#d4cdd7]/40 hover:text-[#d4cdd7]">
                <i className="fa-solid fa-xmark text-[10px]"></i>
              </button>
            </div>
            <div>
              <label className="block text-[8px] font-bold text-[#d4cdd7]/70 uppercase tracking-wide mb-0.5">Model</label>
              <input type="text" value={imgModel} onChange={(e) => setImgModel(e.target.value)} placeholder="gemini-2.0-flash-exp" className="w-full bg-[#3d3444] border border-[#5c4a63] rounded px-2.5 py-1.5 text-[10px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none" />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-[#d4cdd7]/70 uppercase tracking-wide mb-0.5">API Key</label>
              <p className="text-[7px] text-[#d4cdd7]/40 mb-0.5">Google AI key. Leave blank to use the same key as Scenes.</p>
              <input type="password" value={imgApiKey} onChange={(e) => setImgApiKey(e.target.value)} placeholder="Enter your Google AI API key..." className="w-full bg-[#3d3444] border border-[#5c4a63] rounded px-2.5 py-1.5 text-[10px] text-[#edecec] placeholder:text-[#edecec]/50 focus:ring-1 focus:ring-[#91569c]/50 outline-none" />
            </div>
            <button
              onClick={() => {
                localStorage.setItem(IMAGES_MODEL_KEY, imgModel);
                localStorage.setItem(IMAGES_APIKEY_KEY, imgApiKey);
                setShowKeyModal(false);
              }}
              className="w-full mt-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#91569c] text-[#edecec] hover:bg-[#d4af1c] transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-floppy-disk text-[9px]"></i>
              Save
            </button>
            {imgApiKey && (
              <div className="flex items-center gap-1.5 pt-1">
                <i className="fa-solid fa-circle-check text-green-400 text-[8px]"></i>
                <span className="text-[8px] text-green-400/80">Key saved — {imgModel || 'gemini-2.0-flash-exp'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="flex items-center justify-center gap-1 px-4 py-2 flex-shrink-0">
        {STEP_META.map((s, i) => {
          const isActive = s.id === step;
          const hasDone = assets.some(a => a.type === s.id && a.imageUrl);
          return (
            <React.Fragment key={s.id}>
              {i > 0 && <span className="text-[#5c4a63] text-[8px] mx-1">—</span>}
              <button
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider ${
                  isActive ? 'bg-[#91569c] text-[#edecec]' : hasDone ? 'bg-[#3A3A3A] text-[#91569c] border border-[#91569c]/30' : 'bg-[#3A3A3A] text-[#d4cdd7]/60 hover:text-white'
                }`}
              >
                {hasDone && !isActive ? <i className="fa-solid fa-circle-check text-[8px]"></i> : <span className="text-[8px]">{s.num}</span>}
                <span>{s.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="flex flex-1 min-h-0 overflow-hidden px-2 pb-2 gap-2">
        {/* Left: Prompt builder / Character Builder */}
        <aside className="w-[32%] min-w-[280px] max-w-[400px] h-full bg-[#2d2633] border border-[#6b5873] rounded-xl flex flex-col overflow-hidden">
          {step === 'characters' ? (
            <>
              <div className="p-4 border-b border-[#5c4a63] flex-shrink-0">
                <h2 className="text-sm font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <i className="fa-solid fa-user text-[#91569c]"></i>
                  Character Builder
                </h2>
                <p className="text-[9px] text-[#d4cdd7]/50 mt-1">Build each character visually or upload a reference photo.</p>
              </div>
              <CharacterBuilder
                characters={characters}
                onChange={setCharacters}
                detectedNames={detectedCharacters}
                onGeneratePrompt={handleGeneratePrompt}
                onGenerateImage={handleCharacterGenerate}
                onActiveCharChange={setActiveCharId}
                isGeneratingPrompt={isGeneratingPrompt}
                projectName={(() => { try { const d = JSON.parse(localStorage.getItem('tensorax_general_direction') || '{}'); return d.projectName || ''; } catch { return ''; } })()}
              />
            </>
          ) : (
          <>
          <div className="p-4 border-b border-[#5c4a63] flex-shrink-0">
            <h2 className="text-sm font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <i className={`fa-solid ${STEP_META[stepIndex].icon} text-[#91569c]`}></i>
              {STEP_META[stepIndex].label}
            </h2>
            <p className="text-[9px] text-[#d4cdd7]/50 mt-1">
              {step === 'backgrounds' && 'Create backgrounds and environments for your scenes.'}
              {step === 'props' && 'Generate props, wardrobe items, and branded elements.'}
              {step === 'keyvisuals' && 'Create hero images / key frames for each scene.'}
              {step === 'review' && 'Review all generated assets before moving to Scenes.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {screenplay.scenes.length === 0 && (
              <div className="bg-[#3A3A3A] border border-[#4a3a52] rounded-lg p-3">
                <p className="text-[10px] text-[#d4cdd7]/60">
                  <i className="fa-solid fa-triangle-exclamation text-[#91569c] mr-1"></i>
                  No saved screenplay found. Go to Concept &rarr; Finetune &rarr; save your screenplay first.
                </p>
              </div>
            )}

            {step !== 'review' && (
              <>
                <div className="text-[8px] font-black uppercase tracking-wider text-[#d4cdd7]/50 mb-1">
                  <i className="fa-solid fa-wand-magic-sparkles text-[7px] mr-1"></i>
                  Auto-suggested from screenplay
                </div>
                {autoSuggestPrompts().map((sug, i) => {
                  const alreadyAdded = stepAssets.some(a => a.label === sug.label);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!alreadyAdded) addAsset(step, sug.label, sug.prompt);
                      }}
                      disabled={alreadyAdded}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        alreadyAdded
                          ? 'bg-[#3A3A3A] border-[#91569c]/20 text-[#d4cdd7]/40 cursor-not-allowed'
                          : 'bg-[#4A4A4A] border-[#4a3a52] hover:border-[#91569c]/40 text-white'
                      }`}
                    >
                      <span className="text-[10px] font-bold block">{sug.label}</span>
                      <span className="text-[8px] text-[#d4cdd7]/50 block mt-0.5 line-clamp-2">{sug.prompt.slice(0, 100)}...</span>
                      {alreadyAdded && <span className="text-[7px] text-[#91569c]/50 mt-0.5 block"><i className="fa-solid fa-check text-[6px] mr-0.5"></i>Added</span>}
                    </button>
                  );
                })}

                <div className="border-t border-[#5c4a63]/30 pt-3 mt-3">
                  <div className="text-[8px] font-black uppercase tracking-wider text-[#d4cdd7]/50 mb-1.5">
                    <i className="fa-solid fa-plus text-[7px] mr-1"></i>
                    Custom prompt
                  </div>
                  <textarea
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    placeholder="Describe what you want to generate..."
                    rows={3}
                    className="w-full bg-[#3A3A3A] border border-[#4a3a52] rounded-lg p-2.5 text-[10px] text-[#d4cdd7] placeholder:text-[#5c4a63] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
                  />
                  <button
                    onClick={() => {
                      if (promptDraft.trim()) {
                        addAsset(step, `Custom ${step}`, promptDraft.trim());
                        setPromptDraft('');
                      }
                    }}
                    disabled={!promptDraft.trim()}
                    className="mt-2 w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#91569c] text-[#edecec] hover:bg-[#d4af1c] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Add to Queue
                  </button>
                </div>
              </>
            )}
          </div>
          </>
          )}
        </aside>

        {/* Right: Generated assets grid */}
        <main className="flex-1 min-w-0 h-full bg-[#2d2633] border border-[#6b5873] rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#5c4a63] flex-shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-images text-[#91569c]"></i>
              {step === 'review' ? 'All Assets' : `${STEP_META[stepIndex].label} Assets`}
              {stepAssets.length > 0 && <span className="text-[8px] font-normal text-[#d4cdd7]/40 ml-1">({(step === 'review' ? assets : stepAssets).length})</span>}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {(step === 'review' ? assets : stepAssets).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <i className={`fa-solid ${step === 'review' ? 'fa-check-double' : STEP_META[stepIndex].icon} text-4xl text-[#5c4a63] mb-4`}></i>
                <p className="text-[#d4cdd7]/60 text-sm font-bold uppercase tracking-widest mb-2">
                  {step === 'review' ? 'No assets yet' : `No ${STEP_META[stepIndex].label} yet`}
                </p>
                <p className="text-[#d4cdd7]/40 text-xs max-w-md leading-relaxed">
                  {step === 'review'
                    ? 'Generate characters, backgrounds, props, and key visuals in the previous steps.'
                    : 'Use the suggestions on the left or write a custom prompt, then generate.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(step === 'review' ? assets : stepAssets).map(asset => (
                  <div key={asset.id} className="bg-[#4A4A4A] border border-[#4a3a52] rounded-xl overflow-hidden hover:border-[#91569c]/30 transition-colors">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#3A3A3A] border-b border-[#4a3a52]">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#91569c] flex items-center justify-center text-[#edecec] text-[10px] font-black">
                        <i className="fa-solid fa-user text-[8px]"></i>
                      </span>
                      <h4 className="flex-1 text-[12px] font-bold text-white">{asset.label}</h4>
                      {step === 'review' && (
                        <span className="text-[7px] font-black uppercase tracking-wider text-[#91569c]/50 bg-[#91569c]/10 px-1.5 py-0.5 rounded">{asset.type}</span>
                      )}
                      <button onClick={() => deleteAsset(asset.id)} className="text-red-400/40 hover:text-red-400 p-1 transition-colors" title="Delete">
                        <i className="fa-solid fa-trash-can text-[9px]"></i>
                      </button>
                    </div>
                    <div className="flex">
                      {/* Left: prompt */}
                      <div className="flex-1 p-3 border-r border-[#4a3a52]">
                        <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Prompt</span>
                        {editingPrompt === asset.id ? (
                          <div className="space-y-1.5">
                            <textarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} rows={4}
                              className="w-full bg-[#3A3A3A] border border-[#91569c]/30 rounded p-2 text-[9px] text-[#d4cdd7] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y" autoFocus />
                            <div className="flex gap-1.5">
                              <button onClick={() => { updateAsset(asset.id, { prompt: promptDraft }); setEditingPrompt(null); }} className="flex-1 py-1 rounded text-[8px] font-bold uppercase bg-green-500/20 text-green-400 hover:bg-green-500/30">Save</button>
                              <button onClick={() => setEditingPrompt(null)} className="flex-1 py-1 rounded text-[8px] font-bold uppercase bg-[#3A3A3A] text-[#d4cdd7]/60 hover:text-white">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[9px] text-[#d4cdd7]/60 leading-relaxed">{asset.prompt}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <button onClick={() => generateImage(asset.id)} disabled={asset.isGenerating}
                            className="flex-1 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-[#91569c] text-[#edecec] hover:bg-[#d4af1c] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1">
                            <i className={`fa-solid ${asset.isGenerating ? 'fa-spinner fa-spin' : asset.imageUrl ? 'fa-rotate-right' : 'fa-bolt'} text-[7px]`}></i>
                            {asset.isGenerating ? 'Working...' : asset.imageUrl ? 'Regen' : 'Generate Image'}
                          </button>
                          <button onClick={() => { setPromptDraft(asset.prompt); setEditingPrompt(asset.id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#d4cdd7]/50 hover:text-[#91569c] hover:bg-[#3A3A3A] transition-colors" title="Edit prompt">
                            <i className="fa-solid fa-pencil text-[9px]"></i>
                          </button>
                        </div>
                      </div>
                      {/* Right: image */}
                      <div className="w-[180px] flex-shrink-0 bg-[#3A3A3A] flex items-center justify-center relative">
                        {asset.imageUrl ? (
                          <>
                            <img src={asset.imageUrl} alt={asset.label} className="w-full h-full object-cover" />
                            <button
                              onClick={async () => {
                                const proj = (() => { try { return JSON.parse(localStorage.getItem('tensorax_general_direction') || '{}').projectName || 'Project'; } catch { return 'Project'; } })().replace(/\s+/g, '_');
                                const filename = `${proj}_${asset.label.replace(/\s+/g, '_')}.png`;
                                try {
                                  if (activeProject) {
                                    const path = await DB.saveProjectFile(activeProject.id, filename, asset.imageUrl!, 'images').then(r => r.path);
                                    alert(`Saved to project: ${path}`);
                                  } else {
                                    const path = await saveToProject(filename, asset.imageUrl!, `output/${proj}/images`);
                                    alert(`Saved: ${path}`);
                                  }
                                }
                                catch { const a = document.createElement('a'); a.href = asset.imageUrl!; a.download = filename; a.click(); }
                              }}
                              className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-[#edecec]/60 flex items-center justify-center text-[#91569c] hover:bg-[#edecec]/80 transition-colors" title="Save image">
                              <i className="fa-solid fa-floppy-disk text-[9px]"></i>
                            </button>
                          </>
                        ) : asset.isGenerating ? (
                          <div className="text-center">
                            <i className="fa-solid fa-spinner fa-spin text-xl text-[#91569c] mb-1"></i>
                            <p className="text-[8px] text-[#d4cdd7]/40">Generating...</p>
                          </div>
                        ) : (
                          <div className="text-center p-3">
                            <i className="fa-solid fa-image text-xl text-[#5c4a63] mb-1"></i>
                            <p className="text-[7px] text-[#d4cdd7]/30">No image yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
