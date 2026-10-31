import { randomUUID } from 'node:crypto';
import { ReminderItem, TimerItem } from '../types';
import { reminders, saveReminders, saveTimers, timers } from '../store';

export type TimerSnapshot = { items: TimerItem[]; reminders: ReminderItem[]; next?: TimerItem };
export class TimerManager {
  private items = timers(); private reminderItems = reminders(); private timeout: NodeJS.Timeout | undefined;
  constructor(
    private readonly onChange: (snapshot: TimerSnapshot) => void,
    private readonly onTimerDue: (item: TimerItem) => void,
    private readonly onReminderDue: (item: ReminderItem) => void = () => undefined
  ) {}
  start() { this.check(); }
  snapshot(): TimerSnapshot { const active = this.items.filter(item => item.state === 'running' || item.state === 'paused'); const next = active.filter(item => item.state === 'running').sort((a, b) => a.endsAt - b.endsAt)[0] ?? active.filter(item => item.state === 'paused').sort((a, b) => (a.remainingMs ?? 0) - (b.remainingMs ?? 0))[0]; return { items: [...this.items], reminders: [...this.reminderItems], next }; }
  create(name: string, durationMs: number) { const item: TimerItem = { id: randomUUID(), name: name || 'Timer', durationMs, endsAt: Date.now() + durationMs, state: 'running', createdAt: Date.now() }; this.items.push(item); this.persist(); return item; }
  pause(id?: string) { const item = this.find(id); if (!item || item.state !== 'running') return undefined; item.remainingMs = Math.max(0, item.endsAt - Date.now()); item.state = 'paused'; this.persist(); return item; }
  resume(id?: string) { const item = this.find(id); if (!item || item.state !== 'paused') return undefined; item.endsAt = Date.now() + (item.remainingMs ?? item.durationMs); item.remainingMs = undefined; item.state = 'running'; this.persist(); return item; }
  add(id: string | undefined, milliseconds: number) { const item = this.find(id); if (!item) return undefined; if (item.state === 'paused') item.remainingMs = (item.remainingMs ?? 0) + milliseconds; else item.endsAt += milliseconds; item.durationMs += milliseconds; this.persist(); return item; }
  cancel(id?: string) { const item = this.find(id); if (!item) return undefined; this.items = this.items.filter(candidate => candidate.id !== item.id); this.persist(); return item; }
  cancelAll() { const count = this.items.length; this.items = []; this.persist(); return count; }
  dismiss(id: string) { this.items = this.items.filter(item => item.id !== id); this.persist(); }
  snooze(id: string, milliseconds = 300_000) { const item = this.items.find(candidate => candidate.id === id); if (!item) return; item.endsAt = Date.now() + milliseconds; item.durationMs = milliseconds; item.state = 'running'; item.remainingMs = undefined; item.missed = false; this.persist(); }
  createReminder(text: string, endsAt: number, kind: ReminderItem['kind'] = 'reminder') {
    const item: ReminderItem = { id: randomUUID(), text: text.trim().slice(0, 240) || 'Reminder', endsAt, state: 'scheduled', createdAt: Date.now(), kind };
    this.reminderItems.push(item); this.persist(); return item;
  }
  listReminders() { return [...this.reminderItems].filter(item => item.state === 'scheduled').sort((a, b) => a.endsAt - b.endsAt); }
  cancelReminder(id?: string, about?: string) {
    let item: ReminderItem | undefined;
    if (id) item = this.reminderItems.find(candidate => candidate.id === id);
    else if (about) {
      const words = about.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      item = this.reminderItems.find(candidate => words.every(word => candidate.text.toLocaleLowerCase().includes(word)));
    } else item = this.listReminders()[0];
    if (!item) return undefined;
    this.reminderItems = this.reminderItems.filter(candidate => candidate.id !== item!.id); this.persist(); return item;
  }
  cancelAllReminders() { const count = this.reminderItems.length; this.reminderItems = []; this.persist(); return count; }
  dismissReminder(id: string) { this.reminderItems = this.reminderItems.filter(item => item.id !== id); this.persist(); }
  snoozeReminder(id: string, milliseconds = 300_000) {
    const item = this.reminderItems.find(candidate => candidate.id === id); if (!item) return undefined;
    item.endsAt = Date.now() + milliseconds; item.state = 'scheduled'; item.missed = false; this.persist(); return item;
  }
  private find(id?: string) { if (id) return this.items.find(item => item.id === id); return this.items.filter(item => item.state === 'running' || item.state === 'paused').sort((a, b) => a.endsAt - b.endsAt)[0]; }
  private persist() { saveTimers(this.items); saveReminders(this.reminderItems); this.publish(); this.schedule(); }
  private publish() { this.onChange(this.snapshot()); }
  private check = () => {
    const now = Date.now(); let changed = false;
    for (const item of this.items) if (item.state === 'running' && item.endsAt <= now) { item.state = 'ringing'; item.missed = item.endsAt < now - 2_000; changed = true; this.onTimerDue(item); }
    for (const item of this.reminderItems) if (item.state === 'scheduled' && item.endsAt <= now) { item.state = 'ringing'; item.missed = item.endsAt < now - 2_000; changed = true; this.onReminderDue(item); }
    if (changed) { saveTimers(this.items); saveReminders(this.reminderItems); } this.publish(); this.schedule();
  };
  private schedule() {
    if (this.timeout) clearTimeout(this.timeout);
    const nextTimer = this.items.filter(item => item.state === 'running').sort((a, b) => a.endsAt - b.endsAt)[0];
    const nextReminder = this.reminderItems.filter(item => item.state === 'scheduled').sort((a, b) => a.endsAt - b.endsAt)[0];
    const delay = nextTimer ? Math.max(100, Math.min(250, nextTimer.endsAt - Date.now())) : nextReminder ? Math.max(100, nextReminder.endsAt - Date.now()) : 60_000;
    this.timeout = setTimeout(this.check, delay);
  }
}
