import { createHash } from 'node:crypto';
import contracts from '@/lib/content/leetcode-contracts.json';
import type { Language } from '@/lib/problems';
import { buildLeetCodeCpp, getLeetCodeCppTemplate } from './leetcode-cpp';
import { buildLeetCodeJava, getLeetCodeJavaTemplate } from './leetcode-java';
import { buildLeetCodeGo, getLeetCodeGoTemplate } from './leetcode-go';

type Contract = {
  number: number;
  templates: Record<Language, string>;
  pythonWrapper: string;
  pythonTemplate: string;
  customInputHelp?: { zh: string; en: string } | null;
  nativeBridge: string;
};
const problems = contracts.problems as Record<string, Contract>;
// A submission binds to the reviewed adapter snapshot; never reinterpret a
// queued submission against a different contract after deployment.
export const LEETCODE_HARNESS_VERSION = createHash('sha256')
  .update(JSON.stringify(contracts))
  .digest('hex');

export function leetcodeContract(id: string) {
  return problems[id] || null;
}

export function leetcodeTemplates(id: string) {
  const c = leetcodeContract(id);
  if (!c) return null;
  return {
    python: c.pythonTemplate,
    cpp: getLeetCodeCppTemplate(c.number, c.templates.cpp),
    java: getLeetCodeJavaTemplate(c.number, c.templates.java),
    go: getLeetCodeGoTemplate(c.number, c.templates.go),
  };
}

export function leetcodeSource(
  id: string,
  language: Language,
  code: string,
  memoryKiB: number,
) {
  const c = leetcodeContract(id);
  if (!c) throw new Error('LeetCode adapter unavailable');
  if (language === 'python') {
    const future: string[] = [];
    const body = code
      .split('\n')
      .filter((line) => {
        if (/^from __future__ import /.test(line)) {
          future.push(line);
          return false;
        }
        return true;
      })
      .join('\n');
    return {
      source:
        future.join('\n') +
        '\n' +
        contracts.support +
        c.pythonWrapper.replace('__CSWORK_USER_SOURCE__', () => body),
    };
  }
  const source =
    language === 'cpp'
      ? buildLeetCodeCpp(c.number, code, c.templates.cpp)
      : language === 'java'
        ? buildLeetCodeJava(c.number, code, c.templates.java)
        : buildLeetCodeGo(c.number, code, c.templates.go);
  const heap = Math.max(8, Math.floor((memoryKiB / 1024) * 0.6));
  const command =
    language === 'java'
      ? [
          '/usr/bin/java',
          `-Xmx${heap}m`,
          '-Xss256k',
          '-XX:ReservedCodeCacheSize=32m',
          '-XX:MaxMetaspaceSize=64m',
          '-XX:ActiveProcessorCount=1',
          '-cp',
          'main.jar',
          'Main',
        ]
      : ['./main'];
  return {
    source,
    bridgeSource:
      contracts.support +
      c.nativeBridge.replace('__CSWORK_NATIVE_COMMAND__', () =>
        JSON.stringify(command),
      ),
  };
}
