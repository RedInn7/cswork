# Can Five Cards Make a Straight?
Draw 5 playing cards: A is 1, J, Q and K are 11, 12 and 13, and the two jokers are 0 and can stand in for any card. The 5 cards form a straight if they can make 5 consecutive ranks (such as 3 4 5 6 7). An A is only 1 and cannot follow K.
For each given hand, decide whether it is a straight.

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
Each of the next t lines holds 5 integers from 0 to 13, one hand (at most two jokers).

## Output
t lines, each true or false.

## Sample explanation
9 10 11 12 13 is a straight as it stands; 0 3 0 6 7 uses the two jokers as 4 and 5; 4 5 5 6 7 has two 5s and cannot be one; in 0 2 3 4 8 the span from 2 to 8 is too wide for one joker.

## Hints
- Ignoring jokers, the remaining cards must have no repeats and their maximum minus minimum must be less than 5.
- Leave the jokers' 0 out of the minimum.
