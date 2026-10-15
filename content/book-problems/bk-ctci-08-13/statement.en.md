# Stack the Tallest Tower of Boxes
There are n boxes; box i has width w, depth d and height h. Boxes cannot be rotated. A box may sit on another only if it is strictly smaller in width, depth and height. Each box is used at most once. How tall can the tower be (the sum of the heights of its boxes)?

## Input
The first line holds an integer n (1 ≤ n ≤ 1000).
Each of the next n lines holds three integers w, d and h (1 ≤ w, d, h ≤ 10^6).

## Output
One integer: the tallest possible tower.

## Sample explanation
In sample 1 the boxes stack as (5,6,6) at the bottom, (4,5,4) in the middle and (3,3,3) on top: height 6 + 4 + 3 = 13.
In sample 2 no two boxes stack: (2,2,2) on (3,2,6) has equal depth, (2,2,2) on (4,4,1) is taller than the box below, and so is (3,2,6) on (4,4,1). A single box it is, the tallest being 6.

## Hints
- Sort by width, largest first, so every valid tower read bottom to top is a subsequence of the sorted list. Then run a longest-increasing-subsequence style DP: f[i] is the tallest tower with box i on top.
- All three dimensions must be strictly smaller; comparing width only, or allowing equality, goes wrong.
