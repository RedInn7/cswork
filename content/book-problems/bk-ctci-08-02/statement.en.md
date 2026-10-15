# Guide a Robot Around Obstacles
An r by c grid has obstacles on some cells. A robot starts at the top-left cell and moves one cell down (D) or right (R) at a time, never onto an obstacle, aiming for the bottom-right cell.
If it can get there, print one route: a string of D and R of length r+c-2. Of all possible routes, print the lexicographically smallest one (D before R, that is, go down whenever that still works). If it cannot get there, print -1.

## Input
The first line holds two integers r and c (1 ≤ r, c ≤ 100).
Each of the next r lines holds a string of c characters 0 and 1, where 1 is an obstacle.

## Output
One line: the smallest route, or -1. When start and goal coincide (1 by 1, no obstacle), print an empty line.

## Sample explanation
In sample 1 the first two cells of the third row are blocked. After one step down the next step down hits an obstacle, so the robot goes right; at the third cell of the second row the cell below is free, so it goes down and then right to the goal: DRRDR is the smallest route.
In sample 2 the goal is walled in and cannot be reached.

## Hints
- First work backwards from the goal to mark every cell that can still reach it; then walk from the start, going down whenever the cell below can reach the goal.
- Going down whenever possible without that check walks into dead ends.
