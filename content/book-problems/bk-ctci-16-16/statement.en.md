# The Shortest Range to Sort
Given an integer array, find the shortest contiguous range [m, n] (indices from 0) such that sorting just that range leaves the whole array in non-decreasing order. If the array is already non-decreasing, print -1 -1.

## Input
The first line holds an integer n (1 ≤ n ≤ 20000).
The second line holds n integers, each with absolute value at most 10^9.

## Output
One line with two integers m and n.

## Sample explanation
In sample 1, sorting 9 5 8 4 at indices 2 to 5 sorts the whole array, and no shorter range does.
Sample 2 is already sorted.

## Hints
- Scan left to right keeping the running maximum: every position below it must be inside the range, and the last such position is n. Scan right to left keeping the running minimum: every position above it must be inside, and the last such position is m. O(n) in all.
- An element equal to the running maximum (or minimum) need not move; compare strictly.
