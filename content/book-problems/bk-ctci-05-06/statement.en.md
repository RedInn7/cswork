# How Many Bits to Change
Take two 32-bit signed integers A and B as 32 bits each (two's complement for negatives). How many bits of A must change at least to turn it into B?

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
Each of the next t lines holds two integers A and B between -2^31 and 2^31 - 1.

## Output
t lines, each the number of bits to change.

## Sample explanation
29 (11101) and 15 (01111) differ in two bits, so the answer is 2.
-1 has all 32 bits set and 0 none, so 32 bits change.

## Hints
- In A XOR B the set bits are exactly the differing bits; count them.
- To count ones, repeat x &= x - 1, which clears the lowest one each time. Keep the XOR to 32 bits for negatives (for example AND it with 0xFFFFFFFF), or languages with unbounded integers such as Python go wrong.
