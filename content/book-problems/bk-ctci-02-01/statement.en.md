# Remove Repeats From a List, Keeping the First
Given an unsorted singly linked list, remove repeated values: keep only the first node holding each value and leave the other nodes in their order. Print the resulting list.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
The second line holds n integers, the values from head to tail, each with absolute value at most 10^9.

## Output
One line: the values from head to tail after removing repeats, separated by spaces.

## Sample explanation
In sample 1 the second 3 and the second 1 are repeats; removing them leaves 1 2 3.
In sample 2 every value is the same and only the first node remains.

## Hints
- Track the values seen in a hash set and unlink each repeated node (point its predecessor past it).
- Without extra space, scan ahead from every node and remove equal values, in O(n^2). Repeats need not be adjacent.
