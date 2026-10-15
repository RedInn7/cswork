# Count Inversions
In an integer array, positions i < j form an inversion when the value at i is strictly greater than the value at j. Count the inversions of the given array.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
The second line holds n integers, each with absolute value at most 10^9.

## Output
One integer: the number of inversions.

## Sample explanation
In sample 1 the array 7 5 6 4 has the inversions (7,5), (7,6), (7,4), (5,4) and (6,4): 5 in all.
In sample 2 the array 3 2 2 pairs 3 with each of the two 2s; the two equal 2s do not count, so the answer is 2.

## Hints
- Two nested loops take O(n^2), which is too slow. While merge sort merges two sorted halves, whenever a value from the right half goes first, every value left in the left half is larger, so a whole batch is counted at once. A Fenwick tree over compressed values works too.
- Equal values are not an inversion. The answer can reach about 5×10^9, beyond a 32-bit integer.
