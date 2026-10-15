# Occurrences in a Sorted Array
Given an integer array sorted in non-decreasing order and q queries, each an integer x, answer how many times x appears in the array.

## Input
The first line holds two integers n and q (1 ≤ n, q ≤ 100000).
The second line holds n integers in non-decreasing order, each with absolute value at most 10^9.
The third line holds the q query values x, each with absolute value at most 10^9.

## Output
q lines; line i answers query i.

## Sample explanation
In the array 2 4 4 4 6 9, 4 appears 3 times, 5 never, and 9 and 2 once each.

## Hints
- Two binary searches: the first position not less than x and the first position greater than x; their difference is the count. Each query costs O(log n).
- Finding one x and then counting outward one by one costs O(n) per query in the worst case.
