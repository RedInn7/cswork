# How Far the Robot Vacuum Goes
A floor has m rows and n columns, cells (0, 0) to (m-1, n-1). A robot vacuum starts at (0, 0) and moves one cell up, down, left or right at a time without leaving the floor.
Some cells are off limits: the robot cannot enter a cell whose row digit sum plus column digit sum is greater than k. For k = 10, cell (23, 41) is allowed because 2+3+4+1 = 10, and (23, 42) is not because 2+3+4+2 = 11.
How many cells can the robot reach, the start included?

## Input
One line with three integers m, n and k (1 ≤ m, n ≤ 300, 0 ≤ k ≤ 40).

## Output
One integer: the number of reachable cells.

## Sample explanation
Sample 1 is 3 rows by 4 columns with k = 2: the cells with digit sums at most 2 are (0,0), (0,1), (0,2), (1,0), (1,1) and (2,0), all connected: 6 cells.
In sample 2, k = 0 and the robot stays at the start.

## Hints
- Not every allowed cell is reachable: blocked cells can cut a region off. Search from the start with BFS or DFS.
- Row numbers can have three digits; add every digit.
