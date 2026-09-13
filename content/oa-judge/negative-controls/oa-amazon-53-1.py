def solve(d):
    a=sorted(map(int,d[1:]));n=len(a);previous=[0]*n
    for length in range(2,n+1):
        current=[0]*(n-length+1)
        for left in range(n-length+1):current[left]=min(previous[left],previous[left+1])
        previous=current
    return str(previous[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
