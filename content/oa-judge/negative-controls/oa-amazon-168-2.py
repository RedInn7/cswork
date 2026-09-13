def solve(d):
    counts=[0,0]
    for i,v in enumerate(d[1:]):
        if int(v)==10**9:counts[i%2]+=1
    return str(sum(d[i]!=d[i-1] for i in range(2,len(d))))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
