# Dining Philosophers

n philosophers, numbered 0 to n - 1, sit around a round table. One fork lies between each pair of neighbours, n forks in all: fork p sits between philosopher p and philosopher (p + 1) % n. So philosopher p may only use forks p and (p + 1) % n, and needs both in hand to eat.

Each philosopher is a thread that calls `dine(p, pick, eat, drop)` several times. In each call, pick up your two forks with `pick(f)`, call `eat()` once, then put both forks down with `drop(f)`. Make sure that:

- A fork is in at most one philosopher's hands at a time: no `pick` while someone else holds it.
- During `eat()` the philosopher holds both of their forks, and `dine` puts both down before returning.
- Nothing deadlocks: every philosopher gets all of their meals. If everyone picks up their left fork first, for example, each can end up holding one fork and waiting forever for the other.

| Method | Does |
| --- | --- |
| `DiningTable(n)` | The number of philosophers and forks |
| `dine(p, pick, eat, drop)` | Philosopher p eats once: pick both forks, eat once, drop both forks |

`pick`, `eat` and `drop` are the driver's bookkeeping and never block, so mutual exclusion is up to your own locks: typically take fork f's lock, then call `pick(f)`, and release it only after `drop(f)`. The driver starts the threads in a random order and randomly yields or sleeps briefly around these calls. The judge only compares output, so building the answer without threads would also pass, but it would skip the concurrency this problem is about.

## Input

The first line holds a random seed and the number of rounds R. Each of the next R lines holds n, then n numbers: how many times philosophers 0 to n - 1 each call dine in that round.

1 ≤ R ≤ 100, 2 ≤ n ≤ 7, 0 to 8 calls each, and 0 ≤ seed < 2^31.

## Output

For a round in which every philosopher finishes, one line: how many times each philosopher ate, separated by spaces.

As soon as the driver finds a problem, it prints one more line after those already printed, round k: followed by what went wrong, and stops. For example philosopher 2 picked up fork 3 while philosopher 3 held it, philosopher 1 ate without holding forks 1 and 2, philosopher 0 left the table holding a fork, or philosopher 4 ate 0 times in one dine call (a dine call must eat exactly once).

## Explanation

In the first round five philosophers eat once each, so the line is 1 1 1 1 1. In the third round philosopher 0 never calls dine, while philosophers 1 and 2 share fork 2 and cannot eat at the same time; the line is 0 2 1.

## Hints

- Give each fork a lock. The simplest way to break circular waiting is a fixed order: everyone picks up their lower-numbered fork first.
- Another way is a semaphore starting at n - 1: with at most n - 1 philosophers reaching for forks at once, someone always gets both.
- A single global lock is also correct, but then only one philosopher eats at a time.
