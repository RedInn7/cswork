"""Verify the immutable JSON ABI and the no-library fallback with the same cases.

Run on the Linux judge/CI toolchain: python3 tests/cpp-json-runtime.test.py.
Only trusted test code is compiled, in a temporary directory; no OJ service needed.
"""
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "deploy/oj/cpp-json-v1"
CXX = os.environ.get("CXX", "g++")
HEADER = (ASSETS / "json-runtime.hpp").read_text()
IMPLEMENTATION = (ASSETS / "json-runtime.cpp").read_text()
CASES = (ROOT / "tests/fixtures/cpp-json-runtime.cpp").read_text()


def command(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=90)


with tempfile.TemporaryDirectory(prefix="cswork-json-abi-") as directory:
    work = Path(directory)
    object_file = work / "runtime.o"
    flags = [CXX, "-std=c++20", "-O2", "-pipe"]
    command(flags + ["-c", str(ASSETS / "json-runtime.cpp"), "-o", str(object_file)])
    results = {}
    for mode in ("static", "inline"):
        if mode == "static":
            prefix = '#include "json-runtime.hpp"\n'
            libraries = [str(object_file)]
        else:
            prefix = (
                HEADER
                + "\n#define CSWORK_JSON_INLINE inline\n"
                + IMPLEMENTATION.replace('#include "json-runtime.hpp"', "")
                + "\n#undef CSWORK_JSON_INLINE\n"
            )
            libraries = []
        source = work / f"{mode}.cpp"
        executable = work / mode
        # User packing/macros occur after JSON declarations, as in real drivers.
        source.write_text(prefix + '\n#pragma pack(push, 1)\n' + CASES + '\n#pragma pack(pop)\n')
        command(flags + ["-I", str(ASSETS), str(source), *libraries, "-o", str(executable)])
        results[mode] = command([str(executable)]).stdout
        assert results[mode] == "JSON semantics passed\n", (mode, results[mode])
    assert results["static"] == results["inline"]
    print("PASS JSON static/fallback: copy/move, Unicode, int64, floats, bool, nesting, invalid input")
