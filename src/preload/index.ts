import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pill', {
  setInteractive: (value: boolean) => ipcRenderer.send('pill:interactive', value),
  dismiss: () => ipcRenderer.send('pill:dismiss'), openSettings: () => ipcRenderer.invoke('settings:open'), testGroq: () => ipcRenderer.invoke('groq:check'),
  reportState: (state: string) => ipcRenderer.send('pill:state', state),
  captureHotkey: () => ipcRenderer.invoke('hotkey:capture'),
  settings: { get: () => ipcRenderer.invoke('settings:get'), save: (value: unknown) => ipcRenderer.invoke('settings:save', value), saveKey: (key: string) => ipcRenderer.invoke('settings:saveKey', key), saveElevenLabsKey: (key: string) => ipcRenderer.invoke('settings:saveElevenLabsKey', key), resetElevenLabsUsage: () => ipcRenderer.invoke('settings:resetElevenLabsUsage') },
  transcribe: (bytes: Uint8Array) => ipcRenderer.invoke('audio:transcribe', bytes),
  chat: { start: (question: string, id: string) => ipcRenderer.invoke('chat:start', question, id), clear: () => ipcRenderer.invoke('chat:clear') },
  tts: { test: (id: string) => ipcRenderer.invoke('tts:test', id), cancel: (id?: string) => ipcRenderer.invoke('tts:cancel', id) },
  timers: { pause: (id?: string) => ipcRenderer.invoke('timer:pause', id), resume: (id?: string) => ipcRenderer.invoke('timer:resume', id), add: (id: string, milliseconds: number) => ipcRenderer.invoke('timer:add', id, milliseconds), cancel: (id?: string) => ipcRenderer.invoke('timer:cancel', id), dismiss: (id: string) => ipcRenderer.invoke('timer:dismiss', id), snooze: (id: string) => ipcRenderer.invoke('timer:snooze', id) },
  reminders: { dismiss: (id: string) => ipcRenderer.invoke('reminder:dismiss', id), snooze: (id: string) => ipcRenderer.invoke('reminder:snooze', id), cancel: (id?: string) => ipcRenderer.invoke('reminder:cancel', id) },
  system: { confirm: () => ipcRenderer.invoke('system:confirm'), cancel: () => ipcRenderer.invoke('system:cancel') },
  macros: { get: () => ipcRenderer.invoke('macros:get'), save: (value: unknown) => ipcRenderer.invoke('macros:save', value), run: (id: string) => ipcRenderer.invoke('macros:run', id) },
  on: (channel: string, listener: (...args: any[]) => void) => { const handler = (_: unknown, ...args: any[]) => listener(...args); ipcRenderer.on(channel, handler); return () => ipcRenderer.removeListener(channel, handler); }
});
