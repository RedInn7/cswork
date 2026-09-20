def solve(d):
    a=sorted(map(int,d[1:]));total=0;k=0
    for v in a:
        total+=v
        if total>=(k+1)*(k+2)//2:k+=1
    return str(sum(a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
