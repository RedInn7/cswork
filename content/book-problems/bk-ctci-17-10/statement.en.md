# The Majority Element
A value is the majority element if it occurs strictly more than half as many times as the array's length. Print the majority element of the given array, or -1 if there is none.

## Input
The first line holds an integer n (1 ≤ n ≤ 100000).
The second line holds n integers from 1 to 10^9.

## Output
One integer: the majority element or -1.

## Sample explanation
In sample 1, 5 occurs 5 times, more than half of 9.
In sample 2, 3 occurs 2 times, exactly half of 4 and not more, so there is no majority element.

## Hints
- Boyer-Moore voting: keep a candidate and a count, add one for an equal value, subtract one otherwise, and switch candidates at zero. The surviving candidate is only a possible majority; scan again to confirm it really occurs more than half the time.
- O(n) time and O(1) extra space.
