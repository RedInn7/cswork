# Numerically Stable Softmax and Log-Softmax

A network's output layer gives a row of logits z, and softmax turns it into probabilities: softmax(z)ᵢ = e^{zᵢ} / Σⱼ e^{zⱼ}. Without scipy or PyTorch, implement for **every row** of an n×k matrix:

- `softmax(z)`: row-wise softmax.
- `log_softmax(z)`: row-wise log(softmax(z)).

The formula as written breaks: e^{1000} overflows to inf and inf / inf is NaN; e^{-1000} underflows to 0 and log 0 is -inf. Since softmax(z) = softmax(z - c) for any constant c, **subtract each row's maximum** before exponentiating; write log-softmax as (z - m) - log Σ e^{zⱼ - m} rather than taking the log of a computed softmax.

## Input

The first line holds n and k. Each of the next n lines holds k real logits.

1 ≤ n·k ≤ 2×10^4, and every logit's absolute value is at most 10^5.

## Output

The driver prints 2nk, then the softmax matrix row by row and the log-softmax matrix row by row, each number with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted; a NaN or inf never is.

## Explanation

Row [1, 2, 3]: minus its maximum 3 it is [-2, -1, 0], whose exponentials [0.1353, 0.3679, 1] add up to 1.5032, so softmax ≈ [0.090031, 0.244728, 0.665241] and log-softmax = [-2, -1, 0] - ln 1.5032 ≈ [-2.407606, -1.407606, -0.407606]. Row [1000, 1000, 999] overflows if exponentiated directly; minus 1000 it is [0, 0, -1]. In the third row the smallest probability is about e^{-100} and prints as 0, but its log-softmax is exactly -100.

## Hints

- z.max(axis=1, keepdims=True) keeps the dimension, so the subtraction broadcasts row by row.
- After the shift every row has at least one e⁰ = 1: the denominator is never 0 and neither is the log's argument.
- log(softmax) turns probabilities below about 10⁻³⁰⁸ into -inf, which is why cross-entropy losses work from log-softmax directly.
