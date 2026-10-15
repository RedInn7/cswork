# Ways to Make n Cents
With unlimited quarters (25), dimes (10), nickels (5) and pennies (1), in how many ways can you make n cents? Only how many coins of each kind count, not their order. The count can be huge; print it modulo 1000000007.

## Input
One integer n (0 ≤ n ≤ 1000000).

## Output
One integer: the number of ways modulo 1000000007.

## Sample explanation
5 cents can be made 2 ways: one nickel or five pennies.
10 cents can be made 4 ways: 10, 5+5, 5+1×5 and 1×10.
For n = 0 there is one way: no coins at all.

## Hints
- Unbounded knapsack: loop over coin values outside and amounts upward inside, dp[j] += dp[j - coin]. Swapping the two loops counts ordered sequences instead.
- Reduce modulo after every addition.
