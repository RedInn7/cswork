def solve(d):
    n,k=map(int,d[:2]); intervals=sorted((int(d[i]),int(d[i+1])) for i in range(2,len(d),2)); merged=[]
    for a,b in intervals:
        if merged and a<=merged[-1][1]:merged[-1][1]=max(merged[-1][1],b)
        else:merged.append([a,b])
    left=0;best=1
    for right in range(len(merged)):
        while merged[right][0]-merged[left][1]>k:left+=1
        best=max(best,right-left+1)
    return str(len(merged)-best+1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
