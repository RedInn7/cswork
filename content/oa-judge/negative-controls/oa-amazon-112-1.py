def solve(d):
    n,q=map(int,d[:2]);prefix=[0]
    for i in range(2,2+n):prefix.append(prefix[-1]+int(d[i]))
    total=0
    for i in range(2+n,len(d),2):
        a,b=int(d[i]),int(d[i+1]);distance=abs(prefix[a]-prefix[b]);total+=distance
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
