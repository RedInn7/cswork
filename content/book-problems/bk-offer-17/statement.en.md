# List Every Positive Number of at Most n Digits
Given a positive integer n, print in increasing order every positive integer with at most n digits, that is, from 1 up to the number written as n nines.

## Input
One integer n (1 ≤ n ≤ 5).

## Output
One line: every positive integer with at most n digits, starting from 1, separated by spaces.

## Sample explanation
For n = 1 the output is 1 to 9; for n = 2 it is 1 to 99.

## Hints
- Here n is small enough to compute the bound 10^n - 1 directly. If n were dozens or hundreds, no integer type could hold it; you would keep the number as a string and simulate adding one with carries, or generate every digit position from 0 to 9 recursively and drop leading zeros when printing.
- The bound is 10^n - 1: 10^n itself is excluded, and 0 is not printed.
