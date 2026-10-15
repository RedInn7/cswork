# One Edit Away
A string can be edited in three ways: insert a character, delete a character, or replace one character with another. For each pair of strings, decide whether at most one edit makes them equal (pairs that are already equal count).

## Input
The first line holds an integer t (1 ≤ t ≤ 1000).
Each of the next t lines holds two lowercase strings a and b separated by a space, each of length 1 to 1000.

## Output
t lines, each true or false.

## Sample explanation
Deleting e from pale gives pal: true. pales and pale differ by one s: true. Replacing p in pale with b gives bale: true. pale and bake need two replacements: false.

## Hints
- A length difference above 1 never works. With equal lengths, count the positions that differ; with lengths one apart, walk both strings with two pointers and let the longer one skip one character.
- Counting letters is not enough, order matters too: ab and ba need two edits.
