export type StartApp = { Name: string; AppID: string };

function comparableAppName(value: string) {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function matchStartMenuApp(apps: StartApp[], requested: string) {
  const exact = apps.find(app => app.Name?.toLocaleLowerCase() === requested.toLocaleLowerCase());
  if (exact) return exact;
  const needle = comparableAppName(requested);
  if (!needle) return undefined;
  const canonical = apps.find(app => comparableAppName(app.Name ?? '') === needle);
  if (canonical) return canonical;
  // Speech-to-text often inserts/removes a space in names such as ChatGPT.
  // Keep this conservative so an unrelated short name never launches an app.
  return needle.length >= 4 ? apps.find(app => {
    const name = comparableAppName(app.Name ?? ''); return Boolean(name) && (name.includes(needle) || needle.includes(name));
  }) : undefined;
}
