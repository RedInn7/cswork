def solve(data):
    import re
    expression=' '.join(data); operations=[]; values=[]
    for token in re.findall(r'add|sub|-?\d+|\)',expression):
        if token in ('add','sub'):operations.append(token)
        elif token==')':
            right=values.pop(); left=values.pop(); op=operations.pop()
            values.append(left+right if op=='add' else left-right)
        else:values.append(int(token))
    return str(values[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
