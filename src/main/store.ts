import Store from 'electron-store';
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { defaultAppTargets, defaults, Macro, ReminderItem, Settings, TimerItem } from './types';

const examples: Macro[] = [
  { id: 'example-study-mode', name: 'Study mode', aliases: ['study time', 'start studying'], confirmation: 'Study mode ready.', example: true, steps: [
    { id: 'study-canvas', type: 'open_url', url: 'https://canvas.example.edu/' },
    { id: 'study-spotify', type: 'spotify', uri: 'https://open.spotify.com/collection/playlists' }
  ] },
  { id: 'example-dev-environment', name: 'Dev environment', aliases: ['start dev environment'], confirmation: 'Dev environment ready.', example: true, steps: [
    { id: 'dev-code', type: 'open_app', name: 'VS Code' },
    { id: 'dev-agent', type: 'open_url', url: 'https://chat.openai.com/' }
  ] }
];

// The product name changed from Pill to Fez. Keep existing local settings,
// encrypted keys, macros, and scheduled items on the first Fez launch.
function migrateLegacyStore() {
  const target = path.join(app.getPath('userData'), 'config.json');
  const legacy = path.join(app.getPath('appData'), 'pill', 'config.json');
  if (fs.existsSync(target) || !fs.existsSync(legacy)) return;
  try { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(legacy, target); } catch { /* A new, empty store is still usable. */ }
}
migrateLegacyStore();

const store = new Store<{ settings: Settings; encryptedApiKey?: string; encryptedElevenLabsApiKey?: string; pushToTalkMigration?: boolean; elevenLabsCharactersTotal?: number; timers?: TimerItem[]; reminders?: ReminderItem[]; macros?: Macro[] }>({
  defaults: { settings: defaults }
});

export function settings(): Settings {
  const saved = store.get('settings');
  return { ...defaults, ...saved, actionTools: { ...defaults.actionTools, ...saved.actionTools }, appTargets: { ...defaultAppTargets, ...saved.appTargets } };
}
export function saveSettings(next: Partial<Settings>) { const value = { ...settings(), ...next }; store.set('settings', value); return value; }
export function migrateDeprecatedModels() {
  const current = settings();
  const update: Partial<Settings> = {};
  // Groq shut down these Llama IDs for free/developer-tier traffic in 2026.
  if (current.llmModel === 'llama-3.3-70b-versatile' || current.llmModel === 'llama-3.1-8b-instant') {
    update.llmModel = defaults.llmModel;
  }
  // Earlier builds only implemented toggle activation. Migrate once, while
  // preserving any later choice of toggle mode from the Settings window.
  if (!store.get('pushToTalkMigration')) { update.interactionMode = 'push-to-talk'; store.set('pushToTalkMigration', true); }
  return Object.keys(update).length ? saveSettings(update) : current;
}
export function apiKey(): string | undefined {
  const encrypted = store.get('encryptedApiKey');
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return undefined;
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')); } catch { return undefined; }
}
export function saveApiKey(value: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure Windows storage is unavailable.');
  store.set('encryptedApiKey', safeStorage.encryptString(value.trim()).toString('base64'));
}
export function hasApiKey() { return Boolean(apiKey()); }
function secret(name: 'encryptedApiKey' | 'encryptedElevenLabsApiKey') {
  const encrypted = store.get(name);
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return undefined;
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')); } catch { return undefined; }
}
export function elevenLabsApiKey() { return secret('encryptedElevenLabsApiKey'); }
export function hasElevenLabsApiKey() { return Boolean(elevenLabsApiKey()); }
export function saveElevenLabsApiKey(value: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure Windows storage is unavailable.');
  store.set('encryptedElevenLabsApiKey', safeStorage.encryptString(value.trim()).toString('base64'));
}
export function elevenLabsCharactersTotal() { return store.get('elevenLabsCharactersTotal') ?? 0; }
let elevenLabsCharactersSession = 0;
export function elevenLabsCharactersSessionTotal() { return elevenLabsCharactersSession; }
export function addElevenLabsCharacters(count: number) { elevenLabsCharactersSession += count; store.set('elevenLabsCharactersTotal', elevenLabsCharactersTotal() + count); }
export function resetElevenLabsCharacters() { elevenLabsCharactersSession = 0; store.set('elevenLabsCharactersTotal', 0); }
export function timers() { return store.get('timers') ?? []; }
export function saveTimers(next: TimerItem[]) { store.set('timers', next); return next; }
export function reminders() { return store.get('reminders') ?? []; }
export function saveReminders(next: ReminderItem[]) { store.set('reminders', next); return next; }
export function macros() {
  const current = store.get('macros');
  if (current) return current;
  store.set('macros', examples);
  return examples;
}
export function saveMacros(next: Macro[]) { store.set('macros', next); return next; }
let usage = { whisperCalls: 0, chatCalls: 0, localCommands: 0 };
export function usageCounts() { return { ...usage }; }
export function incrementUsage(kind: keyof typeof usage) { usage[kind]++; return usageCounts(); }
export function resetUsage() { usage = { whisperCalls: 0, chatCalls: 0, localCommands: 0 }; return usageCounts(); }
