# Value of the k-th Node From the End
Given a singly linked list and a positive integer k, print the value of the k-th node from the end. The tail is the 1st from the end.

## Input
The first line holds two integers n and k (1 ≤ k ≤ n ≤ 100000).
The second line holds n integers, the values from head to tail, each with absolute value at most 10^9.

## Output
One integer: the value of the k-th node from the end.

## Sample explanation
In the list 1 → 2 → 3 → 4 → 5 the 2nd node from the end holds 4.

## Hints
- Without knowing the length, let one pointer go k steps first, then advance both together; when the leading pointer runs off the end, the trailing one sits on the k-th node from the end.
- Counting the length n first and then walking n-k steps from the head also uses O(1) extra space.
