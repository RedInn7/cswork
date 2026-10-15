# Multiply Without the Times Sign
For each pair of positive integers a and b, print their product.
The book asks for a recursive version without the multiplication operator, using only addition, subtraction and shifts, and as few operations as possible. That is not enforced, but worth trying: halve b at each step, double the subproblem's result, and add one more a when b is odd.

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
Each of the next t lines holds two integers a and b (1 ≤ a, b ≤ 10^9).

## Output
t lines, each the product of a and b.

## Sample explanation
6 × 7 = 42, 13 × 1 = 13 and 10^9 × 10^9 = 10^18.

## Hints
- Products reach 10^18, so use 64-bit integers and widen before multiplying.
- In the halving recursion, an odd b needs one extra a, or one copy goes missing.
