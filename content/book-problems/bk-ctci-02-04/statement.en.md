# Split a List Around a Pivot
Given a singly linked list and a pivot x, rearrange the list so that every node with a value less than x comes first and every node with a value greater than or equal to x comes after them. Both parts keep their nodes' original order.

## Input
The first line holds two integers n and x (1 ≤ n ≤ 100000, |x| ≤ 10^9).
The second line holds n integers, the values from head to tail, each with absolute value at most 10^9.

## Output
One line with the n values of the rearranged list from head to tail, separated by spaces.

## Sample explanation
With x = 3 the nodes below 3 are 1, 2, 2 in order and the rest 4, 3, 5, so the result is 1 2 2 4 3 5. A node equal to 3 belongs to the second part.

## Hints
- Build two new lists (each with a sentinel head), append every node to the tail of one of them while walking the original, then join them.
- Inserting each small node at the head also separates the parts, but reverses their order.
