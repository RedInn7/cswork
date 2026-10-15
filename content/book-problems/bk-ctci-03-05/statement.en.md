# A Stack With the Minimum on Top
Design a special stack whose top is always the smallest element, whatever order elements arrive in. Support:
push v: add v;
pop: remove the top (the smallest element); do nothing and print nothing when empty;
peek: print the top, or -1 when empty;
isEmpty: print true when empty, otherwise false.
The book asks you to sort using just one extra stack; that is not enforced here.

## Input
The first line holds an integer q (1 ≤ q ≤ 100000).
Each of the next q lines is one operation, with 1 ≤ v ≤ 10^9.

## Output
One line for each peek and isEmpty.

## Sample explanation
Sample 1 pushes 7, 4 and 9; the top is the smallest, 4. After pop removes 4, the top is 7 and the stack is not empty.

## Hints
- The book's way: to push v, move the main stack's top elements smaller than v onto a helper stack, put v down, then move them back, so the main stack always increases from top to bottom.
- A heap (priority queue) gets O(log n) per operation too.
