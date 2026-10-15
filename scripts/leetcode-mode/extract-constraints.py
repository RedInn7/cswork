"""Build lib/content/leetcode-constraints.json from the LeetCode statements' Constraints sections.
Usage: python3 scripts/leetcode-mode/extract-constraints.py ling-library.jsonl BATCH_DIR...

Only lengths and value ranges read directly off a constraint line are kept
({"lc-1": {"nums": {"len": [2, 10000], "val": [-1e9, 1e9]}}}). Each one is then checked
offline against every judge case (hidden included) found under BATCH_DIR/**/<id>.json,
decoded by the contract's reviewed parse snippet: a constraint any case breaks is dropped,
and so is every constraint of a problem whose cases can't be decoded, so a 422 from
POST problems/<id>/expected never refuses an input the judge itself uses.
"""
import io, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
contracts = json.loads((ROOT / 'lib/content/leetcode-contracts.json').read_text())['problems']
NUMERIC = re.compile(r'^(integer|long|double)(\[\]|\[\]\[\])?$|^list<(list<)?(integer|long|double)>>?$')
SIZED = re.compile(r'\[\]$|^list<|^string$|^TreeNode$|^ListNode$')


def number(text):
    expr = re.sub(r'\^\{?(\d+)\}?', r'**\1', text.replace('−', '-'))
    if not re.fullmatch(r'[\d\s*+\-().]+', expr):
        return None
    try:
        value = eval(expr, {'__builtins__': {}})  # digits and operators only, checked above
    except Exception:
        return None
    return value if isinstance(value, (int, float)) else None


def params_of(c):
    s = c['signature']
    if s.get('classname') or c.get('customInputHelp') or c['number'] in (297, 449):
        return None
    return s.get('params') or None


def extract(statement, params):
    """{name: {'len': [lo, hi], 'val': [lo, hi]}} read off the Constraints bullets."""
    m = re.search(r'\*\*Constraints:?\*\*:?(.*)', statement, re.S)
    if not m:
        return {}
    section = re.split(r'\n\*\*|\n#', m.group(1))[0]
    types = {p['name']: p['type'] for p in params}
    nodes = {'tree': [n for n, t in types.items() if t == 'TreeNode'],
             'list': [n for n, t in types.items() if t == 'ListNode']}
    alias = {}  # n -> ('nums', 'len'); None when it names something untracked (an inner length)
    found = {}

    def put(target, kind, lo, hi):
        name, prop = target
        if prop == 'val' and not (NUMERIC.match(types[name]) or types[name] in ('TreeNode', 'ListNode')):
            return
        if prop == 'len' and not SIZED.search(types[name]):
            return
        old = found.setdefault(name, {}).get(prop)
        found[name][prop] = [lo, hi] if old is None else [max(lo, old[0]), min(hi, old[1])]

    def term(text):
        """What one side of a comparison names: [(param, 'len'|'val')], [] untracked, None unknown."""
        text = text.strip()
        if text in alias:
            return [] if alias[text] is None else [alias[text]]
        if re.fullmatch(r'[Nn]ode\.val', text):
            return [(n, 'val') for n in nodes['tree'] + nodes['list']]
        hit = re.fullmatch(r'(\w+)\.length', text)
        if hit and hit.group(1) in types:
            return [(hit.group(1), 'len')]
        hit = re.fullmatch(r'(\w+)(\[[a-z]\])+', text)
        if hit and hit.group(1) in types:
            return [(hit.group(1), 'val')]
        if text in types:
            return [(text, 'val')]
        return None

    lines = [l.strip() for l in section.splitlines() if l.strip().startswith('-')]
    # Aliases first: "n == nums.length", "nums.length == n", "The number of nodes in the tree is `n`".
    for line in lines:
        for code in re.findall(r'`([^`]+)`', line):
            hit = re.fullmatch(r'\s*(\w+)\s*==\s*([\w.\[\]]+)\s*', code) or None
            if hit:
                a, b = hit.groups()
                if re.fullmatch(r'\w+', b) and not re.fullmatch(r'\w+', a):
                    a, b = b, a
                if a not in types and re.fullmatch(r'\w+', a):
                    target = term(b)
                    alias[a] = target[0] if target and len(target) == 1 and target[0][1] == 'len' else None
        hit = re.search(r'number of (?:the )?nodes in (?:the |each )?(tree|(?:linked )?list)s? is `(\w+)`', line)
        if hit:
            group = nodes['tree' if hit.group(1) == 'tree' else 'list']
            alias[hit.group(2)] = (group[0], 'len') if len(group) == 1 else None
    for line in lines:
        hit = re.search(r'number of (?:the )?nodes in (?:the |each |both )?(tree|(?:linked )?list)s? is in the range `\[([^,\]]+),\s*([^\]]+)\]`', line)
        if hit:
            lo, hi = number(hit.group(2)), number(hit.group(3))
            if lo is not None and hi is not None:
                for name in nodes['tree' if hit.group(1) == 'tree' else 'list']:
                    put((name, 'len'), 'len', lo, hi)
            continue
        for code in re.findall(r'`([^`]+)`', line):
            parts = re.split(r'\s*(<=|<)\s*', code.strip())
            if len(parts) < 5:
                continue
            terms, ops = parts[0::2], parts[1::2]
            lo, hi = number(terms[0]), number(terms[-1])
            if lo is None or hi is None:
                continue
            for middle in terms[1:-1]:
                for side in middle.split(','):
                    targets = term(side)
                    for target in targets or []:
                        integral = not types[target[0]].startswith('double') or target[1] == 'len'
                        a = lo + 1 if ops[0] == '<' and integral else lo
                        b = hi - 1 if ops[-1] == '<' and integral else hi
                        put(target, None, a, b)
    return found


def values(value, kind):
    if kind in ('TreeNode', 'ListNode'):
        return [v for v in value if v is not None]
    out, stack = [], [value]
    while stack:
        v = stack.pop()
        if type(v) is list:
            stack.extend(v)
        else:
            out.append(v)
    return out


def holds(value, kind, prop, bound):
    lo, hi = bound
    if prop == 'len':
        if type(value) not in (list, str):
            return False
        size = len(values(value, kind)) if kind in ('TreeNode', 'ListNode') else len(value)
        return lo <= size <= hi
    vals = values(value, kind)
    return all(type(v) in (int, float) and type(v) is not bool and lo <= v <= hi for v in vals)


def cases_for(dirs):
    found = {}
    for d in dirs:
        for f in pathlib.Path(d).rglob('lc-*.json'):
            if f.name.count('.') == 1:
                found.setdefault(f.stem, []).append(f)
    return found


def main():
    statements = {}
    for line in open(sys.argv[1], encoding='utf8'):
        if line.strip():
            row = json.loads(line)
            statements[row['id']] = row.get('descriptionEn') or ''
    files = cases_for(sys.argv[2:])
    result, dropped, unchecked = {}, 0, []
    for id, c in sorted(contracts.items(), key=lambda x: x[1]['number']):
        params = params_of(c)
        if not params or id not in statements:
            continue
        found = extract(statements[id], params)
        if not found:
            continue
        if id not in files:
            unchecked.append(id)
            continue
        kinds = {p['name']: (i, p['type']) for i, p in enumerate(params)}
        try:
            for f in files[id]:
                for case in json.loads(f.read_text())['cases']:
                    scope = {'sys': type('Input', (), {'stdin': io.StringIO(case['input'])})(), 'json': json}
                    exec(c['spec']['parse'], scope)  # the contract's reviewed snippet, offline
                    args = scope['args']
                    if len(args) != len(params):
                        raise ValueError('argument count')
                    for name in list(found):
                        i, kind = kinds[name]
                        for prop in list(found[name]):
                            if not holds(args[i], kind, prop, found[name][prop]):
                                del found[name][prop]
                                dropped += 1
                        if not found[name]:
                            del found[name]
        except Exception as error:  # undecodable cases: keep nothing for this problem
            print(f'{id}: {error}', file=sys.stderr)
            unchecked.append(id)
            continue
        if found:
            result[id] = found
    (ROOT / 'lib/content/leetcode-constraints.json').write_text(json.dumps(result, separators=(',', ':'), sort_keys=True) + '\n')
    print(f'{len(result)} problems kept; {dropped} constraints dropped by judge cases; unchecked: {unchecked}')


if __name__ == '__main__':
    main()
