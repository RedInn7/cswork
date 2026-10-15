# A Queue That Knows Its Maximum
Implement an integer queue with three operations:
push x: put x at the back;
pop: remove and print the front element, or print -1 if the queue is empty;
max: print the largest value now in the queue, or -1 if it is empty.
Run the given operations in order; each should take O(1) amortized time.

## Input
The first line holds an integer q (1 ≤ q ≤ 100000).
Each of the next q lines is push x (1 ≤ x ≤ 10^9), pop or max.

## Output
One line for each pop and each max.

## Sample explanation
Sample 1 pushes 1 and 2, so the maximum is 2; after popping 1 it is still 2; popping 2 empties the queue and max prints -1.

## Hints
- Keep a second double-ended queue whose values never increase from front to back: before pushing x onto it, drop the values at its back that are smaller than x. Its front is the maximum.
- When the popped element equals the helper's front, pop the helper too. So pushing may drop only strictly smaller values; equal ones must stay.
