# One Line Halving Two Squares
Two axis-aligned squares are each given by their lower-left corner (x, y) and side length size. The line through both centres splits each square into two halves of equal area; when the centres coincide, take the vertical line through the centre.
That line meets the boundary of each square at two points. Of these four points, take the two farthest apart and print them by increasing x (by increasing y when x ties).

## Input
Two lines, each with three integers x, y and size describing a square (-1000 ≤ x, y ≤ 1000, 1 ≤ size ≤ 1000).

## Output
One line: 4 x1 y1 x2 y2, where 4 says four numbers follow and (x1, y1), (x2, y2) are the two farthest points. Answers within 10^-5 of the reference are accepted (relative error above 1 in absolute value).

## Sample explanation
In sample 1 the centres are (2, 2) and (5, 2), the line is y = 2, and the farthest points are (1, 2) and (6, 2).
In sample 2 both centres are (5, 5), so the line is x = 5; the points (5, 3) and (5, 7) on the larger square are farthest apart.

## Hints
- A line with slope of absolute value at most 1 crosses a square's left and right sides; a steeper one crosses the top and bottom. Treat the vertical line on its own.
- All four points lie on one line; order them by their projection along it, and the first and last are farthest apart. Fractions or 64-bit integers avoid rounding trouble.
