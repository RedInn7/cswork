# K-Means: Lloyd's Algorithm from Given Centers

Given n points in d dimensions and k initial centers, implement `kmeans(X, centers, max_iter)` without sklearn. Run Lloyd's algorithm as below and return `(final centers, each point's cluster)`:

1. **Assign** every point to its nearest center (Euclidean distance). **On a tie, the center with the lower index wins.**
2. Repeat at most max_iter times:
   - **Update**: move every center to the mean of its points. **A center with no points stays where it is.**
   - Reassign. If no point changed clusters, stop.
3. Return the final centers and the last assignment (which is each point's cluster under the final centers).

The initial centers are given, with no randomness, so the result can be judged. The driver uses your centers and clusters to compute the inertia (the sum of squared distances from each point to its center) and prints it too.

## Input

The first line holds n, d, k and max_iter. The next n lines hold the points and the next k lines the initial centers, d real numbers each.

1 ≤ n ≤ 500, 1 ≤ d ≤ 4, 1 ≤ k ≤ 8, 1 ≤ max_iter ≤ 50. No point is ever almost equally far from two different centers (only two identical centers tie), so every correct way of computing the distances gives the same assignment.

## Output

The driver prints how many numbers follow, then: the final centers row by row (k·d numbers), the n clusters and the inertia, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

The centers start at (1, 1), (2, 1) and (20, 20). First assignment: (1, 1) and (1, 2) go to center 0; (2, 1) and the three top-right points go to center 1; center 2 gets nothing. After the update center 0 is at (1, 1.5), center 1 at (6.75, 6.5) and center 2 stays at (20, 20). On reassignment (2, 1) is nearer center 0 and moves; the next update puts the centers at (4/3, 4/3) and (25/3, 25/3), the assignment no longer changes, and the loop stops. The inertia is 4/3 + 4/3 ≈ 2.666667.

## Hints

- Broadcasting gives the n×k matrix of squared distances in one go; argmin(axis=1) returns the lower index on a tie.
- Check for an empty cluster before averaging: mean of an empty array is NaN, with a warning.
- Stopping when the assignment stops changing is safer than comparing float centers for equality.
- The clusters you return must match the final centers: even when max_iter runs out, reassign once after the last update.
