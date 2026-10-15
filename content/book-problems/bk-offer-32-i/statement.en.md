# Walk a Binary Tree Level by Level
A binary tree has n nodes numbered 1 to n. Print the node values from top to bottom, and from left to right within each level.

## Input
The first line holds two integers n and root (1 ≤ n ≤ 100000, 1 ≤ root ≤ n): the node count and the root's number.
Line i of the next n lines holds three integers v, l and r: node i has value v (absolute value at most 10^9), left child l and right child r, with 0 meaning no child. The input forms a binary tree rooted at root.

## Output
One line with the n values in level order, separated by spaces.

## Sample explanation
In sample 1 the root is node 2 (value 3); its left child is node 1 (value 9) and its right child node 4 (value 20), whose children are node 3 (value 15) and node 5 (value 7). Level by level that reads 3 9 20 15 7.

## Hints
- Use a queue: start with the root; take the front node, print it, and append its left and right children.
- A recursive preorder walk does not give level order.
