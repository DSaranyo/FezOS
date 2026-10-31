import Fuse from 'fuse.js';
import { Macro } from '../types';
import { normalizeTranscript } from '../router/normalize';

export type MacroMatch = { macro: Macro; borderline: boolean } | undefined;

function clean(value: string) {
  return normalizeTranscript(value).replace(/^(?:set\s*up|setup|start|run)(?:\s+my)?\s+/, '').trim();
}

export function matchMacro(transcript: string, macros: Macro[]): MacroMatch {
  const source = clean(transcript); if (!source || !macros.length) return undefined;
  const entries = macros.flatMap(macro => [macro.name, ...macro.aliases].filter(Boolean).map(trigger => ({ macro, trigger: clean(trigger) })));
  const exact = entries.find(entry => entry.trigger === source);
  if (exact) return { macro: exact.macro, borderline: false };
  const fuse = new Fuse(entries, { keys: ['trigger'], includeScore: true, threshold: 0.28, ignoreLocation: true, minMatchCharLength: 4 });
  const result = fuse.search(source)[0];
  if (!result || result.score === undefined) return undefined;
  return { macro: result.item.macro, borderline: result.score > 0.14 };
}
