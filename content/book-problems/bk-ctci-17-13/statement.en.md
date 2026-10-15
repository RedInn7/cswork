# Put the Spaces Back
A passage lost its spaces and punctuation and was lowercased into one long string. Given a dictionary, cut the string into pieces so that as few characters as possible stay unrecognised: a piece that is exactly a dictionary word is recognised, and every other character is not. Print the smallest number of unrecognised characters.

## Input
The first line holds an integer n (1 ≤ n ≤ 150) and the second line n lowercase words (length 1 to 100).
The third line holds the sentence: 1 to 1000 lowercase letters.

## Output
One integer: the fewest unrecognised characters.

## Sample explanation
Sample 1's sentence is thecatsatonthemat and the dictionary holds the, cat, sat, on, mat and at. Cutting it as the cat sat on the mat recognises everything: 0.
In sample 2, brownfox only yields fox; the other 5 characters stay unrecognised.

## Hints
- Let f[i] be the fewest unrecognised characters among the first i: leaving character i unrecognised gives f[i-1] + 1, and a dictionary word ending at character i offers f[i - its length].
- Always taking the longest (or shortest) matching word is greedy and misses better cuts. A trie speeds up the matching.
