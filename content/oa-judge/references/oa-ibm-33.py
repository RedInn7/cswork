def solve(d):
    n,m,k=map(int,d[:3]);s=d[3];i=run=answer=0
    while i<n:
        run=run+1 if s[i]=='0' else 0
        if run==m:answer+=1;i=min(i,n-k)+k;run=0
        else:i+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
