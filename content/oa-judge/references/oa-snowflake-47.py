def solve(d):
    n,k=map(int,d[:2]);size=1<<n;reachable=bytearray(size)
    for x in map(int,d[2:]):reachable[x]=1
    step=1
    for _ in range(n):
        for base in range(0,size,2*step):
            for low in range(base,base+step):
                if reachable[low]:reachable[low+step]=1
        step*=2
    return str(sum(reachable))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
