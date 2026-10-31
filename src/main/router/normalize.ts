export function normalizeTranscript(input: string) {
  return input.toLowerCase().replace(/[!?.,]/g, ' ').replace(/\b(?:please|hey|um|uh|can you|could you|would you|fez|pill)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
