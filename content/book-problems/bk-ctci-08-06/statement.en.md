# Every Move of the Towers of Hanoi
Three pegs A, B and C; peg A holds n disks, largest at the bottom. A move takes the top disk of one peg to another peg, and a larger disk may never sit on a smaller one. Move all disks to C in as few moves as possible and print every move.

## Input
One integer n (1 ≤ n ≤ 15).

## Output
The first line holds k, the number of moves.
Each of the next k lines holds two letters x y: move the top disk of peg x onto peg y. The shortest solution is unique.

## Sample explanation
For n = 2: move the small disk from A to B, the large one from A to C, then the small one from B to C: 3 moves.

## Hints
- To move n disks from A to C: move the top n-1 to B using C, move the largest to C, then move the n-1 from B to C using A.
- The minimum is 2^n - 1 moves.
