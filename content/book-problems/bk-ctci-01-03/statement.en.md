# URL-encode Spaces Up to the True Length
A character array has spare room at its end; only its first L characters are real content. Replace every space among those L characters with %20 and print the result; the spare room at the end is not content and is not printed.

## Input
The first line holds an integer L (1 ≤ L ≤ 100000).
The second line holds a string of length at least L made of letters, digits, punctuation and spaces. Its first L characters are the content (which may itself start or end with spaces); everything after them is spaces.

## Output
One line: the content after the replacement.

## Sample explanation
In sample 1 the second line is "go to the zoo" followed by 6 spare spaces; the true length is 13 and the result is go%20to%20the%20zoo.
In sample 2 the content is "a b ", and its last space is content too, so it is replaced.

## Hints
- Work on the first L characters only: count their spaces c; the result has length L + 2c. Filling the array from the back never overwrites characters you still need.
- Do not trim the line, and do not encode the spare room.
