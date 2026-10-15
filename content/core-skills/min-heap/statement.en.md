# Min-Heap

Implement a binary min-heap `MinHeap` on an array: the parent of index i is `(i - 1) / 2` (rounded down), its children are `2i + 1` and `2i + 2`, and no node is greater than its children. No built-in heap or priority queue may be used (`heapq`, `priority_queue`, `PriorityQueue`, `container/heap`).

The `dump` operation prints the heap's internal array in order, so follow **exactly these steps**:

- `push(x)`: put x at the end of the array, then **sift up**: while it is **strictly less** than its parent, swap them.
- `pop()`: remember the top; move the last element to index 0 and drop the end, then **sift down**: among the existing children pick the smallest (the left one when both are equal); while it is **strictly less** than the current node, swap and continue. Return the remembered top.
- `build(values)`: discard the old contents, place values in the array as given, then sift down every index from the last non-leaf `n / 2 - 1` down to 0 (Floyd's heap construction, O(n)).

Methods to implement: `push(x)`, `pop()`, `top()` (return the minimum), `size()`, `build(values)` and `dump()` (return a copy of the internal array).

The driver calls `pop` and `top` only on a non-empty heap and prints empty itself otherwise.

## Input

The first line is the number of operations q. Each of the next q lines is one operation:

push x / pop / top / size / build k a1 a2 … ak / dump

1 ≤ q ≤ 2×10^4, |x|, |ai| ≤ 10^9. The k of all builds sum to at most 2×10^4, and dumps print at most 5×10^4 numbers in total.

## Output

`pop` and `top` print the minimum, or empty for an empty heap; `size` prints the number of elements; `dump` prints every element in array order on one line, separated by spaces, or empty for an empty heap.

## Explanation

Pushing 5 3 8 1: 1 lands at index 3, is less than its parent 3 and swaps up to index 1, then is less than the top 3 and swaps to index 0, giving [1, 3, 8, 5]. pop returns 1 and moves 5 to the top to sift down: of its children 3 and 8, 3 is smaller and less than 5, so they swap, giving [3, 5, 8]. build 5 9 4 7 1 2 places [9, 4, 7, 1, 2] and sifts down from index 1: of 4's children 1 and 2, 1 is the smallest, so they swap, giving [9, 1, 7, 4, 2]. Then index 0: 9 swaps with the smaller child 1 and keeps sinking, swapping with 2, the smaller of its new children 4 and 2, giving [1, 2, 7, 4, 9].

## Hints

- "Left child on ties" and "swap only when strictly less" decide what dump prints; get one wrong and the output differs.
- If the heap is empty after a pop, do not sift down index 0.
- Why is Floyd's construction O(n)? Most nodes sit near the bottom and sink only a short way.
