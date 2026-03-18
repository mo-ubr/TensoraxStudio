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

const loadAssets = (): GeneratedAsset[] => [];

type ParsedScreenplay = { scenes: { title: string; scene: string; prompt: string }[] };

const parseScreenplayText = (raw: string): ParsedScreenplay => {
  if (!raw) return { scenes: [] };
  const blocks = raw.split(/(?=###\s*Scene\s*\d)/i).filter(b => b.trim());
  return {
    scenes: blocks.map(block => {
      const titleMatch = block.match(/###\s*Scene\s*\d+[:\s\-–]*(.*)/i);
      const sceneMatch = block.match(/\*\*SCENE[:\s]*\*\*\s*([\s\S]*?)(?=\*\*DIALOGUE[:\s]*\*\*|$)/i);
      const promptMatch = block.match(/\*\*VIDEO\s*PROMPT[:\s]*\*\*\s*([\s\S]*?)(?=\*\*(?:START|OPENING)\s*FRAME[:\s]*\*\*|###|$)/i);
      return {
        title: titleMatch?.[1]?.replace(/\*\*/g, '').trim() || 'Untitled',
        scene: sceneMatch?.[1]?.trim() || '',
        prompt: promptMatch?.[1]?.trim() || '',
      };
    }),
  };
};


const extractCharactersFromScreenplay = (scenes: { title: string; scene: string; prompt: string }[]): string[] => {
  const characterPatterns = /\b(granny|grandma|grandmother|grandad|grandpa|grandfather|uncle|auntie|aunt|mother|father|woman|man|child|children|baby|toddler|newborn|boy|girl|infant|son|daughter|friend)\b/gi;
  const found = new Set<string>();
  scenes.forEach(s => {
    const matches = (s.scene + ' ' + s.prompt).matchAll(characterPatterns);
    for (const m of matches) {
      let name = m[1].toLowerCase();
      if (CHILD_VARIANTS.has(name)) name = 'child';
      if (!SKIP_ROLES.has(name)) found.add(name);
    }
  });
  return Array.from(found);
};

interface CharacterDescription {
  name: string;
  description: string;
  scenes: string[];
}

const CHILD_VARIANTS = new Set(['child', 'baby', 'toddler', 'newborn', 'boy', 'girl', 'infant', 'son', 'daughter', 'children']);
const SKIP_ROLES = new Set(['teenager', 'teen', 'narrator', 'parent', 'adult']);

const ROLE_PROFILES: Record<string, { age: string; look: string }> = {
  grandma:      { age: '55-62', look: 'warm, soft features, shoulder-length silver-grey hair with gentle waves, reading glasses on a chain, smile lines around blue eyes, wearing a soft lavender cardigan' },
  grandmother:  { age: '55-62', look: 'warm, soft features, shoulder-length silver-grey hair, reading glasses, blue eyes, lavender cardigan' },
  granny:       { age: '55-62', look: 'warm, soft features, silver-grey hair, gentle smile, blue eyes' },
  grandpa:      { age: '60-68', look: 'distinguished, short grey hair neatly combed, square jaw, brown eyes, kind weathered face, wearing a navy knit jumper over collared shirt' },
  grandfather:  { age: '60-68', look: 'distinguished, short grey hair, square jaw, brown eyes, weathered face, navy jumper' },
  grandad:      { age: '60-68', look: 'distinguished, grey hair, brown eyes, kind face, jumper' },
  aunt:         { age: '30-35', look: 'youthful, stylish, long straight dark-blonde hair, green eyes, high cheekbones, slim build, wearing a fitted denim jacket over white blouse' },
  auntie:       { age: '30-35', look: 'youthful, long dark-blonde hair, green eyes, slim, denim jacket' },
  uncle:        { age: '35-42', look: 'friendly, short brown hair, hazel eyes, athletic build, stubble, casual polo shirt' },
  mother:       { age: '30-35', look: 'warm, medium-length auburn hair in a loose bun, hazel eyes, natural makeup, wearing a cream knit sweater' },
  mum:          { age: '30-35', look: 'warm, auburn hair, hazel eyes, cream sweater' },
  father:       { age: '32-38', look: 'dependable, short dark-brown hair, blue-grey eyes, clean-shaven, wearing a casual button-down shirt' },
  dad:          { age: '32-38', look: 'short dark-brown hair, blue-grey eyes, button-down shirt' },
  woman:        { age: '30-35', look: 'confident, medium-length chestnut-brown wavy hair, warm brown eyes, natural freckles across nose, wearing an elegant cream blouse' },
  man:          { age: '35-42', look: 'approachable, sandy-brown hair slightly tousled, light-blue eyes, strong jawline, light stubble, wearing an olive linen shirt with sleeves rolled up' },
  friend:       { age: '28-35', look: 'energetic, short auburn curly hair, bright hazel eyes, friendly open smile showing teeth, wearing a casual navy zip-up jacket' },
  child:        { age: 'newborn to 8-10 years', look: 'light-brown hair with subtle blonde highlights, blue eyes, button nose, fair skin with rosy cheeks' },
};

const extractCharacterDescriptions = (scenes: { title: string; scene: string; prompt: string }[]): CharacterDescription[] => {
  const charMap = new Map<string, { descriptions: string[]; scenes: string[] }>();
  const childAgeAppearances: { age: string; sceneTitle: string; description: string }[] = [];
  const namePatterns = /\b(Grandma|Grandmother|Granny|Grandpa|Grandfather|Grandad|Uncle|Auntie|Aunt|Mother|Father|Mum|Dad|Parent|Woman|Man|Child|Baby|Toddler|Newborn|Teenager|Teen|Boy|Girl|Friend|Narrator|Son|Daughter|Infant)\b/gi;
  const agePatterns = /\b(?:age[d]?\s*)?(\d{1,2})\s*[-–to]*\s*(\d{1,2})?\s*(?:year|month|week)s?\s*old\b|\bnewborn\b|\btoddler\b|\bpre-?teen\b|\bschool[\s-]?age/gi;

  scenes.forEach(s => {
    const fullText = s.scene + ' ' + s.prompt;
    const matches = fullText.matchAll(namePatterns);
    const namesInScene = new Set<string>();
    for (const m of matches) {
      let name = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      if (SKIP_ROLES.has(name.toLowerCase())) continue;
      if (CHILD_VARIANTS.has(name.toLowerCase())) name = 'Child';
      namesInScene.add(name);
    }

    if (namesInScene.has('Child')) {
      const ageMatches = fullText.matchAll(agePatterns);
      for (const am of ageMatches) {
        const ageStr = am[0].toLowerCase();
        if (/teen/i.test(ageStr)) continue;
        const bestSentences = fullText.split(/[.!]\s+/).filter(sent =>
          sent.includes(am[0]) || /child|baby|toddler|newborn/i.test(sent)
        ).slice(0, 2).join('. ');
        childAgeAppearances.push({ age: am[0].trim(), sceneTitle: s.title, description: bestSentences || fullText.slice(0, 300) });
      }
    }

    for (const name of namesInScene) {
      if (name === 'Child') continue;
      if (!charMap.has(name)) charMap.set(name, { descriptions: [], scenes: [] });
      const entry = charMap.get(name)!;
      entry.scenes.push(s.title);
      const sentences = fullText.split(/[.!]\s+/);
      for (const sentence of sentences) {
        if (new RegExp(`\\b${name}\\b`, 'i').test(sentence) && sentence.length > 30) {
          entry.descriptions.push(sentence.trim());
        }
      }
    }
  });

  const results: CharacterDescription[] = [];

  for (const [name, data] of charMap) {
    const bestDesc = data.descriptions.sort((a, b) => b.length - a.length).slice(0, 3).join('. ');
    const profile = ROLE_PROFILES[name.toLowerCase()];
    const profileText = profile ? `EXACT APPEARANCE: Age ${profile.age}. ${profile.look}.` : '';
    const fullDesc = [bestDesc, profileText].filter(Boolean).join('. ');
    if (fullDesc) results.push({ name, description: fullDesc, scenes: data.scenes });
  }

  const seenAges = new Set<string>();
  if (childAgeAppearances.length > 0) {
    for (const appearance of childAgeAppearances) {
      const ageKey = appearance.age.replace(/\s+/g, ' ').toLowerCase();
      if (seenAges.has(ageKey)) continue;
      seenAges.add(ageKey);
      results.push({
        name: `Child — ${appearance.age}`,
        description: `${appearance.description}. THIS IS THE SAME CHILD at age ${appearance.age}. Generate a portrait showing the child at exactly this age with age-appropriate features, body proportions, and clothing.`,
        scenes: [appearance.sceneTitle],
      });
    }
  } else {
    results.push({
      name: 'Child — newborn',
      description: 'A newborn baby (0-1 months). THIS IS THE SAME CHILD as all other child images — show age-appropriate newborn features.',
      scenes: ['Scene 1'],
    });
    results.push({
      name: 'Child — 2-3 years',
      description: 'A toddler (2-3 years old). THIS IS THE SAME CHILD — show age-appropriate toddler features, walking, curious expression.',
      scenes: ['Scene 2'],
    });
    results.push({
      name: 'Child — 5-6 years',
      description: 'A young child (5-6 years old). THIS IS THE SAME CHILD — show age-appropriate features, confident, active.',
      scenes: ['Scene 3'],
    });
  }

  return results;
};

export const ImagesScreen: React.FC<ImagesScreenProps> = ({ onBack, brands, activeBrandId, activeProject }) => {
  const [step, setStep] = useState<ImageStep>('characters');
  const [charMode, setCharMode] = useState<'list' | 'builder'>('list');
  const [selectedCharForBuilder, setSelectedCharForBuilder] = useState<string | null>(null);
  const [charBuilderAction, setCharBuilderAction] = useState<'auto' | 'upload' | 'specify' | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>(loadAssets);
  const [charBrief, setCharBrief] = useState('Caucasian family, single character, green screen background');
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [characters, setCharacters] = useState<CharacterProfile[]>(loadCharacters);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const assetsRef = React.useRef(assets);
  assetsRef.current = assets;
  const cancelledRef = React.useRef(new Set<string>());
  const [screenplay, setScreenplay] = useState<ParsedScreenplay>({ scenes: [] });

  useEffect(() => {
    if (!activeProject) return;
    DB.getMetadata(activeProject.id)
      .then(meta => {
        if (meta.screenplay && typeof meta.screenplay === 'string') {
          setScreenplay(parseScreenplayText(meta.screenplay));
        }
      })
      .catch(() => {});
  }, [activeProject?.id]);

  const activeBrand = brands.find(b => b.id === activeBrandId);
  const detectedCharacters = extractCharactersFromScreenplay(screenplay.scenes);


  useEffect(() => {
    saveCharacters(characters);
  }, [characters]);

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const handleGeneratePrompt = async (_charId: string, rawTraits: string): Promise<string> => {
    stopAllGenerating();
    setIsGeneratingPrompt(true);
    try {
      const apiKey = getApiKeyForType('image') || getApiKeyForType('analysis') || '';
      if (!apiKey) throw new Error('No Google AI key found. Set one in Project Settings → Image Generation.');

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

  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenProgress, setAutoGenProgress] = useState('');

  const handleAutoGenerateAll = async () => {
    const charDescs = extractCharacterDescriptions(screenplay.scenes);
    if (charDescs.length === 0) {
      alert('No characters found in the screenplay. Generate a screenplay first.');
      return;
    }

    const apiKey = getApiKeyForType('image') || getApiKeyForType('analysis') || '';
    if (!apiKey) {
      alert('Set a Google AI API key in Project Settings → Image Generation.');
      return;
    }

    setIsAutoGenerating(true);

    // Clear old auto-generated assets
    setAssets(prev => prev.filter(a => a.type !== 'characters'));
    assetsRef.current = assetsRef.current.filter(a => a.type !== 'characters');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const brief = charBrief.trim();

    // Create/update character profiles
    const charProfiles: CharacterProfile[] = [];
    for (const desc of charDescs) {
      const existing = characters.find(c => c.name.toLowerCase() === desc.name.toLowerCase());
      if (existing) {
        charProfiles.push(existing);
      } else {
        charProfiles.push({
          id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: desc.name, photoUrls: [], wardrobeUrls: [],
          traits: { gender: '', ageRange: '', ethnicity: '', build: '', faceShape: '', skinTone: '', hairLength: '', hairTexture: '', hairColour: '', eyeShape: '', eyeColour: '', noseShape: '', lipShape: '', distinguishing: '' },
          source: 'new',
        });
      }
    }
    setCharacters(charProfiles);

    for (let i = 0; i < charDescs.length; i++) {
      const desc = charDescs[i];
      const char = charProfiles[i];

      // Step 1: Generate prompt
      setAutoGenProgress(`Writing prompt for ${desc.name} (${i + 1}/${charDescs.length})...`);
      let prompt = '';
      try {
        const castingBrief = brief || 'Caucasian family, single character, green screen background';
        const isChildAge = desc.name.startsWith('Child —');
        const profile = ROLE_PROFILES[desc.name.toLowerCase()] || (isChildAge ? ROLE_PROFILES['child'] : null);
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Write a single AI image generation prompt for a character portrait based on a screenplay.

CHARACTER: ${desc.name}
SCREENPLAY SCENE: ${desc.scenes.join(', ')}
${profile ? `\nMANDATORY PHYSICAL APPEARANCE (use EXACTLY these features — do NOT change them):
Age: ${profile.age}
Look: ${profile.look}` : ''}

SCREENPLAY CONTEXT (use for clothing, expression, pose ONLY):
${desc.description}

CASTING DIRECTION: ${castingBrief}

CRITICAL RULES:
1. Ethnicity: MUST be Caucasian/White European. No exceptions.
2. Physical features: Use the MANDATORY PHYSICAL APPEARANCE above exactly — hair colour, eye colour, build, distinguishing features. Each character MUST look like a DIFFERENT person.
3. Only ONE person in frame.
4. Clothing: From the screenplay description.
5. Age: ${isChildAge ? `EXACTLY ${desc.name.replace('Child — ', '')}. Correct body proportions for this age.` : profile ? `${profile.age} years old.` : 'As described.'}
6. Background: ${castingBrief.includes('green screen') ? 'Plain green screen.' : 'As specified.'}
7. Format: Photorealistic cinematic portrait, 9:16 vertical, high detail face.

Output ONLY the prompt. No explanations.`,
        });
        prompt = typeof response.text === 'string' ? response.text.trim() : '';
      } catch (err: any) {
        console.error(`Prompt gen failed for ${desc.name}:`, err);
        const fb = brief || 'Caucasian family, single character, green screen background';
        prompt = `Photorealistic cinematic portrait of ${desc.name}. ${fb}. Single person only, nobody else in frame. 9:16 vertical format, high detail facial features.`;
      }

      if (!prompt) {
        const fb = brief || 'Caucasian family, single character, green screen background';
        prompt = `Photorealistic cinematic portrait of ${desc.name}. ${fb}. Single person only, nobody else in frame. 9:16 vertical format, high detail facial features.`;
      }

      // Step 2: Create asset and generate image
      setAutoGenProgress(`Generating image for ${desc.name} (${i + 1}/${charDescs.length})...`);
      const assetId = `characters-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setAssets(prev => [...prev, { id: assetId, type: 'characters' as ImageStep, label: char.name, prompt, imageUrl: null, isGenerating: true, charId: char.id }]);

      try {
        const url = await generateImageWithCurrentProvider({
          prompt,
          size: '1024x1024' as any,
          aspectRatio: '9:16' as any,
          referenceImages: [],
        });
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, imageUrl: url, isGenerating: false } : a));

        if (activeProject && url) {
          const filename = `${desc.name.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_')}.png`;
          DB.saveProjectFile(activeProject.id, filename, url, 'characters').catch(e => console.warn('[AutoGen] Save failed:', e));
        }
      } catch (imgErr: any) {
        console.error(`Image gen failed for ${desc.name}:`, imgErr);
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, isGenerating: false } : a));
      }

      await new Promise(r => setTimeout(r, 200));
    }

    setIsAutoGenerating(false);
    setAutoGenProgress('');
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

      if (activeProject && url) {
        const filename = `${asset.label.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_')}.png`;
        DB.saveProjectFile(activeProject.id, filename, url, 'characters').catch(e => console.warn('[Images] Auto-save failed:', e));
      }
    } catch (err: any) {
      if (cancelledRef.current.has(assetId)) return;
      updateAsset(assetId, { isGenerating: false });
      alert(`Image generation failed: ${err.message || err}`);
    }
  };

  const stepAssets = assets.filter(a => {
    if (a.type !== step) return false;
    if (step === 'characters' && charMode === 'builder' && activeCharId) return a.charId === activeCharId;
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
    <div className="flex flex-col h-screen overflow-hidden bg-[#edecec]">
      <header className="h-12 flex-shrink-0 bg-[#edecec] border-b border-[#e0d6e3]/60 flex items-center justify-between px-5 z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-[#91569c]/80 hover:text-[#91569c] transition-colors p-1">
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </button>
          <h1 className="text-base font-heading font-black tracking-tight uppercase text-[#5c3a62] flex items-center gap-0">
            Tensor<span className="text-[#91569c]">ax</span>
            <span className="text-base font-light text-[#5c3a62] ml-1.5">Studio</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {(() => {
            const hasKey = !!(getApiKeyForType('image') || getApiKeyForType('analysis'));
            const model = (() => { try { return localStorage.getItem('tensorax_image_model')?.trim() || 'gemini-3-flash-image'; } catch { return 'gemini-3-flash-image'; } })();
            return (
              <span className={`text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 ${hasKey ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                <i className={`fa-solid ${hasKey ? 'fa-circle-check' : 'fa-circle-xmark'} text-[7px]`}></i>
                {model}
              </span>
            );
          })()}
          <span className="text-[10px] font-black uppercase tracking-widest text-[#888]/60">Images</span>
        </div>
      </header>

      <nav className="flex items-center justify-center gap-1 px-4 py-2 flex-shrink-0">
        {STEP_META.map((s, i) => {
          const isActive = s.id === step;
          const hasDone = assets.some(a => a.type === s.id && a.imageUrl);
          return (
            <React.Fragment key={s.id}>
              {i > 0 && <span className="text-[#ceadd4] text-[8px] mx-1">—</span>}
              <button
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider ${
                  isActive ? 'bg-[#91569c] text-[#3a3a3a]' : hasDone ? 'bg-[#f6f0f8] text-[#91569c] border border-[#91569c]/30' : 'bg-[#f6f0f8] text-[#888]/60 hover:text-[#5c3a62]'
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
        <aside className="w-[32%] min-w-[280px] max-w-[400px] h-full bg-[#edecec] border border-[#e0d6e3] rounded-xl flex flex-col overflow-hidden">
          {step === 'characters' ? (
            <>
              <div className="p-4 border-b border-[#ceadd4] flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
                    <i className="fa-solid fa-user text-[#91569c]"></i>
                    {charMode === 'list' ? 'Characters' : 'Character Builder'}
                  </h2>
                  {charMode === 'builder' && (
                    <button
                      onClick={() => { setCharMode('list'); setSelectedCharForBuilder(null); setCharBuilderAction(null); }}
                      className="text-[9px] font-bold uppercase tracking-wider text-[#888]/60 hover:text-[#91569c] transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-arrow-left text-[8px]"></i>
                      Character List
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-[#888]/50 mt-1">
                  {charMode === 'list' ? 'Characters from your screenplay. Choose how to create each one.' : 'Build the character visually or upload a reference photo.'}
                </p>
              </div>

              {charMode === 'list' ? (
                /* ── Character List View ────────────────────────── */
                <div className="flex-1 overflow-y-auto">
                  {/* Auto-generate all bar */}
                  {screenplay.scenes.length > 0 && (
                    <div className="p-3 border-b border-[#ceadd4] bg-[#f6f0f8]/50 space-y-2">
                      <div>
                        <label className="block text-[8px] font-black text-[#888] uppercase tracking-wider mb-1">Character Brief</label>
                        <input
                          type="text"
                          value={charBrief}
                          onChange={(e) => setCharBrief(e.target.value)}
                          placeholder="e.g. Caucasian family, diverse cast, Asian family..."
                          className="w-full bg-white border border-[#ceadd4] rounded-lg px-3 py-1.5 text-[10px] text-[#3a3a3a] placeholder:text-[#888]/40 outline-none focus:ring-1 focus:ring-[#91569c]/30"
                        />
                      </div>
                      <button
                        onClick={handleAutoGenerateAll}
                        disabled={isAutoGenerating}
                        className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                      >
                        <i className={`fa-solid ${isAutoGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[9px]`}></i>
                        {isAutoGenerating ? autoGenProgress : 'Auto-Generate All Characters'}
                      </button>
                    </div>
                  )}

                  {/* Character list */}
                  <div className="p-3 space-y-2">
                    {(() => {
                      const charNames = extractCharactersFromScreenplay(screenplay.scenes);
                      const screenplayChars = charNames.map(name => ({ name: name.charAt(0).toUpperCase() + name.slice(1), scenes: [] as string[] }));
                      if (screenplayChars.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <i className="fa-solid fa-users-slash text-2xl text-[#ceadd4] mb-2 block"></i>
                            <p className="text-[10px] text-[#888]/60">No characters found in screenplay.</p>
                            <button
                              onClick={() => setCharMode('builder')}
                              className="mt-3 px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#f6f0f8] border border-[#ceadd4] text-[#5c3a62] hover:border-[#91569c]/40 transition-colors"
                            >
                              <i className="fa-solid fa-plus text-[8px] mr-1"></i>
                              Add Manually
                            </button>
                          </div>
                        );
                      }
                      return screenplayChars.map((char, idx) => {
                        const hasAsset = assets.some(a => a.type === 'characters' && a.label.toLowerCase() === char.name.toLowerCase() && a.imageUrl);
                        return (
                          <div key={idx} className="bg-white border border-[#e0d6e3] rounded-xl p-3 hover:border-[#91569c]/30 transition-colors">
                            <div className="flex items-center gap-3 mb-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${hasAsset ? 'bg-green-50 border border-green-200' : 'bg-[#f6f0f8] border border-[#ceadd4]'}`}>
                                <i className={`fa-solid ${hasAsset ? 'fa-check text-green-500' : 'fa-user text-[#91569c]'} text-[11px]`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-[#5c3a62]">{char.name}</p>
                                {char.scenes.length > 0 && (
                                  <p className="text-[8px] text-[#888]/60 mt-0.5 truncate">
                                    {char.scenes.length} scene{char.scenes.length !== 1 ? 's' : ''}: {char.scenes.slice(0, 3).join(', ')}{char.scenes.length > 3 ? '...' : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={async () => {
                                  // Auto-generate this single character — stay on list view, show in middle
                                  const charDescs = extractCharacterDescriptions(screenplay.scenes);
                                  const desc = charDescs.find(d => d.name.toLowerCase() === char.name.toLowerCase());
                                  const brief = charBrief.trim();
                                  const profile = ROLE_PROFILES[char.name.toLowerCase()];
                                  const profileText = profile ? `EXACT APPEARANCE: Age ${profile.age}. ${profile.look}.` : '';
                                  const descText = desc?.description || '';
                                  const rawPrompt = [brief, descText, profileText, `Photorealistic cinematic portrait of ${char.name}. Single person only. 9:16 vertical format, high detail facial features.`].filter(Boolean).join('. ');

                                  // Ensure character profile exists
                                  const existing = characters.find(c => c.name.toLowerCase() === char.name.toLowerCase());
                                  const charId = existing?.id || `char-${Date.now()}-${idx}`;
                                  if (!existing) {
                                    const newChar: CharacterProfile = { id: charId, name: char.name, photoUrls: [], wardrobeUrls: [], traits: { gender: '', ageRange: '', ethnicity: '', build: '', faceShape: '', skinTone: '', hairLength: '', hairTexture: '', hairColour: '', eyeShape: '', eyeColour: '', noseShape: '', lipShape: '', distinguishing: '' }, source: 'new' };
                                    setCharacters(prev => [...prev, newChar]);
                                  }

                                  // Generate prompt via AI
                                  const prompt = await handleGeneratePrompt(charId, rawPrompt);

                                  // Create asset and generate image directly (bypass handleCharacterGenerate)
                                  const assetId = `characters-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                                  setAssets(prev => [...prev, { id: assetId, type: 'characters' as ImageStep, label: char.name, prompt, imageUrl: null, isGenerating: true, charId }]);
                                  try {
                                    const url = await generateImageWithCurrentProvider({
                                      prompt,
                                      size: '1024x1024' as any,
                                      aspectRatio: '9:16' as any,
                                      referenceImages: [],
                                    });
                                    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, imageUrl: url, isGenerating: false } : a));
                                    if (activeProject && url) {
                                      const filename = `${char.name.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_')}.png`;
                                      DB.saveProjectFile(activeProject.id, filename, url, 'characters').catch(e => console.warn('[CharGen] Save failed:', e));
                                    }
                                  } catch (err: any) {
                                    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, isGenerating: false } : a));
                                    alert(`Image generation failed: ${err.message || err}`);
                                  }
                                }}
                                className="flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#91569c] text-white hover:bg-[#5c3a62] transition-colors flex items-center justify-center gap-1.5"
                              >
                                <i className="fa-solid fa-wand-magic-sparkles text-[8px]"></i>
                                Generate
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCharForBuilder(char.name);
                                  setCharBuilderAction('upload');
                                  setCharMode('builder');
                                  // Ensure character profile exists and set to 'existing' source
                                  const existing = characters.find(c => c.name.toLowerCase() === char.name.toLowerCase());
                                  if (!existing) {
                                    const newChar: CharacterProfile = { id: `char-${Date.now()}-${idx}`, name: char.name, photoUrls: [], wardrobeUrls: [], traits: { gender: '', ageRange: '', ethnicity: '', build: '', faceShape: '', skinTone: '', hairLength: '', hairTexture: '', hairColour: '', eyeShape: '', eyeColour: '', noseShape: '', lipShape: '', distinguishing: '' }, source: 'existing' };
                                    setCharacters(prev => [...prev, newChar]);
                                  }
                                  setActiveCharId(existing?.id || `char-${Date.now()}-${idx}`);
                                }}
                                className="flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#f6f0f8] border border-[#ceadd4] text-[#5c3a62] hover:border-[#91569c]/40 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <i className="fa-solid fa-upload text-[8px]"></i>
                                Upload
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCharForBuilder(char.name);
                                  setCharBuilderAction('specify');
                                  setCharMode('builder');
                                  // Ensure character profile exists and set to 'new' source
                                  const existing = characters.find(c => c.name.toLowerCase() === char.name.toLowerCase());
                                  if (!existing) {
                                    const newChar: CharacterProfile = { id: `char-${Date.now()}-${idx}`, name: char.name, photoUrls: [], wardrobeUrls: [], traits: { gender: '', ageRange: '', ethnicity: '', build: '', faceShape: '', skinTone: '', hairLength: '', hairTexture: '', hairColour: '', eyeShape: '', eyeColour: '', noseShape: '', lipShape: '', distinguishing: '' }, source: 'new' };
                                    setCharacters(prev => [...prev, newChar]);
                                  }
                                  setActiveCharId(existing?.id || `char-${Date.now()}-${idx}`);
                                }}
                                className="flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#f6f0f8] border border-[#ceadd4] text-[#5c3a62] hover:border-[#91569c]/40 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <i className="fa-solid fa-sliders text-[8px]"></i>
                                Specify
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                /* ── Character Builder View ─────────────────────── */
                <>
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
              )}
            </>
          ) : (
          <>
          <div className="p-4 border-b border-[#ceadd4] flex-shrink-0">
            <h2 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
              <i className={`fa-solid ${STEP_META[stepIndex].icon} text-[#91569c]`}></i>
              {STEP_META[stepIndex].label}
            </h2>
            <p className="text-[9px] text-[#888]/50 mt-1">
              {step === 'backgrounds' && 'Create backgrounds and environments for your scenes.'}
              {step === 'props' && 'Generate props, wardrobe items, and branded elements.'}
              {step === 'keyvisuals' && 'Create hero images / key frames for each scene.'}
              {step === 'review' && 'Review all generated assets before moving to Scenes.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {screenplay.scenes.length === 0 && (
              <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg p-3">
                <p className="text-[10px] text-[#888]/60">
                  <i className="fa-solid fa-triangle-exclamation text-[#91569c] mr-1"></i>
                  No saved screenplay found. Go to Concept &rarr; Finetune &rarr; save your screenplay first.
                </p>
              </div>
            )}

            {step !== 'review' && (
              <>
                <div className="text-[8px] font-black uppercase tracking-wider text-[#888]/50 mb-1">
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
                          ? 'bg-[#f6f0f8] border-[#91569c]/20 text-[#888]/40 cursor-not-allowed'
                          : 'bg-[#f6f0f8] border-[#ceadd4] hover:border-[#91569c]/40 text-[#5c3a62]'
                      }`}
                    >
                      <span className="text-[10px] font-bold block">{sug.label}</span>
                      <span className="text-[8px] text-[#888]/50 block mt-0.5 line-clamp-2">{sug.prompt.slice(0, 100)}...</span>
                      {alreadyAdded && <span className="text-[7px] text-[#91569c]/50 mt-0.5 block"><i className="fa-solid fa-check text-[6px] mr-0.5"></i>Added</span>}
                    </button>
                  );
                })}

                <div className="border-t border-[#ceadd4]/30 pt-3 mt-3">
                  <div className="text-[8px] font-black uppercase tracking-wider text-[#888]/50 mb-1.5">
                    <i className="fa-solid fa-plus text-[7px] mr-1"></i>
                    Custom prompt
                  </div>
                  <textarea
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    placeholder="Describe what you want to generate..."
                    rows={3}
                    className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg p-2.5 text-[10px] text-[#888] placeholder:text-[#ceadd4] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
                  />
                  <button
                    onClick={() => {
                      if (promptDraft.trim()) {
                        addAsset(step, `Custom ${step}`, promptDraft.trim());
                        setPromptDraft('');
                      }
                    }}
                    disabled={!promptDraft.trim()}
                    className="mt-2 w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#91569c] text-[#3a3a3a] hover:bg-[#d4af1c] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
        <main className="flex-1 min-w-0 h-full bg-[#edecec] border border-[#e0d6e3] rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#ceadd4] flex-shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-heading font-bold text-[#5c3a62] uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-images text-[#91569c]"></i>
              {step === 'review' ? 'All Assets' : `${STEP_META[stepIndex].label} Assets`}
              {stepAssets.length > 0 && <span className="text-[8px] font-normal text-[#888]/40 ml-1">({(step === 'review' ? assets : stepAssets).length})</span>}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {(step === 'review' ? assets : stepAssets).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <i className={`fa-solid ${step === 'characters' ? 'fa-users' : step === 'review' ? 'fa-check-double' : STEP_META[stepIndex].icon} text-4xl text-[#ceadd4] mb-4`}></i>
                <p className="text-[#888]/60 text-sm font-bold uppercase tracking-widest mb-2">
                  {step === 'review' ? 'No assets yet' : step === 'characters' ? 'Generate characters' : `No ${STEP_META[stepIndex].label} yet`}
                </p>
                <p className="text-[#888]/40 text-xs max-w-md leading-relaxed">
                  {step === 'review'
                    ? 'Generate characters, backgrounds, props, and key visuals in the previous steps.'
                    : step === 'characters'
                    ? 'Click Generate next to a character on the left to create their image, or use Auto-Generate All.'
                    : 'Use the suggestions on the left or write a custom prompt, then generate.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(step === 'review' ? assets : stepAssets).map(asset => (
                  <div key={asset.id} className="bg-[#f6f0f8] border border-[#ceadd4] rounded-xl overflow-hidden hover:border-[#91569c]/30 transition-colors">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f6f0f8] border-b border-[#ceadd4]">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#91569c] flex items-center justify-center text-[#3a3a3a] text-[10px] font-black">
                        <i className="fa-solid fa-user text-[8px]"></i>
                      </span>
                      <h4 className="flex-1 text-[12px] font-bold text-[#5c3a62]">{asset.label}</h4>
                      {step === 'review' && (
                        <span className="text-[7px] font-black uppercase tracking-wider text-[#91569c]/50 bg-[#91569c]/10 px-1.5 py-0.5 rounded">{asset.type}</span>
                      )}
                      <button onClick={() => deleteAsset(asset.id)} className="text-red-400/40 hover:text-red-400 p-1 transition-colors" title="Delete">
                        <i className="fa-solid fa-trash-can text-[9px]"></i>
                      </button>
                    </div>
                    <div className="flex">
                      {/* Left: prompt */}
                      <div className="flex-1 p-3 border-r border-[#ceadd4]">
                        <span className="text-[8px] font-black uppercase tracking-wider text-[#91569c] block mb-1.5">Prompt</span>
                        {editingPrompt === asset.id ? (
                          <div className="space-y-1.5">
                            <textarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} rows={4}
                              className="w-full bg-[#f6f0f8] border border-[#91569c]/30 rounded p-2 text-[9px] text-[#888] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y" autoFocus />
                            <div className="flex gap-1.5">
                              <button onClick={() => { updateAsset(asset.id, { prompt: promptDraft }); setEditingPrompt(null); }} className="flex-1 py-1 rounded text-[8px] font-bold uppercase bg-green-500/20 text-green-400 hover:bg-green-500/30">Save</button>
                              <button onClick={() => setEditingPrompt(null)} className="flex-1 py-1 rounded text-[8px] font-bold uppercase bg-[#f6f0f8] text-[#888]/60 hover:text-[#5c3a62]">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[9px] text-[#888]/60 leading-relaxed">{asset.prompt}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <button onClick={() => generateImage(asset.id)} disabled={asset.isGenerating}
                            className="flex-1 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1">
                            <i className={`fa-solid ${asset.isGenerating ? 'fa-spinner fa-spin' : asset.imageUrl ? 'fa-rotate-right' : 'fa-bolt'} text-[7px]`}></i>
                            {asset.isGenerating ? 'Working...' : asset.imageUrl ? 'Regen' : 'Generate Image'}
                          </button>
                          <button onClick={() => { setPromptDraft(asset.prompt); setEditingPrompt(asset.id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#888]/50 hover:text-[#91569c] hover:bg-[#f6f0f8] transition-colors" title="Edit prompt">
                            <i className="fa-solid fa-pencil text-[9px]"></i>
                          </button>
                        </div>
                      </div>
                      {/* Right: image */}
                      <div className="w-[180px] flex-shrink-0 bg-[#f6f0f8] flex items-center justify-center relative">
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
                            <p className="text-[8px] text-[#888]/40">Generating...</p>
                          </div>
                        ) : (
                          <div className="text-center p-3">
                            <i className="fa-solid fa-image text-xl text-[#ceadd4] mb-1"></i>
                            <p className="text-[7px] text-[#888]/30">No image yet</p>
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
