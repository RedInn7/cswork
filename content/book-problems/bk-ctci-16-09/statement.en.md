# Subtract, Multiply and Divide With Addition Only
The book's problem: using only the addition operator, implement integer subtraction, multiplication and division. Here you get expressions to evaluate; whether you limit yourself to addition is your own challenge.
Division truncates toward zero, dropping any fraction (-7 / 2 = -3 and 7 / -2 = -3).

## Input
The first line holds an integer t (1 ≤ t ≤ 10000).
Each of the next t lines holds an expression a op b, where op is one of -, * and /, and a and b are integers of absolute value at most 10^9; for division b ≠ 0.

## Output
t lines, the value of each expression.

## Sample explanation
-7 / 2 is exactly -3.5, which truncates to -3.
6 * -4 = -24 and 5 - -3 = 8.

## Hints
- Subtraction: a - b = a + (-b), and negation can be built by adding -1 repeatedly or with bit tricks. Multiplication: split |b| into powers of two and add doubled copies of |a|, then fix the sign. Division: try 2^k multiples of |b| from large to small and subtract when they fit.
- Many languages floor integer division of negatives (such as Python's //), which differs from truncation toward zero.
