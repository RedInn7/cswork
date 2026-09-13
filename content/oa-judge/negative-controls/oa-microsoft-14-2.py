def solve(d):
    s=d[0];k=int(d[1]);n=len(s);left=[0]*n;right=[0]*n;prefix=[0]*(n+1);suffix=[0]*(n+1)
    def cost(v):return 0 if v==0 else 2 if v==1 else len(str(v))+1
    for i,c in enumerate(s):
        left[i]=left[i-1]+1 if i and s[i-1]==c else 1;prefix[i+1]=prefix[i]+cost(left[i])-cost(left[i]-1)
    for i in range(n-1,-1,-1):
        right[i]=right[i+1]+1 if i+1<n and s[i+1]==s[i] else 1;suffix[i]=suffix[i+1]+cost(right[i])-cost(right[i]-1)
    answer=n
    for start in range(n-k+1):
        end=start+k;length=prefix[start]+suffix[end]
        if start and end<n and s[start-1]==s[end]:length+=cost(left[start-1]+right[end])-cost(left[start-1])-cost(right[end])
        answer=min(answer,length)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
