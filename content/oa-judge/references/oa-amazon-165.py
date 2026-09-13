def solve(d):
    a=list(map(ord,d[0]));n=len(a);left=[1]*n;right=[1]*n
    for i in range(1,n):
        if abs(a[i]-a[i-1])<=1:left[i]=left[i-1]+1
    for i in range(n-2,-1,-1):
        if abs(a[i]-a[i+1])<=1:right[i]=right[i+1]+1
    baseline=sum(left);answer=baseline
    for i in range(n):
        old=left[i]*right[i]
        for c in range(97,123):
            l=left[i-1] if i and abs(c-a[i-1])<=1 else 0
            r=right[i+1] if i+1<n and abs(c-a[i+1])<=1 else 0
            answer=max(answer,baseline-old+(l+1)*(r+1))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
