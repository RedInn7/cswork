def solve(raw):
    from collections import deque
    v=list(map(int,raw.split()));n,m=v[:2];p=v[2:2+n];day=[0]*(n+1)
    for i,x in enumerate(p,1):day[x]=i
    q=deque();answer=n
    for i in range(1,n+1):
        while q and day[q[-1]]<=day[i]:q.pop()
        q.append(i)
        while q and q[0]<=i-m:q.popleft()
        if i>=m:answer=min(answer,q[0])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
