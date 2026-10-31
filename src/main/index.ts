import { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, Notification, WebContents, type Display } from 'electron';
import path from 'node:path';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import { addElevenLabsCharacters, elevenLabsCharactersSessionTotal, elevenLabsCharactersTotal, hasApiKey, hasElevenLabsApiKey, incrementUsage, macros, migrateDeprecatedModels, saveApiKey, saveElevenLabsApiKey, saveMacros, saveSettings, settings, resetElevenLabsCharacters, usageCounts } from './store';
import { clearHistory, streamAnswer, supportsToolCalling, transcribe, verifyConfiguration } from './groq';
import { ElevenLabsProvider } from './tts/elevenlabs';
import { TtsSession } from './tts/session';
import { TimerManager } from './timers/manager';
import { routeLocally } from './router/local';
import { MacroRunner } from './macros/runner';
import { validateMacros } from './macros/model';
import { executeSystemAction, SystemController, type SystemActionName } from './system/registry';

let pill: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let activeDisplay: Display | null = null;
let pillState = 'idle';
let sliverVisible = true;
let hoverSince: number | undefined;
let outsideSince: number | undefined;
let hoverPoll: NodeJS.Timeout | undefined;
let captureTarget: WebContents | null = null;
let captureTokens = new Set<string>();
let hotkeyStartTimer: NodeJS.Timeout | undefined;
let hotkeySafetyTimer: NodeJS.Timeout | undefined;
let hotkeyRecording = false;
const pressed = new Set<number>();
const ttsSessions = new Map<string, TtsSession>();
const macroRunner = new MacroRunner(progress => pill?.webContents.send('macro:progress', progress));
const systemController = new SystemController(pending => pill?.webContents.send('system:confirmation', pending));
const timerManager = new TimerManager(snapshot => {
  pill?.webContents.send('timer:update', snapshot);
  if (snapshot.items.length) { setSliver(false); pill?.showInactive(); }
}, item => {
  pill?.webContents.send('timer:due', item);
  if (Notification.isSupported()) new Notification({ title: item.missed ? 'Missed timer' : 'Timer complete', body: `${item.name} is done.` }).show();
}, item => {
  pill?.webContents.send('reminder:due', item);
  if (Notification.isSupported()) new Notification({ title: item.missed ? 'Missed reminder' : item.kind === 'alarm' ? 'Alarm' : 'Reminder', body: item.text }).show();
  setSliver(false); pill?.showInactive();
});
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
// Compiled main code lives in dist/main/main while the production renderer is
// emitted to dist/renderer. Development uses Vite, so keep the paths separate.
const renderer = () => isDev ? process.env.VITE_DEV_SERVER_URL! : `file://${path.join(__dirname, '../../renderer/index.html')}`;
const CONTROL = new Set<number>([UiohookKey.Ctrl, UiohookKey.CtrlRight]);
const ALT = new Set<number>([UiohookKey.Alt, UiohookKey.AltRight]);
const SHIFT = new Set<number>([UiohookKey.Shift, UiohookKey.ShiftRight]);
const META = new Set<number>([UiohookKey.Meta, UiohookKey.MetaRight]);

function keyToken(keycode: number) {
  if (CONTROL.has(keycode)) return 'Control';
  if (ALT.has(keycode)) return 'Alt';
  if (SHIFT.has(keycode)) return 'Shift';
  if (META.has(keycode)) return 'Meta';
  const entry = Object.entries(UiohookKey).find(([, value]) => value === keycode)?.[0];
  return entry === 'Space' ? 'Space' : entry ?? `Key${keycode}`;
}
function orderedTokens(tokens: Iterable<string>) {
  const order = ['Control', 'Alt', 'Shift', 'Meta'];
  return [...new Set(tokens)].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
}
function configuredTokens() { return settings().hotkey.split('+').map(token => token.trim()).filter(Boolean); }
function pressedTokens() { return new Set([...pressed].map(keyToken)); }
function chordHeld() {
  const required = configuredTokens(); const down = pressedTokens();
  return required.length > 0 && required.every(token => down.has(token));
}
function chordOnly() {
  const required = new Set(configuredTokens()); const down = pressedTokens();
  return chordHeld() && down.size === required.size && [...down].every(token => required.has(token));
}
function clearHotkeyTimers() {
  if (hotkeyStartTimer) clearTimeout(hotkeyStartTimer);
  if (hotkeySafetyTimer) clearTimeout(hotkeySafetyTimer);
  hotkeyStartTimer = undefined; hotkeySafetyTimer = undefined;
}
function positionPill(display = activeDisplay ?? screen.getPrimaryDisplay()) {
  if (!pill) return;
  activeDisplay = display;
  const { workArea, bounds } = display;
  pill.setBounds({ x: Math.round(workArea.x + (workArea.width - 600) / 2), y: bounds.y, width: 600, height: 500 });
}
function setSliver(hidden: boolean, display = activeDisplay ?? screen.getPrimaryDisplay()) {
  if (!pill || sliverVisible === hidden) return;
  positionPill(display); sliverVisible = hidden;
  pill.setIgnoreMouseEvents(hidden, { forward: true });
  pill.webContents.send('pill:visibility', hidden ? 'hidden' : 'revealed');
}
function reveal(display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())) {
  if (settingsWindow && !settingsWindow.isMinimized()) return;
  positionPill(display); setSliver(false, display); pill?.showInactive();
}
function createPill() {
  pill = new BrowserWindow({ width: 600, height: 500, transparent: true, frame: false, resizable: false, show: false, skipTaskbar: true, focusable: false, hasShadow: false, alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false } });
  pill.setAlwaysOnTop(true, 'screen-saver'); pill.setIgnoreMouseEvents(true, { forward: true }); positionPill(); pill.loadURL(renderer());
  pill.once('ready-to-show', () => { pill?.showInactive(); pill?.webContents.send('timer:update', timerManager.snapshot()); timerManager.start(); if (!settings().autoHidePill) setSliver(false); });
}
function openSettings() {
  if (settingsWindow) { settingsWindow.restore(); settingsWindow.focus(); return; }
  pill?.hide();
  settingsWindow = new BrowserWindow({ width: 520, height: 670, resizable: false, title: 'Fez Settings', backgroundColor: '#111111', webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false } });
  settingsWindow.loadURL(`${renderer()}?view=settings`);
  settingsWindow.on('minimize', () => pill?.showInactive());
  settingsWindow.on('restore', () => pill?.hide());
  settingsWindow.on('closed', () => { settingsWindow = null; pill?.showInactive(); });
}
function startPushToTalk() {
  if (!chordOnly() || hotkeyRecording) return;
  hotkeyRecording = true; reveal(); pill?.webContents.send('pill:hotkey-start');
  hotkeySafetyTimer = setTimeout(() => stopPushToTalk(false), 60_000);
}
function stopPushToTalk(cancel: boolean) {
  if (hotkeyStartTimer) clearTimeout(hotkeyStartTimer);
  hotkeyStartTimer = undefined;
  if (!hotkeyRecording) return;
  hotkeyRecording = false;
  if (hotkeySafetyTimer) clearTimeout(hotkeySafetyTimer);
  hotkeySafetyTimer = undefined;
  pill?.webContents.send(cancel ? 'pill:hotkey-cancel' : 'pill:hotkey-stop');
}
function scheduleHotkey() {
  if (hotkeyStartTimer || hotkeyRecording || !chordOnly()) return;
  hotkeyStartTimer = setTimeout(() => {
    hotkeyStartTimer = undefined;
    if (!chordOnly()) return;
    if (settings().interactionMode === 'push-to-talk') startPushToTalk();
    else { reveal(); pill?.webContents.send('pill:hotkey-toggle'); }
  }, 150);
}
function startHook() {
  uIOhook.on('keydown', event => {
    if (pressed.has(event.keycode)) return; // autorepeat
    pressed.add(event.keycode);
    if (captureTarget) {
      if (keyToken(event.keycode) === 'Escape') { captureTarget.send('hotkey:capture-cancelled'); captureTarget = null; captureTokens.clear(); return; }
      captureTokens.add(keyToken(event.keycode)); return;
    }
    if (keyToken(event.keycode) === 'Escape' && pillState !== 'idle') { pill?.webContents.send('pill:dismiss'); return; }
    if (chordHeld() && !chordOnly()) { if (hotkeyStartTimer) clearTimeout(hotkeyStartTimer); hotkeyStartTimer = undefined; stopPushToTalk(true); return; }
    scheduleHotkey();
  });
  uIOhook.on('keyup', event => {
    pressed.delete(event.keycode);
    if (captureTarget && pressed.size === 0 && captureTokens.size) {
      const hotkey = orderedTokens(captureTokens).join('+'); captureTarget.send('hotkey:captured', hotkey); captureTarget = null; captureTokens.clear(); return;
    }
    if (!chordHeld()) { if (hotkeyStartTimer) clearTimeout(hotkeyStartTimer); hotkeyStartTimer = undefined; if (settings().interactionMode === 'push-to-talk') stopPushToTalk(false); }
  });
  uIOhook.start();
}
function pollCursor() {
  const point = screen.getCursorScreenPoint(); const display = screen.getDisplayNearestPoint(point); const now = Date.now(); const config = settings();
  if (!config.autoHidePill || pillState !== 'idle' || (settingsWindow && !settingsWindow.isMinimized())) { hoverSince = undefined; outsideSince = undefined; return; }
  const center = display.workArea.x + display.workArea.width / 2;
  const inHotZone = point.y >= display.bounds.y && point.y <= display.bounds.y + 4 && Math.abs(point.x - center) <= 144;
  if (sliverVisible) {
    outsideSince = undefined;
    if (inHotZone) { hoverSince ??= now; if (now - hoverSince >= 120) { reveal(display); hoverSince = undefined; } } else hoverSince = undefined;
    return;
  }
  const inside = point.x >= center - 140 && point.x <= center + 140 && point.y >= display.bounds.y - 16 && point.y <= display.bounds.y + 58;
  if (inside) outsideSince = undefined;
  else { outsideSince ??= now; if (now - outsideSince >= 500) { setSliver(true, display); outsideSince = undefined; } }
}
function createTray() {
  const icon = nativeImage.createFromDataURL('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3QgeD0iNCIgeT0iOCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjE2IiByeD0iOCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=');
  tray = new Tray(icon); tray.setToolTip('Fez voice assistant');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Show Fez', click: () => reveal() }, { label: 'Hide Fez', click: () => setSliver(true) }, { type: 'separator' }, { label: 'Settings', click: openSettings }, { type: 'separator' }, { label: 'Quit', click: () => app.quit() }]));
}
function cancelTts(requestId?: string) {
  if (requestId) { ttsSessions.get(requestId)?.cancel(); ttsSessions.delete(requestId); pill?.webContents.send('tts:cancel', requestId); return; }
  for (const [id, session] of ttsSessions) { session.cancel(); pill?.webContents.send('tts:cancel', id); }
  ttsSessions.clear();
}
function createTtsSession(sender: WebContents, requestId: string) {
  const session = new TtsSession({
    queued: sequence => sender.send('tts:queued', requestId, sequence),
    audio: (sequence, bytes) => sender.send('tts:audio', requestId, sequence, bytes),
    fallback: (sequence, text) => sender.send('tts:fallback', requestId, sequence, text),
    notice: message => sender.send('tts:notice', requestId, message),
    complete: () => sender.send('tts:generated', requestId)
  });
  ttsSessions.set(requestId, session); return session;
}
async function executeTimerTool(name: string, args: Record<string, unknown>) {
  if (name === 'set_timer') {
    const seconds = Number(args.duration_seconds);
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 604_800) throw new Error('Timer duration must be between one second and seven days.');
    const requestedName = typeof args.name === 'string' ? args.name.trim().slice(0, 80) : '';
    const item = timerManager.create(requestedName || 'Timer', seconds * 1_000);
    return { label: 'Timer set…', confirmation: `${item.name} set.` };
  }
  if (name !== 'timer_control' || typeof args.action !== 'string') return undefined;
  switch (args.action) {
    case 'pause': return { label: 'Timer paused', confirmation: timerManager.pause() ? 'Timer paused.' : 'No running timer.' };
    case 'resume': return { label: 'Timer resumed', confirmation: timerManager.resume() ? 'Timer resumed.' : 'No paused timer.' };
    case 'cancel': return { label: 'Timer cancelled', confirmation: timerManager.cancel() ? 'Timer cancelled.' : 'No timer to cancel.' };
    case 'cancel_all': return { label: 'Timers cancelled', confirmation: timerManager.cancelAll() ? 'All timers cancelled.' : 'No timers to cancel.' };
    case 'add_minutes': {
      const minutes = Number(args.minutes);
      if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1_440) throw new Error('Minutes must be between one and 1,440.');
      return { label: 'Time added', confirmation: timerManager.add(undefined, minutes * 60_000) ? 'Time added.' : 'No timer to update.' };
    }
    case 'time_left': {
      const timer = timerManager.snapshot().next;
      return { label: 'Timer status', confirmation: timer ? `${timer.name} is running.` : 'No timer is running.' };
    }
    default: return undefined;
  }
}

async function executeLocalTool(name: string, args: Record<string, unknown>) {
  const timerAction = await executeTimerTool(name, args); if (timerAction) return timerAction;
  if (name === 'set_reminder') {
    const minutes = Number(args.in_minutes); const text = typeof args.text === 'string' ? args.text.trim().slice(0, 240) : '';
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 525_600 || !text) throw new Error('A reminder needs text and a time in minutes.');
    const item = timerManager.createReminder(text, Date.now() + minutes * 60_000, args.kind === 'alarm' ? 'alarm' : 'reminder');
    return { label: 'Reminder set', confirmation: item.kind === 'alarm' ? 'Alarm set.' : 'Reminder set.' };
  }
  if (name === 'reminder_control') {
    if (args.action === 'list') { const count = timerManager.listReminders().length; return { label: 'Reminders', confirmation: count ? `${count} reminder${count === 1 ? '' : 's'} scheduled.` : 'No reminders scheduled.' }; }
    if (args.action === 'cancel_all') return { label: 'Reminders cancelled', confirmation: timerManager.cancelAllReminders() ? 'Reminders cancelled.' : 'No reminders scheduled.' };
    if (args.action === 'cancel') return { label: 'Reminder cancelled', confirmation: timerManager.cancelReminder(undefined, typeof args.about === 'string' ? args.about : undefined) ? 'Reminder cancelled.' : 'No matching reminder.' };
    throw new Error('Unsupported reminder action.');
  }
  if (name === 'system_control') {
    const action = args.action;
    const allowed = new Set<SystemActionName>(['volume_set', 'volume_up', 'volume_down', 'mute', 'unmute', 'play_pause', 'media_pause', 'next_track', 'previous_track', 'lock', 'screenshot', 'brightness', 'minimize_all', 'shutdown', 'restart', 'sleep', 'sign_out']);
    if (typeof action !== 'string' || !allowed.has(action as SystemActionName)) throw new Error('Unsupported system action.');
    if (['shutdown', 'restart', 'sleep', 'sign_out'].includes(action)) {
      const pending = systemController.request(action as 'shutdown' | 'restart' | 'sleep' | 'sign_out');
      return { label: pending.prompt, confirmation: `${pending.prompt} Confirm in Fez.` };
    }
    return executeSystemAction(action as SystemActionName, Number(args.value));
  }
  if (name === 'run_macro') {
    const requested = typeof args.name === 'string' ? args.name.trim().toLocaleLowerCase() : '';
    const macro = macros().find(item => item.name.toLocaleLowerCase() === requested);
    if (!macro) throw new Error('That macro no longer exists.');
    return macroRunner.run(macro);
  }
  return undefined;
}

app.whenReady().then(() => { migrateDeprecatedModels(); createPill(); createTray(); startHook(); hoverPoll = setInterval(pollCursor, 50); screen.on('display-metrics-changed', () => positionPill()); });
app.on('window-all-closed', () => { /* the tray keeps Fez available on Windows */ });
app.on('will-quit', () => { clearHotkeyTimers(); cancelTts(); if (hoverPoll) clearInterval(hoverPoll); uIOhook.stop(); });

ipcMain.on('pill:interactive', (_event, enabled: boolean) => { if (!sliverVisible) pill?.setIgnoreMouseEvents(!enabled, { forward: true }); });
ipcMain.on('pill:state', (_event, state: string) => { pillState = state; if (state !== 'idle') { sliverVisible = false; pill?.setIgnoreMouseEvents(false); } });
ipcMain.on('pill:dismiss', () => { cancelTts(); pill?.webContents.send('pill:dismiss'); });
ipcMain.handle('hotkey:capture', event => { captureTarget = event.sender; captureTokens.clear(); event.sender.send('hotkey:capture-started'); });
ipcMain.handle('settings:get', () => ({ ...settings(), hasApiKey: hasApiKey(), hasElevenLabsApiKey: hasElevenLabsApiKey(), elevenLabsCharactersTotal: elevenLabsCharactersTotal(), elevenLabsCharactersSession: elevenLabsCharactersSessionTotal(), usage: usageCounts(), llmSupportsTools: supportsToolCalling(settings().llmModel) }));
ipcMain.handle('settings:save', (_event, update) => { const result = saveSettings(update); app.setLoginItemSettings({ openAtLogin: result.launchAtStartup }); positionPill(); if (!result.autoHidePill) setSliver(false); pill?.webContents.send('settings:changed', result); return result; });
ipcMain.handle('settings:saveKey', (_event, key: string) => { saveApiKey(key); pill?.webContents.send('pill:api-key-saved'); return true; });
ipcMain.handle('settings:saveElevenLabsKey', (_event, key: string) => { saveElevenLabsApiKey(key); return true; });
ipcMain.handle('settings:resetElevenLabsUsage', () => { resetElevenLabsCharacters(); return { total: 0, session: 0 }; });
ipcMain.handle('settings:open', openSettings);
ipcMain.handle('groq:check', () => verifyConfiguration());
ipcMain.handle('audio:transcribe', async (_event, bytes: Uint8Array) => { const result = await transcribe(bytes); incrementUsage('whisperCalls'); return result; });
ipcMain.handle('tts:test', async (event, requestId: string) => {
  const provider = new ElevenLabsProvider(); const controller = new AbortController(); const sample = 'Hello from Fez. Your ElevenLabs voice is ready.';
  try { const bytes = await provider.speak({ text: sample, signal: controller.signal }); addElevenLabsCharacters(sample.length); event.sender.send('tts:audio', requestId, 0, bytes); event.sender.send('tts:generated', requestId); return { message: 'Voice sample generated.' }; }
  catch (error) { throw new Error(error instanceof Error ? error.message : 'Voice test failed.'); }
});
ipcMain.handle('tts:cancel', (_event, requestId?: string) => { cancelTts(requestId); return true; });
ipcMain.handle('chat:start', async (event, question: string, requestId: string) => {
  cancelTts(); const session = createTtsSession(event.sender, requestId); let actionTaken = false;
  try {
    const local = await routeLocally(question, { timers: timerManager, macros: macroRunner, system: systemController });
    if (local) {
      incrementUsage('localCommands'); actionTaken = true;
      event.sender.send('chat:action', requestId, { label: local.confirmation, confirmation: local.confirmation });
      if (local.macroCandidate) event.sender.send('macro:candidate', local.macroCandidate);
      if (local.systemConfirmation) event.sender.send('system:confirmation', local.systemConfirmation);
      if (settings().speakActionConfirmations) session.addText(local.confirmation);
      session.finish(); event.sender.send('chat:done', requestId); return;
    }
    incrementUsage('chatCalls');
    await streamAnswer(question, token => { event.sender.send('chat:token', requestId, token); if (!actionTaken && settings().speakResponses) session.addText(token); }, action => { actionTaken = true; event.sender.send('chat:action', requestId, action); if (settings().speakActionConfirmations) session.addText(action.confirmation); }, executeLocalTool);
    session.finish(); event.sender.send('chat:done', requestId);
  } catch (error) {
    // A few tool-capable Groq models can execute the requested action but fail
    // while generating their optional post-tool sentence. The action is still
    // a success, so retain its confirmation instead of replacing it with a
    // misleading model error.
    if (actionTaken) { session.finish(); event.sender.send('chat:done', requestId); return; }
    cancelTts(requestId); event.sender.send('chat:error', requestId, error instanceof Error ? error.message : 'Something went wrong.');
  }
});
ipcMain.handle('chat:clear', () => clearHistory());
ipcMain.handle('timer:pause', (_event, id?: string) => timerManager.pause(id));
ipcMain.handle('timer:resume', (_event, id?: string) => timerManager.resume(id));
ipcMain.handle('timer:add', (_event, id: string, milliseconds: number) => timerManager.add(id, milliseconds));
ipcMain.handle('timer:cancel', (_event, id?: string) => timerManager.cancel(id));
ipcMain.handle('timer:dismiss', (_event, id: string) => timerManager.dismiss(id));
ipcMain.handle('timer:snooze', (_event, id: string) => timerManager.snooze(id));
ipcMain.handle('reminder:dismiss', (_event, id: string) => timerManager.dismissReminder(id));
ipcMain.handle('reminder:snooze', (_event, id: string) => timerManager.snoozeReminder(id));
ipcMain.handle('reminder:cancel', (_event, id?: string) => timerManager.cancelReminder(id));
ipcMain.handle('system:confirm', () => systemController.confirm());
ipcMain.handle('system:cancel', () => systemController.cancel());
ipcMain.handle('macros:get', () => macros());
ipcMain.handle('macros:save', (_event, value: unknown) => saveMacros(validateMacros(value)));
ipcMain.handle('macros:run', async (_event, id: string) => { const macro = macros().find(item => item.id === id); if (!macro) throw new Error('Macro not found.'); return macroRunner.run(macro); });
