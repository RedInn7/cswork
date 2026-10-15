# Write a Fraction in Binary
Given a real number between 0 and 1 written as a decimal, write its binary expansion in the form 0.101. If the binary expansion does not end within 32 digits after the point, print ERROR.

## Input
One line: a decimal x such as 0.625, with 0 < x < 1, at most 32 digits after the point and no trailing zeros.

## Output
The binary expansion of x (at most 32 digits after the point, no trailing zeros), or ERROR.

## Sample explanation
0.8125 = 1/2 + 1/4 + 1/16, which is 0.1101 in binary.
0.3 in binary repeats forever, 0.0100110011…, so the answer is ERROR.

## Hints
- Multiply by 2 repeatedly: if the integer part becomes 1, write 1 and subtract it, otherwise write 0, until nothing is left; more than 32 digits means failure.
- Floating point cannot hold decimals like 0.1 exactly and can drift as you multiply. Safest is to treat the input as the fraction p/10^k in integers: the expansion ends exactly when the reduced denominator is a power of 2 not above 2^32.
