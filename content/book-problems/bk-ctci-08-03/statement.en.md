# Find a Value Equal to Its Index
Given an integer array a sorted in non-decreasing order (values may repeat), indexed from 0, an index i is magic when a[i] = i. Print the smallest magic index, or -1 if there is none.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
The second line holds n integers in non-decreasing order, each with absolute value at most 10^9.

## Output
One integer: the smallest magic index, or -1.

## Sample explanation
In sample 1, a[2] = 2 is the only magic index.
In sample 2, a[1] = a[2] = 1; a[1] qualifies, so the smallest magic index is 1.

## Hints
- With distinct values you could binary search: when a[mid] < mid, the answer can only be on the right.
- With repeats, binary search breaks. Search both halves recursively and use a[mid] to skip what cannot match: the left half only up to min(mid-1, a[mid]) and the right half from max(mid+1, a[mid]). A plain linear scan also passes here.
