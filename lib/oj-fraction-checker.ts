/** Accept equivalent decimal periods; terminating fractions must stay finite. */
export function matchesFractionDecimal(actual: string, input: string): boolean {
  try {
    if (
      typeof actual !== 'string' ||
      typeof input !== 'string' ||
      actual.length > 10001 ||
      input.length > 100
    )
      return false;
    if (
      !/^[ \t\r\n]*\[[ \t\r\n]*-?(?:0|[1-9][0-9]*)[ \t\r\n]*,[ \t\r\n]*-?(?:0|[1-9][0-9]*)[ \t\r\n]*\][ \t\r\n]*$/.test(
        input,
      )
    )
      return false;
    const args: unknown = JSON.parse(input);
    if (
      !Array.isArray(args) ||
      args.length !== 2 ||
      !args.every(
        (x) => Number.isInteger(x) && x >= -2147483648 && x <= 2147483647,
      ) ||
      args[1] === 0
    )
      return false;
    const text = actual.replace(/\r?\n$/, '');
    const m = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]*)(?:\(([0-9]+)\))?)?$/.exec(
      text,
    );
    if (!m || m[0] !== text || (text.includes('.') && !m[3] && !m[4]))
      return false;
    const numerator = BigInt(args[0]),
      denominator = BigInt(args[1]);
    const abs = (x: bigint) => (x < BigInt(0) ? -x : x);
    let a = abs(numerator),
      b = abs(denominator);
    while (b) [a, b] = [b, a % b];
    let reduced = abs(denominator) / a;
    for (const factor of [BigInt(2), BigInt(5)])
      while (reduced % factor === BigInt(0)) reduced /= factor;
    if (reduced === BigInt(1) && m[4]) return false;
    const scale = BigInt(10) ** BigInt((m[3] || '').length);
    const period = m[4]
      ? BigInt(10) ** BigInt(m[4].length) - BigInt(1)
      : BigInt(1);
    const q = scale * period;
    let p =
      BigInt(m[2]) * q + BigInt(m[3] || '0') * period + BigInt(m[4] || '0');
    if (m[1]) p = -p;
    return p * denominator === numerator * q;
  } catch {
    return false;
  }
}
