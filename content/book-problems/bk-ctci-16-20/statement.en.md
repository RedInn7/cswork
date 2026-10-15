# Old Phone Keypad Words
An old phone keypad prints letters on its digits: 2 is abc, 3 def, 4 ghi, 5 jkl, 6 mno, 7 pqrs, 8 tuv and 9 wxyz. Given a string of key presses and a word list, find every word in the list that matches the presses exactly (each letter maps to its key, and the word has as many letters as there are presses).

## Input
The first line holds num, a string of digits 2 to 9 of length 1 to 10.
The second line holds an integer n (1 ≤ n ≤ 10000).
The third line holds n lowercase words of length 1 to 10.

## Output
The first line holds k, the number of matching words.
The second line lists those k words in word-list order, separated by spaces; it is empty when k is 0.

## Sample explanation
4663 matches good, home, gone and hood from the list: g and h are on 4, o, m and n on 6, d and e on 3. goods has one letter too many and hope's p is on 7, so neither matches.

## Hints
- Build a letter-to-digit table, translate every word into digits and compare with num.
- Keys 7 and 9 carry four letters each, and a longer word that merely starts with num does not match.
