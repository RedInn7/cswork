def solve(d):
    a=list(map(int,d[1:]));stack=[];answer=0
    for i,v in enumerate(a):
        while stack and a[stack[-1]]<v:stack.pop()
        if stack:answer+=stack[-1]+1
        stack.append(i)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
