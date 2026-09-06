"""Authored LeetCode invocation and native transport. Runs inside go-judge only."""
import json
import sys
import subprocess
from contextlib import redirect_stdout
from pathlib import Path
import tree_codec as trees
import linked_codec as lists
import special_node_codec as special
import auxiliary_codec as auxiliary
from reference_adapters import adapt_result
from result_contract import validate_result, format_result
from complex_design_semantics import CLASSES


def install(spec, scope):
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
