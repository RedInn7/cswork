# How Far the Robot Vacuum Goes
A floor has m rows and n columns, cells (0, 0) to (m-1, n-1). A robot vacuum starts at (0, 0) and moves one cell up, down, left or right at a time without leaving the floor.
Some cells are off limits: the robot cannot enter a cell whose row digit sum plus column digit sum is greater than k. For k = 18, cell (35, 37) is allowed because 3+5+3+7 = 18, and (35, 38) is not because 3+5+3+8 = 19.
How many cells can the robot reach, the start included?

## Input
One line with three integers m, n and k (1 ≤ m, n ≤ 300, 0 ≤ k ≤ 40).

## Output
One integer: the number of reachable cells.

## Sample explanation
Sample 1 is 2 rows by 3 columns with k = 1: (0, 0), (0, 1) and (1, 0) have digit sums at most 1 and are reachable, 3 cells in all.
In sample 2, k = 0 and the robot stays at the start.

## Hints
- Not every allowed cell is reachable: blocked cells can cut a region off. Search from the start with BFS or DFS.
- Row numbers can have three digits; add every digit.
