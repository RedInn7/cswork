def solve(d):
    a=list(map(int,d[1:]));run=1;answer=len(a)
    for i in range(1,len(a)):
        run=run+1 if a[i]==a[i-1]-1 else 1;answer+=run-1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
