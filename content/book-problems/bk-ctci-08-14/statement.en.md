# Parenthesise a Boolean Expression
An expression alternates 0s and 1s with the operators & (and), | (or) and ^ (xor), such as 1^0|0|1. Different parenthesisations evaluate the operators in different orders and may give different values. Given the desired result (0 or 1), count the parenthesisations that make the expression equal to it.
A parenthesisation fully brackets the expression, fixing which operator is applied when; two of them differ if their order of operations differs.

## Input
The first line holds a string s of odd length between 1 and 39: the even positions (counting from 0) are 0 or 1 and the odd positions are operators.
The second line holds the integer result (0 or 1).

## Output
One integer: the number of parenthesisations that give result.

## Sample explanation
1^0|0|1 gives 0 in two ways: 1^((0|0)|1) and 1^(0|(0|1)).
0&0&0&1^1|0 gives 1 in 10 ways.

## Hints
- Interval DP: t[i][j] and f[i][j] count the ways for the subexpression s[i..j] to give 1 and 0. Try every operator k as the last one applied and combine both sides' counts by the truth table of &, | or ^.
- When memoising, make the desired value part of the state, or store t and f together. The answer can reach about 1.8×10^9, so use 64-bit integers.
