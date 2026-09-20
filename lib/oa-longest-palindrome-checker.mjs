/** Fixed Cisco29 contract; the optimum is derived from input, never expected. */
export function longestPalindrome(actual, _expected, input) {
  if (typeof input !== 'string' || input.length > 1002) return false;
  // Exactly one physical ASCII-alphanumeric line, with an optional LF/CRLF.
  const s = input.endsWith('\r\n')
    ? input.slice(0, -2)
    : input.endsWith('\n')
      ? input.slice(0, -1)
      : input;
  if (!s.length || s.length > 1000 || /[^A-Za-z0-9]/.test(s)) return false;
  if (typeof actual !== 'string' || actual.length > 4096) return false;
  // Conventional one-token output; ASCII surrounding whitespace is harmless.
  const answer = actual.replace(/^[ \t\r\n\v\f]+|[ \t\r\n\v\f]+$/g, '');
  if (!answer.length || answer.length > s.length || /[^A-Za-z0-9]/.test(answer))
    return false;
  if (!s.includes(answer)) return false;
  for (let l = 0, r = answer.length - 1; l < r; l++, r--)
    if (answer[l] !== answer[r]) return false;
  // Interval DP is deliberately independent of a center-expansion reference.
  // At n=1000 the single packed table is 1,000,000 bytes, not boxed n² arrays.
  const n = s.length,
    pal = new Uint8Array(n * n);
  let best = 1;
  for (let l = n - 1; l >= 0; l--) {
    pal[l * n + l] = 1;
    for (let r = l + 1; r < n; r++) {
      if (s[l] === s[r] && (r - l === 1 || pal[(l + 1) * n + r - 1])) {
        pal[l * n + r] = 1;
        best = Math.max(best, r - l + 1);
      }
    }
  }
  return answer.length === best;
}
