import { shell } from 'electron';
import { execFile } from 'node:child_process';
import { settings } from '../store';
import type { VoiceAction } from '../actions';

export type SystemActionName = 'volume_set' | 'volume_up' | 'volume_down' | 'mute' | 'unmute' | 'play_pause' | 'media_pause' | 'next_track' | 'previous_track' | 'lock' | 'screenshot' | 'brightness' | 'minimize_all' | 'shutdown' | 'restart' | 'sleep' | 'sign_out';
type DangerousAction = Extract<SystemActionName, 'shutdown' | 'restart' | 'sleep' | 'sign_out'>;
export type PendingSystemAction = { action: DangerousAction; prompt: string; expiresAt: number };

function run(executable: string, args: string[]) {
  return new Promise<void>((resolve, reject) => execFile(executable, args, { windowsHide: true }, error => error ? reject(error) : resolve()));
}

function powerShell(script: string, args: string[] = []) {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script, ...args]);
}

const INPUT_SCRIPT = `Add-Type @'
using System; using System.Runtime.InteropServices;
public static class PillInput { [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra); public static void Key(byte key) { keybd_event(key,0,0,UIntPtr.Zero); keybd_event(key,0,2,UIntPtr.Zero); } public static void Desktop() { keybd_event(0x5B,0,0,UIntPtr.Zero); keybd_event(0x44,0,0,UIntPtr.Zero); keybd_event(0x44,0,2,UIntPtr.Zero); keybd_event(0x5B,0,2,UIntPtr.Zero); } }
'@
if ($args[0] -eq 'desktop') { [PillInput]::Desktop() } else { [PillInput]::Key([byte]$args[0]) }`;

const VOLUME_SCRIPT = `Add-Type @'
using System; using System.Runtime.InteropServices;
namespace PillAudio {
  enum EDataFlow { eRender, eCapture, eAll } enum ERole { eConsole, eMultimedia, eCommunications }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDevice { int Activate(ref Guid iid, int cls, IntPtr activation, [MarshalAs(UnmanagedType.IUnknown)] out object endpoint); int OpenPropertyStore(int access, out IntPtr properties); int GetId(out string id); int GetState(out int state); }
  [ComImport, Guid("A95664D2-9614-4B35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceEnumerator { int EnumAudioEndpoints(EDataFlow flow, int state, out IntPtr devices); int GetDefaultAudioEndpoint(EDataFlow flow, ERole role, out IMMDevice device); int GetDevice(string id, out IMMDevice device); int RegisterEndpointNotificationCallback(IntPtr client); int UnregisterEndpointNotificationCallback(IntPtr client); }
  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioEndpointVolume { int RegisterControlChangeNotify(IntPtr notification); int UnregisterControlChangeNotify(IntPtr notification); int GetChannelCount(out uint count); int SetMasterVolumeLevel(float level, Guid context); int SetMasterVolumeLevelScalar(float level, Guid context); int GetMasterVolumeLevel(out float level); int GetMasterVolumeLevelScalar(out float level); int SetChannelVolumeLevel(uint channel, float level, Guid context); int SetChannelVolumeLevelScalar(uint channel, float level, Guid context); int GetChannelVolumeLevel(uint channel, out float level); int GetChannelVolumeLevelScalar(uint channel, out float level); int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid context); int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute); }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
  public static class Volume { public static void Set(float value) { IMMDevice device; ((IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject())).GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device); object raw; Guid iid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A"); device.Activate(ref iid, 23, IntPtr.Zero, out raw); ((IAudioEndpointVolume)raw).SetMasterVolumeLevelScalar(value, Guid.Empty); } public static void Mute(bool mute) { IMMDevice device; ((IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject())).GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device); object raw; Guid iid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A"); device.Activate(ref iid, 23, IntPtr.Zero, out raw); ((IAudioEndpointVolume)raw).SetMute(mute, Guid.Empty); } }
}
'@
if ($args[0] -eq 'mute') { [PillAudio.Volume]::Mute([System.Convert]::ToBoolean($args[1])) } else { [PillAudio.Volume]::Set([float]$args[1]) }`;

async function volume(percent: number) { await powerShell(VOLUME_SCRIPT, ['set', String(Math.max(0, Math.min(100, percent)) / 100)]); }
async function mute(value: boolean) { await powerShell(VOLUME_SCRIPT, ['mute', String(value)]); }
async function key(code: number) { await powerShell(INPUT_SCRIPT, [String(code)]); }

function label(action: SystemActionName) {
  return ({ volume_set: 'Volume set.', volume_up: 'Volume up.', volume_down: 'Volume down.', mute: 'Muted.', unmute: 'Unmuted.', play_pause: 'Media toggled.', media_pause: 'Media paused.', next_track: 'Next track.', previous_track: 'Previous track.', lock: 'Computer locked.', screenshot: 'Snipping Tool opened.', brightness: 'Brightness set.', minimize_all: 'Windows minimized.', shutdown: 'Shutting down.', restart: 'Restarting.', sleep: 'Going to sleep.', sign_out: 'Signing out.' } as Record<SystemActionName, string>)[action];
}

export async function executeSystemAction(action: SystemActionName, value?: number): Promise<VoiceAction> {
  switch (action) {
    case 'volume_set': if (!Number.isFinite(value) || value! < 0 || value! > 100) throw new Error('Volume must be between 0 and 100.'); await volume(value!); break;
    case 'volume_up': await key(0xAF); break;
    case 'volume_down': await key(0xAE); break;
    case 'mute': await mute(true); break;
    case 'unmute': await mute(false); break;
    case 'play_pause': case 'media_pause': await key(0xB3); break;
    case 'next_track': await key(0xB0); break;
    case 'previous_track': await key(0xB1); break;
    case 'lock': await run('rundll32.exe', ['user32.dll,LockWorkStation']); break;
    case 'screenshot': await shell.openExternal('ms-screenclip:'); break;
    case 'brightness': {
      if (!Number.isFinite(value) || value! < 0 || value! > 100) throw new Error('Brightness must be between 0 and 100.');
      try { await powerShell("$items = @(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods -ErrorAction Stop); if (!$items.Count) { throw 'No brightness control' }; $items | ForEach-Object { $_.WmiSetBrightness(1, [byte]$args[0]) | Out-Null }", [String(value)]); }
      catch { throw new Error('Brightness is not supported on this display.'); }
      break;
    }
    case 'minimize_all': await powerShell(INPUT_SCRIPT, ['desktop']); break;
    case 'shutdown': await run('shutdown.exe', ['/s', '/t', '0']); break;
    case 'restart': await run('shutdown.exe', ['/r', '/t', '0']); break;
    case 'sleep': await run('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']); break;
    case 'sign_out': await run('shutdown.exe', ['/l']); break;
  }
  const confirmation = label(action); return { label: confirmation, confirmation };
}

const dangerPrompts: Record<DangerousAction, string> = { shutdown: 'Shut down your PC?', restart: 'Restart your PC?', sleep: 'Put your PC to sleep?', sign_out: 'Sign out of Windows?' };

export class SystemController {
  private pending: PendingSystemAction | undefined; private timeout: NodeJS.Timeout | undefined;
  constructor(private readonly onChange: (pending: PendingSystemAction | undefined) => void) {}
  request(action: DangerousAction) {
    if (!settings().enableDestructiveSystemActions) throw new Error('Destructive system actions are disabled in Settings.');
    if (this.timeout) clearTimeout(this.timeout);
    this.pending = { action, prompt: dangerPrompts[action], expiresAt: Date.now() + 10_000 };
    this.timeout = setTimeout(() => this.clear(), 10_000); this.onChange(this.pending); return this.pending;
  }
  async confirm() {
    const pending = this.pending;
    if (!pending || pending.expiresAt < Date.now()) { this.clear(); throw new Error('That confirmation expired.'); }
    this.clear(); return executeSystemAction(pending.action);
  }
  cancel() { if (!this.pending) return false; this.clear(); return true; }
  hasPending() { if (this.pending && this.pending.expiresAt < Date.now()) this.clear(); return Boolean(this.pending); }
  private clear() { if (this.timeout) clearTimeout(this.timeout); this.timeout = undefined; this.pending = undefined; this.onChange(undefined); }
}
