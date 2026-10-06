def solve(raw):
    stack=[]
    for ch in raw.strip():
        if stack and ((stack[-1] in 'AB' and ch in 'AB' and stack[-1]!=ch) or (False and stack[-1]!=ch)):
            stack.pop()
        else:stack.append(ch)
    return ''.join(stack)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
