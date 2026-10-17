# Linear Regression: Ridge in Closed Form

Given d features and a target y for each of n samples, and a regularization strength λ ≥ 0, find the weights w and intercept b that minimize, in closed form and without sklearn:

Σᵢ (yᵢ - xᵢ·w - b)² + λ·||w||²

**The intercept b is not penalized** (as in sklearn's `Ridge`). Implement `ridge_fit(X, y, lam)` returning `(w, b)`. The driver uses your w and b to compute the training mean squared error and prints it too.

One way: subtract each column's mean from X and the mean from y, solve (XcᵀXc + λI)·w = Xcᵀyc on the centered data, then recover the intercept as b = ȳ - x̄·w.

## Input

The first line holds n, d and λ. Each of the next n lines holds d features and a target.

1 ≤ n ≤ 2000, 1 ≤ d ≤ 8, 0 ≤ λ ≤ 10^5. XcᵀXc + λI is invertible and well conditioned.

## Output

The driver prints d + 2, then w's d components, b and the training mean squared error, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

x = [1, 2, 3], y = [3, 5, 7] and λ = 2. Centered, xc = [-1, 0, 1] and yc = [-2, 0, 2], so XcᵀXc = 2 and Xcᵀyc = 4, giving w = 4 / (2 + 2) = 1 and b = 5 - 2·1 = 3. Unpenalized, w would be 2: λ pulled it halfway to 0. The predictions are 4, 5 and 6, so the mean squared error is (1 + 0 + 1) / 3 ≈ 0.666667.

## Hints

- Solve the system with np.linalg.solve(A, b): faster and more accurate than np.linalg.inv(A) and a product.
- If you put the intercept in X as a column of ones, the penalty matrix needs a 0 on that column's diagonal entry, or the intercept is penalized too.
- λ = 0 is ordinary least squares.
