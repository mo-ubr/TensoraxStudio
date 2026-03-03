
export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface GridImage {
  id: string;
  url?: string;
  loading: boolean;
  error?: string;
  promptSuffix: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ReferenceInput {
  text: string;
  images: string[];
}

export interface VideoState {
  prompt: string;
  startImage?: string;
  midImage?: string;
  endImage?: string;
  movementDescription: string;
  duration: '5s' | '10s';
  isGenerating: boolean;
  progressMessage: string;
  resultUrl?: string;
}

export interface ProjectBrief {
  backgroundInfo: string;
  promoDetails: string;
  videoConcept: string;
  proof: string;
  videoType: 'explainer' | 'promo' | 'tutorial' | 'testimonial' | 'brand' | 'product';
  format: '9:16' | '16:9' | '1:1';
  duration: '1.5min' | '3min';
  tone: 'warm' | 'energetic' | 'professional' | 'playful' | 'dramatic' | 'inspirational';
  cta: string;
  targetAudience: string;
  offer: string;
  sampleVideoUrl: string;
  sampleVideoFile?: string;
}

export interface ConceptIdea {
  id: string;
  title: string;
  summary: string;
  keyScenes: string;
  visualStyle: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ConceptState {
  brief: ProjectBrief;
  ideas: ConceptIdea[];
  selectedIdea: ConceptIdea | null;
  refinedConcept: string;
  isFinalized: boolean;
}

export interface GeneralDirection {
  projectName: string;
  aim: string;
  videoType: 'explainer' | 'promo' | 'tutorial' | 'testimonial' | 'brand' | 'product';
  format: '9:16' | '16:9' | '1:1';
  duration: '1.5min' | '3min';
  tone: 'warm' | 'energetic' | 'professional' | 'playful' | 'dramatic' | 'inspirational';
  cta: string;
  targetAudience: string;
  styleVideos: { url: string; file: string }[];
  characterConsistency: string;
  sceneryConsistency: string;
  styleGuide: string;
  toolPreferences: string;
  additionalNotes: string;
  generatedPrompt: string;
}

export interface BrandProfile {
  id: string;
  name: string;
  isDefault?: boolean;
  logotype: string;
  typography: string;
  colour: string;
  ctas: string;
  assets: string;
  rawText: string;
}

export enum GridTheme {
  CINEMATIC = "Cinematic lighting, hyper-realistic, 8k, detailed textures",
  ANIME = "High quality anime style, vibrant colors, clean lines, cel shaded",
  CONCEPT_ART = "Digital concept art, painterly style, moody atmospheric lighting",
  VOXEL = "Voxel art, 3D blocks, high fidelity lighting, miniature style",
  NOIR = "Black and white noir aesthetic, high contrast, dramatic shadows",
  CYBERPUNK = "Neon-drenched, futuristic city, rainy reflections, high tech",
  STUDIO = "Clean studio photography, professional lighting, sharp focus"
}
