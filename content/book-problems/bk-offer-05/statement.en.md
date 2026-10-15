# Encode Spaces as %20
A URL cannot hold a raw space; it is written as %20. Given one line of text, replace every space with %20 and leave every other character as it is.

## Input
One line of length 1 to 10000 made of letters, digits, punctuation and spaces. It may start or end with spaces and may contain runs of spaces.

## Output
One line: the text after the replacement.

## Sample explanation
Sample 1 has two spaces, each becoming %20.
Sample 2 starts with a space and has two spaces in a row; each one is replaced separately, which gives %20%20.

## Hints
- Count the spaces first to know the final length, then fill the result from the back so each character moves once.
- Do not trim the ends and do not merge runs of spaces.
