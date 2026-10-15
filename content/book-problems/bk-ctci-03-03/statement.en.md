# Stacks of Plates
A pile of plates topples if it grows too tall, so each pile holds at most cap plates and a new pile starts when the last is full. Number the piles 0, 1, 2, … from left to right and implement:
push v: put plate v on the rightmost pile, starting a new pile on the right if there is none or the rightmost is full;
pop: take the top plate off the rightmost pile and print it, or -1 if there are no plates;
popAt i: take the top plate off pile i and print it, or -1 if there is no pile i.
A pile that becomes empty is removed at once, and the piles to its right shift down by one. cap may be 0, in which case nothing can be stacked.

## Input
The first line holds two integers cap and q (0 ≤ cap ≤ 1000, 1 ≤ q ≤ 10000).
Each of the next q lines is one operation, with 0 ≤ v ≤ 10^9 and 0 ≤ i ≤ 10^5.

## Output
One line for each pop and popAt.

## Sample explanation
In sample 1, cap = 2: after pushing 5, 8 and 6, pile 0 is [5, 8] and pile 1 is [6]. popAt 0 takes 8; pop takes 6 and pile 1, now empty, is removed; popAt 0 takes 5 and pile 0 goes too; the last pop finds no plates and prints -1.

## Hints
- Keep a list of stacks: push and pop look at the last one, popAt indexes pile i directly.
- Remove emptied piles, or the numbering and later pops go wrong; with cap 0, push does nothing.
