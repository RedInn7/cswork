from collections import deque
def solve(d):
    n,m,sr,sc=map(int,d[:4]);grid=[list(map(int,d[4+i*m:4+(i+1)*m])) for i in range(n)];dist=[[-1]*m for _ in range(n)];dist[sr][sc]=1;queue=deque([(sr,sc)])
    while queue:
        i,j=queue.popleft()
        for a,b in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
            if 0<=a<n and 0<=b<m and dist[a][b]<0 and grid[a][b]<=grid[i][j]:dist[a][b]=dist[i][j]+1;queue.append((a,b))
    return '\n'.join(' '.join(map(str,row)) for row in dist)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
