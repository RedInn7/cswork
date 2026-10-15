# Stack the Tallest Tower of Boxes
There are n boxes; box i has width w, depth d and height h. Boxes cannot be rotated. A box may sit on another only if it is strictly smaller in width, depth and height. Each box is used at most once. How tall can the tower be (the sum of the heights of its boxes)?

## Input
The first line holds an integer n (1 ≤ n ≤ 1000).
Each of the next n lines holds three integers w, d and h (1 ≤ w, d, h ≤ 10^6).

## Output
One integer: the tallest possible tower.

## Sample explanation
In sample 1 the three boxes stack as (3,3,3) at the bottom, (2,2,2) in the middle and (1,1,1) on top: height 6.
In sample 2, (2,3,4) cannot sit on (2,4,5) because their widths are equal, not strictly smaller. The best is (2,4,5) under (1,1,1), height 6, against (2,3,4) under (1,1,1), height 5; the answer is 6.

## Hints
- Sort by width, largest first, so every valid tower read bottom to top is a subsequence of the sorted list. Then run a longest-increasing-subsequence style DP: f[i] is the tallest tower with box i on top.
- All three dimensions must be strictly smaller; comparing width only, or allowing equality, goes wrong.
