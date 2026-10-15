# Build the Smallest Number
Given some non-negative integers, write all of them end to end as one digit string, each exactly once in any order. Print the lexicographically smallest string you can build (every result has the same length, so this is also the smallest value). Keep leading zeros.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
The second line holds n integers, each between 0 and 10^9.

## Output
One line: the smallest digit string.

## Sample explanation
In sample 1, 3 and 30 join as 330 or 303, and 303 is smaller, so 30 goes before 3. The answer is 3033459.
Sample 2 builds 0012 and keeps the leading zeros.

## Hints
- For two numbers a and b, put a first when the joined string ab is smaller than ba. Sort with that rule and join; the rule is transitive.
- Plain lexicographic sorting is wrong: putting 3 before 30 gives 330.
