import { elevenLabsApiKey, settings } from '../store';

export class ElevenLabsError extends Error { constructor(message: string, public readonly fallback = false) { super(message); } }
function errorFor(status: number, body: string) {
  if (status === 401) return new ElevenLabsError('ElevenLabs key invalid.');
  if (status === 402 || /quota|character limit|credit/i.test(body)) return new ElevenLabsError("ElevenLabs credits used up or this voice isn't available on your plan.", true);
  if (status === 404) return new ElevenLabsError('Voice ID not found. Check Settings.', true);
  if (status === 429) return new ElevenLabsError('ElevenLabs is busy. Trying once more.', true);
  return new ElevenLabsError('ElevenLabs voice is unavailable right now.', true);
}
export type SpeakRequest = { text: string; previousText?: string; nextText?: string; signal: AbortSignal };
export interface TtsProvider { speak(request: SpeakRequest): Promise<ArrayBuffer>; cancel(): void; }
export class ElevenLabsProvider implements TtsProvider {
  private controllers = new Set<AbortController>();
  async speak(request: SpeakRequest) {
    const key = elevenLabsApiKey();
    if (!key) throw new ElevenLabsError('Add an ElevenLabs key in Settings to hear answers.', true);
    const config = settings(); const controller = new AbortController(); this.controllers.add(controller);
    request.signal.addEventListener('abort', () => controller.abort(), { once: true });
    const run = async () => {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.elevenLabsVoiceId || 'Sun6GPdivU7N4kTmYtDw')}/stream?output_format=mp3_44100_128`, {
        method: 'POST', signal: controller.signal,
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: request.text, model_id: config.elevenLabsModel, voice_settings: { stability: config.elevenLabsStability, similarity_boost: config.elevenLabsSimilarityBoost, speed: config.elevenLabsSpeed }, previous_text: request.previousText, next_text: request.nextText })
      });
      if (!response.ok) throw errorFor(response.status, await response.text());
      return response.arrayBuffer();
    };
    try { return await run(); } catch (error) {
      if (error instanceof ElevenLabsError && error.message.includes('Trying once more.')) { await new Promise(resolve => setTimeout(resolve, 700)); return run(); }
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (error instanceof ElevenLabsError) throw error;
      throw new ElevenLabsError('ElevenLabs voice is unavailable right now.', true);
    } finally { this.controllers.delete(controller); }
  }
  cancel() { for (const controller of this.controllers) controller.abort(); this.controllers.clear(); }
}
