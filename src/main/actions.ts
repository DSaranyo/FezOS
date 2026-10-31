import { shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { defaultAppTargets } from './types';
import { settings } from './store';
import { matchStartMenuApp, type StartApp } from './apps/start-menu';

export type VoiceAction = { label: string; confirmation: string };
type Arguments = Record<string, unknown>;

function text(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2_000) throw new Error(`Invalid ${field}.`);
  return value.trim();
}
function url(value: unknown) {
  const input = text(value, 'URL');
  let parsed: URL;
  try { parsed = new URL(input); } catch { throw new Error('That is not a valid URL.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Only http and https URLs can be opened.');
  return parsed.toString();
}
async function openExternal(value: string) { await shell.openExternal(value); }
function enabled(name: keyof ReturnType<typeof settings>['actionTools']) {
  return settings().actionTools[name];
}
function launch(executable: string, args: string[] = []) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { detached: true, shell: false, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
function findStartMenuApp(name: string) {
  // This command is constant: user/model text is never inserted into PowerShell.
  return new Promise<StartApp | undefined>((resolve, reject) => execFile(
    'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress'],
    { windowsHide: true, maxBuffer: 1_000_000 }, (error, stdout) => {
      if (error) { reject(error); return; }
      try {
        const raw = JSON.parse(stdout || '[]') as StartApp | StartApp[];
        const apps = Array.isArray(raw) ? raw : [raw];
        resolve(matchStartMenuApp(apps, name));
      } catch { resolve(undefined); }
    }
  ));
}
async function openStartMenuApp(name: string) {
  const app = await findStartMenuApp(name);
  if (!app) return false;
  // AppIDs are supplied by Windows. Constrain them before using them as an argument anyway.
  if (!/^[A-Za-z0-9._!\-]+$/.test(app.AppID)) throw new Error('Windows returned an invalid Start Menu app identifier.');
  await launch('explorer.exe', [`shell:AppsFolder\\${app.AppID}`]);
  return true;
}
export async function openSavedApp(value: unknown): Promise<VoiceAction> {
  const requested = text(value, 'app name');
  const targets = { ...defaultAppTargets, ...settings().appTargets };
  const key = Object.keys(targets).find(name => name.toLocaleLowerCase() === requested.toLocaleLowerCase());
  if (key) {
    const target = targets[key].trim();
    if (/^(spotify|discord|steam|ms-settings|calculator):$/i.test(target)) await openExternal(target);
    else if (target === 'start-menu') {
      if (!await openStartMenuApp(key)) throw new Error(`${key} is not registered in the Windows Start Menu.`);
    }
    else if (/^[A-Za-z0-9_ .\\/:()\-]+(?:\.exe)?$/.test(target) && !/[&|<>"'`]/.test(target)) await launch(target);
    else throw new Error(`The saved launch target for ${key} is invalid. Targets must be one executable or an approved Windows protocol.`);
    return { label: `Opening ${key}…`, confirmation: `Opened ${key}.` };
  }
  // Store apps (including WhatsApp) use AUMIDs rather than an .exe or protocol handler.
  // Resolve those directly from Windows; user/model text never reaches a shell.
  if (!/^[\p{L}\p{N} ._\-]{1,80}$/u.test(requested)) throw new Error('That app name contains unsupported characters.');
  if (await openStartMenuApp(requested)) return { label: `Opening ${requested}…`, confirmation: `Opened ${requested}.` };
  throw new Error(`${requested} is not in Fez’s app-name table or your Windows Start Menu. Add its executable or protocol in Settings.`);
}

export async function openSavedUrl(value: unknown) { await openExternal(url(value)); }

export async function executeVoiceAction(name: string, args: Arguments): Promise<VoiceAction> {
  switch (name) {
    case 'open_url': {
      if (!enabled('openUrl')) throw new Error('Opening URLs is disabled in Settings.');
      const value = url(args.url); await openExternal(value); return { label: 'Opening website…', confirmation: `Opened ${new URL(value).host}.` };
    }
    case 'search_youtube': {
      if (!enabled('searchYoutube')) throw new Error('YouTube search is disabled in Settings.');
      const query = text(args.query, 'YouTube query'); await openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`); return { label: 'Opening YouTube…', confirmation: `Opened YouTube results for ${query}.` };
    }
    case 'web_search': {
      if (!enabled('webSearch')) throw new Error('Web search is disabled in Settings.');
      const query = text(args.query, 'search query'); await openExternal(`https://www.google.com/search?q=${encodeURIComponent(query)}`); return { label: 'Searching the web…', confirmation: `Opened Google results for ${query}.` };
    }
    case 'open_app': {
      if (!enabled('openApp')) throw new Error('Opening apps is disabled in Settings.');
      return openSavedApp(args.name);
    }
    case 'spotify_search': {
      if (!enabled('spotifySearch')) throw new Error('Spotify search is disabled in Settings.');
      const query = text(args.query, 'Spotify query'); await openExternal(`spotify:search:${encodeURIComponent(query)}`); return { label: 'Opening Spotify…', confirmation: `Opened Spotify search for ${query}.` };
    }
    default: throw new Error('That action is not available.');
  }
}
