# Amazon 83: Linux full-envelope feasibility

This is feasibility evidence, not a candidate-verification report or publication approval.

On 2026-10-08 UTC, the independently authored prototype at
`/private/tmp/amazon83-native.CaMjsF/prototype.cpp` was compiled by the dedicated
GoJudge validation sandbox with `g++ -std=c++20 -O2 -pipe`. All six inputs contain
2,000,000 values and reach 200,000,000. Expected answers come from the separate
fixture constructions recorded in the prototype benchmark report, not the tested
solver's output. Each result had Accepted status and normal exit, and its parsed
answer equalled the corresponding expected answer. Cached executable cleanup
completed through `createReferenceSandbox.withProgram`.

| Fixture | Expected answer | Sandbox CPU seconds | Peak bytes |
| --- | ---: | ---: | ---: |
| primes | 31381105077640 | 2.557470 | 41541632 |
| semiprimes | 10304133434444 | 5.247814 | 41541632 |
| consecutive | 142958882633 | 2.595911 | 41541632 |
| repeated_small_divisor | 4000000 | 0.274682 | 33415168 |
| high_distinct | 398000001000000 | 0.116478 | 41541632 |
| contains_one | 2000000 | 0.065565 | 8388608 |

The instrumented prototype emits JSON and is not the final reference program.
The final reference must be rerun against the formal package and independent
small-case oracle, and negative programs must be rejected normally. These are
single serial feasibility runs, not concurrency benchmarks or latency percentiles.
Use the Linux timings when choosing limits; the earlier macOS timings do not
justify a one-second limit. Preserve the larger published input envelope.
