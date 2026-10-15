# Find a Word in a Sorted List With Gaps
A word list in lexicographic order has gaps scattered through it (a gap is not a word). Given a word, print its position in the list (from 0, gaps included), or -1 if it is absent.

## Input
The first line holds an integer n (1 ≤ n ≤ 20000).
The second line holds n tokens separated by spaces: each is a lowercase word or a # marking a gap. Without the gaps, the words strictly increase (no word repeats).
The third line holds the lowercase word to find.

## Output
One integer: the word's position, or -1.

## Sample explanation
In sample 1, cow is at position 6 (counting from 0, gaps included).
In sample 2 the list has no dog.

## Hints
- When binary search lands on a gap, step outward (or to one side) to the nearest word and compare that word with the target.
- The answer counts the gaps; it is not the word's rank among the words. A range of nothing but gaps must still end correctly.
