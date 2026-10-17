# Scaled Dot-Product Attention with a Causal Mask

At the heart of the Transformer is scaled dot-product attention: Attention(Q, K, V) = softmax(QKᵀ / √d_k)·V. Given the queries Q (T×d_k), keys K (T×d_k) and values V (T×d_v) of a length-T sequence, implement `attention(Q, K, V, causal)` without PyTorch, returning `(output, attention weights)`:

- The scores S = QKᵀ / √d_k form a T×T matrix.
- When causal is true, apply a **causal mask**: position i may only see j ≤ i, so scores with j > i become -∞ (weight 0 after softmax). This is what keeps a language model from peeking at later tokens while decoding.
- The weights A are S with softmax applied to each row; the output is A·V, a T×d_v matrix.

Scores can reach the thousands, so use the softmax that subtracts each row's maximum.

## Input

The first line holds T, d_k, d_v and causal (1 for the mask, 0 for none). Then come Q's T rows and K's T rows (d_k reals each) and V's T rows (d_v reals each).

1 ≤ T ≤ 64, 1 ≤ d_k, d_v ≤ 16, and every number's absolute value is at most 30.

## Output

The driver prints how many numbers follow, then the attention weights (T×T, row by row) and the output (T×d_v, row by row), each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

d_k = 2, so the scale is √2. Row 0 sees only itself: weights [1, 0, 0], and the output is V's row 0, [1, 0]. Row 1 scores [0, 1/√2], whose softmax is [0.330238, 0.669762], so its output is 0.330238·[1, 0] + 0.669762·[0, 1]. Row 2 scores [1, 1, 2] / √2, weighted [0.248255, 0.248255, 0.503490], for an output of about [1.255235, 1.255235].

## Hints

- np.triu(np.ones((T, T), dtype=bool), k=1) marks exactly the positions with j > i; np.where(mask, -np.inf, S) turns them into -∞.
- The diagonal is never masked, so every row keeps a finite score and subtracting the row maximum never computes -∞ - (-∞) = NaN.
- Do divide by √d_k: unscaled, scores grow with d_k, the softmax approaches one-hot and its gradients vanish.
