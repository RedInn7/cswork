def solve(raw):
    from collections import deque
    v=list(map(int,raw.split()));it=iter(v);rows=next(it);cols=next(it);w=set((next(it),next(it)) for _ in range(next(it)));t=set((next(it),next(it)) for _ in range(next(it)));start=(next(it),next(it));end=(next(it),next(it))
    if start in w or end in w:return '-1 0'
    dist={start:0};best={start:0};q=deque([start]);dirs=((1,0),(-1,0),(0,1),(0,-1))
    while q:
        r,c=q.popleft()
        for dr,dc in dirs:
            z=(r+dr,c+dc)
            if not(0<=z[0]<rows and 0<=z[1]<cols) or z in w:continue
            if z not in dist:dist[z]=dist[(r,c)]+1;best[z]=best[(r,c)]+int(z in t);q.append(z)
            elif dist[z]==dist[(r,c)]+1:best[z]=max(best[z],best[(r,c)]+int(z in t))
    return f'{dist[end]} {best[end]}' if end in dist else '-1 0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
