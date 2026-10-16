# Log parser: three formats, one copy-paste

`src/logparse.py` reads the logs of three generations of services into records, and `summarize()` builds the on-call dashboard's summary from them. Two alerting jobs read that summary, so every key and value has to stay as it is. The tests pass. The code, though, is two long functions: the timestamp check, the level mapping and the service clean-up are pasted into each format's branch, and the logfmt scanner is a hand-written state machine inline.

Refactor it:

- `parse_line()` and `summarize()` keep their names and signatures and return exactly what they return now, for any input, including the odd cases (which key wins when one repeats, what counts as a timestamp, which lines are "skipped");
- no behaviour changes, not even ones that look like fixes;
- improve the structure until `tests/test_metrics.py` passes.

`tests/test_metrics.py` measures `src/` with Python's own `ast` module and prints the starting numbers next to yours in the program output:

| measure | limit |
| --- | --- |
| longest function, in lines | 25 |
| branches in one function or lambda (`if`/`elif`, `for`, `while`, conditional expressions, each `if` of a comprehension, each `case` of a `match`, each extra `and`/`or` operand) | 8 |
| repeated blocks (three statements in a row, or an `if`/`for`/`while` of three lines or more, compared without literals and variable names) | 1 |

`src/` may not use `exec`, `eval` or `compile`: code run from strings would escape every measure.

Suggested way to work:

1. Pin the behaviour first. The quirks are the dangerous part: a repeated `key=value` at the end of a classic line, a JSON line whose `ts` is empty, a logfmt value with an escaped quote. Ask an AI assistant to list the cases it sees, then check each one against the code by running it.
2. Pull the shared part (timestamp, level, service) into one function that every format uses.
3. Give each format its own small parser, then simplify `summarize()`; the standard library has a counter for this.

The hidden suite keeps a copy of the original code and compares your results with it on chosen lines and on thousands of generated ones, and runs the same structure checks. You only see how many of its tests pass.
