/**
 * A LeetCode custom case is stored as it always was: one JSON value per line, in parameter
 * order. The workspace edits it as one field per parameter; these convert between the two.
 */

/** The case's lines as n fields; null when the line count doesn't match (edit it as raw text). */
export function splitFields(raw: string, n: number): string[] | null {
  // A new case is blank: n empty fields.
  if (!raw) return Array.from({ length: n }, () => '');
  const lines = raw.split(/\r?\n/);
  // A trailing newline (a pasted example) is not one more field.
  if (lines.length === n + 1 && lines[n] === '') lines.pop();
  return lines.length === n ? lines : null;
}

export const joinFields = (fields: string[]) => fields.join('\n');

/** 0-based lines where two outputs differ, ignoring trailing spaces and trailing blank lines. */
export function diffLines(actual: string, expected: string) {
  const lines = (text: string) =>
    text
      .replace(/\s+$/, '')
      .split('\n')
      .map((line) => line.trimEnd());
  const a = lines(actual);
  const b = lines(expected);
  const differ = new Set<number>();
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) differ.add(i);
  return differ;
}

/** A field's JSON value; undefined when it doesn't parse. */
export function fieldValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** [Chinese, English]: lib code stays locale-free; the UI picks one with t(...). */
export type Message = [zh: string, en: string];
/** A parameter's [min, max] bounds read off the statement (lib/content/leetcode-constraints.json). */
export type Constraint = { len?: number[]; val?: number[] };

/**
 * The judge's level-order tree, after custom_args (scripts/leetcode-mode/runtime.py) drops
 * trailing nulls: [] is the empty tree, then tree_codec.py's rules. Nodes in level order,
 * children by index (-1 none); a string names the broken rule.
 */
export function levelOrderTree(tokens: unknown[]) {
  const values = tokens.slice();
  while (values.length && values.at(-1) === null) values.pop();
  type TreeNode = { val: number; left: number; right: number };
  const nodes: TreeNode[] = [];
  if (!values.length) return nodes;
  if (values[0] === null) return 'root';
  if (values.some((v) => v !== null && !int32(v))) return 'value';
  nodes.push({ val: values[0] as number, left: -1, right: -1 });
  for (let i = 1, head = 0; i < values.length; head++) {
    if (head === nodes.length) return 'unreachable';
    for (const side of ['left', 'right'] as const) {
      if (i === values.length) break;
      const value = values[i++];
      if (value === null) continue;
      nodes[head][side] = nodes.length;
      nodes.push({ val: value as number, left: -1, right: -1 });
    }
  }
  return nodes;
}

const int32 = (v: unknown) => Number.isInteger(v) && (v as number) >= -(2 ** 31) && (v as number) < 2 ** 31;
const SCALARS: Record<string, (v: unknown) => boolean> = {
  integer: int32,
  long: (v) => Number.isInteger(v) && Math.abs(v as number) <= 2 ** 63,
  double: (v) => typeof v === 'number',
  boolean: (v) => typeof v === 'boolean',
  string: (v) => typeof v === 'string',
  character: (v) => typeof v === 'string' && [...v].length === 1,
  ListNode: (v) => Array.isArray(v) && v.every(int32),
};
/** list<T> and T[] are one shape; leetcode-contracts.json spells string both ways. */
const element = (type: string) =>
  /^list<(.+)>$/.exec(type)?.[1] ?? /^(.+)\[\]$/.exec(type)?.[1];
const base = (type: string): string => {
  const inner = element(type);
  return inner ? base(inner) : type;
};
function fits(value: unknown, type: string): boolean | null {
  if (type === 'TreeNode') return Array.isArray(value) && Array.isArray(levelOrderTree(value));
  const inner = element(type);
  if (inner) {
    if (!Array.isArray(value)) return false;
    for (const item of value) {
      const ok = fits(item, inner);
      if (ok !== true) return ok;
    }
    return true;
  }
  return SCALARS[type]?.(value) ?? null;
}

/**
 * One custom-case line against its parameter type, as the judge decodes it: Python's
 * json.loads, then the tree/list codecs. Types it doesn't know pass; a broken field still runs.
 */
export function checkField(text: string, rawType: string): { ok: true } | { ok: false; message: Message } {
  const type = rawType.replace(/String/g, 'string');
  if (!text.trim()) return { ok: false, message: ['缺少这个参数', 'This argument is missing'] };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, message: ['不是合法的 JSON', 'Not valid JSON'] };
  }
  const known = fits(value, type);
  if (known !== false) {
    // JSON.parse reads 1.0 as 1; Python keeps a float, which int fields and trees refuse.
    const integral = ['integer', 'long', 'TreeNode', 'ListNode'].includes(base(type));
    if (!(known && integral && /\d[.eE]/.test(text.replace(/"(?:\\.|[^"\\])*"/g, '""')))) return { ok: true };
  }
  if (type === 'TreeNode' && Array.isArray(value)) {
    const broken = levelOrderTree(value);
    if (broken === 'root') return { ok: false, message: ['层序数组的第一个值（根）不能是 null', "A level order can't start with a null root"] };
    if (broken === 'unreachable')
      return { ok: false, message: ['有值接不到任何父节点上：null 节点没有子节点', 'Some values have no parent: a null node has no children'] };
    return { ok: false, message: ['树的节点值只能是 32 位整数或 null', 'Tree values must be 32-bit integers or null'] };
  }
  return { ok: false, message: [`应为 ${rawType} 类型的值`, `Expected a value of type ${rawType}`] };
}

/**
 * The first constraint each field breaks, index for index; null where it holds or the field
 * doesn't parse (checkField reports that). Trees and lists count nodes, strings code points.
 */
export function checkConstraints(
  fields: string[],
  params: { name: string; type: string }[],
  constraints: Record<string, Constraint>,
): (Message | null)[] {
  return params.map(({ name, type }, i) => {
    const c = constraints[name];
    const value = c && fieldValue(fields[i] ?? '');
    if (!c || value === undefined) return null;
    const nodes = type === 'TreeNode' || type === 'ListNode';
    const out = (what: Message, actual: number, [lo, hi]: number[]): Message | null =>
      actual > hi
        ? [`超出题目约束：${name} ${what[0]} ${actual} > ${hi}`, `Outside the problem's constraints: ${name} ${what[1]} ${actual} > ${hi}`]
        : actual < lo
          ? [`超出题目约束：${name} ${what[0]} ${actual} < ${lo}`, `Outside the problem's constraints: ${name} ${what[1]} ${actual} < ${lo}`]
          : null;
    if (c.len && (Array.isArray(value) || typeof value === 'string')) {
      const size = typeof value === 'string' ? [...value].length : nodes ? value.filter((v) => v !== null).length : value.length;
      const broken = out(nodes ? ['节点数', 'node count'] : ['长度', 'length'], size, c.len);
      if (broken) return broken;
    }
    if (c.val)
      for (const v of [value].flat(Infinity))
        if (typeof v === 'number') {
          const broken = out(['的值', 'value'], v, c.val);
          if (broken) return broken;
        }
    return null;
  });
}
