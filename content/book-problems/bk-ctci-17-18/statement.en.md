# The Shortest Range Holding Every Target
Given a long array big and a short array small of distinct values, find the shortest contiguous range [l, r] of big (indices from 0) that contains every value of small (in any order). If several are shortest, take the smallest l; if none exists, print -1.

## Input
The first line holds two integers n and m (1 ≤ n ≤ 100000, 1 ≤ m ≤ 100000).
The second line holds the n values of big and the third the m distinct values of small, all with absolute value at most 10^9.

## Output
One line l r when a range exists, otherwise -1.

## Sample explanation
In sample 1, big is 4 2 8 4 6 2 9 8 and small is 2 4 8. Indices 0 to 2, holding 4 2 8, contain all three values, and length 3 is the shortest; indices 1 to 3, 2 8 4, are just as short but start later, so the answer is 0 2.
In sample 2, big has no 5.

## Hints
- Sliding window: extend the right end, counting each target inside the window in a hash map; once all targets are in, move the left end right as far as possible and update the answer.
- Update only on a strictly shorter window to keep the smallest l. Stopping at the first valid window is wrong; a shorter one may come later.
