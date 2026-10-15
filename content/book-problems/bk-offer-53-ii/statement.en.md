# Which Label Is Missing?
Exactly one of the n+1 integers 0 to n is missing; the other n are given in increasing order. Find the missing one.

## Input
The first line holds an integer n (1 ≤ n ≤ 30000).
The second line holds n strictly increasing integers between 0 and n.

## Output
One integer: the missing number.

## Sample explanation
Sample 1 is 0 1 2 4 5, missing 3.
Sample 2 is 0 1 2, missing the last number, 3.

## Hints
- Before the gap every value equals its index; from the gap on, every value is one more. Binary search for the first index whose value differs, in O(log n).
- The missing number can be 0, and it can be n.
