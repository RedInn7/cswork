# Ways to Read Digits as Letters
Read 0 as a, 1 as b, …, 25 as z. A digit string is cut into pieces, each a single digit 0–9 or two digits 10–25, and every piece becomes one letter. A two-digit piece cannot start with 0, so 05 is not a piece.
Given a digit string, count the different letter strings it can be read as.

## Input
One line: a string of 1 to 60 digits (it may start with 0).

## Output
One integer: the number of readings.

## Sample explanation
21426 has 3 readings: 2 1 4 2 6 → cbecg, 21 4 2 6 → vecg and 2 14 2 6 → cocg. Neither 42 nor 26 is a piece, being above 25.
506 has one: 5 0 6, since neither 50 nor 06 is a piece.

## Hints
- Let f(i) count the readings of the first i digits: the last digit alone contributes f(i-1), and when the last two digits are between 10 and 25 they add f(i-2).
- It works like climbing stairs and needs only two rolling variables. The count can exceed a 32-bit integer.
