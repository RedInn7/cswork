# A Conv Layer's Forward Pass: Conv2D, ReLU and Max Pooling

Given an H×W single-channel image, a kh×kw kernel, a bias b, a stride s and a padding p, implement the most basic forward pass of a convolutional network without PyTorch:

- `conv2d(image, kernel, bias, stride, padding)`: pad the image with p rings of zeros, slide the kernel over it s cells at a time, and at each position output the **sum of elementwise products** plus the bias. The output has ⌊(H + 2p - kh) / s⌋ + 1 rows and ⌊(W + 2p - kw) / s⌋ + 1 columns.
- `max_pool(x)`: 2×2 max pooling with stride 2. With an odd number of rows or columns, **the last row or column is dropped**.

Note that a deep learning framework's "convolution" is really **cross-correlation**: the kernel is not flipped. The driver passes conv2d's result through ReLU (negatives become 0) before max_pool.

## Input

The first line holds H, W, kh, kw, s, p and b. The next H lines hold the image and the next kh lines the kernel, all integers; the bias b is a real number.

1 ≤ H, W ≤ 64, 1 ≤ kh, kw ≤ 5, 1 ≤ s ≤ 4, 0 ≤ p ≤ 2. The convolution's output is at least 2×2.

## Output

The driver prints how many numbers follow, then: the convolution output's rows and columns, the pooled output's rows and columns, the convolution output row by row and the pooled output row by row, each with 6 decimals.

## Explanation

A 4×4 image, a 3×3 Laplacian kernel, p = 1 and s = 1 give a 4×4 convolution. The top-left position covers padding: above and left are 0, the center 1 times -4, right 2 and below 5, for 3. Position (1, 1) is centered on 6 with 2, 8, 5 and 7 around it, for 22 - 24 = -2. After ReLU the 2×2 pooling takes 3 from the top-left block [3, 2, 0, 0], and the four blocks' maxima are [3, 1, 0, 1].

## Hints

- np.pad(image, p) adds the zeros on all four sides at once.
- Output position (i, j) covers the kh×kw window starting at (i·s, j·s) of the padded image; (window * kernel).sum() is that cell.
- Pooling needs no loop: drop the extra row or column, then reshape(ph, 2, pw, 2).max(axis=(1, 3)).
