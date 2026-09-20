def solve(d):
    n,lo,hi=map(int,d);width=hi-lo+1
    if n<3 or n>=2*width-1:return '-1'
    p=max(1,n-width);out=list(range(hi-p,hi+1))+list(range(hi-1,hi-(n-p),-1))
    return str(n)+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
