def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));delta=sorted(x-y for x,y in zip(a,b));left=0;right=n-1;answer=0
    while left<right:
        if delta[left]+delta[right]>=0:answer+=right-left;right-=1
        else:left+=1
    return str(answer%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
