import { createHash } from 'node:crypto';
import contracts from '@/lib/content/leetcode-contracts.json';
import type { CodeLanguage, Language } from '@/lib/problems';
import { buildLeetCodeCpp, getLeetCodeCppTemplate } from './leetcode-cpp';
import { buildLeetCodeJava, getLeetCodeJavaTemplate } from './leetcode-java';
import { buildLeetCodeGo, getLeetCodeGoTemplate } from './leetcode-go';

type Contract = {
  number: number;
  templates: Record<CodeLanguage, string>;
  pythonWrapper: string;
  pythonTemplate: string;
  customInputHelp?: { zh: string; en: string } | null;
  nativeBridge: string;
};
const problems = contracts.problems as Record<string, Contract>;
/** Prefix of every LeetCode-mode Python program and native bridge. */
export const LEETCODE_SUPPORT: string = contracts.support;
// A submission binds to the reviewed adapter snapshot; never reinterpret a
// queued submission against a different contract after deployment.
export const LEETCODE_HARNESS_VERSION = createHash('sha256')
  .update(JSON.stringify(contracts))
  .digest('hex');

/**
 * The learner's JVM, for ACM runs and LeetCode bridges alike. -Xss64m (as on
 * Codeforces) lets recursive DFS go 10^5+ deep where 256k overflowed near 2000.
 * go-judge enforces memoryLimit through cgroup memory.max (no RLIMIT_AS or
 * RLIMIT_DATA under the cgroup pool), and thread stacks are reserved, not
 * committed: only the pages a run touches count against its limit.
 */
export function javaCommand(memoryKiB: number) {
  const heap = Math.max(8, Math.floor((memoryKiB / 1024) * 0.6));
  return [
    '/usr/bin/java',
    `-Xmx${heap}m`,
    '-Xss64m',
    '-XX:ReservedCodeCacheSize=32m',
    '-XX:MaxMetaspaceSize=64m',
    '-XX:ActiveProcessorCount=1',
    '-cp',
    'main.jar',
    'Main',
  ];
}

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
  const command = language === 'java' ? javaCommand(memoryKiB) : ['./main'];
  return {
    source,
    bridgeSource:
      contracts.support +
      c.nativeBridge.replace('__CSWORK_NATIVE_COMMAND__', () =>
        JSON.stringify(command),
      ),
  };
}
