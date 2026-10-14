const DAY = 86400000;
/** "Oct 12 – Oct 18" / "10月12日 – 10月18日" for an issue's Monday (UTC). */
export function weekRange(start: number, zh: boolean) {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(start + 6 * DAY)}`;
}
