const values: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, sixty: 60, ninety: 90 };
function number(value: string) { return /^\d+$/.test(value) ? Number(value) : values[value.replace(/[ -]/g, '')]; }
export function parseDuration(text: string) {
  const source = text.toLowerCase(); let total = 0; let matched = false;
  // Handle this spoken form before the general matcher, otherwise its
  // "hour" portion would be counted a second time below.
  if (/an? hour and a half|one hour and a half/.test(source)) return 5_400_000;
  const pattern = /\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:[- ]five)?|sixty|ninety)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/g;
  for (const match of source.matchAll(pattern)) { const amount = number(match[1]); if (!amount) continue; matched = true; const unit = match[2]; total += amount * (unit.startsWith('h') ? 3_600_000 : unit.startsWith('m') ? 60_000 : 1_000); }
  return matched && total > 0 ? total : undefined;
}
