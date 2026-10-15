# Most Coins on the Way Down
An m by n board has some coins on every cell. You start at the top-left cell and move one cell right or down at a time until you reach the bottom-right cell, picking up the coins on every cell you visit (start and end included). What is the largest number of coins you can collect?

## Input
The first line holds two integers m and n (1 ≤ m, n ≤ 200).
Each of the next m lines holds n integers, the coins on each cell, between 0 and 1000.

## Output
One integer: the most coins you can collect.

## Sample explanation
In sample 1 the route 1 → 3 → 5 → 2 → 1 collects 12 coins, and no route collects more.

## Hints
- The best total on arrival at a cell is its coins plus the larger best total of the cell above and the cell to the left. The first row and column have a single way in and accumulate along it.
- Always stepping toward the richer neighbour (greedy) is not always best.
