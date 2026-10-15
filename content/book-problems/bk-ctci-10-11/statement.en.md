# Valleys and Peaks, Smallest First
Rearrange an integer array so that it starts with a valley and valleys and peaks alternate: a[0] ≤ a[1] ≥ a[2] ≤ a[3] ≥ a[4] …, that is, a value at an even index is not larger than its neighbours and a value at an odd index is not smaller than them.
Many arrangements usually qualify; print the lexicographically smallest one.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
The second line holds n integers, each with absolute value at most 10^9.

## Output
One line with the n values of the lexicographically smallest alternating arrangement.

## Sample explanation
Sample 1, 5 3 1 2 3, can become 1 3 2 5 3, 2 3 1 5 3 and others; the smallest is 1 3 2 5 3.
Sample 2 has two numbers, the smaller one first.

## Hints
- Sort the array, then swap the pairs at indices (1,2), (3,4), (5,6), …; that is the answer. Try to argue why each step is already the smallest choice.
- The book also has an O(n) method that swaps each peak position with its largest neighbour. It yields a valid alternating arrangement, but not necessarily the smallest.
