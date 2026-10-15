# Build the Smallest Number
Given some non-negative integers, write all of them end to end as one digit string, each exactly once in any order. Print the lexicographically smallest string you can build (every result has the same length, so this is also the smallest value). Keep leading zeros.

## Input
The first line holds an integer n (1 ≤ n ≤ 20000).
The second line holds n integers, each between 0 and 10^9.

## Output
One line: the smallest digit string.

## Sample explanation
In sample 1, 7 and 70 join as 770 or 707, and 707 is smaller, so 70 goes before 7; likewise 757 is smaller than 775, so 75 also goes before 7. The answer is 2707578.
Sample 2 builds 0012 and keeps the leading zeros.

## Hints
- For two numbers a and b, put a first when the joined string ab is smaller than ba. Sort with that rule and join; the rule is transitive.
- Plain lexicographic sorting is wrong: putting 7 before 70 gives 770, while 707 is smaller.
