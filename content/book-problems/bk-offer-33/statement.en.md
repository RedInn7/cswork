# Check a Search Tree's Postorder Sequence
In a binary search tree, every value in a node's left subtree is smaller than the node and every value in its right subtree is larger. A postorder walk visits the left subtree, then the right subtree, then the root.
Given a sequence of distinct integers, decide whether it can be the postorder walk of some binary search tree.

## Input
The first line holds an integer t (1 ≤ t ≤ 10), the number of sequences.
Each sequence takes two lines: its length n (1 ≤ n ≤ 2000), then n distinct integers with absolute value at most 10^9.

## Output
t lines, each true or false.

## Sample explanation
The first sequence 1 3 2 6 5 is the postorder walk of the tree rooted at 5 with left subtree {1, 3, 2} and right subtree {6}, so it is true.
In the second sequence 1 6 3 2 5 the root is 5; the first value larger than 5 from the left is 6, so the left subtree is just {1} and the right subtree {6, 3, 2}. But 3 and 2 are smaller than the root and cannot be in the right subtree, so it is false.

## Hints
- The last value is the root. The first value larger than it splits the rest: before it is the left subtree, from it up to the root the right subtree, which must hold no value smaller than the root. Then check both parts recursively.
- A monotonic stack scanning backwards does it in O(n).
