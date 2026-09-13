def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));p=[0]
    for v in a:p.append(p[-1]+v)
    minimum=0;answer=0
    for r in range(k,n+1):
        minimum=min(minimum,p[r-k]);value=p[r]-minimum
        answer=value if answer is None else max(answer,value)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
