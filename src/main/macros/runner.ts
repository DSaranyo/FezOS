import { shell } from 'electron';
import { spawn } from 'node:child_process';
import { Macro, MacroStep } from '../types';
import { openSavedApp, openSavedUrl, type VoiceAction } from '../actions';

export type MacroProgress = { macroId: string; name: string; current: number; total: number; failed?: string };

function launch(command: string, args: string[] = []) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, shell: false, stdio: 'ignore', windowsHide: true });
    child.once('error', reject); child.once('spawn', () => { child.unref(); resolve(); });
  });
}

function spotifyUri(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' && parsed.hostname === 'open.spotify.com') return `spotify:${parsed.pathname.split('/').filter(Boolean).join(':')}${parsed.search}`;
  } catch { /* a spotify URI is handled below */ }
  if (!/^spotify:[\w:?-]+$/i.test(value)) throw new Error('Spotify links must be open.spotify.com links or spotify: URIs.');
  return value;
}

async function runStep(step: MacroStep) {
  switch (step.type) {
    case 'open_url': await openSavedUrl(step.url); return undefined;
    case 'open_app': await openSavedApp(step.name); return undefined;
    case 'spotify': await shell.openExternal(spotifyUri(step.uri)); return undefined;
    case 'open_vscode': if (!step.path) throw new Error('VS Code folder is blank.'); await launch('code', [step.path]); return undefined;
    case 'command': if (!step.command) throw new Error('Command is blank.'); await launch(step.command, step.args); return undefined;
    case 'delay': await new Promise(resolve => setTimeout(resolve, step.milliseconds)); return undefined;
  }
}

export class MacroRunner {
  constructor(private readonly progress: (update: MacroProgress) => void) {}
  async run(macro: Macro): Promise<VoiceAction> {
    const failures: string[] = [];
    for (let index = 0; index < macro.steps.length; index++) {
      this.progress({ macroId: macro.id, name: macro.name, current: index + 1, total: macro.steps.length });
      try { await runStep(macro.steps[index]); }
      catch { failures.push(`step ${index + 1}`); this.progress({ macroId: macro.id, name: macro.name, current: index + 1, total: macro.steps.length, failed: `Step ${index + 1} failed` }); }
      if (index < macro.steps.length - 1 && macro.steps[index].type !== 'delay') await new Promise(resolve => setTimeout(resolve, 400));
    }
    const confirmation = failures.length ? `${macro.name}: ${failures.join(', ')} failed.` : macro.confirmation || `${macro.name} ready.`;
    return { label: macro.steps.length ? `${macro.name}: ${macro.steps.length} of ${macro.steps.length}` : `${macro.name} complete`, confirmation };
  }
}
