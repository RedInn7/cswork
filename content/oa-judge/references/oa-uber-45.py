def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:n+2]));pattern=list(map(int,d[n+2:]));failure=[0]*m;j=0
    for i in range(1,m):
        while j and pattern[i]!=pattern[j]:j=failure[j-1]
        if pattern[i]==pattern[j]:j+=1
        failure[i]=j
    j=answer=0
    for i in range(n-1):
        value=(a[i+1]>a[i])-(a[i+1]<a[i])
        while j and value!=pattern[j]:j=failure[j-1]
        if value==pattern[j]:j+=1
        if j==m:answer+=1;j=failure[j-1]
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
