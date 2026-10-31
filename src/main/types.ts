export type Settings = {
  hotkey: string;
  interactionMode: 'toggle' | 'push-to-talk';
  sttModel: string;
  llmModel: string;
  silenceTimeout: number;
  autoCollapseTimeout: number;
  verticalOffset: number;
  autoHidePill: boolean;
  launchAtStartup: boolean;
  actionTools: {
    openUrl: boolean;
    searchYoutube: boolean;
    webSearch: boolean;
    openApp: boolean;
    spotifySearch: boolean;
  };
  /** A user-owned lookup table. Values are one executable or Windows protocol, never a command line. */
  appTargets: Record<string, string>;
  speakResponses: boolean;
  speakActionConfirmations: boolean;
  useWindowsVoiceFallback: boolean;
  elevenLabsVoiceId: string;
  elevenLabsModel: string;
  elevenLabsStability: number;
  elevenLabsSimilarityBoost: number;
  elevenLabsSpeed: number;
  elevenLabsVolume: number;
  maxSpokenCharacters: number;
  localFirstRouting: boolean;
  chatHistoryLimit: number;
  systemPrompt: string;
  timerChimeEnabled: boolean;
  useElevenLabsForTimers: boolean;
  enableDestructiveSystemActions: boolean;
};

export type TimerItem = {
  id: string;
  name: string;
  durationMs: number;
  endsAt: number;
  state: 'running' | 'paused' | 'ringing';
  remainingMs?: number;
  missed?: boolean;
  createdAt: number;
};

export type ReminderItem = {
  id: string;
  text: string;
  endsAt: number;
  state: 'scheduled' | 'ringing';
  createdAt: number;
  missed?: boolean;
  kind: 'reminder' | 'alarm';
};

export type MacroStep =
  | { id: string; type: 'open_url'; url: string }
  | { id: string; type: 'open_app'; name: string }
  | { id: string; type: 'spotify'; uri: string }
  | { id: string; type: 'open_vscode'; path: string }
  | { id: string; type: 'command'; command: string; args: string[] }
  | { id: string; type: 'delay'; milliseconds: number };

export type Macro = {
  id: string;
  name: string;
  aliases: string[];
  confirmation: string;
  steps: MacroStep[];
  example?: boolean;
};

export const DEFAULT_ELEVENLABS_VOICE_ID = 'Sun6GPdivU7N4kTmYtDw';

export const defaultAppTargets: Record<string, string> = {
  Spotify: 'spotify:', Discord: 'discord:', Steam: 'steam:', Settings: 'ms-settings:', Calculator: 'calculator:',
  Notepad: 'notepad.exe', 'File Explorer': 'explorer.exe', 'VS Code': 'code', Chrome: 'chrome.exe', WhatsApp: 'start-menu'
};

export const defaults: Settings = {
  hotkey: 'Control+Alt', interactionMode: 'push-to-talk',
  sttModel: 'whisper-large-v3-turbo', llmModel: 'openai/gpt-oss-20b',
  silenceTimeout: 1500, autoCollapseTimeout: 30000, verticalOffset: 8, autoHidePill: true,
  launchAtStartup: false,
  actionTools: { openUrl: true, searchYoutube: true, webSearch: true, openApp: true, spotifySearch: true },
  appTargets: defaultAppTargets,
  speakResponses: true, speakActionConfirmations: true, useWindowsVoiceFallback: true,
  elevenLabsVoiceId: DEFAULT_ELEVENLABS_VOICE_ID, elevenLabsModel: 'eleven_flash_v2_5',
  elevenLabsStability: 0.5, elevenLabsSimilarityBoost: 0.75, elevenLabsSpeed: 1, elevenLabsVolume: 1,
  maxSpokenCharacters: 1200,
  localFirstRouting: true, chatHistoryLimit: 6,
  systemPrompt: 'You are a fast, helpful voice assistant. Answer directly and concisely. Use markdown only when it helps.',
  timerChimeEnabled: true, useElevenLabsForTimers: false,
  enableDestructiveSystemActions: false
};
