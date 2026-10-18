// Eight sorts as step-by-step demos. Type imports only: lib/algorithm-demo.ts imports this file at
// runtime, so a value import back would be a cycle.
import type { DemoCell, DemoFrame, DemoState, DemoTrace, Tr } from './algorithm-demo';

export type SortAlgo = 'bubble' | 'selection' | 'insertion' | 'quick' | 'merge' | 'heap' | 'counting' | 'radix';
export const SORT_ALGOS: SortAlgo[] = ['bubble', 'selection', 'insertion', 'quick', 'merge', 'heap', 'counting', 'radix'];
/** Duplicate keys on which selection, quick and heap sort all reorder equal values (tests check it). */
export const SORT_DEFAULT = [2, 3, 1, 2, 3, 1];

/** A value and the index it started at: equal values keep their #i, so a reordering shows. */
type Item = { v: number; i: number };

export function sortTrace(algo: SortAlgo, values: number[], t: Tr): DemoTrace {
  let a: Item[] = values.map((v, i) => ({ v, i }));
  const n = a.length,
    frames: DemoFrame[] = [],
    settled = new Set<number>(),
    // Counting and radix sort write into a second row; the comparison sorts work in place.
    rows = algo === 'counting' || algo === 'radix' ? 2 : 1;
  let out: (Item | null)[] = Array(n).fill(null),
    queue: string[] | undefined,
    compares = 0,
    writes = 0;
  const cell = (x: Item | null, state?: DemoState): DemoCell =>
    x ? { value: x.v, label: `#${x.i}`, state } : { value: '·', label: '', state: 'muted' };
  const name = (x: Item) => `${x.v} (#${x.i})`;
  const swap = (x: number, y: number) => {
    [a[x], a[y]] = [a[y], a[x]];
    writes++;
  };
  const isStable = () => a.every((x, k) => !k || a[k - 1].v !== x.v || a[k - 1].i < x.i);
  const frame = (caption: string, hot: number[] = [], outHot: number[] = [], done = false) => {
    frames.push({
      caption,
      done,
      cells: [
        ...a.map((x, k) => cell(x, hot.includes(k) ? 'active' : done ? 'answer' : settled.has(k) ? 'visited' : undefined)),
        ...(rows === 2 ? out.map((x, k) => cell(x, outHot.includes(k) ? 'active' : 'visited')) : []),
      ],
      stats: [
        [t('比较', 'Comparisons'), String(compares)],
        [t('交换/写入', 'Swaps/writes'), String(writes)],
        ...(done ? [[t('稳定', 'Stable'), isStable() ? t('是', 'yes') : t('否', 'no')] as [string, string]] : []),
      ],
      queue,
    });
  };
  frame(
    rows === 2
      ? t(
          '上一行是输入，下一行是输出。小字 #i 是每个数原来的下标，相同的数能看出先后有没有变。',
          'Top row: the input. Bottom row: the output. The small #i is each number’s starting index, so you can see whether equal values swap order.',
        )
      : t(
          '小字 #i 是每个数原来的下标：排完后，相同的数如果 #i 不再从小到大，这个排序就不稳定。',
          'The small #i is each number’s starting index: if equal values end with their #i out of order, the sort is not stable.',
        ),
  );
  if (algo === 'bubble')
    for (let end = n - 1; end > 0; end--) {
      let swapped = false;
      for (let j = 0; j < end; j++) {
        compares++;
        if (a[j].v > a[j + 1].v) {
          swap(j, j + 1);
          swapped = true;
          frame(
            t(`${a[j + 1].v} > ${a[j].v}：左边大，交换。`, `${a[j + 1].v} > ${a[j].v}: the left one is bigger, swap.`),
            [j, j + 1],
          );
        } else
          frame(
            t(`${a[j].v} ≤ ${a[j + 1].v}：不交换，相等的数也不动。`, `${a[j].v} ≤ ${a[j + 1].v}: no swap; equal values stay put.`),
            [j, j + 1],
          );
      }
      if (!swapped) {
        for (let k = 0; k <= end; k++) settled.add(k);
        frame(t('这一趟一次都没交换，说明已经有序，提前结束。', 'Not one swap in this pass: the array is sorted, stop early.'));
        break;
      }
      settled.add(end);
      if (end === 1) settled.add(0);
      frame(
        t(`这一趟把最大的 ${a[end].v} 冒到了位置 ${end}。`, `This pass bubbled the largest, ${a[end].v}, up to position ${end}.`),
      );
    }
  else if (algo === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      for (let j = i + 1; j < n; j++) {
        compares++;
        if (a[j].v < a[m].v) m = j;
        frame(
          t(`在 ${i}..${n - 1} 里找最小：看到下标 ${j}，目前最小是 ${name(a[m])}。`, `Find the minimum of ${i}..${n - 1}: up to index ${j}, the smallest is ${name(a[m])}.`),
          [j, m],
        );
      }
      if (m !== i) {
        const far = a[i];
        swap(i, m);
        frame(
          t(
            `最小的 ${name(a[i])} 和位置 ${i} 的 ${name(far)} 交换。这次远距离交换可能把 ${far.v} 跳到相等的数后面。`,
            `Swap the minimum ${name(a[i])} with ${name(far)} at position ${i}. A long jump like this can carry ${far.v} past an equal value.`,
          ),
          [i, m],
        );
      }
      settled.add(i);
      if (m === i) frame(t(`位置 ${i} 已经是最小的 ${a[i].v}，不用换。`, `Position ${i} already holds the minimum, ${a[i].v}.`));
    }
    settled.add(n - 1);
  } else if (algo === 'insertion') {
    for (let i = 1; i < n; i++) {
      const key = a[i];
      let j = i - 1;
      queue = [name(key)];
      frame(t(`拿起 ${name(key)}，往左找它的位置。`, `Pick up ${name(key)} and look left for its place.`), [i]);
      while (j >= 0) {
        compares++;
        if (a[j].v <= key.v) {
          frame(t(`${a[j].v} ≤ ${key.v}：停下，相等的数不越过。`, `${a[j].v} ≤ ${key.v}: stop; never pass an equal value.`), [j]);
          break;
        }
        a[j + 1] = a[j];
        writes++;
        frame(t(`${a[j].v} > ${key.v}：右移一格。`, `${a[j].v} > ${key.v}: shift it right.`), [j, j + 1]);
        j--;
      }
      if (j + 1 !== i) {
        a[j + 1] = key;
        writes++;
      }
      queue = [];
      frame(t(`把 ${name(key)} 放在位置 ${j + 1}。`, `Put ${name(key)} at position ${j + 1}.`), [j + 1]);
    }
  } else if (algo === 'quick') {
    const sort = (lo: number, hi: number) => {
      if (lo > hi) return;
      if (lo === hi) {
        settled.add(lo);
        return;
      }
      const pivot = a[hi];
      let i = lo;
      frame(
        t(`分区 ${lo}..${hi}：基准取末尾的 ${name(pivot)}，比它小的都换到左边。`, `Partition ${lo}..${hi}: the pivot is the last one, ${name(pivot)}; everything smaller moves left.`),
        [hi],
      );
      for (let j = lo; j < hi; j++) {
        compares++;
        if (a[j].v < pivot.v) {
          if (i !== j) swap(i, j);
          frame(
            i === j
              ? t(`${a[i].v} < ${pivot.v}：已在左边，左区扩到 ${i}。`, `${a[i].v} < ${pivot.v}: already on the left; the left part grows to ${i}.`)
              : t(`${a[i].v} < ${pivot.v}：换到左区末尾 ${i}。`, `${a[i].v} < ${pivot.v}: swap it to the end of the left part, ${i}.`),
            [i, j, hi],
          );
          i++;
        } else frame(t(`${a[j].v} ≥ ${pivot.v}：留在右边。`, `${a[j].v} ≥ ${pivot.v}: it stays on the right.`), [j, hi]);
      }
      if (i !== hi) swap(i, hi);
      settled.add(i);
      frame(
        t(`基准 ${name(pivot)} 换到位置 ${i}，左边都比它小，右边都不比它小。`, `The pivot ${name(pivot)} swaps into position ${i}: smaller on its left, the rest on its right.`),
        [i],
      );
      sort(lo, i - 1);
      sort(i + 1, hi);
    };
    sort(0, n - 1);
  } else if (algo === 'merge') {
    const sort = (lo: number, hi: number) => {
      if (hi - lo < 2) return;
      const mid = (lo + hi) >> 1;
      sort(lo, mid);
      sort(mid, hi);
      const merged: Item[] = [];
      let i = lo,
        j = mid;
      while (i < mid && j < hi) {
        compares++;
        const left = a[i].v <= a[j].v;
        frame(
          left
            ? t(`合并 ${lo}..${mid - 1} 和 ${mid}..${hi - 1}：${a[i].v} ≤ ${a[j].v}，取左边（相等也取左边，所以稳定）。`, `Merge ${lo}..${mid - 1} with ${mid}..${hi - 1}: ${a[i].v} ≤ ${a[j].v}, take the left one (ties go left, which keeps it stable).`)
            : t(`合并 ${lo}..${mid - 1} 和 ${mid}..${hi - 1}：${a[i].v} > ${a[j].v}，取右边。`, `Merge ${lo}..${mid - 1} with ${mid}..${hi - 1}: ${a[i].v} > ${a[j].v}, take the right one.`),
          [i, j],
        );
        merged.push(left ? a[i++] : a[j++]);
        queue = merged.map(name);
      }
      merged.push(...a.slice(i, mid), ...a.slice(j, hi));
      a.splice(lo, merged.length, ...merged);
      writes += merged.length;
      queue = [];
      frame(
        t(`把合并好的 ${merged.length} 个数写回 ${lo}..${hi - 1}。`, `Write the ${merged.length} merged values back to ${lo}..${hi - 1}.`),
        merged.map((_, k) => lo + k),
      );
    };
    sort(0, n);
  } else if (algo === 'heap') {
    const sift = (root: number, size: number) => {
      for (;;) {
        const l = 2 * root + 1,
          r = l + 1;
        let m = root;
        for (const c of [l, r])
          if (c < size) {
            compares++;
            if (a[c].v > a[m].v) m = c;
          }
        if (m === root) return;
        swap(root, m);
        frame(
          t(`下沉：${a[root].v} 是较大的孩子，和父节点 ${a[m].v} 交换。`, `Sift down: ${a[root].v} is the bigger child; swap it with its parent ${a[m].v}.`),
          [root, m],
        );
        root = m;
      }
    };
    for (let k = (n >> 1) - 1; k >= 0; k--) sift(k, n);
    frame(
      t('大顶堆建好了：位置 i 的孩子是 2i+1 和 2i+2，堆顶是最大值。', 'The max-heap is built: position i has children 2i+1 and 2i+2, and the root is the largest.'),
      n ? [0] : [],
    );
    for (let end = n - 1; end > 0; end--) {
      swap(0, end);
      settled.add(end);
      frame(
        t(`堆顶 ${name(a[end])} 换到末尾 ${end}，它跳过了中间所有数。`, `The root ${name(a[end])} swaps to the end, ${end}, jumping over everything between.`),
        [0, end],
      );
      sift(0, end);
    }
    settled.add(0);
  } else if (algo === 'counting') {
    const count = Array<number>(10).fill(0);
    const show = () => (queue = count.map((c, d) => `${d}:${c}`));
    show();
    for (let k = 0; k < n; k++) {
      count[a[k].v]++;
      show();
      frame(t(`数一下：${a[k].v} 出现的次数 +1。`, `Count it: ${a[k].v} seen once more.`), [k]);
    }
    for (let d = 1; d < 10; d++) count[d] += count[d - 1];
    show();
    frame(
      t('做前缀和：count[d] 变成「≤ d 的数有几个」，也就是 d 在输出里最后一个位置 + 1。', 'Prefix sums: count[d] becomes how many values are ≤ d, one past the last output slot for d.'),
    );
    for (let k = n - 1; k >= 0; k--) {
      const at = --count[a[k].v];
      out[at] = a[k];
      writes++;
      show();
      frame(
        t(`从右往左放：${name(a[k])} 放到输出位置 ${at}。从右往左放，相等的数才保持原来的先后。`, `Place right to left: ${name(a[k])} goes to output slot ${at}. Going right to left is what keeps equal values in order.`),
        [k],
        [at],
      );
    }
    a = out as Item[];
    out = Array(n).fill(null);
    queue = undefined;
  } else {
    const passes = a.some((x) => x.v >= 10) ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      const digit = (x: Item) => Math.floor(x.v / 10 ** pass) % 10,
        place = pass ? t('十位', 'tens digit') : t('个位', 'ones digit');
      const buckets: Item[][] = Array.from({ length: 10 }, () => []);
      const show = () => (queue = buckets.flatMap((b, d) => (b.length ? [`${d}: ${b.map((x) => x.v).join(' ')}`] : [])));
      show();
      for (let k = 0; k < n; k++) {
        buckets[digit(a[k])].push(a[k]);
        show();
        frame(t(`${a[k].v} 的${place}是 ${digit(a[k])}，放进 ${digit(a[k])} 号桶的末尾。`, `${a[k].v} has ${digit(a[k])} as its ${place}: append it to bucket ${digit(a[k])}.`), [k]);
      }
      out = buckets.flat();
      writes += n;
      frame(
        t(`按桶号 0 → 9 收集到下一行，桶里先来的在前。这一趟按${place}排好了。`, `Collect buckets 0 → 9 into the bottom row, first in first out within a bucket: sorted by the ${place}.`),
        [],
        out.map((_, k) => k),
      );
      a = out as Item[];
      out = Array(n).fill(null);
    }
    queue = undefined;
  }
  for (let k = 0; k < n; k++) settled.add(k);
  frame(
    isStable()
      ? t(`排好了。相等的数 #i 仍从小到大：在这组输入上是稳定的。`, `Sorted. Equal values still have increasing #i: stable on this input.`)
      : t(`排好了。有相等的数 #i 倒过来了：不稳定。`, `Sorted. Some equal values have their #i reversed: not stable.`),
    [],
    [],
    true,
  );
  const [zh, en, complexityZh, complexityEn] = NAMES[algo];
  return {
    title: t(`${zh} · ${complexityZh}`, `${en} · ${complexityEn}`),
    question: t(`把 ${values.join(', ')} 从小到大排序`, `Sort ${values.join(', ')} in ascending order`),
    invariant: t(...INVARIANTS[algo]),
    columns: rows === 2 ? Math.max(1, n) : undefined,
    queueLabel: QUEUES[algo] && t(...QUEUES[algo]),
    frames,
  };
}

const NAMES: Record<SortAlgo, [string, string, string, string]> = {
  bubble: ['冒泡排序', 'Bubble sort', 'O(n²)，有序时 O(n)', 'O(n²), O(n) when sorted'],
  selection: ['选择排序', 'Selection sort', '总是 O(n²)', 'always O(n²)'],
  insertion: ['插入排序', 'Insertion sort', 'O(n²)，有序时 O(n)', 'O(n²), O(n) when sorted'],
  quick: ['快速排序', 'Quicksort', '平均 O(n log n)，有序时 O(n²)', 'O(n log n) on average, O(n²) when sorted'],
  merge: ['归并排序', 'Merge sort', 'O(n log n)，稳定', 'O(n log n), stable'],
  heap: ['堆排序', 'Heapsort', 'O(n log n)，原地', 'O(n log n), in place'],
  counting: ['计数排序', 'Counting sort', 'O(n + k)，不比较', 'O(n + k), no comparisons'],
  radix: ['基数排序', 'Radix sort', '每一位做一次稳定分桶', 'one stable bucket pass per digit'],
};
const INVARIANTS: Record<SortAlgo, [string, string]> = {
  bubble: ['第 k 趟之后，最大的 k 个数已在末尾就位；只交换相邻且严格逆序的数，所以稳定。', 'After pass k the k largest values sit at the end; only adjacent, strictly out-of-order pairs swap, so it is stable.'],
  selection: ['前 i 个位置放的是最小的 i 个数，以后不再变；远距离交换让它不稳定。', 'The first i positions hold the i smallest values for good; the long-range swap makes it unstable.'],
  insertion: ['左边 0..i−1 始终有序；新数只越过比它大的数，所以稳定。', 'The left part 0..i−1 is always sorted; a new value only passes bigger values, so it is stable.'],
  quick: ['分区后基准落在最终位置：左边都比它小，右边都不比它小。', 'After a partition the pivot is in its final place: smaller values left of it, the rest right.'],
  merge: ['两半各自有序；合并时相等取左边，先出现的仍在前面。', 'Both halves are sorted; a tie takes the left one, so the earlier value stays first.'],
  heap: ['0..end−1 是大顶堆，end 之后是已排好的最大值。', '0..end−1 is a max-heap; everything after end is the sorted largest values.'],
  counting: ['只数次数、不比较大小；从右往左放，相等的数保持原顺序。', 'It counts instead of comparing; placing right to left keeps equal values in order.'],
  radix: ['先按低位、再按高位分桶；每趟分桶都稳定，高位相同的数仍按低位有序。', 'Bucket by the low digit, then the high one; each pass is stable, so equal high digits stay ordered by the low one.'],
};
const QUEUES: Partial<Record<SortAlgo, [string, string]>> = {
  insertion: ['手里拿着的数', 'In hand'],
  merge: ['合并缓冲区', 'Merge buffer'],
  counting: ['计数数组（值:个数）', 'Count array (value:count)'],
  radix: ['桶（桶号: 数）', 'Buckets (digit: values)'],
};
