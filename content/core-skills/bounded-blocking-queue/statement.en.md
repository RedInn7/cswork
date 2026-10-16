# Bounded Blocking Queue

Implement `BoundedBlockingQueue`, a first-in first-out queue holding at most capacity items, shared by several producer threads and several consumer threads:

- `put(x)`: if the queue is full, block until there is room, then append x at the tail.
- `take()`: if the queue is empty, block until there is an item, then remove and return the head.
- The queue never holds more than capacity items, and items come out in the order they went in, none lost and none twice.

Build it yourself from a lock and condition variables (or semaphores), not from a ready-made blocking queue: Python's `queue.Queue`, Java's `ArrayBlockingQueue` or any other `BlockingQueue`, and Go's buffered channels are all off limits. A plain `deque`, array or slice is fine for storing the items. Do not wait with `sleep` or a polling loop.

| Method | Does |
| --- | --- |
| `BoundedBlockingQueue(capacity)` | The most items the queue may hold |
| `put(x)` | Wait while full, then append at the tail |
| `take()` | Wait while empty, then remove and return the head |

Each round runs some producer and consumer threads, started in a random order. The driver randomly yields or sleeps briefly around every call, and some consumers start late on purpose so the queue fills up. It keeps its own count of what went in and came out, and reports a problem the moment it sees one. The judge only compares output, so building the answer without threads would also pass, but it would skip the concurrency this problem is about.

## Input

The first line holds a random seed and the number of rounds R. Each of the next R lines holds four numbers capacity, P, C and k: the round has P producers and C consumers, and producer i (counting from 0) puts the k numbers i·k + 1 to i·k + k in that order. The C consumers take all P·k numbers between them, each a fixed number of times.

1 ≤ R ≤ 100, 1 ≤ capacity ≤ 5, 1 ≤ P, C ≤ 3, 1 ≤ k ≤ 60, and 0 ≤ seed < 2^31.

## Output

For a round in which every number comes out, one line with two numbers: how many items came out (P·k) and their sum.

As soon as the driver finds a problem, it prints one more line after those already printed, round k: followed by what went wrong, and stops. The problems are the queue went over its capacity of c, take() returned x, which was never put, x was taken twice, x came out after y, though it was put first (one producer's numbers came out of order), and only a of b items came out.

## Explanation

The second round has capacity 1: two producers put 1 2 3 and 4 5 6, and two consumers take 3 numbers each. With capacity 1, every put has to wait for the previous item to be taken. All 6 numbers come out and add up to 21, so the line is 6 21.

## Hints

- One lock and two condition variables: producers wait on not_full and consumers on not_empty. After a put, wake one consumer; after a take, wake one producer.
- Always wait inside a while loop: by the time a thread wakes up, another thread may already have changed the condition.
- With semaphores: slots starts at capacity and items at 0, plus a lock guarding the queue itself. Take the semaphore before the lock; the other order deadlocks.
