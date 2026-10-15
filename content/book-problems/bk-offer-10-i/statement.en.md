# Fibonacci Modulo a Prime
The Fibonacci sequence is F(0) = 0, F(1) = 1 and F(n) = F(n-1) + F(n-2) for n ≥ 2.
For each query n, print F(n) modulo 1000000007.

## Input
The first line holds an integer t (1 ≤ t ≤ 1000), the number of queries.
The second line holds t integers n (0 ≤ n ≤ 100000).

## Output
t lines; line i answers query i.

## Sample explanation
The sequence starts 0, 1, 1, 2, 3, 5, 8, 13, …, so F(2) = 1 and F(5) = 5.
F(50) = 12586269025, which is 586268941 modulo 1000000007.

## Hints
- Plain recursion recomputes the same terms and takes exponential time. Build the terms upward so each is computed once.
- With many queries, compute every answer up to the largest n once and look them up. Reduce modulo at every step to keep numbers small.
