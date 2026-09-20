def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));left=[-1]*n;right=[-1]*n;stack=[]
    for i in range(n):
        while stack and a[stack[-1]]>=a[i]:stack.pop()
        if stack:left[i]=stack[-1]
        stack.append(i)
    stack=[]
    for i in range(n-1,-1,-1):
        while stack and a[stack[-1]]>=a[i]:stack.pop()
        if stack:right[i]=stack[-1]
        stack.append(i)
    out=[]
    for token in d[2+n:]:
        i=int(token)-1;l=left[i];r=right[i]
        if l<0:answer=r
        elif r<0 or i-l<r-i:answer=l
        else:answer=r
        out.append(str(answer+1 if answer>=0 else -1))
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
