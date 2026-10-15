# Odd Numbers First
Rearrange an integer array so that all odd numbers come first and all even numbers after them, keeping the original relative order among the odd numbers and among the even numbers.
Negative numbers have a parity too: -3 is odd and -4 is even.

## Input
The first line holds an integer n (1 ≤ n ≤ 20000).
The second line holds n integers, each with absolute value at most 10^9.

## Output
One line with the n rearranged integers, separated by spaces.

## Sample explanation
In sample 1 the odd numbers are 1, 3, 5 in order and the even ones 2, 4, so the answer is 1 3 5 2 4.
In sample 2, -3 and -1 are odd and keep their order at the front.

## Hints
- Two passes are the simplest: collect the odd numbers, then the even ones.
- In many languages a negative number modulo 2 is negative (-3 % 2 is -1), so x % 2 == 1 treats negative odd numbers as even. Use x % 2 != 0 or x & 1.
