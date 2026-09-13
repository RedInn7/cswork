def solve(d):
    n=int(d[0]);required=list(map(int,d[1:n+1]));position=[0]*(n+1)
    for i in range(n):position[int(d[n+1+i])]=i
    maximum=-1;answer=0
    for v in required:
        answer+=position[v]<maximum;maximum=max(maximum,position[v])
    return str(sum(position[v]!=i for i,v in enumerate(required)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
