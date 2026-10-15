# Read a Linked List Backwards
A singly linked list in memory has n nodes numbered 0 to n-1. Each node stores an integer value and the number of the next node; the last node's next is -1. The nodes are described in no particular order, and you only know which node is the head.
Print the values from the tail node back to the head node.

## Input
The first line holds two integers n and h (1 ≤ n ≤ 15000, 0 ≤ h < n): the node count and the head's number.
Each of the next n lines (the i-th, counting from 0) holds two integers v and nx: node i has value v (-10^9 ≤ v ≤ 10^9) and its next node is nx (-1 means none).
Following nx from the head visits all n nodes, each exactly once.

## Output
One line with n integers: the values from the tail to the head, separated by spaces.

## Sample explanation
In sample 1 the list is node 2 → node 0 → node 3 → node 1 with values 7, 5, -2, 9; backwards that is 9 -2 5 7.
Sample 2 has a single node.

## Hints
- Walk the list once recording the order, then print it reversed; a stack works too, or recursion that prints on the way back.
- On a long list recursion can overflow the call stack; the iterative version is safer.
