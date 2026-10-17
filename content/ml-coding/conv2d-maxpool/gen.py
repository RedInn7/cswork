import json
import random

rng = random.Random(20261027)


def text(image, kernel, bias, stride, padding):
    head = f"{len(image)} {len(image[0])} {len(kernel)} {len(kernel[0])} {stride} {padding} {bias}\n"
    return head + "".join(" ".join(map(str, row)) + "\n" for row in image + kernel)


def grid(rows, cols, low, high):
    return [[rng.randint(low, high) for _ in range(cols)] for _ in range(rows)]


def case(h, w, kh, kw, stride, padding):
    assert (h + 2 * padding - kh) // stride + 1 >= 2 and (w + 2 * padding - kw) // stride + 1 >= 2
    # A half-integer bias keeps every output off -1, the float-array checker's exact-match sentinel.
    return text(grid(h, w, 0, 255), grid(kh, kw, -3, 3), f"{rng.randint(-200, 200)}.5", stride, padding)


image = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 8, 7, 6], [5, 4, 3, 2]]
sample = text(image, [[0, 1, 0], [1, -4, 1], [0, 1, 0]], 0, 1, 1)
# A 5×5 output pools to 2×2: its last row and column are dropped.
odd = text(grid(5, 5, -9, 9), [[1]], "0.5", 1, 0)
# Kernel as large as the padded image, stride larger than the kernel.
edges = text(grid(3, 3, -5, 5), [[1, -1, 2], [0, 3, 1], [2, 2, -2]], "-1.5", 4, 2)
negative = text(grid(4, 6, -20, -1), [[1, 1], [1, 1]], "-4.5", 1, 0)

print(json.dumps({
    "samples": [sample],
    "tests": [odd, edges, negative, case(8, 8, 3, 3, 1, 0), case(28, 28, 5, 5, 1, 2), case(64, 48, 3, 4, 2, 1),
              case(33, 17, 2, 2, 3, 0)],
}))
