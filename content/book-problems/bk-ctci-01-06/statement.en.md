# Run-Length Compression
Write every run of equal letters in a string as the letter followed by the run's length: ppqrrrrs becomes p2q1r4s1. If the result is not shorter than the original string, keep the original. Print the final string.

## Input
One line: a string of 1 to 50000 upper and lower case letters (different cases are different letters).

## Output
One line: the compressed string or the original.

## Sample explanation
xxxyzzzzzz compresses to x3y1z6, length 6, shorter than the original 10, so the compressed form is printed.
aabcdd compresses to a2b1c1d2, length 8, which is longer, so the original is printed.

## Hints
- One pass: when the letter changes, write out the previous run, and do not forget the last one. A length can have several digits, as in a12.
- Build the result with a StringBuilder, a list or another mutable buffer instead of copying the whole string on every append.
