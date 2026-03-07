import React, { useState, useRef, useEffect } from 'react';
import { CharacterProfile, CharacterTraits, emptyTraits, buildPromptFromTraits } from './characterUtils';
export type { CharacterProfile } from './characterUtils';
export { buildPromptFromTraits, loadCharacters, saveCharacters } from './characterUtils';

interface CharacterFile { name: string; path: string; size: number; modified: string; }

interface TraitOption { value: string; label: string; colour?: string; svg?: string; }

const S = (d: string, w = 28, h = 28) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${d}</svg>`;

const FACE = {
  oval:     S('<ellipse cx="14" cy="14" rx="9" ry="12"/>'),
  round:    S('<circle cx="14" cy="14" r="11"/>'),
  square:   S('<rect x="3" y="3" width="22" height="22" rx="3"/>'),
  heart:    S('<path d="M14 25 C5 18 2 12 5 7 C8 3 14 5 14 9 C14 5 20 3 23 7 C26 12 23 18 14 25Z"/>'),
  oblong:   S('<rect x="6" y="2" width="16" height="24" rx="8"/>'),
  diamond:  S('<path d="M14 2 L25 14 L14 26 L3 14Z"/>'),
  triangle: S('<path d="M14 3 L25 25 L3 25Z"/>'),
};
const EYE = {
  almond:    S('<path d="M3 14 Q14 4 25 14 Q14 24 3 14Z"/><circle cx="14" cy="14" r="3" fill="currentColor"/>'),
  round:     S('<ellipse cx="14" cy="14" rx="10" ry="9"/><circle cx="14" cy="14" r="4" fill="currentColor"/>'),
  hooded:    S('<path d="M3 16 Q14 6 25 16"/><path d="M3 16 Q14 22 25 16"/><circle cx="14" cy="16" r="3" fill="currentColor"/>'),
  deepset:   S('<path d="M5 12 Q14 6 23 12"/><path d="M5 12 Q14 20 23 12"/><circle cx="14" cy="12" r="2.5" fill="currentColor"/>'),
  upturned:  S('<path d="M3 16 Q14 6 25 12"/><path d="M3 16 Q14 22 25 12"/><circle cx="15" cy="14" r="3" fill="currentColor"/>'),
  downturned:S('<path d="M3 12 Q14 6 25 16"/><path d="M3 12 Q14 22 25 16"/><circle cx="13" cy="14" r="3" fill="currentColor"/>'),
  monolid:   S('<path d="M3 14 Q14 8 25 14 Q14 20 3 14Z"/><circle cx="14" cy="14" r="3" fill="currentColor"/>'),
  narrowset: S('<path d="M4 14 Q9 8 14 14 Q9 20 4 14Z"/><circle cx="9" cy="14" r="2" fill="currentColor"/><path d="M14 14 Q19 8 24 14 Q19 20 14 14Z"/><circle cx="19" cy="14" r="2" fill="currentColor"/>'),
  wideset:   S('<path d="M0 14 Q5 7 10 14 Q5 21 0 14Z"/><circle cx="5" cy="14" r="2" fill="currentColor"/><path d="M18 14 Q23 7 28 14 Q23 21 18 14Z"/><circle cx="23" cy="14" r="2" fill="currentColor"/>'),
};
const NOSE = {
  straight:  S('<path d="M14 4 L14 20 M10 22 Q14 25 18 22"/>'),
  button:    S('<path d="M14 6 L14 16"/><circle cx="14" cy="19" r="3"/>'),
  broad:     S('<path d="M14 4 L14 18 M7 22 Q14 26 21 22"/>'),
  aquiline:  S('<path d="M14 4 Q18 12 14 20 M10 22 Q14 25 18 22"/>'),
  snub:      S('<path d="M14 6 Q12 14 15 17"/><path d="M10 21 Q14 24 18 21"/>'),
  hawk:      S('<path d="M13 4 Q18 10 16 16 L14 20 M9 22 Q14 26 19 22"/>'),
  flat:      S('<path d="M14 8 L14 18 M9 20 L19 20"/>'),
};
const LIPS = {
  thin:      S('<path d="M6 13 Q14 10 22 13 Q14 16 6 13"/>'),
  medium:    S('<path d="M6 12 Q10 9 14 11 Q18 9 22 12"/><path d="M6 12 Q14 18 22 12"/>'),
  full:      S('<path d="M6 11 Q10 7 14 10 Q18 7 22 11"/><path d="M6 11 Q14 22 22 11"/>'),
  cupid:     S('<path d="M6 12 Q10 8 12 11 L14 9 L16 11 Q18 8 22 12"/><path d="M6 12 Q14 20 22 12"/>'),
  wide:      S('<path d="M3 13 Q14 8 25 13 Q14 18 3 13"/>'),
  downturned:S('<path d="M6 11 Q14 8 22 11"/><path d="M6 11 Q10 17 14 15 Q18 17 22 11"/>'),
};
const HAIR = {
  bald:      S('<path d="M7 18 Q7 4 14 4 Q21 4 21 18"/><line x1="7" y1="18" x2="21" y2="18"/>'),
  buzz:      S('<path d="M7 18 Q7 4 14 4 Q21 4 21 18" stroke-dasharray="1 1.5"/>'),
  short:     S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M6 16 Q6 3 14 2 Q22 3 22 16" stroke-width="2"/>'),
  medium:    S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M5 14 Q4 4 14 2 Q24 4 23 14 L24 22" stroke-width="2"/>'),
  longstr:   S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M5 12 Q4 4 14 2 Q24 4 23 12 L24 26 M4 12 L4 26" stroke-width="2"/>'),
  longwavy:  S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M4 12 Q3 4 14 2 Q25 4 24 12 C25 18 22 20 24 26 M4 12 C3 18 6 20 4 26" stroke-width="2"/>'),
  curly:     S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M5 10 Q3 4 14 2 Q25 4 23 10 C25 14 22 13 24 17 C26 21 22 22 24 26 M5 10 C3 14 6 13 4 17 C2 21 6 22 4 26" stroke-width="2"/>'),
  afro:      S('<circle cx="14" cy="13" r="12" stroke-width="2"/><path d="M7 18 Q7 10 14 8 Q21 10 21 18"/>'),
  ponytail:  S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M5 10 Q4 4 14 2 Q24 4 23 10" stroke-width="2"/><path d="M18 6 Q22 8 20 16 Q19 22 21 26" stroke-width="2"/>'),
  bob:       S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M4 10 Q3 4 14 2 Q25 4 24 10 L24 20 M4 10 L4 20" stroke-width="2"/>'),
  pixie:     S('<path d="M6 18 Q5 6 14 4 Q23 6 22 18"/><path d="M5 12 Q4 3 14 2 Q24 3 23 12 L22 16" stroke-width="2"/><path d="M5 10 L2 14" stroke-width="2"/>'),
};

const TRAIT_CATEGORIES: { key: keyof CharacterTraits; label: string; icon: string; options: TraitOption[] }[] = [
  { key: 'gender', label: 'Gender', icon: 'fa-venus-mars', options: [
    { value: 'female', label: 'Female', svg: S('<circle cx="14" cy="10" r="7"/><path d="M14 17 L14 26 M10 22 L18 22"/>') },
    { value: 'male', label: 'Male', svg: S('<circle cx="12" cy="14" r="7"/><path d="M17 9 L24 2 M18 2 L24 2 L24 8"/>') },
  ]},
  { key: 'ageRange', label: 'Age', icon: 'fa-cake-candles', options: [] },
  { key: 'ethnicity', label: 'Ethnicity', icon: 'fa-globe', options: [
    { value: 'White European', label: 'White European', colour: '#F5D6C3' },
    { value: 'Black African', label: 'Black African', colour: '#6B4226' },
    { value: 'Black Caribbean', label: 'Black Caribbean', colour: '#7B5236' },
    { value: 'South Asian', label: 'South Asian', colour: '#C69C6D' },
    { value: 'East Asian', label: 'East Asian', colour: '#F0D5A8' },
    { value: 'Southeast Asian', label: 'SE Asian', colour: '#D4A76A' },
    { value: 'Middle Eastern', label: 'Middle Eastern', colour: '#C9956B' },
    { value: 'Latin American', label: 'Latin American', colour: '#C8A882' },
    { value: 'Mixed heritage', label: 'Mixed', colour: 'linear-gradient(135deg, #F5D6C3 0%, #C69C6D 50%, #6B4226 100%)' },
  ]},
  { key: 'build', label: 'Build', icon: 'fa-person', options: [
    { value: 'slim', label: 'Slim', svg: S('<path d="M14 4 L14 18 M14 18 L10 27 M14 18 L18 27 M10 11 L18 11"/><circle cx="14" cy="2" r="1.5"/>',28,28) },
    { value: 'average', label: 'Average', svg: S('<path d="M14 5 L14 18 M14 18 L9 27 M14 18 L19 27 M9 12 L19 12"/><circle cx="14" cy="3" r="2"/>',28,28) },
    { value: 'athletic', label: 'Athletic', svg: S('<path d="M14 5 L14 18 M14 18 L9 27 M14 18 L19 27 M7 12 L21 12"/><circle cx="14" cy="3" r="2"/><path d="M12 10 L11 18 M16 10 L17 18"/>',28,28) },
    { value: 'stocky', label: 'Stocky', svg: S('<path d="M14 5 L14 18 M14 18 L9 27 M14 18 L19 27 M7 11 L21 11"/><circle cx="14" cy="3" r="2.5"/><ellipse cx="14" cy="14" rx="5" ry="6"/>',28,28) },
    { value: 'curvy', label: 'Curvy', svg: S('<circle cx="14" cy="3" r="2"/><path d="M14 5 Q18 12 16 18 M14 18 L9 27 M14 18 L19 27 M8 11 L20 11"/><path d="M12 10 Q10 14 12 18"/>',28,28) },
    { value: 'heavyset', label: 'Heavyset', svg: S('<circle cx="14" cy="3" r="2.5"/><ellipse cx="14" cy="14" rx="7" ry="7"/><path d="M14 21 L14 22 M10 22 L8 27 M18 22 L20 27 M6 11 L22 11"/>',28,28) },
    { value: 'petite', label: 'Petite', svg: S('<circle cx="14" cy="6" r="2"/><path d="M14 8 L14 18 M14 18 L11 24 M14 18 L17 24 M11 12 L17 12"/>',28,28) },
    { value: 'tall and lean', label: 'Tall & Lean', svg: S('<circle cx="14" cy="2" r="1.5"/><path d="M14 3.5 L14 20 M14 20 L10 27 M14 20 L18 27 M10 10 L18 10"/>',28,28) },
  ]},
  { key: 'faceShape', label: 'Face Shape', icon: 'fa-face-smile', options: [
    { value: 'oval', label: 'Oval', svg: FACE.oval },
    { value: 'round', label: 'Round', svg: FACE.round },
    { value: 'square', label: 'Square', svg: FACE.square },
    { value: 'heart-shaped', label: 'Heart', svg: FACE.heart },
    { value: 'oblong', label: 'Oblong', svg: FACE.oblong },
    { value: 'diamond', label: 'Diamond', svg: FACE.diamond },
    { value: 'triangular', label: 'Triangle', svg: FACE.triangle },
  ]},
  { key: 'skinTone', label: 'Skin Tone', icon: 'fa-palette', options: [
    { value: 'very fair / porcelain', label: 'Porcelain', colour: '#FDEEE0' },
    { value: 'fair / light', label: 'Fair', colour: '#F5D6C3' },
    { value: 'light-medium / warm beige', label: 'Light-Med', colour: '#E8C4A0' },
    { value: 'medium / olive', label: 'Olive', colour: '#C9A67A' },
    { value: 'medium-dark / warm brown', label: 'Warm Brown', colour: '#A67C52' },
    { value: 'dark / deep brown', label: 'Deep Brown', colour: '#6B4226' },
    { value: 'very dark / ebony', label: 'Ebony', colour: '#3B2314' },
  ]},
  { key: 'hairLength', label: 'Hair Length', icon: 'fa-ruler', options: [
    { value: 'bald / shaved', label: 'Bald', svg: HAIR.bald },
    { value: 'buzz cut', label: 'Buzz Cut', svg: HAIR.buzz },
    { value: 'short', label: 'Short', svg: HAIR.short },
    { value: 'medium length', label: 'Medium', svg: HAIR.medium },
    { value: 'long', label: 'Long', svg: HAIR.longstr },
    { value: 'bob length', label: 'Bob', svg: HAIR.bob },
    { value: 'pixie length', label: 'Pixie', svg: HAIR.pixie },
  ]},
  { key: 'hairTexture', label: 'Hair Texture', icon: 'fa-wind', options: [
    { value: 'straight', label: 'Straight', svg: S('<path d="M6 4 L6 24 M11 4 L11 24 M17 4 L17 24 M22 4 L22 24"/>') },
    { value: 'wavy', label: 'Wavy', svg: S('<path d="M6 4 C6 10 10 10 10 16 C10 22 6 22 6 28 M14 4 C14 10 18 10 18 16 C18 22 14 22 14 28 M22 4 C22 10 26 10 26 16 C26 22 22 22 22 28"/>', 28, 28) },
    { value: 'curly', label: 'Curly', svg: HAIR.curly },
    { value: 'coily / afro', label: 'Coily/Afro', svg: HAIR.afro },
    { value: 'frizzy', label: 'Frizzy', svg: S('<path d="M6 4 C8 8 4 12 7 16 C4 20 8 24 6 28 M14 4 C16 8 12 12 15 16 C12 20 16 24 14 28 M22 4 C24 8 20 12 23 16 C20 20 24 24 22 28"/>', 28, 28) },
  ]},
  { key: 'hairColour', label: 'Hair Colour', icon: 'fa-droplet', options: [
    { value: 'jet black', label: 'Black', colour: '#1a1a1a' },
    { value: 'dark brown', label: 'Dark Brown', colour: '#3B2314' },
    { value: 'medium brown', label: 'Med Brown', colour: '#6B4226' },
    { value: 'light brown', label: 'Light Brown', colour: '#A67C52' },
    { value: 'blonde', label: 'Blonde', colour: '#E8D070' },
    { value: 'strawberry blonde', label: 'Strawberry', colour: '#D4956A' },
    { value: 'red / auburn', label: 'Red/Auburn', colour: '#8B2500' },
    { value: 'ginger', label: 'Ginger', colour: '#C54B1A' },
    { value: 'grey', label: 'Grey', colour: '#9E9E9E' },
    { value: 'white / silver', label: 'White', colour: '#E8E8E8' },
    { value: 'salt and pepper', label: 'Salt & Pepper', colour: 'linear-gradient(135deg, #3B3B3B 0%, #9E9E9E 40%, #3B3B3B 60%, #D0D0D0 100%)' },
    { value: 'blonde highlights on mid brown', label: 'Blonde/Mid', colour: 'linear-gradient(135deg, #6B4226 0%, #E8D070 35%, #6B4226 65%, #E8D070 100%)' },
    { value: 'pink highlights on black', label: 'Pink/Black', colour: 'linear-gradient(135deg, #1a1a1a 0%, #E75480 35%, #1a1a1a 65%, #E75480 100%)' },
    { value: 'blue highlights on black', label: 'Blue/Black', colour: 'linear-gradient(135deg, #1a1a1a 0%, #4682B4 35%, #1a1a1a 65%, #4682B4 100%)' },
  ]},
  { key: 'eyeShape', label: 'Eye Shape', icon: 'fa-eye', options: [
    { value: 'almond-shaped', label: 'Almond', svg: EYE.almond },
    { value: 'round', label: 'Round', svg: EYE.round },
    { value: 'hooded', label: 'Hooded', svg: EYE.hooded },
    { value: 'deep-set', label: 'Deep-set', svg: EYE.deepset },
    { value: 'upturned', label: 'Upturned', svg: EYE.upturned },
    { value: 'downturned', label: 'Downturned', svg: EYE.downturned },
    { value: 'monolid', label: 'Monolid', svg: EYE.monolid },
    { value: 'narrow-set', label: 'Narrow-set', svg: EYE.narrowset },
    { value: 'wide-set', label: 'Wide-set', svg: EYE.wideset },
  ]},
  { key: 'eyeColour', label: 'Eye Colour', icon: 'fa-circle', options: [
    { value: 'dark brown', label: 'Dark Brown', colour: '#3B2314' },
    { value: 'light brown / hazel', label: 'Hazel', colour: '#8B6914' },
    { value: 'green-hazel', label: 'Green Hazel', colour: '#6B8E3A' },
    { value: 'green', label: 'Green', colour: '#4A7C3F' },
    { value: 'blue', label: 'Blue', colour: '#4682B4' },
    { value: 'grey', label: 'Grey', colour: '#8899AA' },
    { value: 'blue-grey', label: 'Blue-Grey', colour: '#6B8DAD' },
  ]},
  { key: 'noseShape', label: 'Nose', icon: 'fa-mountain', options: [
    { value: 'straight / Grecian', label: 'Straight', svg: NOSE.straight },
    { value: 'button / small', label: 'Button', svg: NOSE.button },
    { value: 'broad / wide', label: 'Broad', svg: NOSE.broad },
    { value: 'aquiline / Roman', label: 'Aquiline', svg: NOSE.aquiline },
    { value: 'upturned / snub', label: 'Snub', svg: NOSE.snub },
    { value: 'hawk / prominent', label: 'Prominent', svg: NOSE.hawk },
    { value: 'flat / low bridge', label: 'Flat', svg: NOSE.flat },
  ]},
  { key: 'lipShape', label: 'Lips', icon: 'fa-comment', options: [
    { value: 'thin lips', label: 'Thin', svg: LIPS.thin },
    { value: 'medium / balanced', label: 'Medium', svg: LIPS.medium },
    { value: 'full / plump', label: 'Full', svg: LIPS.full },
    { value: 'heart-shaped / cupid\'s bow', label: 'Cupid\'s Bow', svg: LIPS.cupid },
    { value: 'wide', label: 'Wide', svg: LIPS.wide },
    { value: 'downturned', label: 'Downturned', svg: LIPS.downturned },
  ]},
];


interface CharacterBuilderProps {
  characters: CharacterProfile[];
  onChange: (chars: CharacterProfile[]) => void;
  detectedNames: string[];
  onGeneratePrompt: (charId: string, rawTraits: string) => Promise<string>;
  onGenerateImage: (charId: string, prompt: string, label?: string) => void;
  onActiveCharChange?: (charId: string | null) => void;
  isGeneratingPrompt?: boolean;
  projectName?: string;
}

export const CharacterBuilder: React.FC<CharacterBuilderProps> = ({ characters, onChange, detectedNames, onGeneratePrompt, onGenerateImage, onActiveCharChange, isGeneratingPrompt, projectName }) => {
  const [activeCharId, _setActiveCharId] = useState<string | null>(characters[0]?.id || null);
  const setActiveCharId = (id: string | null) => { _setActiveCharId(id); onActiveCharChange?.(id); };
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<'traits' | 'photo'>('traits');
  const [nameInput, setNameInput] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [ageList, setAgeList] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [characterFiles, setCharacterFiles] = useState<CharacterFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    setFilesLoading(true);
    fetch('http://localhost:5182/api/character-files')
      .then(r => r.json())
      .then(d => setCharacterFiles(d.files || []))
      .catch(() => setCharacterFiles([]))
      .finally(() => setFilesLoading(false));
  }, []);

  const activeChar = characters.find(c => c.id === activeCharId);

  const CHILD_KEYWORDS = ['baby', 'newborn', 'toddler', 'child', 'children', 'pre-school', 'pre-schooler', 'pre-school-aged', 'school-aged', 'infant', 'boy', 'girl', 'son', 'daughter', 'teenager', 'teen'];
  const SCREENPLAY_AGES = '1 month, 2 years, 4 years, 7 years';

  const isChildType = (name: string) => CHILD_KEYWORDS.some(kw => name.toLowerCase().includes(kw));

  const addCharacter = (name: string, source: 'existing' | 'new' = 'new') => {
    if (!name.trim()) return;
    const id = `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newChar: CharacterProfile = { id, name: name.trim(), photoUrls: [], wardrobeUrls: [], traits: { ...emptyTraits }, source };
    const updated = [...characters, newChar];
    onChange(updated);
    setActiveCharId(id);
    setNameInput('');
    if (isChildType(name)) {
      setAgeList(SCREENPLAY_AGES);
    }
  };

  const updateCharSource = (charId: string, source: 'existing' | 'new') => {
    onChange(characters.map(c => c.id === charId ? { ...c, source } : c));
  };

  const updateExistingImage = (charId: string, url: string) => {
    onChange(characters.map(c => c.id === charId ? { ...c, existingImageUrl: url, photoUrls: url ? [url] : c.photoUrls } : c));
  };

  const updateTrait = (key: keyof CharacterTraits, value: string) => {
    if (!activeChar) return;
    const updated = characters.map(c =>
      c.id === activeChar.id ? { ...c, traits: { ...c.traits, [key]: c.traits[key] === value ? '' : value } } : c
    );
    onChange(updated);
  };

  const addPhoto = (url: string) => {
    if (!activeChar) return;
    const updated = characters.map(c =>
      c.id === activeChar.id ? { ...c, photoUrls: [...(c.photoUrls || []), url].slice(0, 3) } : c
    );
    onChange(updated);
  };

  const removePhoto = (idx: number) => {
    if (!activeChar) return;
    const updated = characters.map(c =>
      c.id === activeChar.id ? { ...c, photoUrls: (c.photoUrls || []).filter((_, i) => i !== idx) } : c
    );
    onChange(updated);
  };

  const deleteCharacter = (id: string) => {
    const updated = characters.filter(c => c.id !== id);
    onChange(updated);
    if (activeCharId === id) setActiveCharId(updated[0]?.id || null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) addPhoto(ev.target.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectedCount = activeChar ? Object.values(activeChar.traits).filter(Boolean).length : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Screenplay characters list */}
      {detectedNames.length > 0 && (
        <div className="p-3 border-b border-[#ceadd4] flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <i className="fa-solid fa-scroll text-[8px] text-[#91569c]"></i>
            <span className="text-[8px] font-black text-[#888]/60 uppercase tracking-wider">Characters from Screenplay</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {detectedNames.map(n => {
              const existing = characters.find(c => c.name.toLowerCase() === n);
              return (
                <button
                  key={n}
                  onClick={() => {
                    if (existing) {
                      setActiveCharId(existing.id);
                    } else {
                      addCharacter(n.charAt(0).toUpperCase() + n.slice(1));
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    existing
                      ? (activeCharId === existing.id
                        ? 'bg-[#91569c] text-[#3a3a3a]'
                        : 'bg-[#f6f0f8] text-[#91569c] border border-[#91569c]/30')
                      : 'bg-[#f6f0f8] text-[#888]/50 border border-dashed border-[#ceadd4] hover:text-[#91569c] hover:border-[#91569c]/40'
                  }`}
                >
                  {existing ? (
                    <i className="fa-solid fa-circle-check text-[7px]"></i>
                  ) : (
                    <i className="fa-solid fa-plus text-[7px]"></i>
                  )}
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Character selector tabs + custom add */}
      <div className="p-3 border-b border-[#ceadd4] space-y-2 flex-shrink-0">
        {characters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {characters.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCharId(c.id)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                  activeCharId === c.id
                    ? 'bg-[#91569c] text-[#3a3a3a]'
                    : 'bg-[#f6f0f8] text-[#888]/60 hover:text-[#5c3a62] border border-[#ceadd4]'
                }`}
              >
                {c.source === 'existing' && c.existingImageUrl && (
                  <img src={c.existingImageUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                )}
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nameInput.trim()) addCharacter(nameInput.trim()); }}
            placeholder="Add custom character name..."
            className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded px-2 py-1 text-[9px] text-[#888] placeholder:text-[#ceadd4] focus:ring-1 focus:ring-[#91569c]/50 outline-none"
          />
          <button
            onClick={() => { if (nameInput.trim()) addCharacter(nameInput.trim()); }}
            disabled={!nameInput.trim()}
            className="px-2 py-1 rounded text-[8px] font-bold uppercase bg-[#91569c] text-[#3a3a3a] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-plus text-[7px]"></i>
          </button>
        </div>
      </div>

      {/* Character detail */}
      {activeChar ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Source toggle: Select Existing / Create New */}
          <div className="px-3 pt-3 pb-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex bg-[#f6f0f8] rounded-lg p-0.5 border border-[#ceadd4]/50">
                <button
                  onClick={() => updateCharSource(activeChar.id, 'existing')}
                  className={`px-3 py-1.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeChar.source === 'existing' ? 'bg-[#91569c] text-[#3a3a3a]' : 'text-[#888]/50 hover:text-[#5c3a62]'
                  }`}
                >
                  <i className="fa-solid fa-folder-open text-[7px]"></i>
                  Select Existing
                </button>
                <button
                  onClick={() => updateCharSource(activeChar.id, 'new')}
                  className={`px-3 py-1.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    (!activeChar.source || activeChar.source === 'new') ? 'bg-[#91569c] text-[#3a3a3a]' : 'text-[#888]/50 hover:text-[#5c3a62]'
                  }`}
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-[7px]"></i>
                  Create New
                </button>
              </div>
              <button onClick={() => deleteCharacter(activeChar.id)} className="text-red-400/40 hover:text-red-400 p-1 transition-colors" title="Delete character">
                <i className="fa-solid fa-trash-can text-[9px]"></i>
              </button>
            </div>
          </div>

          {/* SELECT EXISTING mode */}
          {activeChar.source === 'existing' ? (
            <div className="p-3 space-y-3">
              <p className="text-[9px] text-[#888]/50">
                <i className="fa-solid fa-folder text-[8px] text-[#91569c] mr-1"></i>
                Pick a character image from <span className="font-bold">assets/3. Characters</span>
              </p>

              {filesLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <i className="fa-solid fa-spinner fa-spin text-[#91569c]"></i>
                  <span className="text-[9px] text-[#888]/50">Loading character files...</span>
                </div>
              ) : characterFiles.length === 0 ? (
                <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-lg p-4 text-center">
                  <i className="fa-solid fa-folder-open text-2xl text-[#ceadd4] mb-2"></i>
                  <p className="text-[9px] text-[#888]/50 font-bold">No character images found</p>
                  <p className="text-[8px] text-[#888]/30 mt-1">Add images to <span className="font-mono">assets/3. Characters</span></p>
                </div>
              ) : (
                <>
                  <select
                    value={activeChar.existingImageUrl || ''}
                    onChange={(e) => updateExistingImage(activeChar.id, e.target.value)}
                    className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-2.5 py-2 text-[10px] text-[#888] focus:ring-1 focus:ring-[#91569c]/50 outline-none cursor-pointer"
                  >
                    <option value="">-- Select a character image --</option>
                    {characterFiles.map(f => (
                      <option key={f.path} value={`http://localhost:5182${f.path}`}>{f.name}</option>
                    ))}
                  </select>

                  {activeChar.existingImageUrl && (
                    <div className="bg-[#f6f0f8] border border-[#ceadd4] rounded-xl p-3 flex items-start gap-3">
                      <img
                        src={activeChar.existingImageUrl}
                        alt={activeChar.name}
                        className="w-24 h-24 rounded-lg object-cover border-2 border-[#91569c]/30 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-[#5c3a62] uppercase tracking-wider">{activeChar.name}</p>
                        <p className="text-[8px] text-[#888]/40 mt-0.5 truncate">
                          {characterFiles.find(f => `http://localhost:5182${f.path}` === activeChar.existingImageUrl)?.name}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                          <i className="fa-solid fa-circle-check text-[8px] text-green-400"></i>
                          <span className="text-[8px] text-green-400/80">Image selected</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grid view of all files for quick selection */}
                  <div className="border-t border-[#ceadd4]/30 pt-3">
                    <span className="text-[8px] font-black text-[#888]/40 uppercase tracking-wider block mb-2">
                      <i className="fa-solid fa-grip text-[7px] mr-1"></i>
                      All Character Images
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {characterFiles.map(f => {
                        const url = `http://localhost:5182${f.path}`;
                        const isSelected = activeChar.existingImageUrl === url;
                        return (
                          <button
                            key={f.path}
                            onClick={() => updateExistingImage(activeChar.id, url)}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                              isSelected ? 'border-[#91569c] ring-2 ring-[#91569c]/30' : 'border-[#ceadd4]/50 hover:border-[#91569c]/40'
                            }`}
                          >
                            <img src={url} alt={f.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#91569c] flex items-center justify-center">
                                <i className="fa-solid fa-check text-[6px] text-white"></i>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                              <span className="text-[6px] text-white truncate block">{f.name.replace(/\.[^.]+$/, '')}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
          <>
          {/* CREATE NEW mode — Build/Photo toggle */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="flex bg-[#f6f0f8] rounded-lg p-0.5">
              <button onClick={() => setMode('traits')} className={`px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all ${mode === 'traits' ? 'bg-[#91569c] text-[#3a3a3a]' : 'text-[#888]/50 hover:text-[#5c3a62]'}`}>
                <i className="fa-solid fa-sliders text-[7px] mr-1"></i>Build
              </button>
              <button onClick={() => setMode('photo')} className={`px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all ${mode === 'photo' ? 'bg-[#91569c] text-[#3a3a3a]' : 'text-[#888]/50 hover:text-[#5c3a62]'}`}>
                <i className="fa-solid fa-camera text-[7px] mr-1"></i>Photo
              </button>
            </div>
          </div>

          {mode === 'photo' ? (
            <div className="p-3 space-y-3">
              <p className="text-[9px] text-[#888]/50">Paste up to 3 image URLs as reference for this character's face.</p>
              {(activeChar.photoUrls || []).map((url, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <img src={url} alt={`Ref ${idx + 1}`} className="w-12 h-12 rounded object-cover border border-[#ceadd4] flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <input type="text" value={url} readOnly className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded px-2 py-1.5 text-[8px] text-[#888]/60 outline-none truncate" />
                  <button onClick={() => removePhoto(idx)} className="text-red-400/40 hover:text-red-400 p-1 flex-shrink-0">
                    <i className="fa-solid fa-xmark text-[9px]"></i>
                  </button>
                </div>
              ))}
              {(activeChar.photoUrls || []).length < 3 && (
                <div className="flex gap-1.5">
                  <input type="text" placeholder="Paste image URL..." className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded px-2.5 py-2 text-[9px] text-[#888] placeholder:text-[#ceadd4] focus:ring-1 focus:ring-[#91569c]/50 outline-none"
                    onKeyDown={(e) => { if (e.key === 'Enter') { const val = (e.target as HTMLInputElement).value.trim(); if (val) { addPhoto(val); (e.target as HTMLInputElement).value = ''; } } }}
                  />
                  <button onClick={(e) => { const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement; const val = input?.value?.trim(); if (val) { addPhoto(val); input.value = ''; } }}
                    className="px-2.5 py-2 rounded bg-[#91569c] text-[#3a3a3a] text-[8px] font-bold uppercase hover:bg-[#d4af1c] transition-colors flex-shrink-0">Add</button>
                </div>
              )}
              <p className="text-[7px] text-[#888]/30">{(activeChar.photoUrls || []).length}/3 references</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[8px] text-[#888]/40">{selectedCount} / {TRAIT_CATEGORIES.length} traits selected</span>
              </div>
              {TRAIT_CATEGORIES.map(cat => {
                const isOpen = openCategory === cat.key;
                const selected = activeChar.traits[cat.key];
                return (
                  <div key={cat.key} className="bg-[#f6f0f8] rounded-lg overflow-hidden border border-[#ceadd4]/50">
                    <button
                      onClick={() => setOpenCategory(isOpen ? null : cat.key)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f6f0f8] transition-colors"
                    >
                      <i className={`fa-solid ${cat.icon} text-[9px] ${selected ? 'text-[#91569c]' : 'text-[#888]/30'}`}></i>
                      <span className="flex-1 text-[9px] font-bold uppercase tracking-wider text-[#888]/70">{cat.label}</span>
                      {selected && <span className="text-[7px] text-[#91569c]/70 bg-[#91569c]/10 px-1.5 py-0.5 rounded truncate max-w-[100px]">{selected}</span>}
                      <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-[7px] text-[#888]/30`}></i>
                    </button>
                    {isOpen && cat.key === 'ageRange' ? (
                      <div className="px-3 pb-2">
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="number"
                            min="0"
                            max="120"
                            value={(() => { const m = activeChar.traits.ageRange.match(/^(\d+)/); return m ? m[1] : ''; })()}
                            onChange={(e) => {
                              const num = e.target.value;
                              const unit = activeChar.traits.ageRange.includes('months') ? 'months' : 'years';
                              const updated = characters.map(c =>
                                c.id === activeChar.id ? { ...c, traits: { ...c.traits, ageRange: num ? `${num} ${unit} old` : '' } } : c
                              );
                              onChange(updated);
                            }}
                            placeholder="Age"
                            className="w-20 bg-[#f6f0f8] border border-[#ceadd4] rounded px-2 py-1.5 text-[10px] text-[#888] placeholder:text-[#ceadd4] focus:ring-1 focus:ring-[#91569c]/50 outline-none text-center"
                          />
                          <select
                            value={activeChar.traits.ageRange.includes('months') ? 'months' : 'years'}
                            onChange={(e) => {
                              const unit = e.target.value;
                              const m = activeChar.traits.ageRange.match(/^(\d+)/);
                              const num = m ? m[1] : '';
                              if (num) {
                                const updated = characters.map(c =>
                                  c.id === activeChar.id ? { ...c, traits: { ...c.traits, ageRange: `${num} ${unit} old` } } : c
                                );
                                onChange(updated);
                              }
                            }}
                            className="bg-[#f6f0f8] border border-[#ceadd4] rounded px-2 py-1.5 text-[10px] text-[#888] focus:ring-1 focus:ring-[#91569c]/50 outline-none cursor-pointer"
                          >
                            <option value="months">months</option>
                            <option value="years">years</option>
                          </select>
                          <span className="text-[9px] text-[#888]/40">old</span>
                        </div>
                      </div>
                    ) : isOpen && cat.options.length > 0 ? (
                      <div className="px-2 pb-2 grid grid-cols-3 gap-1.5">
                        {cat.options.map(opt => {
                          const isSelected = activeChar.traits[cat.key] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => updateTrait(cat.key, opt.value)}
                              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all text-center ${
                                isSelected
                                  ? 'bg-[#91569c]/20 ring-2 ring-[#91569c]/60 text-[#91569c]'
                                  : 'bg-[#f6f0f8] hover:bg-[#edecec] text-[#888]/70 hover:text-[#5c3a62]'
                              }`}
                            >
                              {opt.svg ? (
                                <span className="w-7 h-7 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: opt.svg }} />
                              ) : opt.colour ? (
                                <span
                                  className="w-7 h-7 rounded-full border-2 border-[#ceadd4] flex-shrink-0"
                                  style={{ background: opt.colour }}
                                />
                              ) : null}
                              <span className="text-[7px] font-bold uppercase tracking-wider leading-tight">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {/* Distinguishing features */}
              <div className="px-1 pt-2">
                <label className="block text-[8px] font-bold text-[#888]/50 uppercase tracking-wider mb-1">
                  <i className="fa-solid fa-star text-[7px] mr-1"></i>
                  Distinguishing Features
                </label>
                <input
                  type="text"
                  value={activeChar.traits.distinguishing}
                  onChange={(e) => updateTrait('distinguishing', e.target.value)}
                  placeholder="e.g. glasses, beard, freckles, scar, dimples..."
                  className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded px-2.5 py-1.5 text-[9px] text-[#888] placeholder:text-[#ceadd4] focus:ring-1 focus:ring-[#91569c]/50 outline-none"
                />
              </div>
            </div>
          )}

          {/* Build mode: Prompt generation + image generation */}
          {mode === 'traits' && (
          <div className="p-3 mt-2 border-t border-[#ceadd4] space-y-2">
            <button
              onClick={async () => {
                const rawTraits = buildPromptFromTraits(activeChar.name, activeChar.traits);
                const optimised = await onGeneratePrompt(activeChar.id, rawTraits);
                setGeneratedPrompt(optimised);
                setEditedPrompt(optimised);
              }}
              disabled={isGeneratingPrompt || selectedCount < 3}
              className="w-full py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#f6f0f8] text-[#91569c] border border-[#91569c]/40 hover:bg-[#91569c]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <i className={`fa-solid ${isGeneratingPrompt ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[8px]`}></i>
              {isGeneratingPrompt ? 'Generating Prompt...' : 'Generate Prompt'}
            </button>

            {editedPrompt && (
              <>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={5}
                  className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg p-2.5 text-[9px] text-[#888] leading-relaxed focus:ring-1 focus:ring-[#91569c]/50 outline-none resize-y"
                />
                <button
                  onClick={() => onGenerateImage(activeChar.id, editedPrompt)}
                  className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#91569c] text-[#3a3a3a] hover:bg-[#d4af1c] transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-image text-[9px]"></i>
                  Generate Image
                </button>
              </>
            )}
          </div>
          )}

          </>
          )}

          {/* ─── Age Progression (available in ALL modes) ─── */}
          <div className="p-3 mt-1 border-t border-[#ceadd4] space-y-2">
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-children text-[9px] text-[#91569c]"></i>
              <span className="text-[9px] font-black text-[#888]/60 uppercase tracking-wider">Age Progression</span>
            </div>
            <p className="text-[8px] text-[#888]/40 leading-relaxed">
              Generate the same character at different ages. Enter ages separated by commas.
              {isChildType(activeChar.name) && !ageList && (
                <button
                  onClick={() => setAgeList(SCREENPLAY_AGES)}
                  className="ml-1 text-[#91569c] hover:underline"
                >
                  Pre-fill from screenplay
                </button>
              )}
            </p>

            <input
              type="text"
              value={ageList}
              onChange={(e) => setAgeList(e.target.value)}
              placeholder="e.g. 1 month, 2 years, 4 years, 7 years"
              className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-2.5 py-2 text-[10px] text-[#888] placeholder:text-[#ceadd4] focus:ring-1 focus:ring-[#91569c]/50 outline-none"
            />

            {ageList.trim() && (
              <div className="flex flex-wrap gap-1.5 py-1">
                {ageList.split(',').map(a => a.trim()).filter(Boolean).map((age, i) => (
                  <span key={i} className="px-2 py-1 rounded-lg bg-[#91569c]/10 text-[#91569c] text-[8px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <i className="fa-solid fa-cake-candles text-[7px]"></i>
                    {age}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={async () => {
                const ages = ageList.split(',').map(a => a.trim()).filter(Boolean);
                const traitDesc = Object.values(activeChar.traits).filter(Boolean).length >= 3
                  ? buildPromptFromTraits(activeChar.name, activeChar.traits).replace(/^Portrait photograph of "[^"]+": /, '').replace(/\. Warm natural.*$/, '')
                  : '';
                const distinguishing = activeChar.traits.distinguishing || '';
                const hasRef = (activeChar.photoUrls || []).length > 0 || !!activeChar.existingImageUrl;

                if (ages.length > 0) {
                  for (const age of ages) {
                    const parts = [
                      `Photorealistic portrait of "${activeChar.name}" as a child aged exactly ${age}.`,
                      `Show correct body size, face proportions, and developmental features for ${age}.`,
                    ];
                    if (traitDesc) parts.push(`Genetic features: ${traitDesc}.`);
                    if (distinguishing) parts.push(`Key features: ${distinguishing}.`);
                    if (hasRef) parts.push('Match the reference photos — same child, aged naturally.');
                    parts.push('Same child across all ages — consistent genetic features (eye colour, nose shape, hair colour, skin tone).');
                    parts.push('Warm natural lighting, cinematic, photorealistic, 9:16 vertical.');

                    const raw = parts.join(' ');
                    const optimised = await onGeneratePrompt(activeChar.id, raw);
                    onGenerateImage(activeChar.id, optimised, `${activeChar.name} - ${age}`);
                  }
                } else {
                  const parts = [`Portrait of "${activeChar.name}".`];
                  if (traitDesc) parts.push(`Features: ${traitDesc}.`);
                  if (distinguishing) parts.push(`Key features: ${distinguishing}.`);
                  if (hasRef) parts.push('Match the reference photos.');
                  parts.push('Warm natural lighting, cinematic, photorealistic, 9:16 vertical.');

                  const raw = parts.join(' ');
                  const optimised = await onGeneratePrompt(activeChar.id, raw);
                  onGenerateImage(activeChar.id, optimised);
                }
              }}
              disabled={isGeneratingPrompt || (
                !ageList.trim() &&
                Object.values(activeChar.traits).filter(Boolean).length < 3 &&
                (activeChar.photoUrls || []).length === 0 &&
                !activeChar.existingImageUrl
              )}
              className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#91569c] text-[#3a3a3a] hover:bg-[#d4af1c] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <i className={`fa-solid ${isGeneratingPrompt ? 'fa-spinner fa-spin' : 'fa-bolt'} text-[9px]`}></i>
              {isGeneratingPrompt
                ? 'Generating...'
                : ageList.trim()
                  ? `Generate ${ageList.split(',').filter(a => a.trim()).length} Age Stages`
                  : 'Generate Character Image'
              }
            </button>
          </div>

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <i className="fa-solid fa-user-plus text-3xl text-[#ceadd4] mb-3"></i>
          <p className="text-[10px] text-[#888]/50 font-bold uppercase tracking-widest mb-1">No characters yet</p>
          <p className="text-[8px] text-[#888]/30">Add a character above or pick from the screenplay suggestions.</p>
        </div>
      )}
    </div>
  );
};
