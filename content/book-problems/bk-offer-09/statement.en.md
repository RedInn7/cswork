# A Queue Out of Two Stacks
All you have are stacks: push and pop at one end only. Use two stacks to act as a first-in, first-out queue that supports:
push x: put the integer x at the back;
pop: remove and print the front element, or print -1 if the queue is empty.
Run the given operations in order.

## Input
The first line holds an integer q (1 ≤ q ≤ 100000), the number of operations.
Each of the next q lines is push x (-10^9 ≤ x ≤ 10^9) or pop.

## Output
For each pop, print one line: the removed value or -1.

## Sample explanation
Sample 1 pushes 1 and 2 and pops 1; then it pushes 3 and pops 2 and 3; the queue is now empty, so the last pop prints -1.

## Hints
- One stack takes the pushes, the other serves the pops. When the serving stack is empty, pour the whole first stack into it, which reverses the order.
- Each element is poured at most once, so the total time is O(q).
