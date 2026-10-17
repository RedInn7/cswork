# ROC-AUC: the Rank Formula and Tied Scores

A binary classifier has given every sample a score; label 1 is positive and 0 negative. Without sklearn, implement `roc_auc(y, scores)`, returning the area under the ROC curve (AUC).

AUC is the probability that a random positive scores higher than a random negative, with a tied pair counting half. Comparing every pair is O(P·N), too slow for large data. Use the **rank formula** after an O(n log n) sort:

- Sort all n scores in ascending order and rank them from 1. **Samples with equal scores share the average of their ranks**: if places 2, 3 and 4 tie, all three get rank 3.
- With P positives, N negatives and R the sum of the positives' ranks, AUC = (R - P(P+1)/2) / (P·N).

## Input

The first line holds the number of datasets T. Each dataset is a line with n, a line of n labels (0 or 1) and a line of n scores (real numbers, possibly negative or in scientific notation). Every dataset has at least one positive and one negative.

1 ≤ T ≤ 50, 2 ≤ n ≤ 2×10^4 per dataset, and the n's add up to at most 5×10^4.

## Output

The driver prints T, then each dataset's AUC with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

Dataset 1: the positives score 0.35 and 0.8 and the negatives 0.1 and 0.4. Of the four pairs only 0.35 against 0.4 goes to the negative, so AUC = 3/4. By ranks: 0.1→1, 0.35→2, 0.4→3, 0.8→4, so R = 2 + 4 = 6 and (6 - 3) / (2·2) = 0.75.

Dataset 2: the three 0.5's hold places 2 to 4 and share rank 3. The positives' ranks are 5, 3 and 3, so R = 11 and AUC = (11 - 6) / (3·2) ≈ 0.833333. Pair by pair gives the same: each 0.5 against 0.5 counts half.

## Hints

- np.unique(scores, return_inverse=True, return_counts=True) gives each distinct score's count; a run of ties ends at the running total e of the counts, so its average rank is e - (c - 1)/2.
- argsort positions are not ranks: tied scores get an arbitrary order and the AUC drifts.
- The rank sum stays below about n²/2, so floats or 64-bit integers never overflow.
