def solve(d):
    n,g=map(int,d[:2]);a=list(map(int,d[2:]));left=[0];right=[0]
    for x in a[:n//2]:left+=[s+x for s in left]
    for x in a[n//2:]:right+=[s+x for s in right]
    left.sort();right.sort();i=0;j=len(right)-1;answer=abs(g)
    while i<len(left) and j>=0:
        total=left[i]+right[j];answer=min(answer,abs(total-g))
        if total==g:return '1'
        if total<g:i+=1
        else:j-=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
