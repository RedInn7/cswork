def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));prefix=[0]
    for i in range(1,n):prefix.append(prefix[-1]+abs(a[i]-a[i-1]))
    answer=prefix[-1]
    for start in range(n-k+1):
        end=start+k-1;lo=max(0,start-1);hi=min(n-1,end+1)
        cost=prefix[-1]-(prefix[hi]-prefix[lo])
        if start>0 and end+1<n:cost+=abs(a[end+1]-a[start-1])
        answer=min(answer,cost)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
