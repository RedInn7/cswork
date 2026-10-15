# The Larger Number Without Comparing
For each pair of 32-bit signed integers a and b, print the larger one.
The book forbids if-else and every comparison operator; the usual idea picks by the sign bit of a - b. That is not enforced here, but beware: a - b itself can overflow 32 bits, and then its sign bit lies.

## Input
The first line holds an integer t (1 ≤ t ≤ 8000).
Each of the next t lines holds two integers a and b between -2^31 and 2^31 - 1.

## Output
t lines, the larger number of each pair.

## Sample explanation
The larger of 7 and -3 is 7.
2147483647 minus -2147483648 overflows 32 bits, so the difference's sign bit gives the wrong verdict; the answer is 2147483647.

## Hints
- With the sign bit: k = sign bit of (a - b), answer a·(1-k) + b·k. Compute the difference in 64 bits to avoid overflow, or, when a and b have different signs, let a's sign decide.
- The formula (a + b + |a - b|) / 2 overflows in 32 bits too.
