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
import type { CodeLanguage, Language } from '@/lib/problems';
import { HTTP_FIXTURE_BOOTSTRAP, HTTP_FIXTURES_FILE } from '../http-fixtures.mjs';
import { javaCommand, LEETCODE_SUPPORT } from './leetcode-mode';
import { PANDAS_HARNESS, SQL_HARNESS } from './sql-judge';
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
  /** Cached bytecode of bridgeSource, see compileBridge. */
  bridgeBytecode?: string;
  leetcodeInput?: boolean;
};
export class EngineFailure extends Error {}
const sourceNames: Record<CodeLanguage, string> = {
  cpp: 'main.cpp',
  python: 'main.py',
  java: 'Main.java',
  go: 'main.go',
};
// One BLAS / OpenMP thread: numpy (pandas, and ml- problems' plain Python) would otherwise
// start a pool per core and run into procLimit.
const baseEnv = [
  'PATH=/usr/bin:/bin',
  'HOME=/w',
  'LANG=C.UTF-8',
  'TZ=UTC',
  'OPENBLAS_NUM_THREADS=1',
  'OMP_NUM_THREADS=1',
];
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
/**
 * Turns argv[1] (main.py or bridge.py) into a .pyc beside it, in the runner's own
 * Python. Every LeetCode case otherwise recompiles the ~75 KB support runtime:
 * its top-level exec('<module source>', module.__dict__) calls become
 * exec(<that source precompiled with the same future flags>, ...). The code keeps
 * its absolute .py filename and the cases also receive the .py, so tracebacks
 * name and quote it; argv[0] and __file__ are restored to the .py names
 * (__loader__ alone stays the sourceless loader). Sources that emit compile
 * warnings, or anything unexpected, get no .pyc: their cases run the .py exactly
 * as before, so warnings still reach every case's stderr.
 */
export const PYTHON_BYTECODE = `
import __future__, ast, importlib.util, marshal, os, sys, warnings
name = sys.argv[1]
path = os.path.abspath(name)
with open(name, 'rb') as f:
    data = f.read()
try:
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        tree = ast.parse(data, path)
        flags = lead = 0
        for node in tree.body:
            if isinstance(node, ast.ImportFrom) and node.module == '__future__':
                for alias in node.names:
                    flags |= getattr(__future__, alias.name).compiler_flag
            elif not (isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant)):
                break
            lead += 1
        # The support runtime must come right after them; learner statements
        # hoisted with a __future__ line could tamper with what it relies on.
        first = tree.body[lead] if lead < len(tree.body) else None
        if not (isinstance(first, ast.Import) and first.names[0].name == 'sys'
                and first.names[0].asname == '_cswork_sys'):
            sys.exit(0)
        for node in tree.body:
            call = node.value if isinstance(node, ast.Expr) else None
            if (isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id == 'exec'
                    and len(call.args) == 2 and not call.keywords
                    and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str)
                    and isinstance(call.args[1], ast.Attribute) and call.args[1].attr == '__dict__'
                    and isinstance(call.args[1].value, ast.Name)
                    and call.args[1].value.id in ('_cswork_module', '_cswork_runtime')):
                code = compile(call.args[0].value, '<string>', 'exec', flags, dont_inherit=True)
                # Through the support's own sys binding, never a global __import__.
                loads = ast.parse("_cswork_sys.modules['marshal'].loads(b'')", mode='eval').body
                loads.args[0] = ast.Constant(marshal.dumps(code))
                call.args[0] = ast.copy_location(loads, call.args[0])
        restore = ast.parse('import sys as _cswork_sys\\n_cswork_sys.argv[0] = _cswork_sys.argv[0][:-1]\\n__file__ = __file__[:-1]\\n').body
        tree.body[lead:lead] = restore
        code = compile(ast.fix_missing_locations(tree), path, 'exec', dont_inherit=True)
except Exception:
    sys.exit(0)
if caught:
    sys.exit(0)
blob = importlib.util.MAGIC_NUMBER + bytes(12) + marshal.dumps(code)
if len(blob) > 16 * 1024 * 1024:  # the copy-out limit; the .py still runs
    sys.exit(0)
with open(name[:-3] + '.pyc', 'wb') as f:
    f.write(blob)
`;
/** The trusted LeetCode bridge (support runtime + native launcher) as cached bytecode. */
export async function compileBridge(source: string, signal: AbortSignal) {
  const result = await execute(
    {
      ...limits('', 30, 60, 1073741824, 65536),
      args: ['/usr/bin/python3', '-I', '-c', PYTHON_BYTECODE, 'bridge.py'],
      copyIn: { 'bridge.py': { content: source } },
      copyOutCached: ['bridge.pyc?'], // optional: absent means run from source
      copyOutMax: 16777216,
    },
    signal,
  );
  return {
    result,
    program: {
      language: 'python' as Language,
      source,
      cache: result.fileIds ?? {},
    } satisfies CompiledProgram,
  };
}
/**
 * The runner ships a precompiled <bits/stdc++.h> (deploy/oj/build-cpp-pch.sh)
 * under the submission flags, but GCC only finds it through the wrapper
 * /usr/local/include/cswork/stdc++.hpp: about 2.9s -> 1.0s per ACM compile. The
 * learner's leading include becomes one line naming that wrapper, so every line
 * keeps its number and quoted source in diagnostics; only template notes gain an
 * "included from .../cswork/stdc++.hpp:1" frame. Images without the wrapper
 * find the fallback copy (STDCXX_FALLBACK) through -idirafter, and GCC uses the
 * plain header whenever the PCH does not apply.
 */
export function withStdcxxPch(source: string) {
  if (source.includes('/usr/local/include/cswork/stdc++.hpp')) return source; // LeetCode drivers
  const lines = source.split('\n');
  // Only where a PCH can apply: preceded by nothing but blank lines, line
  // comments and directives. GCC's directive whitespace is space and tab only.
  const include =
    /^[ \t]*#[ \t]*include[ \t]*<bits\/stdc\+\+\.h>[ \t]*(\/\/.*)?$/;
  const leading = /^[ \t]*(\/\/.*|#.*)?$/;
  const at = lines.findIndex((raw) => {
    const line = raw.replace(/\r$/, ''); // CRLF sources
    return include.test(line) || !leading.test(line);
  });
  if (
    at < 0 ||
    !include.test(lines[at].replace(/\r$/, '')) ||
    /\\\r?$/.test(lines[at - 1] ?? '') // continued from the line above
  )
    return source;
  // Only the header name changes; the rest of the line stays byte for byte.
  lines[at] = lines[at].replace('<bits/stdc++.h>', '<cswork/stdc++.hpp>');
  return lines.join('\n');
}
/**
 * Precompiled header sets for sources that name their standard headers one by
 * one (deploy/oj/build-cpp-pch.sh builds each as cswork/pch/<name>.hpp, largest
 * first). The <bits/stdc++.h> PCH would be slower for them (loading it alone
 * costs about 0.75s CPU, more than parsing <iostream>) and would declare names
 * the learner never included. A set applies only when every header in it is
 * among the source's own leading includes, so it declares nothing they would
 * not; standard headers may be included in any order.
 */
export const STD_HEADER_PCHS = [
  ['iostream', 'vector', 'algorithm'],
  ['iostream', 'vector'],
  ['vector', 'algorithm'],
  ['iostream'],
];
/** The PCH set for a source whose leading lines are only standard includes. */
export function stdHeaderPch(source: string) {
  const names = new Set<string>();
  for (const raw of source.split('\n')) {
    const line = raw.replace(/\r$/, ''); // CRLF sources
    const include =
      /^[ \t]*#[ \t]*include[ \t]*<([a-z_]+(?:\.h)?)>[ \t]*(\/\/.*)?$/.exec(
        line,
      );
    if (!include && !/^[ \t]*(#.*|\/\/.*)?$/.test(line)) break; // code begins
    // A macro or condition first, or a line continued onto the next one.
    if (!include && /^[ \t]*#/.test(line)) return undefined;
    // GCC also splices a backslash followed by trailing whitespace.
    if (/\\\s*$/.test(line)) return undefined;
    if (include) names.add(include[1]);
  }
  return STD_HEADER_PCHS.find((set) =>
    set.every((name) => names.has(name)),
  )?.join('-');
}
/** `jar cf main.jar *.class`, including its failure when javac wrote no class. */
const JAVA_JAR = `import glob, sys, zipfile
names = sorted(glob.glob('*.class'))
if not names:
    sys.exit('*.class : no such file or directory')
with zipfile.ZipFile('main.jar', 'w', zipfile.ZIP_DEFLATED) as jar:
    for name in names:
        jar.write(name)
`;
const STDCXX_FALLBACK = {
  'cswork/stdc++.hpp': { content: '#include <bits/stdc++.h>\n' },
};
export async function compile(
  language: Language,
  source: string,
  signal: AbortSignal,
) {
  // SQL and pandas have nothing to build: a trusted harness runs the source (see run).
  if (language === 'sql' || language === 'pandas') {
    const result: EngineResult = { status: 'Accepted' };
    const program: CompiledProgram = { language, source, cache: {} };
    return { result, program };
  }
  // LeetCode-mode Python carries the support runtime; ACM Python runs as plain source.
  const bytecode = language === 'python' && source.includes(LEETCODE_SUPPORT);
  // Python's bytecode is optional (see PYTHON_BYTECODE); the others must exist.
  const artifact =
    language === 'python'
      ? undefined
      : language === 'java'
        ? 'main.jar'
        : 'main';
  const text = language === 'cpp' ? withStdcxxPch(source) : source;
  const headers =
    language === 'cpp' && text === source ? stdHeaderPch(source) : undefined;
  const commands: Record<CodeLanguage, string[]> = {
    cpp: source.includes('// CSWORK_CPP_JSON_RUNTIME_V1')
      ? [
          '/bin/sh',
          '-c',
          // Only fixed, trusted paths enter this command; source stays in copyIn.
          // Older runner images compile the complete inline fallback unchanged.
          'if test -r /usr/local/include/cswork/json-v1.hpp && test -r /usr/local/lib/cswork/libjson-v1.a; then exec /usr/bin/g++ -std=c++20 -O2 -pipe -DCSWORK_PRECOMPILED_JSON_V1 main.cpp /usr/local/lib/cswork/libjson-v1.a -o main; else exec /usr/bin/g++ -std=c++20 -O2 -pipe main.cpp -o main; fi',
        ]
      : headers
        ? [
            '/bin/sh',
            '-c',
            // $1 is a fixed path from STD_HEADER_PCHS; the source is unchanged.
            // Older runner images without it compile exactly as before.
            'if test -r "$1"; then exec /usr/bin/g++ -std=c++20 -O2 -pipe -include "$1" main.cpp -o main; else exec /usr/bin/g++ -std=c++20 -O2 -pipe main.cpp -o main; fi',
            'g++',
            `/usr/local/include/cswork/pch/${headers}.hpp`,
          ]
        : [
            '/usr/bin/g++',
            '-std=c++20',
            '-O2',
            '-pipe',
            ...(text !== source ? ['-idirafter', '.'] : []),
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
      'if test -r /usr/local/lib/cswork/go-stdlib-cache-v1/cswork-toolchain-v1; then mkdir -p /tmp/go-cache && cp -rs --no-preserve=mode /usr/local/lib/cswork/go-stdlib-cache-v1/. /tmp/go-cache && rm -f /tmp/go-cache/trim.txt /tmp/go-cache/README || exit 1; fi; exec /usr/bin/go build -trimpath -ldflags=-s\\ -w -o main main.go',
    ],
    java: [
      '/bin/sh',
      '-c',
      // javac's own JVM: C1 only and serial GC start faster for one short
      // compile. Class files and the learner's JVM flags are unchanged. The jar is
      // zipped by Python ($1) instead of a second JVM (`jar cf main.jar *.class`).
      '/usr/bin/javac -J-XX:TieredStopAtLevel=1 -J-XX:+UseSerialGC -encoding UTF-8 Main.java && exec /usr/bin/python3 -I -c "$1"',
      'javac',
      JAVA_JAR,
    ],
    python: [
      '/usr/bin/python3',
      '-I',
      '-c',
      // Line 1 stays the syntax check, so compile errors read exactly as before.
      "import py_compile; py_compile.compile('main.py', doraise=True)" +
        (bytecode ? '\n' + PYTHON_BYTECODE : ''),
      ...(bytecode ? ['main.py'] : []),
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
      copyIn: {
        [sourceNames[language]]: { content: text },
        ...(text !== source ? STDCXX_FALLBACK : {}),
      },
      copyOutCached: artifact ? [artifact] : bytecode ? ['main.pyc?'] : [],
      copyOutMax: 16777216,
    },
    signal,
  );
  const program = {
    language,
    source,
    cache: result.fileIds ?? {},
  } satisfies CompiledProgram;
  if (result.status === 'Accepted' && artifact && !program.cache[artifact]) {
    await cleanup(program);
    throw new EngineFailure('Compiled artifact missing');
  }
  return { result, program };
}
/**
 * The spec a submission's cases run under. Judge and drill runs keep every fixture: hidden cases
 * read them and only verdicts come back. Every other run (samples, custom input) prints its stdout
 * to the learner, so it gets only the fixtures the visible cases request (visibleFixtureKeys);
 * the rest of the map, hidden cases' inputs and data, never enters that sandbox.
 */
export function runSpec(spec: OjProblemSpec, formal: boolean): OjProblemSpec {
  if (formal || !spec.httpFixtures) return spec;
  const visible = new Set(spec.visibleFixtureKeys);
  return {
    ...spec,
    httpFixtures: Object.fromEntries(
      Object.entries(spec.httpFixtures).filter(([key]) => visible.has(key)),
    ),
  };
}
export async function run(
  program: CompiledProgram,
  input: string,
  spec: OjProblemSpec,
  signal: AbortSignal,
) {
  const memoryBytes = spec.memoryLimit * 1024;
  if (program.language === 'sql')
    return execute(
      {
        ...limits(
          input,
          spec.timeLimit,
          Math.max(3, spec.timeLimit * 3),
          memoryBytes,
          spec.outputLimit * 1024,
        ),
        // -S: the harness needs only the standard library's sqlite3.
        args: ['/usr/bin/python3', '-I', '-S', 'judge.py'],
        copyIn: {
          'judge.py': { content: SQL_HARNESS },
          'query.sql': { content: program.source },
        },
      },
      signal,
    );
  if (program.language === 'pandas') {
    const command = limits(
      input,
      spec.timeLimit,
      Math.max(3, spec.timeLimit * 3),
      memoryBytes,
      spec.outputLimit * 1024,
    );
    return execute(
      {
        ...command,
        // No -S: pandas lives in the image's dist-packages.
        args: ['/usr/bin/python3', '-I', 'judge.py'],
        copyIn: {
          'judge.py': { content: PANDAS_HARNESS },
          'solution.py': { content: program.source },
        },
      },
      signal,
    );
  }
  const script = program.bridgeSource
    ? program.bridgeBytecode
      ? 'bridge.pyc'
      : 'bridge.py'
    : program.cache['main.pyc']
      ? 'main.pyc'
      : 'main.py';
  // REST API problems: the program's GETs are answered from the package (lib/http-fixtures.mjs).
  const fixtures =
    program.language === 'python' && !program.bridgeSource && spec.httpFixtures;
  const args =
    program.bridgeSource || program.language === 'python'
      ? [
          '/usr/bin/python3',
          '-I',
          // The trusted bridge needs only the standard library: skip site setup.
          ...(program.bridgeSource ? ['-S'] : []),
          ...(fixtures ? ['-c', HTTP_FIXTURE_BOOTSTRAP] : []),
          script,
          ...(program.leetcodeInput ? ['--leetcode-input'] : []),
        ]
      : program.language === 'java'
        ? javaCommand(spec.memoryLimit)
        : ['main'];
  const copyIn: Record<string, EngineFile> = Object.fromEntries(
    Object.entries(program.cache).map(([name, fileId]) => [name, { fileId }]),
  );
  // Bytecode runs keep the .py beside them for traceback source lines.
  if (program.language === 'python')
    copyIn['main.py'] = { content: program.source };
  // ponytail: inline per case (≤512 KB); upload once as a cached file if fixtures grow.
  if (fixtures)
    copyIn[HTTP_FIXTURES_FILE] = { content: JSON.stringify(fixtures) };
  if (program.bridgeSource) {
    copyIn['bridge.py'] = { content: program.bridgeSource };
    if (program.bridgeBytecode)
      copyIn['bridge.pyc'] = { fileId: program.bridgeBytecode };
  }
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
/**
 * Runs one unittest suite (argv[1], a directory beside src/) and prints only a JSON report
 * on stdout: everything the code under test prints goes to stderr. A subTest failure counts
 * its test once; a class or module that fails to set up counts as one failed test. The report
 * comes from the same process as the learner's code, so they can forge it: nothing is
 * awarded for a project run, and a forged report only fools its author.
 */
export const PROJECT_HARNESS = `
import json, os, sys, unittest
report = os.fdopen(os.dup(1), 'w')
os.dup2(2, 1)
start = sys.argv[1]
open(os.path.join(start, '__init__.py'), 'a').close()  # discovery needs a package

class Result(unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.ran = []
    def startTest(self, test):
        super().startTest(test)
        self.ran.append(test.id())

result = Result()
failed = {}
try:
    unittest.TestLoader().discover(start, top_level_dir='.').run(result)
except BaseException as error:
    failed['(discovery)'] = '%s: %s' % (type(error).__name__, error)
for test, text in result.failures + result.errors + [(t, 'Unexpected success') for t in result.unexpectedSuccesses]:
    failed.setdefault(getattr(test, 'test_case', test).id(), text)
skipped = {test.id() for test, _ in result.skipped}
passed = sum(1 for name in result.ran if name not in failed and name not in skipped)
total = len(result.ran) + sum(1 for name in failed if name not in result.ran)
report.write(json.dumps({'passed': passed, 'total': total,
    'failures': [{'name': name, 'message': text[-1500:]} for name, text in list(failed.items())[:20]]}))
report.flush()
`;
export const PROJECT_SECONDS = 10;
export type ProjectRun = {
  result: EngineResult;
  report: { passed: number; total: number; failures: { name: string; message: string }[] } | null;
};
/**
 * A project's two suites, each in its own sandbox: `files` (the learner's src/ and tests/)
 * with tests/, then the learner's src/ with the task's hidden suite. Hidden tests never share a
 * sandbox with anything the learner gets to read back. `slot` holds a runner slot per sandbox.
 */
export async function runProject(
  files: Record<string, string>,
  hidden: Record<string, string>,
  signal: AbortSignal,
  slot: (signal: AbortSignal) => Promise<() => void> = async () => () => {},
) {
  const suite = async (start: string, copy: Record<string, string>): Promise<ProjectRun> => {
    const release = await slot(signal);
    const result = await execute(
      {
        ...limits('', PROJECT_SECONDS, PROJECT_SECONDS * 2, 268435456, 65536),
        args: ['/usr/bin/python3', '-I', 'cswork_tests.py', start],
        copyIn: {
          ...Object.fromEntries(Object.entries(copy).map(([path, content]) => [path, { content }] as const)),
          'cswork_tests.py': { content: PROJECT_HARNESS },
        },
      },
      signal,
    ).finally(release);
    let report: ProjectRun['report'] = null;
    try {
      const value = JSON.parse(result.files?.stdout?.trim().split('\n').at(-1) || 'null');
      if (Number.isInteger(value?.passed) && Number.isInteger(value?.total) && Array.isArray(value?.failures))
        report = value;
    } catch {
      /* No report: the run crashed, timed out or printed over it. */
    }
    return { result, report };
  };
  const source = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith('src/')));
  return Promise.all([suite('tests', files), suite('hidden_tests', { ...source, ...hidden })]);
}
/**
 * The run's verdict and what its learner may see: the public suite in full (failures capped),
 * the hidden suite as passed/total only, out of `hiddenTotal` (counted from the task's files)
 * so a suite that never loaded still shows how many it holds. The learner's src/ shares the
 * hidden sandbox and can read its tests, so only the clamped pass count leaves it: no time or
 * memory, and a limit or crash there is just none passed.
 */
export function projectVerdict(visible: ProjectRun, hidden: ProjectRun, hiddenTotal: number) {
  const verdict = engineVerdict(visible.result);
  const limit = verdict === 'accepted' ? null : verdict;
  const shown = visible.report && {
    passed: visible.report.passed,
    total: visible.report.total,
    failures: visible.report.failures.slice(0, 20).map((f) => ({
      name: String(f.name).slice(0, 200),
      message: String(f.message).slice(-1500),
    })),
  };
  const hiddenPassed = engineVerdict(hidden.result) === 'accepted' ? (hidden.report?.passed ?? 0) : 0;
  const secret = { passed: Math.max(0, Math.min(hiddenPassed, hiddenTotal)), total: hiddenTotal };
  const passed = (shown?.passed ?? 0) + secret.passed,
    total = (shown?.total ?? 0) + secret.total;
  return {
    // The public suite's crash or limit first; then all-or-nothing over both suites.
    status: limit ?? (!shown ? 'runtime_error' : passed === total && shown.total > 0 ? 'accepted' : 'wrong_answer'),
    passed,
    total,
    report: { visible: shown, hidden: secret },
    // Only the public suite's output: the hidden run's would show its tests.
    output: visible.result.files?.stderr ?? '',
    runtimeMs: (visible.result.time ?? 0) / 1e6,
    memoryKb: Math.ceil((visible.result.memory ?? 0) / 1024),
  };
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
