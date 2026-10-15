# Is This String a Number?
Decide whether a string reads as a decimal number. A valid number consists of, in order:
1. an optional sign, + or -;
2. an integer or a decimal. An integer is one or more digits; a decimal is "digits, a point, digits" with at least one digit on some side of the point (so 3., .5 and 3.14 are fine, a lone . is not);
3. an optional exponent: the letter e or E followed by an integer, which may carry one sign + or - and has at least one digit.
Nothing else may appear. For example 42, -0.5, +3., .25, 6e-2 and 1E9 are numbers; e5, 2e, 1.2.3, +-1, 3e2.5, 0x10 and nan are not.

## Input
The first line holds an integer t (1 ≤ t ≤ 1000).
Each of the next t lines holds a string of 1 to 40 visible characters (digits, letters, +, -, . and so on) without whitespace.

## Output
t lines, each true or false: whether the string is a number.

## Sample explanation
In sample 1 the first six strings are numbers and the last six are not: 3e has no exponent digits, 9x contains the letter x, 4.5.6 has two points, -+2 has two signs, 6e1.5 has a non-integer exponent and +. has no digit on either side of its point.

## Hints
- Scan by position: take the sign, then digits and the point while noting whether any digit appeared, then e/E and what follows it, and finally check that you reached the end.
- A finite-state machine works too. Avoid your language's float parser: it accepts spellings such as inf and nan that this problem rejects.
