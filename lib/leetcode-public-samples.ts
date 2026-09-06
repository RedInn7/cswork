import samples from './content/leetcode-public-samples.json';

type DisplaySample = {
  sourceInput: string;
  sourceOutput: string;
  input?: string;
  output?: string;
  outputEn?: string;
  mutated?: boolean;
};

/** Match both sides exactly: edited/new samples must never inherit stale labels. */
export function leetcodePublicSample(
  problemId: string,
  sample: { input: string; expectedOutput: string },
) {
  const records = (samples as Record<string, DisplaySample[]>)[problemId];
  return records?.find(
    (record) =>
      record.sourceInput === sample.input &&
      record.sourceOutput === sample.expectedOutput,
  );
}
