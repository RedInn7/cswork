# Judge a Tic-Tac-Toe Board
On an N by N board two players take turns: X and O are their marks and . is an empty cell. A player who fills a whole row, a whole column or a whole diagonal (either diagonal) wins.
For each given valid board (both players never win at once), print the winner X or O if there is one; otherwise print Draw when the board is full and Pending when empty cells remain.

## Input
The first line holds an integer t (1 ≤ t ≤ 100).
Each board starts with a line holding N (1 ≤ N ≤ 100), followed by N lines of N characters from X, O and .

## Output
t lines, the verdict for each board.

## Sample explanation
On the first board O fills the diagonal from top-left to bottom-right.
The second board is full with no line, so it is a Draw.
The third has empty cells and no winner: Pending.

## Hints
- Check each row, each column and both diagonals for a full line of one mark (not empty cells).
- Do not forget the anti-diagonal (top-right to bottom-left); with no winner, look for an empty cell to tell Draw from Pending.
