/** Fixed validators for problems whose correct answer is not unique. */
export const SEMANTIC_IDS = [
  5, 1044, 1092, 1249, 767, 1405, 162, 324, 870, 368, 210, 269, 373, 2392, 701,
  108, 450, 109, 1171, 708, 652,
] as const;
export type SemanticId = (typeof SEMANTIC_IDS)[number];

function integers(output: string): number[] | null {
  const parts = output.trim().split(/\s+/);
  if (!/^(0|[1-9][0-9]*)$/.test(parts[0] || '')) return null;
  const n = Number(parts[0]);
  if (n > 100000 || parts.length !== n + 1) return null;
  const values = parts
    .slice(1)
    .map((v) => (/^[+-]?[0-9]+$/.test(v) ? Number(v) : NaN));
  return values.every(Number.isSafeInteger) ? values : null;
}
function rows(output: string): number[][] | null {
  const parts = output.trim().split(/\s+/);
  let index = 0;
  const next = () => {
    const v = parts[index++];
    return /^[+-]?[0-9]+$/.test(v || '') ? Number(v) : NaN;
  };
  const n = next();
  if (!Number.isInteger(n) || n < 0 || n > 10000) return null;
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const size = next();
    if (
      !Number.isInteger(size) ||
      size < 0 ||
      size > 100000 ||
      index + size > parts.length
    )
      return null;
    const row = [];
    for (let j = 0; j < size; j++) {
      const value = next();
      if (!Number.isSafeInteger(value)) return null;
      row.push(value);
    }
    result.push(row);
  }
  return index === parts.length ? result : null;
}
function line(output: string): string | null {
  const normalized = output.replace(/\r\n/g, '\n');
  return normalized.endsWith('\n') &&
    !['\r', '\n', '\0'].some((c) => normalized.slice(0, -1).includes(c))
    ? normalized.slice(0, -1)
    : null;
}
function sameBag(
  a: readonly (number | string)[],
  b: readonly (number | string)[],
): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<number | string, number>();
  for (const x of a) counts.set(x, (counts.get(x) || 0) + 1);
  for (const x of b) {
    const n = counts.get(x) || 0;
    if (!n) return false;
    counts.set(x, n - 1);
  }
  return true;
}
function subsequence(a: string, b: string): boolean {
  let i = 0;
  for (const c of b) if (c === a[i]) i++;
  return i === a.length;
}
type Node = { v: number; l: Node | null; r: Node | null };
function tree(values: unknown): Node | null | false {
  if (
    !Array.isArray(values) ||
    values.length > 200001 ||
    values.some((v) => v !== null && !Number.isSafeInteger(v))
  )
    return false;
  if (!values.length) return null;
  if (values[0] === null || values.at(-1) === null) return false;
  const root: Node = { v: values[0] as number, l: null, r: null };
  const queue = [root];
  let head = 0,
    index = 1;
  while (index < values.length) {
    const parent = queue[head++];
    if (!parent) return false;
    for (const side of ['l', 'r'] as const) {
      if (index === values.length) break;
      const v = values[index++];
      if (v !== null) {
        const child: Node = { v, l: null, r: null };
        parent[side] = child;
        queue.push(child);
      }
    }
  }
  return root;
}
function treeOutput(output: string): Node | null | false {
  const parts = output.trim().split(/\s+/);
  if (
    !/^(0|[1-9][0-9]*)$/.test(parts[0] || '') ||
    parts.length !== Number(parts[0]) + 1
  )
    return false;
  return tree(
    parts
      .slice(1)
      .map((v) =>
        v === 'null' ? null : /^[+-]?[0-9]+$/.test(v) ? Number(v) : NaN,
      ),
  );
}
function inorder(root: Node | null): number[] {
  const out: number[] = [];
  const stack: Node[] = [];
  let node = root;
  while (node || stack.length) {
    while (node) {
      stack.push(node);
      node = node.l;
    }
    node = stack.pop()!;
    out.push(node.v);
    node = node.r;
  }
  return out;
}
function balanced(root: Node | null): boolean {
  if (!root) return true;
  const stack: Array<[Node, boolean]> = [[root, false]],
    height = new Map<Node, number>();
  while (stack.length) {
    const [node, done] = stack.pop()!;
    if (!done) {
      stack.push([node, true]);
      if (node.r) stack.push([node.r, false]);
      if (node.l) stack.push([node.l, false]);
    } else {
      const a = node.l ? height.get(node.l)! : 0,
        b = node.r ? height.get(node.r)! : 0;
      if (Math.abs(a - b) > 1) return false;
      height.set(node, Math.max(a, b) + 1);
    }
  }
  return true;
}

export function matchesSemantic(
  id: SemanticId,
  actual: string,
  expected: string,
  input: string,
): boolean {
  if (actual.length > 4 * 1024 * 1024 || input.length > 4 * 1024 * 1024)
    return false;
  try {
    const args: unknown[] = JSON.parse(input);
    if (!Array.isArray(args)) return false;
    if (id === 708) {
      if (
        args.length !== 2 ||
        !Array.isArray(args[0]) ||
        !args[0].every(Number.isSafeInteger) ||
        !Number.isSafeInteger(args[1])
      )
        return false;
      const original = args[0] as number[],
        value = args[1] as number,
        got = integers(actual);
      if (!got || got.length !== original.length + 1) return false;
      if (!original.length) return got[0] === value;
      if (
        got[0] !== original[0] ||
        got.filter((v, i) => v > got[(i + 1) % got.length]).length > 1
      )
        return false;
      let j = 0,
        skipped = false;
      for (const v of got) {
        if (j < original.length && v === original[j]) j++;
        else if (!skipped && v === value) skipped = true;
        else return false;
      }
      return j === original.length && skipped;
    }
    if (id === 652) {
      if (args.length !== 1) return false;
      const root = tree(args[0]),
        got = integers(actual);
      if (root === false || !got) return false;
      const nodes: Node[] = root ? [root] : [];
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].l) nodes.push(nodes[i].l!);
        if (nodes[i].r) nodes.push(nodes[i].r!);
      }
      const signatures = new Map<string, number>(),
        byNode = new Map<Node, number>(),
        counts = new Map<number, number>();
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i],
          key = JSON.stringify([
            n.v,
            n.l ? byNode.get(n.l) : 0,
            n.r ? byNode.get(n.r) : 0,
          ]);
        if (!signatures.has(key)) signatures.set(key, signatures.size + 1);
        const signature = signatures.get(key)!;
        byNode.set(n, signature);
        counts.set(signature, (counts.get(signature) || 0) + 1);
      }
      const wanted = new Set(
        [...counts]
          .filter(([, count]) => count > 1)
          .map(([signature]) => signature),
      );
      if (
        got.some((i) => i < 0 || i >= nodes.length) ||
        got.length !== wanted.size
      )
        return false;
      return (
        new Set(got.map((i) => byNode.get(nodes[i]))).size === wanted.size &&
        got.every((i) => wanted.has(byNode.get(nodes[i])!))
      );
    }
    if ([5, 1044, 1092, 1249, 767, 1405, 269].includes(id)) {
      const got = line(actual),
        want = line(expected);
      if (got === null || want === null) return false;
      if (id === 5)
        return (
          got.length === want.length &&
          (args[0] as string).includes(got) &&
          got === Array.from(got).reverse().join('')
        );
      if (id === 1044) {
        const s = args[0] as string,
          first = s.indexOf(got);
        return (
          got.length === want.length &&
          (!got.length || (first >= 0 && s.indexOf(got, first + 1) >= 0))
        );
      }
      if (id === 1092)
        return (
          got.length === want.length &&
          subsequence(args[0] as string, got) &&
          subsequence(args[1] as string, got)
        );
      if (id === 1249) {
        if (
          got.length !== want.length ||
          !subsequence(got, args[0] as string) ||
          got.replace(/[()]/g, '') !== (args[0] as string).replace(/[()]/g, '')
        )
          return false;
        let level = 0;
        for (const c of got) {
          if (c === '(') level++;
          if (c === ')' && --level < 0) return false;
        }
        return level === 0;
      }
      if (id === 767)
        return want === ''
          ? got === ''
          : sameBag(Array.from(got), Array.from(args[0] as string)) &&
              !Array.from(got).some((c, i) => i > 0 && c === got[i - 1]);
      if (id === 1405)
        return (
          got.length === want.length &&
          !/[^abc]|aaa|bbb|ccc/.test(got) &&
          ['a', 'b', 'c'].every(
            (c, i) =>
              Array.from(got).filter((x) => x === c).length <=
              (args[i] as number),
          )
        );
      const words = args[0] as string[];
      if (!want.length) return !got.length;
      const letters = [...new Set(words.join(''))];
      if (!sameBag(Array.from(got), letters)) return false;
      const position = new Map(Array.from(got).map((c, i) => [c, i]));
      for (let i = 1; i < words.length; i++) {
        const a = words[i - 1],
          b = words[i];
        let j = 0;
        while (j < a.length && j < b.length && a[j] === b[j]) j++;
        if (j === b.length && j < a.length) return false;
        if (
          j < a.length &&
          j < b.length &&
          position.get(a[j])! >= position.get(b[j])!
        )
          return false;
      }
      return true;
    }
    if (id === 162) {
      const value = actual.trim();
      if (!/^[+-]?[0-9]+$/.test(value)) return false;
      const i = Number(value),
        nums = args[0] as number[];
      return (
        Number.isInteger(i) &&
        i >= 0 &&
        i < nums.length &&
        (i === 0 || nums[i] > nums[i - 1]) &&
        (i === nums.length - 1 || nums[i] > nums[i + 1])
      );
    }
    if ([324, 870, 368, 210, 1171].includes(id)) {
      const got = integers(actual),
        want = integers(expected);
      if (!got || !want) return false;
      if (id === 324)
        return (
          sameBag(got, args[0] as number[]) &&
          got.every(
            (v, i) => i === 0 || (i % 2 ? v > got[i - 1] : v < got[i - 1]),
          )
        );
      if (id === 870) {
        const nums = args[0] as number[],
          other = args[1] as number[];
        return (
          sameBag(got, nums) &&
          got.filter((v, i) => v > other[i]).length ===
            want.filter((v, i) => v > other[i]).length
        );
      }
      if (id === 368) {
        const nums = new Set(args[0] as number[]),
          sorted = Array.from(got).sort((a, b) => a - b);
        return (
          got.length === want.length &&
          new Set(got).size === got.length &&
          got.every((v) => nums.has(v)) &&
          sorted.every((v, i) => i === 0 || v % sorted[i - 1] === 0)
        );
      }
      if (id === 210) {
        const n = args[0] as number;
        if (!want.length) return !got.length;
        if (
          got.length !== n ||
          new Set(got).size !== n ||
          got.some((v) => v < 0 || v >= n)
        )
          return false;
        const pos = new Map(got.map((v, i) => [v, i]));
        return (args[1] as number[][]).every(
          ([a, b]) => pos.get(b)! < pos.get(a)!,
        );
      }
      const nums = args[0] as number[],
        prefix = [0];
      for (const x of nums) prefix.push(prefix.at(-1)! + x);
      let sum = 0;
      const seen = new Set([0]);
      for (const x of got) {
        sum += x;
        if (seen.has(sum)) return false;
        seen.add(sum);
      }
      if (sum !== prefix.at(-1)) return false;
      let previous = new Set([0]);
      for (const x of got) {
        const allowed = new Set<number>(),
          next = new Set<number>();
        for (let j = 0; j < nums.length; j++) {
          if (previous.has(j)) allowed.add(prefix[j]);
          if (nums[j] === x && allowed.has(prefix[j])) next.add(j + 1);
        }
        previous = next;
        if (!previous.size) return false;
      }
      return [...previous].some((p) => prefix[p] === prefix.at(-1));
    }
    if (id === 373) {
      const got = rows(actual),
        want = rows(expected);
      if (
        !got ||
        !want ||
        got.length !== want.length ||
        got.some((row) => row.length !== 2)
      )
        return false;
      const a = new Map<number, number>(),
        b = new Map<number, number>(),
        seen = new Map<string, number>();
      for (const x of args[0] as number[]) a.set(x, (a.get(x) || 0) + 1);
      for (const x of args[1] as number[]) b.set(x, (b.get(x) || 0) + 1);
      for (const [x, y] of got) {
        const key = JSON.stringify([x, y]),
          n = (seen.get(key) || 0) + 1;
        if (n > (a.get(x) || 0) * (b.get(y) || 0)) return false;
        seen.set(key, n);
      }
      return sameBag(
        got.map(([x, y]) => x + y),
        want.map(([x, y]) => x + y),
      );
    }
    if (id === 2392) {
      const got = rows(actual),
        want = rows(expected);
      if (!got || !want) return false;
      if (!want.length) return !got.length;
      const k = args[0] as number;
      if (got.length !== k || got.some((row) => row.length !== k)) return false;
      const positions = new Map<number, [number, number]>();
      for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++) {
          const v = got[i][j];
          if (v < 0 || v > k || (v && positions.has(v))) return false;
          if (v) positions.set(v, [i, j]);
        }
      if (positions.size !== k) return false;
      return [1, 2].every((arg, axis) =>
        (args[arg] as number[][]).every(
          ([a, b]) => positions.get(a)![axis] < positions.get(b)![axis],
        ),
      );
    }
    if ([701, 108, 450, 109].includes(id)) {
      const got = treeOutput(actual);
      if (got === false) return false;
      const values = inorder(got);
      if (
        values.some(
          (v, i) =>
            i > 0 && (id === 109 ? v < values[i - 1] : v <= values[i - 1]),
        )
      )
        return false;
      if (id === 108 || id === 109)
        return sameBag(values, args[0] as number[]) && balanced(got);
      const original = tree(args[0]);
      if (original === false) return false;
      const required = inorder(original);
      if (id === 701) required.push(args[1] as number);
      else {
        const index = required.indexOf(args[1] as number);
        if (index >= 0) required.splice(index, 1);
      }
      return sameBag(values, required);
    }
    return false;
  } catch {
    return false;
  }
}
