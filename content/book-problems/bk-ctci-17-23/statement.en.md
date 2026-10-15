# The Largest Square With Black Borders
An n by n grid has cells 0 (black) and 1 (white). Find the largest square whose four borders are all black cells (its inside does not matter). Print its top-left row and column (from 0) and its side length; among several largest, take the smallest row, then the smallest column. If there is no black cell, print -1.

## Input
The first line holds an integer n (1 ≤ n ≤ 150).
Each of the next n lines holds a string of n characters 0 and 1.

## Output
One line r c size, or -1.

## Sample explanation
In sample 1 the square with top-left (0,1) and side 3 has black borders; the 1 in its middle does not matter, and nothing is larger.
Sample 2 is all white.

## Hints
- Precompute, for every cell, how many consecutive 0s run right and down from it. A square with top-left (r, c) and side s is valid when that corner has at least s zeros to the right and down, the top-right corner at least s downward and the bottom-left corner at least s to the right.
- Try every top-left corner with sides from the largest possible down: O(n^3). Only the frame counts; the inside need not be black.
