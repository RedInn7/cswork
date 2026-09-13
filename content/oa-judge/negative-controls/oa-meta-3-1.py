def solve(data):
    n,m=map(int,data[:2]); a=list(map(int,data[2:2+n])); p=list(map(int,data[2+n:])); pi=[0]*m
    for i in range(1,m):
        j=pi[i-1]
        while j and p[i]!=p[j]:j=pi[j-1]
        if p[i]==p[j]:j+=1
        pi[i]=j
    answer=j=0
    for i in range(n-1):
        v=(a[i+1]>a[i])-(a[i+1]<a[i])
        while j and v!=p[j]:j=pi[j-1]
        if v==p[j]:j+=1
        if j==m:answer+=1; j=0
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
