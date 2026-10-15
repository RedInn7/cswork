# Mastermind Hits and Pseudo-Hits
The computer places a coloured ball in each of 4 slots, each red (R), yellow (Y), green (G) or blue (B), with repeats allowed. You guess 4 colours. A slot whose colour you got right is a hit; a colour of your guess that appears in the solution but in a different slot is a pseudo-hit. A ball counts once: hit slots take no part in pseudo-hits, and each colour scores pseudo-hits at most as many times as it remains on both sides.

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
Each of the next t lines holds two strings solution and guess of length 4 made of R, Y, G and B.

## Output
t lines, each with two integers: the hits and the pseudo-hits.

## Sample explanation
Solution RGBY, guess GGRR: the G in the second slot is a hit. Of the remaining solution balls R, B, Y and guesses G, R, R, only one R pairs up, so there is 1 pseudo-hit.

## Hints
- Count the hits, and for the other slots count each colour on both sides; the pseudo-hits are the sum over colours of the smaller count.
- Typical mistakes count a hit ball again as a pseudo-hit, or skip the minimum and count one ball several times.
