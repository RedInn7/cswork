# Langton's Ant After K Steps
An ant stands on an infinite grid of white cells, facing right. At each step:
on a white cell it paints the cell black, turns 90 degrees right and moves forward one cell;
on a black cell it paints the cell white, turns 90 degrees left and moves forward one cell.
After K steps, draw the smallest rectangle containing every black cell and the ant's cell: _ for white, X for black, and the ant's cell as the direction it faces (L left, U up, R right, D down).

## Input
One integer K (0 ≤ K ≤ 12000).

## Output
The rectangle, one string per row from top to bottom.

## Sample explanation
For K = 1: the start is white, so the ant paints it black, turns to face down and moves down. The rectangle has two rows and one column: X on top and the ant facing down, D, below.
For K = 3 the ant paints two more cells, turns right twice more to face up and ends on the cell left of the start: UX on top and XX below.

## Hints
- Keep the black cells in a hash set and simulate; track the smallest and largest row and column over the black cells and the ant, then draw.
- Decide the turn from the current colour, then flip the colour, then move; getting the order wrong sends the ant on another path entirely.
