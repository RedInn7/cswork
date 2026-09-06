#!/usr/bin/env python3
"""Build fresh, constraint-checked OJ packages from reviewed per-problem generators."""
import argparse
import hashlib
import importlib
import json
import random
import re
from pathlib import Path

BATCHES = ('arrays', 'dp', 'graphs')
# Reviewed source correction, never automatic trial-and-error selection.
REFERENCE_FILES = {1971: 'Solution2.py'}
REFERENCE_REASONS = {1971: 'Downloaded Solution.py checks vis but never adds a visited node; DFS can recurse forever along an undirected edge. Sandbox validation exposed the failure. Reviewed Solution2.py uses BFS and records visited nodes.'}
PREFIX = '''from operator import *
from typing import *
from collections import *
from functools import *
from itertools import *
from bisect import *
from math import *
from heapq import *
import sys, json, math, collections, functools, itertools, bisect, heapq, string
sys.setrecursionlimit(1_000_000)
'''

def integer(value):
    if type(value) not in (int, bool):
        raise ValueError('This batch supports integer/boolean answers only')
    return int(value)

def checked_args(spec, args):
    # Round-trip prevents a mutating oracle from altering the actual testcase input.
    value = json.loads(json.dumps(args, allow_nan=False))
    if not isinstance(value, list):
        raise ValueError('Arguments must be a positional argument list')
    verdict = spec['validate'](value)
    # Both assertion-only validators (None) and explicit True are supported.
    if verdict is not None and verdict is not True:
        raise ValueError('Arguments violate declared constraints')
    return value

def answer(spec, args):
    return integer(spec['oracle'](checked_args(spec, args)))

def reference_source(root, pid):
    matches = list(root.glob(f'*/*{pid:04d}.*'))
    if len(matches) != 1:
        raise ValueError(f'Expected exactly one reference directory for {pid}')
    directory = matches[0]
    path = directory / REFERENCE_FILES.get(pid, 'Solution.py')
    if pid in REFERENCE_FILES and not path.is_file():
        raise ValueError(f'Missing explicitly selected reference for {pid}: {path.name}')
    if path.is_file():
        return path, path.read_text()
    # Some downloaded entries store their Python implementation in the README.
    for filename in ('README_EN.md', 'README.md'):
        path = directory / filename
        if path.is_file():
            source = path.read_text()
            match = re.search(r'```python\s*\n(.*?)\n```', source, re.S)
            if match and re.search(r'^class Solution\b', match[1], re.M):
                return path, match[1]
    raise ValueError(f'Missing Python reference for {pid}')

def wrapper(spec, source):
    method = spec['method']
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', method):
        raise ValueError('Invalid reference method')
    future = []
    lines = []
    for line in source.splitlines():
        if line.startswith('from __future__ import '):
            future.append(line)
        else:
            lines.append(line)
    tail = f'''
def _cswork_answer(args):
    result = Solution().{method}(*args)
    if type(result) not in (int, bool):
        raise TypeError('Expected an integer or boolean result')
    print(int(result))

if __name__ == '__main__':
    if '--batch' in sys.argv:
        for args in json.load(sys.stdin):
            _cswork_answer(args)
    else:
'''
    parse = '\n'.join('        ' + line for line in spec['parse'].splitlines())
    return '\n'.join(future) + '\n' + PREFIX + '\n'.join(lines) + tail + parse + '\n        _cswork_answer(args)\n'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def build(pid, spec, library, references, out):
    if pid not in library:
        raise ValueError(f'{pid} is outside the Ling study list')
    origin = library[pid]
    rng = random.Random(20260906 + pid)
    formal = []
    for i, args in enumerate(spec['edges']):
        formal.append((checked_args(spec, args), answer(spec, args), f'边界 {i+1}'))
    if not formal:
        raise ValueError('At least one public sample is required')
    for i in range(24):
        args = checked_args(spec, spec['random_args'](rng))
        formal.append((args, answer(spec, args), f'固定种子随机 {i+1}'))
    for i, (args, expected) in enumerate(spec['pressure']):
        formal.append((checked_args(spec, args), integer(expected), f'规模上限 {i+1}'))
    if not 2 <= len(formal) <= 64 or not spec['pressure']:
        raise ValueError('Require 2–64 formal cases including pressure coverage')
    cases = []
    for i, (args, expected, name) in enumerate(formal):
        stdin = spec['encode'](args)
        if not isinstance(stdin, str) or len(stdin.encode()) > 4*1024*1024 or '\0' in stdin:
            raise ValueError('Input encoding exceeds the OJ contract')
        cases.append(dict(name='样例 1' if i == 0 else name, input=stdin,
            expectedOutput=str(expected)+'\n', hidden=i != 0, weight=1))
    small = [checked_args(spec, spec['random_args'](rng)) for _ in range(120)]
    oracle = dict(args=small, expected=[answer(spec, args) for args in small])
    path, source = reference_source(references, pid)
    wrapped = wrapper(spec, source)
    mutations=spec['mutants']
    if (not isinstance(mutations,list) or not mutations
            or any(not isinstance(m,dict) or not isinstance(m.get('name'),str)
                   or not m['name'].strip() or not isinstance(m.get('source'),str)
                   or not m['source'].strip() for m in mutations)):
        raise ValueError('At least one named common incorrect implementation is required')
    explanation_zh = spec.get('explanationZh', '按题意计算样例答案。站内采用上述标准输入输出格式。')
    explanation_en = spec.get('explanationEn', 'Compute the answer according to the definition. Use the standard input/output format above.')
    pkg = dict(schemaVersion=1, problem=dict(id=f'lc-{pid}', courseId='gomall', lessonId='00-overview',
        title=spec['titleZh'], difficulty=spec['difficulty'], tags=['灵神题单'],
        description=spec['descriptionZh'], input=spec['inputZh'], output=spec['outputZh'],
        explanation=explanation_zh, hints=[],
        translations={'en':dict(title=spec['titleEn'],description=spec['descriptionEn'],input=spec['inputEn'],
            output=spec['outputEn'],explanation=explanation_en,hints=[])},
        timeLimit=spec.get('timeLimit',2), memoryLimit=262144, outputLimit=64, checker='tokens',
        languages=['python','go','java','cpp']),cases=cases)
    raw = (json.dumps(pkg,ensure_ascii=False,indent=2)+'\n').encode()
    mutation_raw = (json.dumps(spec['mutants'],ensure_ascii=False,indent=2)+'\n').encode()
    if len(raw)>8*1024*1024:
        raise ValueError('Package exceeds 8 MiB')
    ident=f'lc-{pid}'
    (out/(ident+'.candidate.json')).write_bytes(raw)
    (out/(ident+'.reference.py')).write_text(wrapped)
    (out/(ident+'.oracle.json')).write_text(json.dumps(oracle))
    (out/(ident+'.mutants.json')).write_bytes(mutation_raw)
    selection = {}
    if pid in REFERENCE_FILES:
        rejected = path.parent/'Solution.py'
        selection = dict(referenceSelection=dict(strategy='explicit-reviewed-override',
            selectedFile=path.name, rejectedFile=rejected.name,
            rejectedSourceSha256=sha(rejected.read_bytes()), reason=REFERENCE_REASONS[pid]))
    return dict(**selection, id=ident, sourceUrl=origin['sourceEnUrl'], sourceUrlZh=origin['sourceUrl'],
        reference=str(path), referenceSha256=sha(source.encode()), wrapperSha256=sha(wrapped.encode()),
        packageSha256=sha(raw), mutantsSha256=sha(mutation_raw), formalCases=len(cases),
        oracleCases=len(small), status='candidate')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--batch',choices=BATCHES,required=True)
    parser.add_argument('--library',type=Path,required=True)
    parser.add_argument('--references',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--ids',help='Optional comma-separated retry subset')
    args=parser.parse_args()
    # Invalidate trust artifacts before any input read/import can fail. Partial
    # generation must never be paired with a previous successful manifest.
    args.out.mkdir(parents=True,exist_ok=True,mode=0o700)
    for name in ('manifest.json','verified-manifest.json','verification-report.json','.manifest.json.tmp'):
        (args.out/name).unlink(missing_ok=True)
    specs=importlib.import_module('batches.'+args.batch).PROBLEMS
    wanted=set(map(int,args.ids.split(','))) if args.ids else set(specs)
    if not wanted or wanted-set(specs):
        raise ValueError('Unknown or empty batch subset')
    library={}
    for row in map(json.loads,args.library.read_text().splitlines()):
        number=row['number']
        if type(number) is not int or number<=0 or number in library or row['id']!=f'lc-{number}':
            raise ValueError('Duplicate or invalid library problem identity')
        library[number]=row
    records=[]
    for pid in sorted(wanted):
        records.append(build(pid,specs[pid],library,args.references,args.out))
        print(f'Generated lc-{pid}: {records[-1]["formalCases"]} formal, 120 oracle',flush=True)
    temporary=args.out/'.manifest.json.tmp'
    temporary.write_text(json.dumps(dict(seed=20260906,batch=args.batch,problems=records),ensure_ascii=False,indent=2)+'\n')
    temporary.replace(args.out/'manifest.json')
    print('Generated candidate packages only; no reference code was executed.')

if __name__=='__main__':
    main()
