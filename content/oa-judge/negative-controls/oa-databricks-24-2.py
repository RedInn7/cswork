def solve(data):
    v=list(map(int,data.split())); n,m=v[:2]; a=v[2:2+n]; pat=v[2+n:2+n+m]
    text=[(b>x)-(b<x) for x,b in zip(a,a[1:])]; pi=[0]*m
    for i in range(1,m):
        j=pi[i-1]
        while j and pat[i]!=pat[j]: j=0
        if pat[i]==pat[j]: j+=1
        pi[i]=j
    count=j=0
    for value in text:
        while j and value!=pat[j]: j=0
        if value==pat[j]: j+=1
        if j==m: count+=1; j=0
    return str(count)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
