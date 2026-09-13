def solve(d):
    from collections import deque
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));width=max(0,k-1)
    if width==0:return '0'
    gaps=[a[i+1]-a[i] for i in range(n-1)];queue=deque();answer=10**30
    for i,v in enumerate(gaps):
        while queue and gaps[queue[-1]]<=v:queue.pop()
        queue.append(i)
        while queue[0]<=i-width:queue.popleft()
        if i>=width-1:answer=min(answer,gaps[queue[0]])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
