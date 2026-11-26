/**
 * Text comparisons for translated OA statements: a translation must keep every number and
 * ASCII identifier/literal of the Chinese one, and be written in its own language's script.
 * Shared by check-translations.mjs, check-guides.mjs and the editorial tests.
 */
export const TRANSLATED = ['ja', 'ko', 'vi'];
const han = /[㐀-鿿]/;
const kana = /[぀-ヿ]/;
const hangul = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const vietnamese = /[àáâãèéêìíòóôõùúýăđĩũơưẠ-ỹ]/i;
/** What is wrong with the script of `text` as `lang` (en, ja, ko, vi); null when nothing is. */
export function scriptProblem(lang, text) {
  if (lang === 'en') return han.test(text) ? 'Chinese characters left in' : null;
  if (lang === 'ja') return kana.test(text) ? null : 'no kana in';
  if (lang === 'ko') return hangul.test(text) ? null : 'no Hangul in';
  if (han.test(text) || kana.test(text) || hangul.test(text)) return 'Han, kana or Hangul in';
  return vietnamese.test(text) ? null : 'no Vietnamese diacritics in';
}
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
