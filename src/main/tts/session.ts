import { addElevenLabsCharacters, settings } from '../store';
import { cleanForSpeech, mergeShortChunks, takeSpeakableChunks } from './chunker';
import { ElevenLabsError, ElevenLabsProvider } from './elevenlabs';

export type TtsSink = {
  queued: (sequence: number) => void;
  audio: (sequence: number, bytes: ArrayBuffer) => void;
  fallback: (sequence: number, text: string) => void;
  notice: (message: string) => void;
  complete: () => void;
};

type Pending = { sequence: number; text: string; previousText?: string; nextText?: string };

export class TtsSession {
  private readonly provider = new ElevenLabsProvider();
  private readonly abort = new AbortController();
  private remainder = ''; private held = ''; private previousText = '';
  private pending: Pending[] = []; private inFlight = 0; private sequence = 0;
  private finalised = false; private cancelled = false; private spokenCharacters = 0; private notified = false;
  constructor(private readonly sink: TtsSink) {}

  addText(token: string) {
    if (this.cancelled || !token) return;
    const split = takeSpeakableChunks(this.remainder + token);
    this.remainder = split.remainder;
    this.queueChunks(split.chunks, false);
  }
  finish() {
    if (this.cancelled) return;
    const split = takeSpeakableChunks(this.remainder, true); this.remainder = '';
    this.queueChunks(split.chunks, true); this.finalised = true; this.pump(); this.maybeComplete();
  }
  cancel() { this.cancelled = true; this.abort.abort(); this.pending = []; this.provider.cancel(); }
  private queueChunks(chunks: string[], flush: boolean) {
    const clean = mergeShortChunks(chunks.map(chunk => cleanForSpeech(chunk).text).filter(Boolean));
    for (const chunk of clean) {
      if (this.held) { this.enqueue(`${this.held} ${chunk}`); this.held = ''; }
      else if (!flush && chunk.length < 25) this.held = chunk;
      else this.enqueue(chunk);
    }
    if (flush && this.held) { this.enqueue(this.held); this.held = ''; }
    this.pump();
  }
  private enqueue(text: string) {
    const config = settings(); const remaining = Math.max(0, config.maxSpokenCharacters - this.spokenCharacters);
    if (!remaining || text.length > remaining) return; // stop at the prior complete sentence
    const item: Pending = { sequence: this.sequence++, text, previousText: this.previousText || undefined };
    this.previousText = text; this.spokenCharacters += text.length; this.pending.push(item); this.sink.queued(item.sequence);
  }
  private pump() {
    while (!this.cancelled && this.inFlight < 2 && this.pending.length) {
      const item = this.pending.shift()!; item.nextText = this.pending[0]?.text; this.inFlight++;
      this.provider.speak({ text: item.text, previousText: item.previousText, nextText: item.nextText, signal: this.abort.signal })
        .then(bytes => { if (!this.cancelled) { addElevenLabsCharacters(item.text.length); this.sink.audio(item.sequence, bytes); } })
        .catch(error => {
          if (this.cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
          const message = error instanceof ElevenLabsError ? error.message : 'ElevenLabs voice is unavailable right now.';
          if (!this.notified) { this.notified = true; this.sink.notice(message); }
          if (settings().useWindowsVoiceFallback && !this.cancelled) this.sink.fallback(item.sequence, item.text);
        })
        .finally(() => { this.inFlight--; this.pump(); this.maybeComplete(); });
    }
  }
  private maybeComplete() { if (this.finalised && !this.cancelled && !this.pending.length && this.inFlight === 0) this.sink.complete(); }
}
