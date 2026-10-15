# Counting Sort

There are n records; record i (0-based) has key `keys[i]` in the range `[0, k)`. Implement a **stable** counting sort `counting_sort(keys, k)`: return a permutation of the record indices ordered by key ascending, with records of equal keys in their original order.

Counting sort compares nothing. It takes three steps and O(n + k) in total:

1. Count how often each key occurs, giving `count[0..k-1]`;
2. Take prefix sums to get each key's **starting position** in the result, `start[v] = count[0] + … + count[v - 1]`;
3. Scan the records front to back, put index i at `start[keys[i]]`, then advance that position by one.

No built-in sort may be called. Function names follow each language's conventions (Java `countingSort`, Go `CountingSort`); the starter code has them.

## Input

The first line holds n and k, the second the n keys.

1 ≤ n ≤ 2×10^4, 1 ≤ k ≤ 10^5, 0 ≤ keys[i] < k.

## Output

One line of n integers: the record numbers in sorted order. The driver adds 1 to each returned index, so records are numbered from 1.

## Explanation

The keys are 2 0 2 1 0. Key 0 belongs to records 2 and 5, key 1 to record 4 and key 2 to records 1 and 3; each group keeps its original order, giving 2 5 4 1 3.

## Hints

- Step 3 must scan front to back to stay stable. Scanning back to front instead needs each key's ending position, filled downwards.
- The count array has length k, not n. When k is much larger than n, counting sort loses its edge.
- Radix sort is stable counting sort applied digit by digit from the lowest; stability is what makes it work.
