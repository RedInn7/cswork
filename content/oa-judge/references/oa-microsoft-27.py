def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));suffix=[0]*(n+1)
    for i in range(n-1,-1,-1):suffix[i]=suffix[i+1]|a[i]
    prefix=answer=0
    for i,value in enumerate(a):answer=max(answer,prefix|(value<<k)|suffix[i+1]);prefix|=value
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
