# Swap in Place Without a Temporary
The book's problem: swap two variables without a temporary. The usual tricks are the XOR swap (a ^= b; b ^= a; a ^= b) and the add-subtract swap. Here it sits in a setting where those tricks can bite:
Given an integer array of length n and q operations, operation k names two positions i and j (counting from 1) whose values are swapped. Apply all operations in order and print the array. i and j may be equal.

## Input
The first line holds two integers n and q (1 ≤ n, q ≤ 8000).
The second line holds n integers from 0 to 10^9.
Each of the next q lines holds two integers i and j (1 ≤ i, j ≤ n).

## Output
One line with the n values after all swaps.

## Sample explanation
Sample 1: swapping positions 1 and 3 gives 3 2 1; positions 2 and 2 are the same value, which stays put.
With the XOR swap and i = j, the first step a ^= a turns the value into 0, so i = j must be skipped.

## Hints
- When swapping by XOR or by addition, handle the case where both "variables" are the same memory.
- Positions count from 1; convert them to array indices.
