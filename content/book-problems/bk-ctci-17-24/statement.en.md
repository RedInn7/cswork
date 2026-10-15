# The Submatrix With the Largest Sum
Given an n by m integer matrix, choose a non-empty submatrix (the rectangle where a run of consecutive rows meets a run of consecutive columns) whose elements have the largest sum. Print that sum.

## Input
The first line holds two integers n and m (1 ≤ n, m ≤ 100).
Each of the next n lines holds m integers with absolute value at most 1000.

## Output
One integer: the largest submatrix sum.

## Sample explanation
In sample 1, rows 0–2 and columns 1–2 form the submatrix 4 5 / 6 1 / -2 3 with sum 17, the largest.
In sample 2 every number is negative, and the best choice is the single element -1.

## Hints
- Fix the top and bottom rows and squash them into one array of column sums; the problem becomes the one-dimensional maximum subarray, solved by Kadane's algorithm in O(m). O(n^2·m) in all.
- The submatrix cannot be empty: with only negative numbers the answer is the largest of them, not 0.
