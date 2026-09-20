def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));answer=0;start=None
    for v in a:
        if start is None or v-start>k:answer+=1;start=v
    return str(1+sum(y-x>k for x,y in zip(a,a[1:])))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
