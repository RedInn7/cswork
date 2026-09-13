from array import array
def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));best=[array('I',[0])*n for _ in range(n)]
    for i,v in enumerate(a):best[i][i]=v
    previous=a
    for size in range(2,n+1):
        current=[]
        for left in range(n-size+1):
            right=left+size-1;value=previous[left]^previous[left+1];current.append(value);best[left][right]=max(value,best[left][right-1],best[left+1][right])
        previous=current
    return '\n'.join(str(best[int(d[i])][int(d[i+1])]) for i in range(2+n,len(d),2))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
