def solve(data):
    n,m=map(int,data[:2]); a=list(map(int,data[2:2+n])); p=list(map(int,data[2+n:])); prefix=[0]*m
    for i in range(1,m):
        j=prefix[i-1]
        while j and p[i]!=p[j]:j=prefix[j-1]
        if p[i]==p[j]:j+=1
        prefix[i]=j
    matched=answer=0
    for i in range(n-1):
        value=(a[i+1]>a[i])-(a[i+1]<a[i])
        while matched and value!=p[matched]:matched=prefix[matched-1]
        if value==p[matched]:matched+=1
        if matched==m:answer+=1; matched=prefix[matched-1]
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
