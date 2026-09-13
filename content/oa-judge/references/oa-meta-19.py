def solve(data):
    n,k=map(int,data[:2]); a=list(map(int,data[2:])); left=zeros=best=0
    for right,x in enumerate(a):
        if x==0:zeros+=1
        while zeros>k:
            if a[left]==0:zeros-=1
            left+=1
        best=max(best,right-left+1)
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
