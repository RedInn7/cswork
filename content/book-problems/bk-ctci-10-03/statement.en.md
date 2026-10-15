# Search a Rotated Sorted Array
An array sorted in non-decreasing order was cut at some point and its two parts swapped (possibly with no cut), so 1 2 3 4 5 5 might become 4 5 5 1 2 3. Values may repeat. Given target, print the index of its first occurrence (from 0), or -1 if it is absent.

## Input
The first line holds two integers n and target (1 ≤ n ≤ 100000, |target| ≤ 10^9).
The second line holds the n rotated values, each with absolute value at most 10^9.

## Output
One integer: the first index of target, or -1.

## Sample explanation
Sample 1 is 2 6 8 13 17 21 24 30 after rotation; 8 is at index 5.
In sample 2, 9 appears at indices 0, 1, 2 and 5; the smallest is 0.

## Hints
- Binary search comparing a[lo], a[mid] and a[hi] to tell which half is sorted, then decide which half can hold target. On finding target, keep searching left for a smaller index instead of returning at once.
- Repeats can make a[lo], a[mid] and a[hi] equal, and then neither half is known to be sorted: shrink the bounds by one, which is O(n) in the worst case.
