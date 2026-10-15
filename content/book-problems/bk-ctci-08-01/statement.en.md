# One, Two or Three Steps at a Time
A child climbs stairs taking 1, 2 or 3 steps at a time. How many different ways lead to step n? The count can be huge; print it modulo 1000000007. There are several queries.

## Input
The first line holds an integer t (1 ≤ t ≤ 1000).
The second line holds t integers n (1 ≤ n ≤ 1000000).

## Output
t lines, the answer to each query.

## Sample explanation
For n = 3 there are 4 ways: 1+1+1, 1+2, 2+1 and 3.
For n = 5 there are 13.

## Hints
- The last move covers 1, 2 or 3 steps, so f(n) = f(n-1) + f(n-2) + f(n-3) with f(1) = 1, f(2) = 2 and f(3) = 4; or set f(0) = 1, standing on the floor being one way.
- Reduce modulo at every step. With many queries, fill the table up to the largest n once and look answers up.
