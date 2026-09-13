def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));left=total=0;shortest=n+1
    for right,value in enumerate(a):
        total+=value
        while total>=k:
            shortest=min(shortest,right-left+1);total-=a[left];left+=1
    return str(shortest)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
