import type { Text } from './mock-interview';

/** Peer mock interview rules shared by lib/server/mock-peer.ts and components/mock-peer.tsx. Client-safe. */
export const LEVELS = ['intern', 'new-grad', 'mid', 'senior'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_NAMES: Record<Level, Text> = {
  intern: ['实习', 'Internship'],
  'new-grad': ['应届', 'New grad'],
  mid: ['社招 1–5 年', 'Experienced (1–5 yrs)'],
  senior: ['资深 5 年+', 'Senior (5+ yrs)'],
};
/** Slots are UTC hour blocks (whole hours since the epoch): the first LEAD_HOURS ahead, the last a week out. */
export const LEAD_HOURS = 2;
export const WINDOW_HOURS = 7 * 24;
export const SLOTS_MAX = 24;
/** "Practise now": a request that finds no other instant one this many minutes after filing lapses. */
export const INSTANT_MINUTES = 15;
/** Target companies and topics a request may name; partners sharing them are matched first. */
export const FOCUS_MAX = 3;
export const COMMON_FOCUS: Text = ['共同关注', 'In common'];

const pad = (n: number) => String(n).padStart(2, '0');
/** "2026-10-15 22:00 (UTC+8)" in a Date#getTimezoneOffset zone. */
export function localSlot(slot: number, tz: number) {
  const d = new Date(slot * 3600000 - tz * 60000);
  const off = -tz;
  const zone = `UTC${off < 0 ? '-' : '+'}${Math.floor(Math.abs(off) / 60)}${Math.abs(off) % 60 ? `:${pad(Math.abs(off) % 60)}` : ''}`;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} (${zone})`;
}
/** Hosts a meeting link may point at; anything else could be a phishing page. */
const MEETING_HOSTS = [
  'meet.google.com',
  'zoom.us',
  'teams.microsoft.com',
  'teams.live.com',
  'meeting.tencent.com',
  'voovmeeting.com',
  'whereby.com',
  'meet.jit.si',
];
export function meetingUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      MEETING_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}
