# Every Arrangement of a String
Given a string of lowercase letters (letters may repeat), list every distinct string obtained by rearranging its letters.

## Input
One line with the string, of length 1 to 8.

## Output
The arrangements in increasing lexicographic order, one per line, each distinct arrangement once.

## Sample explanation
abc has 6 arrangements; aab has only three distinct ones: aab, aba and baa.

## Hints
- Backtrack, choosing a letter for each position in turn. Sort the letters first and, at one level, skip a letter equal to the previous one when that previous one has just been undone; no duplicates arise.
- Or start from the smallest arrangement and repeatedly compute the next permutation, which is lexicographic order by construction.
