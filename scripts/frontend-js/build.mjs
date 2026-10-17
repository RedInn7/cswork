/**
 * Builds the frontend JS track (/frontend) from content/frontend-js/<slug>/: statement.{zh,en}.md,
 * starter.js, solution.js, tests.js (test / test.public, lib/js-harness.js) and editorial.{zh,en}.md.
 * Every solution must pass all its cases and every starter must fail at least one public case,
 * run here in Node's vm with the same harness the browser's sandbox uses (lib/js-runner.ts).
 * The output, lib/content/frontend-js.json, carries the harness too, so the two never drift.
 *
 *   node scripts/frontend-js/build.mjs          # write the manifest
 *   node scripts/frontend-js/build.mjs --check  # fail on drift or a broken problem
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export const CONTENT_DIR = 'content/frontend-js';
export const MANIFEST_FILE = 'lib/content/frontend-js.json';
export const HARNESS_FILE = 'lib/js-harness.js';

export const GROUPS = [
  { key: 'timing', zh: '计时与节流', en: 'Timing' },
  { key: 'promise', zh: 'Promise 与异步', en: 'Promises & async' },
  { key: 'function', zh: '函数式工具', en: 'Function utilities' },
  { key: 'object', zh: '对象与数据', en: 'Objects & data' },
  { key: 'internals', zh: '语言内置的手写实现', en: 'Language built-ins by hand' },
  { key: 'string', zh: '字符串与解析', en: 'Strings & parsing' },
  { key: 'pattern', zh: '数据结构与模式', en: 'Structures & patterns' },
];

const p = (slug, group, difficulty, zh, en) => ({ slug, group, difficulty, title: { zh, en } });
/** Listing order: by group, then as listed here. */
export const PROBLEMS = [
  p('debounce', 'timing', 'medium', '防抖 debounce（leading / trailing）', 'Debounce with leading and trailing edges'),
  p('throttle', 'timing', 'medium', '节流 throttle', 'Throttle'),
  p('sleep', 'timing', 'easy', 'sleep：等待指定毫秒', 'Sleep for a number of milliseconds'),
  p('promise-all', 'promise', 'medium', '手写 Promise.all', 'Implement Promise.all'),
  p('promise-all-settled', 'promise', 'easy', '手写 Promise.allSettled', 'Implement Promise.allSettled'),
  p('promise-race', 'promise', 'easy', '手写 Promise.race', 'Implement Promise.race'),
  p('promise-any', 'promise', 'medium', '手写 Promise.any', 'Implement Promise.any'),
  p('promise-pool', 'promise', 'hard', '带并发上限的任务池', 'Promise pool with a concurrency limit'),
  p('retry', 'promise', 'medium', '带指数退避的重试', 'Retry with exponential backoff'),
  p('promisify', 'promise', 'easy', 'promisify：回调转 Promise', 'Promisify a callback function'),
  p('latest-request', 'promise', 'medium', '只保留最新一次请求', 'Keep only the latest request'),
  p('curry', 'function', 'medium', '柯里化 curry', 'Curry'),
  p('compose-pipe', 'function', 'easy', 'compose 与 pipe', 'Compose and pipe'),
  p('memoize', 'function', 'medium', '记忆化 memoize', 'Memoize'),
  p('once', 'function', 'easy', 'once：只执行一次', 'Once'),
  p('curry-sum', 'function', 'easy', '链式求和 sum(1)(2)()', 'Chained sum: sum(1)(2)()'),
  p('deep-clone', 'object', 'hard', '深拷贝（含循环引用）', 'Deep clone with cycles'),
  p('deep-equal', 'object', 'medium', '深比较 deepEqual', 'Deep equality'),
  p('flatten', 'object', 'easy', '按深度展开数组 flatten', 'Flatten an array to a depth'),
  p('get', 'object', 'easy', '按路径取值 get', 'Get a value by path'),
  p('set', 'object', 'medium', '按路径赋值 set', 'Set a value by path'),
  p('chunk', 'object', 'easy', '数组分块 chunk', 'Chunk an array'),
  p('uniq-by', 'object', 'easy', '按键去重 uniqBy', 'Unique by key'),
  p('group-by', 'object', 'easy', '分组 groupBy', 'Group by'),
  p('array-to-tree', 'object', 'medium', '扁平数组转树', 'Flat list to tree'),
  p('array-map', 'internals', 'easy', 'Array.prototype.map 的手写实现', 'Array.prototype.map by hand'),
  p('array-filter', 'internals', 'easy', 'Array.prototype.filter 的手写实现', 'Array.prototype.filter by hand'),
  p('array-reduce', 'internals', 'medium', 'Array.prototype.reduce 的手写实现', 'Array.prototype.reduce by hand'),
  p('call-apply', 'internals', 'medium', '手写 call 与 apply', 'Implement call and apply'),
  p('bind', 'internals', 'hard', '手写 bind（支持 new）', 'Implement bind, new included'),
  p('my-new', 'internals', 'medium', '手写 new', 'Implement new'),
  p('my-instanceof', 'internals', 'easy', '手写 instanceof', 'Implement instanceof'),
  p('object-create', 'internals', 'easy', '手写 Object.create', 'Implement Object.create'),
  p('classnames', 'string', 'easy', 'classnames：拼接 class 名', 'classnames'),
  p('parse-query', 'string', 'medium', '解析查询字符串', 'Parse a query string'),
  p('template', 'string', 'easy', '{{}} 模板替换', 'Fill a {{ }} template'),
  p('case-convert', 'string', 'easy', 'camelCase 与 snake_case 互转', 'camelCase and snake_case'),
  p('json-stringify', 'string', 'hard', '手写 JSON.stringify（子集）', 'JSON.stringify, a subset'),
  p('event-emitter', 'pattern', 'medium', '事件中心 EventEmitter', 'Event emitter'),
  p('lru-cache', 'pattern', 'medium', '用 Map 实现 LRU 缓存', 'LRU cache with a Map'),
];

const read = (slug, file) => {
  const path = `${CONTENT_DIR}/${slug}/${file}`;
  if (!existsSync(path)) throw new Error(`${slug}: missing ${file}`);
  return readFileSync(path, 'utf8');
};

/** As lib/js-runner.ts: the tests in their own scope, the harness's API as parameters. */
const wrapTests = (tests) =>
  `(({ test, it, describe, expect, fn, useFakeTimers, useRealTimers, advanceTimersByTime, advanceTimersByTimeAsync, runAllTimers, flushPromises }) => {\n${tests}\n})(__jsHarness.api);`;

/**
 * Runs code and tests after the harness in a fresh vm context, as the browser's worker does:
 * resolves to the per-case results, or { error } when the script itself throws.
 */
export async function runInVm(harness, code, tests, { only = 'all', timeoutMs = 1000 } = {}) {
  const logs = [];
  const say = (...args) => logs.push(args.map(String).join(' '));
  const context = vm.createContext({
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    console: { log: say, info: say, warn: say, error: say, debug: say },
  });
  try {
    vm.runInContext(`${harness}\n${code}\n;\n${wrapTests(tests)}\n`, context, { timeout: 2000 });
  } catch (error) {
    return { error: String(error?.message ?? error), results: [], logs };
  }
  return { results: await context.__jsHarness.run({ only, timeoutMs }), cases: context.__jsHarness.cases(), logs };
}

export async function buildFrontendJs() {
  // The starters leave the tests' rejected promises without handlers; Node would exit on them.
  const quiet = () => {};
  process.on('unhandledRejection', quiet);
  try {
    const harness = readFileSync(HARNESS_FILE, 'utf8');
    const problems = [];
    const groups = new Set(GROUPS.map((g) => g.key));
    const slugs = new Set();
    for (const problem of PROBLEMS) {
      const { slug } = problem;
      if (!groups.has(problem.group) || slugs.has(slug)) throw new Error(`${slug}: bad group or duplicate slug`);
      slugs.add(slug);
      const files = {
        zh: read(slug, 'statement.zh.md'),
        en: read(slug, 'statement.en.md'),
        starter: read(slug, 'starter.js'),
        solution: read(slug, 'solution.js'),
        tests: read(slug, 'tests.js'),
        editorialZh: read(slug, 'editorial.zh.md'),
        editorialEn: read(slug, 'editorial.en.md'),
      };
      const solved = await runInVm(harness, files.solution, files.tests);
      if (solved.error) throw new Error(`${slug}: solution.js throws: ${solved.error}`);
      const failed = solved.results.filter((r) => !r.pass);
      if (failed.length) throw new Error(`${slug}: solution.js fails ${failed.map((r) => `"${r.name}": ${r.error}`).join('; ')}`);
      if (!solved.cases.some((c) => c.public)) throw new Error(`${slug}: no test.public case`);
      const started = await runInVm(harness, files.starter, files.tests, { only: 'public', timeoutMs: 200 });
      if (!started.error && started.results.every((r) => r.pass)) throw new Error(`${slug}: starter.js passes every public case`);
      problems.push({
        ...problem,
        statement: { zh: files.zh, en: files.en },
        starter: files.starter,
        tests: files.tests,
        cases: solved.cases,
        solution: files.solution,
        editorial: { zh: files.editorialZh, en: files.editorialEn },
      });
    }
    return JSON.stringify({ harness, groups: GROUPS, problems }, null, 1) + '\n';
  } finally {
    process.off('unhandledRejection', quiet);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const built = await buildFrontendJs();
  if (process.argv.includes('--check')) {
    if (!existsSync(MANIFEST_FILE) || readFileSync(MANIFEST_FILE, 'utf8') !== built) {
      console.error(`${MANIFEST_FILE} is out of date; run node scripts/frontend-js/build.mjs`);
      process.exit(1);
    }
  } else writeFileSync(MANIFEST_FILE, built);
  console.log(`frontend-js: ${PROBLEMS.length} problems ok`);
  // Starters' never-settling promises may hold timers open.
  process.exit(0);
}
