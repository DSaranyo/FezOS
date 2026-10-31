import { executeVoiceAction, VoiceAction } from '../actions';
import { settings } from '../store';
import { TimerManager } from '../timers/manager';
import { parseReminder } from '../timers/reminder';
import { matchMacro } from '../macros/matcher';
import { MacroRunner } from '../macros/runner';
import { macros } from '../store';
import { Macro } from '../types';
import { executeSystemAction, PendingSystemAction, SystemController, SystemActionName } from '../system/registry';
import { parseDuration } from './duration';
import { normalizeTranscript } from './normalize';

export type LocalResult = { confirmation: string; action?: VoiceAction; macroCandidate?: Macro; systemConfirmation?: PendingSystemAction };
function timerName(source: string) {
  const match = source.match(/^(.*?)\s+timer\b/);
  if (!match) return 'Timer';
  const name = match[1].replace(/^(?:set\s+)?(?:an?\b\s*)?/, '').trim();
  return !name || parseDuration(name) ? 'Timer' : `${name[0].toUpperCase()}${name.slice(1)}`;
}
function isBareDuration(source: string) {
  return /^(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:[- ]five)?|sixty|ninety)\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)$/.test(source) || /^(?:an?|one) hour and a half$/.test(source);
}
type LocalServices = { timers: TimerManager; macros: MacroRunner; system: SystemController };

async function systemResult(action: SystemActionName, value?: number): Promise<LocalResult> {
  const result = await executeSystemAction(action, value); return { confirmation: result.confirmation, action: result };
}

export async function routeLocally(transcript: string, services: LocalServices): Promise<LocalResult | undefined> {
  if (!settings().localFirstRouting) return undefined;
  const source = normalizeTranscript(transcript);
  const { timers, macros: macroRunner, system } = services;
  const candidate = matchMacro(source, macros());
  if (candidate) {
    if (candidate.borderline) return { confirmation: `Run ${candidate.macro.name}?`, macroCandidate: candidate.macro };
    const action = await macroRunner.run(candidate.macro); return { confirmation: action.confirmation, action };
  }
  if (system.hasPending()) {
    if (/^(?:yes|confirm|do it|go ahead)$/.test(source)) { const action = await system.confirm(); return { confirmation: action.confirmation, action }; }
    if (/^(?:no|cancel|never mind)$/.test(source)) return { confirmation: system.cancel() ? 'Cancelled.' : 'Nothing to cancel.' };
  }
  if (/\b(?:how much time|time left|time remaining)\b/.test(source)) { const next = timers.snapshot().next; if (!next) return { confirmation: 'No timer is running.' }; const seconds = Math.max(0, Math.ceil((next.state === 'paused' ? next.remainingMs ?? 0 : next.endsAt - Date.now()) / 1_000)); const display = seconds >= 3_600 ? `${Math.floor(seconds / 3_600)}:${String(Math.floor(seconds % 3_600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; return { confirmation: `${next.name}: ${display} left.` }; }
  if (/\bcancel all timers\b/.test(source)) return { confirmation: timers.cancelAll() ? 'All timers cancelled.' : 'No timers to cancel.' };
  if (/\bpause (?:the )?timer\b/.test(source)) return { confirmation: timers.pause() ? 'Timer paused.' : 'No running timer.' };
  if (/\bresume (?:the )?timer\b/.test(source)) return { confirmation: timers.resume() ? 'Timer resumed.' : 'No paused timer.' };
  if (/\bcancel (?:the )?timer\b/.test(source)) return { confirmation: timers.cancel() ? 'Timer cancelled.' : 'No timer to cancel.' };
  const add = source.match(/^add (.+?)(?:\s+(?:to )?(?:the )?timer)?$/); if (add) { const duration = parseDuration(add[1]); return { confirmation: duration && timers.add(undefined, duration) ? 'Time added.' : 'Tell me how much time to add.' }; }
  const duration = parseDuration(source);
  if (duration && (/\btimer\b/.test(source) || isBareDuration(source))) { const item = timers.create(timerName(source), duration); return { confirmation: `${item.name} set.` }; }
  if (/\b(?:what are|show)(?: my)? reminders\b/.test(source)) { const reminders = timers.listReminders(); return { confirmation: reminders.length ? `${reminders.length} reminder${reminders.length === 1 ? '' : 's'} scheduled.` : 'No reminders scheduled.' }; }
  if (/\bcancel all reminders\b/.test(source)) return { confirmation: timers.cancelAllReminders() ? 'Reminders cancelled.' : 'No reminders scheduled.' };
  const cancelReminder = source.match(/^cancel (?:my )?reminder(?: about)? (.+)$/);
  if (cancelReminder) return { confirmation: timers.cancelReminder(undefined, cancelReminder[1]) ? 'Reminder cancelled.' : 'No matching reminder.' };
  const reminder = parseReminder(source, parseDuration);
  if (reminder) { timers.createReminder(reminder.text, reminder.endsAt, reminder.kind); return { confirmation: reminder.kind === 'alarm' ? 'Alarm set.' : 'Reminder set.' }; }
  if (/^(?:remind me|set (?:a )?reminder|set (?:an? )?alarm)\b/.test(source)) return { confirmation: 'When should I remind you?' };

  const volume = source.match(/(?:volume(?:\s+(?:to|at))?|set volume to)\s*(\d{1,3})\b/); if (volume) return systemResult('volume_set', Number(volume[1]));
  if (/^(?:turn )?(?:the )?(?:volume )?(?:up|louder)$/.test(source)) return systemResult('volume_up');
  if (/^(?:turn )?(?:the )?(?:volume )?(?:down|quieter)$/.test(source)) return systemResult('volume_down');
  if (/^mute(?: volume)?$/.test(source)) return systemResult('mute');
  if (/^unmute(?: volume)?$/.test(source)) return systemResult('unmute');
  if (/^(?:play|toggle playback)$/.test(source)) return systemResult('play_pause');
  if (/^(?:pause|pause media)$/.test(source)) return systemResult('media_pause');
  if (/^(?:next|next track|skip)(?: track)?$/.test(source)) return systemResult('next_track');
  if (/^(?:previous|previous track|last track)(?: track)?$/.test(source)) return systemResult('previous_track');
  if (/^lock (?:my )?(?:computer|pc|screen)$/.test(source)) return systemResult('lock');
  if (/^(?:take |capture )?(?:a )?screenshot$/.test(source)) return systemResult('screenshot');
  const brightness = source.match(/brightness(?:\s+(?:to|at))?\s*(\d{1,3})\b/); if (brightness) return systemResult('brightness', Number(brightness[1]));
  if (/^(?:minimize everything|show desktop)$/.test(source)) return systemResult('minimize_all');
  const danger = source.match(/^(?:shut ?down|restart|sleep|sign ?out)(?: (?:my )?(?:computer|pc|windows))?$/);
  if (danger) { const action = ({ shutdown: 'shutdown', restart: 'restart', sleep: 'sleep', signout: 'sign_out' } as Record<string, SystemActionName>)[danger[1].replace(/\s/g, '')]; const pending = system.request(action as Extract<SystemActionName, 'shutdown' | 'restart' | 'sleep' | 'sign_out'>); return { confirmation: `${pending.prompt} Say yes or click Confirm.`, systemConfirmation: pending }; }
  const youtube = source.match(/(?:youtube(?: search)?(?: for)?|(?:search|find) youtube(?: for)?)\s+(.+)/); if (youtube) { const action = await executeVoiceAction('search_youtube', { query: youtube[1] }); return { confirmation: action.confirmation, action }; }
  const spotify = source.match(/(?:spotify(?: search)?(?: for)?|(?:search|find) spotify(?: for)?)\s+(.+)/); if (spotify) { const action = await executeVoiceAction('spotify_search', { query: spotify[1] }); return { confirmation: action.confirmation, action }; }
  const website = source.match(/(?:go to|open)\s+((?:https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?)/); if (website) { const url = /^https?:\/\//.test(website[1]) ? website[1] : `https://${website[1]}`; const action = await executeVoiceAction('open_url', { url }); return { confirmation: action.confirmation, action }; }
  const app = source.match(/^(?:open|launch|start)\s+(?:the )?(.+)$/); if (app && app[1].length < 80) { const action = await executeVoiceAction('open_app', { name: app[1] }); return { confirmation: action.confirmation, action }; }
  return undefined;
}
