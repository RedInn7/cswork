# Double-Ended Queue (Ring Buffer)

Implement a double-ended queue `RingDeque` on a ring buffer: adding and removing at both ends and reading by index are all O(1) (amortized over growth). No built-in deque may be used (Python `collections.deque`, C++ `std::deque`, Java `ArrayDeque`).

The idea: a fixed-size array `data`, a head index `head` and a length `size`. Element i (0-based) lives at `data[(head + i) % capacity]`.

- The capacity starts at 4. When adding to a full array, first allocate one twice as large, move the elements over **in queue order** to positions 0, 1, 2, … and reset `head` to 0.
- `push_front` steps `head` back one slot (wrapping from 0 to the end); `push_back` writes the slot after the tail.

Methods to implement:

| Method | Does |
| --- | --- |
| `push_front(x)` / `push_back(x)` | Add x at the front / back |
| `pop_front()` / `pop_back()` | Remove and return the front / back element |
| `front()` / `back()` | Return the front / back element |
| `get(i)` | Return element i counting from the front (0-based) |
| `size()` | Number of elements |

The driver calls `pop_*`, `front` and `back` only on a non-empty queue and prints empty itself otherwise. Method names follow each language's conventions (Java `pushFront`, Go `PushFront`); the starter code has them.

## Input

The first line is the number of operations q. Each of the next q lines is one operation:

push_front x / push_back x / pop_front / pop_back / front / back / get i / size

1 ≤ q ≤ 2×10^4, |x| ≤ 10^9, and every get index is in range.

## Output

`pop_front`, `pop_back`, `front`, `back` and `get` print the element, or empty when the queue is empty (get never meets an empty queue); `size` prints the number of elements.

## Explanation

After push_back 1, push_back 2 and push_front 3 the queue reads 3 1 2 from front to back, and head has wrapped to the end of the array. get 0 is 3 and get 2 is 2. push_front 4 takes the last free slot; push_back 5 finds the array full, so it grows to 8 holding 4 3 1 2 5. The pops then empty it, and a final pop_back on the empty queue prints empty.

## Hints

- Step back as (head - 1 + capacity) % capacity: in some languages a negative number modulo stays negative.
- Growing cannot copy data in its physical order: the queue may start mid-array and wrap past the end to the beginning.
- Removing needs no clearing of the slot; just move head or shrink size.
