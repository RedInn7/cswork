"""Local-only batch execution of authored Python programs, NOT an OS sandbox.

Usage: python -I local_batch_runner.py PROGRAM_PATH
stdin: JSON array of input strings. stdout: JSON array of output strings.
Every case runs the file afresh as __main__, with new globals and fresh
UTF-8 streams (including .buffer). Any exception or nonzero SystemExit fails
the entire batch. Production verification must still isolate every case.
"""
import io
import json
from pathlib import Path
import runpy
import sys
import traceback


def run_case(path, value):
    stdin=io.TextIOWrapper(io.BytesIO(value.encode('utf-8')),encoding='utf-8')
    output=io.BytesIO();errors=io.BytesIO()
    stdout=io.TextIOWrapper(output,encoding='utf-8',write_through=True)
    stderr=io.TextIOWrapper(errors,encoding='utf-8',write_through=True)
    saved=sys.stdin,sys.stdout,sys.stderr,sys.argv
    failure=None
    try:
        sys.stdin,sys.stdout,sys.stderr,sys.argv=stdin,stdout,stderr,[str(path)]
        try:
            runpy.run_path(str(path),run_name='__main__')
        except SystemExit as exc:
            if exc.code is not None and not (isinstance(exc.code,int) and exc.code==0):
                failure=f'nonzero SystemExit: {exc.code!r}'
        except BaseException:
            failure=traceback.format_exc()
        stdout.flush();stderr.flush()
        result=output.getvalue().decode('utf-8')
        error_text=errors.getvalue().decode('utf-8')
    finally:
        sys.stdin,sys.stdout,sys.stderr,sys.argv=saved
    if failure is not None:raise RuntimeError(failure+'\n'+error_text[:2000])
    return result


def main():
    if len(sys.argv)!=2:raise ValueError('Expected one authored program path')
    path=Path(sys.argv[1]).resolve(strict=True)
    values=json.load(sys.stdin)
    if not isinstance(values,list) or not all(isinstance(v,str) for v in values):raise ValueError('Expected an array of input strings')
    results=[]
    for index,value in enumerate(values):
        try:results.append(run_case(path,value))
        except BaseException as exc:raise RuntimeError(f'Local case {index} failed for {path}: {exc}') from exc
    json.dump(results,sys.stdout,ensure_ascii=False)


if __name__=='__main__':main()
