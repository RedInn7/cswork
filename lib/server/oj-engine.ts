import { complexDesignCheckerId } from '@/lib/oj-complex-contract';
import {
  OA_SEMANTIC_IDS,
  matchesOaSemantic,
} from '../oa-semantic-checkers.mjs';
import { matchesComplexDesign } from '@/lib/oj-complex-design-checkers';
import { matchesFiniteFloats } from '@/lib/oj-float-checkers';
import { matchesFractionDecimal } from '@/lib/oj-fraction-checker';
import { stringStructureCheckerId } from '@/lib/oj-string-contract';
import { matchesStringStructure } from '@/lib/oj-string-structures';
import { semanticCheckerId } from '@/lib/oj-semantic-contract';
import { matchesSemantic } from '@/lib/oj-semantic-checkers';
import type { Language } from '@/lib/problems';
import {
  asciiTokens,
  parseIntegerRowCollection,
  type IntegerRowChecker,
} from '@/lib/oj-result-shapes';
import {
  parseOjSetOutput,
  parseOjMultisetOutput,
  type OjProblemSpec,
} from '@/lib/oj-types';

type EngineFile =
  | { content: string }
  | { fileId: string }
  | { name: string; max: number; pipe?: boolean };
type Command = {
  args: string[];
  env: string[];
  files: EngineFile[];
  cpuLimit: number;
  clockLimit: number;
  memoryLimit: number;
  procLimit: number;
  copyIn: Record<string, EngineFile>;
  copyOutCached?: string[];
  copyOutMax?: number;
};
export type EngineResult = {
  status: string;
  exitStatus?: number;
  error?: string;
  time?: number;
  memory?: number;
  files?: Record<string, string>;
  fileIds?: Record<string, string>;
  fileError?: { name: string; type: string; message?: string }[];
};
export type CompiledProgram = {
  language: Language;
  source: string;
  cache: Record<string, string>;
  bridgeSource?: string;
  leetcodeInput?: boolean;
};
export class EngineFailure extends Error {}
const sourceNames: Record<Language, string> = {
  cpp: 'main.cpp',
  python: 'main.py',
  java: 'Main.java',
  go: 'main.go',
};
const baseEnv = ['PATH=/usr/bin:/bin', 'HOME=/w', 'LANG=C.UTF-8', 'TZ=UTC'];
function endpoint(path: string) {
  const url = new URL(process.env.GO_JUDGE_URL || 'http://127.0.0.1:5050');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.protocol === 'http:' &&
      !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))
  )
    throw new EngineFailure('Runner must use loopback or HTTPS');
  return `${url.href.replace(/\/$/, '')}${path}`;
}
async function engineFetch(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
) {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GO_JUDGE_TOKEN || ''}`,
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(75000)])
      : AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new EngineFailure(`Execution service returned ${response.status}`);
  return response;
}
async function execute(command: Command, signal: AbortSignal) {
  const response = await engineFetch(
    '/run',
    { method: 'POST', body: JSON.stringify({ cmd: [command] }) },
    signal,
  );
  const result = (await response.json()) as EngineResult[];
  if (
    !Array.isArray(result) ||
    result.length !== 1 ||
    typeof result[0]?.status !== 'string'
  )
    throw new EngineFailure('Invalid execution result');
  if (['Internal Error', 'File Error'].includes(result[0].status))
    throw new EngineFailure(`Execution ${result[0].status}`);
  return result[0];
}
function limits(
  input: string,
  cpuSeconds: number,
  clockSeconds: number,
  memoryBytes: number,
  outputBytes: number,
): Omit<Command, 'args' | 'copyIn'> {
  return {
    env: baseEnv,
    files: [
      { content: input },
      { name: 'stdout', max: outputBytes, pipe: true },
      { name: 'stderr', max: Math.min(outputBytes, 65536), pipe: true },
    ],
    cpuLimit: Math.ceil(cpuSeconds * 1e9),
    clockLimit: Math.ceil(clockSeconds * 1e9),
    memoryLimit: memoryBytes,
    procLimit: 64,
  };
}
export async function compile(
  language: Language,
  source: string,
  signal: AbortSignal,
) {
  const commands: Record<Language, string[]> = {
    cpp: source.includes('// CSWORK_CPP_JSON_RUNTIME_V1')
      ? [
          '/bin/sh',
          '-c',
          // Only fixed, trusted paths enter this command; source stays in copyIn.
          // Older runner images compile the complete inline fallback unchanged.
          'if test -r /usr/local/include/cswork/json-v1.hpp && test -r /usr/local/lib/cswork/libjson-v1.a; then exec /usr/bin/g++ -std=c++20 -O2 -pipe -DCSWORK_PRECOMPILED_JSON_V1 main.cpp /usr/local/lib/cswork/libjson-v1.a -o main; else exec /usr/bin/g++ -std=c++20 -O2 -pipe main.cpp -o main; fi',
        ]
      : [
          '/usr/bin/g++',
          '-std=c++20',
          '-O2',
          '-pipe',
          'main.cpp',
          '-o',
          'main',
        ],
    go: [
      '/bin/sh',
      '-c',
      // Go's cache Close writes trim.txt even when compilation only reads
      // stdlib objects. Keep directory/trim/user-package writes private and
      // symlink trusted objects from the read-only image instead of copying
      // ~164 MiB into every sandbox's bounded /tmp. Old images use an empty
      // private cache. Never point writable GOCACHE at the shared seed itself.
      'if test -r /usr/local/lib/cswork/go-stdlib-cache-v1/cswork-toolchain-v1; then mkdir -p /tmp/go-cache && cp -rs --no-preserve=mode /usr/local/lib/cswork/go-stdlib-cache-v1/. /tmp/go-cache && rm -f /tmp/go-cache/trim.txt /tmp/go-cache/README || exit 1; fi; exec /usr/bin/go build -trimpath -o main main.go',
    ],
    java: [
      '/bin/sh',
      '-c',
      '/usr/bin/javac -encoding UTF-8 Main.java && /usr/bin/jar cf main.jar *.class',
    ],
    python: [
      '/usr/bin/python3',
      '-I',
      '-c',
      "import py_compile; py_compile.compile('main.py', doraise=True)",
    ],
  };
  const result = await execute(
    {
      ...limits('', 30, 60, 1073741824, 65536),
      args: commands[language],
      env: [
        ...baseEnv,
        'GOCACHE=/tmp/go-cache',
        'GOPATH=/tmp/go',
        'GOTOOLCHAIN=local',
        'GOPROXY=off',
        'GOSUMDB=off',
        'CGO_ENABLED=0',
        'GOMAXPROCS=2',
      ],
      copyIn: { [sourceNames[language]]: { content: source } },
      copyOutCached:
        language === 'python'
          ? []
          : [language === 'java' ? 'main.jar' : 'main'],
      copyOutMax: 16777216,
    },
    signal,
  );
  const program = {
    language,
    source,
    cache: result.fileIds ?? {},
  } satisfies CompiledProgram;
  if (
    result.status === 'Accepted' &&
    language !== 'python' &&
    !program.cache[language === 'java' ? 'main.jar' : 'main']
  ) {
    await cleanup(program);
    throw new EngineFailure('Compiled artifact missing');
  }
  return { result, program };
}
export async function run(
  program: CompiledProgram,
  input: string,
  spec: OjProblemSpec,
  signal: AbortSignal,
) {
  const memoryBytes = spec.memoryLimit * 1024;
  const heap = Math.max(8, Math.floor((spec.memoryLimit / 1024) * 0.6));
  const args =
    program.bridgeSource || program.language === 'python'
      ? [
          '/usr/bin/python3',
          '-I',
          program.bridgeSource ? 'bridge.py' : 'main.py',
          ...(program.leetcodeInput ? ['--leetcode-input'] : []),
        ]
      : program.language === 'java'
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
        : ['main'];
  const copyIn =
    program.language === 'python'
      ? { 'main.py': { content: program.source } }
      : Object.fromEntries(
          Object.entries(program.cache).map(([name, fileId]) => [
            name,
            { fileId },
          ]),
        );
  if (program.bridgeSource)
    Object.assign(copyIn, { 'bridge.py': { content: program.bridgeSource } });
  return execute(
    {
      ...limits(
        input,
        spec.timeLimit,
        Math.max(3, spec.timeLimit * 3),
        memoryBytes,
        spec.outputLimit * 1024,
      ),
      args,
      copyIn,
    },
    signal,
  );
}
export async function cleanup(program: CompiledProgram) {
  await Promise.allSettled(
    Object.values(program.cache).map((id) =>
      engineFetch(`/file/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    ),
  );
}
export async function engineHealth() {
  const response = await engineFetch('/config', { method: 'GET' });
  const config = (await response.json()) as Record<string, unknown>;
  return config;
}
export function engineVerdict(result: EngineResult): string {
  if (
    result.fileError?.some((e) =>
      ['CollectSizeExceeded', 'CopyOutSizeExceeded'].includes(e.type),
    )
  )
    return 'output_limit';
  switch (result.status) {
    case 'Accepted':
      return 'accepted';
    case 'Wrong Answer':
      return 'wrong_answer';
    case 'Time Limit Exceeded':
      return 'time_limit';
    case 'Memory Limit Exceeded':
      return 'memory_limit';
    case 'Output Limit Exceeded':
      return 'output_limit';
    default:
      return 'runtime_error';
  }
}
export function matchesOutput(
  actual: string,
  expected: string,
  checker: OjProblemSpec['checker'],
  input?: string,
) {
  if (Object.hasOwn(OA_SEMANTIC_IDS, checker))
    return (
      typeof input === 'string' &&
      matchesOaSemantic(checker, actual, expected, input)
    );
  const complexId = complexDesignCheckerId(checker);
  if (complexId !== null)
    return (
      typeof input === 'string' &&
      matchesComplexDesign(complexId, actual, expected, input)
    );
  if (checker === 'float' || checker === 'float-array')
    return matchesFiniteFloats(actual, expected, checker === 'float-array');
  if (checker === 'fraction-lc-166')
    return (
      typeof input === 'string' &&
      matchesFractionDecimal(actual, input) &&
      matchesFractionDecimal(expected, input)
    );
  const stringId = stringStructureCheckerId(checker);
  if (stringId !== null)
    return matchesStringStructure(stringId, actual, expected);
  const semanticId = semanticCheckerId(checker);
  if (semanticId !== null)
    return (
      typeof input === 'string' &&
      matchesSemantic(semanticId, actual, expected, input)
    );
  if (
    ['int-row-set', 'int-bag-row-set', 'int-row-multiset'].includes(checker)
  ) {
    const a = parseIntegerRowCollection(actual, checker as IntegerRowChecker),
      b = parseIntegerRowCollection(expected, checker as IntegerRowChecker);
    if (a === null || b === null || a.size !== b.size) return false;
    for (const [row, count] of a) if (b.get(row) !== count) return false;
    return true;
  }
  if (checker === 'exact')
    return actual.replace(/\r\n/g, '\n') === expected.replace(/\r\n/g, '\n');
  if (checker === 'int-multiset') {
    const a = parseOjMultisetOutput(actual),
      b = parseOjMultisetOutput(expected);
    if (a === null || b === null || a.size !== b.size) return false;
    for (const [value, count] of a) if (b.get(value) !== count) return false;
    return true;
  }
  if (checker === 'int-set' || checker === 'string-set') {
    const a = parseOjSetOutput(actual, checker);
    const b = parseOjSetOutput(expected, checker);
    if (a === null || b === null || a.size !== b.size) return false;
    for (const value of a) if (!b.has(value)) return false;
    return true;
  }
  // A stale worker must never silently interpret a new checker as token equality.
  if (checker !== 'tokens') return false;
  // ASCII whitespace is the conventional OJ token separator; do not trim arbitrary Unicode.
  const a = asciiTokens(actual),
    b = asciiTokens(expected);
  while (true) {
    const left = a.next(),
      right = b.next();
    if (left.done || right.done) return left.done === right.done;
    if (left.value !== right.value) return false;
  }
}
