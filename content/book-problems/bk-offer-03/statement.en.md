# Find Every Reused Label
A warehouse labels n parcels with integers from 0 to n-1. A data-entry slip put some labels on more than one parcel (at least one label is reused). Find every label that was used more than once.

## Input
The first line holds an integer n (2 ≤ n ≤ 100000).
The second line holds n integers, the label of each parcel, each between 0 and n-1. At least one label appears two or more times.

## Output
One line: every label that appears at least twice, in increasing order, separated by spaces, each label printed once.

## Sample explanation
In sample 1, label 1 appears twice and label 4 three times; every other label appears once, so the answer is 1 4.
Sample 2 has two parcels, both labelled 1.

## Hints
- Labels lie exactly in 0..n-1, so a counting array of length n can replace a hash table.
- For O(1) extra space, swap each value to the index equal to it; if that slot already holds the same value, the value is a repeat.
