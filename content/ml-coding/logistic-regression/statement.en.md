# Logistic Regression: Gradient Descent with L2

A binary training set has n samples with d features and labels 0 or 1. Without sklearn, implement `train_logistic(X, y, lr, lam, epochs)`, training logistic regression by **full-batch gradient descent**, and return `(w, b)`.

The model is p = σ(x·w + b) with σ(z) = 1 / (1 + e⁻ᶻ). The loss is the mean cross-entropy plus the L2 term (λ/2)·||w||²; **the intercept b is not regularized**. Follow these steps exactly, so the result is unique:

1. Start from w = 0 (all components) and b = 0.
2. Repeat epochs times: compute every sample's p from the **current** w and b, let g = p - y, then update both at once:
   - w ← w - lr·(Xᵀg / n + λ·w)
   - b ← b - lr·mean(g)

The driver uses your w and b to compute the positive-class probability of m query points and prints them too.

## Input

The first line holds n, d, m, lr, λ and epochs. Each of the next n lines holds d features and a label; each of the next m lines holds a query point's d features.

1 ≤ n ≤ 500, 1 ≤ d ≤ 6, 1 ≤ m ≤ 100, 0 < lr ≤ 1, 0 ≤ λ ≤ 2, 1 ≤ epochs ≤ 300, and every feature's absolute value is at most 3.

## Output

The driver prints how many numbers follow, then w's d components, b and the m query probabilities, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

x = [0, 1, 2, 3], y = [0, 0, 1, 1], lr = 0.5, λ = 0, and a single step. At first every p = 0.5, so g = [0.5, 0.5, -0.5, -0.5]. Xᵀg / n = (0 + 0.5 - 1 - 1.5) / 4 = -0.5, so w = 0 - 0.5·(-0.5) = 0.25; g averages 0, so b stays 0. The queries 0, 2 and 4 get σ(0) = 0.5, σ(0.5) ≈ 0.622459 and σ(1) ≈ 0.731059.

## Hints

- One step takes two matrix products, X @ w and X.T @ g: no loop over samples.
- Compute both gradients before updating either: updating w first and then using the new w for b's gradient is wrong.
- 1 / (1 + np.exp(-z)) overflows with a warning for very negative z; the driver's 0.5·(1 + tanh(z/2)) is the same function without the overflow.
