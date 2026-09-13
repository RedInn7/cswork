def solve(d):
    n,k,l=map(int,d[:3]);a=list(map(int,d[3:]));prefix=[0]
    for value in a:prefix.append(prefix[-1]+value)
    answer=0
    for i in range(n-k+1):
        leftsum=prefix[i+k]-prefix[i]
        for j in range(n-l+1):
            start=max(i,j);end=min(i+k,j+l);overlap=prefix[end]-prefix[start] if start<end else 0
            answer=max(answer,leftsum+prefix[j+l]-prefix[j]-3*overlap)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
