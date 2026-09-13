def solve(d):
    n,q=map(int,d[:2]);p=list(map(int,d[2:2+n]));seen=bytearray(n);cycles=0
    for i in range(n):
        if seen[i]:continue
        cycles+=1;j=i
        while not seen[j]:seen[j]=1;j=p[j]-1
    minimum=n-cycles
    return ''.join('1' if int(v)>=minimum and (int(v)-minimum)%2==0 else '0' for v in d[2+n:])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
