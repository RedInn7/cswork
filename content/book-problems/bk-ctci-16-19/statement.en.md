# Pond Sizes
An r by c plot stores a height on each cell; cells of height 0 are water. Water cells connect up, down, left, right and along the four diagonals, and connected water forms a pond whose size is its number of cells. Print the sizes of all ponds in increasing order.

## Input
The first line holds two integers r and c (1 ≤ r, c ≤ 500).
Each of the next r lines holds c integers from 0 to 9.

## Output
The first line holds k, the number of ponds.
The second line lists the k sizes in increasing order; it is empty when k is 0.

## Sample explanation
Write cells as (row, column) from 0. In sample 1, (0,1) and (0,2) are side by side, and (1,0), (2,1) and (1,3) join them diagonally: these 5 cells are one pond. The bottom-right (3,3) is a pond of its own. The answer is 1 5.

## Hints
- Visit every cell; from each unvisited water cell run a BFS or DFS that marks the water cells around it in all 8 directions and counts them.
- Looking only up, down, left and right splits diagonally joined ponds. On large grids a recursive DFS may overflow the stack; use an explicit stack or a queue.
