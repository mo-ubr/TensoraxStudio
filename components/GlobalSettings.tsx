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
  notifyEmail:        'tensorax_notify_email',
  notifyMethod:       'tensorax_notify_method',       // 'email' | 'in-app' | 'both'
  // Legacy keys we also write to for backward-compat
  defaultProvider:    'tensorax_default_provider',
  mainProvider:       'tensorax_main_provider',
  fallbackProvider:   'tensorax_fallback_provider',
} as const;

// ─── Provider Registry ─────────────────────────────────────────────────────
// One API key per provider. All models from the same provider share the key.

interface ProviderDef {
  id: string;
  name: string;
  keyPlaceholder: string;
  icon: string;
  storageKey: string;       // localStorage key for this provider's API key
  legacyKeys: string[];     // legacy per-slot keys to sync into for backward-compat
}

const PROVIDERS: ProviderDef[] = [
  { id: 'gemini',    name: 'Google (Gemini / Imagen / Veo)',   keyPlaceholder: 'AIza... Gemini API key',     icon: 'fa-google',       storageKey: 'tensorax_provider_key__gemini',    legacyKeys: ['tensorax_analysis_key', 'tensorax_video_analysis_key', 'tensorax_copy_key', 'tensorax_image_key', 'tensorax_video_key'] },
  { id: 'claude',    name: 'Anthropic Claude',                 keyPlaceholder: 'sk-ant-... Claude API key',   icon: 'fa-robot',        storageKey: 'tensorax_provider_key__claude',    legacyKeys: ['tensorax_analysis_key', 'tensorax_copy_key'] },
  { id: 'openai',    name: 'OpenAI (GPT / DALL-E / Sora)',     keyPlaceholder: 'sk-... OpenAI API key',       icon: 'fa-circle-nodes', storageKey: 'tensorax_provider_key__openai',    legacyKeys: ['tensorax_analysis_key', 'tensorax_copy_key', 'tensorax_image_key', 'tensorax_video_key'] },
  { id: 'dashscope', name: 'Alibaba DashScope (all Qwen)',     keyPlaceholder: 'DashScope API key',           icon: 'fa-cloud',        storageKey: 'tensorax_provider_key__dashscope', legacyKeys: ['tensorax_analysis_key', 'tensorax_video_analysis_key', 'tensorax_copy_key', 'tensorax_image_key'] },
  { id: 'openrouter',name: 'OpenRouter',                       keyPlaceholder: 'sk-or-... OpenRouter key',    icon: 'fa-route',        storageKey: 'tensorax_provider_key__openrouter',legacyKeys: ['tensorax_analysis_key', 'tensorax_video_analysis_key', 'tensorax_copy_key'] },
  { id: 'fal',       name: 'fal.ai (Flux / Seedance / Kling)', keyPlaceholder: 'fal.ai API key',              icon: 'fa-bolt',         storageKey: 'tensorax_provider_key__fal',       legacyKeys: ['tensorax_image_key', 'tensorax_video_key', 'tensorax_fal_key'] },
  { id: 'stability', name: 'Stability AI',                     keyPlaceholder: 'sk-... Stability API key',    icon: 'fa-mountain',     storageKey: 'tensorax_provider_key__stability', legacyKeys: ['tensorax_image_key'] },
  { id: 'mistral',   name: 'Mistral',                          keyPlaceholder: 'Mistral API key',             icon: 'fa-wind',         storageKey: 'tensorax_provider_key__mistral',   legacyKeys: ['tensorax_analysis_key', 'tensorax_copy_key'] },
  { id: 'deepseek',  name: 'DeepSeek',                         keyPlaceholder: 'sk-... DeepSeek API key',     icon: 'fa-water',        storageKey: 'tensorax_provider_key__deepseek',  legacyKeys: ['tensorax_analysis_key', 'tensorax_copy_key'] },
  { id: 'shotstack', name: 'Shotstack',                        keyPlaceholder: 'Shotstack API key',           icon: 'fa-clapperboard', storageKey: 'tensorax_provider_key__shotstack', legacyKeys: ['tensorax_shotstack_key'] },
  { id: 'elevenlabs',name: 'ElevenLabs (TTS / Voice)',         keyPlaceholder: 'ElevenLabs API key',          icon: 'fa-microphone',   storageKey: 'tensorax_provider_key__elevenlabs',legacyKeys: ['tensorax_audio_key'] },
  { id: 'runway',    name: 'Runway',                           keyPlaceholder: 'Runway API key',              icon: 'fa-film',         storageKey: 'tensorax_provider_key__runway',    legacyKeys: ['tensorax_video_key'] },
  { id: 'apify',     name: 'Apify (Web Scraping)',              keyPlaceholder: 'apify_api_... Apify token',   icon: 'fa-spider',       storageKey: 'tensorax_provider_key__apify',     legacyKeys: [] },
];

/** Get the provider API key from localStorage */
function getProviderKey(providerId: string): string {
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) return '';
  try { return localStorage.getItem(provider.storageKey)?.trim() || ''; } catch { return ''; }
}

/** Save a provider key and sync to all legacy per-slot keys */
function saveProviderKey(providerId: string, key: string) {
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) return;
  const trimmed = key.trim();
  try {
    localStorage.setItem(provider.storageKey, trimmed);
    // Sync to legacy keys so existing services keep working
    for (const legacyKey of provider.legacyKeys) {
      localStorage.setItem(legacyKey, trimmed);
    }
  } catch { /* ignore */ }
}

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
  { id: 'gemini-3.1-pro-preview',   provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Video Analysis', 'Translation'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3.1-pro-preview' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-3.1-pro-preview' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3.1-pro-preview' },
  ]},
  { id: 'gemini-3.0-pro',           provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Video Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3.0-pro' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-3.0-pro' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3.0-pro' },
  ]},
  { id: 'gemini-3-flash-preview',   provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Video Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3-flash-preview' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-3-flash-preview' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3-flash-preview' },
  ]},
  { id: 'gemini-3.1-flash-lite',    provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis — Budget', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-3.1-flash-lite' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-3.1-flash-lite' },
  ]},
  { id: 'gemini-2.5-pro',           provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Video Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-2.5-pro' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-2.5-pro' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gemini-2.5-pro' },
  ]},
  { id: 'gemini-2.5-flash',         provider: 'gemini', providerName: 'Google — Text & Analysis', keyPlaceholder: 'AIza... Gemini API key', capabilities: ['Copy', 'Analysis — Fast', 'Vision', 'Video Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gemini-2.5-flash' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gemini-2.5-flash' },
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
  { id: 'claude-opus-4-6',          provider: 'claude', providerName: 'Anthropic Claude', keyPlaceholder: 'sk-ant-... Claude API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Creative Writing', 'Reasoning'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'claude-opus-4-6' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'claude-opus-4-6' },
  ]},
  { id: 'claude-sonnet-4-6',        provider: 'claude', providerName: 'Anthropic Claude', keyPlaceholder: 'sk-ant-... Claude API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Creative Writing'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'claude-sonnet-4-6' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'claude-sonnet-4-6' },
  ]},
  { id: 'claude-haiku-4-5',         provider: 'claude', providerName: 'Anthropic Claude', keyPlaceholder: 'sk-ant-... Claude API key', capabilities: ['Analysis — Fast', 'Vision', 'Copy — Budget'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'claude-haiku-4-5' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'claude-haiku-4-5' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENAI — Text & Reasoning  (key: sk-...)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'gpt-5.4',          provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy', 'Reasoning', 'Analysis', 'Vision', 'Video Analysis', 'Translation'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gpt-5.4' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gpt-5.4' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gpt-5.4' },
  ]},
  { id: 'gpt-5.4-mini',     provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy', 'Analysis — Balanced', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gpt-5.4-mini' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gpt-5.4-mini' },
  ]},
  { id: 'o3',               provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Deep Reasoning', 'Research', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'o3' },
  ]},
  { id: 'o3-pro',           provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Max Reasoning', 'Research', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'o3-pro' },
  ]},
  { id: 'o4-mini',          provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Reasoning — Fast & Cheap', 'Vision'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'o4-mini' },
  ]},
  { id: 'gpt-4.1',          provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Video Analysis', '1M Context'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'gpt-4.1' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'gpt-4.1' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'gpt-4.1' },
  ]},
  { id: 'gpt-4.1-mini',     provider: 'openai', providerName: 'OpenAI — Text & Reasoning', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['Copy — Fast', 'Vision', '1M Context'], slotSync: [
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
  // ASR
  { id: 'whisper-v3',         provider: 'openai', providerName: 'OpenAI — ASR (Whisper)', keyPlaceholder: 'sk-... OpenAI API key', capabilities: ['ASR'], slotSync: [] },

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
  { id: 'meta-llama/llama-4-maverick',               provider: 'openrouter', providerName: 'OpenRouter — Meta Llama', keyPlaceholder: 'sk-or-... OpenRouter key', capabilities: ['Vision', 'Analysis', 'Video Analysis', 'Copy'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'meta-llama/llama-4-maverick' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'meta-llama/llama-4-maverick' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'meta-llama/llama-4-maverick' },
  ]},
  { id: 'meta-llama/llama-4-scout',                  provider: 'openrouter', providerName: 'OpenRouter — Meta Llama', keyPlaceholder: 'sk-or-... OpenRouter key', capabilities: ['Vision', 'Analysis', 'Video Analysis', '10M Context'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'meta-llama/llama-4-scout' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'meta-llama/llama-4-scout' },
  ]},
  // ═══════════════════════════════════════════════════════════════════════════
  // ALIBABA DASHSCOPE — All Qwen Models  (single DashScope API key)
  // ═══════════════════════════════════════════════════════════════════════════
  // Text models
  { id: 'qwen3-235b-a22b',             provider: 'dashscope', providerName: 'Qwen — Flagship', keyPlaceholder: 'DashScope API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Reasoning', 'Research', 'Creative Writing'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen3-235b-a22b' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'qwen3-235b-a22b' },
  ]},
  { id: 'qwen3-32b',                   provider: 'dashscope', providerName: 'Qwen — Text', keyPlaceholder: 'DashScope API key', capabilities: ['Copy', 'Analysis', 'Vision', 'Creative Writing'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen3-32b' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'qwen3-32b' },
  ]},
  { id: 'qwen3-30b-a3b',               provider: 'dashscope', providerName: 'Qwen — Text', keyPlaceholder: 'DashScope API key', capabilities: ['Copy', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen3-30b-a3b' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'qwen3-30b-a3b' },
  ]},
  { id: 'qwen3-14b',                   provider: 'dashscope', providerName: 'Qwen — Text', keyPlaceholder: 'DashScope API key', capabilities: ['Copy', 'Analysis — Budget'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen3-14b' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'qwen3-14b' },
  ]},
  // Reasoning
  { id: 'qwq-32b',                     provider: 'dashscope', providerName: 'Qwen — Reasoning', keyPlaceholder: 'DashScope API key', capabilities: ['Reasoning', 'Deep Reasoning', 'Research'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwq-32b' },
  ]},
  // Vision / Multimodal
  { id: 'qwen-vl-max',                 provider: 'dashscope', providerName: 'Qwen — Vision', keyPlaceholder: 'DashScope API key', capabilities: ['Vision', 'Video Analysis', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen-vl-max' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'qwen-vl-max' },
  ]},
  { id: 'qwen2.5-vl-32b-instruct',     provider: 'dashscope', providerName: 'Qwen — Vision', keyPlaceholder: 'DashScope API key', capabilities: ['Vision', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen2.5-vl-32b-instruct' },
  ]},
  { id: 'qwen2.5-omni-7b',             provider: 'dashscope', providerName: 'Qwen — Omni', keyPlaceholder: 'DashScope API key', capabilities: ['Vision', 'Video Analysis', 'Analysis', 'Copy'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen2.5-omni-7b' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'qwen2.5-omni-7b' },
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'qwen2.5-omni-7b' },
  ]},
  // Image gen / edit
  { id: 'qwen-image-plus',             provider: 'dashscope', providerName: 'Qwen — Image Gen', keyPlaceholder: 'DashScope API key', capabilities: ['Image Gen — Text Rendering'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'qwen-image-plus' },
  ]},
  { id: 'qwen-image-edit-plus',        provider: 'dashscope', providerName: 'Qwen — Image Gen', keyPlaceholder: 'DashScope API key', capabilities: ['Image Gen — Edit'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'qwen-image-edit-plus' },
  ]},
  // OCR
  { id: 'qwen-ocr',                    provider: 'dashscope', providerName: 'Qwen — OCR', keyPlaceholder: 'DashScope API key', capabilities: ['Vision', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen-ocr' },
  ]},
  // Translation
  { id: 'qwen-mt-turbo',               provider: 'dashscope', providerName: 'Qwen — Translation', keyPlaceholder: 'DashScope API key', capabilities: ['Copy', 'Translation'], slotSync: [
    { baseKey: 'tensorax_copy_key', modelKey: 'tensorax_copy_model', model: 'qwen-mt-turbo' },
  ]},
  // Coding
  { id: 'qwen3-coder-plus',            provider: 'dashscope', providerName: 'Qwen — Coding', keyPlaceholder: 'DashScope API key', capabilities: ['Copy', 'Reasoning'], slotSync: [] },
  { id: 'qwen3-coder-next',            provider: 'dashscope', providerName: 'Qwen — Coding', keyPlaceholder: 'DashScope API key', capabilities: ['Copy'], slotSync: [] },
  // Safety
  { id: 'qwen3-guard',                 provider: 'dashscope', providerName: 'Qwen — Safety', keyPlaceholder: 'DashScope API key', capabilities: ['Analysis'], slotSync: [] },
  // ASR
  { id: 'qwen3-asr-flash',             provider: 'dashscope', providerName: 'Qwen — ASR', keyPlaceholder: 'DashScope API key', capabilities: ['ASR'], slotSync: [] },
  // Vision — Flagship
  { id: 'qwen3-vl-235b',               provider: 'dashscope', providerName: 'Qwen — Vision', keyPlaceholder: 'DashScope API key', capabilities: ['Vision', 'Video Analysis', 'Analysis'], slotSync: [
    { baseKey: 'tensorax_analysis_key', modelKey: 'tensorax_analysis_model', model: 'qwen3-vl-235b' },
    { baseKey: 'tensorax_video_analysis_key', modelKey: 'tensorax_video_analysis_model', model: 'qwen3-vl-235b' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENROUTER — Open-Weight Models (non-Qwen)  (key: sk-or-...)
  // Qwen-Plus aliases still available via OpenRouter for those who prefer it
  // ═══════════════════════════════════════════════════════════════════════════
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
  { id: 'flux-2-pro',         provider: 'fal', providerName: 'Flux 2 — Image Gen (via fal.ai)', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen — Best Quality'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'flux-2-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},
  { id: 'flux-2-dev',         provider: 'fal', providerName: 'Flux 2 — Image Gen (via fal.ai)', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'flux-2-dev' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},
  { id: 'flux-kontext-pro',   provider: 'fal', providerName: 'Flux Kontext — Image Edit (via fal.ai)', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen + Edit'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'flux-kontext-pro' },
    { baseKey: 'tensorax_fal_key', modelKey: '', model: '' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEOGRAM — Image Gen (Text Rendering)  via fal.ai
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'ideogram-3.0',       provider: 'fal', providerName: 'Ideogram — Image Gen (via fal.ai)', keyPlaceholder: 'fal.ai API key', capabilities: ['Image Gen — Text Rendering'], slotSync: [
    { baseKey: 'tensorax_image_key', modelKey: 'tensorax_image_model', model: 'ideogram-3.0' },
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
  // ELEVENLABS — Text-to-Speech / Voice Cloning
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'elevenlabs-tts',     provider: 'elevenlabs', providerName: 'ElevenLabs — TTS', keyPlaceholder: 'ElevenLabs API key', capabilities: ['TTS'], slotSync: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUNWAY — Video Generation
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'runway-gen-4.5',     provider: 'runway', providerName: 'Runway — Video Gen', keyPlaceholder: 'Runway API key', capabilities: ['Video Gen — Cinematic'], slotSync: [
    { baseKey: 'tensorax_video_key', modelKey: 'tensorax_video_model', model: 'runway-gen-4.5' },
  ]},
];

// ─── Task slot definitions ──────────────────────────────────────────────────
// Each task has a specific purpose and only shows models suited for it.

type TaskTag = 'copy' | 'analysis' | 'video_analysis' | 'image_gen' | 'video_gen' | 'reasoning' | 'translation' | 'audio';

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
    recommended: 'gemini-3.1-pro-preview', recommendedFallback: 'qwen-vl-max',
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
    id: 'translation',   label: 'Translation & Localisation', icon: 'fa-language',
    description: 'Content translation across BG/GR/EN and 119+ languages',
    modelKey: 'tensorax_translation_model', apiKeyKey: 'tensorax_translation_key',
    fallbackModelKey: 'tensorax_translation_fallback_model', fallbackApiKeyKey: 'tensorax_translation_fallback_key',
    capabilityFilter: ['Translation'],
    recommended: 'qwen-mt-turbo', recommendedFallback: 'gemini-3.1-pro-preview',
  },
  {
    id: 'audio',          label: 'Audio (TTS & ASR)', icon: 'fa-headphones',
    description: 'Voiceover, speech recognition, audio generation',
    modelKey: 'tensorax_audio_model', apiKeyKey: 'tensorax_audio_key',
    fallbackModelKey: 'tensorax_audio_fallback_model', fallbackApiKeyKey: 'tensorax_audio_fallback_key',
    capabilityFilter: ['TTS', 'ASR'],
    recommended: 'elevenlabs-tts', recommendedFallback: 'whisper-v3',
  },
  {
    id: 'sm_research',   label: 'Social Media Research', icon: 'fa-microscope',
    description: 'Scrape TikTok/Facebook/Instagram/YouTube, build dashboards, analyse engagement, generate recommendations',
    modelKey: 'tensorax_sm_research_model', apiKeyKey: 'tensorax_provider_key__apify',
    fallbackModelKey: 'tensorax_sm_research_fallback_model', fallbackApiKeyKey: 'tensorax_sm_research_fallback_key',
    capabilityFilter: ['Reasoning', 'Research'],
    recommended: 'gemini-2.5-pro', recommendedFallback: 'claude-opus-4-6',
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

// ─── Single model line (no API key — keys are per-provider now) ─────────────

interface ModelLineProps {
  role: 'primary' | 'fallback';
  slot: TaskSlot;
  modelId: string;
  onModelChange: (id: string) => void;
}

const ModelLine: React.FC<ModelLineProps> = ({ role, slot, modelId, onModelChange }) => {
  const model = MODELS.find(m => m.id === modelId);
  const available = getModelsForTask(slot);
  const groups = getGroupedModels(available);
  const rec = role === 'primary' ? slot.recommended : slot.recommendedFallback;
  const hasKey = model ? !!getProviderKey(model.provider) : false;

  return (
    <div className="flex gap-2 items-center">
      <span className={`text-[8px] font-black uppercase tracking-wider w-14 text-right ${
        role === 'primary' ? 'text-[#91569c]' : 'text-[#aaa]'
      }`}>
        {role === 'primary' ? '★ Main' : 'Fallback'}
      </span>
      <select
        value={modelId}
        onChange={(e) => {
          const newId = e.target.value;
          onModelChange(newId);
          // Auto-save model selection to localStorage
          const mKey = role === 'primary' ? slot.modelKey : slot.fallbackModelKey;
          if (newId) localStorage.setItem(mKey, newId);
        }}
        className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-2.5 py-1.5 text-[11px] text-[#3a3a3a] outline-none focus:ring-2 focus:ring-[#91569c]/30 cursor-pointer font-medium"
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
      {model && (
        <span className={`text-[8px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
          hasKey ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        }`}>
          {hasKey ? <><i className="fa-solid fa-check text-[7px] mr-0.5" />{model.provider}</> : <><i className="fa-solid fa-key text-[7px] mr-0.5" />{model.provider} — no key</>}
        </span>
      )}
    </div>
  );
};

// ─── Per-Task Row (primary + fallback) ──────────────────────────────────────

interface TaskRowProps {
  slot: TaskSlot;
  primaryModel: string;
  fallbackModel: string;
  onPrimaryModelChange: (id: string) => void;
  onFallbackModelChange: (id: string) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ slot, primaryModel, fallbackModel, onPrimaryModelChange, onFallbackModelChange }) => (
  <div className="py-3 first:pt-0 last:pb-0">
    <div className="flex items-center gap-2 mb-1.5">
      <i className={`fa-solid ${slot.icon} text-[#91569c] text-xs w-4 text-center`} />
      <span className="text-[11px] font-black text-[#5c3a62] uppercase tracking-wide">{slot.label}</span>
      <span className="text-[9px] text-[#aaa]">— {slot.description}</span>
    </div>
    <div className="space-y-1.5 ml-6">
      <ModelLine role="primary" slot={slot} modelId={primaryModel} onModelChange={onPrimaryModelChange} />
      <ModelLine role="fallback" slot={slot} modelId={fallbackModel} onModelChange={onFallbackModelChange} />
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export const GlobalSettings: React.FC = () => {
  const [brands] = useState<BrandProfile[]>(() => loadBrands());
  const [activeBrand, setActiveBrand] = useState(() => getActiveBrandId());
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem(LS.defaultAspectRatio) ?? '9:16');
  const [outputType, setOutputType] = useState(() => localStorage.getItem(LS.defaultOutputType) ?? 'video');
  const [assetDir, setAssetDir] = useState(() => localStorage.getItem(LS.defaultAssetDir) ?? '');
  const [notifyEmail, setNotifyEmail] = useState(() => localStorage.getItem(LS.notifyEmail) ?? '');
  const [notifyMethod, setNotifyMethod] = useState(() => localStorage.getItem(LS.notifyMethod) ?? 'both');

  // Provider keys state
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>(() => {
    const keys: Record<string, string> = {};
    for (const p of PROVIDERS) keys[p.id] = getProviderKey(p.id);
    return keys;
  });
  const [savedProviders, setSavedProviders] = useState<Record<string, boolean>>({});

  // Per-task model selections (no keys — those come from providers now)
  const [primaryModels, setPrimaryModels] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    for (const slot of TASK_SLOTS) s[slot.id] = localStorage.getItem(slot.modelKey) ?? '';
    return s;
  });
  const [fallbackModels, setFallbackModels] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    for (const slot of TASK_SLOTS) s[slot.id] = localStorage.getItem(slot.fallbackModelKey) ?? '';
    return s;
  });

  useEffect(() => { localStorage.setItem(LS.defaultAspectRatio, aspectRatio); }, [aspectRatio]);
  useEffect(() => { localStorage.setItem(LS.defaultOutputType, outputType); }, [outputType]);
  useEffect(() => {
    if (assetDir) localStorage.setItem(LS.defaultAssetDir, assetDir);
    else localStorage.removeItem(LS.defaultAssetDir);
  }, [assetDir]);
  useEffect(() => { persistBrandId(activeBrand); }, [activeBrand]);

  const handleSaveProviderKey = (providerId: string) => {
    const key = providerKeys[providerId];
    if (!key?.trim()) return;
    saveProviderKey(providerId, key);
    setSavedProviders(prev => ({ ...prev, [providerId]: true }));
    setTimeout(() => setSavedProviders(prev => ({ ...prev, [providerId]: false })), 2000);
  };

  const anyKeysConfigured = PROVIDERS.some(p => !!providerKeys[p.id]?.trim());

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

        {/* ── API Keys (one per provider) ── */}
        <SectionCard icon="fa-key" title="API Keys" accent>
          {!anyKeysConfigured && (
            <div className="mb-4 p-3 rounded-lg bg-[#f6f0f8] border border-[#ceadd4] flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-[#91569c] mt-0.5" />
              <p className="text-xs text-[#5c3a62]">
                Enter your API key for each provider you want to use. <strong>One key per provider</strong> — it works for all that provider's models across every task.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {PROVIDERS.map(p => (
              <div key={p.id} className="flex gap-2 items-center">
                <i className={`fa-solid ${p.icon} text-[#91569c] text-xs w-5 text-center`} />
                <span className="text-[10px] font-bold text-[#5c3a62] w-44 truncate" title={p.name}>{p.name}</span>
                <input
                  type="password"
                  value={providerKeys[p.id] || ''}
                  onChange={(e) => setProviderKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={p.keyPlaceholder}
                  className="flex-1 bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-2.5 py-1.5 text-[11px] text-[#3a3a3a] placeholder:text-[#aaa] outline-none focus:ring-2 focus:ring-[#91569c]/30"
                />
                <button
                  onClick={() => handleSaveProviderKey(p.id)}
                  disabled={!providerKeys[p.id]?.trim()}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all min-w-[56px]
                    ${savedProviders[p.id]
                      ? 'bg-green-500 text-white'
                      : providerKeys[p.id]?.trim()
                        ? 'bg-[#91569c] text-white hover:bg-[#5c3a62]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {savedProviders[p.id] ? <><i className="fa-solid fa-check mr-0.5" />OK</> : 'Save'}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Best of Breed (model selection per task — no keys here) ── */}
        <SectionCard icon="fa-trophy" title="Best of Breed — Model Selection">
          <p className="text-[9px] text-[#888] mb-3">Pick the best model for each task. The green/red badge shows whether you have an API key for that model's provider.</p>
          <div className="divide-y divide-[#e0d6e3]">
            {TASK_SLOTS.map(slot => (
              <TaskRow
                key={slot.id}
                slot={slot}
                primaryModel={primaryModels[slot.id]}
                fallbackModel={fallbackModels[slot.id]}
                onPrimaryModelChange={(id) => setPrimaryModels(prev => ({ ...prev, [slot.id]: id }))}
                onFallbackModelChange={(id) => setFallbackModels(prev => ({ ...prev, [slot.id]: id }))}
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

        {/* Notifications */}
        <SectionCard icon="fa-bell" title="Notifications">
          <div className="space-y-3">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#888] mb-1">Email address for notifications</label>
              <input
                type="email"
                value={notifyEmail}
                onChange={e => {
                  setNotifyEmail(e.target.value);
                  if (e.target.value.trim()) localStorage.setItem(LS.notifyEmail, e.target.value.trim());
                  else localStorage.removeItem(LS.notifyEmail);
                }}
                placeholder="your@email.com"
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-2 text-sm text-[#3a3a3a] placeholder:text-[#bbb] outline-none focus:ring-2 focus:ring-[#91569c]/30"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#888] mb-1">Notification method</label>
              <select
                value={notifyMethod}
                onChange={e => {
                  setNotifyMethod(e.target.value);
                  localStorage.setItem(LS.notifyMethod, e.target.value);
                }}
                className="w-full bg-[#f6f0f8] border border-[#ceadd4] rounded-lg px-4 py-2 text-sm text-[#3a3a3a] outline-none focus:ring-2 focus:ring-[#91569c]/30"
              >
                <option value="email">Email only</option>
                <option value="in-app">In-app only</option>
                <option value="both">Both email and in-app</option>
              </select>
            </div>
            <p className="text-[9px] text-[#888]">These are default notification settings. Each project can override the schedule and recipients in its Actions section.</p>
          </div>
        </SectionCard>

        <div className="h-6" />
      </div>
    </div>
  );
};
