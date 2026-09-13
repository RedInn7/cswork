def solve(data):
    a=list(map(int,data[1:])); n=len(a); left=[1]*n; right=[1]*n
    for i in range(1,n):
        if a[i-1]<a[i]:left[i]=left[i-1]+1
    for i in range(n-2,-1,-1):
        if a[i]<a[i+1]:right[i]=right[i+1]+1
    answer=max(left)
    for i in range(n):
        l=left[i-1] if i else 0; r=right[i+1] if i+1<n else 0
        answer=max(answer,l+1,r+1)
        if 0<i<n-1 and a[i-1]<a[i+1]:answer=max(answer,l+r+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
