# Similarity of Sparse Documents
There are n documents numbered 0 to n-1, each a set of distinct integers (think of word ids). The similarity of two documents is the size of their intersection divided by the size of their union. Find every pair of documents with similarity above 0 and print the similarity.
To avoid floating-point error, print the similarity as a reduced fraction p/q.

## Input
The first line holds an integer n (1 ≤ n ≤ 500).
Line i of the next n lines starts with k, the number of integers in document i (1 ≤ k ≤ 500), followed by k distinct integers from 0 to 10^5. All documents hold at most 50000 integers together.

## Output
The first line holds c, the number of pairs with similarity above 0.
Each of the next c lines holds i j p/q (i < j), ordered by i and then by j.

## Sample explanation
In sample 1, document 0 = {1, 2, 3} and document 1 = {2, 3, 4, 5} share {2, 3} out of {1, 2, 3, 4, 5}: 2/5. Document 0 and document 2 = {3, 9} share {3} out of 4 numbers: 1/4. Documents 1 and 2 share {3} out of 5: 1/5. Document 3 = {7} shares nothing.

## Hints
- With many sparse documents, intersecting every pair wastes time. Build an inverted index from each integer to the documents holding it, then count every pair within each list to get the intersection sizes; the union is |A| + |B| - intersection.
- Reduce fractions with the greatest common divisor, and subtract the intersection from the union, or you compute intersection over the sum of both sizes.
