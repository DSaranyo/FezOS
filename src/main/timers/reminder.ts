import * as chrono from 'chrono-node';

export type ParsedReminder = { text: string; endsAt: number; kind: 'reminder' | 'alarm' };

function future(date: Date) {
  if (date.getTime() > Date.now() + 1_000) return date.getTime();
  const tomorrow = new Date(date); tomorrow.setDate(tomorrow.getDate() + 1); return tomorrow.getTime();
}

export function parseReminder(text: string, duration: (value: string) => number | undefined): ParsedReminder | undefined {
  const source = text.trim().toLocaleLowerCase();
  const alarm = source.match(/^(?:set )?(?:an? )?alarm (?:for|at|in) (.+)$/);
  if (alarm) {
    const relative = alarm[1].match(/^in (.+)$/)?.[1] ?? (source.includes(' in ') ? alarm[1] : undefined);
    const milliseconds = relative && duration(relative);
    const date = milliseconds ? new Date(Date.now() + milliseconds) : chrono.parseDate(alarm[1], new Date(), { forwardDate: true });
    return date ? { text: 'Alarm', endsAt: future(date), kind: 'alarm' } : undefined;
  }
  const relative = source.match(/^(?:remind me|set (?:a )?reminder) in (.+?) to (.+)$/);
  if (relative) {
    const milliseconds = duration(relative[1]);
    return milliseconds ? { text: relative[2].trim(), endsAt: Date.now() + milliseconds, kind: 'reminder' } : undefined;
  }
  const timeFirst = source.match(/^remind me (.+?) to (.+)$/);
  if (timeFirst) {
    const date = chrono.parseDate(timeFirst[1], new Date(), { forwardDate: true });
    return date ? { text: timeFirst[2].trim(), endsAt: future(date), kind: 'reminder' } : undefined;
  }
  const absolute = source.match(/^(?:remind me|set (?:a )?reminder) to (.+?) (?:at|on) (.+)$/);
  if (absolute) {
    const date = chrono.parseDate(absolute[2], new Date(), { forwardDate: true });
    return date ? { text: absolute[1].trim(), endsAt: future(date), kind: 'reminder' } : undefined;
  }
  return undefined;
}
