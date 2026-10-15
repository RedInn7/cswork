# The Longest Run With as Many Letters as Digits
Given a string of letters and digits, find the longest substring containing equally many letters and digits. If several are longest, take the leftmost; if no non-empty substring qualifies, print none.

## Input
One line: a string of 1 to 100000 letters and digits.

## Output
One line: the substring, or none.

## Sample explanation
In sample 1, A1B2C3D4 holds 4 letters and 4 digits, and extending it either way breaks the balance, so it is the longest.
Sample 2 has letters only, so no substring qualifies.

## Hints
- Count a letter as +1 and a digit as -1 and take prefix sums. Two positions with equal prefix sums enclose a balanced substring.
- Store the first position of each prefix sum in a hash map so substrings come out longest, and update only on a strictly longer one to keep the leftmost.
