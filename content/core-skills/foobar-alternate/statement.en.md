# Take Turns

Two threads share one `FooBar` object: one calls `foo(emit)` and the other calls `bar(emit)`. Each method must call `emit` n times, and the calls must strictly alternate: foo, then bar, then foo, then bar, 2n calls in all.

Which thread starts first is random. Do not `sleep` to wait for the other side or loop over a flag; hand the turn back and forth with blocking primitives such as semaphores, condition variables or channels.

| Method | Does |
| --- | --- |
| `FooBar(n)` | How many times each side calls emit |
| `foo(emit)` | Call emit n times, each time waiting for foo's turn |
| `bar(emit)` | Call emit n times, each time waiting for bar's turn |

The driver runs many rounds. Each round makes a new `FooBar`, picks at random which thread starts first, and randomly yields or sleeps briefly around each `emit`. The judge only compares output, so building the answer without threads would also pass, but it would skip the concurrency this problem is about.

## Input

The first line holds a random seed and the number of rounds R. Each of the next R lines holds n and two words: foo's emit records the first word and bar's emit records the second.

1 ≤ R ≤ 100, 1 ≤ n ≤ 40, 0 ≤ seed < 2^31, and each word is 1 to 6 lowercase letters.

## Output

One line per round: the words recorded by that round's emit calls, in the order they were called, separated by spaces.

## Explanation

In the first round n = 3, foo records tick and bar records tock. The correct alternation is tick tock tick tock tick tock: even when bar's thread starts first, it has to wait for foo's first emit.

## Hints

- Two semaphores can say whose turn it is: foo's starts at 1, bar's at 0, and each emit hands the turn to the other side.
- In Go, two channels of capacity 1 can pass a single token back and forth.
- One condition variable and a foo_turn flag also work: wait for your turn, emit, flip foo_turn and wake the other side.
