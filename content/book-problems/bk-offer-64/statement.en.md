# Add 1 Through n
For each query, a positive integer n, print 1 + 2 + … + n.
In the book this problem also forbids multiplication, division, loops and conditionals. That is not enforced here, but you can take it on, for instance by ending a recursion with a short-circuiting logical operator.

## Input
The first line holds an integer t (1 ≤ t ≤ 100000).
The second line holds t integers n (1 ≤ n ≤ 10^9).

## Output
t lines, the sum for each query.

## Sample explanation
1 + 2 + 3 + 4 = 10 and 1 + 2 + … + 12 = 78.

## Hints
- The formula is n(n+1)/2. With n up to 10^9 the result is about 5×10^17, so use 64-bit integers and widen before multiplying.
- For the book's restriction: a recursive function can write n > 1 && (sum = n + f(n-1)), which stops at n = 1 by short-circuiting; with n this large, though, you need the formula or multiplication built from bit operations.
