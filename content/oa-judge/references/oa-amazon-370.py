def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);out=[0]*(n+1)
    for left in range(n):
        total=0
        for right in range(left,n):
            total+=a[right];size=right-left+1
            if total%size==0:out[total//size]+=1
    return ' '.join(map(str,out[1:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
