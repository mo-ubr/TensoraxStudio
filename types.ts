
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

export type VideoMode = 'prompt-only' | 'prompt-images' | 'prompt-images-video';

export interface VideoState {
  mode: VideoMode;
  prompt: string;
  startImage?: string;
  midImage?: string;
  endImage?: string;
  movementDescription: string;
  movementVideo?: string;
  duration: '5s' | '10s';
  isGenerating: boolean;
  progressMessage: string;
  resultUrl?: string;
  selectedSceneIndex?: number;
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

// ─── Templates ────────────────────────────────────────────────────────────────

export type TemplateId = 'what-if-transformation';

export interface ProjectTemplate {
  id: TemplateId;
  name: string;
  description: string;
  icon: string;
  steps: string[];
  /** Default transformation prompt hint */
  defaultPrompt?: string;
}

/** A single transformation stage (keyframe) */
export interface TransformationStage {
  id: number;
  label: string;           // e.g. "Initial Cleanup"
  prompt: string;          // Flux Kontext edit prompt for this stage
  imageUrl?: string;       // Generated keyframe image URL
  isGenerating?: boolean;
}

/** A video segment between two keyframes */
export interface VideoSegment {
  id: number;
  startStageId: number;
  endStageId: number;
  prompt: string;          // Motion prompt for this segment
  videoUrl?: string;       // Generated video segment URL
  isGenerating?: boolean;
}

export interface TemplateState {
  templateId: TemplateId;
  step: number;
  beforeImage?: string;           // data-URI or URL of uploaded source image
  referenceVideo?: string;        // data-URI of uploaded reference video
  referenceVideoName?: string;    // filename for display
  videoAnalysis?: string;         // Gemini analysis of the reference video
  stages: TransformationStage[];  // Keyframe stages (editable)
  segments: VideoSegment[];       // Video segments between keyframes
  finalVideoUrl?: string;         // Final stitched video URL
  isGenerating: boolean;
  progressMessage: string;
  error?: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'what-if-transformation',
    name: 'What If? Transformation',
    description: 'Upload a reference video and starting image. The AI extracts transformation stages, generates keyframe images for each stage, then creates video segments between them.',
    icon: 'fa-wand-magic-sparkles',
    steps: ['Settings', 'Upload & Analyse', 'Generate Images', 'Generate Videos', 'Concatenate'],
    defaultPrompt: '',
  },
];

export enum GridTheme {
  CINEMATIC = "Cinematic lighting, hyper-realistic, 8k, detailed textures",
  ANIME = "High quality anime style, vibrant colors, clean lines, cel shaded",
  CONCEPT_ART = "Digital concept art, painterly style, moody atmospheric lighting",
  VOXEL = "Voxel art, 3D blocks, high fidelity lighting, miniature style",
  NOIR = "Black and white noir aesthetic, high contrast, dramatic shadows",
  CYBERPUNK = "Neon-drenched, futuristic city, rainy reflections, high tech",
  STUDIO = "Clean studio photography, professional lighting, sharp focus"
}
