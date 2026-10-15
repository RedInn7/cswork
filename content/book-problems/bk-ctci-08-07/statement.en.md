# Every Arrangement of Distinct Letters
Given a string of distinct letters (upper and lower case count as different), print all of its arrangements.

## Input
One line: a string of 1 to 8 distinct upper and lower case letters.

## Output
All arrangements, one per line, in increasing lexicographic order of ASCII codes (every upper case letter sorts before every lower case one, so B comes before a).

## Sample explanation
abc has 6 arrangements. aB has two, and since B has a smaller ASCII code than a, Ba comes first.

## Hints
- Backtrack with a used-array, filling one position at a time. Sort the letters by ASCII first and try them in order; the results come out sorted.
- Compare by character code; do not ignore case.
