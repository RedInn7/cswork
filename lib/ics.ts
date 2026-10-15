/** iCalendar (RFC 5545) helpers shared by the .ics exports. */

/** TEXT value escaping: backslash, semicolon, comma and line breaks. */
export const escapeText = (text: string) => text.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n');

/** Folds a content line at 75 octets (UTF-8), continuation lines starting with a space. */
export function fold(line: string) {
  const parts: string[] = [];
  let part = '',
    size = 0;
  for (const ch of line) {
    const cp = ch.codePointAt(0)!;
    const bytes = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (size + bytes > (parts.length ? 74 : 75)) {
      parts.push(part);
      part = '';
      size = 0;
    }
    part += ch;
    size += bytes;
  }
  parts.push(part);
  return parts.join('\r\n ');
}

/** A UTC DATE-TIME: 20261015T140000Z. */
export const utcStamp = (at: Date | number) =>
  new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** One VEVENT: UID and DTSTAMP, then `fields`, then a display alarm when `alarm` is given. */
export const vevent = (
  uid: string,
  now: Date | number,
  fields: string[],
  alarm?: { trigger: string; note: string },
) => [
  'BEGIN:VEVENT',
  `UID:${uid}`,
  `DTSTAMP:${utcStamp(now)}`,
  ...fields,
  ...(alarm
    ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(alarm.note)}`, `TRIGGER:${alarm.trigger}`, 'END:VALARM']
    : []),
  'END:VEVENT',
];

/** A whole calendar: `head` lines (VERSION, PRODID, …) and the events, folded, CRLF-terminated. */
export const calendar = (head: string[], events: string[][]) =>
  ['BEGIN:VCALENDAR', ...head, ...events.flat(), 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
