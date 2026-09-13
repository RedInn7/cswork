def solve(data):
    n,k=map(int,data[:2]); a=list(map(int,data[2:])); lo=0; hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if a[mid]-mid<k:lo=mid+1
        else:hi=mid
    return str(k+lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
