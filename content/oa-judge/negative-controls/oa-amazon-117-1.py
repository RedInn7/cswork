def solve(d):
    n=int(d[0]);p=list(range(n));size=[1]*n;answer=n
    def root(a):
        while p[a]!=a:p[a]=p[p[a]];a=p[a]
        return a
    for i in range(2,len(d),2):
        a,b=root(int(d[i])),root(int(d[i+1]))
        if a!=b:
            if size[a]<size[b]:a,b=b,a
            p[b]=a;size[a]+=size[b];answer-=1
    return str(n-int(d[1]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
