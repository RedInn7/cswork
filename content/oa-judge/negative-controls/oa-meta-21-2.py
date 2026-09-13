def solve(data):
    import json
    stack=[(json.loads(data),0)]; total=0
    while stack:
        values,depth=stack.pop()
        for value in values:
            if isinstance(value,list):stack.append((value,depth+1))
            else:total+=value*depth
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
