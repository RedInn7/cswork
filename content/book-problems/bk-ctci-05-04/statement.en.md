# Neighbours With the Same Number of One Bits
Given a positive integer num, among the integers from 1 to 2^31 - 1 whose binary form has as many ones as num, find the smallest one larger than num and the largest one smaller than num. Use -1 when there is none.

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
The second line holds t integers num (1 ≤ num ≤ 2^31 - 1).

## Output
t lines, each with two integers: the larger neighbour, then the smaller one.

## Sample explanation
6 is 110 with two ones: the next larger is 9 (1001) and the next smaller is 5 (101).
4 is 100: the larger neighbour is 8 (1000) and the smaller 2 (10).
2^31 - 1 has 31 ones; nothing larger fits the range and nothing smaller exists, so -1 -1.

## Hints
- Larger: find the lowest run of ones, turn the 0 just above it into 1, and move the rest of that run's ones down to the lowest bits.
- Smaller: find the 1 just above the lowest run of zeros, turn it into 0, and push the ones below it as high as they go. The result must still be a positive integer up to 2^31 - 1.
