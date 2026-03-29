import React, { useState, useEffect } from 'react';
import { loadBrands, getActiveBrandId, setActiveBrandId as persistBrandId } from '../services/brandData';
import type { BrandProfile } from '../types';

// ─── localStorage keys ──────────────────────────────────────────────────────

const LS = {
  mainModel:          'tensorax_main_model',
  mainApiKey:         'tensorax_main_api_key',
  fallbackModel:      'tensorax_fallback_model',
  fallbackApiKey:     'tensorax_fallback_api_key',
  defaultAspectRatio: 'tensorax_default_aspect_ratio',
  defaultOutputType:  'tensorax_default_output_type',
  defaultAssetDir:    'tensorax_default_asset_dir',
  // Legacy keys we also write to for backward-compat
  defaultProvider:    'tensorax_default_provider',
  mainProvider:       'tensorax_main_provider',
  fallbackProvider:   'tensorax_fallback_provider',
} as const;

// ─── Model catalogue ────────────────────────────────────────────────────────

interface ModelDef {
  id: string;
  provider: string;       // provider id for key grouping
  providerName: string;   // display name for optgroup
  keyPlaceholder: string;
  capabilities: string[];
  /** Legacy per-slot keys to sync when this model is selected as main */
  slotSync: { baseKey: string; modelKey: string; model: string }[];
}

const MODELS: ModelDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE — Text / Analysis / Vision  (Gemini API key: AIza...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'gemini-3.1-pro-preview',   provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Video Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3.1-pro-preview' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-3.1-pro-preview' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3.1-pro-preview' },
  ]},
  { id: 'gemini-3.0-pro',           provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3.0-pro' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-3.0-pro' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3.0-pro' },
  ]},
  { id: 'gemini-3-flash-preview',   provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3-flash-preview' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3-flash-preview' },
  ]},
  { id: 'gemini-3.1-flash-lite',    provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis — Budget'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3.1-flash-lite' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3.1-flash-lite' },
  ]},
  { id: 'gemini-2.5-pro',           provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-2.5-pro' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-2.5-pro' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-2.5-pro' },
  ]},
  { id: 'gemini-2.5-flash',         provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis — Fast'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-2.5-flash' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-2.5-flash' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE — Image Generation  (same Gemini API key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'imagen-4.0-generate-001',         provider: 'gemini', providerName: 'Google — Image Gen', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Image Gen — Best Quality'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'imagen-4.0-generate-001' },
  ]},
  { id: 'imagen-4.0-ultra-generate-001',   provider: 'gemini', providerName: 'Google — Image Gen', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Image Gen — Ultra Quality'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'imagen-4.0-ultra-generate-001' },
  ]},
  { id: 'imagen-4.0-fast-generate-001',    provider: 'gemini', providerName: 'Google — Image Gen', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Image Gen — Fast'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'imagen-4.0-fast-generate-001' },
  ]},
  { id: 'gemini-3.1-flash-image-preview',  provider: 'gemini', providerName: 'Google — Image Gen', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Image Gen + Edit'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'gemini-3.1-flash-image-preview' },
  ]},
  { id: 'gemini-3-pro-image-preview',      provider: 'gemini', providerName: 'Google — Image Gen', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Image Gen + Edit'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'gemini-3-pro-image-preview' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE — Video Generation (Veo)  (same Gemini API key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'veo-3.1-generate',        provider: 'gemini', providerName: 'Google — Video Gen (Veo)', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Video Gen — Best'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'veo-3.1-generate' },
  ]},
  { id: 'veo-3.1-fast',            provider: 'gemini', providerName: 'Google — Video Gen (Veo)', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Video Gen — Fast'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'veo-3.1-fast' },
  ]},
  { id: 'veo-3.0-generate-preview', provider: 'gemini', providerName: 'Google — Video Gen (Veo)', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Video Gen', 'Audio'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'veo-3.0-generate-preview' },
  ]},
  { id: 'veo-2.0-generate-001',    provider: 'gemini', providerName: 'Google — Video Gen (Veo)', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Video Gen — Stable'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'veo-2.0-generate-001' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTHROPIC CLAUDE  (key: sk-ant-...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'claude-opus-4-6',          provider: 'claude', providerName: 'Anthropic Claude', keyPlaceholder: 'sk-ant-... Claude API key', capabilities: ['Copy', 'Analysis', 'Creative Writing', 'Reasoning'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'claude-opus-4-6' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'claude-opus-4-6' },
  ]},
  { id: 'claude-sonnet-4-6',        provider: 'claude', providerName: 'Anthropic Claude', keyPlaceholder: 'sk-ant-... Claude API key', capabilities: ['Copy', 'Analysis', 'Creative Writing'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'claude-sonnet-4-6' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'claude-sonnet-4-6' },
  ]},
  { id: 'claude-haiku-4-5',         provider: 'claude', providerName: 'Anthropic Claude', keyPlaceholder: 'sk-ant-... Claude API key', capabilities: ['Analysis — Fast', 'Copy — Budget'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'claude-haiku-4-5' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'claude-haiku-4-5' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENAI — Text & Reasoning  (key: sk-...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'gpt-5.4',          provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy', 'Reasoning', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gpt-5.4' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gpt-5.4' },
  ]},
  { id: 'gpt-5.4-mini',     provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy', 'Analysis — Balanced'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gpt-5.4-mini' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gpt-5.4-mini' },
  ]},
  { id: 'o3',               provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Deep Reasoning', 'Research'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'o3' },
  ]},
  { id: 'o3-pro',           provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Max Reasoning', 'Research'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'o3-pro' },
  ]},
  { id: 'o4-mini',          provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Reasoning — Fast & Cheap'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'o4-mini' },
  ]},
  { id: 'gpt-4.1',          provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy', 'Analysis', '1M Context'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gpt-4.1' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gpt-4.1' },
  ]},
  { id: 'gpt-4.1-mini',     provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy — Fast', '1M Context'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gpt-4.1-mini' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gpt-4.1-mini' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENAI — Image Generation  (same sk-... key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'gpt-image-1.5',    provider: 'openai', providerName: 'OpenAI — Image Gen', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Image Gen — Best'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'gpt-image-1.5' },
  ]},
  { id: 'gpt-image-1',      provider: 'openai', providerName: 'OpenAI — Image Gen', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Image Gen'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'gpt-image-1' },
  ]},
  { id: 'gpt-image-1-mini', provider: 'openai', providerName: 'OpenAI — Image Gen', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Image Gen — Fast & Cheap'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'gpt-image-1-mini' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // DEEPSEEK  (key: sk-...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'deepseek-chat',      provider: 'deepseek', providerName: 'DeepSeek', keyPlaceholder: 'sk-... DeepSeek API key', capabilities: ['Copy', 'Analysis — Budget'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'deepseek-chat' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'deepseek-chat' },
  ]},
  { id: 'deepseek-reasoner',  provider: 'deepseek', providerName: 'DeepSeek', keyPlaceholder: 'sk-... DeepSeek API key', capabilities: ['Deep Reasoning — Budget'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'deepseek-reasoner' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // MISTRAL  (key: ...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'mistral-large-2512',   provider: 'mistral', providerName: 'Mistral', keyPlaceholder: 'Mistral API key', capabilities: ['Copy', 'Reasoning', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'mistral-large-2512' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'mistral-large-2512' },
  ]},
  { id: 'mistral-small-latest', provider: 'mistral', providerName: 'Mistral', keyPlaceholder: 'Mistral API key', capabilities: ['Vision', 'Analysis', 'Copy — Unified'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'mistral-small-latest' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'mistral-small-latest' },
  ]},
  { id: 'pixtral-large-2411',   provider: 'mistral', providerName: 'Mistral', keyPlaceholder: 'Mistral API key', capabilities: ['Vision', 'Image Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'pixtral-large-2411' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENROUTER — Open-Weight Models  (key: sk-or-...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'meta-llama/llama-4-maverick',               provider: 'openrouter', providerName: 'OpenRouter — Meta Llama', keyPlaceholder: 'sk-or-... OpenRouter key', capabilities: ['Vision', 'Analysis', 'Copy'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'meta-llama/llama-4-maverick' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'meta-llama/llama-4-maverick' },
  ]},
  { id: 'meta-llama/llama-4-scout',                  provider: 'openrouter', providerName: 'OpenRouter — Meta Llama', keyPlaceholder: 'sk-or-... OpenRouter key', capabilities: ['Vision', 'Analysis', '10M Context'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'meta-llama/llama-4-scout' },
  ]},
  { id: 'qwen/qwen3-vl-plus',                        provider: 'openrouter', providerName: 'OpenRouter — Qwen', keyPlaceholder: 'sk-or-... OpenRouter key', capabilities: ['Vision', 'Video Analysis', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen/qwen3-vl-plus' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'qwen/qwen3-vl-plus' },
  ]},
  { id: 'qwen/qwen3.5-plus',                         provider: 'openrouter', providerName: 'OpenRouter — Qwen', keyPlaceholder: 'sk-or-... OpenRouter key', capabilities: ['Copy', 'Analysis', 'Reasoning'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen/qwen3.5-plus' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'qwen/qwen3.5-plus' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUX / BLACK FOREST LABS — Image Gen via fal.ai  (fal.ai key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'flux-1.1-pro',       provider: 'fal', providerName: 'Flux — Image Gen (via fal.ai)', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen — Best Quality'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'flux-1.1-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},
  { id: 'flux-1-schnell',     provider: 'fal', providerName: 'Flux — Image Gen (via fal.ai)', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen — Ultra Fast'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'flux-1-schnell' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // STABILITY AI — Image Gen  (Stability API key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'stable-image-ultra',   provider: 'stability', providerName: 'Stability AI — Image Gen', keyPlaceholder: 'sk-... Stability API key', capabilities: ['Image Gen — Best Quality'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'stable-image-ultra' },
  ]},
  { id: 'sd3.5-large',          provider: 'stability', providerName: 'Stability AI — Image Gen', keyPlaceholder: 'sk-... Stability API key', capabilities: ['Image Gen'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'sd3.5-large' },
  ]},
  { id: 'sd3.5-large-turbo',    provider: 'stability', providerName: 'Stability AI — Image Gen', keyPlaceholder: 'sk-... Stability API key', capabilities: ['Image Gen — Fast'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'sd3.5-large-turbo' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENAI — Video Generation (Sora)  (same sk-... key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'sora',               provider: 'openai', providerName: 'OpenAI — Video Gen (Sora)', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Video Gen'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'sora' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // FAL.AI — Video Generation: Seedance  (fal.ai key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'seedance-2.0-pro',   provider: 'fal', providerName: 'fal.ai Seedance — Video Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Video Gen — Best', 'Lip-Sync', 'Audio'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'seedance-2.0-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},
  { id: 'seedance-1.5-pro',   provider: 'fal', providerName: 'fal.ai Seedance — Video Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Video Gen', 'Lip-Sync', 'Audio'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'seedance-1.5-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // FAL.AI — Kling: Image Gen  (fal.ai key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'kling-image-v1-pro',  provider: 'fal', providerName: 'fal.ai Kling — Image Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'kling-image-v1-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // FAL.AI — Seedance: Image Gen  (fal.ai key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'seedream-3.0',       provider: 'fal', providerName: 'fal.ai Seedream — Image Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'seedream-3.0' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // FAL.AI — Kling: Video Gen  (fal.ai key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'kling-v3-pro',       provider: 'fal', providerName: 'fal.ai Kling — Video Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Video Gen — Cinematic', 'Audio'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'kling-v3-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},
  { id: 'kling-v3-standard',  provider: 'fal', providerName: 'fal.ai Kling — Video Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Video Gen — Fast'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'kling-v3-standard' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},
  { id: 'kling-o3-pro',       provider: 'fal', providerName: 'fal.ai Kling — Video Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Video Gen', 'Voice Control', 'Multi-Shot'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'kling-o3-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // FAL.AI — Video Generation: Wan (Alibaba open-source)  (fal.ai key)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'wan-v2.2-a14b',      provider: 'fal', providerName: 'fal.ai Wan — Video Gen', keyPlaceholder: 'fal.ai API key', capabilities: ['Video Gen — Open Source'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'wan-v2.2-a14b' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // GAMMA — Presentation & Document Generation  (Gamma API key: sk-gamma-...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'gamma-v1',            provider: 'gamma', providerName: 'Gamma — Presentations & Docs', keyPlaceholder: 'sk-gamma-... API key', capabilities: ['Presentation Gen', 'Document Gen'], slotSync: [
    { baseKey: 'tensorax_gamma_key', modelKey: 'tensorax_gamma_model', model: 'gamma-v1' },
  ]},
];

// ─── Task slot definitions ──────────────────────────────────────────────────
// Each task has a specific purpose and only shows models suited for it.

type TaskTag = 'copy' | 'analysis' | 'video_analysis' | 'image_gen' | 'video_gen' | 'reasoning' | 'presentation';

interface TaskSlot {
  id: TaskTag;
  label: string;
  icon: string;
  description: string;
  modelKey: string;         // localStorage key for the primary model
  apiKeyKey: string;        // localStorage key for the primary API key
  fallbackModelKey: string; // localStorage key for fallback model
  fallbackApiKeyKey: string;// localStorage key for fallback API key
  capabilityFilter: string[];
  recommended: string;
  recommendedFallback: string;
}

const TASK_SLOTS: TaskSlot[] = [
  {
    id: 'copy',           label: 'Copywriting & Screenplay', icon: 'fa-pen-fancy',
    description: 'Concepts, scripts, dialogue, creative text',
    modelKey: 'tensorax_copy_model', apiKeyKey: 'tensorax_copy_key',
    fallbackModelKey: 'tensorax_copy_fallback_model', fallbackApiKeyKey: 'tensorax_copy_fallback_key',
    capabilityFilter: ['Copy', 'Creative Writing'],
    recommended: 'claude-opus-4-6', recommendedFallback: 'gemini-3.1-pro-preview',
  },
  {
    id: 'analysis',       label: 'Image Analysis', icon: 'fa-magnifying-glass-chart',
    description: 'Describe characters, clothing, backgrounds from reference images',
    modelKey: 'tensorax_analysis_model', apiKeyKey: 'tensorax_analysis_key',
    fallbackModelKey: 'tensorax_analysis_fallback_model', fallbackApiKeyKey: 'tensorax_analysis_fallback_key',
    capabilityFilter: ['Vision', 'Analysis'],
    recommended: 'gemini-3.1-pro-preview', recommendedFallback: 'claude-sonnet-4-6',
  },
  {
    id: 'video_analysis',  label: 'Video Analysis', icon: 'fa-film',
    description: 'Analyse video clips for continuity, style, motion',
    modelKey: 'tensorax_video_analysis_model', apiKeyKey: 'tensorax_video_analysis_key',
    fallbackModelKey: 'tensorax_video_analysis_fallback_model', fallbackApiKeyKey: 'tensorax_video_analysis_fallback_key',
    capabilityFilter: ['Video Analysis'],
    recommended: 'gemini-3.1-pro-preview', recommendedFallback: 'qwen/qwen3-vl-plus',
  },
  {
    id: 'image_gen',      label: 'Image Generation', icon: 'fa-image',
    description: 'Characters, key visuals, backgrounds, storyboard frames',
    modelKey: 'tensorax_image_model', apiKeyKey: 'tensorax_image_key',
    fallbackModelKey: 'tensorax_image_fallback_model', fallbackApiKeyKey: 'tensorax_image_fallback_key',
    capabilityFilter: ['Image Gen'],
    recommended: 'imagen-4.0-generate-001', recommendedFallback: 'gpt-image-1.5',
  },
  {
    id: 'video_gen',      label: 'Video Generation', icon: 'fa-video',
    description: 'AI video from storyboard frames and prompts',
    modelKey: 'tensorax_video_model', apiKeyKey: 'tensorax_video_key',
    fallbackModelKey: 'tensorax_video_fallback_model', fallbackApiKeyKey: 'tensorax_video_fallback_key',
    capabilityFilter: ['Video Gen'],
    recommended: 'veo-3.1-generate', recommendedFallback: 'kling-v3-pro',
  },
  {
    id: 'reasoning',      label: 'Research & Reasoning', icon: 'fa-brain',
    description: 'Deep analysis, A/B strategy, trend research, complex planning',
    modelKey: 'tensorax_reasoning_model', apiKeyKey: 'tensorax_reasoning_key',
    fallbackModelKey: 'tensorax_reasoning_fallback_model', fallbackApiKeyKey: 'tensorax_reasoning_fallback_key',
    capabilityFilter: ['Reasoning', 'Research', 'Deep Reasoning'],
    recommended: 'o3', recommendedFallback: 'claude-opus-4-6',
  },
  {
    id: 'presentation',   label: 'Presentation Generation', icon: 'fa-presentation-screen',
    description: 'AI-generated presentations, documents and decks',
    modelKey: 'tensorax_gamma_model', apiKeyKey: 'tensorax_gamma_key',
    fallbackModelKey: 'tensorax_gamma_fallback_model', fallbackApiKeyKey: 'tensorax_gamma_fallback_key',
    capabilityFilter: ['Presentation Gen', 'Document Gen'],
    recommended: 'gamma-v1', recommendedFallback: 'gamma-v1',
  },
];

// Filter models by capability tags
function getModelsForTask(slot: TaskSlot): ModelDef[] {
  return MODELS.filter(m =>
    m.capabilities.some(cap =>
      slot.capabilityFilter.some(tag => cap.includes(tag))
    )
  );
}

// Build grouped options for a filtered model list
function getGroupedModels(models: ModelDef[]) {
  const groups: { label: string; items: ModelDef[] }[] = [];
  for (const m of models) {
    let g = groups.find(x => x.label === m.providerName);
    if (!g) { g = { label: m.providerName, items: [] }; groups.push(g); }
    g.items.push(m);
  }
  return groups;
}

// ─── Section Card ───────────────────────────────────────────────────────────

const SectionCard: React.FC<{ icon: string; title: string; children: React.ReactNode; accent?: boolean }> = ({ icon, title, children, accent }) => (
  <div className={`rounded-xl p-5 shadow-sm ${accent ? 'bg-gradient-to-br from-[#f6f0f8] to-white border-2 border-[#91569c]/30' : 'bg-white border border-[#e0d6e3]'}`}>
    <div className="flex items-center gap-3 mb-4">
      <i className={`fa-solid ${icon} text-lg text-[#91569c]`} />
      <h3 className="font-bold text-sm text-[#5c3a62] uppercase tracking-wide">{title}</h3>
    </div>
    {children}
  </div>
);

// ─── Single model+key line ──────────────────────────────────────────────────

interface ModelLineProps {
  role: 'primary' | 'fallback';
  slot: TaskSlot;
  modelId: string;
  apiKey: string;
  onModelChange: (id: string) => void;
  onApiKeyChange: (key: string) => void;
  onSave: () => void;
  saved: boolean;
}

const ModelLine: React.FC<ModelLineProps> = ({ role, slot, modelId, apiKey, onModelChange, onApiKeyChange, onSave, saved }) => {
  const model = MODELS.find(m => m.id === modelId);
  const available = getModelsForTask(slot);
  const groups = getGroupedModels(available);
  const rec = role === 'primary' ? slot.recommended : slot.recommendedFallback;

  return (
    <div className="flex gap-2 items-center">
      <span className={`text-[8px] font-black uppercase tracking-wider w-14 text-right ${
        role === 'primary' ? 'text-[#91569c]' : 'text-[#aaa]'
      }`}>
        {role === 'primary' ? '★ Main' : 'Fallback'}
      </span>
      <select
        value={modelId}
        onChange={(e) => onModelChange(e.target.value)}
        className="w-56 bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-2.5 py-1.5 text-[11px] text-[#3a3a3a] outline-none focus:ring-2 focus:ring-[#91569c]/30 cursor-pointer font-medium"
      >
        <option value="">Select model...</option>
        {groups.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map(m => (
              <option key={m.id} value={m.id}>
                {m.id}{m.id === rec ? ' ★' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        placeholder={model?.keyPlaceholder ?? 'API key...'}
        className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-2.5 py-1.5 text-[11px] text-[#3a3a3a] placeholder:text-[#aaa] outline-none focus:ring-2 focus:ring-[#91569c]/30"
      />
      <button
        onClick={onSave}
        disabled={!modelId || !apiKey.trim()}
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all min-w-[56px]
          ${saved
            ? 'bg-green-500 text-white'
            : 'bg-[#91569c] text-white hover:bg-[#5c3a62] disabled:opacity-30 disabled:cursor-not-allowed'
          }`}
      >
        {saved ? <><i className="fa-solid fa-check mr-0.5" />OK</> : 'Save'}
      </button>
    </div>
  );
};

// ─── Per-Task Row (primary + fallback) ──────────────────────────────────────

interface TaskRowProps {
  slot: TaskSlot;
  primary: { model: string; key: string };
  fallback: { model: string; key: string };
  onPrimaryModelChange: (id: string) => void;
  onPrimaryKeyChange: (key: string) => void;
  onPrimarySave: () => void;
  primarySaved: boolean;
  onFallbackModelChange: (id: string) => void;
  onFallbackKeyChange: (key: string) => void;
  onFallbackSave: () => void;
  fallbackSaved: boolean;
}

const TaskRow: React.FC<TaskRowProps> = (props) => {
  const { slot } = props;
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 mb-1.5">
        <i className={`fa-solid ${slot.icon} text-[#91569c] text-xs w-4 text-center`} />
        <span className="text-[11px] font-black text-[#5c3a62] uppercase tracking-wide">{slot.label}</span>
        <span className="text-[9px] text-[#aaa]">— {slot.description}</span>
      </div>
      <div className="space-y-1.5 ml-6">
        <ModelLine role="primary" slot={slot}
          modelId={props.primary.model} apiKey={props.primary.key}
          onModelChange={props.onPrimaryModelChange} onApiKeyChange={props.onPrimaryKeyChange}
          onSave={props.onPrimarySave} saved={props.primarySaved}
        />
        <ModelLine role="fallback" slot={slot}
          modelId={props.fallback.model} apiKey={props.fallback.key}
          onModelChange={props.onFallbackModelChange} onApiKeyChange={props.onFallbackKeyChange}
          onSave={props.onFallbackSave} saved={props.fallbackSaved}
        />
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const GlobalSettings: React.FC = () => {
  const [brands] = useState<BrandProfile[]>(() => loadBrands());
  const [activeBrand, setActiveBrand] = useState(() => getActiveBrandId());
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem(LS.defaultAspectRatio) ?? '9:16');
  const [outputType, setOutputType] = useState(() => localStorage.getItem(LS.defaultOutputType) ?? 'video');
  const [assetDir, setAssetDir] = useState(() => localStorage.getItem(LS.defaultAssetDir) ?? '');

  // Per-task primary + fallback state
  type SlotPair = { model: string; key: string };
  const [primary, setPrimary] = useState<Record<string, SlotPair>>(() => {
    const s: Record<string, SlotPair> = {};
    for (const slot of TASK_SLOTS) s[slot.id] = { model: localStorage.getItem(slot.modelKey) ?? '', key: localStorage.getItem(slot.apiKeyKey) ?? '' };
    return s;
  });
  const [fallback, setFallback] = useState<Record<string, SlotPair>>(() => {
    const s: Record<string, SlotPair> = {};
    for (const slot of TASK_SLOTS) s[slot.id] = { model: localStorage.getItem(slot.fallbackModelKey) ?? '', key: localStorage.getItem(slot.fallbackApiKeyKey) ?? '' };
    return s;
  });
  const [savedSlots, setSavedSlots] = useState<Record<string, boolean>>({});

  useEffect(() => { localStorage.setItem(LS.defaultAspectRatio, aspectRatio); }, [aspectRatio]);
  useEffect(() => { localStorage.setItem(LS.defaultOutputType, outputType); }, [outputType]);
  useEffect(() => {
    if (assetDir) localStorage.setItem(LS.defaultAssetDir, assetDir);
    else localStorage.removeItem(LS.defaultAssetDir);
  }, [assetDir]);
  useEffect(() => { persistBrandId(activeBrand); }, [activeBrand]);

  const updateSlot = (which: 'primary' | 'fallback', slotId: string, field: 'model' | 'key', value: string) => {
    const setter = which === 'primary' ? setPrimary : setFallback;
    setter(prev => ({ ...prev, [slotId]: { ...prev[slotId], [field]: value } }));
  };

  const saveSlot = (slot: TaskSlot, which: 'primary' | 'fallback') => {
    const data = which === 'primary' ? primary[slot.id] : fallback[slot.id];
    if (!data.model || !data.key.trim()) return;
    const model = MODELS.find(m => m.id === data.model);
    if (!model) return;

    const mKey = which === 'primary' ? slot.modelKey : slot.fallbackModelKey;
    const aKey = which === 'primary' ? slot.apiKeyKey : slot.fallbackApiKeyKey;

    localStorage.setItem(mKey, data.model);
    localStorage.setItem(aKey, data.key.trim());
    localStorage.setItem(`${aKey}__${data.model}`, data.key.trim());

    if (which === 'primary' && !localStorage.getItem(LS.defaultProvider)) {
      localStorage.setItem(LS.defaultProvider, model.provider);
    }

    const tag = `${slot.id}_${which}`;
    setSavedSlots(prev => ({ ...prev, [tag]: true }));
    setTimeout(() => setSavedSlots(prev => ({ ...prev, [tag]: false })), 2000);
  };

  const anyConfigured = TASK_SLOTS.some(s => primary[s.id].model && primary[s.id].key);

  const [browseError, setBrowseError] = useState('');
  const browseDirectory = async () => {
    setBrowseError('');
    try {
      const res = await fetch('/api/db/projects/pick-directory', { method: 'POST' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (data.path) {
        setAssetDir(data.path);
        setBrowseError('');
      }
    } catch {
      setBrowseError('Browse needs the full server running (npm run dev:full). You can type the path directly instead.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#5c3a62] uppercase tracking-wide">Settings</h2>
          <p className="text-sm text-[#888] mt-1">Pick the best model for each task — each dropdown only shows models suited for that job</p>
        </div>

        {/* ── Per-Task AI Models ── */}
        <SectionCard icon="fa-key" title="AI Models — Best of Breed" accent>
          {!anyConfigured && (
            <div className="mb-4 p-3 rounded-lg bg-[#f6f0f8] border border-[#ceadd4] flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-[#91569c] mt-0.5" />
              <p className="text-xs text-[#5c3a62]">
                Choose the <strong>best model for each task</strong>. Stars (★) mark recommended picks. Models sharing the same provider can reuse the same API key.
              </p>
            </div>
          )}

          <div className="divide-y divide-[#e0d6e3]">
            {TASK_SLOTS.map(slot => (
              <TaskRow
                key={slot.id}
                slot={slot}
                primary={primary[slot.id]}
                fallback={fallback[slot.id]}
                onPrimaryModelChange={(id) => updateSlot('primary', slot.id, 'model', id)}
                onPrimaryKeyChange={(k) => updateSlot('primary', slot.id, 'key', k)}
                onPrimarySave={() => saveSlot(slot, 'primary')}
                primarySaved={!!savedSlots[`${slot.id}_primary`]}
                onFallbackModelChange={(id) => updateSlot('fallback', slot.id, 'model', id)}
                onFallbackKeyChange={(k) => updateSlot('fallback', slot.id, 'key', k)}
                onFallbackSave={() => saveSlot(slot, 'fallback')}
                fallbackSaved={!!savedSlots[`${slot.id}_fallback`]}
              />
            ))}
          </div>
        </SectionCard>

        {/* ── Default Brand ── */}
        <SectionCard icon="fa-palette" title="Default Brand">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-sm text-[#3a3a3a] outline-none focus:ring-1 focus:ring-[#91569c]/50 cursor-pointer"
          >
            <option value="">No brand (unbranded)</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (Default)' : ''}</option>
            ))}
          </select>
          <p className="text-[9px] text-[#888] mt-2">New projects will use this brand unless you choose differently.</p>
        </SectionCard>

        {/* ── Default Format ── */}
        <SectionCard icon="fa-crop-simple" title="Default Format">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">Aspect Ratio</label>
              <div className="flex gap-2">
                {(['9:16', '16:9', '1:1'] as const).map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase border transition-all
                      ${aspectRatio === ar
                        ? 'bg-[#91569c] text-white border-[#91569c]'
                        : 'bg-[#f6f0f8] text-[#5c3a62] border-[#ceadd4] hover:border-[#91569c]/50'
                      }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#5c3a62] uppercase tracking-wide mb-1.5">Output Type</label>
              <select
                value={outputType}
                onChange={(e) => setOutputType(e.target.value)}
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] outline-none focus:ring-1 focus:ring-[#91569c]/50 cursor-pointer"
              >
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>
          <p className="text-[9px] text-[#888] mt-2">Applied to new projects by default. Change per-project in Project Settings.</p>
        </SectionCard>

        {/* ── Asset Directory ── */}
        <SectionCard icon="fa-folder-open" title="Default Asset Directory">
          <div className="flex gap-2">
            <input
              type="text"
              value={assetDir}
              onChange={(e) => { setAssetDir(e.target.value); setBrowseError(''); }}
              placeholder="Type or paste the full path, e.g. C:\Users\marie\Documents\TensorAx Assets"
              className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-3 py-2.5 text-[11px] text-[#3a3a3a] placeholder:text-[#888] outline-none focus:ring-1 focus:ring-[#91569c]/50"
            />
            <button
              onClick={browseDirectory}
              className="px-4 py-2.5 rounded-lg text-[10px] font-black uppercase bg-[#f6f0f8] text-[#5c3a62] border border-[#ceadd4] hover:bg-[#eadcef] transition-colors"
            >
              <i className="fa-solid fa-folder-open mr-1.5" />Browse
            </button>
          </div>
          {browseError && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-amber-500 text-[9px] mt-0.5" />
              <p className="text-[9px] text-amber-700">{browseError}</p>
            </div>
          )}
          {assetDir && !browseError && (
            <div className="mt-2 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-green-500 text-[9px]" />
              <p className="text-[9px] text-green-700">Saved — assets will be stored in: <strong>{assetDir}</strong></p>
            </div>
          )}
          {!assetDir && (
            <p className="text-[9px] text-[#888] mt-2">Type the full folder path where project files should be saved. Each project gets its own subfolder.</p>
          )}
        </SectionCard>

        <div className="h-6" />
      </div>
    </div>
  );
};
