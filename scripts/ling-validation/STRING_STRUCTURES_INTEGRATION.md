# String/character structure integration

The nine fixed protocols are registered in generation, verification, import, the runtime engine, and the offline publisher.

- Batch: `batches.selected_strings1.PROBLEMS`, exactly 49, 249, 68, 257, 721, 131, 51, 130, 37.
- Input: one JSON positional-argument array and newline.
- Output: one complete JSON array and exactly one terminal newline. JSON whitespace is accepted; raw multiline JSON, a second JSON value, missing terminator, NUL strings, lone surrogate strings, and non-string elements are rejected. CRLF record terminators normalize to LF; escaped string content, spaces, and empty strings are preserved.
- Fixed checker names: `strings-lc-ID` for those nine IDs only. Require `stringStructureId === ID`, `problem.id === lc-ID`, and consistent metadata in generation manifest, oracle sidecar, report, candidate, and verified manifest. Preserve source-content/hash binding.
- Result kinds: `json-string-array` for 68/257; `json-string-rows` for the other seven. Both are accepted with the fixed metadata binding described above.
- `resultAdapter='arg0'` for 130 and 37. `treeArgs=[0]` for 257. Other methods return their declared result.

Exports:

- TS: `matchesStringStructure(id, actual, expected)`, `parseStringStructure(id, output)`, `validStringStructure(id, value)` in `lib/oj-string-structures.ts`.
- Python: `matches_string_structure`, `parse_string_structure`, `valid_string_structure`, `format_string_structure` in `string_structures.py`.
- Fixtures: `fixtures/oj-string-structures.json`, consumed unchanged by both test suites.

Ordering:

| ID | Rule |
|---|---|
| 49, 249 | Group members are multisets; groups are a multiset. Duplicate words are not removed. |
| 68 | Strict string-array order, including right-padding spaces. |
| 257 | String multiset; different leaves can produce identical path strings. |
| 721 | Outer groups unordered. Each inner row is exact: name then unique emails sorted lexicographically. |
| 131 | Outer partitions unordered, substring order within each partition exact. |
| 51 | Outer solutions unordered, board row order exact. |
| 130, 37 | Exact matrix row and column order. 37 is guaranteed uniquely solvable. |

Generic typed validation/formatting should handle the two JSON result kinds within the sandbox's embedded result contract; do not introduce an import of a host-only helper into the isolated reference wrapper. Batch JSONL comparisons should parse each invocation as a typed result, format it with the JSON-line protocol, then compare with the fixed checker. Mutation comparison and formal comparison use the same fixed checker.

Resource limits stay bounded: 4 MiB input, public samples 32 KiB, 128 MiB package, 64 MiB maximum stdout capability. This batch requests smaller per-problem stdout budgets: 49/131 2048 KiB, 721 512 KiB, 130 256 KiB, and the others 64 KiB. The existing separate oracle-batch output budget is retained.

Validation includes 120 independent random cases per problem, 24 directed/random edges before the shared generator adds its 24 formal random cases, maximum input dimensions, and two normal wrong-answer witnesses each. The 131 pressure enumerates all 32768 partitions of 16 repeated letters; N-Queens n=9 has 352 boards. Sudoku transformations preserve uniqueness, and the independent solver counts up to two solutions to certify every generated puzzle. A 17-clue puzzle and a solved board are both included.

Reference verification: the primary Sudoku solver exceeded the unchanged two-second CPU limit on the sparse legal puzzle. The explicitly reviewed authored exact-cover reference passes the same pressure and independent oracle checks; its SHA is pinned in the generator. The other eight primary references, including the full 200x200 Surrounded Regions pressure, passed their sandbox checks. Downloaded sources were not executed on the host.
