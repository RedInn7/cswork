def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    left=0
    while left+1<n and a[left]<a[left+1]: left+=1
    if left==n-1: return str(n*(n+1)//2)
    right=n-1
    while right>0 and a[right-1]<a[right]: right-=1
    ans=0; j=right
    for i in range(left+2):
        j=max(j,i+1)
        if i:
            while j<n and a[j]<=a[i-1]: j+=1
        ans+=n-j+1
    return str(ans)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
