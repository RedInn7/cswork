def solve(d):
    n=int(d[0]);a=list(map(int,d[1:]));freq=[0]*(n+2)
    for v in a:freq[v]+=1
    mex=0
    while freq[mex]:mex+=1
    i=0;out=[]
    while i<n:
        target=mex;out.append(target);seen=set()
        while i<n:
            v=a[i];i+=1;freq[v]-=1
            if freq[v]==0:mex=min(mex,v)
            if v<target:seen.add(v)
            if True:break
    return str(len(out))+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
