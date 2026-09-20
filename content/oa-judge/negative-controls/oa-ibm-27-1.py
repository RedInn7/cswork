def solve(d):
    stack=[]
    for c in d[0]:
        stack.append(c)
        if len(stack)>=3 and stack[-3:]==['A','W','S']:del stack[-3:]
    return d[0].replace('AWS','') or '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
