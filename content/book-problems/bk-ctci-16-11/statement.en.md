# Build a Diving Board From Two Plank Sizes
You have plenty of planks of length shorter and of length longer, and you join exactly k planks end to end into a diving board. List every possible length of the board.

## Input
One line with three integers shorter, longer and k (1 ≤ shorter ≤ longer ≤ 100000, 0 ≤ k ≤ 100000).

## Output
The first line holds m, the number of distinct lengths.
The second line lists the m lengths in increasing order, separated by spaces; it is empty when m is 0.

## Sample explanation
With shorter = 2, longer = 5 and k = 3 the possible lengths are 6, 9, 12 and 15.
When both planks are equally long, every choice gives the same single length.

## Hints
- With i long planks the length is shorter·(k-i) + longer·i for i from 0 to k, increasing with i.
- Equal plank lengths give one result; k = 0 gives none. Lengths reach about 10^10, so use 64-bit integers.
