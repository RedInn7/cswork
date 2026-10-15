# Merge Synonymous Baby Names
A registry publishes how often each name was used, but some names are spellings of the same name. Given pairs of synonymous names, where synonymy is transitive (A ~ B and B ~ C give A ~ C), merge synonyms into groups. Each group is represented by its lexicographically smallest name and counts the sum of its names' frequencies.

## Input
The first line holds an integer n (1 ≤ n ≤ 10000), followed by n lines each with a name and its frequency (names are 1 to 20 letters and distinct; frequencies are from 0 to 10000).
The next line holds an integer m (0 ≤ m ≤ 10000), followed by m lines each with two synonymous names, both from the list above.

## Output
One line per group, "name total", ordered by the representative name (comparing character codes).

## Sample explanation
In sample 1, Jon, John and Johnny form one group through two synonym pairs; its representative is the smallest, John, with 15 + 12 + 2 = 29. Chris and Kris form another, represented by Chris, with 13 + 4 = 17. Mary stands alone.

## Hints
- Union-find over the names, making the lexicographically smaller name the root when merging; then add up frequencies by root.
- Handling only the given pairs, without following chains, splits one group into several.
