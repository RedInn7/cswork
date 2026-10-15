# Trie

Implement a trie `Trie` of lowercase words, where the same word may be inserted several times (counted each time):

| Method | Does |
| --- | --- |
| `insert(word)` | Insert word once |
| `erase(word)` | If word is present at least once, remove one copy and return true; otherwise return false |
| `search(word)` | Whether word is present at least once |
| `count_prefix(p)` | How many words start with p (counting copies; p itself starts with p) |

Each node has 26 children (an array or a map) and two counters: `pass`, the number of words through the node, and `end`, the number ending exactly there. Insertion and removal adjust pass along the path and end at the last node; `count_prefix` walks to p's last node and reads its pass. Every operation is O(word length).

No hash map or set may store whole words. Method names follow each language's conventions (Java `countPrefix`, Go `CountPrefix`); the starter code has them.

## Input

The first line is the number of operations q. Each of the next q lines is one operation:

insert w / erase w / search w / prefix p

1 ≤ q ≤ 2×10^4; words and prefixes are lowercase letters, 1 to 20 long.

## Output

`erase` prints 1 if it removed a copy and 0 otherwise; `search` prints 1 if the word is present and 0 otherwise; `prefix` prints how many words start with p.

## Explanation

After inserting apple, app and apple, 3 words start with app (apple twice and app once) and 2 with apple. search ap is 0: ap is only a prefix and was never inserted as a word. erase apple removes one copy, one apple remains, so search apple is still 1; of the next two erases, the second fails.

## Hints

- Before erasing, make sure the word exists, or decrementing pass along the way drives counts negative.
- Erased nodes need not be freed: a node whose pass is 0 is as good as absent.
- Nodes can be objects with pointers or one big array: next[node][c] holds a child's number, 0 meaning none.
