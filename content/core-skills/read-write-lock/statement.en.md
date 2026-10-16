# Read-Write Lock

Implement a read-write lock `RWLock`:

- Any number of threads may hold the read lock at once, as long as nobody holds the write lock.
- The write lock is exclusive: while a thread holds it, nobody else may read or write.
- A thread that cannot get the lock blocks until it can; do not wait with `sleep` or a polling loop.

Build it yourself from a mutex and a condition variable rather than a ready-made read-write lock: Java's `ReentrantReadWriteLock` and `StampedLock`, Go's `sync.RWMutex` and C++'s `std::shared_mutex` are all off limits. Whether waiting writers get priority is up to you; the judge does not check it.

| Method | Does |
| --- | --- |
| `acquire_read()` | Take the read lock once no writer holds the lock |
| `release_read()` | Release the read lock |
| `acquire_write()` | Take the write lock once there are no readers and no writer |
| `release_write()` | Release the write lock |

In Java and Go the methods are camel-cased (`acquireRead`, `AcquireRead` and so on). Each round makes a new `RWLock` and is one of three kinds:

- `mix`: reader and writer threads share some data. A writer adds its value to two variables in two steps with a pause in between, and a reader reads the two variables at different moments; if they differ, it has seen a half-done write. The driver also counts the readers and writers inside the lock directly.
- `share`: readers only. Each reader that gets the read lock waits until every reader has it before releasing. If read locks cannot be shared, say because the lock is a plain mutex, the round times out and fails.
- `hold`: the driver takes the write lock itself and starts a reader and a writer trying to get in; neither may get in within 0.1 s. Then the driver takes the read lock and starts a writer, which must also stay out.

The judge only compares output, so building the answer without threads would also pass, but it would skip the concurrency this problem is about.

## Input

The first line holds a random seed and the number of rounds R. Each of the next R lines is one round, of one of three kinds:

mix r w ops v1 … vw: r readers and w writers, each doing ops operations; the i-th writer adds vi to the data each time.

share n: n readers hold the read lock together.

hold: while the driver holds the lock, other threads must stay out.

1 ≤ R ≤ 100; in a mix round r + w ≤ 8, 1 ≤ ops ≤ 12 and 1 ≤ vi ≤ 9; in a share round 2 ≤ n ≤ 8; and 0 ≤ seed < 2^31.

## Output

One line for each round that ends cleanly: the final value of the data for a mix round, n for a share round, and held for a hold round.

As soon as the driver finds a problem, it prints one more line after those already printed, round k: followed by what went wrong, and stops. The problems are a reader got in while a writer held the lock, a writer got in while another thread held the lock, a reader saw a half-done write (a and b), n readers could not hold the read lock at the same time, a thread got in while the write lock was held, and a writer got in while a read lock was held.

## Explanation

The third round has 2 readers and 2 writers doing 3 operations each, and the writers' values are 4 and 5, so the data ends at 3 × (4 + 5) = 27. As long as writers exclude each other and the readers, no reader ever sees a half-done write.

## Hints

- Guard a few counts with one mutex: how many readers hold the lock and whether a writer is writing. Readers wait for "no writer"; writers wait for "no readers and no writer".
- When the last reader leaves, or a writer releases, wake every waiter (notify_all, signalAll, Broadcast): a whole batch of readers may be able to get in together.
- With a steady stream of readers, a writer might wait forever. Count the waiting writers and make new readers wait while there are any, and writers no longer starve.
