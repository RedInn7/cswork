/** Only public fields from the exact published judge version belong in the OA reader. */
export function formatOaVerifiedStatement(
  spec: {
    description: string;
    input: string;
    output: string;
    explanation: string;
  },
  samples: { input: string; expectedOutput: string }[],
) {
  const code = (value: string) => {
    const length = Math.max(
      3,
      ...[...value.matchAll(/`+/g)].map((m) => m[0].length + 1),
    );
    const fence = '`'.repeat(length);
    return `${fence}text\n${value.replace(/\n$/, '')}\n${fence}`;
  };
  return [
    spec.description,
    '## 输入格式\n\n' + spec.input,
    '## 输出格式\n\n' + spec.output,
    ...samples.map(
      (sample, index) =>
        `## 样例 ${index + 1}\n\n输入：\n\n${code(sample.input)}\n\n输出：\n\n${code(sample.expectedOutput)}`,
    ),
    ...(spec.explanation ? ['## 样例说明\n\n' + spec.explanation] : []),
  ].join('\n\n');
}
