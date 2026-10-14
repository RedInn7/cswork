"""Authored LeetCode invocation and native transport. Runs inside go-judge only."""
import functools
import json
import sys
import subprocess
from contextlib import redirect_stdout
from types import CodeType, GeneratorType, TracebackType
from pathlib import Path
import tree_codec as trees
import linked_codec as lists
import special_node_codec as special
import auxiliary_codec as auxiliary
from reference_adapters import adapt_result
from result_contract import validate_result, format_result
from complex_design_semantics import CLASSES


def _lru_cache_wrapper(user_function, maxsize, typed, info):
    """functools.lru_cache/cache without C frames between recursive calls.

    Since 3.12 each call through the C wrapper also spends CPython's fixed C
    recursion budget, so memoized recursion fails near depth 3300 whatever
    sys.setrecursionlimit says. Python-to-Python calls do not, leaving only the
    recursion limit and memory. Per call this costs about 1.3x the C wrapper,
    bounded too (a dict keeps LRU order, oldest first); typed about 2x.
    """
    cache = {}
    get = cache.get
    pop = cache.pop
    miss = object()
    hits = misses = 0

    if maxsize is None and not typed:
        def wrapper(*args, **kwds):
            nonlocal hits, misses
            key = (*args, miss, *kwds.items()) if kwds else args
            result = get(key, miss)
            if result is miss:
                misses += 1
                result = cache[key] = user_function(*args, **kwds)
            else:
                hits += 1
            return result
    else:
        def wrapper(*args, **kwds):
            nonlocal hits, misses
            key = (*args, miss, *kwds.items()) if kwds else args
            if typed:
                key += (*map(type, args), *map(type, kwds.values()))
            result = pop(key, miss)
            if result is miss:
                misses += 1
                result = user_function(*args, **kwds)
                if maxsize != 0:
                    # The call may have cached this key already; only a new key evicts.
                    if maxsize is not None and key not in cache and len(cache) >= maxsize:
                        del cache[next(iter(cache))]
                    cache[key] = result
            else:
                hits += 1
                cache[key] = result  # now the most recently used
            return result

    def cache_clear():
        nonlocal hits, misses
        cache.clear()
        hits = misses = 0

    wrapper.cache_info = lambda: info(hits, misses, maxsize, len(cache))
    wrapper.cache_clear = cache_clear
    return wrapper


def _drain(builtin):
    # Drains a generator argument in Python: built-ins iterating it from C would
    # spend the same C budget once per level, as in max(dfs(c) for c in node.children).
    def call(*args, **kwds):
        if args and type(args[0]) is GeneratorType:
            args = ([value for value in args[0]], *args[1:])
        return builtin(*args, **kwds)
    return call


def _any(iterable):
    if type(iterable) is not GeneratorType:
        return any(iterable)
    for value in iterable:
        if value:
            return True
    return False


def _all(iterable):
    if type(iterable) is not GeneratorType:
        return all(iterable)
    for value in iterable:
        if not value:
            return False
    return True


_CONSUMERS = {'min': _drain(min), 'max': _drain(max), 'sum': _drain(sum), 'any': _any, 'all': _all}
# Harness frames that sit between recursive learner calls.
_HIDDEN = {code for function in (_lru_cache_wrapper, _drain) for code in function.__code__.co_consts
           if type(code) is CodeType} | {_any.__code__, _all.__code__}


def _generator_consumers(code):
    """Consumer built-ins to drain in Python, only when the learner writes generators."""
    codes, index = [code], 0
    while index < len(codes):
        codes += [c for c in codes[index].co_consts if type(c) is CodeType]
        index += 1
    if not any(c.co_flags & 0x20 for c in codes):  # inspect.CO_GENERATOR
        return ()
    return _CONSUMERS.keys() & {name for c in codes for name in c.co_names}


def _excepthook(kind, value, tb):
    """The default report minus harness frames, so recursion folds into
    "[Previous line repeated N more times]" again. Only the innermost frames are
    formatted: 10^6 of them take 20+ s and, unfolded, overflow the 64 KiB stderr
    collector, so a deep failure would read as a time or output limit."""
    import traceback
    pending, seen, omitted = [value], set(), 0
    while pending:
        error = pending.pop()
        if error is None or id(error) in seen:
            continue
        seen.add(id(error))
        kept = []
        frame = error.__traceback__
        while frame is not None:
            if frame.tb_frame.f_code not in _HIDDEN:
                kept.append(frame)
            frame = frame.tb_next
        if error is value:
            omitted = len(kept) - 50
        frame = None  # rebuilt, not relinked: setting tb_next walks the rest of the chain
        for entry in reversed(kept[-50:]):
            frame = TracebackType(frame, entry.tb_frame, entry.tb_lasti, entry.tb_lineno)
        error.__traceback__ = frame
        pending += error.__cause__, error.__context__
    lines = traceback.format_exception(kind, value, value.__traceback__)
    header = 'Traceback (most recent call last):\n'
    if omitted > 0 and header in lines:
        at = len(lines) - lines[::-1].index(header)  # the last one is this exception's
        lines.insert(at, f'  ... {omitted} outer frames omitted ...\n')
    sys.stderr.write(''.join(lines))


def install(spec, scope):
    # functools.lru_cache looks this up when it decorates, so @cache, @lru_cache
    # and the learner's own `from functools import ...` all get it.
    functools._lru_cache_wrapper = _lru_cache_wrapper
    sys.excepthook = _excepthook
    # install() runs from the main module, whose code already holds the learner's.
    for name in _generator_consumers(sys._getframe(1).f_code):
        scope[name] = _CONSUMERS[name]
    scope.update(TreeNode=trees.TreeNode, ListNode=lists.ListNode,
                 Interval=auxiliary.Interval, MountainArray=auxiliary.MountainArray)
    if spec.get('specialId'):
        scope.update(special.special_symbols(spec['specialId']))


def read_args(spec):
    if spec.get('complexDesignId') in (297, 449):
        return json.load(sys.stdin)
    if '--leetcode-input' not in sys.argv:
        scope = {'sys': sys, 'json': json}
        exec(spec['parse'], scope)
        return scope['args']
    args = [json.loads(line) for line in sys.stdin.read().splitlines() if line.strip()]
    return custom_args(spec, args)


def custom_args(spec, args):
    """Translate documented LeetCode examples into the existing private transport."""
    number = spec['number']
    def canonical(value):
        if type(value) is not list:
            raise ValueError('A tree must be a level-order JSON array')
        value = value[:]
        while value and value[-1] is None:
            value.pop()
        return value
    for index in spec.get('treeArgs', []):
        args[index] = canonical(args[index])
    if number in special.TREE_IDS:
        args[0] = canonical(args[0])
    if number in (235, 236, 285, 863, 1650, 1644):
        nodes = special.tree_nodes(args[0])
        positions = {}
        for index, node in enumerate(nodes):
            if node.val in positions:
                raise ValueError('Target node values must be unique')
            positions[node.val] = index
        target_positions = (1,) if number in (285, 863) else (1, 2)
        for index in target_positions:
            value = args[index]
            if type(value) is not int:
                raise ValueError('A target must be its integer node value')
            if number == 1644:
                args[index] = {'id': positions[value]} if value in positions else {'external': value}
            elif value not in positions:
                raise ValueError('Target value is not present in the tree')
            else:
                args[index] = positions[value]
    elif number == 138:
        args[0] = [[row[0], -1 if row[1] is None else row[1]] for row in args[0]]
    elif number == 160:
        if len(args) != 5:
            raise ValueError('Use five JSON lines: intersectVal, listA, listB, skipA, skipB')
        value, first, second, skip_a, skip_b = args
        if type(value) is not int or type(first) is not list or type(second) is not list or type(skip_a) is not int or type(skip_b) is not int or not 0 <= skip_a <= len(first) or not 0 <= skip_b <= len(second):
            raise ValueError('Invalid intersection example')
        if value == 0:
            return [first, second, []]
        tail = first[skip_a:]
        if not tail or tail != second[skip_b:] or tail[0] != value:
            raise ValueError('The shared tails must match intersectVal and both skip counts')
        return [first[:skip_a], second[:skip_b], tail]
    elif number == 173:
        args[1][0][0] = canonical(args[1][0][0])
    return args


def prepare(spec, args):
    context = None
    for index in spec.get('listArgs', []):
        args[index] = lists.from_values(args[index])
    for index in spec.get('listArrayArgs', []):
        args[index] = [lists.from_values(value) for value in args[index]]
    for index in spec.get('treeArgs', []):
        args[index] = trees.from_level_order(args[index])
    if spec.get('specialId'):
        args, context = special.prepare_special(spec['specialId'], args)
    if spec.get('auxiliaryId'):
        args = auxiliary.prepare_args(spec['auxiliaryId'], args)
    return args, context


def finish(spec, result, args, context):
    if spec.get('specialId'):
        result = special.finish_special(spec['specialId'], result, context)
    if spec.get('auxiliaryId'):
        result = auxiliary.prepare_result(spec['auxiliaryId'], result)
    if spec.get('resultTree', 'none') != 'none':
        result = trees.to_level_order(args[0] if spec['resultTree'] == 'arg0' else result)
    if spec.get('resultLinked', 'none') != 'none':
        result = lists.to_values(args[0] if spec['resultLinked'] == 'arg0' else result)
    return adapt_result(spec.get('resultAdapter', 'return'), result, args)


def write_result(spec, result):
    kind = spec.get('resultKind', 'integer')
    if kind == 'integer' and type(result) is bool:
        result = int(result)
    validate_result(kind, result)
    sys.stdout.write(format_result(kind, result))


def design_args(spec, args):
    operations, parameters = args
    expected = spec.get('designClass') or CLASSES[spec['complexDesignId']]
    if not operations or operations[0] != expected or len(operations) != len(parameters):
        raise ValueError('Invalid design operation sequence')
    if spec.get('complexDesignId') == 173:
        parameters[0] = [trees.from_level_order(parameters[0][0])]
    return operations, parameters


def codec_args(args):
    if type(args) is not dict or args.get('operation') not in ('serialize', 'deserialize'):
        raise ValueError('Codec requires the platform two-phase protocol')
    operation = args['operation']
    values = args['trees'] if operation == 'serialize' else args['data']
    return operation, [trees.from_level_order(v) for v in values] if operation == 'serialize' else values


def codec_output(operation, result):
    if operation == 'deserialize':
        result = [trees.to_level_order(root) for root in result]
    if operation == 'serialize' and any(type(value) is not str for value in result):
        raise TypeError('Codec.serialize must return a string')
    sys.stdout.write(json.dumps(result, ensure_ascii=True, allow_nan=False) + '\n')


def python_main(spec, scope):
    args = read_args(spec)
    if spec.get('complexDesignId') in (297, 449):
        operation, values = codec_args(args)
        with redirect_stdout(sys.stderr):
            instance = scope['Codec']()
            result = [getattr(instance, operation)(value) for value in values]
        return codec_output(operation, result)
    if spec.get('designClass') or spec.get('complexDesignId'):
        operations, parameters = design_args(spec, args)
        allowed = spec['designMethods']
        result = [None]
        with redirect_stdout(sys.stderr):
            instance = scope[operations[0]](*parameters[0])
            for method, values in zip(operations[1:], parameters[1:]):
                if method not in allowed:
                    raise ValueError('Undeclared design operation')
                value = getattr(instance, method)(*values)
                result.append(int(value) if type(value) is bool else value)
        if spec.get('complexDesignId'):
            result = json.dumps(result, ensure_ascii=True, separators=(',', ':'), allow_nan=False)
    else:
        args, context = prepare(spec, args)
        with redirect_stdout(sys.stderr):
            result = getattr(scope['Solution'](), spec['method'])(*args)
        result = finish(spec, result, args, context)
    write_result(spec, result)


class Graph:
    """Stable IDs retain input pointer identity and aliases after native execution."""
    def __init__(self):
        self.objects = []
        self.ids = {}

    def encode(self, value):
        if value is None or type(value) in (str, int, bool, float):
            return value
        if type(value) in (list, tuple):
            return [self.encode(v) for v in value]
        if id(value) not in self.ids:
            self.ids[id(value)] = len(self.objects)
            self.objects.append(value)
        return {'$ref': self.ids[id(value)]}

    def records(self):
        records = []
        index = 0
        while index < len(self.objects):
            obj = self.objects[index]
            if isinstance(obj, auxiliary.MountainArray):
                typ, fields = 'MountainArray', {'values': list(obj._values)}
            elif isinstance(obj, auxiliary.Interval):
                typ, fields = 'Interval', {'start': obj.start, 'end': obj.end}
            else:
                name = type(obj).__name__
                typ = name if name in ('TreeNode', 'ListNode') else 'Node'
                fields = {k: self.encode(v) for k, v in vars(obj).items()
                          if k in ('val', 'left', 'right', 'next', 'random', 'prev', 'child', 'parent')}
            records.append({'id': index, 'type': typ, 'fields': fields})
            index += 1
            if index > 1000000:
                raise ValueError('Oversized node graph')
        return records

    def decode(self, value):
        if type(value) is dict:
            if set(value) != {'$ref'} or type(value['$ref']) is not int or not 0 <= value['$ref'] < len(self.objects):
                raise ValueError('Invalid node reference')
            return self.objects[value['$ref']]
        if type(value) is list:
            return [self.decode(v) for v in value]
        return value

    def restore(self, records, spec):
        if type(records) is not list or len(records) < len(self.objects) or len(records) > 1000000:
            raise ValueError('Incomplete or oversized native node graph')
        node_class = special.special_symbols(spec['specialId'])['Node'] if spec.get('specialId') else trees.TreeNode
        classes = {'TreeNode': trees.TreeNode, 'ListNode': lists.ListNode, 'Node': node_class,
                   'Interval': auxiliary.Interval}
        for index, record in enumerate(records):
            if record.get('id') != index:
                raise ValueError('Native node IDs must be contiguous and stable')
            if index >= len(self.objects):
                cls = classes.get(record.get('type'))
                if cls is None:
                    raise ValueError('Invalid new native node type')
                self.objects.append(cls())
        for obj, record in zip(self.objects, records):
            for key, value in record['fields'].items():
                if key in ('val', 'left', 'right', 'next', 'random', 'prev', 'child', 'parent', 'start', 'end'):
                    setattr(obj, key, self.decode(value))


def native_main(spec, command):
    raw = read_args(spec)
    graph = Graph()
    context = None
    request = {'version': 1, 'problemId': spec['number'], 'method': spec['method']}
    if spec.get('complexDesignId') in (297, 449):
        operation, args = codec_args(raw)
        request.update(kind='codec', operation=operation, args=graph.encode(args))
    elif spec.get('designClass') or spec.get('complexDesignId'):
        operations, parameters = design_args(spec, raw)
        args = []
        request.update(kind='design', args=[], operations=operations, parameters=graph.encode(parameters))
    else:
        args, context = prepare(spec, raw)
        if context:
            for node in context.get('nodes', []):
                graph.encode(node)
        request.update(kind='function', args=graph.encode(args))
    request['nodes'] = graph.records()
    output = Path('cswork-result.json')
    output.unlink(missing_ok=True)
    # Child stdout is diagnostic; only the dedicated file carries the protocol.
    completed = subprocess.run(command, input=json.dumps(request, ensure_ascii=True, allow_nan=False).encode(),
                               stdout=sys.stderr, stderr=sys.stderr, check=False)
    if completed.returncode:
        raise RuntimeError('Native solution exited with status ' + str(completed.returncode))
    if not output.is_file() or output.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Missing or oversized native result')
    response = json.loads(output.read_text())
    graph.restore(response.get('nodes', []), spec)
    result = graph.decode(response['result'])
    if request['kind'] == 'codec':
        return codec_output(request['operation'], result)
    if request['kind'] == 'function':
        args = graph.decode(response['args'])
        result = finish(spec, result, args, context)
    else:
        result = [int(value) if type(value) is bool else value for value in result]
        if spec.get('complexDesignId'):
            result = json.dumps(result, ensure_ascii=True, separators=(',', ':'), allow_nan=False)
    write_result(spec, result)
