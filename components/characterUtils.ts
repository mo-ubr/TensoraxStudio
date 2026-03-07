export interface CharacterProfile {
  id: string;
  name: string;
  photoUrls: string[];
  wardrobeUrls: string[];
  traits: CharacterTraits;
  source?: 'existing' | 'new';
  existingImageUrl?: string;
}

export interface CharacterTraits {
  gender: string;
  ageRange: string;
  ethnicity: string;
  build: string;
  faceShape: string;
  skinTone: string;
  hairLength: string;
  hairTexture: string;
  hairColour: string;
  eyeShape: string;
  eyeColour: string;
  noseShape: string;
  lipShape: string;
  distinguishing: string;
}

export const emptyTraits: CharacterTraits = {
  gender: '', ageRange: '', ethnicity: '', build: '', faceShape: '',
  skinTone: '', hairLength: '', hairTexture: '', hairColour: '', eyeShape: '', eyeColour: '',
  noseShape: '', lipShape: '', distinguishing: '',
};

export const buildPromptFromTraits = (name: string, traits: CharacterTraits): string => {
  const parts: string[] = [];
  if (traits.gender) parts.push(traits.gender);
  if (traits.ageRange) parts.push(traits.ageRange);
  if (traits.ethnicity) parts.push(traits.ethnicity);
  if (traits.build) parts.push(`${traits.build} build`);
  if (traits.faceShape) parts.push(`${traits.faceShape} face`);
  if (traits.skinTone) parts.push(`${traits.skinTone} skin`);
  const hairParts = [traits.hairColour, traits.hairLength, traits.hairTexture].filter(Boolean);
  if (hairParts.length > 0) parts.push(`${hairParts.join(' ')} hair`);
  if (traits.eyeShape && traits.eyeColour) parts.push(`${traits.eyeColour} ${traits.eyeShape} eyes`);
  else if (traits.eyeShape) parts.push(`${traits.eyeShape} eyes`);
  else if (traits.eyeColour) parts.push(`${traits.eyeColour} eyes`);
  if (traits.noseShape) parts.push(`${traits.noseShape} nose`);
  if (traits.lipShape) parts.push(`${traits.lipShape}`);
  if (traits.distinguishing) parts.push(traits.distinguishing);

  const desc = parts.join(', ');
  return `Portrait photograph of "${name}": ${desc}. Warm natural lighting, soft focus background, cinematic, photorealistic, high detail facial features, 9:16 vertical format.`;
};

const CHARACTERS_STORAGE = 'tensorax_characters';

export const loadCharacters = (): CharacterProfile[] => {
  try {
    const raw = localStorage.getItem(CHARACTERS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveCharacters = (chars: CharacterProfile[]) => {
  localStorage.setItem(CHARACTERS_STORAGE, JSON.stringify(chars));
};
