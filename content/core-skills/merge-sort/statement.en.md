# Merge Sort and Inversions

Implement merge sort `merge_sort(a)`: sort the array ascending in place (helper arrays are fine) and return its number of **inversions**, the index pairs (i, j) with i < j and a[i] > a[j]. Two equal elements are not an inversion.

The merge can count them on the way: when merging two sorted halves, every time an element of the right half goes into the result ahead of the elements left in the left half, each of those remaining left elements forms one inversion with it. The whole run is O(n log n).

No built-in sort may be called. Function names follow each language's conventions (Java `mergeSort`, Go `MergeSort`); the starter code has them.

## Input

The first line is n and the second holds n integers.

1 ≤ n ≤ 2×10^4, and every number's absolute value is at most 10^9.

## Output

Two lines: the number of inversions, then the sorted array, separated by spaces.

## Explanation

The inversions of [3, 1, 2, 3, 0] are (3, 1), (3, 2), (3, 0), (1, 0), (2, 0) and (3, 0), 6 in all; the two 3s are equal, so they do not count.

## Hints

- When the two current elements are equal, take the left one first: equal elements then never count as inversions, and the sort stays stable.
- There can be n(n - 1) / 2 inversions. For n = 2×10^4 that is about 2×10^8, still within 32 bits, but n = 10^5 overflows, so count in a 64-bit integer by habit.
- Top-down recursion reads most naturally; bottom-up works too, merging runs of length 1 pairwise and doubling the length each round.
