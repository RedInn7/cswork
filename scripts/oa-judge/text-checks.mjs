/**
 * Text comparisons for translated OA statements: an English rendering must keep every
 * number and ASCII identifier/literal of the Chinese one. Shared by check-translations.mjs.
 */
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const normalize = (text) =>
  text
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) =>
      '^' + [...s].map((c) => superscripts.indexOf(c)).join(''),
    )
    // "200万" and "2,000,000" are the same bound; compare plain values.
    .replace(/(\d+(?:\.\d+)?)\s*万/g, (_, n) => String(Math.round(Number(n) * 10000)))
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    // Chinese often glues a name to a range ("turns0..9"); English may add a space.
    .replace(/([A-Za-z])(\d)/g, '$1 $2');
export const numbers = (text) => new Set(normalize(text).match(/\d+/g) || []);
export const identifiers = (text) =>
  new Set(
    (normalize(text).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).filter(
      (w) => w.length > 1,
    ),
  );
