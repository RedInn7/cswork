# Decision Stump: the Best Gini Split

Every decision tree node looks for a feature and a threshold that split its samples in two. Given n samples with d integer features and a class each (0 to c - 1), implement two functions without sklearn:

- `gini(y, c)`: the Gini impurity 1 - Σₖ pₖ², pₖ being the share of class k.
- `best_split(X, y, c)`: return `(feature index, threshold, weighted Gini)`.

Candidate splits: for each feature, sort its distinct values; **the midpoint of each two neighboring values** is a candidate threshold. Samples with the feature **≤ the threshold go left**, the rest go right. A split's weighted Gini is (n_L / n)·Gini(left) + (n_R / n)·Gini(right). Return the split with the lowest weighted Gini. The best split is unique, and at least one feature takes two or more values.

## Input

The first line holds n, d and c. Each of the next n lines holds d integer features and a class.

2 ≤ n ≤ 2000, 1 ≤ d ≤ 6, 2 ≤ c ≤ 4, and features lie between 0 and 10^6.

## Output

The driver prints 4, then the overall Gini, and the best split's feature index, threshold and weighted Gini, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

Of the 7 samples, 3 are class 0 and 4 class 1, so the overall Gini is 1 - (3/7)² - (4/7)² ≈ 0.489796. Splitting feature 0 at 4.5 puts classes [0, 0, 1, 0] on the left, with Gini 1 - (3/4)² - (1/4)² = 0.375, and a pure [1, 1, 1] on the right, for a weighted Gini of 4/7 × 0.375 ≈ 0.214286. Feature 0 at 2.5 gives 5/7 × 0.32 ≈ 0.228571 and feature 1 at 4.5 about 0.404762: both worse.

## Hints

- Sort each feature once and sweep left to right, keeping the left side's count per class (the right side is the total minus the left). Each candidate then costs O(c), for O(d·n log n) overall.
- Only split where two neighboring values **differ**: samples with equal values must land on the same side.
- The weighted Gini is also (n_L - Σ L_k²/n_L + n_R - Σ R_k²/n_R) / n, with L_k and R_k the class counts on each side, which is simpler to compute.
