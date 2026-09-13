def solve(d):
    n,k=map(int,d[:2]);s=d[2];a=list(map(int,d[3:]));start=0;answer=0
    for i in range(1,n+1):
        if i==n or s[i]!=s[start]:
            answer+=sum(sorted(a[start:i],reverse=True)[:k]);start=i
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
