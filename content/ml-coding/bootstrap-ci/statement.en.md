# Bootstrap Confidence Interval

To see how reliable a sample mean is without assuming the data are normal, bootstrap it: resample the data **with replacement** B times, n values each, and look at how the resample means spread. Without scipy, implement `bootstrap_ci(x, B, level, seed)` returning `(sample mean, standard error, lower bound, upper bound)`.

Random numbers come from a given linear congruential generator (LCG), not `np.random`, so the answer is unique:

- state starts at seed. For each index, first update state ← (1664525·state + 1013904223) mod 2³², then take the index ⌊state·n / 2³²⌋.
- Generate resample 0's n indices, then resample 1's, and so on for B resamples; resample b's mean is m_b.

Then:

- The standard error is the sample standard deviation of the B means (dividing by B - 1).
- The interval is the **percentile** interval: with q = (1 - level) / 2, the lower bound is the q-quantile of the m's and the upper bound the (1 - q)-quantile. Quantiles interpolate linearly: sort the m's into s₀ … s_{B-1}, let h = (B - 1)·q, and the quantile is s_{⌊h⌋} + (h - ⌊h⌋)·(s_{⌊h⌋+1} - s_{⌊h⌋}) (`np.percentile`'s default method).

## Input

The first line holds n, B, level and seed; the second holds n real numbers.

2 ≤ n ≤ 200, 2 ≤ B ≤ 2000, n·B ≤ 2×10^5, 0 < level < 1, 0 ≤ seed < 2³².

## Output

The driver prints 4, then the sample mean, the standard error and the lower and upper bounds, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

x = [1, 2, 3, 4] and seed = 1. The first state is 1664525 + 1013904223 = 1015568748, giving the index ⌊1015568748·4 / 2³²⌋ = 0. Resample 0 draws indices [0, 1, 2, 2], mean 2.25; the five means are [2.25, 2.5, 2, 3, 3], whose standard deviation is about 0.447214. With level = 0.6, q = 0.2: sorted they are [2, 2.25, 2.5, 3, 3], h = 4 × 0.2 = 0.8 and the lower bound is 2 + 0.8 × 0.25 = 2.2; the upper bound has h = 3.2, between 3 and 3, so it is 3.

## Hints

- Each index uses the **updated** state; state·n stays below about 8.6×10^11, which Python integers handle easily.
- Generate all B·n indices first; after reshape(B, n), x[idx].mean(axis=1) gives every resample mean at once.
- Use std(ddof=1) for the standard error: numpy's std divides by B by default.
