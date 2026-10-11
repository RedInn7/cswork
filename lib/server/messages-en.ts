/**
 * English for server messages shown to users. Keys are the exact Chinese messages;
 * PATTERNS cover messages with numbers or names in them. Unknown messages fall back
 * to the original text.
 */
const EN: Record<string, string> = {
  请先登录: 'Please sign in first',
  请检查填写内容: 'Please check the highlighted fields',
  暂时无法完成请稍后重试: 'Something went wrong. Please try again later',
  '暂时无法完成，请稍后重试': 'Something went wrong. Please try again later',
};
const PATTERNS: [RegExp, (...m: string[]) => string][] = [];

export function englishMessage(message: string) {
  if (Object.hasOwn(EN, message)) return EN[message];
  for (const [pattern, render] of PATTERNS) {
    const m = pattern.exec(message);
    if (m) return render(...m.slice(1));
  }
  return message;
}
