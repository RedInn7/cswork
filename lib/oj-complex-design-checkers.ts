/** Fixed stateful judges for mixed JSON design results. No submitted code runs here. */
export const COMPLEX_DESIGN_IDS = [
  173, 1472, 981, 2353, 295, 588, 432, 380, 381, 297, 449,
] as const;
const classes: Record<number, string> = {
  173: 'BSTIterator',
  1472: 'BrowserHistory',
  981: 'TimeMap',
  2353: 'FoodRatings',
  295: 'MedianFinder',
  588: 'FileSystem',
  432: 'AllOne',
  380: 'RandomizedSet',
  381: 'RandomizedCollection',
  297: 'Codec',
  449: 'Codec',
};
const methods: Record<number, string[]> = {
  173: ['next', 'hasNext'],
  1472: ['visit', 'back', 'forward'],
  981: ['set', 'get'],
  2353: ['changeRating', 'highestRated'],
  295: ['addNum', 'findMedian'],
  588: ['ls', 'mkdir', 'addContentToFile', 'readContentFromFile'],
  432: ['inc', 'dec', 'getMaxKey', 'getMinKey'],
  380: ['insert', 'remove', 'getRandom'],
  381: ['insert', 'remove', 'getRandom'],
  297: ['roundTrip'],
  449: ['roundTrip'],
};
type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };
function array(v: JSONValue): JSONValue[] {
  if (!Array.isArray(v)) throw Error('array');
  return v;
}
function number(v: JSONValue): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw Error('integer');
  return v;
}
function string(v: JSONValue): string {
  if (typeof v !== 'string') throw Error('string');
  return v;
}
function equal(a: JSONValue, b: JSONValue): boolean {
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => equal(v, b[i]))
    );
  return a === b;
}
class Heap<T> {
  data: T[] = [];
  constructor(private less: (a: T, b: T) => boolean) {}
  get size() {
    return this.data.length;
  }
  peek() {
    if (!this.data.length) throw Error('empty heap');
    return this.data[0];
  }
  push(value: T) {
    const a = this.data;
    a.push(value);
    let i = a.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.data;
    const first = this.peek();
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        let j = i;
        const l = 2 * i + 1,
          r = l + 1;
        if (l < a.length && this.less(a[l], a[j])) j = l;
        if (r < a.length && this.less(a[r], a[j])) j = r;
        if (j === i) break;
        [a[i], a[j]] = [a[j], a[i]];
        i = j;
      }
    }
    return first;
  }
}
function inorder(tokens: JSONValue[]): number[] {
  if (!tokens.length) return [];
  const nodes: Array<[number, number, number]> = [[number(tokens[0]), -1, -1]];
  let head = 0,
    i = 1;
  while (i < tokens.length) {
    if (head >= nodes.length) throw Error('tree');
    for (const side of [1, 2] as const) {
      if (i === tokens.length) break;
      const v = tokens[i++];
      if (v !== null) {
        nodes[head][side] = nodes.length;
        nodes.push([number(v), -1, -1]);
      }
    }
    head++;
  }
  const out: number[] = [],
    stack: number[] = [];
  let u = 0;
  while (stack.length || u >= 0) {
    while (u >= 0) {
      stack.push(u);
      u = nodes[u][1];
    }
    u = stack.pop()!;
    out.push(nodes[u][0]);
    u = nodes[u][2];
  }
  return out;
}
export function matchesComplexDesign(
  id: number,
  actualText: string,
  _expectedText: string,
  inputText: string,
): boolean {
  try {
    if (
      !Number.isInteger(id) ||
      !classes[id] ||
      actualText.length > 64 * 1024 * 1024 ||
      inputText.length > 64 * 1024 * 1024
    )
      return false;
    const input = array(JSON.parse(inputText) as JSONValue),
      actual = array(JSON.parse(actualText) as JSONValue);
    if (input.length !== 2) return false;
    const ops = array(input[0]).map(string),
      params = array(input[1]).map(array);
    if (
      !ops.length ||
      ops.length > 200001 ||
      ops.length !== params.length ||
      actual.length !== ops.length ||
      ops[0] !== classes[id] ||
      actual[0] !== null
    )
      return false;
    const ctor = params[0];
    const seq = id === 173 ? inorder(array(ctor[0])) : [];
    let index = 0,
      cursor = 0;
    let history = id === 1472 ? [string(ctor[0])] : [];
    const versions = new Map<string, Array<[number, string]>>();
    const foods = new Map<string, [string, number]>();
    const pairLess = (a: [number, string], b: [number, string]) =>
      a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
    const cuisineHeaps = new Map<string, Heap<[number, string]>>();
    if (id === 2353) {
      const fs = array(ctor[0]).map(string),
        cs = array(ctor[1]).map(string),
        rs = array(ctor[2]).map(number);
      for (let i = 0; i < fs.length; i++) {
        foods.set(fs[i], [cs[i], rs[i]]);
        if (!cuisineHeaps.has(cs[i]))
          cuisineHeaps.set(cs[i], new Heap(pairLess));
        cuisineHeaps.get(cs[i])!.push([-rs[i], fs[i]]);
      }
    }
    const lower = new Heap<number>((a, b) => a > b),
      upper = new Heap<number>((a, b) => a < b);
    const dirs = new Map<string, Set<string>>([['/', new Set()]]),
      files = new Map<string, string>();
    const counts = new Map<string | number, number>();
    const minheap = new Heap<[number, string]>(pairLess),
      maxheap = new Heap<[number, string]>(pairLess);
    // A conservative sampling-error bound, not a proof of mathematical randomness.
    const randomSamples = new Map<number, number>();
    let randomN = 0;
    const flushRandom = (): boolean => {
      if (randomN >= 2000) {
        const m = counts.size,
          total = [...counts.values()].reduce((a, b) => a + b, 0);
        if (!total) return false;
        const threshold = Math.sqrt((randomN * Math.log((2 * m) / 1e-15)) / 2);
        for (const [value, weight] of counts)
          if (
            Math.abs(
              (randomSamples.get(value as number) || 0) -
                (randomN * weight) / total,
            ) > threshold
          )
            return false;
      }
      randomSamples.clear();
      randomN = 0;
      return true;
    };
    for (let step = 1; step < ops.length; step++) {
      const op = ops[step],
        p = params[step],
        got = actual[step];
      if (!methods[id].includes(op)) return false;
      let result: JSONValue = null;
      let special: ((value: JSONValue) => boolean) | undefined;
      if (id === 173) {
        if (op === 'next') {
          if (index >= seq.length) return false;
          result = seq[index++];
        } else result = Number(index < seq.length);
      } else if (id === 1472) {
        if (op === 'visit') {
          history = history.slice(0, cursor + 1);
          history.push(string(p[0]));
          cursor++;
        } else {
          cursor =
            op === 'back'
              ? Math.max(0, cursor - number(p[0]))
              : Math.min(history.length - 1, cursor + number(p[0]));
          result = history[cursor];
        }
      } else if (id === 981) {
        const key = string(p[0]);
        if (op === 'set') {
          const records = versions.get(key) || [];
          records.push([number(p[2]), string(p[1])]);
          versions.set(key, records);
        } else {
          const records = versions.get(key) || [];
          let l = 0,
            r = records.length;
          const t = number(p[1]);
          while (l < r) {
            const m = (l + r) >> 1;
            if (records[m][0] <= t) l = m + 1;
            else r = m;
          }
          result = l ? records[l - 1][1] : '';
        }
      } else if (id === 2353) {
        const key = string(p[0]);
        if (op === 'changeRating') {
          const cuisine = foods.get(key)![0],
            rating = number(p[1]);
          foods.set(key, [cuisine, rating]);
          cuisineHeaps.get(cuisine)!.push([-rating, key]);
        } else {
          const heap = cuisineHeaps.get(key)!;
          while (-heap.peek()[0] !== foods.get(heap.peek()[1])![1]) heap.pop();
          result = heap.peek()[1];
        }
      } else if (id === 295) {
        if (op === 'addNum') {
          const v = number(p[0]);
          if (!lower.size || v <= lower.peek()) lower.push(v);
          else upper.push(v);
          if (lower.size > upper.size + 1) upper.push(lower.pop());
          if (upper.size > lower.size) lower.push(upper.pop());
        } else {
          const median =
            lower.size > upper.size
              ? lower.peek()
              : (lower.peek() + upper.peek()) / 2;
          result = median;
          special = (v) =>
            typeof v === 'number' &&
            Number.isFinite(v) &&
            Math.abs(v - median) <= 1e-5;
        }
      } else if (id === 588) {
        const path = string(p[0]);
        if (op === 'mkdir') {
          let current = '';
          for (const name of path.split('/').slice(1).filter(Boolean)) {
            const parent = current || '/';
            current += '/' + name;
            dirs.get(parent)!.add(name);
            if (!dirs.has(current)) dirs.set(current, new Set());
          }
        } else if (op === 'addContentToFile') {
          const pos = path.lastIndexOf('/'),
            parent = path.slice(0, pos) || '/',
            name = path.slice(pos + 1);
          dirs.get(parent)!.add(name);
          files.set(path, (files.get(path) || '') + string(p[1]));
        } else if (op === 'readContentFromFile') {
          if (!files.has(path)) return false;
          result = files.get(path)!;
        } else
          result = files.has(path)
            ? [path.slice(path.lastIndexOf('/') + 1)]
            : [...dirs.get(path)!].sort();
      } else if (id === 432) {
        if (op === 'inc' || op === 'dec') {
          const key = string(p[0]),
            value = (counts.get(key) || 0) + (op === 'inc' ? 1 : -1);
          if (value) {
            counts.set(key, value);
            minheap.push([value, key]);
            maxheap.push([-value, key]);
          } else counts.delete(key);
        } else {
          const heap = op === 'getMinKey' ? minheap : maxheap,
            sign = op === 'getMinKey' ? 1 : -1;
          while (
            heap.size &&
            (counts.get(heap.peek()[1]) || 0) !== sign * heap.peek()[0]
          )
            heap.pop();
          const key = heap.size ? heap.peek()[1] : '',
            wanted = counts.get(key) || 0;
          result = key;
          special = (v) =>
            typeof v === 'string' &&
            (counts.size ? counts.get(v) === wanted : v === '');
        }
      } else if (id === 380 || id === 381) {
        if (op !== 'getRandom' && !flushRandom()) return false;
        if (op === 'insert') {
          const key = number(p[0]),
            old = counts.get(key) || 0;
          result = Number(!old);
          counts.set(key, id === 381 ? old + 1 : 1);
        } else if (op === 'remove') {
          const key = number(p[0]),
            old = counts.get(key) || 0;
          result = Number(old > 0);
          if (old > 1) counts.set(key, old - 1);
          else counts.delete(key);
        } else {
          if (!counts.size) return false;
          special = (v) =>
            typeof v === 'number' &&
            Number.isSafeInteger(v) &&
            (counts.get(v) || 0) > 0;
        }
      } else if (id === 297 || id === 449) result = p[0];
      if (!(special ? special(got) : equal(got, result))) return false;
      if ((id === 380 || id === 381) && op === 'getRandom') {
        const value = got as number;
        randomSamples.set(value, (randomSamples.get(value) || 0) + 1);
        randomN++;
      }
    }
    return flushRandom();
  } catch {
    return false;
  }
}
