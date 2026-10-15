# Smallest Difference Between Two Arrays
Given two integer arrays a and b, pick one number from each so that the absolute value of their difference is as small as possible, and print that value.

## Input
The first line holds two integers n and m (1 ≤ n, m ≤ 100000).
The second line holds n integers and the third m integers, all between -2^31 and 2^31 - 1.

## Output
One integer: the smallest absolute difference.

## Sample explanation
In sample 1, 7 and 2 differ by 5 and no pair is closer.
In sample 2 the two numbers differ by 2^32 - 1 = 4294967295.

## Hints
- Sort both arrays and walk two pointers from the start: compare the current pair's difference, then advance the pointer at the smaller value. That costs O(n log n + m log m).
- A difference can overflow a 32-bit integer; compute it in 64 bits.
