# The First Letter That Appears Once
Given a string of lowercase letters, read it from the left and find the first letter that occurs exactly once in the whole string.

## Input
One line: a string of 1 to 100000 lowercase letters.

## Output
The first letter that appears once; if every letter appears more than once, print none.

## Sample explanation
In sample 1, p and q appear twice each and r once, so the answer is r.
In sample 2 every letter appears twice.

## Hints
- Two passes: count every letter, then scan in order for the first letter whose count is 1.
- Checking only whether the letter occurs again later is not enough; a letter seen earlier is not alone either.
