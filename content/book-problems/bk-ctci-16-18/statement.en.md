# Match a String Against an a/b Pattern
A pattern contains only the letters a and b. Assign a string to a and a string to b (either may be empty, but they must differ); if replacing every a and b in the pattern gives exactly value, value matches the pattern. For each given pattern and value, decide whether they match.

## Input
The first line holds an integer t (1 ≤ t ≤ 20).
Each case takes two lines: the pattern (length 1 to 1000) and value (lowercase letters, length 1 to 1000).

## Output
t lines, each true or false.

## Sample explanation
abba with dogcatcatdog: a = dog and b = cat match.
abba with dogcatcatfish: the a at both ends must be equal, so no match.
abba with dogdogdogdog: a = dogdog and an empty b match.
aabbb with xxxxx: only a = b = x would work, and a and b must differ, so no match.

## Hints
- With ca copies of a and cb of b, try every length la for a; the length of b follows from ca·la + cb·lb = |value|. Cut value along the pattern and check that all a pieces agree, all b pieces agree and the two differ.
- Remember that the empty string is a valid assignment, and that a pattern may use only one letter.
