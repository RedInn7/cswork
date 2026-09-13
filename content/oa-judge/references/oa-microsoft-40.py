def solve(d):
    from collections import Counter
    n,r=map(int,d[:2]);a=list(map(int,d[2:]));counts=Counter(a[r:]);distinct=len(counts);answer=distinct
    for right in range(r,n):
        left=right-r
        if counts[a[left]]==0:distinct+=1
        counts[a[left]]+=1;counts[a[right]]-=1
        if counts[a[right]]==0:distinct-=1
        answer=max(answer,distinct)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
