# Change One Letter at a Time
Given a start word begin, a target word end and a word list, all of one length: each step changes one letter of the current word, and the new word must be in the list. Find the shortest sequence of words from begin to end (both included); if several shortest ones exist, print the lexicographically smallest (comparing word by word from the first). begin need not be in the list; end must be in it to be reachable. If end cannot be reached, print none.

## Input
The first line holds begin and end (begin ≠ end).
The second line holds an integer n (1 ≤ n ≤ 5000) and the third line n distinct words. All words are lowercase and as long as begin, 1 to 10 letters.

## Output
When reachable, one line: the number k of words in the sequence, then those k words, separated by spaces. Otherwise none.

## Sample explanation
In sample 1, lead → load → goad → gold takes 3 steps, the fewest; routes through lean and loan are longer. The output is 4 lead load goad gold.
In sample 2 the list lacks gold, so it cannot be reached.

## Hints
- Run a BFS from end first (neighbours differ in one letter) to get every word's distance to end; then walk from begin, always moving to the smallest neighbour one step closer.
- Generate neighbours by trying all 26 letters at each position and checking a hash set. A plain DFS finds a path, not necessarily a shortest one.
