#!/usr/bin/env python3
"""Export reviewed adapters and public starter snippets, never reference solutions."""
import importlib
import ast
import hashlib
import json
from pathlib import Path
import sys
import re

ROOT = Path(__file__).resolve().parents[2]
VALIDATION = ROOT / 'scripts/ling-validation'
sys.path.insert(0, str(VALIDATION))
import generate_batch
import generate
from complex_design_semantics import CLASSES, METHODS

MODULES = ('tree_codec', 'linked_codec', 'special_node_codec', 'auxiliary_codec',
           'reference_adapters', 'complex_design_semantics', 'string_structures',
           'float_checkers', 'fraction_checker', 'semantic_checkers', 'result_contract')


def python_template(snippet):
    # These declarations serve the language server only. Real judge objects come
    # from install(), so their identity/type invariants remain unchanged.
    declarations = []
    for name, fields in [('TreeNode', ('val', 'left', 'right')),
                         ('ListNode', ('val', 'next')),
                         ('Node', ('val', 'left', 'right', 'next', 'random', 'prev', 'child', 'parent'))]:
        if re.search(r'\b' + name + r'\b', snippet):
            lines = [f'    class {name}:', '        val: int']
            lines += [f'        {field}: Optional["{name}"]' for field in fields if field != 'val']
            arguments = ', '.join(['val: int = 0'] + [f'{f}: Optional["{name}"] = None' for f in fields if f != 'val'])
            lines += [f'        def __init__(self, {arguments}) -> None: ...']
            declarations.append('\n'.join(lines))
    if re.search(r'\bMountainArray\b', snippet):
        declarations.append('    class MountainArray:\n        def get(self, index: int) -> int: ...\n        def length(self) -> int: ...')
    if re.search(r'\bInterval\b', snippet):
        declarations.append('    class Interval:\n        start: int\n        end: int\n        def __init__(self, start: int = 0, end: int = 0) -> None: ...')
    try:
        ast.parse(snippet)
    except (SyntaxError, IndentationError):
        snippet = re.sub(r'(?m)^([ \t]*)(def [^\n]+:)\s*$', lambda m: m[1] + m[2] + '\n' + m[1] + '    pass', snippet)
    result = 'from typing import *\n\n'
    if declarations:
        result += 'if TYPE_CHECKING:\n' + '\n\n'.join(declarations) + '\n\n'
    result += snippet
    ast.parse(result)
    return result


def custom_help(number):
    if number in (235, 236, 1644, 1650):
        return {'zh': '每行依次输入根节点层序数组、p 的节点值、q 的节点值；系统会构造节点引用。',
                'en': 'Use three JSON lines: the root level-order array, the value of p, and the value of q. Node references are constructed automatically.'}
    if number == 285:
        return {'zh': '两行依次输入根节点层序数组和 p 的节点值。', 'en': 'Use two JSON lines: the root level-order array and the value of p.'}
    if number == 863:
        return {'zh': '三行依次输入根节点层序数组、target 的节点值、k。', 'en': 'Use three JSON lines: the root level-order array, the target node value, and k.'}
    if number == 160:
        return {'zh': '按原题样例输入五行：intersectVal、listA、listB、skipA、skipB；没有交点时 intersectVal 为 0。',
                'en': 'Use the original example format, one JSON value per line: intersectVal, listA, listB, skipA, skipB. Set intersectVal to 0 for no intersection.'}
    if number == 430:
        return {'zh': '自定义测试使用明确的节点表：一行 [[节点值,next序号,child序号],…]。序号从 0 开始，空指针为 -1，首节点序号为 0；不接受原题使用 null 排版的多层展示序列。函数仍接收官方 Node 参数。',
                'en': 'For custom tests, use one JSON node table: [[value,nextIndex,childIndex],...]. Indices start at 0, -1 means null, and node 0 is the head. The visual multilevel null layout is not accepted. Your function still receives the official Node argument.'}
    if number == 138:
        return {'zh': '输入一行 [[节点值,random序号或null],…]，与原题样例一致。', 'en': 'Use one JSON line [[value,randomIndexOrNull],...], as in the original examples.'}
    return None


def support():
    result = 'import sys as _cswork_sys, types as _cswork_types\n'
    for name in MODULES:
        source = (VALIDATION / (name + '.py')).read_text()
        result += f'_cswork_module = _cswork_types.ModuleType({name!r})\n_cswork_sys.modules[{name!r}] = _cswork_module\nexec({source!r}, _cswork_module.__dict__)\n'
    source = Path(__file__).with_name('runtime.py').read_text()
    result += f'_cswork_runtime = _cswork_types.ModuleType("_cswork_runtime")\nexec({source!r}, _cswork_runtime.__dict__)\n'
    return result


def legacy_spec(number):
    wrapped = generate.wrapper(number, '__CSWORK_USER_SOURCE__')
    parse = wrapped.split('    else:\n        ', 1)[1].rsplit('\n        print(', 1)[0]
    return dict(number=number, parse=parse, method=generate.METHODS[generate.IDS.index(number)], resultKind='integer')


def export(library):
    rows = {row['number']: row for row in map(json.loads, library.read_text().splitlines())}
    selected = json.loads((ROOT / 'lib/content/ling-curated-500.json').read_text())
    specs = {n: s for batch in generate_batch.BATCHES
             for n, s in importlib.import_module('batches.' + batch).PROBLEMS.items()}
    keep = ('parse', 'method', 'treeArgs', 'listArgs', 'listArrayArgs', 'resultTree',
            'resultLinked', 'resultAdapter', 'resultKind', 'specialId', 'auxiliaryId',
            'complexDesignId', 'designClass', 'designMethods')
    problems = {}
    for entry in selected:
        number = entry['number']
        row = rows[number]
        spec = ({k: specs[number][k] for k in keep if k in specs[number]}
                if number in specs else legacy_spec(number))
        spec['number'] = number
        spec.setdefault('resultKind', 'integer')
        if spec.get('complexDesignId'):
            spec['method'] = CLASSES[number]
            spec['designMethods'] = sorted(METHODS[number])
        elif spec.get('designClass'):
            spec['method'] = spec['designClass']
        templates = {slug: next((item['code'] for item in row['codeSnippets'] if item['lang'] == lang), '')
                     for slug, lang in [('python', 'Python3'), ('cpp', 'C++'), ('java', 'Java'), ('go', 'Go')]}
        # Official Go starter is absent in the downloaded 1644 record. Its actual
        # interface matches the official TreeNode pointer arguments in C++/Java.
        if number == 1644 and not templates['go']:
            templates['go'] = 'func lowestCommonAncestor(root, p, q *TreeNode) *TreeNode {\n    \n}'
        literal = repr(spec)
        python_wrapper = (generate_batch.PREFIX + f'\n_cswork_runtime.install({literal}, globals())\n'
                          '__CSWORK_USER_SOURCE__\n'
                          f'\nif __name__ == "__main__":\n    _cswork_runtime.python_main({literal}, globals())\n')
        native_bridge = (f'if __name__ == "__main__":\n'
                         f'    _cswork_runtime.native_main({literal}, __CSWORK_NATIVE_COMMAND__)\n')
        problems[row['id']] = dict(number=number, method=spec['method'], signature=row['signature'],
                                   templates=templates, spec=spec,
                                   pythonTemplate=python_template(templates['python']),
                                   customInputHelp=custom_help(number),
                                   pythonWrapper=python_wrapper, nativeBridge=native_bridge)
    native_paths = list((ROOT / 'lib/server').glob('leetcode-*.ts'))
    for language in ('cpp', 'java', 'go'):
        native_paths += [p for p in (ROOT / 'scripts/leetcode-mode' / language).rglob('*')
                         if p.is_file() and p.suffix in ('.h', '.hpp', '.cc', '.cpp', '.java', '.go', '.json')]
    native_hash = hashlib.sha256()
    for path in sorted(native_paths, key=lambda p: str(p.relative_to(ROOT))):
        native_hash.update(str(path.relative_to(ROOT)).encode() + b'\0' + path.read_bytes() + b'\0')
    return dict(version=1, nativeSourcesHash=native_hash.hexdigest(), support=support(), problems=problems)


if __name__ == '__main__':
    library = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.local/ling-library.jsonl'
    destination = ROOT / 'lib/content/leetcode-contracts.json'
    destination.write_text(json.dumps(export(library), ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Exported 500 public contracts to {destination}')
