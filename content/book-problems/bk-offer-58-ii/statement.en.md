# Move the Front of a String to the Back
Given a string s and a non-negative integer k, move the first character of s to the end, k times in all, and print the result. After a full lap the string is back as it was, so k may be far larger than the length of s.

## Input
The first line holds s: 1 to 10000 letters and digits.
The second line holds an integer k (0 ≤ k ≤ 10^9).

## Output
One line: the string after the moves.

## Sample explanation
Sample 1 moves hel behind lo123, giving lo123hel.
In sample 2 the length is 5, so 7 moves act like 2.

## Hints
- Reduce k modulo the length; the answer is s from position k on, followed by its first k characters.
- Without an extra string: reverse the first k characters, reverse the rest, then reverse the whole string.
