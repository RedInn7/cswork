/**
 * The step debugger behind components/python-debugger.tsx: a Python tracer that runs in
 * Pyodide inside a Web Worker (never on the judge), and the pure functions that replay
 * its trace. The tracer records one step per executed line (and per return) of the
 * learner's code: line, frame depth, locals (repr cut to 200 chars) and how much stdout
 * there was; call stacks are rebuilt from depths here instead of being shipped per step.
 */
import type { CodingMode } from './coding-mode';

/** Pinned: the worker loads exactly this build (Python 3.13, like the judge). */
export const PYODIDE_VERSION = '0.29.5';
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
/** pyodide.asm.wasm + python_stdlib.zip + pyodide.asm.js, uncompressed. */
export const PYODIDE_MB = 12;
export const LIMITS = { maxSteps: 5000, maxMs: 3000 } as const;

export type DebugRequest = {
  code: string;
  stdin: string;
  mode: CodingMode;
  /** LeetCode mode: the Solution method to call (from the problem's template). */
  entry: string;
  maxSteps: number;
  maxMs: number;
};
export type TraceStep = {
  line: number;
  /** 0 for the outermost frame of the learner's code. */
  depth: number;
  /** One number per function call: tells recursive calls of the same function apart. */
  frame: number;
  func: string;
  kind: 'line' | 'return';
  /** stdout length (UTF-16 units) when the step was taken. */
  out: number;
  vars: [string, string][];
  /** kind 'return': the returned value. */
  ret?: string;
};
/** Why the LeetCode-style call was skipped; the code then ran with plain stdin. */
export type HarnessNote = { code: 'json' | 'entry' | 'arity' | 'tree' | 'list'; detail: string };
export type Trace = {
  steps: TraceStep[];
  stdout: string;
  outputCut: boolean;
  /** LeetCode mode: the method's return value as JSON. */
  result: string | null;
  error: { type: string; message: string; line: number | null } | null;
  stopped: 'steps' | 'time' | null;
  note: HarnessNote | null;
};

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const whole = (value: unknown) => (Number.isInteger(value) ? (value as number) : 0);

/** The worker's JSON → a Trace; anything malformed is dropped rather than trusted. */
export function parseTrace(json: string): Trace {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const steps: TraceStep[] = [];
  for (const item of Array.isArray(raw.steps) ? raw.steps : []) {
    if (!Array.isArray(item) || !Number.isInteger(item[0])) continue;
    const vars = (Array.isArray(item[6]) ? item[6] : [])
      .filter((pair: unknown) => Array.isArray(pair) && typeof pair[0] === 'string')
      .map((pair: unknown[]) => [pair[0], text(pair[1])] as [string, string]);
    steps.push({
      line: item[0],
      depth: whole(item[1]),
      frame: whole(item[2]),
      func: text(item[3], '<module>'),
      kind: item[4] === 1 ? 'return' : 'line',
      out: whole(item[5]),
      vars,
      ...(item[4] === 1 ? { ret: text(item[7]) } : {}),
    });
  }
  const error = raw.error as Record<string, unknown> | null;
  const note = raw.note as Record<string, unknown> | null;
  return {
    steps,
    stdout: text(raw.stdout),
    outputCut: raw.outputCut === true,
    result: typeof raw.result === 'string' ? raw.result : null,
    error:
      error && typeof error === 'object'
        ? {
            type: text(error.type, 'Error'),
            message: text(error.message),
            line: Number.isInteger(error.line) ? (error.line as number) : null,
          }
        : null,
    stopped: raw.stopped === 'steps' || raw.stopped === 'time' ? raw.stopped : null,
    note:
      note && typeof note === 'object' && ['json', 'entry', 'arity', 'tree', 'list'].includes(note.code as string)
        ? { code: note.code as HarnessNote['code'], detail: text(note.detail) }
        : null,
  };
}

/**
 * The call stack at a step, innermost first: each caller is the latest earlier step one
 * frame shallower (the line that made the call).
 */
export function stackAt(steps: readonly TraceStep[], index: number): TraceStep[] {
  const step = steps[index];
  if (!step) return [];
  const stack = [step];
  let depth = step.depth;
  for (let j = index - 1; j >= 0 && depth > 0; j--)
    if (steps[j].depth < depth) {
      stack.push(steps[j]);
      depth = steps[j].depth;
    }
  return stack;
}

export type Move = 'first' | 'back' | 'into' | 'over' | 'continue';
/**
 * Where a control lands. over: the next step not inside a deeper call; continue: the next
 * line with a breakpoint, else the end. Moves past either end stay at it.
 */
export function moveTo(
  steps: readonly TraceStep[],
  from: number,
  move: Move,
  breakpoints: ReadonlySet<number>,
): number {
  const last = steps.length - 1;
  if (last < 0) return 0;
  if (move === 'first') return 0;
  if (move === 'back') return Math.max(0, from - 1);
  if (move === 'into') return Math.min(last, from + 1);
  const depth = steps[from]?.depth ?? 0;
  for (let j = from + 1; j <= last; j++) {
    const step = steps[j];
    if (move === 'over' ? step.depth <= depth : step.kind === 'line' && breakpoints.has(step.line)) return j;
  }
  return last;
}

/** Names that are new or hold a different value than at this frame's previous step. */
export function changedNames(steps: readonly TraceStep[], index: number): Set<string> {
  const step = steps[index];
  const changed = new Set<string>();
  if (!step) return changed;
  let before: TraceStep | undefined;
  for (let j = index - 1; j >= 0 && !before; j--) if (steps[j].frame === step.frame) before = steps[j];
  if (!before) return changed;
  const old = new Map(before.vars);
  for (const [name, value] of step.vars) if (old.get(name) !== value) changed.add(name);
  return changed;
}

/** stdout as it was when the step ran. */
export const stdoutAt = (trace: Trace, index: number) =>
  trace.stdout.slice(0, trace.steps[index]?.out ?? trace.stdout.length);

/** The method a LeetCode Python template asks for: the first public `def name(self` of class Solution. */
export function entryMethod(template: string): string {
  const body = template.split(/^class\s+Solution\b/m)[1];
  return body?.match(/^\s+def\s+([A-Za-z]\w*)\s*\(\s*self\b/m)?.[1] ?? '';
}

/**
 * Defines _cswork_debug(request_json) -> trace_json. The learner's code is compiled as
 * <solution> and only frames from it are traced; the LeetCode call (one JSON value per
 * input line, trees and linked lists from their arrays) runs untraced around it.
 */
export const TRACER_SOURCE = String.raw`
import builtins as _b, inspect as _inspect, io as _io, json as _json, reprlib as _reprlib, sys as _sys, time as _time, types as _types

_FILE = '<solution>'
_MISSING = object()
_SKIP = (_types.ModuleType, _types.FunctionType, _types.BuiltinFunctionType, type)
_PRELUDE = '''
from operator import *
from string import ascii_lowercase
from random import randint, choice
import random
from typing import *
from collections import *
from functools import *
from itertools import *
from bisect import *
from math import *
from heapq import *
from builtins import pow
import sys, json, math, collections, functools, itertools, bisect, heapq, string
xrange = range

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
'''


class _Stop(BaseException):
    pass


class _Harness(Exception):
    def __init__(self, code, detail=''):
        super().__init__(code)
        self.code = code
        self.detail = detail


def _cut(text, size=200):
    return text if len(text) <= size else text[:size - 1] + '…'


class _Repr(_reprlib.Repr):
    def __init__(self):
        super().__init__()
        self.maxlevel = 3
        self.maxlist = self.maxtuple = self.maxdeque = self.maxarray = 12
        self.maxdict = self.maxset = self.maxfrozenset = 10
        self.maxstring = 120
        self.maxlong = 60
        self.maxother = 200

    def repr_defaultdict(self, x, level):
        return 'defaultdict(' + self.repr_dict(x, level) + ')'

    def repr_Counter(self, x, level):
        return 'Counter(' + self.repr_dict(x, level) + ')'

    def repr_OrderedDict(self, x, level):
        return 'OrderedDict(' + self.repr_dict(x, level) + ')'

    def repr_instance(self, x, level):
        kind = type(x)
        fields = getattr(x, '__dict__', None)
        # Plain objects (TreeNode, ListNode, design classes) show their fields, not an address.
        if kind.__repr__ is object.__repr__ and isinstance(fields, dict):
            if level <= 0:
                return kind.__name__ + '(...)'
            items = list(fields.items())
            shown = ', '.join(str(k) + '=' + self.repr1(v, level - 1) for k, v in items[:8])
            return kind.__name__ + '(' + shown + (', ...' if len(items) > 8 else '') + ')'
        return _cut(_b.repr(x))


_R = _Repr()


def _show(value):
    try:
        return _cut(_R.repr(value))
    except BaseException:
        return '<repr failed>'


def _vars(frame, baseline):
    names = frame.f_locals
    module = names is frame.f_globals
    found = []
    for name, value in list(names.items()):
        if name.startswith('__') or isinstance(value, _SKIP):
            continue
        if module and baseline.get(name, _MISSING) is value:
            continue
        found.append([name, _show(value)])
        if len(found) >= 40:
            break
    return found


class _Out(_io.StringIO):
    cut = False
    units = 0

    def write(self, text):
        room = 65536 - self.tell()
        if len(text) > room:
            self.cut = True
            text = text[:max(room, 0)]
        self.units += len(text.encode('utf-16-le', 'surrogatepass')) // 2
        super().write(text)
        return len(text)


def _tree(values, Node):
    if not isinstance(values, list):
        raise _Harness('tree')
    if not values or values[0] is None:
        return None
    root = Node(values[0])
    queue, head, i = [root], 0, 1
    while head < len(queue) and i < len(values):
        node = queue[head]
        head += 1
        for side in ('left', 'right'):
            if i < len(values):
                if values[i] is not None:
                    child = Node(values[i])
                    setattr(node, side, child)
                    queue.append(child)
                i += 1
    return root


def _linked(values, Node):
    if not isinstance(values, list):
        raise _Harness('list')
    head = None
    for value in reversed(values):
        head = Node(value, head)
    return head


def _convert(hint, value, ns):
    text = (hint if isinstance(hint, str) else str(hint)).replace(' ', '')
    if ('List[' in text or 'list[' in text) and isinstance(value, list) and ('TreeNode' in text or 'ListNode' in text):
        return [_convert(text[text.index('[') + 1:], item, ns) for item in value]
    if 'TreeNode' in text and isinstance(ns.get('TreeNode'), type):
        return _tree(value, ns['TreeNode'])
    if 'ListNode' in text and isinstance(ns.get('ListNode'), type):
        return _linked(value, ns['ListNode'])
    return value


def _plain(value):
    name = type(value).__name__
    if name == 'TreeNode':
        out, queue, i, seen = [], [value], 0, set()
        while i < len(queue) and len(out) < 10000:
            node = queue[i]
            i += 1
            if node is None:
                out.append(None)
                continue
            if id(node) in seen:
                break
            seen.add(id(node))
            out.append(_plain(getattr(node, 'val', None)))
            queue += [getattr(node, 'left', None), getattr(node, 'right', None)]
        while out and out[-1] is None:
            out.pop()
        return out
    if name == 'ListNode':
        out, seen = [], set()
        while value is not None and id(value) not in seen and len(out) < 10000:
            seen.add(id(value))
            out.append(_plain(getattr(value, 'val', None)))
            value = getattr(value, 'next', None)
        return out
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_plain(item) for item in value]
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    return value


def _leetcode(ns, stdin, entry):
    try:
        args = [_json.loads(line) for line in stdin.splitlines() if line.strip()]
    except ValueError:
        raise _Harness('json')
    solution = ns.get('Solution')
    if isinstance(solution, type):
        target = solution()
        names = ([entry] if entry else []) + [n for n, v in vars(solution).items() if callable(v) and not n.startswith('_')]
        method = next((getattr(target, n) for n in names if callable(getattr(target, n, None))), None)
        if method is None:
            raise _Harness('entry')
        params = list(_inspect.signature(method).parameters.values())
        required = [p for p in params if p.default is p.empty]
        if not len(required) <= len(args) <= len(params):
            raise _Harness('arity', ', '.join(p.name for p in params))
        return method(*[_convert(p.annotation, a, ns) for p, a in zip(params, args)])
    # Design problems: line 1 the operations, line 2 their arguments.
    if (len(args) == 2 and all(isinstance(a, list) for a in args) and args[0]
            and len(args[0]) == len(args[1]) and isinstance(ns.get(args[0][0]), type)):
        ops, params = args
        target = ns[ops[0]](*params[0])
        return [None] + [getattr(target, op)(*p) for op, p in zip(ops[1:], params[1:])]
    raise _Harness('entry')


def _line(error):
    line, tb = None, error.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _cswork_debug(request):
    req = _json.loads(request)
    max_steps = int(req.get('maxSteps') or 5000)
    deadline = _time.perf_counter() + float(req.get('maxMs') or 3000) / 1000
    leetcode = req.get('mode') == 'leetcode'
    stdin = req.get('stdin') or ''
    steps, frames, state = [], {}, {'stopped': None, 'serial': 0}
    trace = {'steps': steps, 'result': None, 'error': None, 'note': None}
    out = _Out()
    ns = {'__name__': '__main__', '__builtins__': _b}
    if leetcode:
        exec(compile(_PRELUDE, '<prelude>', 'exec'), ns)
    baseline = dict(ns)

    def local(frame, event, arg):
        if event != 'line' and event != 'return':
            return local
        if len(steps) >= max_steps:
            state['stopped'] = 'steps'
            raise _Stop
        if _time.perf_counter() > deadline:
            state['stopped'] = 'time'
            raise _Stop
        code = frame.f_code
        serial, depth = frames.get(id(frame), (0, 0))
        step = [frame.f_lineno, depth, serial, getattr(code, 'co_qualname', code.co_name),
                1 if event == 'return' else 0, out.units, _vars(frame, baseline)]
        if event == 'return':
            frames.pop(id(frame), None)
            step.append(_show(arg))
        steps.append(step)
        return local

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != _FILE:
            return None
        parent = frame.f_back
        while parent is not None and parent.f_code.co_filename != _FILE:
            parent = parent.f_back
        known = frames.get(id(parent)) if parent is not None else None
        state['serial'] += 1
        frames[id(frame)] = (state['serial'], known[1] + 1 if known else 0)
        return local

    saved = _sys.stdin, _sys.stdout, _sys.stderr
    _sys.stdin = _io.TextIOWrapper(_io.BytesIO(stdin.encode()), encoding='utf-8')
    _sys.stdout = _sys.stderr = out
    try:
        program = compile(req.get('code') or '', _FILE, 'exec')
        _sys.settrace(tracer)
        try:
            exec(program, ns)
            if leetcode:
                try:
                    result = _leetcode(ns, stdin, req.get('entry') or '')
                    trace['result'] = _cut(_json.dumps(_plain(result), separators=(',', ':'), default=repr), 2000)
                except _Harness as error:
                    trace['note'] = {'code': error.code, 'detail': error.detail}
        finally:
            _sys.settrace(None)
    except _Stop:
        pass
    except SyntaxError as error:
        trace['error'] = {'type': type(error).__name__, 'message': str(error.msg), 'line': error.lineno}
    except SystemExit as error:
        if error.code not in (None, 0):
            trace['error'] = {'type': 'SystemExit', 'message': str(error.code), 'line': _line(error)}
    except BaseException as error:
        trace['error'] = {'type': type(error).__name__, 'message': _cut(str(error), 500), 'line': _line(error)}
    finally:
        _sys.stdin, _sys.stdout, _sys.stderr = saved
    trace['stopped'] = state['stopped']
    trace['stdout'] = out.getvalue()
    trace['outputCut'] = out.cut
    return _json.dumps(trace, ensure_ascii=False)
`;

/**
 * The worker's whole source (a classic worker started from a Blob). After Pyodide is up it
 * deletes every way to reach the network or this origin's storage, because the code it runs
 * may come from someone else's share link.
 */
export function workerSource(): string {
  return `"use strict";
var BLOCKED = ["fetch", "XMLHttpRequest", "WebSocket", "WebTransport", "EventSource", "importScripts",
  "Worker", "SharedWorker", "BroadcastChannel", "indexedDB", "caches"];
function seal() {
  for (var scope = self; scope; scope = Object.getPrototypeOf(scope))
    for (var i = 0; i < BLOCKED.length; i++)
      if (Object.prototype.hasOwnProperty.call(scope, BLOCKED[i])) delete scope[BLOCKED[i]];
  if (self.navigator)
    for (var p = Object.getPrototypeOf(self.navigator); p; p = Object.getPrototypeOf(p)) delete p.storage;
  for (var j = 0; j < BLOCKED.length; j++) if (BLOCKED[j] in self) throw new Error("sandbox: " + BLOCKED[j]);
}
var ready = null;
self.onmessage = function (event) {
  var request = event.data;
  ready = ready || new Promise(function (resolve) {
    importScripts(${JSON.stringify(PYODIDE_URL)} + "pyodide.js");
    resolve(loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} }));
  }).then(function (py) {
    py.runPython(${JSON.stringify(TRACER_SOURCE)});
    seal();
    return py;
  });
  ready.then(function (py) {
    self.postMessage({ type: "loaded" });
    py.globals.set("_cswork_request", JSON.stringify(request));
    self.postMessage({ type: "trace", json: py.runPython("_cswork_debug(_cswork_request)") });
  }).catch(function (error) {
    self.postMessage({ type: "error", message: String((error && error.message) || error) });
  });
};
`;
}
