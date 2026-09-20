def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);answer=[0]*n
    for order in (range(n),):
        stack=[]
        for i in order:
            answer[i]+=len(stack)
            while stack and stack[-1]<=a[i]:stack.pop()
            stack.append(a[i])
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
