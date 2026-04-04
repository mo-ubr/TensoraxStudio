/**
 * settingsDB.ts — Persistent settings backed by SQLite via /api/db/settings.
 *
 * Replaces localStorage for API keys and model selections so they survive
 * browser data clearing, work across browsers, and live alongside projects.
 *
 * Usage:
 *   import { Settings } from '../services/settingsDB';
 *   await Settings.load();                       // call once at app boot
 *   const key = Settings.get('tensorax_analysis_key__gemini-3.1-pro-preview');
 *   await Settings.set('tensorax_analysis_key__gemini-3.1-pro-preview', 'AIza...');
 */

const API_BASE = '/api/db/settings';

/** In-memory cache — populated by load(), updated by set(). */
let cache: Record<string, string> = {};
let loaded = false;

/** All localStorage keys we want to migrate into the DB. */
const MIGRATABLE_PREFIXES = [
  'tensorax_analysis_key',
  'tensorax_analysis_model',
  'tensorax_video_analysis_key',
  'tensorax_video_analysis_model',
  'tensorax_copy_key',
  'tensorax_copy_model',
  'tensorax_image_key',
  'tensorax_image_model',
  'tensorax_video_key',
  'tensorax_video_model',
  'tensorax_shotstack_key',
  'tensorax_shotstack_model',
  'tensorax_legal_key',
  'tensorax_legal_model',
  'tensorax_fal_key',
  'tensorax_provider_key__gemini',
  'tensorax_image_provider',
  'gemini_api_key',
];

export const Settings = {
  /** Whether the initial load from the server has completed. */
  get isLoaded() { return loaded; },

  /**
   * Load all global settings from the DB into memory.
   * Also runs a one-time migration from localStorage if the DB is empty.
   */
  async load(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}?scope=global`);
      if (!res.ok) throw new Error(`Settings load failed: ${res.status}`);
      cache = await res.json();
      loaded = true;

      // One-time migration: if DB has no API keys yet, seed from localStorage
      const hasAnyKey = Object.keys(cache).some(k => k.startsWith('tensorax_') || k === 'gemini_api_key');
      if (!hasAnyKey && typeof window !== 'undefined') {
        await this.migrateFromLocalStorage();
      }
    } catch (e) {
      console.warn('[Settings] Failed to load from DB, falling back to localStorage', e);
      // Fallback: populate cache from localStorage so the app still works
      if (typeof window !== 'undefined') {
        for (const prefix of MIGRATABLE_PREFIXES) {
          this._scanLocalStorage(prefix);
        }
      }
      loaded = true;
    }
  },

  /** Get a setting value. Falls back to localStorage if DB hasn't loaded. */
  get(key: string): string {
    if (cache[key]) return cache[key];
    // Fallback to localStorage for resilience
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(key)?.trim() || '';
      } catch { return ''; }
    }
    return '';
  },

  /** Save a setting to both the DB and localStorage (as cache). */
  async set(key: string, value: string): Promise<void> {
    cache[key] = value;
    // Mirror to localStorage for fast reads and offline resilience
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    }
    // Persist to DB
    try {
      await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global', settings: { [key]: value } }),
      });
    } catch (e) {
      console.warn('[Settings] Failed to save to DB:', key, e);
    }
  },

  /** Save multiple settings at once (batch). */
  async setMany(entries: Record<string, string>): Promise<void> {
    Object.assign(cache, entries);
    // Mirror to localStorage
    if (typeof window !== 'undefined') {
      for (const [k, v] of Object.entries(entries)) {
        try { localStorage.setItem(k, v); } catch { /* ignore */ }
      }
    }
    // Persist to DB
    try {
      await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global', settings: entries }),
      });
    } catch (e) {
      console.warn('[Settings] Failed to batch save to DB:', e);
    }
  },

  /** Migrate all API-key-related localStorage entries into the DB. */
  async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') return;
    const toMigrate: Record<string, string> = {};

    for (const prefix of MIGRATABLE_PREFIXES) {
      this._scanLocalStorage(prefix, toMigrate);
    }

    // Also scan for per-model keys (tensorax_*_key__modelname)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('tensorax_') && !toMigrate[k]) {
          const v = localStorage.getItem(k)?.trim();
          if (v) {
            toMigrate[k] = v;
            cache[k] = v;
          }
        }
      }
    } catch { /* ignore */ }

    if (Object.keys(toMigrate).length > 0) {
      console.log(`[Settings] Migrating ${Object.keys(toMigrate).length} keys from localStorage to DB`);
      try {
        await fetch(API_BASE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'global', settings: toMigrate }),
        });
      } catch (e) {
        console.warn('[Settings] Migration to DB failed:', e);
      }
    }
  },

  /** Internal: scan localStorage for a key and its per-model variants. */
  _scanLocalStorage(prefix: string, target?: Record<string, string>): void {
    try {
      const v = localStorage.getItem(prefix)?.trim();
      if (v) {
        cache[prefix] = v;
        if (target) target[prefix] = v;
      }
    } catch { /* ignore */ }
  },
};
