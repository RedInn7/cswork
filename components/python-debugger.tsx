'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  FastForward,
  LoaderCircle,
  Play,
  Redo2,
  StepBack,
} from 'lucide-react';
import { CodeEditor, type CodeEditorProps } from './editor';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { DemoGraphView } from './algorithm-demo';
import { SCALE } from './structure-view';
import { useT } from '@/lib/i18n';
import type { CodingMode } from '@/lib/coding-mode';
import { buildCallTree, MAX_CALL_NODES, type CallNode, type CallTree } from '@/lib/call-tree';
import { nodeGraph, pointers, stepViews, type StepView } from '@/lib/debug-shapes';
import {
  changedNames,
  entryMethod,
  LIMITS,
  moveTo,
  parseTrace,
  PYODIDE_MB,
  PYODIDE_VERSION,
  sandboxSource,
  stackAt,
  stdoutAt,
  type HarnessNote,
  type Move,
  type Trace,
} from '@/lib/python-debugger';

type Mount = NonNullable<CodeEditorProps['onEditorMount']>;
type Editor = Parameters<Mount>[0];
type Monaco = Parameters<Mount>[1];
type View = { editor: Editor; monaco: Monaco; decorations: ReturnType<Editor['createDecorationsCollection']> };
type Pair = [string, string];

type Message = { type: string; json?: string; message?: string };
type Sandbox = {
  onmessage: ((event: { data: Message }) => void) | null;
  onerror: (() => void) | null;
  postMessage: (data: unknown) => void;
  terminate: () => void;
};
/**
 * The worker runs inside a hidden iframe with an opaque origin (see sandboxSource), never
 * with this site's origin: the code may come from someone else's share link. Removing the
 * iframe kills the worker.
 */
function startSandbox(): Sandbox {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.title = 'Python sandbox';
  frame.hidden = true;
  frame.srcdoc = sandboxSource();
  let waiting: unknown[] | null = [];
  const box: Sandbox = {
    onmessage: null,
    onerror: null,
    postMessage: (data) => void (waiting ? waiting.push(data) : frame.contentWindow?.postMessage(data, '*')),
    terminate: () => {
      window.removeEventListener('message', listen);
      frame.remove();
    },
  };
  const listen = (event: MessageEvent) => {
    const data = event.data as Message | null;
    if (event.source !== frame.contentWindow || !data || typeof data !== 'object') return;
    if (data.type === 'ready') {
      const queued = waiting ?? [];
      waiting = null;
      queued.forEach(box.postMessage);
    } else if (data.type === 'crash') box.onerror?.();
    else box.onmessage?.({ data });
  };
  window.addEventListener('message', listen);
  document.body.append(frame);
  return box;
}

const NOTES: Record<HarnessNote['code'], Pair> = {
  json: [
    '输入的每一行要是一个 JSON 值（例如 [2,7,11,15]），所以没有调用 Solution，代码按标准输入跑了一遍。',
    'Each input line must be one JSON value (e.g. [2,7,11,15]), so Solution was not called; the code ran with the input as plain stdin.',
  ],
  entry: [
    '没找到要调用的方法（Solution 类，或设计题第一行里的类），代码按标准输入跑了一遍：可以在代码末尾自己调用函数。',
    'No method to call (a Solution class, or the class named first in a design problem), so the code ran with plain stdin: call your function at the end yourself.',
  ],
  arity: ['参数个数不对：每行一个，依次是 ', 'Wrong number of arguments: one per line, in order: '],
  tree: ['树参数要是 JSON 层序数组，例如 [3,9,20,null,null,15,7]。', 'A tree argument must be a JSON level-order array, e.g. [3,9,20,null,null,15,7].'],
  list: ['链表参数要是 JSON 数组，例如 [1,2,3]。', 'A linked-list argument must be a JSON array, e.g. [1,2,3].'],
};

/** Hard stop for runs the tracer's clock can't see (one long C call such as sum(range(10**10))). */
const GRACE_MS = 5000;

export type PythonDebuggerProps = {
  code: string;
  stdin: string;
  mode: CodingMode;
  /** LeetCode mode: the problem's Python template, naming the method to call. */
  template?: string;
  onClose: () => void;
};

/**
 * Runs the learner's Python once under a tracer (Pyodide in a Web Worker, loaded from the
 * CDN on first open), then replays the recorded steps: no judge resources involved.
 */
export function PythonDebugger({ code, stdin: firstInput, mode, template = '', onClose }: PythonDebuggerProps) {
  const t = useT();
  const [source] = useState(code);
  const entry = useMemo(() => (mode === 'leetcode' ? entryMethod(template) : ''), [mode, template]);
  const [stdin, setStdin] = useState(firstInput);
  const [phase, setPhase] = useState<'loading' | 'running' | 'done' | 'failed'>('loading');
  const [failure, setFailure] = useState<Pair | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [index, setIndex] = useState(0);
  const [breakpoints, setBreakpoints] = useState<ReadonlySet<number>>(() => new Set());
  const [view, setView] = useState<View | null>(null);
  const worker = useRef<Sandbox | null>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const marks = useRef(breakpoints);
  marks.current = breakpoints;

  const stop = () => {
    clearTimeout(timer.current);
    worker.current?.terminate();
    worker.current = null;
    loaded.current = false;
  };
  const fail = (message: Pair) => {
    stop();
    setFailure(message);
    setPhase('failed');
  };
  const run = (input: string) => {
    clearTimeout(timer.current);
    setFailure(null);
    setPhase(loaded.current ? 'running' : 'loading');
    const current = (worker.current ??= startSandbox());
    current.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'loaded') {
        loaded.current = true;
        setPhase('running');
        timer.current = setTimeout(
          () =>
            fail([
              '运行太久，已强制停止（可能卡在一次很长的内置函数调用里，追踪器的计时看不到它）。',
              'The run took too long and was stopped (likely one long built-in call the tracer cannot time).',
            ]),
          LIMITS.maxMs + GRACE_MS,
        );
      } else if (data.type === 'trace' && typeof data.json === 'string') {
        clearTimeout(timer.current);
        const next = parseTrace(data.json);
        setTrace(next);
        // Like starting a debugger: run to the first breakpoint, if any.
        setIndex(marks.current.size ? moveTo(next.steps, -1, 'continue', marks.current) : 0);
        setPhase('done');
      } else if (data.type === 'noworker')
        fail(['这个浏览器不能启动 Web Worker，调试器用不了。', "This browser can't start a Web Worker, so the debugger can't run."]);
      else
        fail(
          loaded.current
            ? ['调试器内部出错：' + (data.message ?? ''), 'The debugger failed: ' + (data.message ?? '')]
            : [
                '没能下载 Python 运行时（cdn.jsdelivr.net），检查网络后重试。',
                "Couldn't download the Python runtime (cdn.jsdelivr.net). Check your connection and retry.",
              ],
        );
    };
    current.onerror = () =>
      fail(['没能启动 Python 运行时，检查网络后重试。', "Couldn't start the Python runtime. Check your connection and retry."]);
    current.postMessage({ code: source, stdin: input, mode, entry, ...LIMITS });
  };
  // Opening the debugger is what downloads Pyodide; closing it frees the worker's memory.
  useEffect(() => {
    run(firstInput);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    (line: number) =>
      setBreakpoints((previous) => {
        const next = new Set(previous);
        if (!next.delete(line)) next.add(line);
        return next;
      }),
    [],
  );
  const label = t('调试中的代码（只读）：点击行号或按 F9 设断点', 'Code being debugged (read-only): click a line number or press F9 for a breakpoint');
  const mount = useCallback<Mount>(
    (editor, monaco) => {
      editor.updateOptions({ glyphMargin: true, ariaLabel: label });
      const decorations = editor.createDecorationsCollection();
      const gutter = [monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN, monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS];
      const subscriptions = [
        editor.onMouseDown((event) => {
          const line = event.target.position?.lineNumber;
          if (line && gutter.includes(event.target.type)) toggle(line);
        }),
        editor.addAction({
          id: 'cswork.debug.breakpoint',
          label: t('切换断点', 'Toggle breakpoint'),
          keybindings: [monaco.KeyCode.F9],
          run: () => {
            const line = editor.getPosition()?.lineNumber;
            if (line) toggle(line);
          },
        }),
      ];
      setView({ editor, monaco, decorations });
      return () => {
        subscriptions.forEach((item) => item.dispose());
        setView(null);
      };
    },
    [toggle, label, t],
  );

  const steps = trace?.steps ?? [];
  const step = steps[index];
  const last = steps.length - 1;
  const atEnd = !!trace && index === last;
  const errorLine = trace?.error?.line ?? null;
  const failedLine = atEnd && errorLine === step?.line;
  useEffect(() => {
    if (!view) return;
    const { editor, monaco, decorations } = view;
    const at = (line: number, options: Parameters<typeof decorations.set>[0][number]['options']) => ({
      range: new monaco.Range(line, 1, line, 1),
      options,
    });
    decorations.set([
      ...[...breakpoints]
        .filter((line) => line !== step?.line)
        .map((line) => at(line, { glyphMarginClassName: 'pydbg-glyph-break' })),
      ...(step
        ? [
            at(step.line, {
              isWholeLine: true,
              className: failedLine ? 'pydbg-line-error' : step.kind === 'return' ? 'pydbg-line-return' : 'pydbg-line-current',
              glyphMarginClassName: breakpoints.has(step.line) ? 'pydbg-glyph-here pydbg-glyph-break' : 'pydbg-glyph-here',
            }),
          ]
        : []),
      // A syntax error never runs a step: mark its line instead.
      ...(!step && errorLine ? [at(errorLine, { isWholeLine: true, className: 'pydbg-line-error' })] : []),
    ]);
    if (step) editor.revealLineInCenterIfOutsideViewport(step.line);
  }, [view, breakpoints, step, failedLine, errorLine]);

  const go = (move: Move) => trace && setIndex((i) => moveTo(trace.steps, i, move, breakpoints));
  const keys = (event: KeyboardEvent) => {
    const move = ({ F5: 'continue', F10: 'over', F11: 'into' } as Record<string, Move>)[event.key];
    if (!move || !steps.length) return;
    event.preventDefault();
    go(move);
  };
  const changed = useMemo(() => changedNames(steps, index), [steps, index]);
  const views = useMemo(() => (trace ? stepViews(trace, index) : []), [trace, index]);
  const shapesCut = trace?.shapesCut ?? null;
  const stack = useMemo(() => stackAt(steps, index), [steps, index]);
  const tree = useMemo(() => buildCallTree(steps, trace?.params, trace?.parents), [steps, trace]);
  const [calls, setCalls] = useState<'stack' | 'tree'>('stack');
  // The tree tab only exists for runs where a function calls itself (or back into itself).
  const showTree = tree.recursive && calls === 'tree';
  const busy = phase === 'loading' || phase === 'running';
  const named = (func: string) => (func === '<module>' ? t('主程序', 'main') : func);
  const controls: [Move, Pair, string, typeof Play, boolean][] = [
    ['first', ['重置', 'Reset'], '', ChevronsLeft, index === 0],
    ['back', ['后退', 'Back'], '', StepBack, index === 0],
    ['into', ['进入', 'Step into'], 'F11', ArrowDownToLine, index >= last],
    ['over', ['跳过', 'Step over'], 'F10', Redo2, index >= last],
    ['continue', ['继续', 'Continue'], 'F5', FastForward, index >= last],
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="pydbg" onKeyDown={keys}>
        <header className="pydbg-head">
          <DialogTitle>
            {t('逐行调试', 'Step debugger')}
            <span>Python 3.13 · Pyodide {PYODIDE_VERSION}</span>
          </DialogTitle>
          <DialogDescription>
            {mode === 'leetcode'
              ? t(
                  `LeetCode 模式：输入每行一个 JSON 参数，调用 Solution.${entry || '…'}()，树和链表按数组转换；设计题第一行是操作、第二行是参数。环形链表、Codec 等特殊格式按普通数组处理，可能和判题不同。`,
                  `LeetCode mode: one JSON argument per input line, passed to Solution.${entry || '…'}(); trees and linked lists are built from arrays. Design problems: operations on line 1, arguments on line 2. Special formats (cycles, Codec) are read as plain arrays and may differ from the judge.`,
                )
              : t('ACM 模式：程序从标准输入读取下面的输入。', 'ACM mode: the program reads the input below from stdin.')}
          </DialogDescription>
        </header>
        <div className="pydbg-status" aria-live="polite">
          {phase === 'loading' ? (
            <p>
              <LoaderCircle size={14} className="cs-spin" />
              {t(
                `正在下载 Python 运行时（约 ${PYODIDE_MB} MB，来自 jsDelivr；只有第一次需要，之后浏览器会缓存）…`,
                `Downloading the Python runtime (about ${PYODIDE_MB} MB from jsDelivr; only the first time, then your browser caches it)…`,
              )}
              <progress aria-label={t('下载进度', 'Download progress')} />
            </p>
          ) : phase === 'running' ? (
            <p>
              <LoaderCircle size={14} className="cs-spin" />
              {t('正在运行并记录每一步…', 'Running and recording every step…')}
            </p>
          ) : phase === 'failed' ? (
            <p className="pydbg-failed" role="alert">
              {failure && t(...failure)}
              <button type="button" onClick={() => run(stdin)}>
                {t('重试', 'Retry')}
              </button>
            </p>
          ) : (
            trace && (
              <p>
                <strong>{t(`共 ${steps.length} 步`, `${steps.length} steps`)}</strong>
                {trace.stopped &&
                  ' · ' +
                    (trace.stopped === 'steps'
                      ? t(`到了 ${LIMITS.maxSteps} 步上限，只记录了前面这些`, `Stopped at the ${LIMITS.maxSteps}-step limit`)
                      : t(`到了 ${LIMITS.maxMs / 1000} 秒上限，只记录了前面这些`, `Stopped at the ${LIMITS.maxMs / 1000}-second limit`))}
                {trace.error && (
                  <span className="pydbg-error-text">
                    {' · '}
                    {trace.error.line ? t(`第 ${trace.error.line} 行：`, `Line ${trace.error.line}: `) : ''}
                    {trace.error.type}
                    {trace.error.message && `: ${trace.error.message}`}
                  </span>
                )}
                {trace.note && (
                  <span className="pydbg-note">
                    {t(...NOTES[trace.note.code])}
                    {trace.note.code === 'arity' && `(${trace.note.detail})`}
                  </span>
                )}
              </p>
            )
          )}
        </div>
        <div className="pydbg-body">
          <div className="pydbg-code">
            <CodeEditor
              value={source}
              language="python"
              onChange={() => {}}
              readOnly
              path="cswork://debugger/main.py"
              onEditorMount={mount}
            />
          </div>
          <div className="pydbg-side">
            <div className="pydbg-controls" role="toolbar" aria-label={t('调试控制', 'Debugger controls')}>
              {controls.map(([move, name, key, Icon, off]) => (
                <button
                  key={move}
                  type="button"
                  disabled={!steps.length || off}
                  title={key ? `${t(...name)} (${key})` : t(...name)}
                  onClick={() => go(move)}
                >
                  <Icon size={14} aria-hidden="true" />
                  {t(...name)}
                </button>
              ))}
            </div>
            <div className="pydbg-timeline">
              <Depths trace={trace} index={index} breakpoints={breakpoints} />
              <input
                type="range"
                min={0}
                max={Math.max(0, last)}
                value={index}
                disabled={!steps.length}
                aria-label={t('回放位置', 'Replay position')}
                aria-valuetext={step ? t(`第 ${index + 1} 步，第 ${step.line} 行`, `Step ${index + 1}, line ${step.line}`) : undefined}
                onChange={(event) => setIndex(Number(event.target.value))}
              />
              <p className="pydbg-where">
                {step
                  ? t(
                      `第 ${index + 1} / ${steps.length} 步 · 第 ${step.line} 行 · ${named(step.func)}${step.kind === 'return' ? ' · 返回' : ''}`,
                      `Step ${index + 1} / ${steps.length} · line ${step.line} · ${named(step.func)}${step.kind === 'return' ? ' · return' : ''}`,
                    )
                  : t('还没有可回放的步骤', 'Nothing to replay yet')}
              </p>
            </div>
            {step && (views.length > 0 || (shapesCut !== null && index >= shapesCut)) && (
              <section className="pydbg-panel" aria-labelledby="pydbg-shapes">
                <h3 id="pydbg-shapes">{t('图形', 'Pictures')}</h3>
                {views.length > 0 && (
                  <div className="algorithm-demo pydbg-shapes">
                    {views.map((view) => (
                      <Picture key={view.name} view={view} vars={step.vars} />
                    ))}
                  </div>
                )}
                {shapesCut !== null && index >= shapesCut && (
                  <p className="pydbg-empty">
                    {t(
                      `从第 ${shapesCut + 1} 步起不再画图（快照太大或太耗时），之后只有下面的文本变量。`,
                      `No pictures from step ${shapesCut + 1} on (the snapshots got too big or too slow): later steps show only the variables below.`,
                    )}
                  </p>
                )}
              </section>
            )}
            <section className="pydbg-panel" aria-labelledby="pydbg-vars">
              <h3 id="pydbg-vars">{t('变量', 'Variables')}</h3>
              {step && (step.vars.length || step.kind === 'return') ? (
                <table>
                  <tbody>
                    {step.vars.map(([name, value]) => (
                      <tr key={name} className={changed.has(name) ? 'changed' : undefined}>
                        <th scope="row">
                          {name}
                          {changed.has(name) && <span className="sr-only">{t('（刚变化）', ' (just changed)')}</span>}
                        </th>
                        <td>{value}</td>
                      </tr>
                    ))}
                    {step.kind === 'return' && step.func !== '<module>' && (
                      <tr className="pydbg-return">
                        <th scope="row">{t('返回值', 'Returns')}</th>
                        <td>{step.raised ? t('没有，抛出了异常', 'none: it raised an exception') : step.ret}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <p className="pydbg-empty">{t('这一步没有局部变量', 'No local variables at this step')}</p>
              )}
            </section>
            <section className="pydbg-panel" aria-labelledby={tree.recursive ? undefined : 'pydbg-stack'}>
              {tree.recursive ? (
                <div
                  className="pydbg-tabs"
                  role="tablist"
                  aria-label={t('调用', 'Calls')}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                    event.preventDefault();
                    const next = calls === 'stack' ? 'tree' : 'stack';
                    setCalls(next);
                    event.currentTarget.querySelector<HTMLElement>(`#pydbg-tab-${next}`)?.focus();
                  }}
                >
                  {(['stack', 'tree'] as const).map((key) => (
                    <button
                      key={key}
                      id={`pydbg-tab-${key}`}
                      type="button"
                      role="tab"
                      aria-selected={calls === key}
                      aria-controls="pydbg-calls"
                      tabIndex={calls === key ? 0 : -1}
                      onClick={() => setCalls(key)}
                    >
                      {key === 'stack' ? t('调用栈', 'Call stack') : t('递归树', 'Recursion tree')}
                    </button>
                  ))}
                </div>
              ) : (
                <h3 id="pydbg-stack">{t('调用栈', 'Call stack')}</h3>
              )}
              <div
                id="pydbg-calls"
                role={tree.recursive ? 'tabpanel' : undefined}
                aria-labelledby={tree.recursive ? `pydbg-tab-${calls}` : undefined}
              >
                {showTree ? (
                  <CallTreeView tree={tree} stopped={!!trace?.stopped} current={step?.frame} onJump={setIndex} />
                ) : (
                  <ol className="pydbg-stack">
                    {stack.map((frame, i) => (
                      <li key={i} aria-current={i === 0 ? 'step' : undefined}>
                        <span>{named(frame.func)}</span>
                        <small>{t(`第 ${frame.line} 行`, `line ${frame.line}`)}</small>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
            <section className="pydbg-panel" aria-labelledby="pydbg-out">
              <h3 id="pydbg-out">{t('到这一步的输出', 'Output so far')}</h3>
              <pre className="pydbg-stdout">{trace ? stdoutAt(trace, index) : ''}</pre>
              {atEnd && trace?.outputCut && (
                <p className="pydbg-empty">{t('输出超过 64 KB，后面的没有记录。', 'Output past 64 KB was not kept.')}</p>
              )}
              {atEnd && trace?.result != null && (
                <p className="pydbg-result">
                  {t('返回值：', 'Returned: ')}
                  <code>{trace.result}</code>
                </p>
              )}
            </section>
            <details className="pydbg-panel pydbg-input">
              <summary>{t('换个输入再跑', 'Run with other input')}</summary>
              <textarea
                value={stdin}
                spellCheck={false}
                aria-label={mode === 'leetcode' ? t('函数参数，每行一个 JSON', 'Arguments, one JSON value per line') : t('标准输入', 'Stdin')}
                onChange={(event) => setStdin(event.target.value)}
              />
              <button type="button" disabled={busy} onClick={() => run(stdin)}>
                <Play size={13} aria-hidden="true" />
                {t('重新运行', 'Run again')}
              </button>
            </details>
          </div>
        </div>
        <p className="pydbg-foot">
          {t(
            `点击行号或按 F9 设断点；F10 跳过、F11 进入、F5 继续。代码只在你的浏览器里运行，不占判题资源，最多记录 ${LIMITS.maxSteps} 步或 ${LIMITS.maxMs / 1000} 秒。`,
            `Click a line number or press F9 for a breakpoint; F10 steps over, F11 steps into, F5 continues. Your code runs only in this browser, never on the judge, for up to ${LIMITS.maxSteps} steps or ${LIMITS.maxMs / 1000} s.`,
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One variable drawn: a sequence as cells with index-like variables (i, lo, slow...) pointing at
 * them, a 2-D table, a dict, or the node graph. Cells the line just run wrote are highlighted.
 * The variables table below stays the screen-reader view.
 */
function Picture({ view: { name, shape, changed }, vars }: { view: StepView; vars: [string, string][] }) {
  const t = useT();
  let body: ReactNode;
  if (shape.k === 'seq') {
    const at = pointers(vars, shape.v.length);
    // One past the end (a half-open hi) gets an empty slot, when the list isn't cut short.
    const cells: (string | null)[] = shape.n === shape.v.length && at.has(shape.v.length) ? [...shape.v, null] : shape.v;
    body = (
      <>
        <div className="pydbg-seq">
          {cells.map((cell, i) => (
            <div key={i} className="pydbg-slot">
              {at.size > 0 && (
                <em>
                  {at.get(i)?.join(' ')}
                  {at.has(i) && <span aria-hidden="true">↓</span>}
                </em>
              )}
              <div className={`algorithm-demo-cell ${cell === null ? 'is-muted' : changed.has(`${i}`) ? 'is-active' : ''}`}>
                <span>{cell}</span>
                <small>{i}</small>
              </div>
            </div>
          ))}
        </div>
        {shape.n > shape.v.length && <p className="pydbg-empty">{t(`只画了前 ${shape.v.length} 项，共 ${shape.n} 项`, `First ${shape.v.length} of ${shape.n} items`)}</p>}
      </>
    );
  } else if (shape.k === 'grid') {
    const columns = Math.max(...shape.v.map((row) => row.length));
    body = (
      <table className="pydbg-grid">
        <thead>
          <tr>
            <td />
            {Array.from({ length: columns }, (_, c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shape.v.map((row, r) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {row.map((cell, c) => (
                <td key={c} className={changed.has(`${r},${c}`) ? 'is-active' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (shape.k === 'dict') {
    body = (
      <>
        <table className="pydbg-dict">
          <tbody>
            {shape.v.map(([key, value], i) => (
              <tr key={i} className={changed.has(key) ? 'changed' : undefined}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shape.n > shape.v.length && <p className="pydbg-empty">{t(`只列了前 ${shape.v.length} 项，共 ${shape.n} 项`, `First ${shape.v.length} of ${shape.n} entries`)}</p>}
      </>
    );
  } else {
    const graph = nodeGraph(shape);
    body = (
      <div className="pydbg-graph">
        <div style={{ width: graph.width * SCALE }}>
          <DemoGraphView graph={graph} />
        </div>
      </div>
    );
  }
  return (
    <figure>
      <figcaption>{name === '#nodes' ? t('链表 / 树', 'Lists / trees') : name}</figcaption>
      {body}
    </figure>
  );
}

/** Call depth over time: recursion shows as peaks, breakpoint hits as ticks. Decorative; the slider is the control. */
function Depths({ trace, index, breakpoints }: { trace: Trace | null; index: number; breakpoints: ReadonlySet<number> }) {
  const steps = trace?.steps ?? [];
  if (steps.length < 2) return null;
  const top = Math.max(1, ...steps.map((step) => step.depth));
  const x = (i: number) => (i / (steps.length - 1)) * 100;
  const y = (depth: number) => 22 - (depth / top) * 18;
  return (
    <svg className="pydbg-depths" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={steps.map((step, i) => `${x(i)},${y(step.depth)}`).join(' ')} />
      {steps.map((step, i) =>
        step.kind === 'line' && breakpoints.has(step.line) ? (
          <line key={i} className="pydbg-hit" x1={x(i)} x2={x(i)} y1={0} y2={24} />
        ) : null,
      )}
      <line className="pydbg-now" x1={x(index)} x2={x(index)} y1={0} y2={24} />
    </svg>
  );
}

/**
 * The run's calls as an indented tree: a click jumps to the call's first step, the arrow folds
 * its children, and calls repeated with the same arguments say how often.
 */
function CallTreeView({
  tree,
  stopped,
  current,
  onJump,
}: {
  tree: CallTree;
  stopped: boolean;
  current: number | undefined;
  onJump: (step: number) => void;
}) {
  const t = useT();
  const [folded, setFolded] = useState<ReadonlySet<number>>(() => new Set());
  // Serials restart with every run: a new run starts unfolded.
  useEffect(() => setFolded(new Set()), [tree]);
  const fold = (frame: number) =>
    setFolded((previous) => {
      const next = new Set(previous);
      if (!next.delete(frame)) next.add(frame);
      return next;
    });
  const row = (node: CallNode): ReactNode => {
    const open = !folded.has(node.frame);
    const name = node.func.split('.').at(-1)!;
    return (
      <li key={node.frame}>
        <div className="pydbg-call" aria-current={node.frame === current ? 'step' : undefined}>
          {node.children.length ? (
            <button
              type="button"
              className="pydbg-fold"
              aria-expanded={open}
              aria-label={open ? t('收起子调用', 'Hide inner calls') : t('展开子调用', 'Show inner calls')}
              onClick={() => fold(node.frame)}
            >
              {open ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
            </button>
          ) : (
            <span className="pydbg-fold" />
          )}
          <button type="button" className="pydbg-call-jump" title={t('跳到这次调用的第一步', "Jump to this call's first step")} onClick={() => onJump(node.firstStep)}>
            {name === '<module>' ? (
              <span>{t('主程序', 'main')}</span>
            ) : (
              <>
                <span>{`${name}(${node.args})`}</span>
                <small>
                  {node.ret === undefined ? t('未返回', 'never returned') : node.raised ? t('抛出异常', 'raised') : `→ ${node.ret}`}
                </small>
              </>
            )}
            {node.repeat > 1 && <em>{t(`重复 ×${node.repeat}`, `repeated ×${node.repeat}`)}</em>}
          </button>
        </div>
        {open && node.children.length > 0 && <ul>{node.children.map(row)}</ul>}
      </li>
    );
  };
  return (
    <>
      {(tree.cut || stopped) && (
        <p className="pydbg-empty">
          {tree.cut && t(`只画了前 ${MAX_CALL_NODES} 次调用。`, `Only the first ${MAX_CALL_NODES} calls are drawn. `)}
          {stopped &&
            t(
              '轨迹到了上限就停了：之后的调用没有记录，标「未返回」的调用当时还没结束。',
              'The trace hit its limit: later calls were not recorded, and calls marked "never returned" were still running.',
            )}
        </p>
      )}
      <ul className="pydbg-tree">{tree.roots.map(row)}</ul>
    </>
  );
}
