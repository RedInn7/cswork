# Dynamic Array

Implement a dynamic array `DynamicArray` on **fixed-size** storage only: once allocated, a block never changes length (Python `[0] * cap`, C++ `new int[cap]`, Java `new int[cap]`, Go `make([]int, cap)` and never `append`). To grow or shrink, allocate a new block and move the elements over one by one.

Capacity rules (the `capacity` operation checks them):

- The capacity starts at 1 and the length at 0.
- When `push` or `insert` finds the length equal to the capacity, **double** the capacity first, then place the new element.
- After `pop` or `erase` removes an element, if the capacity is greater than 1 and the length is at most a quarter of it (`size * 4 <= capacity`), **halve** the capacity once.

Methods to implement:

| Method | Does |
| --- | --- |
| `push(x)` | Append x |
| `pop()` | Remove and return the last element |
| `get(i)` / `set(i, x)` | Read / write the element at index i (0-based) |
| `insert(i, x)` | Insert x at index i, shifting i and later elements right (`0 <= i <= size`) |
| `erase(i)` | Remove and return the element at index i, shifting later elements left |
| `size()` / `capacity()` | Current length / current capacity |

The starter code already has a driver that reads the input, calls your methods and prints the results; fill in the class.

## Input

The first line is the number of operations q. Each of the next q lines is one operation:

push x / pop / get i / set i x / insert i x / erase i / size / capacity

Every operation is valid: the array is non-empty for pop and erase, and every index is in range.

1 ≤ q ≤ 2×10^4, |x| ≤ 10^9. There are at most 2000 insert and erase operations in total, and the array holds at most 1000 elements when they run.

## Output

Each `pop`, `get`, `erase`, `size` and `capacity` prints one line: the removed or read element, the length or the capacity.

## Explanation

After push 5 and push 7 the capacity has gone from 1 to 2; push 9 finds length 2 equal to the capacity and doubles it to 4. insert 1 3 gives [5, 3, 7, 9], so get 1 reads 3. erase 0 removes 5 and pop removes 9, leaving [3, 7] of length 2. Two more pops follow: with one element left, 1×4 ≤ 4 halves the capacity to 2; once empty, 0×4 ≤ 2 halves it again to 1.

## Hints

- push is insert(size, x) and pop is erase(size - 1), so the grow and shrink logic is written once.
- Shift right starting from the last element, or you overwrite values not yet moved; shift left from the front.
- Why shrink at a quarter rather than at half? Picture capacity 4 with the length bouncing between 2 and 3 through push and pop.
