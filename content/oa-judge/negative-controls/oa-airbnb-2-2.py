def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];hours=d[-1]
    if hours<n:return '-1'
    lo=1;hi=max(a)
    while lo<hi:
        mid=(lo+hi)//2
        if sum((v+mid-1)//mid for v in a)<=hours:hi=mid
        else:lo=mid+1
    return str(lo-1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
