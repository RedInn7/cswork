# Log Loss: Cross-Entropy with Clipping

A multiclass model has output probabilities over k classes for every sample. Without sklearn, implement `log_loss(y, probs)`, returning the mean cross-entropy:

- Take each sample's predicted probability p of its **true class** and clip it to [ε, 1 - ε], where ε = `EPS` = 10⁻¹⁵.
- The loss is the mean of -ln p over the samples.

Clipping keeps one sample that gave its true class probability 0 from making the loss infinite: clipped, it adds -ln 10⁻¹⁵ ≈ 34.538776. Use the probabilities as given; **do not renormalize** them.

## Input

The first line holds the number of datasets T. Each dataset is a line with n and k, then n lines, each with a true class (0 to k - 1) and k probabilities.

1 ≤ T ≤ 50, 1 ≤ n ≤ 3000 and 2 ≤ k ≤ 20 per dataset, and the n·k's add up to at most 5×10^4.

## Output

The driver prints T, then each dataset's log loss with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

In dataset 1 the true classes got 0.9, 0.8 and 0.4, so the loss is -(ln 0.9 + ln 0.8 + ln 0.4) / 3 ≈ 0.414932. In dataset 2 the first sample adds -ln 0.5 ≈ 0.693147; the second gave its true class 0, clipped to 10⁻¹⁵ for 34.538776, so the mean is about 17.615962.

## Hints

- Fancy indexing takes every true-class probability at once: probs[np.arange(n), y].
- Clip with np.clip(p, EPS, 1 - EPS) before np.log, and there is no log(0) warning and no inf.
- The upper clip barely matters, but the lower one does: a single 0 turns the whole loss into inf.
