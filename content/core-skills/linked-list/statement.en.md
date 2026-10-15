# Singly Linked List

Implement a singly linked list `LinkedList` with nodes and pointers; no built-in list, array or linked-list container may hold the elements. The starter code defines the node. The list keeps a `head` pointer, a `tail` pointer and its length, so `push_back` is O(1) too.

Methods to implement:

| Method | Does |
| --- | --- |
| `push_front(x)` / `push_back(x)` | Add x at the front / back |
| `pop_front()` | Remove the head node and return its value (the list is non-empty) |
| `insert(i, x)` | Make x the node at position i (0-based, `0 <= i <= size`) |
| `remove(x)` | Remove the first node whose value is x; return true if one was removed, false otherwise |
| `reverse()` | Reverse the list in place (relink nodes, create none) |
| `size()` | Number of nodes |
| `values()` | All values from head to tail, for the driver to print |

Method names follow each language's conventions (Java `pushFront`, Go `PushFront`); the starter code has them. After removing the last node or reversing, make sure `tail` points at the new last node.

## Input

The first line is the number of operations q. Each of the next q lines is one operation:

push_front x / push_back x / pop_front / insert i x / remove x / reverse / size / print

The list is non-empty for every pop_front, and every insert index is in range.

1 ≤ q ≤ 2×10^4, |x| ≤ 10^9. There are at most 200 insert, remove, reverse and print operations in total, and at most 20 prints.

## Output

`pop_front` prints the removed value; `remove` prints 1 if it removed a node and 0 otherwise; `size` prints the length; `print` prints every value from head to tail on one line, separated by spaces, or empty for an empty list.

## Explanation

The pushes build 1 → 2 → 3 and insert 1 9 gives 1 → 9 → 2 → 3. remove 2 succeeds and remove 7 finds nothing. Reversing gives 3 → 9 → 1, and pop_front removes 3.

## Hints

- A sentinel node before the head, holding no value, spares insert and remove a special case for changing the head.
- Reverse with three pointers: previous, current and next. At each step save next first, then point the current node back.
- When remove deletes the last node, tail must step back to the node before it; when the list becomes empty, clear both head and tail.
