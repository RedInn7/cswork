# The k-th Number Made of 3s, 5s and 7s
Some positive integers have no prime factors other than 3, 5 and 7 (any of them may be missing): 1, 3, 5, 7, 9, 15, 21, 25, … Note that 1 counts, having no prime factor at all. Listing these numbers in increasing order, find the k-th. There are several queries.

## Input
The first line holds an integer t (1 ≤ t ≤ 1000).
The second line holds t integers k (1 ≤ k ≤ 2000).

## Output
t lines, the k-th number for each query. Every answer fits in a 64-bit signed integer.

## Sample explanation
The sequence starts 1, 3, 5, 7, 9, 15, 21, 25, 27, 35, 45, 49, so the 6th is 15, the 12th is 49 and the 1st is 1.

## Hints
- Three pointers: every new number is an earlier one times 3, 5 or 7. Keep a pointer for each factor, take the smallest of the three candidates, and advance every pointer that produced it so repeats vanish (15 = 3×5 = 5×3).
- A min-heap with a hash set for repeats works too, with an extra log factor.
