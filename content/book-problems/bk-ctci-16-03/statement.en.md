# Where Two Segments Meet
Two segments in the plane are each given by two distinct integer endpoints. If they share a point, print it; if they share more than one (collinear and overlapping), print the shared point with the smallest x, and the smallest y among equal x. If they share nothing, print 0.

## Input
The first line holds four integers x1 y1 x2 y2, the endpoints of the first segment.
The second line holds four integers x3 y3 x4 y4, the endpoints of the second segment.
Every coordinate has absolute value at most 10^6, and a segment's two endpoints differ.

## Output
Print 0 when there is no common point. Otherwise print one line 2 x y, where 2 says two numbers follow and x y is the point. Answers within 10^-5 of the reference are accepted (relative error for coordinates above 1 in absolute value).

## Sample explanation
In sample 1, (0,0)-(4,2) and (0,3)-(3,0) cross at (2, 1).
In sample 2, both segments lie on the line y = 2 and overlap from (3,2) to (5,2); the point with the smallest x is (3,2).

## Hints
- Solve with cross products: write the point as P1 + t(P2 - P1) = P3 + u(P4 - P3); it lies on both segments only when both t and u are in [0, 1], not merely on the extended lines.
- A zero cross product means the segments are parallel; if they are also collinear, check which of the four endpoints lie on both segments and pick the one with the smallest x, then y.
