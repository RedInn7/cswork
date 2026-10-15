# How n Dice Add Up
Roll n fair six-sided dice at once; each shows 1 to 6 with equal chance. Their total ranges from n to 6n. Give the probability of each total n, n+1, …, 6n.

## Input
One integer n (1 ≤ n ≤ 11).

## Output
One line: first 5n+1, the number of probabilities that follow, then the probability of each total from the smallest up. Answers within 10^-5 of the reference are accepted.

## Sample explanation
With one die, each of the 6 faces has probability 1/6 ≈ 0.16667.
Two dice have 36 equally likely outcomes: a total of 2 comes only from (1,1), probability 1/36 ≈ 0.02778, and a total of 7 from 6 outcomes, probability 6/36 ≈ 0.16667.

## Hints
- Dynamic programming: from the ways to roll each total with i dice, adding one die makes the ways for total s the sum of the ways for s-1 down to s-6 with i dice.
- Divide the ways by 6^n at the end, or work with probabilities directly, spreading each one times 1/6 over the next 6 totals for every new die.
