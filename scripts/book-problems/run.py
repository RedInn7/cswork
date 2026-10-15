"""Runs one book problem: content/book-problems/<id>/problem.py.

problem.py defines solve(stdin) -> stdout (the reference), cases(rng) -> stdin texts
(the first SAMPLES are public, the rest hidden; edge cases and the largest size included)
and at least two wrong_*(stdin) functions: common mistakes. Every wrong solution must
fail some hidden case (an exception, or an output the judge's checker rejects: another
token sequence, or with CHECKER = 'float-array' a number off by more than 1e-5), else
this exits 1.
Prints the cases, the reference outputs and how many hidden cases each mistake fails.

  python3 -I -S scripts/book-problems/run.py content/book-problems/<id>
"""
import importlib.util
import json
import os
import random
import sys
import time

sys.setrecursionlimit(100000)


def same(checker, actual, expected):
    a, b = actual.split(), expected.split()
    if checker == 'tokens':
        return a == b
    # lib/oj-finite-floats.mjs: a count, then that many numbers within 1e-5 (relative above 1).
    try:
        return len(a) == len(b) == int(b[0]) + 1 and all(
            abs(float(x) - float(y)) <= 1e-5 * max(1, abs(float(y))) for x, y in zip(a[1:], b[1:])
        )
    except ValueError:
        return False


def main(folder):
    name = os.path.basename(os.path.normpath(folder))
    spec = importlib.util.spec_from_file_location('problem', os.path.join(folder, 'problem.py'))
    problem = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(problem)
    # A string seed hashes with SHA-512: the same cases on every machine and Python 3.
    inputs = [text if text.endswith('\n') else text + '\n' for text in problem.cases(random.Random(name))]
    samples = problem.SAMPLES
    if not 1 <= samples < len(inputs):
        sys.exit(f'{name}: need 1..{len(inputs) - 1} samples')
    expected, slowest = [], 0.0
    for text in inputs:
        start = time.perf_counter()
        output = problem.solve(text)
        slowest = max(slowest, time.perf_counter() - start)
        expected.append(output.rstrip('\n') + '\n')
    wrong = sorted(key for key in vars(problem) if key.startswith('wrong_'))
    if len(wrong) < 2:
        sys.exit(f'{name}: need at least two wrong_* solutions')
    checker = getattr(problem, 'CHECKER', 'tokens')
    kills = {}
    for key in wrong:
        failed = 0
        for k in range(samples, len(inputs)):
            try:
                output = getattr(problem, key)(inputs[k])
            except Exception:
                output = None
            failed += output is None or not same(checker, output, expected[k])
        if not failed:
            sys.exit(f'{name}: no hidden case rejects {key}')
        kills[key] = failed
    json.dump(
        {
            'level': problem.LEVEL,
            'tags': problem.TAGS,
            'checker': checker,
            'samples': samples,
            'inputs': inputs,
            'expected': expected,
            'kills': kills,
            'slowest': round(slowest, 3),
        },
        sys.stdout,
    )


main(sys.argv[1])
