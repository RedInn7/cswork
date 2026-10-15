# Swap One Pair to Balance Two Sums
Given integer arrays A and B, pick a from A and b from B and swap them so that both arrays have the same sum. If several choices work, print the one with the smallest a (b then follows); if none does, print -1.

## Input
The first line holds two integers n and m (1 ≤ n, m ≤ 100000).
The second line holds n integers and the third m integers, all between -100000 and 100000.

## Output
One line a b when possible, otherwise -1.

## Sample explanation
In sample 1, A sums to 14 and B to 16. Swapping 2 and 3 makes both 15; swapping 7 and 8 works too, and the smallest a gives 2 3.
In sample 2 the sums differ by 1, an odd number, and no swap helps.

## Hints
- Equal sums after the swap mean a - b = (sumA - sumB) / 2. The difference must be even; put B into a hash set and look up b = a - (sumA - sumB)/2 for each a.
- An odd difference has no answer; integer division must not round it away.
