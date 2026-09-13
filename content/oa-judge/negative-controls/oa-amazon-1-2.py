def solve(d):
    a=list(map(int,d[1:])); n=len(a); left=[-1]*n; right=[n]*n; stack=[]
    for i,v in enumerate(a):
        while stack and a[stack[-1]]<=v: stack.pop()
        if stack: left[i]=stack[-1]
        stack.append(i)
    stack=[]
    for i in range(n-1,-1,-1):
        while stack and a[stack[-1]]<=a[i]: stack.pop()
        if stack: right[i]=stack[-1]
        stack.append(i)
    answer=0
    for i,v in enumerate(a):
        l=i-left[i]; r=right[i]-i
        answer+=v*l*r*(l+r)//2
    return str(answer%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
