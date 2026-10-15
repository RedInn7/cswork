# The Last k Nodes of a List
Given a singly linked list and a positive integer k, print the values from the k-th node from the end through the tail. The tail is the 1st node from the end.

## Input
The first line holds two integers n and k (1 ≤ k ≤ n ≤ 100000).
The second line holds n integers, the values from head to tail, each with absolute value at most 10^9.

## Output
One line with k integers: the values from the k-th node from the end to the tail, separated by spaces.

## Sample explanation
In sample 1 the list is 1 → 2 → 3 → 4 → 5; the 2nd node from the end holds 4, so the output is 4 5.

## Hints
- Use two pointers: move the fast one k steps ahead, then move both until the fast one falls off the end; the slow one sits on the k-th node from the end after a single pass.
- Check the edges: k = n is the whole list and k = 1 is just the tail.
