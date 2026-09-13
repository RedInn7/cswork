def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));state=d[2+n];unlock=[0]*n;distance=n
    for i,c in enumerate(state):
        distance=0 if c=='1' else distance+1
        if distance<n:unlock[distance]=max(unlock[distance],a[i])
    if not unlock[0]:return '-1'
    current=0;answer=[]
    for step in range(m):
        if step<n:current=max(current,unlock[step])
        answer.append(current)
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
