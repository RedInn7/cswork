# As Many Pairs Summing to a Target as Possible
Given an integer array and a target, pair up numbers so that every pair sums to target, using each number at most once. Find the largest possible number of pairs and list them.

## Input
The first line holds two integers n and target (1 ≤ n ≤ 100000, |target| ≤ 10^9).
The second line holds n integers, each with absolute value at most 10^9.

## Output
The first line holds k, the largest number of pairs.
Each of the next k lines holds one pair x y (x ≤ y); list the pairs by increasing x (then y). With the most pairs, the collection of pairs is unique.

## Sample explanation
In sample 1, 5 and 7 make two pairs (each appears twice) and 6 pairs with 6: 3 pairs.
In sample 2 there is only one 3, so 3+3 cannot be formed.

## Hints
- Count values in a hash map: value x forms min(cnt[x], cnt[target-x]) pairs, or cnt[x] / 2 when x equals target-x.
- Or sort and pair from both ends with two pointers.
