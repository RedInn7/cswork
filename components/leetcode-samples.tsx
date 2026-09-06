import { CopyBlock } from './oj-results';
import { leetcodePublicSample } from '@/lib/leetcode-public-samples';

export function LeetCodeSamples({
  problemId,
  sample,
  english = false,
}: {
  problemId: string;
  sample: { input: string; expectedOutput: string };
  english?: boolean;
}) {
  const display = leetcodePublicSample(problemId, sample);
  const converted =
    display?.input !== undefined && display?.output !== undefined;
  return (
    <>
      <div className="cs-sample-pair">
        <CopyBlock
          label={
            english
              ? converted
                ? 'Input'
                : 'Test input'
              : converted
                ? '输入'
                : '测试输入'
          }
          value={converted ? display.input! : sample.input}
        />
        <CopyBlock
          label={english ? 'Expected result' : '期望结果'}
          value={
            converted
              ? english
                ? display.outputEn || display.output!
                : display.output!
              : sample.expectedOutput
          }
        />
      </div>
      {(!converted || display?.mutated) && (
        <p className="cs-console-note">
          {!converted
            ? english
              ? 'These are the public test data in the platform format. Run automatically constructs the function arguments or objects; you do not need to read standard input.'
              : '这里展示本站格式的公开测试数据。运行时会自动构造函数参数或对象，你无需读取标准输入。'
            : english
              ? 'For in-place operations, the expected result includes the modified data checked by the judge.'
              : '原地修改类题目的期望结果包含判题时检查的修改后数据。'}
        </p>
      )}
    </>
  );
}
