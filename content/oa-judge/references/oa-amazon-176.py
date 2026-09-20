def solve(d):
    from collections import deque
    n,m,k=map(int,d[:3]);g=[[0]*m for _ in range(n)]
    for t in range(n*m):g[int(d[3+2*t])-1][int(d[4+2*t])-1]=t+1
    rows=[]
    for row in g:
        q=deque();out=[]
        for j,v in enumerate(row):
            while q and row[q[-1]]<=v:q.pop()
            q.append(j)
            while q[0]<=j-k:q.popleft()
            if j>=k-1:out.append(row[q[0]])
        rows.append(out)
    answer=n*m
    for j in range(m-k+1):
        q=deque()
        for i in range(n):
            while q and rows[q[-1]][j]<=rows[i][j]:q.pop()
            q.append(i)
            while q[0]<=i-k:q.popleft()
            if i>=k-1:answer=min(answer,rows[q[0]][j])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
