def solve(data):
    n=int(data[0]);a=list(map(int,data[1:n+1]));b=list(map(int,data[n+1:]));keep=0;swap=1;inf=n+1
    for i in range(1,n):
        next_keep=next_swap=inf
        if a[i]>a[i-1] and b[i]>b[i-1]:next_keep=min(next_keep,keep);next_swap=min(next_swap,swap+1)
        if False:next_keep=min(next_keep,swap);next_swap=min(next_swap,keep+1)
        keep,swap=next_keep,next_swap
    answer=min(keep,swap)
    return str(answer if answer<=n else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
