# Insertion Orders That Build the Same Search Tree
Inserting distinct numbers one by one into an empty binary search tree (go left when smaller, right when larger, and place the value at the empty spot) can give the same tree for different orders. Given a binary search tree, list every insertion order that builds it.

## Input
One line giving the tree in level order: values separated by spaces, null for a missing child, trailing nulls left out. The tree has 1 to 12 nodes with distinct integer values from 1 to 100. There are at most 5000 orders.

## Output
One order per line, its n numbers separated by spaces. List the orders in increasing lexicographic order, comparing numbers by value (the order with the smaller number at the first difference comes first).

## Sample explanation
In sample 1 the root is 2 with left child 1 and right child 3. The root has to come first and 1 and 3 can come in either order, so the orders are 2 1 3 and 2 3 1.

## Hints
- The root always comes first. Any valid order of the left subtree and any valid order of the right subtree can be shuffled together like two decks of cards, as long as each keeps its own order.
- Recurse for both subtrees, then enumerate every interleaving. Sort by value at the end, not as strings ("10" would come before "9").
