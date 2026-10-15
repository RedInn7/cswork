# Arrangements of Letters With Repeats
Given a string whose letters may repeat (upper and lower case count as different letters), find every distinct string obtained by rearranging its letters.

## Input
One line: a string of 1 to 9 upper and lower case letters with at most 20000 distinct arrangements.

## Output
The first line holds k, the number of distinct arrangements.
Each of the next k lines holds one arrangement, in increasing lexicographic order of ASCII codes (upper case before lower case).

## Sample explanation
qqe has 3 distinct arrangements: eqq, qeq and qqe.
AaA has 3: AAa, AaA and aAA.

## Hints
- Sort first; while backtracking, do not try the same letter twice at one position: skip a letter equal to the previous one when the previous one is not in use on this path.
- k equals n! divided by the factorials of each letter's count, a handy check for missing or repeated arrangements.
