from array import array
def solve(d):
    k=int(d[0]);s=d[1];n=len(s)
    def cost(v):return v if v<2 else len(str(v))+1
    prefix=array('I',[0])*(n+1);suffix=array('I',[0])*(n+1);left=array('I',[0])*(n+1);right=array('I',[0])*(n+1)
    for i in range(n):
        run=left[i] if i and s[i]==s[i-1] else 0;left[i+1]=run+1;prefix[i+1]=prefix[i]+cost(run+1)-cost(run)
    for i in range(n-1,-1,-1):
        run=right[i+1] if i+1<n and s[i]==s[i+1] else 0;right[i]=run+1;suffix[i]=suffix[i+1]+cost(run+1)-cost(run)
    answer=n
    for l in range(n-k+1):
        r=l+k;value=prefix[l]+suffix[r]
        if l and r<n and s[l-1]==s[r]:value+=cost(left[l]+right[r])-cost(left[l])-cost(right[r])
        answer=min(answer,value)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
