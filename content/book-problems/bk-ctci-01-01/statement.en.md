# Are All Characters Different?
For each given string, decide whether its characters are all different (upper and lower case letters are different characters).

## Input
The first line holds an integer t (1 ≤ t ≤ 1000).
Each of the next t lines holds a string of 1 to 100 visible ASCII characters, codes 33 to 126 (no spaces).

## Output
t lines, each true or false: true when no character repeats.

## Sample explanation
banana repeats a and n, so it is false; xyz and aA1! repeat nothing, so both are true.

## Hints
- Keep a boolean array of size 128 for the characters seen and stop at the first repeat.
- Without extra structures, sort and compare neighbours. If you use an integer as a bitmap, note that there are 94 visible characters: a 32-bit integer cannot hold them, and in many languages 1 << 40 silently becomes 1 << 8.
