"""Structure checks for this refactoring task.

Python's own ast module measures every module in src/: the longest function or lambda in lines,
the most branches in one (if, elif, for, while, conditional expressions, each if of a
comprehension, each case of a match and each extra operand of and/or) and how many blocks repeat
one seen before: runs of three statements, and any if, for, while, with or try of three lines or
more, compared without their literals and variable names. Each number must stay within its limit.
The starting code's numbers are printed beside yours. Code run from strings (exec, eval, compile)
would escape every measure, so src/ may not use them.
"""
import ast
import os
import unittest

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')
BEFORE = {'longest_function': 133, 'most_branches': 38, 'copied_blocks': 5}
LIMITS = {'longest_function': 25, 'most_branches': 8, 'copied_blocks': 1}
WINDOW = 3
BLOCKS = (ast.If, ast.For, ast.While, ast.With, ast.Try)
FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)
GENERATED = {'exec', 'eval', 'compile'}


def own_nodes(function):
    """A function's nodes, without those of functions, classes and lambdas nested in it."""
    stack = list(ast.iter_child_nodes(function))
    while stack:
        node = stack.pop()
        yield node
        if not isinstance(node, FUNCTIONS + (ast.ClassDef,)):
            stack.extend(ast.iter_child_nodes(node))


def branches(function):
    count = 0
    for node in own_nodes(function):
        if isinstance(node, (ast.If, ast.For, ast.While, ast.IfExp, ast.match_case)):
            count += 1
        elif isinstance(node, ast.BoolOp):
            count += len(node.values) - 1
        elif isinstance(node, ast.comprehension):
            count += len(node.ifs)
    return count


def generated_code(trees):
    """exec, eval and compile wherever src/ names, imports or reaches them through builtins."""
    # ponytail: names only; getattr(builtins, 'ex' + 'ec') still gets past, and the review would see it.
    found = set()
    for tree in trees:
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and node.id in GENERATED:
                found.add(node.id)
            elif isinstance(node, ast.alias) and node.name in GENERATED:
                found.add(node.name)
            elif (isinstance(node, ast.Attribute) and node.attr in GENERATED and isinstance(node.value, ast.Name)
                  and node.value.id in ('builtins', '__builtins__')):
                found.add(node.attr)
    return sorted(found)


def copied_blocks(trees):
    """Blocks that repeat an earlier one, literals and variable names ignored (see the module docstring)."""
    seen = set()
    repeats = 0
    for tree in trees:
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant):
                node.value = None
            elif isinstance(node, ast.Name):
                node.id = '_'
        for node in ast.walk(tree):
            for field in ('body', 'orelse', 'finalbody'):
                body = getattr(node, field, None)
                if not isinstance(body, list):
                    continue
                # Docstrings are left out: every one looks the same once literals are.
                body = [s for s in body if not (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant))]
                runs = [body[i:i + WINDOW] for i in range(len(body) - WINDOW + 1)]
                # A loop or condition of three lines or more counts on its own too.
                runs += [[s] for s in body if isinstance(s, BLOCKS) and s.end_lineno - s.lineno >= 2]
                for run in runs:
                    key = '\n'.join(ast.dump(statement) for statement in run)
                    if key in seen:
                        repeats += 1
                    seen.add(key)
    return repeats


def measure(folder=SRC):
    trees = []
    for name in sorted(os.listdir(folder)):
        if name.endswith('.py'):
            with open(os.path.join(folder, name), encoding='utf-8') as source:
                trees.append(ast.parse(source.read(), name))
    functions = [n for tree in trees for n in ast.walk(tree) if isinstance(n, FUNCTIONS)]
    return {
        'longest_function': max([f.end_lineno - f.lineno + 1 for f in functions] or [0]),
        'most_branches': max([branches(f) for f in functions] or [0]),
        # Before copied_blocks, which renames every variable.
        'generated_code': generated_code(trees),
        'copied_blocks': copied_blocks(trees),
    }


class StructureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.now = measure()
        print('structure        before    now  limit')
        for key, limit in LIMITS.items():
            print('%-16s %6d %6d %6d' % (key, BEFORE[key], cls.now[key], limit))

    def test_functions_are_short(self):
        self.assertLessEqual(self.now['longest_function'], LIMITS['longest_function'], 'split the longest function')

    def test_functions_branch_little(self):
        self.assertLessEqual(self.now['most_branches'], LIMITS['most_branches'], 'too many branches in one function')

    def test_no_copied_blocks(self):
        self.assertLessEqual(self.now['copied_blocks'], LIMITS['copied_blocks'], 'repeated code is left')

    def test_no_generated_code(self):
        self.assertEqual(self.now['generated_code'], [], 'src/ may not run code from strings')


if __name__ == '__main__':
    unittest.main()
