# Does One Tree Fit Inside Another?
Given two binary trees A and B, B is a substructure of A if some node of A can serve as B's root so that, comparing downward, every node of B has a node in the matching position of A with the same value.
B only has to overlap part of A: extra nodes of A below the matched positions do not matter. That differs from a subtree, which must match a whole subtree exactly.

## Input
Two lines describing tree A and then tree B. Each tree lists its values in level order, with null for a missing child and trailing nulls left out. Both trees have at least one node; A has at most 10000 nodes and B at most 1000. Values are integers with absolute value at most 1000 and may repeat.

## Output
Print true if B is a substructure of A, otherwise false.

## Sample explanation
In sample 1 the root 8 of A has left child 6, whose children are 2 and 7. B is a root 6 with left child 2, which fits on the 6 in A, so the answer is true; the extra child 7 does not matter.
In sample 2, B's root 5 can only sit on A's root, whose left child is 1 rather than the 4 that B needs, so the answer is false.

## Hints
- Two levels of recursion: the outer one tries every node of A as a starting point, the inner one walks A and B together from there.
- In the inner walk, reaching an empty node of B is a match; a non-empty B node facing an empty A node, or a different value, is a failure.
