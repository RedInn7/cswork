# Draw a Horizontal Line on a Monochrome Screen
A monochrome screen is w pixels wide, one bit per pixel (1 is lit). It is stored row by row in an array screen of 32-bit integers: each integer holds 32 consecutive pixels of a row, and a lower pixel number sits at a higher bit (the leftmost pixel is the integer's top bit). The array has length integers, so the screen has length·32/w rows.
The screen starts dark. Light pixels x1 through x2 (both included, counting from 0) of row y, then print the whole array as 32-bit signed integers; an integer with its top bit set is negative.

## Input
One line with five integers length, w, x1, x2 and y: 1 ≤ length ≤ 1000, w is a multiple of 32 and divides length·32, 0 ≤ x1 ≤ x2 < w and 0 ≤ y < length·32/w.

## Output
One line with length integers separated by spaces.

## Sample explanation
In sample 1, length = 1 and w = 32; lighting pixels 28 to 31 of row 0 sets the four lowest bits, which gives 15.
In sample 2, length = 3 and w = 96, so row 0 spans three integers; lighting pixels 0 and 1 sets the top two bits of the first integer, -1073741824 as a signed integer.

## Hints
- Pixel x of row y lives at array index (y·w + x) / 32, at the (x mod 32)-th bit from the top of that integer, which is bit 31 - x mod 32.
- Set the whole integers in between to all ones (-1); only the first and last integers need masks.
