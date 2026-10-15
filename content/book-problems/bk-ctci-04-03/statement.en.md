# The Nodes on Each Level of a Tree
A binary tree has n nodes numbered 1 to n. List the values on every level from left to right, starting with the root's level.

## Input
The first line holds two integers n and root (1 ≤ n ≤ 10000, 1 ≤ root ≤ n).
Line i of the next n lines holds three integers v, l and r: node i has value v (absolute value at most 10^9), left child l and right child r, with 0 for no child.

## Output
The first line holds d, the number of levels.
Each of the next d lines starts with k, the number of nodes on that level, followed by the k values from left to right, separated by spaces.

## Sample explanation
In sample 1 the root is node 1 (value 10); the second level holds 20 and 30, the third 40, 50 and 60, and the fourth 70.

## Hints
- Breadth-first by levels: at each round note the queue's current length; that many nodes form one level.
- Or carry the depth through a DFS and append each node to its depth's list; visiting the left child first keeps each level in left-to-right order.
