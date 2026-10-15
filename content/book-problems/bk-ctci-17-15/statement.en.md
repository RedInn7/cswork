# The Longest Word Made of Other Words
Given distinct words, find the longest one that can be built entirely by joining other words from the list (at least two words; a word may be reused, but a word cannot be built from itself alone). If several are longest, print the lexicographically smallest; if none exists, print none.

## Input
The first line holds an integer n (1 ≤ n ≤ 200) and the second line n distinct lowercase words of length 1 to 100.

## Output
One line: the word, or none.

## Sample explanation
In sample 1, dogwalker is dog plus walker, 9 letters, the longest; catsdog can be built too but is shorter.
In sample 2 no word can be built from others.

## Hints
- Put the words in a hash set and run a word-break DP on each word: f[i] says whether its first i letters split into words from the set, leaving out the split that is the whole word itself.
- Check words by length descending, then lexicographically; the first that works is the answer.
