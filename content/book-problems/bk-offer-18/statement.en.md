# Unlink One Node
The values on a singly linked list are all distinct. Given the value v of one node, remove that node and print the rest of the list from head to tail.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000), the number of nodes.
The second line holds n distinct integers, the values from head to tail, each with absolute value at most 10^9.
The third line holds an integer v, the value of some node.

## Output
One line: the remaining values from head to tail, separated by spaces. If the list becomes empty, print an empty line.

## Sample explanation
Sample 1 removes the node holding 5, so 4 now links straight to 1.
Sample 2 removes the head.

## Hints
- Removing a node means pointing its predecessor at its successor.
- The head has no predecessor; a sentinel node in front handles it like any other. Also try removing the tail and removing the only node.
