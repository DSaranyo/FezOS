export type SpeechChunk = { text: string; codeNotice?: boolean };

export function cleanForSpeech(markdown: string): SpeechChunk {
  let codeNotice = false;
  let text = markdown.replace(/```[\s\S]*?```/g, () => { codeNotice = true; return ' '; });
  text = text.replace(/!?(?:\[([^\]]+)\]\([^)]*\))/g, '$1');
  text = text.replace(/^\s{0,3}(?:[-*+] |\d+[.)] )/gm, '').replace(/^\s{0,3}#{1,6}\s*/gm, '');
  text = text.replace(/[\*_~`]/g, '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '');
  text = text.replace(/\s+/g, ' ').trim();
  if (codeNotice) text = `${text}${text ? ' ' : ''}I've put the code on screen.`;
  return { text, codeNotice };
}

const abbreviations = new Set(['e.g.', 'i.e.', 'etc.', 'vs.', 'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.']);
function sentenceEnd(source: string, index: number) {
  const character = source[index];
  if (!'.!?'.includes(character)) return false;
  if (character === '.' && /\d/.test(source[index - 1] ?? '') && /\d/.test(source[index + 1] ?? '')) return false;
  const word = source.slice(Math.max(0, index - 8), index + 1).toLowerCase();
  if ([...abbreviations].some(item => word.endsWith(item))) return false;
  return character !== '.' || !/[A-Za-z]/.test(source[index + 1] ?? '');
}

/** Returns complete sentences and retains the unfinished tail for the next token batch. */
export function takeSpeakableChunks(source: string, final = false): { chunks: string[]; remainder: string } {
  const chunks: string[] = []; let start = 0;
  for (let index = 0; index < source.length; index++) {
    if (sentenceEnd(source, index) || source[index] === '\n') {
      const candidate = source.slice(start, index + 1).trim();
      if (candidate) chunks.push(candidate); start = index + 1;
    }
  }
  const remainder = source.slice(start).trimStart();
  if (final && remainder.trim()) { chunks.push(remainder.trim()); return { chunks, remainder: '' }; }
  return { chunks, remainder };
}

/** Merge tiny sentences so a stream does not sound clipped. */
export function mergeShortChunks(chunks: string[], minimum = 25) {
  const merged: string[] = [];
  for (const chunk of chunks) {
    if (merged.length && merged[merged.length - 1].length < minimum) merged[merged.length - 1] += ` ${chunk}`;
    else merged.push(chunk);
  }
  return merged;
}
