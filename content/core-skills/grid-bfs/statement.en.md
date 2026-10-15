# Grid BFS Shortest Path

A map of R rows and C columns: `.` is open ground, `#` a wall, `S` the start and `T` the target (exactly one each). Each step moves to an adjacent non-wall cell up, down, left or right, never off the map. Implement `shortest_path(grid)`, returning the fewest steps from S to T, or -1 if T is unreachable.

Every step costs 1, so use **breadth-first search**: expand outward from S one layer at a time, and the steps taken when a cell is first reached are its shortest distance. A queue holds the cells to expand, and each cell records whether it has been visited (or its distance).

The queue may be built in (`collections.deque`, `std::queue`, `ArrayDeque`) or an array with a head index.

## Input

The first line holds R and C. Each of the next R lines is a string of length C.

1 ≤ R, C ≤ 300, with exactly one S and one T on the map.

## Output

One integer: the fewest steps, or -1 if T cannot be reached.

## Explanation

S is in the top-left corner and T in the bottom-right. One route runs right along the first row and then straight down; another goes around the wall on the left. Both take 8 steps, and none is shorter.

## Hints

- Mark a cell visited when it is **pushed**, not when it is popped, or the same cell gets queued many times.
- Encode (r, c) as r * C + c and a one-dimensional array holds the distances.
- Keep the four directions in arrays dr = [1, -1, 0, 0] and dc = [0, 0, 1, -1] and loop over them; four separate ifs invite mistakes.
