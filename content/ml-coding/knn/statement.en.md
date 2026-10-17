# K-Nearest Neighbors

Given n labeled training points and m query points, all with integer coordinates, implement `knn_predict(X_train, y_train, X_query, k)` without sklearn, returning every query point's predicted class:

- Distance is **Euclidean** (comparing squared distances gives the same order).
- Take the k training points nearest to the query. **At equal distance, the point with the lower training index counts as nearer.**
- The class that occurs most among those k is the prediction. **On a tie in votes, take the smallest class.**

The tie rules are what make the answer unique: in a real interview, ask about them first.

## Input

The first line holds n, m, d and k. Each of the next n lines holds d coordinates and a class. Each of the next m lines holds a query point's d coordinates.

1 ≤ k ≤ n ≤ 2000, 1 ≤ m ≤ 300, 1 ≤ d ≤ 8, every coordinate's absolute value is at most 100, and classes are integers from 0 to 9.

## Output

The driver prints m, then each query's predicted class with 6 decimals.

## Explanation

k = 3. The nearest points to (0, 0) are (0, 0), (1, 0) and (0, 1), of classes 0, 0 and 1, so the prediction is 0. The three nearest to (5, 4) have classes 1, 2 and 0, one vote each, so the smallest, 0, wins. For (3, 3) the nearest is (5, 5) at squared distance 8; (1, 0), (0, 1) and (6, 5) all lie at 13, and by index (1, 0) and (0, 1) come first. Their classes are 1, 0 and 1, so the prediction is 1.

## Hints

- Broadcasting gives every squared distance at once: ((Q[:, None, :] - X[None, :, :]) ** 2).sum(axis=2) is an m×n matrix.
- np.argsort(..., kind='stable') keeps equal distances in index order; the default quicksort does not promise that.
- np.bincount(labels).argmax() returns the class with the most votes, and on a tie exactly the smallest one.
