# Signup validator: refactor, change nothing

`validate_signup()` in `src/signup.py` checks the signup form of the account service. It works: every test passes. It is also one 170-line function with branches nested five deep and the same digit-checking loop pasted for each country. The next person who adds a field will break something.

Your job is a pure refactoring:

- the function keeps its name and signature and returns exactly the same list of error codes, in the same order, for every possible form;
- nothing new: no extra validation, no friendlier messages, no fixed "bugs" (a user may well depend on them);
- the structure has to improve until `tests/test_metrics.py` passes.

`tests/test_metrics.py` measures `src/` with Python's own `ast` module and prints the starting numbers next to yours in the program output:

| measure | limit |
| --- | --- |
| longest function, in lines | 25 |
| branches in one function or lambda (`if`/`elif`, `for`, `while`, conditional expressions, each `if` of a comprehension, each `case` of a `match`, each extra `and`/`or` operand) | 8 |
| repeated blocks (three statements in a row, or an `if`/`for`/`while` of three lines or more, compared without literals and variable names) | 1 |

`src/` may not use `exec`, `eval` or `compile`: code run from strings would escape every measure.

Suggested way to work:

1. Read the code and the tests in `tests/`. Add tests for the corners you are unsure about before touching anything: an AI assistant can draft them, but check each expected value against the current code.
2. Move one field at a time into its own small function and run the tests after every step.
3. Replace the pasted loops with data: a table of rules is often shorter than the branches it replaces.

The hidden suite keeps a copy of the original function and compares your answers with it on chosen edge cases and on thousands of generated forms; it also runs the same structure checks. You only see how many of its tests pass.
