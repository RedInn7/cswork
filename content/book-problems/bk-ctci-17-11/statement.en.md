# The Closest Two Words
Given a text of words (numbered 0, 1, 2, … in order) and several queries, each naming two different words, answer how close their nearest occurrences are: the smallest absolute difference of their indices.

## Input
The first line holds an integer n (2 ≤ n ≤ 100000) and the second the n lowercase words.
The third line holds an integer q (1 ≤ q ≤ 100), followed by q lines each with two different words, both present in the text.

## Output
q lines, the smallest distance for each query.

## Sample explanation
Sample 1's text is i am a student from a university in a city. a is at indices 2, 5 and 8 and student at 3, so their distance is 1; a and city (index 9) are also 1 apart; i and city are 9 apart.

## Hints
- Record every index of each word (already sorted). For a query, walk two pointers along the two sorted lists, compare the current indices and advance the smaller one; the cost is the sum of the two lengths.
- Looking only at each word's first occurrence, or only at one word coming before the other, misses closer pairs.
