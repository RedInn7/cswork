def solve(d):
    from collections import defaultdict
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));freq=defaultdict(int);total=0;best=0
    for i,v in enumerate(a):
        freq[v]+=1;total+=v
        if i>=k:
            old=a[i-k];freq[old]-=1;total-=old
            if freq[old]==0:del freq[old]
        if i>=k-1 and len(freq)==k:best=total if best is None else max(best,total)
    return str(-1 if best is None else best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
