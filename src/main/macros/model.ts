import { randomUUID } from 'node:crypto';
import { Macro, MacroStep } from '../types';

const MAX_STEPS = 32;
const MAX_TEXT = 2_000;
const stepTypes = new Set<MacroStep['type']>(['open_url', 'open_app', 'spotify', 'open_vscode', 'command', 'delay']);

function string(value: unknown, fallback = '') { return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : fallback; }

function step(input: unknown): MacroStep | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as Record<string, unknown>; const type = value.type;
  if (typeof type !== 'string' || !stepTypes.has(type as MacroStep['type'])) return undefined;
  const id = string(value.id) || randomUUID();
  if (type === 'open_url') return { id, type, url: string(value.url) };
  if (type === 'open_app') return { id, type, name: string(value.name, 'VS Code') };
  if (type === 'spotify') return { id, type, uri: string(value.uri) };
  if (type === 'open_vscode') return { id, type, path: string(value.path) };
  if (type === 'delay') return { id, type, milliseconds: Math.max(0, Math.min(60_000, Number(value.milliseconds) || 400)) };
  return { id, type: 'command', command: string(value.command), args: Array.isArray(value.args) ? value.args.filter(item => typeof item === 'string').map(item => item.slice(0, MAX_TEXT)).slice(0, 32) : [] };
}

export function validateMacros(input: unknown): Macro[] {
  if (!Array.isArray(input)) throw new Error('Macros must be a JSON array.');
  if (input.length > 50) throw new Error('Keep at most 50 macros.');
  const names = new Set<string>();
  return input.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') throw new Error(`Macro ${index + 1} is invalid.`);
    const value = candidate as Record<string, unknown>; const name = string(value.name);
    if (!name || name.length > 80) throw new Error(`Macro ${index + 1} needs a name.`);
    const key = name.toLocaleLowerCase(); if (names.has(key)) throw new Error(`Macro names must be unique: ${name}.`); names.add(key);
    const steps = Array.isArray(value.steps) ? value.steps.map(step).filter((item): item is MacroStep => Boolean(item)).slice(0, MAX_STEPS) : [];
    const aliases = Array.isArray(value.aliases) ? value.aliases.filter(item => typeof item === 'string').map(item => item.trim().slice(0, 80)).filter(Boolean).slice(0, 12) : [];
    return { id: string(value.id) || randomUUID(), name, aliases, confirmation: string(value.confirmation, `${name} ready.`), steps, example: Boolean(value.example) };
  });
}

export function newMacro(): Macro {
  return { id: randomUUID(), name: 'New macro', aliases: [], confirmation: 'Macro ready.', steps: [] };
}

export function newStep(type: MacroStep['type']): MacroStep {
  const id = randomUUID();
  switch (type) {
    case 'open_url': return { id, type, url: 'https://' };
    case 'open_app': return { id, type, name: 'VS Code' };
    case 'spotify': return { id, type, uri: 'https://open.spotify.com/' };
    case 'open_vscode': return { id, type, path: '' };
    case 'command': return { id, type, command: '', args: [] };
    case 'delay': return { id, type, milliseconds: 400 };
  }
}
