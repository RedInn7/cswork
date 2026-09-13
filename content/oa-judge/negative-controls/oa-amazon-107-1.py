def solve(d):
    n,q=map(int,d[:2]);p=list(map(int,d[2:2+n]));prefix=[0]
    for v in p:prefix.append(prefix[-1]+v)
    end=list(range(1,n+1))
    for j in range(n-2,-1,-1):
        if p[j]==p[j+1]:end[j]=end[j+1]
    answer=[]
    for i in range(2+n,len(d),2):
        a,b=end[int(d[i])-1],end[int(d[i+1])-1];answer.append(n*p[-1]-prefix[n])
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
