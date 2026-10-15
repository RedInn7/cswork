# Swap Odd and Even Bits
Given a non-negative integer, swap bits 0 and 1, bits 2 and 3, bits 4 and 5, and so on (bit 0 is the lowest), and print the result.

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
The second line holds t integers num (0 ≤ num < 2^30).

## Output
t lines, each the number after the swap.

## Sample explanation
2 is 10; swapping bits 0 and 1 gives 01, which is 1.
3 is 11 and stays the same.
5 is 0101 and becomes 1010, which is 10.

## Hints
- Take the odd bits with the mask 0xAAAAAAAA and the even bits with 0x55555555; shift the first right by one and the second left by one, then OR them.
- Mask first, then shift; mixing up a mask and its shift direction scrambles the bits.
