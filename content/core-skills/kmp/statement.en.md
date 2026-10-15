# KMP String Matching

Use the KMP algorithm to find every occurrence of a pattern p in a text t, in two steps:

**1. `prefix_function(p)`: the prefix function.** `pi[i]` is the length of the longest substring of the prefix `p[0..i]` that is **both a proper prefix and a suffix** of it (a proper prefix is not the whole string). For p = `abab`, pi = [0, 0, 1, 2].

**2. `find_all(t, p)`: matching.** With the prefix function, find every starting index (0-based, overlaps allowed) of p in t in O(|t| + |p|) time, in increasing order. On a mismatch the text pointer never moves back; only the pattern pointer jumps to `pi[j - 1]`.

No built-in string search may be called (`str.find`, `in`, `string::find`, `indexOf`, `strings.Index`, regular expressions and so on). Function names follow each language's conventions (Java `prefixFunction`, Go `PrefixFunction`); the starter code has them.

## Input

Two lines: the text t, then the pattern p, both lowercase letters only.

1 ≤ |p| ≤ |t| ≤ 3×10^4.

## Output

Three lines: the prefix function of p, separated by spaces; the number of occurrences; and every starting index, separated by spaces, or -1 if there is none.

## Explanation

The prefix function of p = aba is [0, 0, 1]: in the prefix aba, a is both a proper prefix and a suffix. In t = abababa, aba starts at indices 0, 2 and 4, and the three occurrences overlap.

## Hints

- Compute pi[i] starting from j = pi[i - 1]: if p[i] equals p[j], it is j + 1; otherwise set j = pi[j - 1] and try again, down to j = 0.
- Matching is the same loop: feed the text to the pattern pointer j one character at a time. When j reaches |p| there is a match; continue with j = pi[j - 1] so overlapping occurrences are found too.
- Another way: compute the prefix function of p + '#' + t once; positions where it equals |p| end a match.
