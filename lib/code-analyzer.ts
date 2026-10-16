/**
 * Rule-based notes on an accepted solution (no AI, no quota) and the follow-up
 * mode's banned constructs. A small tokenizer per language drops comments and
 * turns every string literal into one placeholder token first, so a keyword in
 * either never counts. Rules prefer a miss to a false alarm: each fires only on a
 * shape it can confirm from the tokens alone, and at most once per solution.
 * Client-safe: components/analyzer-notes.tsx runs it in the browser.
 */
import followUps from './content/follow-up-rules.json';

export type AnalyzerLanguage = 'python' | 'java' | 'cpp' | 'go';
export type AnalyzerNote = {
  id: string;
  severity: 'essential' | 'actionable' | 'informative';
  zh: string;
  en: string;
  /** A Line 500 stop, linked as /topics/<topic>. */
  topic?: string;
  /** 1-based. */
  line: number;
};
export type Token = { v: string; k: 'id' | 'num' | 'str' | 'op'; line: number; col: number };
export type FollowUpRule = {
  zh: string;
  en: string;
  /** Token sequences per language: "sorted", ".sort", "heapq.nlargest", "[::-1]", "+=". */
  banned: Partial<Record<AnalyzerLanguage, string[]>>;
};

const MAX_CODE = 100_000;
const OPS = ['>>=', '<<=', '**=', '//=', '->', '::', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '**', '//', ':='];
const ID = /[A-Za-z_$À-￿][\w$À-￿]*/y;
const NUM = /[0-9][\w.]*/y;
const CPP_NUM = /[0-9][\w.']*/y; // C++14 digit separators: 1'000'000
const PREFIX: Record<AnalyzerLanguage, RegExp> = {
  python: /^(?:[rbuf]|rb|br|fr|rf)$/i,
  cpp: /^(?:u8|[uUL])?R?$/,
  java: /^$/,
  go: /^$/,
};

export const isAnalyzerLanguage = (language: string): language is AnalyzerLanguage =>
  language === 'python' || language === 'java' || language === 'cpp' || language === 'go';

export function tokenize(code: string, language: AnalyzerLanguage): Token[] {
  const out: Token[] = [];
  const py = language === 'python';
  const n = code.length;
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const skipTo = (end: number) => {
    for (let j = i; j < end; j++)
      if (code[j] === '\n') {
        line++;
        lineStart = j + 1;
      }
    i = end;
  };
  // Index just past the literal whose opening quote is at q.
  const stringEnd = (q: number, prefix: string): number => {
    const quote = code[q];
    if (language === 'go' && quote === '`') {
      const end = code.indexOf('`', q + 1);
      return end < 0 ? n : end + 1;
    }
    if (language === 'cpp' && quote === '"' && prefix.endsWith('R')) {
      const open = code.indexOf('(', q);
      if (open > 0 && open - q <= 17) {
        const end = code.indexOf(`)${code.slice(q + 1, open)}"`, open);
        return end < 0 ? n : end + open - q + 1;
      }
    }
    const triple = (py || language === 'java') && code.startsWith(quote.repeat(3), q);
    const close = triple ? quote.repeat(3) : quote;
    for (let j = q + close.length; j < n; j++) {
      if (code[j] === '\\') j++;
      else if (!triple && code[j] === '\n') return j;
      else if (code.startsWith(close, j)) return j + close.length;
    }
    return n;
  };
  while (i < n) {
    const c = code[i];
    if (c === '\n') {
      line++;
      lineStart = ++i;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
      i++;
      continue;
    }
    if (
      (py && c === '#') ||
      (!py && c === '/' && code[i + 1] === '/') ||
      // Preprocessor lines: #include <bits/stdc++.h> is neither code nor a string.
      (language === 'cpp' && c === '#' && !code.slice(lineStart, i).trim())
    ) {
      const end = code.indexOf('\n', i);
      i = end < 0 ? n : end;
      continue;
    }
    if (!py && c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      skipTo(end < 0 ? n : end + 2);
      continue;
    }
    const at = { line, col: i - lineStart };
    if (c === '"' || c === "'" || (language === 'go' && c === '`')) {
      skipTo(stringEnd(i, ''));
      out.push({ v: '""', k: 'str', ...at });
      continue;
    }
    ID.lastIndex = i;
    const id = ID.exec(code)?.[0];
    if (id) {
      const q = i + id.length;
      if ((code[q] === '"' || code[q] === "'") && PREFIX[language].test(id)) {
        skipTo(stringEnd(q, id));
        out.push({ v: '""', k: 'str', ...at });
      } else {
        i = q;
        out.push({ v: id, k: 'id', ...at });
      }
      continue;
    }
    const num = language === 'cpp' ? CPP_NUM : NUM;
    num.lastIndex = i;
    const digits = num.exec(code)?.[0];
    if (digits) {
      i += digits.length;
      out.push({ v: digits, k: 'num', ...at });
      continue;
    }
    const op = OPS.find((o) => code.startsWith(o, i)) ?? c;
    i += op.length;
    out.push({ v: op, k: 'op', ...at });
  }
  return out;
}

// ------------------------------------------------------------------ shared helpers

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSE = new Set([')', ']', '}']);

/** pair[i]: the index of the bracket matching t[i], or -1. */
function pairs(t: Token[]): number[] {
  const pair = new Array<number>(t.length).fill(-1);
  const stack: number[] = [];
  t.forEach((tok, i) => {
    if (tok.k !== 'op') return;
    if (OPEN[tok.v]) stack.push(i);
    else if (CLOSE.has(tok.v)) {
      const open = stack.pop();
      if (open !== undefined && OPEN[t[open].v] === tok.v) {
        pair[open] = i;
        pair[i] = open;
      }
    }
  });
  return pair;
}

type Range = { s: number; e: number; head: number };
const within = (loops: Range[], i: number) => loops.some((r) => r.s <= i && i < r.e);
/** The innermost loop around token i. */
const loopAt = (loops: Range[], i: number) =>
  loops.reduce<Range | undefined>((best, r) => (r.s <= i && i < r.e && (!best || r.s > best.s) ? r : best), undefined);

/** Every kind a plain name is ever bound as; a rule trusts a name only when all of them fit. */
class Bindings {
  private kinds = new Map<string, Set<string>>();
  add(name: string, kind: string) {
    const set = this.kinds.get(name) ?? new Set();
    set.add(kind);
    this.kinds.set(name, set);
  }
  only(name: string, ...kinds: string[]) {
    const set = this.kinds.get(name);
    return !!set && [...set].every((kind) => kinds.includes(kind));
  }
}

const note = (
  id: string,
  severity: AnalyzerNote['severity'],
  line: number,
  zh: string,
  en: string,
  topic?: string,
): AnalyzerNote => ({ id, severity, zh, en, line, ...(topic ? { topic } : {}) });

// ------------------------------------------------------------------ Python

type Line = { s: number; e: number; indent: number };

/** Logical lines: physical lines joined while a bracket is open or after a backslash. */
function pyLines(t: Token[]): Line[] {
  const lines: Line[] = [];
  let depth = 0;
  let joined = false;
  t.forEach((tok, i) => {
    if (i === 0 || (depth === 0 && !joined && tok.line !== t[i - 1].line))
      lines.push({ s: i, e: i, indent: tok.col });
    joined = tok.v === '\\';
    if (tok.k === 'op' && OPEN[tok.v]) depth++;
    else if (tok.k === 'op' && CLOSE.has(tok.v)) depth = Math.max(0, depth - 1);
    lines[lines.length - 1].e = i + 1;
  });
  return lines;
}

/** First token v at bracket depth 0 in [from, to). */
function topLevel(t: Token[], from: number, to: number, v: string) {
  let depth = 0;
  for (let i = from; i < to; i++) {
    if (OPEN[t[i].v]) depth++;
    else if (CLOSE.has(t[i].v)) depth--;
    else if (depth === 0 && t[i].v === v) return i;
  }
  return -1;
}

/** Where line li's indented block ends (token index). */
function blockEnd(lines: Line[], li: number) {
  let end = lines[li].e;
  for (let k = li + 1; k < lines.length && lines[k].indent > lines[li].indent; k++) end = lines[k].e;
  return end;
}

const PY_MEMO = new Set(['memo', 'cache', 'lru_cache', 'dp', 'seen', 'visited', 'memory', 'table', 'setdefault']);

function python(t: Token[]): AnalyzerNote[] {
  const pair = pairs(t);
  const lines = pyLines(t);
  const loops: Range[] = [];
  lines.forEach((L, li) => {
    const head = t[L.s].v === 'async' ? L.s + 1 : L.s;
    if (t[head]?.v !== 'for' && t[head]?.v !== 'while') return;
    const colon = topLevel(t, head, L.e, ':');
    // A while condition runs every iteration; a for's iterable runs once.
    if (colon > 0) loops.push({ s: t[head].v === 'while' ? head + 1 : colon + 1, e: blockEnd(lines, li), head });
  });
  const inLoop = (i: number) => within(loops, i);

  // What each plain name is bound to: a list that can grow, a string, or anything else.
  const kindOf = (name: string, s: number, e: number) => {
    const a = t[s];
    if (!a || a.v === name) return null; // x = x + ... rebinds to the same kind
    const end = (i: number) => i === e;
    if (a.v === '[') {
      const close = pair[s];
      if (close < 0) return 'other';
      if (close === s + 1 && end(close + 1)) return 'list';
      if (t[close + 1]?.v === '*') return 'list'; // [0] * n
      if (!end(close + 1)) return 'other';
      // [a, b]: a literal, maybe a tiny constant table; [x for ...]: built from data.
      return t.slice(s + 1, close).some((x) => x.v === 'for') ? 'list' : 'list-literal';
    }
    if ((a.v === 'list' || a.v === 'sorted') && t[s + 1]?.v === '(' && end(pair[s + 1] + 1)) return 'list';
    if (a.k === 'str' && end(s + 1)) return 'str';
    return 'other';
  };
  const names = new Bindings();
  for (const L of lines) {
    const a = t[L.s];
    if (a.k === 'id' && t[L.s + 1]?.v === '=') {
      const kind = kindOf(a.v, L.s + 2, L.e);
      if (kind) names.add(a.v, kind);
    } else if (a.k === 'id' && t[L.s + 1]?.v === ':') {
      const eq = topLevel(t, L.s + 2, L.e, '=');
      const kind = eq > 0 ? kindOf(a.v, eq + 1, L.e) : 'other';
      if (kind) names.add(a.v, kind);
    } else {
      // a, b = ...: every target is "something else" (x[i] = ... rebinds nothing).
      const eq = topLevel(t, L.s, L.e, '=');
      for (let i = L.s, depth = 0; i < eq; i++) {
        if (OPEN[t[i].v]) depth++;
        else if (CLOSE.has(t[i].v)) depth--;
        else if (depth === 0 && t[i].k === 'id' && t[i - 1]?.v !== '.' && [',', '='].includes(t[i + 1].v)) names.add(t[i].v, 'other');
      }
    }
    if (a.v === 'def' && t[L.s + 2]?.v === '(') {
      const close = pair[L.s + 2];
      for (let i = L.s + 3; i < close; i++) {
        if (t[i].k !== 'id' || !['(', ',', '*', '**'].includes(t[i - 1].v)) continue;
        const ann = t[i + 1]?.v === ':' ? t[i + 2]?.v : '';
        names.add(t[i].v, (ann === 'List' || ann === 'list') && t[i + 3]?.v === '[' ? 'list' : 'other');
      }
    }
  }
  t.forEach((tok, i) => {
    // for targets, with/except ... as x, walrus, def/class/import names
    if (tok.v === 'for') for (let j = i + 1; j < t.length && t[j].v !== 'in'; j++) if (t[j].k === 'id') names.add(t[j].v, 'other');
    if (['as', 'def', 'class', 'import', 'global', 'nonlocal'].includes(tok.v) && t[i + 1]?.k === 'id') names.add(t[i + 1].v, 'other');
    if (tok.v === ':=' && t[i - 1]?.k === 'id') names.add(t[i - 1].v, 'other');
  });
  const plain = (i: number) => t[i]?.k === 'id' && t[i - 1]?.v !== '.';
  const notes: AnalyzerNote[] = [];

  // list.pop(0) / list.insert(0, x) in a loop: O(n) each.
  for (let i = 0; i < t.length; i++) {
    if (!plain(i) || t[i + 1]?.v !== '.' || t[i + 3]?.v !== '(' || t[i + 4]?.v !== '0') continue;
    const pop = t[i + 2].v === 'pop' && t[i + 5]?.v === ')';
    const insert = t[i + 2].v === 'insert' && t[i + 5]?.v === ',';
    if ((pop || insert) && inLoop(i) && names.only(t[i].v, 'list', 'list-literal')) {
      notes.push(
        note(
          'py-list-front',
          'actionable',
          t[i].line,
          `${t[i].v}.${pop ? 'pop(0)' : 'insert(0, …)'} 要移动整个列表，在循环里每次都是 O(n)。当队列用时换成 collections.deque 的 ${pop ? 'popleft()' : 'appendleft()'}，每次 O(1)。`,
          `${t[i].v}.${pop ? 'pop(0)' : 'insert(0, …)'} shifts the whole list, so it costs O(n) on every pass of the loop. Use a collections.deque and ${pop ? 'popleft()' : 'appendleft()'} for O(1).`,
          'binary-tree',
        ),
      );
      break;
    }
  }

  // x in some_list inside a loop: a linear scan per iteration.
  scan: for (const L of lines) {
    const fors: number[] = [];
    let depth = 0;
    for (let i = L.s; i < L.e; i++) {
      const v = t[i].v;
      if (OPEN[v]) depth++;
      else if (CLOSE.has(v)) depth--;
      else if (v === 'for') fors.push(depth);
      else if (v === 'in') {
        if (fors[fors.length - 1] === depth) {
          fors.pop();
          continue;
        }
        const name = t[i + 1];
        if (name?.k !== 'id' || ['.', '[', '('].includes(t[i + 2]?.v ?? '')) continue;
        if (inLoop(i) && names.only(name.v, 'list')) {
          notes.push(
            note(
              'py-list-membership',
              'actionable',
              t[i].line,
              `在循环里用 in 查列表 ${name.v}，每次都要从头扫一遍，整体可能退化成 O(n²)。只做成员判断的话，另存一个 set，查找平均 O(1)。`,
              `Testing membership in the list ${name.v} inside a loop scans it every time, which can add up to O(n²). If you only need membership checks, keep a set alongside for average O(1) lookups.`,
              'hash-counting',
            ),
          );
          break scan;
        }
      }
    }
  }

  // s += piece in a loop on a string.
  for (const L of lines) {
    const a = t[L.s];
    const grows = t[L.s + 1]?.v === '+=' || (t[L.s + 1]?.v === '=' && t[L.s + 2]?.v === a.v && t[L.s + 3]?.v === '+');
    if (a.k === 'id' && grows && inLoop(L.s) && names.only(a.v, 'str')) {
      notes.push(
        note(
          'py-string-concat',
          'informative',
          a.line,
          `在循环里不断给字符串 ${a.v} 拼接，最坏会反复复制，总共 O(n²)（CPython 有时能原地扩展，但不保证）。把片段放进列表，最后 ''.join(...) 一次拼好。`,
          `Growing the string ${a.v} inside a loop can copy it again and again, O(n²) in the worst case (CPython sometimes extends in place, but nothing guarantees it). Collect the pieces in a list and ''.join(...) them once.`,
          'string-processing',
        ),
      );
      break;
    }
  }

  // Re-sorting a list the same loop keeps appending to.
  for (let i = 0; i < t.length; i++) {
    let name = '';
    if (plain(i) && t[i + 1]?.v === '.' && t[i + 2]?.v === 'sort' && t[i + 3]?.v === '(') name = t[i].v;
    else if (t[i].v === 'sorted' && t[i + 1]?.v === '(' && t[i + 2]?.k === 'id' && [')', ','].includes(t[i + 3]?.v)) name = t[i + 2].v;
    const loop = name && loopAt(loops, i);
    if (!loop || !names.only(name, 'list', 'list-literal')) continue;
    let grows = false;
    for (let k = loop.s; k < loop.e && !grows; k++)
      grows =
        plain(k) &&
        t[k].v === name &&
        ((t[k + 1]?.v === '.' && ['append', 'add', 'extend', 'insert'].includes(t[k + 2]?.v) && t[k + 3]?.v === '(') || t[k + 1]?.v === '+=');
    if (grows) {
      notes.push(
        note(
          'py-sort-in-loop',
          'actionable',
          t[i].line,
          `每轮循环都往 ${name} 里加元素再整体排序，一共是 O(n² log n)。只想保持有序可以用 bisect.insort 插入，只关心最值或中位数就用堆（heapq）。`,
          `Each pass appends to ${name} and then sorts the whole list again, O(n² log n) in total. To keep it ordered use bisect.insort; if you only need the extremes or the median, use a heap (heapq).`,
          'stacks-heaps',
        ),
      );
      break;
    }
  }

  // f(n - 1) + f(n - 2) with no memo: the same subproblems get solved again and again.
  memo: for (let li = 0; li < lines.length; li++) {
    const L = lines[li];
    const fn = t[L.s + 1];
    if (t[L.s].v !== 'def' || fn?.k !== 'id' || t[L.s + 2]?.v !== '(') continue;
    let cached = false;
    for (let k = li - 1; k >= 0 && t[lines[k].s].v === '@'; k--)
      cached ||= t.slice(lines[k].s, lines[k].e).some((x) => x.v === 'cache' || x.v === 'lru_cache');
    const end = blockEnd(lines, li);
    if (cached || end === L.e) continue;
    const params = new Set<string>();
    for (let i = L.s + 3; i < pair[L.s + 2]; i++)
      if (t[i].k === 'id' && ['(', ','].includes(t[i - 1].v) && t[i].v !== 'self' && t[i].v !== 'cls') params.add(t[i].v);
    for (let i = L.e; i < end; i++) if (PY_MEMO.has(t[i].v) || (t[i].v === ']' && t[i + 1]?.v === '=')) continue memo;
    for (let k = li + 1; k < lines.length && lines[k].s < end; k++) {
      let calls = 0;
      for (let i = lines[k].s; i < lines[k].e; i++) {
        if (t[i].v !== fn.v || t[i + 1]?.v !== '(' || (t[i - 1]?.v === '.' && t[i - 2]?.v !== 'self')) continue;
        const args = t.slice(i + 2, pair[i + 1]);
        if (
          args.length &&
          args.every((a) => a.k === 'num' || (a.k === 'id' && params.has(a.v)) || ['+', '-', ','].includes(a.v)) &&
          args.some((a) => a.v === '+' || a.v === '-')
        )
          calls++;
      }
      if (calls >= 2) {
        notes.push(
          note(
            'py-no-memo',
            'actionable',
            t[lines[k].s].line,
            `${fn.v} 在同一个表达式里以相近的参数递归了多次，又没有记忆化，同样的子问题会被反复计算，最坏是指数级。给函数加上 @cache（functools），或者改写成自底向上的 DP。`,
            `${fn.v} recurses more than once in the same expression with neighbouring arguments and nothing is memoized, so the same subproblems are solved over and over, exponential in the worst case. Add @cache (functools) or rewrite it as a bottom-up DP.`,
            'dp-foundations',
          ),
        );
        break memo;
      }
    }
  }
  return notes;
}

// ------------------------------------------------------------------ brace languages

/** Just past the single statement at j (a braceless loop body); `if {} else {}` counts as one. */
function statementEnd(t: Token[], pair: number[], j: number) {
  for (let k = j; k < t.length; k++) {
    if (OPEN[t[k].v] && pair[k] > 0) {
      k = pair[k];
      if (t[k].v === '}' && t[k + 1]?.v !== 'else') return k + 1;
    } else if (t[k].v === ';') return k + 1;
  }
  return t.length;
}

/** Loop bodies; a while condition counts as inside its loop. */
function braceLoops(t: Token[], pair: number[], go: boolean): Range[] {
  const loops: Range[] = [];
  t.forEach((tok, i) => {
    if (tok.k !== 'id') return;
    if (go) {
      if (tok.v !== 'for') return;
      let j = i + 1;
      while (j < t.length && t[j].v !== '{') j = OPEN[t[j].v] && pair[j] > 0 ? pair[j] + 1 : j + 1;
      if (pair[j] > 0) loops.push({ s: j, e: pair[j] + 1, head: i });
      return;
    }
    if (tok.v !== 'for' && tok.v !== 'while' && tok.v !== 'do') return;
    let j = i + 1;
    if (tok.v !== 'do') {
      if (t[j]?.v !== '(' || pair[j] < 0) return;
      j = pair[j] + 1;
    }
    if (!t[j] || t[j].v === ';') return; // do { } while (...); or an empty body
    loops.push({ s: tok.v === 'while' ? i + 1 : j, e: t[j].v === '{' ? pair[j] + 1 : statementEnd(t, pair, j), head: i });
  });
  return loops;
}

/** Keywords that can sit right before a name without declaring it. */
const NOT_TYPE = new Set(['return', 'new', 'else', 'case', 'throw', 'goto', 'yield', 'assert', 'package', 'import', 'break', 'continue', 'instanceof', 'extends', 'implements', 'throws', 'default', 'do', 'delete', 'co_return', 'using', 'typedef', 'go', 'defer', 'range', 'in', 'not', 'and', 'or', 'is', 'if', 'elif', 'while', 'for', 'with', 'lambda', 'except', 'raise', 'del', 'from', 'await', 'async', 'switch', 'select', 'print']);

/** `T name` declarations (and `T<...> name`); types[name] collects every T. */
function declarations(t: Token[], cppInit: boolean) {
  const types = new Bindings();
  const elem = new Map<string, string>();
  const after = new Set(['=', ';', ',', ')', ':', ...(cppInit ? ['{'] : [])]);
  t.forEach((tok, i) => {
    const name = t[i + 1];
    if (name?.k !== 'id' || !after.has(t[i + 2]?.v ?? '')) return;
    if (tok.k === 'id' && !NOT_TYPE.has(tok.v) && t[i - 1]?.v !== '.') types.add(name.v, tok.v);
    else if (tok.v === ']') types.add(name.v, '[]');
    else if (tok.v === '>' || tok.v === '>>' || tok.v === '>>>') {
      // Walk back to the generic's '<'; the last type argument is what get()/peek() return.
      let depth = 0;
      let last = -1;
      for (let j = i; j >= 0; j--) {
        const v = t[j].v;
        if (v === '>' || v === '>>' || v === '>>>') depth += v.length;
        else if ((v === '<' || v === ',') && depth === 1 && last < 0) last = j + 1;
        if (v === '<') depth--;
        if (depth === 0) {
          types.add(name.v, `${t[j - 1]?.v}<>`);
          if (last > 0) elem.set(name.v, t[last].v);
          return;
        }
        if (v === ';' || v === '{' || v === '}' || v === '(') return;
      }
    }
  });
  return { types, elem };
}

const BOXED = ['Integer', 'Long', 'Short', 'Byte', 'Double', 'Float'];
const LEFT_EDGE = new Set(['(', '&&', '||', '=', 'return', ',', '?', ':', '{', ';']);
const RIGHT_EDGE = new Set([')', '&&', '||', ';', '?', ',', ':']);
const READS = new Set(['get', 'peek', 'getOrDefault', 'peekFirst', 'peekLast', 'getFirst', 'getLast']);

function java(t: Token[]): AnalyzerNote[] {
  const pair = pairs(t);
  const loops = braceLoops(t, pair, false);
  const { types, elem } = declarations(t, false);
  const notes: AnalyzerNote[] = [];

  for (let i = 0; i < t.length; i++) {
    const name = t[i].v;
    if (t[i].k !== 'id' || t[i - 1]?.v === '.' || !types.only(name, 'String') || !within(loops, i)) continue;
    if (t[i + 1]?.v === '+=' || (t[i + 1]?.v === '=' && t[i + 2]?.v === name && t[i + 3]?.v === '+')) {
      notes.push(
        note(
          'java-string-concat',
          'actionable',
          t[i].line,
          `String 不可变，循环里每次给 ${name} 拼接都会新建一个字符串并复制已有内容，总共 O(n²)。改用 StringBuilder 的 append，最后 toString()。`,
          `Strings are immutable: each concatenation onto ${name} in the loop builds a new string and copies what is there, O(n²) in total. Use a StringBuilder's append and call toString() at the end.`,
          'string-processing',
        ),
      );
      break;
    }
  }

  // Integer == Integer or String == String compares references, not values.
  const side = (i: number, left: boolean): string | null => {
    const tok = t[i];
    if (!tok) return null;
    if (tok.k === 'str') return (left ? LEFT_EDGE : RIGHT_EDGE).has(t[left ? i - 1 : i + 1]?.v ?? '') ? 'String' : null;
    if (left) {
      if (tok.k === 'id' && t[i - 1]?.v !== '.' && LEFT_EDGE.has(t[i - 1]?.v ?? '')) return firstType(tok.v);
      if (tok.v !== ')' || pair[i] < 0) return null;
      const open = pair[i];
      if (!READS.has(t[open - 1]?.v) || t[open - 2]?.v !== '.' || t[open - 3]?.k !== 'id' || !LEFT_EDGE.has(t[open - 4]?.v ?? '')) return null;
      return elem.get(t[open - 3].v) ?? null;
    }
    if (tok.k !== 'id') return null;
    if (RIGHT_EDGE.has(t[i + 1]?.v ?? '')) return firstType(tok.v);
    if (t[i + 1]?.v !== '.' || !READS.has(t[i + 2]?.v) || t[i + 3]?.v !== '(' || pair[i + 3] < 0) return null;
    return RIGHT_EDGE.has(t[pair[i + 3] + 1]?.v ?? '') ? (elem.get(tok.v) ?? null) : null;
  };
  const firstType = (name: string) =>
    ['String', ...BOXED].find((type) => types.only(name, type)) ?? null;
  for (let i = 0; i < t.length; i++) {
    if (t[i].v !== '==' && t[i].v !== '!=') continue;
    const a = side(i - 1, true);
    const b = side(i + 1, false);
    const bothText = a === 'String' && b === 'String' && !(t[i - 1].k === 'str' && t[i + 1].k === 'str');
    const bothBoxed = !!a && !!b && BOXED.includes(a) && BOXED.includes(b);
    if (bothText || bothBoxed) {
      notes.push(
        note(
          'java-reference-equality',
          'essential',
          t[i].line,
          bothText
            ? `这里用 ${t[i].v} 比较两个 String，比的是是否同一个对象，不是内容是否相同；内容相同的字符串也可能得到 false。改用 a.equals(b)。`
            : `这里用 ${t[i].v} 比较两个 ${a === b ? a : '包装类型'} 对象，比的是引用。Integer 只缓存 -128 到 127，数值一大，相等的值也会得到 false。改用 a.equals(b)，或先拆成基本类型再比。`,
          bothText
            ? `${t[i].v} on two Strings checks whether they are the same object, not whether they hold the same text, so equal strings can compare false. Use a.equals(b).`
            : `${t[i].v} on two ${a === b ? a : 'boxed'} objects compares references. Integer caches only -128 to 127, so equal values outside that range compare false. Use a.equals(b), or unbox to primitives first.`,
        ),
      );
      break;
    }
  }
  return notes;
}

const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'sizeof', 'alignof', 'decltype', 'static_assert', 'operator']);

function cpp(t: Token[]): AnalyzerNote[] {
  const pair = pairs(t);
  const loops = braceLoops(t, pair, false);
  const { types } = declarations(t, true);
  const notes: AnalyzerNote[] = [];

  // A recursive function that takes a vector or string by value copies it on every call.
  defs: for (let i = 1; i < t.length; i++) {
    const tok = t[i];
    const prev = t[i - 1];
    if (tok.k !== 'id' || CONTROL.has(tok.v) || t[i + 1]?.v !== '(' || pair[i + 1] < 0) continue;
    if (!((prev.k === 'id' && !NOT_TYPE.has(prev.v)) || ['>', '>>', '*', '&', '::'].includes(prev.v))) continue;
    let body = pair[i + 1] + 1;
    while (['const', 'noexcept', 'override', 'final'].includes(t[body]?.v)) body++;
    if (t[body]?.v !== '{' || pair[body] < 0) continue;
    let recursive = false;
    for (let k = body + 1; k < pair[body] && !recursive; k++)
      recursive = t[k].v === tok.v && t[k + 1]?.v === '(' && !['.', '->', '::'].includes(t[k - 1]?.v);
    if (!recursive) continue;
    // Split the parameters on top-level commas (template arguments hold commas too).
    const params: Token[][] = [[]];
    let angle = 0;
    for (let k = i + 2; k < pair[i + 1]; k++) {
      const v = t[k].v;
      if (OPEN[v] && pair[k] > 0) {
        params[params.length - 1].push(...t.slice(k, pair[k] + 1));
        k = pair[k];
        continue;
      }
      if (v === '<') angle++;
      else if (v === '>' || v === '>>') angle -= v.length;
      if (v === ',' && angle <= 0) params.push([]);
      else params[params.length - 1].push(t[k]);
    }
    for (const param of params) {
      let p = 0;
      if (param[p]?.v === 'const') p++;
      if (param[p]?.v === 'std' && param[p + 1]?.v === '::') p += 2;
      const type = param[p]?.v;
      const name = param[param.length - 1];
      if ((type !== 'vector' && type !== 'string') || name?.k !== 'id' || param.length - p < 2) continue;
      let depth = 0;
      const byRef = param.some((x) => {
        if (x.v === '<') depth++;
        else if (x.v === '>' || x.v === '>>') depth -= x.v.length;
        return depth <= 0 && (x.v === '&' || x.v === '&&' || x.v === '*');
      });
      if (byRef) continue;
      notes.push(
        note(
          'cpp-copy-in-recursion',
          'actionable',
          tok.line,
          `递归函数 ${tok.v} 按值接收 ${type} 参数 ${name.v}，每次调用都会把整个${type === 'vector' ? '数组' : '字符串'}复制一遍，多出 O(n) 的时间和内存。只读就改成 const ${type}${type === 'vector' ? '<…>' : ''}&；需要修改就传引用，回溯时撤销修改。`,
          `The recursive function ${tok.v} takes the ${type} ${name.v} by value, so every call copies the whole thing: an extra O(n) time and memory per call. Pass const ${type}${type === 'vector' ? '<…>' : ''}& if it is read-only; if you modify it, pass a reference and undo the change when you backtrack.`,
          'backtracking-enumeration',
        ),
      );
      break defs;
    }
  }

  for (let i = 0; i < t.length; i++) {
    const name = t[i].v;
    if (t[i].k !== 'id' || ['.', '->', '::'].includes(t[i - 1]?.v) || !types.only(name, 'string') || !within(loops, i)) continue;
    if (t[i + 1]?.v === '=' && t[i + 2]?.v === name && t[i + 3]?.v === '+') {
      notes.push(
        note(
          'cpp-string-concat',
          'actionable',
          t[i].line,
          `${name} = ${name} + … 每次都会先构造一个新字符串再整体赋值回去，循环里累计 O(n²)。改成 ${name} += …，追加是均摊 O(1)。`,
          `${name} = ${name} + … builds a brand-new string and copies it back every time, O(n²) across the loop. Write ${name} += … instead: appending is amortized O(1).`,
          'string-processing',
        ),
      );
      break;
    }
  }
  return notes;
}

function go(t: Token[]): AnalyzerNote[] {
  const pair = pairs(t);
  const loops = braceLoops(t, pair, true);
  // A string, an empty slice with no capacity ([]T{} or make([]T, 0)), or anything else.
  const rhs = (r: number) => {
    const a = t[r];
    if (a?.k === 'str' && (t[r + 1]?.line !== a.line || t[r + 1]?.v === ';')) return 'str';
    if (a?.v === '[' && t[r + 1]?.v === ']') {
      let k = r + 2;
      while (k < t.length && t[k].v !== '{' && t[k].line === a.line) k++;
      return t[k]?.v === '{' && t[k + 1]?.v === '}' ? 'empty-slice' : 'other';
    }
    if (a?.v === 'make' && t[r + 1]?.v === '(' && t[r + 2]?.v === '[' && t[r + 3]?.v === ']') {
      const close = pair[r + 1];
      if (t[close - 1]?.v === '0' && t[close - 2]?.v === ',' && topLevel(t, r + 2, close - 2, ',') < 0) return 'empty-slice';
    }
    return 'other';
  };
  const names = new Bindings();
  const declaredAt = new Map<string, number>();
  t.forEach((tok, i) => {
    if (tok.k !== 'id' || t[i - 1]?.v === '.') return;
    const prev = t[i - 1]?.v ?? '';
    const next = t[i + 1]?.v ?? '';
    const multi = prev === ',' || next === ',';
    let kind = '';
    if (prev === 'var') {
      if (next === 'string') kind = 'str';
      else if (next === '=') kind = rhs(i + 2);
      else if (next === '[' && t[i + 2]?.v === ']' && !t.slice(i, i + 12).some((x) => x.v === '=' && x.line === tok.line)) kind = 'empty-slice';
      else kind = 'other';
    } else if (next === ':=') kind = multi ? 'other' : rhs(i + 2);
    else if (multi && t.slice(i, i + 12).some((x) => x.v === ':=' && x.line === tok.line)) kind = 'other';
    else if ((prev === '(' || prev === ',') && next === 'string' && [',', ')'].includes(t[i + 2]?.v ?? '')) kind = 'str';
    if (!kind) return;
    names.add(tok.v, kind);
    if (!declaredAt.has(tok.v)) declaredAt.set(tok.v, i);
  });
  const notes: AnalyzerNote[] = [];

  for (let i = 0; i < t.length; i++) {
    const name = t[i].v;
    if (t[i].k !== 'id' || t[i - 1]?.v === '.' || !names.only(name, 'str') || !within(loops, i)) continue;
    if (t[i + 1]?.v === '+=' || (t[i + 1]?.v === '=' && t[i + 2]?.v === name && t[i + 3]?.v === '+')) {
      notes.push(
        note(
          'go-string-concat',
          'actionable',
          t[i].line,
          `Go 的字符串不可变，循环里给 ${name} 拼接每次都会复制已有内容，总共 O(n²)。改用 strings.Builder（WriteString / WriteByte），最后 String()。`,
          `Go strings are immutable: each concatenation onto ${name} in the loop copies what is already there, O(n²) in total. Use a strings.Builder (WriteString / WriteByte) and call String() at the end.`,
          'string-processing',
        ),
      );
      break;
    }
  }

  // A counted or range loop appending once per pass to a slice that started empty.
  prealloc: for (const loop of loops) {
    const header = t.slice(loop.head + 1, loop.s);
    const counted = header.some((x) => x.v === 'range') || header.filter((x) => x.v === ';').length === 2;
    if (!counted || t.slice(loop.s, loop.e).some((x) => ['break', 'continue', 'return', 'goto'].includes(x.v))) continue;
    let depth = 0;
    for (let k = loop.s + 1; k < loop.e - 1; k++) {
      if (t[k].v === '{') depth++;
      else if (t[k].v === '}') depth--;
      const name = t[k].v;
      if (depth !== 0 || t[k].k !== 'id' || t[k - 1]?.v === '.' || t[k + 1]?.v !== '=' || t[k + 2]?.v !== 'append') continue;
      if (t[k + 3]?.v !== '(' || t[k + 4]?.v !== name || t[k + 5]?.v !== ',') continue;
      const close = pair[k + 3];
      if (close < 0 || t[close - 1]?.v === '.') continue; // append(s, more...) adds an unknown count
      if (!names.only(name, 'empty-slice') || (declaredAt.get(name) ?? Infinity) > loop.head) continue;
      notes.push(
        note(
          'go-append-prealloc',
          'informative',
          t[k].line,
          `循环次数事先就知道，${name} 却从空切片开始 append，中途会多次扩容和复制。可以先 make([]T, 0, n) 预留容量（n 是循环次数），或者直接 make([]T, n) 按下标写。`,
          `The loop count is known up front, yet ${name} starts empty and grows by append, reallocating and copying along the way. Reserve the capacity with make([]T, 0, n) (n being the loop count), or make([]T, n) and assign by index.`,
        ),
      );
      break prealloc;
    }
  }
  return notes;
}

const ANALYZERS: Record<AnalyzerLanguage, (t: Token[]) => AnalyzerNote[]> = { python, java, cpp, go };

/** Notes on a solution, at most one per rule, in line order; [] for SQL/pandas or oversized code. */
export function analyze(code: string, language: string): AnalyzerNote[] {
  if (!isAnalyzerLanguage(language) || code.length > MAX_CODE) return [];
  return ANALYZERS[language](tokenize(code, language)).sort((a, b) => a.line - b.line);
}

// ------------------------------------------------------------------ follow-up mode

const RULES = followUps as Record<string, FollowUpRule>;

/** The follow-up restriction for this problem in this language, if it has one. */
export function followUpRule(problemId: string, language: string): FollowUpRule | undefined {
  const rule = Object.hasOwn(RULES, problemId) ? RULES[problemId] : undefined;
  return rule && isAnalyzerLanguage(language) && rule.banned[language]?.length ? rule : undefined;
}

/** True when the code itself declares the name (def sort, int sum = 0, func merge(...)). */
function defines(t: Token[], name: string) {
  return t.some((tok, i) => {
    if (tok.v !== name) return false;
    const prev = t[i - 1];
    const next = t[i + 1]?.v ?? '';
    if (prev && ['def', 'func', 'class', 'struct', 'var', 'const'].includes(prev.v)) return true;
    if ((next === '=' || next === ':=') && prev?.v !== '.') return true;
    return prev?.k === 'id' && !NOT_TYPE.has(prev.v) && [';', ',', ')', '=', '(', '{'].includes(next);
  });
}

/** The first banned construct in the code: what it is (as the rule spells it) and its line. */
export function banned(code: string, language: string, rule: FollowUpRule): { token: string; line: number } | null {
  if (!isAnalyzerLanguage(language) || code.length > MAX_CODE) return null;
  const t = tokenize(code, language);
  let first: { token: string; line: number; at: number } | null = null;
  for (const entry of rule.banned[language] ?? []) {
    const want = tokenize(entry, language).map((x) => x.v);
    if (!want.length || (want.length === 1 && /^\w+$/.test(want[0]) && defines(t, want[0]))) continue;
    for (let i = 0; i + want.length <= t.length && (!first || i < first.at); i++)
      if (want.every((v, k) => t[i + k].v === v)) {
        first = { token: entry, line: t[i].line, at: i };
        break;
      }
  }
  return first && { token: first.token, line: first.line };
}
