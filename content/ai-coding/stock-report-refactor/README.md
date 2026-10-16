# Stock report: not one character moves

`stock_report()` in `src/report.py` replays a day of warehouse movements (goods in, goods out, cycle counts and transfers between warehouses) and prints the report the warehouse leads read at 7am: stock and value per warehouse, items below their reorder point, and the movements it had to reject. A script pastes the text into a shared sheet and splits the columns on their exact spacing, so the output may not change by a single character.

It is one 130-line function. The money formatting is pasted three times, the name cutting twice, and every kind of movement is another branch of the same loop.

Refactor it:

- `stock_report(items, movements)` keeps its signature and returns exactly the same text for any input, including rejected movements and their issue lines;
- no behaviour changes, not even ones that look like fixes (a whitespace-only warehouse name is still a warehouse);
- improve the structure until `tests/test_metrics.py` passes.

`tests/test_metrics.py` measures `src/` with Python's own `ast` module and prints the starting numbers next to yours in the program output:

| measure | limit |
| --- | --- |
| longest function, in lines | 25 |
| branches in one function or lambda (`if`/`elif`, `for`, `while`, conditional expressions, each `if` of a comprehension, each `case` of a `match`, each extra `and`/`or` operand) | 8 |
| repeated blocks (three statements in a row, or an `if`/`for`/`while` of three lines or more, compared without literals and variable names) | 1 |

`src/` may not use `exec`, `eval` or `compile`: code run from strings would escape every measure.

Suggested way to work:

1. Separate the two jobs first: applying the movements, and writing the text. Compare the whole report string in your tests: a test that only checks one line misses a shifted column.
2. Give each kind of movement its own small function; a dictionary from kind to function replaces the `elif` chain.
3. One helper per repeated format: money, and a row of the table.

The hidden suite keeps a copy of the original function and compares the full text with it for chosen and for generated movement histories, and runs the same structure checks. You only see how many of its tests pass.
