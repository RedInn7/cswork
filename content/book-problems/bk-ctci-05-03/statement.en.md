# Flip One Bit for the Longest Run of Ones
Take a 32-bit signed integer as its 32 bits (two's complement for negatives). You may change at most one 0 into a 1. How long is the longest run of consecutive ones you can get?

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
The second line holds t integers, each between -2^31 and 2^31 - 1.

## Output
t lines, each the longest run of ones for the corresponding integer.

## Sample explanation
3567 is 110111101111 in binary; changing the 0 in the middle joins the two runs of 4 ones into a run of 9.
11 is 0…01011; changing bit 2 gives 4.
-1 has all 32 bits set and needs no flip: the answer is 32.

## Hints
- Scan the 32 bits from low to high, tracking the current run of ones and the previous run; at a 0, the previous run can join the next one only if the next bit is 1 (two zeros in a row cannot be bridged by one flip).
- Look at negatives as 32-bit two's complement: shift without sign extension, or AND with 0xFFFFFFFF first. The answer never exceeds 32.
