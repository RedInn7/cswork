from bisect import bisect_left
def solve(d):
    n,k,a,b=map(int,d[:4]);p=sorted(map(int,d[4:]))
    def visit(start,length,left,right):
        if left==right:return a
        direct=b*(right-left)*length
        if length==1:return direct
        mid=start+length//2;split=bisect_left(p,mid,left,right)
        return min(direct,max(visit(start,length//2,left,split),visit(mid,length//2,split,right)))
    return str(visit(1,n,0,k))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
