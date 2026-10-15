# How Many 2s Appear?
Write out every integer from 0 to n (both included). How many times does the digit 2 appear in total? 22 holds two 2s and counts twice. There are several queries.

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
The second line holds t integers n (0 ≤ n ≤ 10^9).

## Output
t lines, the answer to each query.

## Sample explanation
From 0 to 32, the digit 2 appears in 2, 12, 20 to 29 (10 times in the tens place, plus the units of 22) and 32: 2 + 10 + 1 + 1 = 14 times in all.

## Hints
- Work digit position by digit position: split n into the part above position k, the digit at k and the part below. Whether that digit is below 2, equal to 2 or above 2 tells how many 2s appear at that position.
- Counting from 0 up to n is far too slow. Remember to include n itself.
