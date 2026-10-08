import sys

def solve(raw):
    values=list(map(int,raw.split()))
    n=values[0]
    a=values[1:]
    left=[-1]*n
    right=[n]*n
    stack=[]
    for i in range(n):
        while stack and a[stack[-1]]<a[i]:
            stack.pop()
        if stack:
            left[i]=stack[-1]
        stack.append(i)
    stack=[]
    for i in range(n-1,-1,-1):
        while stack and a[stack[-1]]<=a[i]:
            stack.pop()
        if stack:
            right[i]=stack[-1]
        stack.append(i)
    answer=sum(right[i]-left[i]-1 for i in range(n))
    return str(answer)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
