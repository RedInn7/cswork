# Two Numbers That Hit the Target in a Sorted Array
Given an integer array in non-decreasing order and a target s, find numbers a and b at two different positions (a ≤ b) with a + b = s. If several pairs work, print the one with the smallest a; if none does, print -1.

## Input
The first line holds two integers n and s (2 ≤ n ≤ 100000, 1 ≤ s ≤ 2×10^6).
The second line holds n integers in non-decreasing order, each from 1 to 10^6.

## Output
One line with a b when a pair exists, otherwise -1.

## Sample explanation
In sample 1, 4 + 10 = 14 and 6 + 8 = 14; the one with the smallest a is 4 10.
In sample 2, making 10 needs two 5s, but the array has only one, and no other pair works, so the answer is -1.

## Hints
- Two pointers, one from each end: move the right one left when the sum is too large, the left one right when it is too small. The first pair found this way has the smallest a.
- The number at one position cannot be used twice.
