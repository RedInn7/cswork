def solve(d):
    last=[-1,-1,-1];best=len(d)
    for i,value in enumerate(map(int,d[1:])):
        if value:
            other=3-value
            if last[other]>=0:best=min(best,i-last[other]-1)
            last[value]=i
    return str(best if best<len(d) else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
