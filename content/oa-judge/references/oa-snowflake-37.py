from collections import deque
def solve(d):
    m=int(d[0]);adj={}
    for i in range(m):a,b=d[1+2*i:3+2*i];adj.setdefault(a,[]).append(b)
    start,target=d[1+2*m:3+2*m];q=deque([(start,0)]);seen={start}
    def get_links(page):return adj.get(page,[])
    while q:
        u,dist=q.popleft()
        if u==target:return str(dist)
        for v in get_links(u):
            if v not in seen:seen.add(v);q.append((v,dist+1))
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
