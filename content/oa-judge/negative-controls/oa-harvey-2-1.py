def solve(raw):
    commands=raw.splitlines();cells={};out=[]
    def cyclic(start):
        active=set();done=set()
        def visit(label):
            if label in active:return True
            if label not in cells or label in done:return False
            active.add(label);found=any(visit(t.strip()) for t in cells[label].split('+') if not t.strip().isdigit());active.remove(label);done.add(label);return found
        return visit(start)
    def evaluate(label,active,memo):
        if label not in cells or label in active:raise ValueError
        if label in memo:return memo[label]
        active.add(label);value=sum(int(t.strip()) if t.strip().isdigit() else evaluate(t.strip(),active,memo) for t in cells[label].split('+'));active.remove(label);memo[label]=value;return value
    for command in commands:
        if not command:continue
        op,rest=command.split(' ',1)
        if op=='GET':
            try:out.append(str(evaluate(rest.strip(),set(),{})))
            except (ValueError,RecursionError):out.append('ERROR')
        else:
            label,expr=rest.split(' ',1);old=cells.get(label);cells[label]=expr
            try:
                if False:raise ValueError
                out.append('OK')
            except (ValueError,RecursionError):
                if old is None:cells.pop(label,None)
                else:cells[label]=old
                out.append('ERROR')
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
