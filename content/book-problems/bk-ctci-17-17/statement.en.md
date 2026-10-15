# Search Many Short Strings in a Long One
Given a long string big and several short strings, find for each short string every position where it starts in big (counting from 0). Occurrences may overlap.

## Input
The first line holds big: 1 to 1000 lowercase letters.
The second line holds an integer n (1 ≤ n ≤ 1000).
The third line holds the n short strings: lowercase, each of length 1 to 1000, with total length at most 100000.

## Output
n lines; line i gives the number k of occurrences of the i-th short string, then its k starting positions in increasing order, separated by spaces.

## Sample explanation
big is abracadabra. abra starts at 0 and 7; a at 0, 3, 5, 7 and 10; cad at 4; x nowhere; bra at 1 and 8.

## Hints
- Insert all short strings into a trie, then walk the trie from every position of big, recording an occurrence at each short string's end you pass. The cost is about |big| times the longest short string.
- Jumping past a whole match before searching again misses overlapping occurrences, and finding only the first one is not enough either.
