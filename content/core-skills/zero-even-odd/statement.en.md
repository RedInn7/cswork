# Zero, Even, Odd

Three threads share one `ZeroEvenOdd` object and call `zero(emit)`, `even(emit)` and `odd(emit)`, one each. Between them, the three methods must hand `emit` these 2n numbers in this order:

0 1 0 2 0 3 … 0 n

so every positive integer comes right after a 0. `zero` emits all the zeros, `odd` emits the odd numbers 1, 3, 5, … and `even` the even numbers 2, 4, 6, …. A method may call `emit` only when it is its turn.

| Method | Does |
| --- | --- |
| `ZeroEvenOdd(n)` | The largest positive integer to emit |
| `zero(emit)` | Call emit(0) n times, once before each positive integer |
| `even(emit)` | Emit every even number up to n, in order |
| `odd(emit)` | Emit every odd number up to n, in order |

The driver runs many rounds. Each round makes a new object, starts the three threads in a random order, and randomly yields or sleeps briefly around each `emit`. Do not wait with `sleep` or a polling loop. The judge only compares output, so building the answer without threads would also pass, but it would skip the concurrency this problem is about.

## Input

The first line holds a random seed and the number of rounds R. Each of the next R lines holds one n.

1 ≤ R ≤ 100, 1 ≤ n ≤ 50, 0 ≤ seed < 2^31.

## Output

One line per round: the numbers emit received in that round, in the order of the calls, separated by spaces.

## Explanation

In the first round n = 2, and the right order is 0 1 0 2. In the third round n = 1: even has nothing to emit and should just return, so the line is 0 1.

## Hints

- Three semaphores can say whose turn it is: zero's starts at 1 and the other two at 0. After each 0, zero wakes odd or even depending on the next number, and they hand the turn back to zero.
- Each method knows in advance how many times it loops, so no separate "done" signal is needed.
- One condition variable works too: share a "what comes next" value and let each thread wait until it equals the value it is about to emit.
