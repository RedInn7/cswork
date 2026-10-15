# Occurrences in a Sorted Array
Given an integer array sorted in non-decreasing order and q queries, each an integer x, answer how many times x appears in the array.

## Input
The first line holds two integers n and q (1 ≤ n, q ≤ 100000).
The second line holds n integers in non-decreasing order, each with absolute value at most 10^9.
The third line holds the q query values x, each with absolute value at most 10^9.

## Output
q lines; line i answers query i.

## Sample explanation
In the array 5 7 7 8 8 10, 8 appears 2 times, 6 never, 10 once and 7 twice.

## Hints
- Two binary searches: the first position not less than x and the first position greater than x; their difference is the count. Each query costs O(log n).
- Finding one x and then counting outward one by one costs O(n) per query in the worst case.
