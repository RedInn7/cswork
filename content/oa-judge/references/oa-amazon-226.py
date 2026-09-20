def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));left=best=0
    for right,v in enumerate(a):
        while left<right and v>k*a[left]:left+=1
        best=max(best,right-left+1)
    return str(n-best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
