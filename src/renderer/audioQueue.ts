export type PlaybackItem = { sequence: number; audio?: ArrayBuffer; text?: string };

/** Ordered browser-side player for ElevenLabs clips and the Windows speech fallback. */
export class AudioQueue {
  private items = new Map<number, PlaybackItem>(); private next = 0; private playing = false; private id = ''; private audio: HTMLAudioElement | null = null; private volume = 1;
  constructor(private readonly onState: (speaking: boolean) => void) {}
  start(id: string) { this.stop(); this.id = id; this.next = 0; }
  enqueue(id: string, item: PlaybackItem) { if (id !== this.id) return; this.items.set(item.sequence, item); this.play(); }
  setVolume(value: number) { this.volume = Math.max(0, Math.min(1, value)); if (this.audio) this.audio.volume = this.volume; }
  stop() { this.items.clear(); this.next = 0; this.id = ''; this.audio?.pause(); if (this.audio?.src.startsWith('blob:')) URL.revokeObjectURL(this.audio.src); this.audio = null; speechSynthesis.cancel(); if (this.playing) { this.playing = false; this.onState(false); } }
  private play() {
    if (this.playing) return;
    const item = this.items.get(this.next); if (!item) return;
    this.items.delete(this.next++); this.playing = true; this.onState(true);
    if (item.text) {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.volume = this.volume; utterance.onend = () => this.end(); utterance.onerror = () => this.end(); speechSynthesis.speak(utterance); return;
    }
    if (!item.audio) { this.end(); return; }
    const url = URL.createObjectURL(new Blob([item.audio], { type: 'audio/mpeg' }));
    const audio = this.audio = new Audio(url); audio.preload = 'auto'; audio.volume = this.volume;
    audio.onended = () => { URL.revokeObjectURL(url); this.end(); }; audio.onerror = () => { URL.revokeObjectURL(url); this.end(); };
    void audio.play().catch(() => this.end());
  }
  private end() { this.playing = false; this.audio = null; this.play(); if (!this.playing) this.onState(false); }
}
