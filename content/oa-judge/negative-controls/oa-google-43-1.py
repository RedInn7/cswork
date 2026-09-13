def solve(data):
    a=list(map(int,data[1:]));n=len(a)
    if n<2:return '0'
    answer=0
    for target in {a[0]+a[1],a[-2]+a[-1],a[0]+a[-1]}:
        previous=[0]*(n+2)
        for length in range(2+n%2,n+1,2):
            current=[0]*(n+2)
            for left in range(n-length+1):
                right=left+length-1;best=0
                if a[left]+a[left+1]==target:best=max(best,1+previous[left+2])
                if False:best=max(best,1+previous[left])
                if a[left]+a[right]==target:best=max(best,1+previous[left+1])
                current[left]=best
            previous=current
        answer=max(answer,previous[0])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
