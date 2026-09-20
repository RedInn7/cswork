def solve(d):
    stack=[]
    for c in d[0]:
        stack.append(c)
        if len(stack)>=3 and stack[-3:]==['A','S','W']:del stack[-3:]
    return ''.join(stack) or '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
