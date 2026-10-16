# Run in Order

Three threads share one `InOrder` object: one calls `first(job)`, one calls `second(job)` and one calls `third(job)`, each exactly once. Which thread starts first, and which reaches its method first, is entirely up to chance.

Make the three `job`s run strictly in the order first, second, third, each exactly once. Wait with blocking primitives (locks, condition variables, semaphores, events, CountDownLatch, channels), not with a hopeful `sleep` or a loop that keeps polling a flag.

| Method | Does |
| --- | --- |
| `first(job)` | Run job |
| `second(job)` | Run job once first's job has finished |
| `third(job)` | Run job once second's job has finished |

The driver runs many rounds. Each round makes a new `InOrder`, starts the three threads in a random order, and randomly yields or sleeps briefly around each `job` so that unsynchronized code fails early. The judge only compares output, so building the answer without threads would also pass, but it would skip the concurrency this problem is about.

## Input

The first line holds a random seed and the number of rounds R. Each of the next R lines holds three words: the words that round's first, second and third jobs record.

1 ≤ R ≤ 100, 0 ≤ seed < 2^31, and each word is 1 to 8 lowercase letters.

## Output

One line per round: the words that round's jobs actually recorded, in the order they ran, separated by spaces.

## Explanation

The first round's words are wake, wash and work. Whichever thread starts first, second must wait until first's job has recorded wake before running its own job, and third must wait for wash, so the line is always wake wash work. A line comes out different if the jobs run out of order or a method never calls its job.

## Hints

- Two "finished" signals are enough: second waits for first's, third waits for second's.
- Python has threading.Event, Java has CountDownLatch, Go can close a channel to broadcast, and C++ can use a mutex with a condition_variable.
- With a condition variable, check the condition in a while loop before each wait: being woken up does not mean it holds.
