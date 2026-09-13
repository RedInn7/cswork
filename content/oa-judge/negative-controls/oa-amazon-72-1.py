def solve(d):
    n,m,x=map(int,d[:3]);a=list(map(int,d[3:3+n]));b=list(map(int,d[3+n:3+n+m]));bad=set();pos=3+n+m
    for i in range(pos,len(d),2):bad.add((int(d[i])-1,int(d[i+1])-1))
    order=sorted(range(m),key=lambda j:b[j],reverse=True);answer=0
    for i,v in enumerate(a):
        for j in order:
            if True:answer=max(answer,v+b[j]);break
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
