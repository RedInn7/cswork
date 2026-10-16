'use client';

import track from '@/lib/content/core-skills.json';
import { ProblemTrack } from './sql-track';
import type { Navigate } from './learning';

/**
 * Core Skills (?view=problems&library=core): classic data structures, algorithms and
 * concurrency problems written by hand, each a skeleton above a fixed driver in Python, C++, Java and Go.
 * Built with its packages by scripts/core-skills/build.ts.
 */
export function CoreSkills(props: {
  navigate: Navigate;
  availableProblemIds: string[];
  activity: { problem_id: string }[];
  signedIn: boolean;
}) {
  return (
    <ProblemTrack
      {...props}
      library="core"
      track={track}
      copy={{
        kicker: ['Core Skills · 四种语言', 'Core Skills · four languages'],
        title: ['手写数据结构与经典算法', 'Data Structures & Algorithms by Hand'],
        lead: [
          '不调库，亲手实现动态数组、链表、哈希表、堆、LRU 缓存、排序与二分、KMP、BFS、最短路、最小生成树、并查集、字典树、线段树和树状数组，再写几道多线程并发题。每道题的起始代码上半部分是要补全的类或函数，下半部分是固定的驱动：读操作序列、调用你的实现、打印结果；并发题的驱动还会打乱线程顺序、检查执行结果。Python、C++、Java、Go 都能提交。',
          'No libraries: implement a dynamic array, linked list, hash map, heap, LRU cache, sorting and binary search, KMP, BFS, shortest paths, minimum spanning trees, union-find, a trie, a segment tree and a Fenwick tree yourself, then a few multithreaded concurrency problems. Each starter has the class or functions to fill in on top and a fixed driver below that reads the operations, calls your code and prints the results; the concurrency drivers also shuffle the threads and check what they did. Submit in Python, C++, Java or Go.',
        ],
        progress: ['Core Skills 进度', 'Core Skills progress'],
        empty: ['Core Skills 正在上线，稍后再来。', 'Core Skills is being published. Check back soon.'],
      }}
    />
  );
}
