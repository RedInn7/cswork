# Rank in a Stream
Numbers arrive one at a time. Support two operations:
track x: record a new number x;
rank x: print how many numbers recorded so far are less than or equal to x (repeats count every time).

## Input
The first line holds an integer q (1 ≤ q ≤ 100000).
Each of the next q lines is track x or rank x (0 ≤ x ≤ 50000).

## Output
One line for each rank.

## Sample explanation
Sample 1 records 5, 1, 4, 4, 5, 9, 7, 13 and 3. rank 1 counts only the 1; rank 3 counts 1 and 3; rank 4 counts 1, 3, 4 and 4.

## Hints
- Scanning everything at each rank is O(q^2), too slow. The values are small enough for a Fenwick tree over values: track adds one at a point and rank is a prefix sum.
- The book uses a binary search tree whose nodes store their left subtree's size. Repeats count every time, and it is "less than or equal".
