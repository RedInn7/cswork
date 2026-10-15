# The Tallest Human Tower
A circus builds a human tower: each person must be both shorter and lighter (strictly) than the person below. Given the heights and weights of n people, how many can the tower hold at most?

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
Each of the next n lines holds two integers h and w, a height and a weight (1 ≤ h, w ≤ 10^6).

## Output
One integer: the most people in one tower.

## Sample explanation
In sample 1 all 6 people fit, top to bottom: (56,90), (60,95), (65,100), (68,110), (70,150), (75,190).
In sample 2 the two people of height 2 have the same height and cannot stack, so at most 2 people fit.

## Hints
- Sort by height ascending and, for equal heights, by weight descending; then find the longest strictly increasing subsequence of weights. Equal heights in descending weight can never both join one increasing run.
- Greedy with binary search gives the longest increasing subsequence in O(n log n). Equal weights cannot stack either: search for the first position not less than the current weight.
