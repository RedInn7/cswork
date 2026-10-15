# Who Is Left in the Circle?
n people stand in a circle numbered 0 to n-1. Counting starts at person 0; whoever says m leaves, and the next person starts again from 1. This repeats until one person is left. What is that person's number?
There are several test cases.

## Input
The first line holds an integer t (1 ≤ t ≤ 10).
Each of the next t lines holds two integers n and m (1 ≤ n ≤ 100000, 1 ≤ m ≤ 10^6).

## Output
t lines, the number of the last person for each case.

## Sample explanation
For n = 5 and m = 3 people leave in the order 2, 0, 4, 1, and 3 is left.
For n = 10 and m = 17 the last one is 2.

## Hints
- Simulating the removals counts m steps around the circle each time, which is too slow.
- Recurrence: with f(i) the survivor among i people (counted from 0), f(1) = 0 and f(i) = (f(i-1) + m) mod i. The modulus is the current count i, not n.
