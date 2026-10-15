# Consecutive Positive Integers That Sum to a Target
Given a positive integer target, find every run of at least two consecutive positive integers that sums to exactly target. For example 18 = 3+4+5+6 = 5+6+7.

## Input
One integer target (1 ≤ target ≤ 100000).

## Output
The first line holds k, the number of runs.
Each of the next k lines lists one run in increasing order, separated by spaces. Runs are ordered by their first number, smallest first.

## Sample explanation
Sample 1: 21 = 1+2+3+4+5+6 = 6+7+8 = 10+11, three runs with the smaller first number first.
Sample 2: 4 has no such run, so the output is just 0.

## Hints
- Sliding window: keep the sum of the current run between two ends; grow the right end when the sum is too small, shrink from the left when it is too large, and record it when equal.
- Or try every length len: the first number is (target - len(len-1)/2) / len and must be a positive integer.
