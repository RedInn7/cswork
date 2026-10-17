/**
 * The step debugger behind components/python-debugger.tsx: a Python tracer that runs in
 * Pyodide inside a Web Worker owned by an opaque-origin iframe (never on the judge), and
 * the pure functions that replay its trace. The tracer records one step per executed line
 * (and per return) of the learner's code: line, frame depth, locals (repr cut to 200 chars)
 * and how much stdout there was; call stacks are rebuilt from depths here instead of being
 * shipped per step. Locals that can be drawn (arrays, tables, dicts, linked lists and trees)
 * also get capped JSON snapshots, read by lib/debug-shapes.ts.
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
  /** One number per function call: tells recursive calls of the same function apart. A generator keeps its number across resumes. */
  frame: number;
  func: string;
  kind: 'line' | 'return';
  /** stdout length (UTF-16 units) when the step was taken. */
  out: number;
  vars: [string, string][];
  /** kind 'return': the returned value. */
  ret?: string;
  /** kind 'return': the call ended by an exception (ret is then a meaningless None). */
  raised?: true;
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
  /** Parameter names per call (keyed by `frame`); calls without parameters are left out. */
  params: Record<number, string[]>;
  /** The calling frame per call (keyed by `frame`); outermost calls are left out. */
  parents: Record<number, number>;
  /** Distinct picture snapshots as JSON (lib/debug-shapes.ts parses them). */
  shapes: string[];
  /** Per step index (sparse): the variables drawn at that step, as [name, index into shapes]; '#nodes' is the node graph. */
  views: Record<number, [string, number][]>;
  /** The first step recorded without pictures (they hit their size or time cap), or null. */
  shapesCut: number | null;
};

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const whole = (value: unknown) => (Number.isInteger(value) ? (value as number) : 0);

/** The worker's JSON → a Trace; anything malformed is dropped rather than trusted. */
export function parseTrace(json: string): Trace {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const steps: TraceStep[] = [];
  // Raw step index -> kept step index, for the views table.
  const kept = new Map<number, number>();
  for (const [at, item] of (Array.isArray(raw.steps) ? raw.steps : []).entries()) {
    if (!Array.isArray(item) || !Number.isInteger(item[0])) continue;
    kept.set(at, steps.length);
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
      ...(item[4] === 1 && item[8] === 1 ? { raised: true as const } : {}),
    });
  }
  const error = raw.error as Record<string, unknown> | null;
  const note = raw.note as Record<string, unknown> | null;
  const params: Record<number, string[]> = {};
  for (const [key, names] of Object.entries(raw.params && typeof raw.params === 'object' ? raw.params : {}))
    if (Number.isInteger(Number(key)) && Array.isArray(names) && names.every((name) => typeof name === 'string'))
      params[Number(key)] = names;
  // A caller always got its serial first: anything else (a loop, say) is dropped.
  const parents: Record<number, number> = {};
  for (const [key, parent] of Object.entries(raw.parents && typeof raw.parents === 'object' ? raw.parents : {}))
    if (Number.isInteger(Number(key)) && Number.isInteger(parent) && parent > 0 && parent < Number(key))
      parents[Number(key)] = parent;
  const shapes = (Array.isArray(raw.shapes) ? raw.shapes : []).map((json: unknown) => text(json));
  const views: Record<number, [string, number][]> = {};
  for (const [key, list] of Object.entries(raw.views && typeof raw.views === 'object' ? raw.views : {})) {
    const at = kept.get(Number(key));
    const pairs = (Array.isArray(list) ? list : []).filter(
      (pair: unknown): pair is [string, number] =>
        Array.isArray(pair) && typeof pair[0] === 'string' && Number.isInteger(pair[1]) && pair[1] >= 0 && pair[1] < shapes.length,
    );
    if (at !== undefined && pairs.length) views[at] = pairs;
  }
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
    params,
    parents,
    shapes,
    views,
    shapesCut: Number.isInteger(raw.shapesCut) ? (raw.shapesCut as number) : null,
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

/** The index of the latest earlier step in the same call, or -1. */
export function previousInFrame(steps: readonly TraceStep[], index: number): number {
  const step = steps[index];
  if (step) for (let j = index - 1; j >= 0; j--) if (steps[j].frame === step.frame) return j;
  return -1;
}

/** Names that are new or hold a different value than at this frame's previous step. */
export function changedNames(steps: readonly TraceStep[], index: number): Set<string> {
  const step = steps[index];
  const changed = new Set<string>();
  const before = steps[previousInFrame(steps, index)];
  if (!step || !before) return changed;
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
from collections import deque as _deque
from itertools import chain as _chain, islice as _islice

_FILE = '<solution>'
_RESUMABLE = _inspect.CO_GENERATOR | _inspect.CO_COROUTINE | _inspect.CO_ASYNC_GENERATOR
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
    """The step's [name, repr] pairs, and the same locals' values for the pictures."""
    names = frame.f_locals
    module = names is frame.f_globals
    found, kept = [], []
    for name, value in list(names.items()):
        if name.startswith('__') or isinstance(value, _SKIP):
            continue
        if module and baseline.get(name, _MISSING) is value:
            continue
        found.append([name, _show(value)])
        kept.append((name, value))
        if len(found) >= 40:
            break
    return found, kept


_SCALARS = {int, float, str, bool, type(None)}
_ROWS = {list, tuple}
_LINKS = ('next', 'left', 'right')


def _brief(value):
    # Plain repr for scalars: reprlib is several times slower, and this runs every step.
    return _cut(repr(value) if type(value) in _SCALARS else _show(value), 24)


def _shape(value):
    """A picture of one value as JSON (cells are reprs), or None: a flat sequence (a string as
    its characters), a 2-D table up to 40 x 40, or a dict's first 30 entries."""
    try:
        if type(value) is str:
            if not 2 <= len(value) <= 64:
                return None
            data = {'k': 'seq', 'v': list(value), 'n': len(value)}
        elif isinstance(value, (list, tuple, _deque)):
            # A deque can't be sliced: islice. Every check below is C-speed map/set work.
            if value and len(value) <= 40 and set(map(type, value)) <= _ROWS:
                if not 0 < max(map(len, value)) <= 40 or not set(map(type, _chain.from_iterable(value))) <= _SCALARS:
                    return None
                data = {'k': 'grid', 'v': [list(map(repr, row)) for row in value]}
            else:
                head = list(_islice(value, 64))
                if not set(map(type, head)) <= _SCALARS:
                    return None
                data = {'k': 'seq', 'v': list(map(repr, head)), 'n': len(value)}
        elif isinstance(value, dict):
            data = {'k': 'dict', 'v': [[_brief(k), _brief(v)] for k, v in _islice(value.items(), 30)], 'n': len(value)}
        else:
            return None
        text = _json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    except BaseException:
        return None
    # ponytail: 8000, not 4000: a 40 x 40 table of one-digit reprs is already ~6400 characters.
    return text if len(text) <= 8000 else None


def _node(value):
    """A linked-list or tree node: an object whose next/left/right is None or another object."""
    fields = getattr(value, '__dict__', None)
    return type(fields) is dict and any(
        name in fields and (fields[name] is None or type(getattr(fields[name], '__dict__', None)) is dict)
        for name in _LINKS)


def _graph(kept, roots):
    """The nodes the frame's variables (and the harness's input roots) reach, breadth first, at
    most 255, as JSON: [val, next, left, right] per node and [variable, node] per pointer, by
    index (-1 for none, or for a node past the cap: then 'more' is 1). A cycle is just an edge
    back. None when no variable holds a node.
    ponytail: a doubly linked list's prev is not drawn."""
    named = [(name, value) for name, value in kept if _node(value)]
    if not named:
        return None
    seen, order, queue, head = {}, [], [value for _, value in named] + roots, 0
    while head < len(queue) and len(order) < 255:
        item = queue[head]
        head += 1
        if id(item) in seen or not _node(item):
            continue
        seen[id(item)] = len(order)
        order.append(item)
        queue += [item.__dict__.get(name) for name in _LINKS]
    at = lambda item: seen.get(id(item), -1)
    rows = []
    for item in order:
        fields = item.__dict__
        rows.append([_cut(_show(fields['val']), 12) if 'val' in fields else ''] + [at(fields.get(name)) for name in _LINKS])
    data = {'k': 'nodes', 'n': rows, 'p': [[name, at(value)] for name, value in named if id(value) in seen]}
    # Past the cap a link to an undrawn node reads -1 like None: 'more' says the picture is cut.
    if any(id(item) not in seen and _node(item) for item in queue[head:]):
        data['more'] = 1
    return _json.dumps(data, ensure_ascii=False, separators=(',', ':'))


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


# The trees and lists the harness built this run: the pictures keep drawing them whole while a
# frame only holds a subtree (or the head has been reversed away).
_ROOTS = []


def _convert(hint, value, ns):
    text = (hint if isinstance(hint, str) else str(hint)).replace(' ', '')
    if ('List[' in text or 'list[' in text) and isinstance(value, list) and ('TreeNode' in text or 'ListNode' in text):
        return [_convert(text[text.index('[') + 1:], item, ns) for item in value]
    if 'TreeNode' in text and isinstance(ns.get('TreeNode'), type):
        value = _tree(value, ns['TreeNode'])
    elif 'ListNode' in text and isinstance(ns.get('ListNode'), type):
        value = _linked(value, ns['ListNode'])
    else:
        return value
    if value is not None:
        _ROOTS.append(value)
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
    steps, frames, state = [], {}, {'stopped': None, 'serial': 0, 'size': 0, 'spent': 0.0}
    # Generators get a 'call' event on every resume: they keep their first serial. Keyed by
    # the frame itself, so a finished generator's serial is never handed to a new frame.
    # ponytail: holds those frames until the run ends; fine at 5000 steps.
    resumable, params, parents = {}, {}, {}
    # Frames an exception is passing through: their next 'return' (arg None) is that exception
    # leaving, unless a 'line' event (an except or finally) comes first. Iteration signals
    # aren't crashes: for/yield from/await swallow StopIteration on the same line, and a
    # generator closed early sees GeneratorExit.
    # ponytail: so a StopIteration that does escape a plain function shows as returning None.
    raising = set()
    # Pictures: each distinct JSON once in shapes; views maps a step's index to its [name,
    # shape] pairs. They stop for good (shapesCut: the first step without them) past 1.5 MB or
    # once they have cost 30% of the time limit, so the text trace keeps most of its steps.
    shapes, known, views, budget = [], {}, {}, float(req.get('maxMs') or 3000) * 0.3 / 1000
    trace = {'steps': steps, 'result': None, 'error': None, 'note': None, 'params': params, 'parents': parents,
             'shapes': shapes, 'views': views, 'shapesCut': None}
    _ROOTS.clear()
    out = _Out()
    ns = {'__name__': '__main__', '__builtins__': _b}
    if leetcode:
        exec(compile(_PRELUDE, '<prelude>', 'exec'), ns)
    baseline = dict(ns)

    def snapshot(kept):
        began = _time.perf_counter()
        graph = _graph(kept, _ROOTS)
        texts = [('#nodes', graph)] if graph else []
        for name, value in kept:
            if len(texts) >= 6:
                break
            text = _shape(value)
            if text:
                texts.append((name, text))
        found = []
        for name, text in texts:
            index = known.get(text)
            if index is None:
                state['size'] += len(text)
                if state['size'] > 1500000:
                    trace['shapesCut'] = len(steps)
                    return
                index = known[text] = len(shapes)
                shapes.append(text)
            found.append([name, index])
        if found:
            views[len(steps)] = found
        state['spent'] += _time.perf_counter() - began
        if state['spent'] > budget:
            trace['shapesCut'] = len(steps) + 1

    def local(frame, event, arg):
        if event == 'exception' and not issubclass(arg[0], (StopIteration, StopAsyncIteration, GeneratorExit)):
            raising.add(id(frame))
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
        shown, kept = _vars(frame, baseline)
        step = [frame.f_lineno, depth, serial, getattr(code, 'co_qualname', code.co_name),
                1 if event == 'return' else 0, out.units, shown]
        raised = id(frame) in raising
        raising.discard(id(frame))
        if event == 'return':
            frames.pop(id(frame), None)
            step += [_show(arg), 1] if raised else [_show(arg)]
        if trace['shapesCut'] is None:
            # The learner's own objects run here (a __getattr__, a list subclass): if one throws,
            # stop drawing rather than let it surface in their code as if it had thrown there.
            try:
                snapshot(kept)
            except BaseException:
                trace['shapesCut'] = len(steps)
                views.pop(len(steps), None)
        steps.append(step)
        return local

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != _FILE:
            return None
        parent = frame.f_back
        while parent is not None and parent.f_code.co_filename != _FILE:
            parent = parent.f_back
        known = frames.get(id(parent)) if parent is not None else None
        serial = resumable.get(frame)
        if serial is None:
            state['serial'] += 1
            serial = state['serial']
            code = frame.f_code
            if code.co_flags & _RESUMABLE:
                resumable[frame] = serial
            # Parameters lead co_varnames: positional, keyword-only, *args, **kwargs.
            count = (code.co_argcount + code.co_kwonlyargcount + bool(code.co_flags & _inspect.CO_VARARGS)
                     + bool(code.co_flags & _inspect.CO_VARKEYWORDS))
            if count:
                params[serial] = code.co_varnames[:count]
            # The caller, which the steps can't always tell: a generator resumed mid-line
            # makes calls before its next step.
            if known:
                parents[serial] = known[0]
        frames[id(frame)] = (serial, known[1] + 1 if known else 0)
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
 * The worker's whole source (a classic worker started from a Blob inside the sandbox page
 * below, so it never runs with this site's origin). After Pyodide is up it also deletes the
 * network and storage APIs it no longer needs, as a second layer.
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

/** The sandbox page's CSP, which its blob worker inherits: Pyodide's pinned directory and nothing else. */
export const SANDBOX_CSP = `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' ${PYODIDE_URL}; worker-src blob:; connect-src ${PYODIDE_URL}`;

/**
 * The page of the hidden iframe that owns the worker, loaded as srcdoc with
 * sandbox="allow-scripts" and no allow-same-origin: its origin is opaque, so code from a
 * share link (or a tampered pyodide.js) can't read this site's cookies or call its APIs as
 * the learner. It says "ready", then relays the parent's requests to the worker and the
 * worker's messages back; "noworker" and "crash" stand for the worker failing to start or dying.
 */
export function sandboxSource(): string {
  // < keeps the worker source from closing the <script> early.
  const worker = JSON.stringify(workerSource()).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"><script>
var worker;
try {
  worker = new Worker(URL.createObjectURL(new Blob([${worker}], { type: "text/javascript" })));
} catch (error) {
  parent.postMessage({ type: "noworker" }, "*");
}
if (worker) {
  worker.onmessage = function (event) { parent.postMessage(event.data, "*"); };
  worker.onerror = function () { parent.postMessage({ type: "crash" }, "*"); };
  onmessage = function (event) { if (event.source === parent) worker.postMessage(event.data); };
  parent.postMessage({ type: "ready" }, "*");
}
</script>`;
}
