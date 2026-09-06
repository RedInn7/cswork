#!/usr/bin/env python3
"""Build fresh, constraint-checked OJ packages from reviewed per-problem generators."""
import argparse
import hashlib
import importlib
import json
import random
import re
from pathlib import Path
from result_contract import KINDS, CHECKERS, validate_result, format_result, resource_limits, MAX_ORACLE_BYTES
from reference_adapters import ADAPTERS

BATCHES = ('arrays', 'dp', 'graphs', 'arrays2', 'dp2', 'graphs2', 'arrays3', 'dp3', 'graphs3', 'mixed1', 'selected_arrays1', 'selected_dp1', 'selected_windows1', 'selected_inplace1')
BATCHES += ('selected_trees1','selected_arrays2')
BATCHES += ('selected_dp2',)
BATCHES += ('selected_lists1',)
# Reviewed source correction, never automatic trial-and-error selection.
REFERENCE_FILES = {309: 'Solution2.py', 552: 'Solution2.py', 714: 'Solution2.py', 1510: 'Solution2.py', 1971: 'Solution2.py'}
REFERENCE_FILES.update({1235:'Solution2.py',2008:'Solution2.py',2140:'Solution2.py',2369:'Solution2.py',1438:'Solution3.py'})
SECONDARY_REFERENCE_FILES = {1416: 'restore-the-array.py', 2466: 'count-ways-to-build-good-strings.py'}
SECONDARY_REFERENCE_FILES[726]='number-of-atoms.py'
SECONDARY_REFERENCE_REASONS = {
    726: 'Primary Python file and README implementation are absent. Reviewed secondary Counter-stack parser has one Python 2 compatibility call: top.iteritems() is changed to top.items() only in the sandbox wrapper; original source hash is retained.',
    1416: 'Primary local source and README code blocks are empty. Reviewed secondary implementation uses rolling dynamic programming; xrange is explicitly aliased to range in the sandbox wrapper.',
    2466: 'Primary cached recursive implementation raises RecursionError on the 100000-length bound in the sandbox; no iterative Python alternative is present in the primary source. Reviewed secondary iterative DP preserves the maximum-size cases; xrange is explicitly aliased to range.',
}
REFERENCE_REASONS = {
    1235: 'Primary cached recursive reference raises RecursionError on the 50000-job upper bound in the sandbox. Reviewed iterative finish-time sorted DP with bisect_right preserves all pressure cases.',
    2008: 'Primary cached recursive reference raises RecursionError on 30000 compatible rides in the sandbox. Reviewed iterative finish-time sorted DP preserves the exact 3000030000 pressure answer.',
    2140: 'Primary cached recursive reference raises RecursionError at 100000 questions in the sandbox. Reviewed iterative suffix DP preserves maximum-size cases and 64-bit answers.',
    2369: 'Primary cached recursive reference raises RecursionError at 100000 values in the sandbox. Reviewed iterative prefix DP preserves maximum-size cases.',
    1438: 'Primary reference requires unavailable SortedList and raises NameError in the sandbox. Reviewed Solution3.py uses standard-library min/max deques and a nonshrinking maximum window, preserving all cases and limits.',
    552: 'Downloaded cached recursive Solution.py raises RecursionError at n=100000 in the sandbox. Reviewed Solution2.py uses iterative attendance-state dynamic programming; maximum-size cases are preserved.',
    309: 'Downloaded cached recursive Solution.py raises RecursionError at the 5000-day upper bound in the sandbox. Reviewed Solution2.py uses iterative cooldown dynamic programming; maximum-size cases are preserved.',
    714: 'Downloaded cached recursive Solution.py raises RecursionError at the 50000-day upper bound in the sandbox. Reviewed Solution2.py uses iterative transaction-fee dynamic programming; maximum-size cases are preserved.',
    1510: 'Downloaded cached recursive Solution.py raises RecursionError at n=100000 in the Python sandbox despite the raised recursion limit. Reviewed Solution2.py uses iterative dynamic programming; maximum-size cases are preserved.',
    1971: 'Downloaded Solution.py checks vis but never adds a visited node; DFS can recurse forever along an undirected edge. Sandbox validation exposed the failure. Reviewed Solution2.py uses BFS and records visited nodes.',
}
PREFIX = '''from operator import *
from string import ascii_lowercase
from random import randint
from typing import *
from collections import *
from functools import *
from itertools import *
from bisect import *
from math import *
from heapq import *
from builtins import pow
import sys, json, math, collections, functools, itertools, bisect, heapq, string
sys.setrecursionlimit(1_000_000)
xrange = range
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

def result_settings(spec):
    kind=spec.get('resultKind','integer')
    if kind not in KINDS:
        raise ValueError('Unsupported result kind')
    encoding=spec.get('oracleEncoding','legacy-integer' if kind=='integer' else 'jsonl-v1')
    if encoding not in ('legacy-integer','jsonl-v1') or kind!='integer' and encoding!='jsonl-v1':
        raise ValueError('Non-integer results require jsonl-v1')
    checker=spec.get('checker',CHECKERS[kind])
    if checker!=CHECKERS[kind]:
        raise ValueError('Result kind and checker disagree')
    return kind,encoding,checker

def typed_result(spec,value):
    kind,_,_=result_settings(spec)
    if kind=='integer':return integer(value)
    return validate_result(kind,value)

def answer(spec, args):
    return typed_result(spec,spec['oracle'](checked_args(spec, args)))

def reference_source(root, pid, secondary=None):
    if pid in SECONDARY_REFERENCE_FILES:
        if secondary is None:
            raise ValueError(f'{pid} requires the explicitly reviewed secondary reference directory')
        path = secondary / SECONDARY_REFERENCE_FILES[pid]
        return path, path.read_text()
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
    list_args=spec.get('listArgs',[])
    list_array_args=spec.get('listArrayArgs',[])
    linked_result=spec.get('resultLinked','none')
    for positions in (list_args,list_array_args):
        if type(positions)is not list or any(type(i)is not int or i<0 for i in positions):
            raise ValueError('Invalid linked-list argument positions')
    if len(set(list_args+list_array_args))!=len(list_args+list_array_args) or linked_result not in ('none','return','arg0'):
        raise ValueError('Invalid linked-list adapter')
    linked_setup=''
    if list_args or list_array_args or linked_result!='none':
        linked_source=Path(__file__).with_name('linked_codec.py').read_text()
        linked_setup='\n_cswork_lists = {}\nexec('+repr(linked_source)+', _cswork_lists)\nListNode = _cswork_lists["ListNode"]\n'
    tree_args=spec.get('treeArgs',[])
    if type(tree_args)is not list or any(type(i)is not int or i<0 for i in tree_args) or len(set(tree_args))!=len(tree_args):
        raise ValueError('Invalid tree argument positions')
    tree_setup=''
    if tree_args:
        tree_source=Path(__file__).with_name('tree_codec.py').read_text()
        tree_setup='\n_cswork_trees = {}\nexec('+repr(tree_source)+', _cswork_trees)\nTreeNode = _cswork_trees["TreeNode"]\n'
    adapter=spec.get('resultAdapter','return')
    if adapter not in ADAPTERS:raise ValueError('Unknown result adapter')
    adapter_source=Path(__file__).with_name('reference_adapters.py').read_text()
    adapter_setup='\n_cswork_adapters = {}\nexec('+repr(adapter_source)+', _cswork_adapters)\n'
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
    kind,encoding,_=result_settings(spec)
    contract=''
    if kind=='integer' and encoding=='legacy-integer':
        result_body="""    if type(result) not in (int, bool):
        raise TypeError('Expected an integer or boolean result')
    print(int(result))"""
    else:
        # Embed only authored contract code; downloaded sources remain inert until
        # the produced wrapper is submitted to the existing sandbox.
        contract_source=Path(__file__).with_name('result_contract.py').read_text()
        contract='\n_cswork_contract = {}\nexec('+repr(contract_source)+', _cswork_contract)\n'
        result_body=f"""    if {kind!r} == 'integer' and type(result) is bool:
        result = int(result)
    _cswork_contract['validate_result']({kind!r}, result)
    if '--batch' in sys.argv:
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    else:
        sys.stdout.write(_cswork_contract['format_result']({kind!r}, result))"""
    tail = f'''
def _cswork_answer(args):
    for index in {list_args!r}:
        args[index] = _cswork_lists['from_values'](args[index])
    for index in {list_array_args!r}:
        args[index] = [_cswork_lists['from_values'](values) for values in args[index]]
    for index in {tree_args!r}:
        args[index] = _cswork_trees['from_level_order'](args[index])
    result = Solution().{method}(*args)
    if {linked_result!r} != 'none':
        result = _cswork_lists['to_values'](args[0] if {linked_result!r} == 'arg0' else result)
    result = _cswork_adapters['adapt_result']({adapter!r}, result, args)
{result_body}

if __name__ == '__main__':
    if '--batch' in sys.argv:
        for args in json.load(sys.stdin):
            _cswork_answer(args)
    else:
'''
    parse = '\n'.join('        ' + line for line in spec['parse'].splitlines())
    return '\n'.join(future) + '\n' + PREFIX + tree_setup + linked_setup + adapter_setup + contract + '\n'.join(lines) + tail + parse + '\n        _cswork_answer(args)\n'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def build(pid, spec, library, references, out, secondary=None):
    if pid not in library:
        raise ValueError(f'{pid} is outside the Ling study list')
    origin = library[pid]
    kind,encoding,checker=result_settings(spec)
    limits=resource_limits(spec)
    if spec['method'] != origin['signature']['name'].strip():
        raise ValueError(f'Reference method does not match source metadata: {pid}')
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
        formal.append((checked_args(spec, args), typed_result(spec,expected), f'规模上限 {i+1}'))
    if not 2 <= len(formal) <= 64 or not spec['pressure']:
        raise ValueError('Require 2–64 formal cases including pressure coverage')
    cases = []
    for i, (args, expected, name) in enumerate(formal):
        stdin = spec['encode'](args)
        if not isinstance(stdin, str) or len(stdin.encode()) > 4*1024*1024 or '\0' in stdin:
            raise ValueError('Input encoding exceeds the OJ contract')
        expected_output=format_result(kind,expected)
        if len(expected_output.encode('utf-8'))>limits['outputLimit']*1024:
            raise ValueError('Expected output exceeds declared output limit')
        cases.append(dict(name='样例 1' if i == 0 else name, input=stdin,
            expectedOutput=expected_output, hidden=i != 0, weight=1))
    small = [checked_args(spec, spec['random_args'](rng)) for _ in range(120)]
    oracle = dict(args=small, expected=[answer(spec, args) for args in small],resultKind=kind,oracleEncoding=encoding)
    path, source = reference_source(references, pid, secondary)
    compatible_source=source
    if pid==726:
        if source.count('top.iteritems()')!=1:
            raise ValueError('Reviewed Python 2 compatibility source changed')
        compatible_source=source.replace('top.iteritems()','top.items()')
    wrapped = wrapper(spec, compatible_source)
    mutations=spec['mutants']
    if (not isinstance(mutations,list) or not mutations
            or any(not isinstance(m,dict) or not isinstance(m.get('name'),str)
                   or not m['name'].strip() or not isinstance(m.get('source'),str)
                   or not m['source'].strip() for m in mutations)):
        raise ValueError('At least one named common incorrect implementation is required')
    explanation_zh = spec.get('explanationZh', '按题意计算样例答案。站内采用上述标准输入输出格式。')
    explanation_en = spec.get('explanationEn', 'Compute the answer according to the definition. Use the standard input/output format above.')
    pkg = dict(schemaVersion=1, problem=dict(id=f'lc-{pid}', courseId='gomall', lessonId='00-overview',
        title=spec['titleZh'], difficulty=origin['difficulty'], tags=['灵神题单'],
        description=spec['descriptionZh'], input=spec['inputZh'], output=spec['outputZh'],
        explanation=explanation_zh, hints=[],
        translations={'en':dict(title=spec['titleEn'],description=spec['descriptionEn'],input=spec['inputEn'],
            output=spec['outputEn'],explanation=explanation_en,hints=[])},
        **limits, checker=checker,
        languages=['python','go','java','cpp']),cases=cases)
    raw = (json.dumps(pkg,ensure_ascii=False,indent=2)+'\n').encode()
    mutation_raw = (json.dumps(spec['mutants'],ensure_ascii=False,indent=2)+'\n').encode()
    if len(raw)>8*1024*1024:
        raise ValueError('Package exceeds 8 MiB')
    ident=f'lc-{pid}'
    (out/(ident+'.candidate.json')).write_bytes(raw)
    (out/(ident+'.reference.py')).write_text(wrapped)
    oracle_raw=json.dumps(oracle,ensure_ascii=False,allow_nan=False).encode('utf-8')
    if len(oracle_raw)>MAX_ORACLE_BYTES:
        raise ValueError('Oracle sidecar exceeds 32 MiB')
    (out/(ident+'.oracle.json')).write_bytes(oracle_raw)
    (out/(ident+'.mutants.json')).write_bytes(mutation_raw)
    selection = {}
    if pid in SECONDARY_REFERENCE_FILES:
        selection = dict(referenceSelection=dict(strategy='explicit-reviewed-secondary',
            provider='kamyu104/LeetCode', license='MIT', selectedFile=path.name,
            reason=SECONDARY_REFERENCE_REASONS[pid]))
    if pid in REFERENCE_FILES:
        rejected = path.parent/'Solution.py'
        selection = dict(referenceSelection=dict(strategy='explicit-reviewed-override',
            selectedFile=path.name, rejectedFile=rejected.name,
            rejectedSourceSha256=sha(rejected.read_bytes()), reason=REFERENCE_REASONS[pid]))
    return dict(**selection, id=ident, sourceUrl=origin['sourceEnUrl'], sourceUrlZh=origin['sourceUrl'],
        reference=str(path), referenceSha256=sha(source.encode()), wrapperSha256=sha(wrapped.encode()),
        packageSha256=sha(raw), mutantsSha256=sha(mutation_raw), oracleSha256=sha(oracle_raw), formalCases=len(cases),
        oracleCases=len(small), resultKind=kind, oracleEncoding=encoding,
        checker=checker, resourceLimits=limits, referenceResultAdapter=spec.get('resultAdapter','return'), status='candidate')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--batch',choices=BATCHES,required=True)
    parser.add_argument('--library',type=Path,required=True)
    parser.add_argument('--references',type=Path,required=True)
    parser.add_argument('--secondary-references',type=Path)
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
        records.append(build(pid,specs[pid],library,args.references,args.out,args.secondary_references))
        print(f'Generated lc-{pid}: {records[-1]["formalCases"]} formal, 120 oracle',flush=True)
    temporary=args.out/'.manifest.json.tmp'
    temporary.write_text(json.dumps(dict(seed=20260906,batch=args.batch,problems=records),ensure_ascii=False,indent=2)+'\n')
    temporary.replace(args.out/'manifest.json')
    print('Generated candidate packages only; no reference code was executed.')

if __name__=='__main__':
    main()
