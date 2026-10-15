# The k Smallest Numbers
Given n integers and a positive integer k, find the k smallest of them and print them in increasing order. Equal values count separately: if 1 appears twice, both copies may be in the answer.

## Input
The first line holds two integers n and k (1 ≤ k ≤ n ≤ 20000).
The second line holds n integers, each with absolute value at most 10^9.

## Output
One line with k integers in increasing order, separated by spaces.

## Sample explanation
In sample 1 the two smallest numbers are 3 and 4.
In sample 2, 0 appears twice, so the three smallest are 0 0 3.

## Hints
- Sorting and taking the first k costs O(n log n). A max-heap of size k holding the smallest k so far costs O(n log k); quickselect averages O(n).
- Compare the numbers as integers, not as strings ("10" sorts before "9" as text).
