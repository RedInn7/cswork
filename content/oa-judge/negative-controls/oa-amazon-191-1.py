def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));diff=[0]*(n+1)
    for i in range(2+n,len(d),2):l=int(d[i]);r=int(d[i+1]);diff[l]+=1;diff[r+1]-=1
    weights=[];cur=0
    for i in range(n):cur+=diff[i];weights.append(cur)
    order=sorted(range(n),key=lambda i:a[i]);left=0;total=answer=0
    while left<n:
        right=left;extra=0
        while right<n and a[order[right]]==a[order[left]]:
            weight=weights[order[right]]
            if weight==0:answer+=total
            extra+=min(1,weight);right+=1
        total+=extra;left=right
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
