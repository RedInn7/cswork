# The Two Missing Numbers
Exactly two of the integers 1 to N are missing; the other N-2 are given in some order. Find the two missing numbers.

## Input
The first line holds an integer N (3 ≤ N ≤ 100000).
The second line holds N-2 distinct integers between 1 and N.

## Output
One line with the two missing numbers in increasing order.

## Sample explanation
In sample 1, N = 6 and the numbers given are 6 1 3 4; 2 and 5 are missing.
In sample 2, N = 3 and only 2 is given; 1 and 3 are missing.

## Hints
- The sum of 1 to N minus the given sum is the sum s of the two missing numbers. The smaller one is at most s/2; summing 1 to s/2 and subtracting the given numbers up to s/2 yields it.
- XOR works too: XOR everything to get the two numbers' XOR, then split by its lowest set bit and XOR each group. If you solve with the sum of squares instead, mind that it overflows 32 bits.
