# The k-th Largest Value in a Search Tree
Given a binary search tree (distinct values; the left subtree is smaller than the node and the right subtree larger) and a positive integer k, find the k-th largest value in the tree.

## Input
The first line gives the tree in level order: values separated by spaces, null for a missing child, trailing nulls left out. The tree has 1 to 10000 nodes with integer values of absolute value at most 10^9.
The second line holds an integer k (1 ≤ k ≤ the number of nodes).

## Output
One integer: the k-th largest value.

## Sample explanation
In sample 1 the values from largest to smallest are 6, 5, 4, 3, 2, 1, so the 3rd largest is 4.

## Hints
- An inorder walk (left, node, right) visits values in increasing order; walking right, node, left visits them in decreasing order, and you can stop at the k-th.
- The tree can be a single path 10000 deep; watch the recursion depth or use an explicit stack.
