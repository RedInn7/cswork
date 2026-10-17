# Principal Component Analysis (PCA)

PCA finds the orthogonal directions of greatest variance in the data, for reducing dimensions and decorrelating features. Given n samples in d dimensions, implement `pca(X, m)` without sklearn, returning `(components, ratios)`:

1. Subtract each column's mean to get the centered Xc.
2. The covariance matrix is C = XcᵀXc / (n - 1).
3. Eigendecompose C and sort the eigenvalues from largest down: λ₁ > λ₂ > ….
4. `components` holds the **unit** eigenvectors of the top m eigenvalues as the rows of an m×d matrix. An eigenvector times -1 is still an eigenvector, so **each row's largest-magnitude entry must be positive**.
5. `ratios` holds the top m explained variance ratios λᵢ / (λ₁ + … + λ_d).

The driver also prints every sample's projection onto the m components, Xc·componentsᵀ.

## Input

The first line holds n, d and m; each of the next n lines holds d real numbers.

2 ≤ n ≤ 300, 1 ≤ m ≤ d ≤ 6. The top m + 1 eigenvalues are clearly distinct and each component has a unique largest-magnitude entry, so the answer is unique.

## Output

The driver prints how many numbers follow, then the components row by row, the m ratios and the n×m projections row by row, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

The mean is (3, 1.5) and the covariance matrix [[20/3, 8/3], [8/3, 5/3]], with eigenvalues about 7.821952 and 0.511381, so the ratios are about 0.938634 and 0.061366. The first eigenvector may come out as (-0.917590, -0.397529); its largest-magnitude entry is negative, so it flips to (0.917590, 0.397529), and the second flips to (-0.397529, 0.917590). The first point (0, 0) centers to (-3, -1.5), whose projection on the first component is -3 × 0.917590 - 1.5 × 0.397529 ≈ -3.349062.

## Hints

- The covariance matrix is symmetric, so use np.linalg.eigh: it returns the eigenvalues in **ascending** order, so reverse them, and the eigenvectors are the **columns** of the matrix it returns.
- An SVD of Xc works too: the right singular vectors are the components, and a singular value σ gives the eigenvalue λ = σ² / (n - 1).
- The ratios divide by the sum of all d eigenvalues, the sum of the column variances (C's trace), not just the top m.
