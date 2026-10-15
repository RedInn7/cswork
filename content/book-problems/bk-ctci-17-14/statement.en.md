# Pick the k Smallest
Given n integers and a non-negative integer k, find the k smallest of them and print them in increasing order. Repeated values count separately. k may be 0.

## Input
The first line holds two integers n and k (1 ≤ n ≤ 100000, 0 ≤ k ≤ n).
The second line holds n integers from 0 to 10^9.

## Output
One line with k integers in increasing order; an empty line when k is 0.

## Sample explanation
In sample 1 the 3 smallest are 1, 5 and 5 (5 appears twice).
In sample 2, k = 0 and nothing is picked.

## Hints
- Quickselect: split around a pivot into smaller, equal and larger parts, see which part holds the k-th smallest and recurse into it alone, O(n) on average; then sort those k numbers.
- A max-heap of size k works too; mind the empty heap when k = 0.
