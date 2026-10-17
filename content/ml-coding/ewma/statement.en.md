# EWMA and Its Bias Correction

An exponentially weighted moving average gives recent data more weight; it smooths monitoring metrics and is the momentum in the Adam optimizer. Given a series x₁ … xₙ and a smoothing factor α (0 < α ≤ 1), implement `ewma(x, alpha)` without pandas, returning two series of length n, `(s, v_hat)`:

- **The recursive EWMA**: s₁ = x₁ and sₜ = α·xₜ + (1 - α)·sₜ₋₁.
- **The bias-corrected EWMA**: v₀ = 0, vₜ = (1 - α)·vₜ₋₁ + α·xₜ, corrected as v̂ₜ = vₜ / (1 - (1 - α)ᵗ).

Starting from 0 pulls the early vₜ toward 0, and dividing by 1 - (1 - α)ᵗ cancels exactly that bias: this is Adam's m̂. The two equal pandas' `ewm(alpha=α, adjust=False).mean()` and `ewm(alpha=α, adjust=True).mean()`.

## Input

The first line holds n and α; the second holds n real numbers.

1 ≤ n ≤ 10^4, 0 < α ≤ 1, and every number's absolute value is at most 10^4.

## Output

The driver prints 2n, then s₁ … sₙ and v̂₁ … v̂ₙ, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

α = 0.5 and x = [10, 20, 20, 5]. Recursively, s = [10, 15, 17.5, 11.25]. Bias-corrected: v₁ = 5, divided by 1 - 0.5 = 0.5 gives 10; v₂ = 2.5 + 10 = 12.5, over 0.75 gives 16.666667; v₃ = 16.25, over 0.875 gives 18.571429; v₄ = 10.625, over 0.9375 gives 11.333333.

## Hints

- The recursion runs in order: one O(n) loop is all it takes.
- Do not unroll the recursion into vector operations with (1 - α)⁻ᵗ: with a small α and a large n it overflows or loses precision.
- With α = 1 both EWMAs equal the series, and (1 - α)ᵗ = 0 divides by nothing worse than 1.
