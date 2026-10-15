# The Majority Element
A value is the majority element if it occurs strictly more than half as many times as the array's length. Print the majority element of the given array, or -1 if there is none.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
The second line holds n integers from 1 to 10^9.

## Output
One integer: the majority element or -1.

## Sample explanation
In sample 1, 8 occurs 4 times, more than half of 7.
In sample 2, 4 occurs 2 times, exactly half of 4 and not more, and so does 6, so there is no majority element.

## Hints
- Boyer-Moore voting: keep a candidate and a count, add one for an equal value, subtract one otherwise, and switch candidates at zero. The surviving candidate is only a possible majority; scan again to confirm it really occurs more than half the time.
- O(n) time and O(1) extra space.
