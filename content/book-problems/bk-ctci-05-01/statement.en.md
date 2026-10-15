# Insert One Number Into Another's Bits
Given non-negative integers N and M and two bit positions i ≤ j (bit 0 is the lowest), replace bits i through j of N with the binary form of M, its lowest bit at position i; the bits of N outside that range stay as they are. M always fits in j-i+1 bits.

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
Each of the next t lines holds four integers N, M, i and j (0 ≤ N < 2^31, 0 ≤ i ≤ j ≤ 30, 0 ≤ M < 2^(j-i+1)).

## Output
t lines, each the new N in decimal.

## Sample explanation
First case: N = 1000000000 in binary (512), M = 101, i = 1, j = 3; the result is 1000001010, which is 522 in decimal.
Second case: N = 0b11111, M = 0, i = 1, j = 3; bits 1 to 3 are cleared, giving 0b10001 = 17.

## Hints
- Build a mask with zeros at bits i..j and ones elsewhere, clear that range of N with it, then OR in M shifted left by i.
- OR alone is not enough: ones already in that range of N would survive.
