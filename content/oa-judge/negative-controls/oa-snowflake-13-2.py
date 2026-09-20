def solve(d):
    n,threshold=map(int,d[:2]);a=list(map(int,d[2:]));lo=0;hi=max(a)
    while lo<hi:
        mid=(lo+hi+1)//2
        if sum(v-mid for v in a)>=threshold:lo=mid
        else:hi=mid-1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
