# How Often Does a Word Appear?
Given all the words of a book and many queries, each a word, answer how many times the query appears in the book as a whole word. With so many queries, each answer must be fast.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000), the number of words in the book.
The second line holds the n lowercase words.
The third line holds an integer q (1 ≤ q ≤ 100000).
The fourth line holds the q lowercase query words. Every word has 1 to 10 letters.

## Output
q lines, each the count for the corresponding query.

## Sample explanation
In sample 1, the appears 4 times, and twice, sun once, star never (stars does not count), on once (the on inside moon does not count) and moonlight never.

## Hints
- Count every word once in a hash map; each query is then an O(1) lookup.
- Count whole words: do not join the words and count substrings, and do not count words that merely start with the query.
