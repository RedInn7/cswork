# The Largest Rectangle of Words
Given a word list, build a rectangle of letters in which every row, read left to right, is a word from the list and every column, read top to bottom, is also a word from the list (words may repeat; all rows have one length and all columns another). Find the largest possible area (rows times columns); if no rectangle can be built, print 0.

## Input
The first line holds an integer n (1 ≤ n ≤ 200).
The second line holds n distinct lowercase words of length 1 to 6.

## Output
One integer: the largest area.

## Sample explanation
In sample 1 the three rows cat / are / ten read cat, are and ten down the columns too: area 9. The list has no longer words, so nothing larger fits.
In sample 2 no rectangle can be built: with one row each column is a single letter, and the list has no one-letter words; the two rows ab / cd give the columns ac and bd, which are not in the list.

## Hints
- Try widths (row word length) and heights (column word length) by decreasing area, and backtrack row by row; after each row, check that every column read so far is a prefix of some word whose length equals the height, using a trie or a prefix set to prune.
- When the rectangle is full, every column must be exactly a word of that length; a prefix of a longer word does not count. Rectangles that are not squares count too.
