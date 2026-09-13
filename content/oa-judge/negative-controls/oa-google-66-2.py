from collections import deque
def solve(data):
    h,w,limit=map(int,data[:3]);g=data[3:];q=deque([(0,0,0)]);seen={(0,0)}
    while q:
        r,c,d=q.popleft()
        if (r,c)==(h-1,w-1):return 'Yes' if d<=limit else 'No'
        if d>=limit:continue
        for dr,dc in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
            a,b=r+dr,c+dc
            if 0<=a<h and 0<=b<w and g[a][b]=='.' and (a,b) not in seen:seen.add((a,b));q.append((a,b,d+1))
    return 'No'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
