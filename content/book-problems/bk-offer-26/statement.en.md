# Does One Tree Fit Inside Another?
Given two binary trees A and B, B is a substructure of A if some node of A can serve as B's root so that, comparing downward, every node of B has a node in the matching position of A with the same value.
B only has to overlap part of A: extra nodes of A below the matched positions do not matter. That differs from a subtree, which must match a whole subtree exactly.

## Input
Two lines describing tree A and then tree B. Each tree lists its values in level order, with null for a missing child and trailing nulls left out. Both trees have at least one node; A has at most 10000 nodes and B at most 1000. Values are integers with absolute value at most 1000 and may repeat.

## Output
Print true if B is a substructure of A, otherwise false.

## Sample explanation
In sample 1, the root of A has left child 4 whose children are 1 and 2, which holds B (root 4 with left child 1), so the answer is true; the extra child 2 does not matter.
In sample 2, B's root 3 can only sit on A's root, whose left child is 4 rather than the 1 that B needs, so the answer is false.

## Hints
- Two levels of recursion: the outer one tries every node of A as a starting point, the inner one walks A and B together from there.
- In the inner walk, reaching an empty node of B is a match; a non-empty B node facing an empty A node, or a different value, is a failure.
