def solve(raw):
    stack=[]
    for c in raw.strip():
        stack.append(c)
        if len(stack)>=3 and stack[-3:]==['A','W','S']:del stack[-3:]
    return ''.join(stack) or '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
