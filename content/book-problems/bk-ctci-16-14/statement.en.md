# The Line Through the Most Points
n distinct integer points in the plane are numbered 0 to n-1 in input order. Find a line through as many points as possible. If S lists the numbers of all points on it in increasing order, print S[0] and S[1]. When several lines pass through the same number of points, take the one with the smallest S[0], then the smallest S[1].

## Input
The first line holds an integer n (2 ≤ n ≤ 300).
Each of the next n lines holds two integers x and y (absolute value at most 10000); all points are distinct.

## Output
One line with S[0] and S[1].

## Sample explanation
In sample 1 points 0, 1 and 2 lie on y = x: 3 points, and no line does better.
In sample 2 every line through two points passes through only those two, so the rule picks 0 and 1.

## Hints
- Fix the first point i and group every later point j by direction (dx, dy), reduced by the greatest common divisor with a normalised sign (say dx > 0, or dy > 0 when dx is 0). Points in one group lie on one line with i.
- Floating-point slopes invite precision trouble, and a vertical line divides by zero.
