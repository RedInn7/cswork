# The Year With the Most People Alive
Given the birth and death years of n people, all between 1900 and 2000, find the year when the most people were alive. A person counts as alive in both the birth year and the death year. If several years tie, print the earliest.

## Input
The first line holds an integer n (1 ≤ n ≤ 20000).
Each of the next n lines holds two integers birth and death (1900 ≤ birth ≤ death ≤ 2000).

## Output
One integer: the earliest year with the most people alive.

## Sample explanation
In sample 1 the three lifespans are 1900–1999, 1950–1961 and 1960–1983. In both 1960 and 1961 three people are alive; the earlier year, 1960, wins.
In sample 2 the first person dies in 1910 and is still alive that year, so 2 people are alive in 1910.

## Hints
- A difference array: add one at the birth year and subtract one at the year after death, then take prefix sums from 1900, noting the first year the maximum is reached.
- The death year still counts, so subtract at death + 1. Compare with strictly greater to keep the earliest year.
