from collections import deque
def solve(d):
    n,m=map(int,d[:2]);g=d[2:];dirs=[(-1,0),(1,0),(0,-1),(0,1)];start=next((i,j) for i in range(n) for j in range(m) if g[i][j]=='S');q=deque([(start[0],start[1],4,0)]);seen={(start[0],start[1],4)}
    while q:
        x,y,lock,steps=q.popleft()
        if g[x][y]=='E':return str(steps)
        for direction,(dx,dy) in enumerate(dirs):
            if lock!=4 and direction!=lock:continue
            a,b=x+dx,y+dy;length=1
            while 0<=a<n and 0<=b<m:
                state=(a,b,4 if length==1 else direction)
                if g[a][b]!='#' and state not in seen:seen.add(state);q.append((*state,steps+1))
                a+=dx;b+=dy;length+=1
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
